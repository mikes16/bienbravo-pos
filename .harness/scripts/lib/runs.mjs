import fs from 'node:fs';
import path from 'node:path';
import { paths, runPaths } from './paths.mjs';
import { LOCK_STALE_MINUTES } from './constants.mjs';
import { isTreeCleanExceptHarness } from './gitops.mjs';
import { loadState } from './state.mjs';

export class RunLockError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RunLockError';
    this.code = code; // 'LOCKED' | 'LOCKED_DIRTY'
  }
}

function assertLockFree(root, now, force) {
  const p = paths(root);
  if (!fs.existsSync(p.lockFile)) return;
  const ageMin = (now.getTime() - fs.statSync(p.lockFile).mtimeMs) / 60000;
  if (ageMin < LOCK_STALE_MINUTES) {
    throw new RunLockError(
      'LOCKED',
      `run.lock activo (heartbeat hace ${Math.round(ageMin)} min): hay otra corrida en curso`,
    );
  }
  if (!isTreeCleanExceptHarness(root) && !force) {
    throw new RunLockError(
      'LOCKED_DIRTY',
      'run.lock stale pero el arbol git esta sucio: podria haber un ejecutor vivo; confirma con --force',
    );
  }
}

export function currentRunId(root) {
  const p = paths(root);
  if (!fs.existsSync(p.currentRunFile)) return null;
  const id = fs.readFileSync(p.currentRunFile, 'utf8').trim();
  return id === '' ? null : id;
}

function newRunId(root, dateStr) {
  const p = paths(root);
  const pattern = new RegExp(`^${dateStr}-([a-z])$`);
  let last = null;
  if (fs.existsSync(p.runsDir)) {
    for (const name of fs.readdirSync(p.runsDir)) {
      const m = pattern.exec(name);
      if (m && (last === null || m[1] > last)) last = m[1];
    }
  }
  const letter = last === null ? 'a' : String.fromCharCode(last.charCodeAt(0) + 1);
  return `${dateStr}-${letter}`;
}

export function runStart(root, { now = new Date(), force = false } = {}) {
  const p = paths(root);
  assertLockFree(root, now, force);
  const dateStr = now.toISOString().slice(0, 10);
  const current = currentRunId(root);
  let runId;
  let resumed;
  if (
    current !== null &&
    current.slice(0, 10) === dateStr &&
    fs.existsSync(runPaths(root, current).runDir)
  ) {
    runId = current;
    resumed = true;
  } else {
    runId = newRunId(root, dateStr);
    resumed = false;
  }
  const rp = runPaths(root, runId);
  for (const dir of [rp.reportsDir, rp.verdictsDir, rp.splitsDir, rp.logsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(rp.journal)) fs.writeFileSync(rp.journal, '');
  fs.mkdirSync(path.dirname(p.currentRunFile), { recursive: true });
  fs.writeFileSync(p.currentRunFile, `${runId}\n`);
  fs.writeFileSync(p.lockFile, `${now.toISOString()}\n`);
  return { runId, resumed };
}

function transitiveBlockers(task, byId, blockedIds) {
  const seen = new Set();
  const found = new Set();
  const stack = [...(task.depends_on || [])];
  while (stack.length > 0) {
    const depId = stack.pop();
    if (seen.has(depId)) continue;
    seen.add(depId);
    if (blockedIds.has(depId)) found.add(depId);
    const dep = byId.get(depId);
    if (dep) stack.push(...(dep.depends_on || []));
  }
  return [...found].sort();
}

function section(name, lines) {
  return [`## ${name}`, ...(lines.length > 0 ? lines : ['- (ninguna)']), ''];
}

export function runEnd(root) {
  const runId = currentRunId(root);
  if (runId === null) {
    throw new Error('runEnd: no hay run vigente (.harness/runs/current no existe)');
  }
  const rp = runPaths(root, runId);
  const state = loadState(root);
  const byId = new Map(state.tasks.map((t) => [t.id, t]));

  const raw = fs.existsSync(rp.journal) ? fs.readFileSync(rp.journal, 'utf8') : '';
  const events = raw
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => l.replace(/^\S+\s+/, ''));

  const closed = events.filter((e) => e.startsWith('approve ')).map((e) => e.split(/\s+/)[1]);
  const blockedInRun = events.filter((e) => e.startsWith('blocked ')).map((e) => e.split(/\s+/)[1]);
  const memoryLines = events.filter((e) => e.startsWith('lesson ') || e.startsWith('decision '));

  const blockedIds = new Set(state.tasks.filter((t) => t.status === 'blocked').map((t) => t.id));
  const frozen = state.tasks
    .filter((t) => t.status === 'pending')
    .map((t) => ({ id: t.id, by: transitiveBlockers(t, byId, blockedIds) }))
    .filter((f) => f.by.length > 0);

  const noEvaluable = [];
  if (fs.existsSync(rp.verdictsDir)) {
    for (const file of fs.readdirSync(rp.verdictsDir).sort()) {
      if (!file.endsWith('.json')) continue;
      let verdict;
      try {
        verdict = JSON.parse(fs.readFileSync(path.join(rp.verdictsDir, file), 'utf8'));
      } catch {
        continue; // veredicto ilegible (JSON malformado del LLM): se omite en vez de romper run-end
      }
      const acs = verdict?.criteria?.no_evaluable ?? [];
      if (acs.length > 0) noEvaluable.push(`- ${file.replace(/\.json$/, '')}: ${acs.join(', ')}`);
    }
  }

  const label = (id) => (byId.has(id) ? `${id}: ${byId.get(id).title}` : id);
  const content = [
    `# Run ${runId} — resumen`,
    '',
    ...section('Tareas cerradas', closed.map((id) => `- ${label(id)}`)),
    ...section(
      'Bloqueadas',
      blockedInRun.map((id) => {
        const t = byId.get(id);
        return `- ${label(id)}${t ? ` (attempts: ${t.attempts})` : ''}`;
      }),
    ),
    ...section(
      'Congeladas (deps bloqueadas)',
      frozen.map((f) => `- ${f.id} (bloqueada por ${f.by.join(', ')})`),
    ),
    ...section('Criterios no evaluables', noEvaluable),
    ...section('Lecciones y decisiones nuevas', memoryLines.map((e) => `- ${e}`)),
  ].join('\n');
  fs.writeFileSync(rp.summary, content);

  const p = paths(root);
  if (fs.existsSync(p.lockFile)) fs.unlinkSync(p.lockFile);
  return { runId, summaryPath: rp.summary };
}
