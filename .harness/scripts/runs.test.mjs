import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeFixtureProject } from './test-helpers.mjs';
import { paths, runPaths } from './lib/paths.mjs';
import { runStart, runEnd, currentRunId, RunLockError } from './lib/runs.mjs';

function mkTask(id, overrides = {}) {
  return {
    id,
    title: `Tarea ${id}`,
    description: 'Descripcion de prueba.',
    acceptance_criteria: [
      { id: 'AC-1', desc: 'pasa el test', check: 'npm test -- x', kind: 'test' },
    ],
    context: [],
    files: ['src/a.ts'],
    depends_on: [],
    priority: 2,
    type: 'feature',
    status: 'pending',
    attempts: 0,
    redispatches: 0,
    split_from: null,
    review_feedback: [],
    ...overrides,
  };
}

test('currentRunId devuelve null sin archivo current', () => {
  const { root } = makeFixtureProject();
  fs.rmSync(paths(root).currentRunFile, { force: true });
  assert.equal(currentRunId(root), null);
});

test('runStart crea run nuevo con sufijo -a cuando no hay current', () => {
  const { root } = makeFixtureProject();
  const p = paths(root);
  fs.rmSync(p.currentRunFile, { force: true });
  const now = new Date('2026-07-21T09:00:00.000Z');
  const res = runStart(root, { now });
  assert.deepEqual(res, { runId: '2026-07-21-a', resumed: false });
  const rp = runPaths(root, '2026-07-21-a');
  for (const dir of [rp.reportsDir, rp.verdictsDir, rp.splitsDir, rp.logsDir]) {
    assert.ok(fs.existsSync(dir), `falta subdir ${dir}`);
  }
  assert.ok(fs.existsSync(rp.journal), 'falta journal.md');
  assert.equal(fs.readFileSync(p.currentRunFile, 'utf8').trim(), '2026-07-21-a');
  assert.equal(fs.readFileSync(p.lockFile, 'utf8'), `${now.toISOString()}\n`);
  assert.equal(currentRunId(root), '2026-07-21-a');
});

test('runStart continua el run del mismo dia apuntado por current', () => {
  const { root } = makeFixtureProject({ runId: '2026-07-20-a' });
  const p = paths(root);
  fs.writeFileSync(p.currentRunFile, '2026-07-20-a\n');
  const rp = runPaths(root, '2026-07-20-a');
  fs.writeFileSync(rp.journal, 'linea previa\n');
  const now = new Date('2026-07-20T15:00:00.000Z');
  const res = runStart(root, { now });
  assert.deepEqual(res, { runId: '2026-07-20-a', resumed: true });
  assert.equal(fs.readFileSync(rp.journal, 'utf8'), 'linea previa\n');
  assert.equal(fs.readFileSync(p.lockFile, 'utf8'), `${now.toISOString()}\n`);
});

test('runStart en dia nuevo con dir de hoy ya existente usa el sufijo siguiente', () => {
  const { root } = makeFixtureProject({ runId: '2026-07-20-a' });
  const p = paths(root);
  fs.writeFileSync(p.currentRunFile, '2026-07-20-a\n');
  fs.mkdirSync(path.join(p.runsDir, '2026-07-21-a'), { recursive: true });
  const now = new Date('2026-07-21T09:00:00.000Z');
  const res = runStart(root, { now });
  assert.deepEqual(res, { runId: '2026-07-21-b', resumed: false });
  assert.equal(fs.readFileSync(p.currentRunFile, 'utf8').trim(), '2026-07-21-b');
});

test('runStart lanza LOCKED con lock fresco (< 30 min)', () => {
  const { root } = makeFixtureProject();
  const p = paths(root);
  fs.rmSync(p.currentRunFile, { force: true });
  const now = new Date('2026-07-21T12:00:00.000Z');
  fs.writeFileSync(p.lockFile, 'otro run\n');
  const fresh = new Date(now.getTime() - 5 * 60 * 1000);
  fs.utimesSync(p.lockFile, fresh, fresh);
  assert.throws(
    () => runStart(root, { now }),
    (err) => err instanceof RunLockError && err.code === 'LOCKED',
  );
});

test('runStart toma un lock stale (>= 30 min) con arbol limpio', () => {
  const { root } = makeFixtureProject();
  const p = paths(root);
  fs.rmSync(p.currentRunFile, { force: true });
  const now = new Date('2026-07-21T12:00:00.000Z');
  fs.writeFileSync(p.lockFile, 'viejo\n');
  const stale = new Date(now.getTime() - 40 * 60 * 1000);
  fs.utimesSync(p.lockFile, stale, stale);
  const res = runStart(root, { now });
  assert.equal(res.runId, '2026-07-21-a');
  assert.equal(fs.readFileSync(p.lockFile, 'utf8'), `${now.toISOString()}\n`);
});

test('runStart lanza LOCKED_DIRTY con lock stale y arbol sucio; force lo toma', () => {
  const { root } = makeFixtureProject();
  const p = paths(root);
  fs.rmSync(p.currentRunFile, { force: true });
  const now = new Date('2026-07-21T12:00:00.000Z');
  fs.writeFileSync(p.lockFile, 'viejo\n');
  const stale = new Date(now.getTime() - 40 * 60 * 1000);
  fs.utimesSync(p.lockFile, stale, stale);
  fs.writeFileSync(path.join(root, 'sucio.txt'), 'cambio sin comitear\n');
  assert.throws(
    () => runStart(root, { now }),
    (err) => err instanceof RunLockError && err.code === 'LOCKED_DIRTY',
  );
  const res = runStart(root, { now, force: true });
  assert.deepEqual(res, { runId: '2026-07-21-a', resumed: false });
  assert.ok(fs.existsSync(p.lockFile));
});

test('runEnd escribe el esqueleto de SUMMARY.md y libera el lock', () => {
  const tasks = [
    mkTask('T-001', { status: 'done' }),
    mkTask('T-002', { status: 'blocked', attempts: 3 }),
    mkTask('T-003', { status: 'pending', depends_on: ['T-002'] }),
  ];
  const { root } = makeFixtureProject({ tasks, runId: '2026-07-20-a' });
  const p = paths(root);
  const rp = runPaths(root, '2026-07-20-a');
  fs.writeFileSync(p.currentRunFile, '2026-07-20-a\n');
  fs.writeFileSync(p.lockFile, 'lock\n');
  fs.writeFileSync(
    rp.journal,
    [
      '2026-07-20T10:00:00.000Z run-start 2026-07-20-a',
      '2026-07-20T10:01:00.000Z start T-001 a1',
      '2026-07-20T10:05:00.000Z approve T-001',
      '2026-07-20T10:08:00.000Z reject T-002 a3 AC-2',
      '2026-07-20T10:09:00.000Z blocked T-002',
      '2026-07-20T10:11:00.000Z lesson [test] x2',
      '2026-07-20T10:12:00.000Z decision D-003',
    ].join('\n') + '\n',
  );
  fs.writeFileSync(
    path.join(rp.verdictsDir, 'T-001.a1.json'),
    JSON.stringify({
      task: 'T-001',
      attempt: 1,
      verdict: 'APROBADO',
      criteria: { pass: ['AC-1'], fail: [], no_evaluable: ['AC-2'] },
      reasons: [],
      checks_ejecutados: true,
      diff_truncado: false,
      leccion_sugerida: null,
    }),
  );
  const res = runEnd(root);
  assert.equal(res.runId, '2026-07-20-a');
  assert.equal(res.summaryPath, rp.summary);
  const summary = fs.readFileSync(rp.summary, 'utf8');
  assert.ok(summary.startsWith('# Run 2026-07-20-a — resumen'));
  assert.ok(summary.includes('## Tareas cerradas'));
  assert.ok(summary.includes('- T-001: Tarea T-001'));
  assert.ok(summary.includes('- T-002: Tarea T-002 (attempts: 3)'));
  assert.ok(summary.includes('- T-003 (bloqueada por T-002)'));
  assert.ok(summary.includes('- T-001.a1: AC-2'));
  assert.ok(summary.includes('- lesson [test] x2'));
  assert.ok(summary.includes('- decision D-003'));
  assert.ok(!fs.existsSync(p.lockFile), 'el lock debe liberarse');
});

test('runEnd omite un veredicto con JSON corrupto y cierra igual (SUMMARY + lock liberado)', () => {
  const tasks = [mkTask('T-001', { status: 'done' }), mkTask('T-002', { status: 'done' })];
  const { root } = makeFixtureProject({ tasks, runId: '2026-07-20-a' });
  const p = paths(root);
  const rp = runPaths(root, '2026-07-20-a');
  fs.writeFileSync(p.currentRunFile, '2026-07-20-a\n');
  fs.writeFileSync(p.lockFile, 'lock\n');
  // Veredicto válido con un AC no evaluable.
  fs.writeFileSync(
    path.join(rp.verdictsDir, 'T-001.a1.json'),
    JSON.stringify({
      task: 'T-001',
      attempt: 1,
      verdict: 'APROBADO',
      criteria: { pass: ['AC-1'], fail: [], no_evaluable: ['AC-2'] },
      reasons: [],
      checks_ejecutados: true,
      diff_truncado: false,
      leccion_sugerida: null,
    }),
  );
  // Veredicto corrupto (JSON malformado, tal como lo escribiría un LLM).
  fs.writeFileSync(path.join(rp.verdictsDir, 'T-002.a1.json'), '{ "criteria": { esto no es json');

  const res = runEnd(root);
  assert.equal(res.runId, '2026-07-20-a');
  const summary = fs.readFileSync(rp.summary, 'utf8');
  assert.ok(summary.startsWith('# Run 2026-07-20-a — resumen'));
  assert.ok(summary.includes('- T-001.a1: AC-2'), 'el veredicto válido debe procesarse');
  assert.ok(!summary.includes('T-002.a1'), 'el veredicto corrupto debe omitirse');
  assert.ok(!fs.existsSync(p.lockFile), 'el lock debe liberarse pese al veredicto corrupto');
});

test('runEnd con secciones vacias escribe "(ninguna)"', () => {
  const { root } = makeFixtureProject({ tasks: [mkTask('T-001')], runId: '2026-07-20-a' });
  const p = paths(root);
  fs.writeFileSync(p.currentRunFile, '2026-07-20-a\n');
  runEnd(root);
  const summary = fs.readFileSync(runPaths(root, '2026-07-20-a').summary, 'utf8');
  assert.ok(summary.includes('## Bloqueadas\n- (ninguna)'));
});

test('runEnd sin run vigente lanza error', () => {
  const { root } = makeFixtureProject();
  fs.rmSync(paths(root).currentRunFile, { force: true });
  assert.throws(() => runEnd(root), /no hay run vigente/);
});
