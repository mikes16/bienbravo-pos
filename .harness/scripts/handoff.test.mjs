import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { makeFixtureProject } from './test-helpers.mjs';
import { handoffPath, validateHandoff, listHandoffFiles } from './lib/handoff.mjs';

test('listHandoffFiles: empty map when handoffs dir does not exist', () => {
  const { root } = makeFixtureProject();
  const map = listHandoffFiles(root);
  assert.equal(map.size, 0);
});

test('listHandoffFiles: parses the Archivos section of each handoff', () => {
  const { root, harnessDir } = makeFixtureProject();
  const handoffsDir = join(harnessDir, 'handoffs');
  mkdirSync(handoffsDir, { recursive: true });
  writeFileSync(join(handoffsDir, 'T-001.md'), [
    '# Handoff T-001 — sessions',
    '## Interfaz expuesta',
    '- `getSession()` returns the active session',
    '## Archivos',
    '- Creado: `src/session.ts`',
    '- Modificado: `src/index.ts`',
    '## Decisiones tomadas',
    '- none',
    '## Advertencias para dependientes',
    '- none',
  ].join('\n') + '\n');
  const map = listHandoffFiles(root);
  assert.equal(map.size, 1);
  assert.deepEqual(map.get('T-001'), ['src/session.ts', 'src/index.ts']);
});

// --- Task 9: handoffPath + validateHandoff ---

function handoffFixtureTask(overrides = {}) {
  return {
    id: 'T-001',
    title: 'Sample task',
    description: 'A sample task used by handoff tests.',
    acceptance_criteria: [
      { id: 'AC-1', desc: 'build passes', check: 'npm run build', kind: 'build' },
    ],
    context: [],
    files: ['src/a.js'],
    depends_on: [],
    priority: 2,
    type: 'feature',
    status: 'in_review',
    attempts: 1,
    redispatches: 0,
    split_from: null,
    review_feedback: [],
    ...overrides,
  };
}

const VALID_HANDOFF = [
  '# Handoff T-001 — Sample task',
  '## Interfaz expuesta',
  '- `getUser(id)` devuelve `{name}`',
  '## Archivos',
  '- Creado: `src/a.js`',
  '## Decisiones tomadas',
  '- ninguna',
  '## Advertencias para dependientes',
  '- ninguna',
  '',
].join('\n');

function writeHandoff(root, id, content) {
  const file = handoffPath(root, id);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

test('handoffPath apunta a .harness/handoffs/<id>.md', () => {
  const { root } = makeFixtureProject({ tasks: [handoffFixtureTask()] });
  assert.equal(
    handoffPath(root, 'T-001'),
    join(root, '.harness', 'handoffs', 'T-001.md'),
  );
});

test('validateHandoff acepta un handoff valido', () => {
  const { root } = makeFixtureProject({ tasks: [handoffFixtureTask()] });
  writeHandoff(root, 'T-001', VALID_HANDOFF);
  assert.deepEqual(validateHandoff(root, 'T-001'), { ok: true, reason: null });
});

test('validateHandoff rechaza handoff inexistente', () => {
  const { root } = makeFixtureProject({ tasks: [handoffFixtureTask()] });
  const result = validateHandoff(root, 'T-001');
  assert.equal(result.ok, false);
  assert.match(result.reason, /missing/);
});

test('validateHandoff rechaza handoff de mas de 60 lineas', () => {
  const { root } = makeFixtureProject({ tasks: [handoffFixtureTask()] });
  const long =
    '# Handoff T-001 — Sample task\n## Interfaz expuesta\n' + '- item\n'.repeat(70);
  writeHandoff(root, 'T-001', long);
  const result = validateHandoff(root, 'T-001');
  assert.equal(result.ok, false);
  assert.match(result.reason, /max 60/);
});

test('validateHandoff exige "Interfaz expuesta" como primer heading ##', () => {
  const { root } = makeFixtureProject({ tasks: [handoffFixtureTask()] });
  const wrong = [
    '# Handoff T-001 — Sample task',
    '## Archivos',
    '- Creado: `src/a.js`',
    '## Interfaz expuesta',
    '- `getUser(id)`',
    '',
  ].join('\n');
  writeHandoff(root, 'T-001', wrong);
  const result = validateHandoff(root, 'T-001');
  assert.equal(result.ok, false);
  assert.match(result.reason, /Interfaz expuesta/);
});

test('validateHandoff exime a las tareas de curacion (sin handoff)', () => {
  const { root } = makeFixtureProject({
    tasks: [handoffFixtureTask({ id: 'T-009', type: 'curation' })],
  });
  assert.deepEqual(validateHandoff(root, 'T-009'), { ok: true, reason: null });
});
