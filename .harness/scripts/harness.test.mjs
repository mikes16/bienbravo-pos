import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFixtureProject, readState, git } from './test-helpers.mjs';

const HARNESS = fileURLToPath(new URL('./harness.mjs', import.meta.url));
const RUN_ID = '2026-07-20-a';

function cli(root, ...args) {
  return spawnSync(process.execPath, [HARNESS, ...args], { cwd: root, encoding: 'utf8' });
}

function baseTask(overrides = {}) {
  return {
    id: 'T-001',
    title: 'Sample task',
    description: 'Implements a sample module.',
    acceptance_criteria: [{ id: 'AC-1', desc: 'unit test passes', check: 'true', kind: 'test' }],
    context: [],
    files: ['src/sample.js'],
    depends_on: [],
    priority: 1,
    type: 'feature',
    status: 'pending',
    attempts: 0,
    redispatches: 0,
    split_from: null,
    review_feedback: [],
    ...overrides,
  };
}

function ensureCurrentRun(root) {
  fs.writeFileSync(path.join(root, '.harness', 'runs', 'current'), RUN_ID);
}

test('next: cola vacía imprime null con exit 0', () => {
  const { root } = makeFixtureProject();
  ensureCurrentRun(root);
  const r = cli(root, 'next');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'null');
});

test('status: imprime JSON con la frontera', () => {
  const { root } = makeFixtureProject({ tasks: [baseTask()] });
  ensureCurrentRun(root);
  const r = cli(root, 'status');
  assert.equal(r.status, 0, r.stderr);
  const parsed = JSON.parse(r.stdout);
  assert.equal(parsed.frontier.length, 1);
  assert.equal(parsed.frontier[0].id, 'T-001');
});

test('comando desconocido: usage por stderr y exit 1', () => {
  const { root } = makeFixtureProject();
  const r = cli(root, 'frobnicate');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Uso:/);
});

test('lint: dependencia inexistente sale con exit 1 y detalle', () => {
  const { root } = makeFixtureProject({ tasks: [baseTask({ depends_on: ['T-999'] })] });
  ensureCurrentRun(root);
  const r = cli(root, 'lint');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /T-999/);
});

test('touchLock: un comando de lectura refresca el heartbeat del lock', () => {
  const { root } = makeFixtureProject();
  ensureCurrentRun(root);
  const lock = path.join(root, '.harness', 'run.lock');
  fs.writeFileSync(lock, new Date().toISOString());
  const past = new Date('2026-07-20T00:00:00Z');
  fs.utimesSync(lock, past, past);
  const r = cli(root, 'next');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.statSync(lock).mtimeMs > past.getTime());
});

test('camino feliz: start + report + to-review + approve', () => {
  const { root, runDir } = makeFixtureProject({ tasks: [baseTask()] });
  ensureCurrentRun(root);

  const rStart = cli(root, 'start', 'T-001');
  assert.equal(rStart.status, 0, rStart.stderr);
  assert.equal(readState(root).tasks[0].status, 'in_progress');
  assert.match(fs.readFileSync(path.join(runDir, 'journal.md'), 'utf8'), /start T-001 a1/);

  fs.writeFileSync(
    path.join(runDir, 'reports', 'T-001.a1.md'),
    [
      'RESULT: DONE',
      'CHECKS: npm test -> exit 0 (3 passed)',
      'FILES_CHANGED: src/sample.js',
      'SUMMARY: implemented the sample module',
    ].join('\n'),
  );
  const rReport = cli(root, 'report', '--show', 'T-001');
  assert.equal(rReport.status, 0, rReport.stderr);
  const report = JSON.parse(rReport.stdout);
  assert.equal(report.result, 'DONE');
  assert.equal(report.valid, true);

  const rToReview = cli(root, 'to-review', 'T-001');
  assert.equal(rToReview.status, 0, rToReview.stderr);
  assert.equal(readState(root).tasks[0].status, 'in_review');

  fs.writeFileSync(
    path.join(runDir, 'verdicts', 'T-001.a1.json'),
    JSON.stringify({
      task: 'T-001',
      attempt: 1,
      verdict: 'APROBADO',
      criteria: { pass: ['AC-1'], fail: [], no_evaluable: [] },
      reasons: [],
      checks_ejecutados: true,
      diff_truncado: false,
      leccion_sugerida: null,
    }),
  );
  fs.mkdirSync(path.join(root, '.harness', 'handoffs'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.harness', 'handoffs', 'T-001.md'),
    [
      '# Handoff T-001 — Sample task',
      '## Interfaz expuesta',
      '- `sample()` returns a greeting string',
      '## Archivos',
      '- Creado: `src/sample.js`',
    ].join('\n'),
  );

  const rApprove = cli(root, 'approve', 'T-001');
  assert.equal(rApprove.status, 0, rApprove.stderr);
  assert.equal(readState(root).tasks[0].status, 'done');
  assert.match(git(root, 'log', '--oneline').stdout, /T-001: Sample task/);
  assert.match(fs.readFileSync(path.join(runDir, 'journal.md'), 'utf8'), /approve T-001/);
});

test('transición ilegal: approve sobre pending sale con exit 2', () => {
  const { root } = makeFixtureProject({ tasks: [baseTask()] });
  ensureCurrentRun(root);
  const r = cli(root, 'approve', 'T-001');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /transición ilegal/);
});

test('parser: --for=executor y --for executor producen lo mismo', () => {
  const { root } = makeFixtureProject({ tasks: [baseTask()] });
  ensureCurrentRun(root);
  const a = cli(root, 'show', 'T-001', '--for=executor');
  const b = cli(root, 'show', 'T-001', '--for', 'executor');
  assert.equal(a.status, 0, a.stderr);
  assert.equal(b.status, 0, b.stderr);
  assert.deepEqual(JSON.parse(a.stdout), JSON.parse(b.stdout));
});

// Regresión: main() NO debe refrescar el lock antes de despachar run-start, o un
// lock stale (sesión muerta) se leería como fresco y siempre lanzaría LOCKED.
function stampStaleLock(root, minutesAgo = 40) {
  const lock = path.join(root, '.harness', 'run.lock');
  fs.writeFileSync(lock, 'sesión muerta\n');
  const stale = new Date(Date.now() - minutesAgo * 60 * 1000);
  fs.utimesSync(lock, stale, stale);
  return lock;
}

test('run-start: reclama un lock stale con árbol limpio (exit 0)', () => {
  const { root } = makeFixtureProject();
  ensureCurrentRun(root);
  const lock = stampStaleLock(root);
  const r = cli(root, 'run-start');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /run-start/);
  // El lock quedó tomado: su mtime se refrescó a "ahora" (ya no es stale).
  assert.ok((Date.now() - fs.statSync(lock).mtimeMs) / 60000 < 1, 'el lock no se reclamó');
});

test('run-start: lock stale + árbol sucio exige --force (LOCKED_DIRTY→1, --force→0)', () => {
  const { root } = makeFixtureProject();
  ensureCurrentRun(root);
  const lock = stampStaleLock(root);
  fs.writeFileSync(path.join(root, 'sucio.txt'), 'cambio sin comitear\n');

  const blocked = cli(root, 'run-start');
  assert.equal(blocked.status, 1, blocked.stdout);
  assert.match(blocked.stderr, /--force/); // comportamiento LOCKED_DIRTY, no LOCKED
  // El lock stale NO se refrescó antes del dispatch: sigue viéndose stale.
  assert.ok((Date.now() - fs.statSync(lock).mtimeMs) / 60000 >= 30, 'el lock stale se refrescó');

  const forced = cli(root, 'run-start', '--force');
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(forced.stdout, /run-start/);
});
