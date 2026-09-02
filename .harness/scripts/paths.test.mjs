import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makeFixtureProject } from './test-helpers.mjs';
import { findRoot, paths, runPaths } from './lib/paths.mjs';

test('findRoot walks up from a nested directory to the tasks.json root', () => {
  const { root } = makeFixtureProject();
  const nested = join(root, 'src', 'components', 'deep');
  mkdirSync(nested, { recursive: true });
  assert.equal(findRoot(nested), root);
  assert.equal(findRoot(root), root);
});

test('findRoot throws when no tasks.json exists upwards', () => {
  const orphan = mkdtempSync(join(tmpdir(), 'no-harness-'));
  assert.throws(() => findRoot(orphan), /tasks\.json/);
});

test('paths returns every contract route as an absolute path', () => {
  const { root, harnessDir } = makeFixtureProject();
  const p = paths(root);
  assert.equal(p.tasksJson, join(root, 'tasks.json'));
  assert.equal(p.harnessDir, harnessDir);
  assert.equal(p.scriptsDir, join(harnessDir, 'scripts'));
  assert.equal(p.schemaFile, join(harnessDir, 'schema', 'tasks.schema.json'));
  assert.equal(p.templatesDir, join(harnessDir, 'templates'));
  assert.equal(p.memoryDir, join(harnessDir, 'memory'));
  assert.equal(p.handoffsDir, join(harnessDir, 'handoffs'));
  assert.equal(p.runsDir, join(harnessDir, 'runs'));
  assert.equal(p.currentRunFile, join(harnessDir, 'runs', 'current'));
  assert.equal(p.lockFile, join(harnessDir, 'run.lock'));
  assert.equal(p.curationFlag, join(harnessDir, 'curation-active'));
  assert.equal(p.lintCache, join(harnessDir, 'lint-cache.json'));
  assert.equal(p.planDir, join(harnessDir, 'plan'));
  assert.equal(p.profileFile, join(harnessDir, 'PROFILE.md'));
});

test('runPaths returns the run layout for a given runId', () => {
  const { root } = makeFixtureProject();
  const rp = runPaths(root, '2026-07-20-a');
  const runDir = join(root, '.harness', 'runs', '2026-07-20-a');
  assert.equal(rp.runDir, runDir);
  assert.equal(rp.journal, join(runDir, 'journal.md'));
  assert.equal(rp.summary, join(runDir, 'SUMMARY.md'));
  assert.equal(rp.reportsDir, join(runDir, 'reports'));
  assert.equal(rp.verdictsDir, join(runDir, 'verdicts'));
  assert.equal(rp.splitsDir, join(runDir, 'splits'));
  assert.equal(rp.logsDir, join(runDir, 'logs'));
  assert.equal(rp.backupFile, join(runDir, 'tasks.backup.json'));
});
