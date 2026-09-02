import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { makeFixtureProject, readState, git } from './test-helpers.mjs';
import {
  TransitionError, toReview, start, reject, fail, redispatch, unblock, approveTask, applySplit,
} from './lib/transitions.mjs';
import { handoffPath } from './lib/handoff.mjs';

// Schema-valid task with overridable fields (local test builder).
function makeTask(id, overrides = {}) {
  return {
    id,
    title: `Task ${id}`,
    description: `Test task ${id}.`,
    acceptance_criteria: [
      { id: 'AC-1', desc: 'unit tests pass', check: 'npm test', kind: 'test' },
    ],
    context: [],
    files: [`src/${id}.ts`],
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

test('TransitionError extends Error and exposes a code', () => {
  const err = new TransitionError('PRECONDITION', 'something failed');
  assert.ok(err instanceof Error);
  assert.equal(err.name, 'TransitionError');
  assert.equal(err.code, 'PRECONDITION');
  assert.equal(err.message, 'something failed');
});

test('toReview: in_progress -> in_review, persisted to disk', () => {
  const { root } = makeFixtureProject({
    tasks: [makeTask('T-001', { status: 'in_progress' })],
  });
  const { task } = toReview(root, 'T-001');
  assert.equal(task.status, 'in_review');
  assert.equal(readState(root).tasks[0].status, 'in_review');
});

test('toReview from pending throws ILLEGAL_TRANSITION', () => {
  const { root } = makeFixtureProject({ tasks: [makeTask('T-001')] });
  assert.throws(
    () => toReview(root, 'T-001'),
    (err) => err instanceof TransitionError && err.code === 'ILLEGAL_TRANSITION',
  );
});

test('start: pending -> in_progress, write-ahead persisted to disk', () => {
  const { root } = makeFixtureProject({ tasks: [makeTask('T-001')] });
  const { task, handoffOverlaps } = start(root, 'T-001');
  assert.equal(task.status, 'in_progress');
  assert.deepEqual(handoffOverlaps, []);
  assert.equal(readState(root).tasks[0].status, 'in_progress');
});

test('start from in_review throws ILLEGAL_TRANSITION', () => {
  const { root } = makeFixtureProject({
    tasks: [makeTask('T-001', { status: 'in_review' })],
  });
  assert.throws(
    () => start(root, 'T-001'),
    (err) => err instanceof TransitionError && err.code === 'ILLEGAL_TRANSITION',
  );
});

test('start with a dependency not done throws PRECONDITION naming the dep', () => {
  const { root } = makeFixtureProject({
    tasks: [
      makeTask('T-001', { status: 'in_progress' }),
      makeTask('T-002', { depends_on: ['T-001'] }),
    ],
  });
  assert.throws(
    () => start(root, 'T-002'),
    (err) => err instanceof TransitionError
      && err.code === 'PRECONDITION'
      && /T-001/.test(err.message),
  );
});

test('start with all dependencies done proceeds', () => {
  const { root } = makeFixtureProject({
    tasks: [
      makeTask('T-001', { status: 'done' }),
      makeTask('T-002', { depends_on: ['T-001'] }),
    ],
  });
  const { task } = start(root, 'T-002');
  assert.equal(task.status, 'in_progress');
});

test('start with dirty non-harness file throws PRECONDITION naming the file', () => {
  const { root } = makeFixtureProject({ tasks: [makeTask('T-001')] });
  writeFileSync(join(root, 'stray.js'), 'dirty\n');
  assert.throws(
    () => start(root, 'T-001'),
    (err) => err instanceof TransitionError
      && err.code === 'PRECONDITION'
      && /stray\.js/.test(err.message),
  );
});

test('start with only harness paths dirty proceeds', () => {
  const { root, harnessDir } = makeFixtureProject({ tasks: [makeTask('T-001')] });
  writeFileSync(join(harnessDir, 'scratch.txt'), 'intermediate state\n');
  const { task } = start(root, 'T-001');
  assert.equal(task.status, 'in_progress');
});

test('start reports files intersection with existing handoffs as handoffOverlaps', () => {
  const { root, harnessDir } = makeFixtureProject({
    tasks: [makeTask('T-002', { files: ['src/session.ts', 'src/leads.ts'] })],
  });
  const handoffsDir = join(harnessDir, 'handoffs');
  mkdirSync(handoffsDir, { recursive: true });
  writeFileSync(join(handoffsDir, 'T-001.md'), [
    '# Handoff T-001 — sessions',
    '## Interfaz expuesta',
    '- `getSession()` returns the active session',
    '## Archivos',
    '- Creado: `src/session.ts`',
    '- Creado: `src/other.ts`',
    '## Decisiones tomadas',
    '- none',
    '## Advertencias para dependientes',
    '- none',
  ].join('\n') + '\n');
  const { handoffOverlaps } = start(root, 'T-002');
  assert.deepEqual(handoffOverlaps, [{ taskId: 'T-001', files: ['src/session.ts'] }]);
});

// Writes a spec-§7.3-shaped verdict into runs/<runId>/verdicts/<id>.a<attempt>.json.
function writeVerdict(runDir, id, attempt, partial = {}) {
  writeFileSync(
    join(runDir, 'verdicts', `${id}.a${attempt}.json`),
    JSON.stringify({
      task: id,
      attempt,
      verdict: 'RECHAZADO',
      criteria: { pass: [], fail: [], no_evaluable: [] },
      reasons: [],
      checks_ejecutados: true,
      diff_truncado: false,
      leccion_sugerida: null,
      ...partial,
    }, null, 2),
  );
}

test('reject below cap: in_review -> in_progress, attempts+1, feedback stored', () => {
  const { root, runDir } = makeFixtureProject({
    tasks: [makeTask('T-001', { status: 'in_review' })],
  });
  writeVerdict(runDir, 'T-001', 1, {
    criteria: { pass: ['AC-1'], fail: ['AC-2'], no_evaluable: [] },
    reasons: [{ ac: 'AC-2', issue: 'missing null check', fix: 'guard in handler' }],
  });
  const { task, verdict, blocked } = reject(root, 'T-001');
  assert.equal(blocked, false);
  assert.equal(task.status, 'in_progress');
  assert.equal(task.attempts, 1);
  assert.equal(verdict.verdict, 'RECHAZADO');
  assert.equal(task.review_feedback.length, 1);
  assert.equal(task.review_feedback[0].attempt, 1);
  assert.deepEqual(task.review_feedback[0].criteria.fail, ['AC-2']);
  assert.equal(readState(root).tasks[0].status, 'in_progress');
});

test('reject without verdict file throws PRECONDITION', () => {
  const { root } = makeFixtureProject({
    tasks: [makeTask('T-001', { status: 'in_review' })],
  });
  assert.throws(
    () => reject(root, 'T-001'),
    (err) => err instanceof TransitionError && err.code === 'PRECONDITION',
  );
});

test('reject with malformed verdict JSON throws PRECONDITION', () => {
  const { root, runDir } = makeFixtureProject({
    tasks: [makeTask('T-001', { status: 'in_review' })],
  });
  writeFileSync(join(runDir, 'verdicts', 'T-001.a1.json'), '{not json');
  assert.throws(
    () => reject(root, 'T-001'),
    (err) => err instanceof TransitionError && err.code === 'PRECONDITION',
  );
});

test('reject from pending throws ILLEGAL_TRANSITION', () => {
  const { root } = makeFixtureProject({ tasks: [makeTask('T-001')] });
  assert.throws(
    () => reject(root, 'T-001'),
    (err) => err instanceof TransitionError && err.code === 'ILLEGAL_TRANSITION',
  );
});

test('reject twice keeps at most 2 feedback entries', () => {
  const { root, runDir } = makeFixtureProject({
    tasks: [makeTask('T-001', { status: 'in_review' })],
  });
  writeVerdict(runDir, 'T-001', 1, { criteria: { pass: [], fail: ['AC-1'], no_evaluable: [] } });
  reject(root, 'T-001');
  toReview(root, 'T-001');
  writeVerdict(runDir, 'T-001', 2, { criteria: { pass: [], fail: ['AC-2'], no_evaluable: [] } });
  const { task } = reject(root, 'T-001');
  assert.equal(task.attempts, 2);
  assert.equal(task.review_feedback.length, 2);
  assert.deepEqual(task.review_feedback.map((e) => e.attempt), [1, 2]);
});

test('reject at cap: blocked + revert + state commit + collapsed feedback', () => {
  const { root, runDir } = makeFixtureProject({
    tasks: [makeTask('T-001', {
      status: 'in_review',
      attempts: 2,
      review_feedback: [
        { attempt: 1, criteria: { pass: [], fail: ['AC-1', 'AC-2'], no_evaluable: [] }, reasons: [] },
        { attempt: 2, criteria: { pass: ['AC-1'], fail: ['AC-2'], no_evaluable: [] }, reasons: [] },
      ],
    })],
  });
  // A committed source file, then dirtied: simulates executor work to revert.
  writeFileSync(join(root, 'app.js'), 'original\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-m', 'chore: add app.js');
  writeFileSync(join(root, 'app.js'), 'broken attempt\n');
  writeVerdict(runDir, 'T-001', 3, { criteria: { pass: ['AC-1'], fail: ['AC-2'], no_evaluable: [] } });

  const { task, blocked } = reject(root, 'T-001');

  assert.equal(blocked, true);
  assert.equal(task.status, 'blocked');
  assert.equal(task.attempts, 3);
  // Feedback collapsed to ONE 1-line summary of the last 2 attempts (a2, a3):
  // the trim to 2 entries happened before collapsing, so a1 is gone.
  assert.equal(task.review_feedback.length, 1);
  assert.match(task.review_feedback[0].summary, /a2 falló AC-2; a3 falló AC-2/);
  assert.doesNotMatch(task.review_feedback[0].summary, /a1 /);
  // Executor code reverted; harness state preserved (safe revert, spec §6).
  assert.equal(readFileSync(join(root, 'app.js'), 'utf8'), 'original\n');
  assert.equal(readState(root).tasks[0].status, 'blocked');
  // The CLI made the state commit.
  assert.match(git(root, 'log', '--oneline', '-1').stdout, /T-001: blocked/);
});

test('fail below cap: attempts+1, stays in_progress', () => {
  const { root } = makeFixtureProject({
    tasks: [makeTask('T-001', { status: 'in_progress' })],
  });
  const { task, blocked } = fail(root, 'T-001');
  assert.equal(blocked, false);
  assert.equal(task.status, 'in_progress');
  assert.equal(task.attempts, 1);
  assert.equal(readState(root).tasks[0].attempts, 1);
});

test('fail from in_review throws ILLEGAL_TRANSITION', () => {
  const { root } = makeFixtureProject({
    tasks: [makeTask('T-001', { status: 'in_review' })],
  });
  assert.throws(
    () => fail(root, 'T-001'),
    (err) => err instanceof TransitionError && err.code === 'ILLEGAL_TRANSITION',
  );
});

test('fail at cap: blocked + revert + state commit', () => {
  const { root } = makeFixtureProject({
    tasks: [makeTask('T-001', { status: 'in_progress', attempts: 2 })],
  });
  writeFileSync(join(root, 'app.js'), 'original\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-m', 'chore: add app.js');
  writeFileSync(join(root, 'app.js'), 'half-done work\n');

  const { task, blocked } = fail(root, 'T-001');

  assert.equal(blocked, true);
  assert.equal(task.status, 'blocked');
  assert.equal(task.attempts, 3);
  assert.equal(task.review_feedback.length, 1);
  assert.match(task.review_feedback[0].summary, /blocked tras 3/);
  assert.equal(readFileSync(join(root, 'app.js'), 'utf8'), 'original\n');
  assert.match(git(root, 'log', '--oneline', '-1').stdout, /T-001: blocked/);
});

test('redispatch below cap: redispatches+1, status unchanged, attempts untouched', () => {
  const { root } = makeFixtureProject({
    tasks: [makeTask('T-001', { status: 'in_progress' })],
  });
  const { task, blocked } = redispatch(root, 'T-001');
  assert.equal(blocked, false);
  assert.equal(task.status, 'in_progress');
  assert.equal(task.redispatches, 1);
  assert.equal(task.attempts, 0); // redispatch does not burn attempts
  assert.equal(readState(root).tasks[0].redispatches, 1);
});

test('redispatch at cap: blocked + state commit', () => {
  const { root } = makeFixtureProject({
    tasks: [makeTask('T-001', { status: 'in_progress', redispatches: 1 })],
  });
  // Commit the harness state first: the safe revert runs `git clean -fd -e .harness`,
  // which would wipe an untracked tasks.json (only .harness/ is excluded from clean).
  git(root, 'add', '-A');
  git(root, 'commit', '-m', 'chore: estado del harness comiteado');
  const { task, blocked } = redispatch(root, 'T-001');
  assert.equal(blocked, true);
  assert.equal(task.status, 'blocked');
  assert.equal(task.redispatches, 2);
  assert.equal(task.review_feedback.length, 1);
  assert.match(task.review_feedback[0].summary, /0 attempts, 2 redispatches/);
  assert.match(git(root, 'log', '--oneline', '-1').stdout, /T-001: blocked/);
});

test('redispatch from pending throws ILLEGAL_TRANSITION', () => {
  const { root } = makeFixtureProject({ tasks: [makeTask('T-001')] });
  assert.throws(
    () => redispatch(root, 'T-001'),
    (err) => err instanceof TransitionError && err.code === 'ILLEGAL_TRANSITION',
  );
});

test('unblock: blocked -> pending, both counters reset, summary kept', () => {
  const { root } = makeFixtureProject({
    tasks: [makeTask('T-001', {
      status: 'blocked',
      attempts: 3,
      redispatches: 2,
      review_feedback: [{ summary: 'a2 falló AC-2; a3 falló AC-2' }],
    })],
  });
  const { task } = unblock(root, 'T-001');
  assert.equal(task.status, 'pending');
  assert.equal(task.attempts, 0);
  assert.equal(task.redispatches, 0);
  assert.equal(task.review_feedback.length, 1); // collapsed history survives
  assert.equal(readState(root).tasks[0].status, 'pending');
});

test('unblock from pending throws ILLEGAL_TRANSITION', () => {
  const { root } = makeFixtureProject({ tasks: [makeTask('T-001')] });
  assert.throws(
    () => unblock(root, 'T-001'),
    (err) => err instanceof TransitionError && err.code === 'ILLEGAL_TRANSITION',
  );
});

// --- Task 9: approveTask ---

function approveFixtureTask(overrides = {}) {
  return {
    id: 'T-001',
    title: 'Sample task',
    description: 'A sample task used by approve tests.',
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

const APPROVE_HANDOFF = [
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

function writeApproveHandoff(root, id, content) {
  const file = handoffPath(root, id);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

test('approveTask valida handoff, marca done y comitea "T-NNN: titulo"', () => {
  const { root } = makeFixtureProject({ tasks: [approveFixtureTask()] });
  writeApproveHandoff(root, 'T-001', APPROVE_HANDOFF);
  const { task, sha } = approveTask(root, 'T-001');
  assert.equal(task.status, 'done');
  assert.ok(sha);
  assert.equal(readState(root).tasks[0].status, 'done');
  const log = git(root, 'log', '-1', '--format=%s');
  assert.equal(log.stdout.trim(), 'T-001: Sample task');
});

test('approveTask se niega sin handoff valido y no cambia el estado', () => {
  const { root } = makeFixtureProject({ tasks: [approveFixtureTask()] });
  assert.throws(
    () => approveTask(root, 'T-001'),
    (err) => err instanceof TransitionError && err.code === 'PRECONDITION',
  );
  assert.equal(readState(root).tasks[0].status, 'in_review');
});

test('approveTask es ilegal fuera de in_review', () => {
  const { root } = makeFixtureProject({
    tasks: [approveFixtureTask({ status: 'pending', attempts: 0 })],
  });
  assert.throws(
    () => approveTask(root, 'T-001'),
    (err) => err instanceof TransitionError && err.code === 'ILLEGAL_TRANSITION',
  );
});

test('approveTask aprueba una curation sin handoff y limpia curation-active', () => {
  const { root } = makeFixtureProject({
    tasks: [approveFixtureTask({ id: 'T-031', type: 'curation', title: 'Curar memoria' })],
  });
  const flag = join(root, '.harness', 'curation-active');
  writeFileSync(flag, '');
  const { task } = approveTask(root, 'T-031');
  assert.equal(task.status, 'done');
  assert.equal(existsSync(flag), false); // spec §14: transicion terminal limpia el flag
  const log = git(root, 'log', '-1', '--format=%s');
  assert.equal(log.stdout.trim(), 'T-031: Curar memoria');
});

// --- Task 10: applySplit ---

function splitFixtureTask(overrides = {}) {
  return {
    id: 'T-002',
    title: 'Big task',
    description: 'A task too big for one executor.',
    acceptance_criteria: [
      { id: 'AC-1', desc: 'tests pass', check: 'npm test -- big', kind: 'test' }
    ],
    context: [],
    files: ['src/big.js'],
    depends_on: [],
    priority: 2,
    type: 'feature',
    status: 'in_progress',
    attempts: 1,
    redispatches: 0,
    split_from: null,
    review_feedback: [],
    ...overrides
  };
}

function splitChild(n) {
  return {
    title: `Split part ${n}`,
    description: `Part ${n} of the original task.`,
    acceptance_criteria: [
      { id: 'AC-1', desc: `part ${n} tests pass`, check: `npm test -- part${n}`, kind: 'test' }
    ],
    files: [`src/part${n}.js`],
    context: []
  };
}

// El fixture no garantiza runs/current ni baseline git: los tests los fijan.
// Baseline: sin tasks.json trackeado, `git clean -fd -e .harness` del revert lo borraria.
function splitSetup(fixture) {
  const { root, harnessDir } = fixture;
  writeFileSync(join(harnessDir, 'runs', 'current'), '2026-07-20-a');
  git(root, 'add', '-A');
  git(root, 'commit', '--allow-empty', '-m', 'chore: fixture baseline');
  return fixture;
}

function writeSplitProposal(runDir, id, proposal) {
  writeFileSync(join(runDir, 'splits', `${id}.json`), JSON.stringify(proposal, null, 2));
}

test('applySplit crea hijas encadenadas, hereda y recablea dependencias', () => {
  const dep = splitFixtureTask({
    id: 'T-001', title: 'Dep', status: 'done', attempts: 0, files: ['src/dep.js']
  });
  const parent = splitFixtureTask({ depends_on: ['T-001'], priority: 1, type: 'fix' });
  const dependent = splitFixtureTask({
    id: 'T-003', title: 'Dependent', status: 'pending', attempts: 0,
    depends_on: ['T-002'], files: ['src/dependent.js']
  });
  const { root, runDir } = splitSetup(
    makeFixtureProject({ tasks: [dep, parent, dependent] })
  );
  writeSplitProposal(runDir, 'T-002', {
    reason: 'too big',
    children: [splitChild(1), splitChild(2), splitChild(3)]
  });

  const { task, children, sha } = applySplit(root, 'T-002');

  assert.equal(task.status, 'split');
  assert.ok(sha);
  assert.deepEqual(children, ['T-002a', 'T-002b', 'T-002c']);
  const state = readState(root);
  const byId = new Map(state.tasks.map((t) => [t.id, t]));
  const a = byId.get('T-002a');
  const b = byId.get('T-002b');
  const c = byId.get('T-002c');
  assert.deepEqual(a.depends_on, ['T-001']);      // deps externas -> primera hija
  assert.deepEqual(b.depends_on, ['T-002a']);     // encadenado secuencial
  assert.deepEqual(c.depends_on, ['T-002b']);
  assert.deepEqual(byId.get('T-003').depends_on, ['T-002c']); // dependientes -> ultima hija
  for (const child of [a, b, c]) {
    assert.equal(child.status, 'pending');
    assert.equal(child.attempts, 0);
    assert.equal(child.redispatches, 0);
    assert.equal(child.split_from, 'T-002');
    assert.equal(child.priority, 1);              // heredada del padre
    assert.equal(child.type, 'fix');              // heredado del padre
  }
  assert.equal(byId.get('T-002').status, 'split');
  const log = git(root, 'log', '-1', '--format=%s');
  assert.equal(log.stdout.trim(), 'T-002: split');
});

test('applySplit es ilegal fuera de in_progress', () => {
  const { root, runDir } = splitSetup(
    makeFixtureProject({ tasks: [splitFixtureTask({ status: 'pending', attempts: 0 })] })
  );
  writeSplitProposal(runDir, 'T-002', {
    reason: 'x', children: [splitChild(1), splitChild(2)]
  });
  assert.throws(
    () => applySplit(root, 'T-002'),
    (err) => err instanceof TransitionError && err.code === 'ILLEGAL_TRANSITION'
  );
});

test('applySplit lanza PRECONDITION sin archivo de propuesta', () => {
  const { root } = splitSetup(makeFixtureProject({ tasks: [splitFixtureTask()] }));
  assert.throws(
    () => applySplit(root, 'T-002'),
    (err) => err instanceof TransitionError && err.code === 'PRECONDITION'
  );
});

test('applySplit bloquea con menos de 2 hijas', () => {
  const { root, runDir } = splitSetup(
    makeFixtureProject({ tasks: [splitFixtureTask()] })
  );
  writeSplitProposal(runDir, 'T-002', { reason: 'x', children: [splitChild(1)] });
  const result = applySplit(root, 'T-002');
  assert.equal(result.blocked, true);
  assert.match(result.reason, /2-4/);
  const state = readState(root);
  assert.equal(state.tasks.length, 1);            // no se crearon hijas
  assert.equal(state.tasks[0].status, 'blocked');
  const log = git(root, 'log', '-1', '--format=%s');
  assert.equal(log.stdout.trim(), 'T-002: blocked');
});

test('applySplit bloquea con mas de 4 hijas', () => {
  const { root, runDir } = splitSetup(
    makeFixtureProject({ tasks: [splitFixtureTask()] })
  );
  writeSplitProposal(runDir, 'T-002', {
    reason: 'x',
    children: [splitChild(1), splitChild(2), splitChild(3), splitChild(4), splitChild(5)]
  });
  const result = applySplit(root, 'T-002');
  assert.equal(result.blocked, true);
  assert.equal(readState(root).tasks.length, 1);
  assert.equal(readState(root).tasks[0].status, 'blocked');
});

test('applySplit bloquea el split de una hija de split (un solo nivel)', () => {
  const splitParent = splitFixtureTask({ id: 'T-002', status: 'split', attempts: 0 });
  const child = splitFixtureTask({
    id: 'T-002a', title: 'Child', split_from: 'T-002', files: ['src/child.js']
  });
  const { root, runDir } = splitSetup(
    makeFixtureProject({ tasks: [splitParent, child] })
  );
  writeSplitProposal(runDir, 'T-002a', {
    reason: 'x', children: [splitChild(1), splitChild(2)]
  });
  const result = applySplit(root, 'T-002a');
  assert.equal(result.blocked, true);
  assert.match(result.reason, /split/);
  const state = readState(root);
  assert.equal(state.tasks.find((t) => t.id === 'T-002a').status, 'blocked');
  assert.equal(state.tasks.length, 2);            // no nacieron nietas
});

test('applySplit bloquea cuando las hijas no pasan el lint', () => {
  const { root, runDir } = splitSetup(
    makeFixtureProject({ tasks: [splitFixtureTask()] })
  );
  const fat = splitChild(1);
  // 6 archivos > files_max: 5 del perfil react de prueba -> error de lint
  fat.files = ['src/f1.js', 'src/f2.js', 'src/f3.js', 'src/f4.js', 'src/f5.js', 'src/f6.js'];
  writeSplitProposal(runDir, 'T-002', { reason: 'x', children: [fat, splitChild(2)] });
  const result = applySplit(root, 'T-002');
  assert.equal(result.blocked, true);
  assert.match(result.reason, /lint/);
  const state = readState(root);
  assert.equal(state.tasks.length, 1);            // el estado con hijas NO se persistio
  assert.equal(state.tasks[0].status, 'blocked');
});
