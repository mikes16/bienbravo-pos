import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeFixtureProject, readState, git } from './test-helpers.mjs';

test('makeFixtureProject builds a committed git project with the harness structure', () => {
  const { root, tasksJson, harnessDir, runDir } = makeFixtureProject();
  assert.ok(existsSync(tasksJson));
  assert.ok(existsSync(join(harnessDir, 'memory', 'PROJECT.md')));
  assert.ok(existsSync(join(harnessDir, 'memory', 'DECISIONS.md')));
  assert.ok(existsSync(join(harnessDir, 'memory', 'LESSONS.md')));
  assert.ok(existsSync(join(harnessDir, 'PROFILE.md')));
  assert.ok(existsSync(join(runDir, 'journal.md')));
  assert.ok(existsSync(join(runDir, 'reports')));
  assert.ok(existsSync(join(runDir, 'verdicts')));
  assert.ok(existsSync(join(runDir, 'splits')));
  assert.ok(existsSync(join(runDir, 'logs')));
  const status = git(root, 'status', '--porcelain');
  assert.equal(status.status, 0);
  assert.equal(status.stdout.trim(), '');   // todo quedó comiteado en el commit inicial
  const log = git(root, 'log', '--oneline');
  assert.equal(log.stdout.trim().split('\n').length, 1);
});

test('readState parses tasks.json and honors the tasks option', () => {
  const taskStub = { id: 'T-001', title: 'stub' };
  const { root } = makeFixtureProject({ tasks: [taskStub] });
  const state = readState(root);
  assert.equal(state.version, 1);
  assert.deepEqual(state.tasks, [taskStub]);
});

test('runs/current points to the fixture runId', () => {
  const { root } = makeFixtureProject({ runId: '2026-07-21-b' });
  const current = readFileSync(join(root, '.harness', 'runs', 'current'), 'utf8').trim();
  assert.equal(current, '2026-07-21-b');
});
