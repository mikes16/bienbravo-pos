import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeFixtureProject, readState } from './test-helpers.mjs';
import { addLesson, addDecision, lintMemory, memoryInit, setCurationFlag, clearCurationFlag, maybeEnqueueCuration } from './lib/memory.mjs';

function lessonsFile(root) {
  return join(root, '.harness', 'memory', 'LESSONS.md');
}
function decisionsFile(root) {
  return join(root, '.harness', 'memory', 'DECISIONS.md');
}
function projectFile(root) {
  return join(root, '.harness', 'memory', 'PROJECT.md');
}

test('addLesson agrega leccion nueva como (x1) al final del archivo', () => {
  const { root } = makeFixtureProject();
  writeFileSync(lessonsFile(root), '# Lecciones\n');
  const res = addLesson(root, {
    tag: 'test',
    task: 'T-004',
    text: 'Corre `npm run lint` ANTES de reportar terminado.',
  });
  assert.equal(res.merged, false);
  assert.equal(res.line, '- [test] (x1, T-004) Corre `npm run lint` ANTES de reportar terminado.');
  const content = readFileSync(lessonsFile(root), 'utf8');
  assert.equal(
    content,
    '# Lecciones\n- [test] (x1, T-004) Corre `npm run lint` ANTES de reportar terminado.\n',
  );
});

test('addLesson fusiona con solapamiento >= 0.8: incrementa (xN) y suma el task id', () => {
  const { root } = makeFixtureProject();
  writeFileSync(
    lessonsFile(root),
    '# Lecciones\n- [test] (x1, T-004) Corre `npm run lint` ANTES de reportar terminado.\n',
  );
  const res = addLesson(root, {
    tag: 'test',
    task: 'T-009',
    text: 'corre npm run lint antes de reportar terminado',
  });
  assert.equal(res.merged, true);
  assert.equal(res.line, '- [test] (x2, T-004/T-009) Corre `npm run lint` ANTES de reportar terminado.');
  const lessonLines = readFileSync(lessonsFile(root), 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('- ['));
  assert.equal(lessonLines.length, 1, 'no debe duplicar la leccion');
});

test('addLesson NO fusiona lecciones distintas (solapamiento bajo)', () => {
  const { root } = makeFixtureProject();
  writeFileSync(
    lessonsFile(root),
    '# Lecciones\n- [test] (x1, T-004) Corre `npm run lint` ANTES de reportar terminado.\n',
  );
  const res = addLesson(root, {
    tag: 'api',
    task: 'T-007',
    text: 'useCliente() devuelve {data,error}, nunca lanza.',
  });
  assert.equal(res.merged, false);
  const lessonLines = readFileSync(lessonsFile(root), 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('- ['));
  assert.equal(lessonLines.length, 2);
});

test('addLesson rechaza tag fuera de LESSON_TAGS', () => {
  const { root } = makeFixtureProject();
  writeFileSync(lessonsFile(root), '# Lecciones\n');
  assert.throws(() => addLesson(root, { tag: 'ux', task: 'T-001', text: 'algo' }), /tag/);
});

test('addDecision asigna D-001 en archivo sin entradas y usa fecha iso corta', () => {
  const { root } = makeFixtureProject();
  writeFileSync(decisionsFile(root), '# Decisiones\n');
  const res = addDecision(root, { task: 'T-003', text: 'Estado global: zustand.' });
  assert.equal(res.id, 'D-001');
  const today = new Date().toISOString().slice(0, 10);
  const content = readFileSync(decisionsFile(root), 'utf8');
  assert.ok(content.includes(`- [D-001] ${today} (T-003) Estado global: zustand.`));
});

test('addDecision con substitutes reemplaza la linea vieja por SUSTITUIDA', () => {
  const { root } = makeFixtureProject();
  writeFileSync(
    decisionsFile(root),
    '# Decisiones\n- [D-001] 2026-07-19 (T-003) Estado global: zustand.\n',
  );
  const res = addDecision(root, {
    task: 'T-010',
    text: 'Estado global: jotai.',
    substitutes: 'D-001',
  });
  assert.equal(res.id, 'D-002');
  const lines = readFileSync(decisionsFile(root), 'utf8').split('\n');
  assert.ok(lines.includes('- [D-001] SUSTITUIDA por D-002'));
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(lines.includes(`- [D-002] ${today} (T-010) Estado global: jotai.`));
  assert.ok(!lines.some((l) => l.includes('zustand')), 'la linea vieja se reemplaza entera');
});

test('addDecision lanza si substitutes no existe', () => {
  const { root } = makeFixtureProject();
  writeFileSync(decisionsFile(root), '# Decisiones\n');
  assert.throws(
    () => addDecision(root, { task: 'T-010', text: 'algo', substitutes: 'D-099' }),
    /D-099/,
  );
});

function seedValidMemory(root) {
  writeFileSync(projectFile(root), '# Proyecto\nBrief corto.\n');
  writeFileSync(
    decisionsFile(root),
    '# Decisiones\n'
      + '- [D-001] 2026-07-19 (T-003) Estado global: zustand.\n'
      + '- [D-002] SUSTITUIDA por D-003\n'
      + '- [D-003] 2026-07-20 (T-010) Estado global: jotai.\n',
  );
  writeFileSync(
    lessonsFile(root),
    '# Lecciones\n- [test] (x2, T-004/T-009) Corre lint antes de reportar.\n',
  );
}

test('lintMemory verde con memoria valida', () => {
  const { root } = makeFixtureProject();
  seedValidMemory(root);
  assert.deepEqual(lintMemory(root), { errors: [] });
});

test('lintMemory reporta tope de lineas excedido', () => {
  const { root } = makeFixtureProject();
  seedValidMemory(root);
  const many = Array.from(
    { length: 61 },
    (_, i) => `- [test] (x1, T-${String(i + 1).padStart(3, '0')}) regla numero ${i}`,
  );
  writeFileSync(lessonsFile(root), many.join('\n') + '\n');
  const { errors } = lintMemory(root);
  const hit = errors.find((e) => e.file === 'LESSONS.md' && e.rule === 'line-limit');
  assert.ok(hit, 'debe reportar line-limit en LESSONS.md');
  assert.match(hit.detail, /61/);
});

test('lintMemory reporta entradas mal formadas', () => {
  const { root } = makeFixtureProject();
  seedValidMemory(root);
  writeFileSync(decisionsFile(root), '# Decisiones\n- decision sin ID\n');
  writeFileSync(
    lessonsFile(root),
    '# Lecciones\n- [ux] (x1, T-001) tag invalido\n- sin formato\n',
  );
  const { errors } = lintMemory(root);
  assert.equal(errors.filter((e) => e.file === 'DECISIONS.md' && e.rule === 'entry-format').length, 1);
  assert.equal(errors.filter((e) => e.file === 'LESSONS.md' && e.rule === 'entry-format').length, 2);
});

test('lintMemory reporta archivo de memoria faltante', () => {
  const { root } = makeFixtureProject();
  seedValidMemory(root);
  rmSync(lessonsFile(root));
  const { errors } = lintMemory(root);
  assert.ok(errors.some((e) => e.file === 'LESSONS.md' && e.rule === 'missing-file'));
});

test('memoryInit instala PROJECT.md desde el borrador', () => {
  const { root } = makeFixtureProject();
  mkdirSync(join(root, '.harness', 'plan'), { recursive: true });
  const draft = join(root, '.harness', 'plan', 'PROJECT.draft.md');
  writeFileSync(draft, '# Proyecto\nAgencia OS.\n## Stack\n- React\n');
  const res = memoryInit(root, draft);
  assert.equal(res.lines, 4);
  assert.equal(
    readFileSync(projectFile(root), 'utf8'),
    '# Proyecto\nAgencia OS.\n## Stack\n- React\n',
  );
});

test('memoryInit rechaza borrador que excede el tope de PROJECT.md', () => {
  const { root } = makeFixtureProject();
  mkdirSync(join(root, '.harness', 'plan'), { recursive: true });
  const draft = join(root, '.harness', 'plan', 'PROJECT.draft.md');
  writeFileSync(draft, Array.from({ length: 61 }, (_, i) => `linea ${i}`).join('\n') + '\n');
  assert.throws(() => memoryInit(root, draft), /61/);
});

test('setCurationFlag crea .harness/curation-active y clearCurationFlag lo borra', () => {
  const { root } = makeFixtureProject();
  const flag = join(root, '.harness', 'curation-active');
  assert.ok(!existsSync(flag));
  setCurationFlag(root);
  assert.ok(existsSync(flag));
  clearCurationFlag(root);
  assert.ok(!existsSync(flag));
  clearCurationFlag(root); // idempotente: no lanza si ya no existe
  assert.ok(!existsSync(flag));
});

const CURATION_DRAFT = {
  tasks: [
    {
      title: 'Curar memoria del harness',
      description:
        'Fusionar lecciones duplicadas, archivar entradas SUSTITUIDA y lecciones (x1) '
        + 'viejas a .harness/memory/archive/, promover lecciones (x3)+ a PROJECT.md.',
      acceptance_criteria: [
        {
          id: 'AC-1',
          desc: 'lint-memory pasa sin errores (topes y formato)',
          check: 'node .harness/scripts/harness.mjs lint-memory',
          kind: 'lint',
        },
      ],
      context: [],
      files: [
        '.harness/memory/PROJECT.md',
        '.harness/memory/DECISIONS.md',
        '.harness/memory/LESSONS.md',
      ],
      depends_on: [],
      priority: 1,
      type: 'curation',
    },
  ],
};

function seedCurationTemplate(root) {
  const dir = join(root, '.harness', 'templates');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'CURATION-TASK.json'), JSON.stringify(CURATION_DRAFT, null, 2) + '\n');
}

function seedMemoryBelowThreshold(root) {
  writeFileSync(projectFile(root), '# Proyecto\nBrief corto.\n');
  writeFileSync(decisionsFile(root), '# Decisiones\n');
  writeFileSync(lessonsFile(root), '# Lecciones\n');
}

// 48 lineas validas = 0.8 * 60: cruza el umbral de LESSONS.md exactamente
function seedLessonsAtThreshold(root) {
  const many = Array.from(
    { length: 48 },
    (_, i) => `- [test] (x1, T-${String(i + 1).padStart(3, '0')}) regla numero ${i}`,
  );
  writeFileSync(lessonsFile(root), many.join('\n') + '\n');
}

function curationTask(overrides = {}) {
  return {
    id: 'T-001',
    title: 'Curar memoria del harness',
    description: 'Curacion de memoria.',
    acceptance_criteria: [
      {
        id: 'AC-1',
        desc: 'lint-memory pasa sin errores',
        check: 'node .harness/scripts/harness.mjs lint-memory',
        kind: 'lint',
      },
    ],
    context: [],
    files: ['.harness/memory/LESSONS.md'],
    depends_on: [],
    priority: 1,
    type: 'curation',
    status: 'pending',
    attempts: 0,
    redispatches: 0,
    split_from: null,
    review_feedback: [],
    ...overrides,
  };
}

test('maybeEnqueueCuration devuelve null bajo el umbral del 80%', () => {
  const { root } = makeFixtureProject();
  seedCurationTemplate(root);
  seedMemoryBelowThreshold(root);
  assert.equal(maybeEnqueueCuration(root), null);
  assert.equal(readState(root).tasks.length, 0);
});

test('maybeEnqueueCuration encola la tarea de curacion al cruzar el 80%', () => {
  const { root } = makeFixtureProject();
  seedCurationTemplate(root);
  seedMemoryBelowThreshold(root);
  seedLessonsAtThreshold(root);
  const id = maybeEnqueueCuration(root);
  assert.equal(id, 'T-001');
  const task = readState(root).tasks.find((t) => t.id === 'T-001');
  assert.equal(task.type, 'curation');
  assert.equal(task.priority, 1);
  assert.equal(task.status, 'pending');
});

test('maybeEnqueueCuration NO duplica si hay una curacion no-terminal', () => {
  const { root } = makeFixtureProject({ tasks: [curationTask({ status: 'in_progress' })] });
  seedCurationTemplate(root);
  seedMemoryBelowThreshold(root);
  seedLessonsAtThreshold(root);
  assert.equal(maybeEnqueueCuration(root), null);
  assert.equal(readState(root).tasks.length, 1);
});

test('maybeEnqueueCuration SI encola si la curacion previa es terminal', () => {
  const { root } = makeFixtureProject({ tasks: [curationTask({ status: 'done' })] });
  seedCurationTemplate(root);
  seedMemoryBelowThreshold(root);
  seedLessonsAtThreshold(root);
  const id = maybeEnqueueCuration(root);
  assert.equal(id, 'T-002');
  assert.equal(readState(root).tasks.length, 2);
});
