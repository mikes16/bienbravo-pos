import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { makeFixtureProject, git } from './test-helpers.mjs';
import {
  isTreeCleanExceptHarness,
  dirtyNonHarnessFiles,
  revertKeepingHarness,
  commitAll,
  headSha,
  stageAll,
  taskCommitSha,
} from './lib/gitops.mjs';

function seedSrcFile(root, rel, content) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function commitBaseline(root) {
  git(root, 'add', '-A');
  git(root, 'commit', '-m', 'chore: fixture baseline');
}

test('isTreeCleanExceptHarness: true on a fully clean tree', () => {
  const { root } = makeFixtureProject();
  seedSrcFile(root, 'src/app.js', 'export const a = 1;\n');
  commitBaseline(root);
  assert.equal(isTreeCleanExceptHarness(root), true);
  assert.deepEqual(dirtyNonHarnessFiles(root), []);
});

test('isTreeCleanExceptHarness: ignores dirty tasks.json and .harness/', () => {
  const { root, tasksJson } = makeFixtureProject();
  seedSrcFile(root, 'src/app.js', 'export const a = 1;\n');
  commitBaseline(root);
  // dirty tasks.json (write-ahead state) — any byte change vs the committed version
  writeFileSync(tasksJson, JSON.stringify({ version: 1, tasks: [] }, null, 4) + '\n');
  // dirty tracked file under .harness/
  writeFileSync(
    join(root, '.harness', 'memory', 'LESSONS.md'),
    '# Lecciones\n- [test] (x1, T-001) dirty entry\n'
  );
  // untracked new file under .harness/
  mkdirSync(join(root, '.harness', 'handoffs'), { recursive: true });
  writeFileSync(join(root, '.harness', 'handoffs', 'T-001.md'), '# Handoff T-001\n');
  assert.equal(isTreeCleanExceptHarness(root), true);
  assert.deepEqual(dirtyNonHarnessFiles(root), []);
});

test('isTreeCleanExceptHarness: false when src/ is dirty; dirtyNonHarnessFiles lists paths', () => {
  const { root } = makeFixtureProject();
  seedSrcFile(root, 'src/app.js', 'export const a = 1;\n');
  commitBaseline(root);
  writeFileSync(join(root, 'src', 'app.js'), 'export const a = 2;\n'); // tracked, modified
  seedSrcFile(root, 'src/new.js', 'export const b = 1;\n');            // untracked
  assert.equal(isTreeCleanExceptHarness(root), false);
  assert.deepEqual(dirtyNonHarnessFiles(root).sort(), ['src/app.js', 'src/new.js']);
});

test('revertKeepingHarness: reverts tracked, deletes untracked src/, never touches harness state', () => {
  const { root, tasksJson, runDir } = makeFixtureProject();
  seedSrcFile(root, 'src/app.js', 'export const a = 1;\n');
  commitBaseline(root);

  // Dirty everything at once:
  writeFileSync(join(root, 'src', 'app.js'), 'export const a = 999;\n'); // tracked, modified
  seedSrcFile(root, 'src/orphan.js', 'export const junk = true;\n');     // untracked in src/
  const writeAhead = JSON.stringify({ version: 1, tasks: [] }, null, 4) + '\n';
  writeFileSync(tasksJson, writeAhead);                                  // write-ahead state
  mkdirSync(join(root, '.harness', 'handoffs'), { recursive: true });
  writeFileSync(join(root, '.harness', 'handoffs', 'T-001.md'), '# Handoff T-001\n'); // untracked harness
  writeFileSync(join(runDir, 'logs', 'T-001.a1.md'), 'trace output\n');  // untracked run log

  revertKeepingHarness(root);

  // tracked src reverted to committed content:
  assert.equal(readFileSync(join(root, 'src', 'app.js'), 'utf8'), 'export const a = 1;\n');
  // untracked src deleted:
  assert.equal(existsSync(join(root, 'src', 'orphan.js')), false);
  // write-ahead preserved byte-for-byte:
  assert.equal(readFileSync(tasksJson, 'utf8'), writeAhead);
  // untracked files under .harness/ survive git clean:
  assert.equal(existsSync(join(root, '.harness', 'handoffs', 'T-001.md')), true);
  assert.equal(existsSync(join(runDir, 'logs', 'T-001.a1.md')), true);
  // and the tree is clean-except-harness afterwards:
  assert.equal(isTreeCleanExceptHarness(root), true);
});

test('commitAll: commits code + harness state together and returns the short sha', () => {
  const { root } = makeFixtureProject();
  seedSrcFile(root, 'src/app.js', 'export const a = 1;\n');
  const sha = commitAll(root, 'T-001: proteger endpoints');
  assert.match(sha, /^[0-9a-f]{7,12}$/);
  assert.equal(sha, headSha(root));
  const log = git(root, 'log', '-1', '--format=%s');
  assert.equal(log.stdout.trim(), 'T-001: proteger endpoints');
  // add -A swept EVERYTHING, harness state included: porcelain fully empty
  const st = git(root, 'status', '--porcelain');
  assert.equal(st.stdout.trim(), '');
});

test('headSha: matches git rev-parse --short HEAD', () => {
  const { root } = makeFixtureProject();
  const expected = git(root, 'rev-parse', '--short', 'HEAD').stdout.trim();
  assert.equal(headSha(root), expected);
});

test('stageAll: leaves new files staged so they show up in git diff --cached', () => {
  const { root } = makeFixtureProject();
  seedSrcFile(root, 'src/app.js', 'export const a = 1;\n');
  commitBaseline(root);
  seedSrcFile(root, 'src/feature.js', 'export const f = () => 42;\n');
  stageAll(root);
  const staged = git(root, 'diff', '--cached', '--name-only');
  assert.ok(
    staged.stdout.split('\n').includes('src/feature.js'),
    `expected src/feature.js staged, got: ${staged.stdout}`
  );
});

test('taskCommitSha: finds the task commit via --grep, anchored, null when absent', () => {
  const { root } = makeFixtureProject();
  seedSrcFile(root, 'src/a.js', '// a\n');
  const shaA = commitAll(root, 'T-001: primera tarea');
  seedSrcFile(root, 'src/b.js', '// b\n');
  const shaB = commitAll(root, 'T-002: segunda tarea');
  seedSrcFile(root, 'src/c.js', '// c\n');
  const shaC = commitAll(root, 'T-002a: hija del split');

  assert.equal(taskCommitSha(root, 'T-001'), shaA);
  // the trailing colon in the pattern keeps T-002 from matching the T-002a commit:
  assert.equal(taskCommitSha(root, 'T-002'), shaB);
  assert.equal(taskCommitSha(root, 'T-002a'), shaC);
  assert.equal(taskCommitSha(root, 'T-999'), null);
});
