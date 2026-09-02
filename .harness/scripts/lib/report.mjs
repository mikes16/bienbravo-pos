import fs from 'node:fs';
import path from 'node:path';
import { runPaths } from './paths.mjs';
import { currentRunId } from './runs.mjs';
import { REPORT_CLIP_LINES, SCOPE_TOLERANCE, MAX_ATTEMPTS } from './constants.mjs';
import { loadState, getTask } from './state.mjs';
import { loadProfile } from './profile.mjs';
import { handoffPath } from './handoff.mjs';

export function latestReportPath(root, id) {
  const runId = currentRunId(root);
  if (runId === null) return null;
  const { reportsDir } = runPaths(root, runId);
  if (!fs.existsSync(reportsDir)) return null;
  const pattern = new RegExp(`^${id}\\.a(\\d+)\\.md$`);
  let best = null;
  let bestN = -1;
  for (const name of fs.readdirSync(reportsDir)) {
    const m = pattern.exec(name);
    if (m && Number(m[1]) > bestN) {
      bestN = Number(m[1]);
      best = path.join(reportsDir, name);
    }
  }
  return best;
}

function checksHaveExitZero(lines) {
  const start = lines.findIndex((l) => /^CHECKS\b/.test(l));
  if (start === -1) return false;
  for (let i = start; i < lines.length; i += 1) {
    if (i > start && /^[A-Z][A-Z_]*:/.test(lines[i])) break;
    if (/exit 0/.test(lines[i])) return true;
  }
  return false;
}

export function showReport(root, id) {
  const file = latestReportPath(root, id);
  if (file === null) {
    return { clipped: '', result: null, valid: false, reason: 'sin archivo de reporte' };
  }
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const clipped = lines.slice(0, REPORT_CLIP_LINES).join('\n');
  const resultLine = lines.find((l) => /^RESULT:/.test(l));
  const m = resultLine ? /^RESULT:\s*(DONE|FAILED|NEEDS_SPLIT)\b/.exec(resultLine) : null;
  if (!m) {
    return { clipped, result: null, valid: false, reason: 'sin linea RESULT valida' };
  }
  const result = m[1];
  if (result === 'DONE' && !checksHaveExitZero(lines)) {
    return { clipped, result, valid: false, reason: 'RESULT DONE sin linea de CHECKS con exit 0' };
  }
  return { clipped, result, valid: true, reason: null };
}

function flat(text) {
  return String(text).replace(/\s*\n\s*/g, ' ').trim();
}

function pendingFixes(task, attempt, runId) {
  const feedback = (task.review_feedback || []).filter((f) => f && typeof f === 'object');
  if (feedback.length === 0) {
    return [
      `INTENTO ${attempt} de ${MAX_ATTEMPTS}. Fallo previo — lee tu reporte y corrige:`,
      `- .harness/runs/${runId}/reports/${task.id}.a${task.attempts}.md`,
    ];
  }
  const last = feedback[feedback.length - 1];
  const lines = [
    `INTENTO ${attempt} de ${MAX_ATTEMPTS}. Rechazo previo — corrige exactamente esto:`,
  ];
  for (const r of (last.reasons ?? []).slice(0, 5)) {
    lines.push(`- [${r.ac}] ${r.issue} → ${r.fix}`);
  }
  const lastPass = last.criteria?.pass ?? [];
  if (lastPass.length > 0) {
    lines.push(`Criterios ya en verde (no los rompas): ${lastPass.join(', ')}.`);
  }
  const history = feedback
    .map((f) => `a${f.attempt} falló ${(f.criteria?.fail ?? []).join(',')}`)
    .join('; ');
  lines.push(`Historial: ${history}.`);
  return lines;
}

function executorDispatch(root, task, attempt, runId, reportRel) {
  const lines = [];
  lines.push(`TAREA ${task.id} · intento ${attempt} de ${MAX_ATTEMPTS} · ${task.title}`);
  lines.push(`DESCRIPCION: ${flat(task.description)}`);
  lines.push('CRITERIOS:');
  for (const ac of task.acceptance_criteria) {
    lines.push(`- ${ac.id} [${ac.kind}] ${flat(ac.desc)} || check: ${ac.check}`);
  }
  lines.push(`FILES (alcance estricto): ${task.files.join(', ')}`);
  if (task.context.length > 0) {
    lines.push('CONTEXT:');
    for (const c of task.context) {
      lines.push(`- [${c.type}] ${c.path} — ${flat(c.reason)}`);
    }
  }
  lines.push(
    'LEE ADEMAS: .harness/PROFILE.md · .harness/memory/PROJECT.md · DECISIONS.md · LESSONS.md',
  );
  const handoffs = task.depends_on
    .filter((dep) => fs.existsSync(handoffPath(root, dep)))
    .map((dep) => `.harness/handoffs/${dep}.md`);
  if (handoffs.length > 0) {
    lines.push(`HANDOFFS DE DEPS: ${handoffs.join(' · ')}`);
  }
  lines.push(`REPORTE → ${reportRel}`);
  if (task.attempts > 0) {
    lines.push(...pendingFixes(task, attempt, runId));
  }
  return lines.join('\n');
}

function reviewerDispatch(task, profile, attempt, runId, reportRel) {
  const { commands, limits } = profile;
  const lines = [];
  lines.push(`REVISION ${task.id} · intento ${attempt} · ${task.title}`);
  lines.push('CRITERIOS:');
  for (const ac of task.acceptance_criteria) {
    const manual = ac.kind === 'manual' ? ' (manual → no_evaluable)' : '';
    lines.push(`- ${ac.id} [${ac.kind}]${manual} ${flat(ac.desc)} || check: ${ac.check}`);
  }
  lines.push(`COMANDOS: test: ${commands.test} · build: ${commands.build}`);
  lines.push(
    `LIMITES: diff_max ${limits.diff_max} · tolerancia de alcance ${SCOPE_TOLERANCE} archivos extra solo test/fixture · timeout_check ${limits.timeout_check_s}s`,
  );
  lines.push(`DIFF_EXCLUDES: ${limits.diff_excludes.join(', ')}`);
  lines.push(`ALCANCE (files[]): ${task.files.join(', ')}`);
  lines.push('LEE: .harness/memory/DECISIONS.md completo · lecciones [test]/[build] de LESSONS.md');
  lines.push(`REPORTE DEL EJECUTOR (afirmaciones a verificar): ${reportRel}`);
  lines.push(`VEREDICTO → .harness/runs/${runId}/verdicts/${task.id}.a${attempt}.json`);
  return lines.join('\n');
}

export function buildDispatch(root, id, { role }) {
  if (role !== 'executor' && role !== 'reviewer') {
    throw new Error(`buildDispatch: role invalido '${role}' (usa executor|reviewer)`);
  }
  const runId = currentRunId(root);
  if (runId === null) {
    throw new Error('buildDispatch: no hay run vigente; corre run-start primero');
  }
  const state = loadState(root);
  const task = getTask(state, id);
  const attempt = task.attempts + 1;
  const reportRel = `.harness/runs/${runId}/reports/${id}.a${attempt}.md`;
  if (role === 'executor') {
    return executorDispatch(root, task, attempt, runId, reportRel);
  }
  const profile = loadProfile(root);
  return reviewerDispatch(task, profile, attempt, runId, reportRel);
}
