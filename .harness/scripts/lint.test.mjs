import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeFixtureProject } from './test-helpers.mjs';
import { lintTasks } from './lib/lint.mjs';

function makeTask(overrides = {}) {
  return {
    id: 'T-001',
    title: 'Tarea de prueba',
    description: 'Descripción de prueba.',
    acceptance_criteria: [
      { id: 'AC-1', desc: 'los tests pasan', check: 'npm test -- tests/x.test.ts', kind: 'test' },
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

const PROFILE = {
  commands: {
    install: 'npm ci',
    test: 'npm test -- <filtro>',
    build: 'npm run build',
    lint: 'npm run lint',
    typecheck: 'npm run typecheck',
  },
  limits: {
    files_max: 5,
    diff_max: 800,
    timeout_check_s: 120,
    diff_excludes: ['package-lock.json'],
  },
};

function lint(tasks, opts) {
  return lintTasks({ version: 1, tasks }, PROFILE, opts);
}

test('lintTasks acepta un estado válido sin errores ni warnings', () => {
  const { errors, warnings } = lint([makeTask()]);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('lintTasks rechaza ids que no cumplen el patrón T-NNN', () => {
  const { errors } = lint([makeTask({ id: 'TAREA-1' })]);
  assert.ok(errors.some((e) => e.rule === 'id-pattern' && e.taskId === 'TAREA-1'));
});

test('lintTasks rechaza ids duplicados', () => {
  const { errors } = lint([makeTask(), makeTask()]);
  assert.ok(errors.some((e) => e.rule === 'duplicate-id' && e.taskId === 'T-001'));
});

test('lintTasks rechaza depends_on hacia tareas inexistentes', () => {
  const { errors } = lint([makeTask({ depends_on: ['T-099'] })]);
  assert.ok(errors.some((e) => e.rule === 'dep-missing' && e.detail.includes('T-099')));
});

test('lintTasks detecta ciclos e imprime el ciclo en detail', () => {
  const a = makeTask({ id: 'T-001', depends_on: ['T-002'] });
  const b = makeTask({ id: 'T-002', depends_on: ['T-001'] });
  const { errors } = lint([a, b]);
  const cycleError = errors.find((e) => e.rule === 'cycle');
  assert.ok(cycleError);
  assert.match(cycleError.detail, /T-001 -> T-002 -> T-001|T-002 -> T-001 -> T-002/);
});

test('lintTasks aplica files_max del perfil', () => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f'].map((name) => `src/${name}.ts`);
  const { errors } = lint([makeTask({ files })]);
  assert.ok(errors.some((e) => e.rule === 'files-max' && e.detail.includes('5')));
});

test('lintTasks exige entre CRITERIA_MIN y CRITERIA_MAX criterios', () => {
  const none = lint([makeTask({ acceptance_criteria: [] })]);
  assert.ok(none.errors.some((e) => e.rule === 'criteria-count'));
  const six = [...Array(6)].map((_, i) => ({
    id: `AC-${i + 1}`, desc: 'x', check: 'npm test', kind: 'test',
  }));
  const over = lint([makeTask({ acceptance_criteria: six })]);
  assert.ok(over.errors.some((e) => e.rule === 'criteria-count'));
});

test('lintTasks aplica description <= DESCRIPTION_MAX', () => {
  const { errors } = lint([makeTask({ description: 'x'.repeat(1201) })]);
  assert.ok(errors.some((e) => e.rule === 'description-max'));
});

test('lintTasks aplica context <= CONTEXT_MAX entradas', () => {
  const context = [...Array(8)].map((_, i) => ({
    type: 'doc', path: `docs/d${i}.md`, reason: 'referencia',
  }));
  const { errors } = lint([makeTask({ context })]);
  assert.ok(errors.some((e) => e.rule === 'context-max'));
});

test('lintTasks aplica reason <= REASON_MAX chars', () => {
  const context = [{ type: 'spec', path: 'docs/spec.md', reason: 'r'.repeat(141) }];
  const { errors } = lint([makeTask({ context })]);
  assert.ok(errors.some((e) => e.rule === 'reason-max'));
});

test('lintTasks rechaza criterios sin kind válido o sin check', () => {
  const noKind = lint([
    makeTask({ acceptance_criteria: [{ id: 'AC-1', desc: 'x', check: 'npm test' }] }),
  ]);
  assert.ok(noKind.errors.some((e) => e.rule === 'criterion-fields'));
  const badKind = lint([
    makeTask({ acceptance_criteria: [{ id: 'AC-1', desc: 'x', check: 'npm test', kind: 'e2e' }] }),
  ]);
  assert.ok(badKind.errors.some((e) => e.rule === 'criterion-fields'));
  const noCheck = lint([
    makeTask({ acceptance_criteria: [{ id: 'AC-1', desc: 'x', check: '', kind: 'test' }] }),
  ]);
  assert.ok(noCheck.errors.some((e) => e.rule === 'criterion-check'));
});

test('lintTasks exime a kind manual del check pero emite warning', () => {
  const manual = {
    id: 'AC-1',
    desc: 'se ve bien en móvil',
    check: 'abrir en un teléfono y revisar el layout',
    kind: 'manual',
  };
  const { errors, warnings } = lint([makeTask({ acceptance_criteria: [manual] })]);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.rule === 'manual-check' && w.taskId === 'T-001'));
});

test('lintTasks valida que los paths de context existan en disco', () => {
  const { root } = makeFixtureProject();
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'spec.md'), '# Spec\n## auth\nEndpoints protegidos.\n');
  const ok = lint(
    [makeTask({ context: [{ type: 'spec', path: 'docs/spec.md', reason: 'define endpoints' }] })],
    { root }
  );
  assert.deepEqual(ok.errors, []);
  const missing = lint(
    [makeTask({ context: [{ type: 'spec', path: 'docs/nope.md', reason: 'no existe' }] })],
    { root }
  );
  assert.ok(missing.errors.some((e) => e.rule === 'context-path-missing'));
});

test('lintTasks valida el ancla #seccion contra los headings del archivo', () => {
  const { root } = makeFixtureProject();
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'spec.md'), '# Spec\n## auth\nEndpoints protegidos.\n');
  const ok = lint(
    [makeTask({ context: [{ type: 'spec', path: 'docs/spec.md#auth', reason: 'define endpoints' }] })],
    { root }
  );
  assert.deepEqual(ok.errors, []);
  const bad = lint(
    [makeTask({ context: [{ type: 'spec', path: 'docs/spec.md#pagos', reason: 'sección inexistente' }] })],
    { root }
  );
  assert.ok(bad.errors.some((e) => e.rule === 'context-anchor-missing'));
});

test('lintTasks omite la validación de disco cuando no recibe opts.root', () => {
  const { errors } = lint([
    makeTask({ context: [{ type: 'doc', path: 'docs/nope.md', reason: 'sin root no se valida' }] }),
  ]);
  assert.deepEqual(errors, []);
});

test('lintTasks valida la cadena secuencial de hijas de un split', () => {
  const parent = makeTask({ id: 'T-002', files: ['src/p.ts'], status: 'split' });
  const childA = makeTask({ id: 'T-002a', files: ['src/ca.ts'], split_from: 'T-002' });
  const childB = makeTask({
    id: 'T-002b', files: ['src/cb.ts'], split_from: 'T-002', depends_on: ['T-002a'],
  });
  const childC = makeTask({
    id: 'T-002c', files: ['src/cc.ts'], split_from: 'T-002', depends_on: ['T-002b'],
  });
  const ok = lint([parent, childA, childB, childC]);
  assert.deepEqual(ok.errors, []);

  const childCBroken = makeTask({
    id: 'T-002c', files: ['src/cc.ts'], split_from: 'T-002', depends_on: [],
  });
  const bad = lint([parent, childA, childB, childCBroken]);
  const chainError = bad.errors.find((e) => e.rule === 'split-chain');
  assert.ok(chainError);
  assert.equal(chainError.taskId, 'T-002c');
  assert.match(chainError.detail, /T-002b/);
});

test('lintTasks advierte files compartidos entre tareas sin relación de dependencia', () => {
  const a = makeTask({ id: 'T-001', files: ['src/api/leads.ts'] });
  const b = makeTask({ id: 'T-002', files: ['src/api/leads.ts'] });
  const { errors, warnings } = lint([a, b]);
  assert.deepEqual(errors, []);
  const warning = warnings.find((w) => w.rule === 'shared-files');
  assert.ok(warning);
  assert.match(warning.detail, /src\/api\/leads\.ts/);
  assert.match(warning.detail, /T-002/);
});

test('lintTasks NO advierte files compartidos cuando hay dependencia, incluso transitiva', () => {
  const a = makeTask({ id: 'T-001', files: ['src/api/leads.ts'] });
  const b = makeTask({ id: 'T-002', files: ['src/mid.ts'], depends_on: ['T-001'] });
  const c = makeTask({ id: 'T-003', files: ['src/api/leads.ts'], depends_on: ['T-002'] });
  const { warnings } = lint([a, b, c]);
  assert.equal(warnings.filter((w) => w.rule === 'shared-files').length, 0);
});

test('modo incremental valida solo changedIds y sus vecinas directas del grafo', () => {
  const far = makeTask({ id: 'T-001', files: ['src/far.ts'], description: 'x'.repeat(1300) });
  const dep = makeTask({ id: 'T-002', files: ['src/dep.ts'] });
  const changed = makeTask({
    id: 'T-003',
    depends_on: ['T-002'],
    files: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts', 'src/f.ts'],
  });
  const dependent = makeTask({
    id: 'T-004', files: ['src/g.ts'], depends_on: ['T-003'], acceptance_criteria: [],
  });
  const { errors } = lint([far, dep, changed, dependent], { changedIds: ['T-003'] });
  assert.ok(errors.some((e) => e.taskId === 'T-003' && e.rule === 'files-max'));
  assert.ok(errors.some((e) => e.taskId === 'T-004' && e.rule === 'criteria-count'));
  assert.equal(errors.filter((e) => e.taskId === 'T-001').length, 0);
});

test('modo incremental sigue corriendo las reglas globales (ciclos, ids)', () => {
  const a = makeTask({ id: 'T-001', files: ['src/a1.ts'], depends_on: ['T-002'] });
  const b = makeTask({ id: 'T-002', files: ['src/b1.ts'], depends_on: ['T-001'] });
  const c = makeTask({ id: 'T-003', files: ['src/c1.ts'] });
  const { errors } = lint([a, b, c], { changedIds: ['T-003'] });
  assert.ok(errors.some((e) => e.rule === 'cycle'));
});
