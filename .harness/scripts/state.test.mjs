import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { makeFixtureProject, readState } from './test-helpers.mjs';
import { loadState, saveState, getTask, appendJournal, touchLock } from './lib/state.mjs';

function validTask(overrides = {}) {
  return {
    id: 'T-001',
    title: 'Tarea de prueba',
    description: 'Una tarea válida para los tests.',
    acceptance_criteria: [{ id: 'AC-1', desc: 'tests pass', check: 'npm test', kind: 'test' }],
    context: [],
    files: ['src/a.ts'],
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

test('loadState returns the parsed state when tasks.json is valid', () => {
  const { root } = makeFixtureProject({ tasks: [validTask()] });
  const state = loadState(root);
  assert.equal(state.version, 1);
  assert.equal(state.tasks.length, 1);
  assert.equal(state.tasks[0].id, 'T-001');
});

test('loadState throws a readable error on broken JSON', () => {
  const { root, tasksJson } = makeFixtureProject();
  writeFileSync(tasksJson, '{ not json');
  assert.throws(() => loadState(root), /not valid JSON/);
});

test('loadState throws with path detail on schema violations', () => {
  const { root } = makeFixtureProject({ tasks: [validTask({ status: 'bogus' })] });
  assert.throws(() => loadState(root), /\$\.tasks\[0\]\.status/);
});

test('getTask finds by id and throws for unknown ids', () => {
  const state = { version: 1, tasks: [validTask()] };
  assert.equal(getTask(state, 'T-001').id, 'T-001');
  assert.throws(() => getTask(state, 'T-999'), /T-999/);
});

test('saveState backs up the previous content and writes atomically', () => {
  const { root, tasksJson, runDir } = makeFixtureProject({ tasks: [validTask()] });
  const before = readFileSync(tasksJson, 'utf8');
  const state = loadState(root);
  state.tasks[0].status = 'in_progress';
  saveState(root, state);
  assert.equal(readState(root).tasks[0].status, 'in_progress');
  const backup = readFileSync(join(runDir, 'tasks.backup.json'), 'utf8');
  assert.equal(backup, before);                 // el backup es el estado previo exacto
  assert.ok(!existsSync(tasksJson + '.tmp'));   // sin archivos temporales residuales
});

test('saveState rotates the backup: it always holds the immediately previous state', () => {
  const { root, tasksJson, runDir } = makeFixtureProject({ tasks: [validTask()] });
  const s1 = loadState(root);
  s1.tasks[0].status = 'in_progress';
  saveState(root, s1);
  const afterFirst = readFileSync(tasksJson, 'utf8');
  const s2 = loadState(root);
  s2.tasks[0].status = 'in_review';
  saveState(root, s2);
  const backup = readFileSync(join(runDir, 'tasks.backup.json'), 'utf8');
  assert.equal(backup, afterFirst);             // ya no guarda el estado inicial
});

test('saveState refuses an invalid state and leaves tasks.json untouched', () => {
  const { root, tasksJson } = makeFixtureProject({ tasks: [validTask()] });
  const before = readFileSync(tasksJson, 'utf8');
  const state = loadState(root);
  state.tasks[0].status = 'bogus';
  assert.throws(() => saveState(root, state), /invalid state/);
  assert.equal(readFileSync(tasksJson, 'utf8'), before);
});

test('appendJournal appends ISO-timestamped lines to the current run journal', () => {
  const { root, runDir } = makeFixtureProject();
  appendJournal(root, 'start T-001 a1');
  appendJournal(root, 'to-review T-001 a1');
  const lines = readFileSync(join(runDir, 'journal.md'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z start T-001 a1$/);
  assert.match(lines[1], / to-review T-001 a1$/);
});

test('touchLock refreshes an existing lock and ignores a missing one', () => {
  const { root } = makeFixtureProject();
  const lockFile = join(root, '.harness', 'run.lock');
  touchLock(root);                              // sin lock: no-op, NO lo crea
  assert.ok(!existsSync(lockFile));
  writeFileSync(lockFile, '2020-01-01T00:00:00.000Z\n');
  touchLock(root);
  const content = readFileSync(lockFile, 'utf8').trim();
  assert.notEqual(content, '2020-01-01T00:00:00.000Z');
  assert.match(content, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.ok(new Date(content).getTime() > Date.now() - 5000);
});
