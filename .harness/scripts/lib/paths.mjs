import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

// Walks up from cwd until it finds tasks.json; throws if it reaches the filesystem root.
export function findRoot(cwd) {
  let dir = resolve(cwd);
  for (;;) {
    if (existsSync(join(dir, 'tasks.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`tasks.json not found walking up from ${cwd}`);
    dir = parent;
  }
}

export function paths(root) {
  const harnessDir = join(root, '.harness');
  return {
    tasksJson: join(root, 'tasks.json'),
    harnessDir,
    scriptsDir: join(harnessDir, 'scripts'),
    schemaFile: join(harnessDir, 'schema', 'tasks.schema.json'),
    templatesDir: join(harnessDir, 'templates'),
    memoryDir: join(harnessDir, 'memory'),
    handoffsDir: join(harnessDir, 'handoffs'),
    runsDir: join(harnessDir, 'runs'),
    currentRunFile: join(harnessDir, 'runs', 'current'),
    lockFile: join(harnessDir, 'run.lock'),
    curationFlag: join(harnessDir, 'curation-active'),
    lintCache: join(harnessDir, 'lint-cache.json'),
    planDir: join(harnessDir, 'plan'),
    profileFile: join(harnessDir, 'PROFILE.md'),
  };
}

export function runPaths(root, runId) {
  const runDir = join(root, '.harness', 'runs', runId);
  return {
    runDir,
    journal: join(runDir, 'journal.md'),
    summary: join(runDir, 'SUMMARY.md'),
    reportsDir: join(runDir, 'reports'),
    verdictsDir: join(runDir, 'verdicts'),
    splitsDir: join(runDir, 'splits'),
    logsDir: join(runDir, 'logs'),
    backupFile: join(runDir, 'tasks.backup.json'),
  };
}
