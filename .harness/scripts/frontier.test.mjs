import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeFixtureProject, readState } from './test-helpers.mjs';
import { paths } from './lib/paths.mjs';
import { nextTask, statusReport, importTasks, editTask } from './lib/frontier.mjs';

// Construye una tarea completa y válida; `over` sobreescribe campos puntuales.
function mkTask(id, over = {}) {
  return {
    id,
    title: `Tarea ${id}`,
    description: 'descripcion de prueba',
    acceptance_criteria: [{ id: 'AC-1', desc: 'ok', check: 'npm test', kind: 'test' }],
    context: [],
    files: [],
    depends_on: [],
    priority: 2,
    type: 'feature',
    status: 'pending',
    attempts: 0,
    redispatches: 0,
    split_from: null,
    review_feedback: [],
    ...over,
  };
}

test('nextTask devuelve null si no hay tareas elegibles', () => {
  assert.equal(nextTask({ version: 1, tasks: [] }), null);
});

test('nextTask ordena por priority asc y luego por id', () => {
  const state = {
    version: 1,
    tasks: [
      mkTask('T-001', { status: 'done' }),
      mkTask('T-002', { priority: 2, depends_on: ['T-001'] }),
      mkTask('T-003', { priority: 1, depends_on: ['T-001'] }),
      mkTask('T-004', { priority: 1 }),
    ],
  };
  // Elegibles: T-002(p2), T-003(p1), T-004(p1). Empate p1 → id asc → T-003.
  assert.equal(nextTask(state).id, 'T-003');
});

test('nextTask excluye tareas cuyas deps no estan done', () => {
  const state = {
    version: 1,
    tasks: [
      mkTask('T-001', { status: 'in_progress' }),
      mkTask('T-002', { depends_on: ['T-001'] }),
    ],
  };
  assert.equal(nextTask(state), null);
});

test('statusReport clasifica frontier, inFlight, blocked y frozen transitivo', () => {
  const { root } = makeFixtureProject({
    tasks: [
      mkTask('T-001', { status: 'done' }),
      mkTask('T-002', { depends_on: ['T-001'] }),        // frontier (dep done)
      mkTask('T-003', { status: 'blocked' }),
      mkTask('T-004', { depends_on: ['T-003'] }),        // frozen directo por T-003
      mkTask('T-005', { status: 'in_progress' }),
      mkTask('T-006', { status: 'in_review' }),
      mkTask('T-007', { depends_on: ['T-005'] }),        // espera (dep in_progress): ni frontier ni frozen
      mkTask('T-008', { depends_on: ['T-004'] }),        // frozen transitivo por T-003
    ],
  });

  const r = statusReport(root);

  assert.deepEqual(r.frontier.map((f) => f.id), ['T-002']);
  assert.deepEqual(r.frontier[0], { id: 'T-002', title: 'Tarea T-002', priority: 2, attempts: 0 });

  assert.deepEqual(r.inFlight.map((x) => x.id).sort(), ['T-005', 'T-006']);
  assert.equal(r.inFlight.find((x) => x.id === 'T-005').status, 'in_progress');
  assert.equal(r.inFlight.find((x) => x.id === 'T-006').status, 'in_review');

  assert.deepEqual(r.blocked, [{ id: 'T-003', title: 'Tarea T-003' }]);

  assert.deepEqual(r.frozen.map((f) => f.id), ['T-004', 'T-008']);
  assert.deepEqual(r.frozen.find((f) => f.id === 'T-004').blockedBy, ['T-003']);
  assert.deepEqual(r.frozen.find((f) => f.id === 'T-008').blockedBy, ['T-003']);
  assert.equal(r.frozen.some((f) => f.id === 'T-007'), false);

  assert.equal(r.curationFlagCleared, false);
});

test('statusReport borra el flag de curacion huerfano', () => {
  const { root } = makeFixtureProject({ tasks: [mkTask('T-001', { status: 'done' })] });
  const flag = paths(root).curationFlag;
  fs.writeFileSync(flag, 'x');

  const r = statusReport(root);

  assert.equal(r.curationFlagCleared, true);
  assert.equal(fs.existsSync(flag), false);
});

test('statusReport conserva el flag si hay curacion en vuelo', () => {
  const { root } = makeFixtureProject({
    tasks: [
      mkTask('T-001', {
        type: 'curation',
        status: 'in_progress',
        files: ['.harness/memory/LESSONS.md'],
      }),
    ],
  });
  const flag = paths(root).curationFlag;
  fs.writeFileSync(flag, 'x');

  const r = statusReport(root);

  assert.equal(r.curationFlagCleared, false);
  assert.equal(fs.existsSync(flag), true);
});

test('statusReport devuelve false si no existe el flag de curacion', () => {
  const { root } = makeFixtureProject({ tasks: [mkTask('T-001')] });
  assert.equal(statusReport(root).curationFlagCleared, false);
});

// Escribe un borrador y devuelve su ruta absoluta dentro de .harness/plan/.
function writeDraft(root, name, obj) {
  const dir = paths(root).planDir;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(obj));
  return file;
}

function draftTask(over = {}) {
  return {
    title: 'Tarea nueva',
    description: 'hace algo',
    acceptance_criteria: [{ id: 'AC-1', desc: 'ok', check: 'npm test', kind: 'test' }],
    context: [],
    files: ['src/a.ts'],
    depends_on: [],
    priority: 2,
    type: 'feature',
    ...over,
  };
}

test('importTasks asigna ids consecutivos, defaults de runtime y hace append', () => {
  const { root } = makeFixtureProject({ tasks: [] });
  const draftPath = writeDraft(root, 'draft.json', {
    tasks: [
      draftTask({ title: 'Uno', files: ['src/a.ts'], priority: 1 }),
      draftTask({ title: 'Dos', files: ['src/b.ts'], depends_on: ['T-001'] }),
    ],
  });

  const res = importTasks(root, draftPath);

  assert.deepEqual(res.added, ['T-001', 'T-002']);
  const state = readState(root);
  assert.equal(state.tasks.length, 2);
  assert.deepEqual(state.tasks[1].depends_on, ['T-001']);
  // Defaults de runtime aplicados a cada tarea nueva.
  const t = state.tasks[0];
  assert.equal(t.status, 'pending');
  assert.equal(t.attempts, 0);
  assert.equal(t.redispatches, 0);
  assert.equal(t.split_from, null);
  assert.deepEqual(t.review_feedback, []);
});

test('importTasks continua la numeracion desde el maximo existente', () => {
  const { root } = makeFixtureProject({ tasks: [mkTask('T-005', { status: 'done' })] });
  const draftPath = writeDraft(root, 'draft.json', { tasks: [draftTask({ title: 'Sexta' })] });

  const res = importTasks(root, draftPath);

  assert.deepEqual(res.added, ['T-006']);
  assert.equal(readState(root).tasks.length, 2);
});

test('importTasks rechaza y no persiste si el lint falla (dep colgante)', () => {
  const { root } = makeFixtureProject({ tasks: [] });
  const draftPath = writeDraft(root, 'draft.json', {
    tasks: [draftTask({ depends_on: ['T-999'] })],
  });

  assert.throws(() => importTasks(root, draftPath));
  assert.equal(readState(root).tasks.length, 0);
});

test('editTask reemplaza campos editables y conserva los de runtime', () => {
  const { root } = makeFixtureProject({
    tasks: [mkTask('T-001', { priority: 2, attempts: 2, status: 'blocked' })],
  });
  const draftPath = writeDraft(root, 'edit.json', { title: 'Nuevo titulo', priority: 1 });

  const res = editTask(root, 'T-001', draftPath);

  assert.equal(res.task.id, 'T-001');
  const t = readState(root).tasks[0];
  assert.equal(t.title, 'Nuevo titulo');
  assert.equal(t.priority, 1);
  assert.equal(t.attempts, 2);        // runtime intacto
  assert.equal(t.status, 'blocked');  // runtime intacto
});

test('editTask lanza si la tarea no existe', () => {
  const { root } = makeFixtureProject({ tasks: [] });
  const draftPath = writeDraft(root, 'edit.json', { title: 'x' });
  assert.throws(() => editTask(root, 'T-404', draftPath));
});

test('editTask no persiste si el lint falla', () => {
  const { root } = makeFixtureProject({ tasks: [mkTask('T-001', { priority: 2 })] });
  const draftPath = writeDraft(root, 'edit.json', { depends_on: ['T-999'] });

  assert.throws(() => editTask(root, 'T-001', draftPath));
  const t = readState(root).tasks[0];
  assert.deepEqual(t.depends_on, []);   // sin cambios en disco
  assert.equal(t.priority, 2);
});
