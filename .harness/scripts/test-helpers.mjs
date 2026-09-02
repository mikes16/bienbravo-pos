// Shared test fixtures for the harness test suite.
// Contract: makeFixtureProject({tasks, runId}) -> {root, tasksJson, harnessDir, runDir}
// The caller does NOT clean up (os.tmpdir recycles itself).
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_SCHEMA = join(SCRIPTS_DIR, '..', 'schema', 'tasks.schema.json');

const PROFILE_FIXTURE = `# Perfil: react
## Comandos
install: npm ci
test: npm test
build: npm run build
lint: npm run lint
typecheck: npm run typecheck
## Límites
files_max: 5
diff_max: 800
timeout_check: 120s
diff_excludes: package-lock.json, *.lock
## Convenciones
- test fixture profile
## Trampas conocidas
- none
`;

export function makeFixtureProject({ tasks = [], runId = '2026-07-20-a' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'harness-fixture-'));
  const harnessDir = join(root, '.harness');
  const runDir = join(harnessDir, 'runs', runId);
  for (const dir of [
    join(harnessDir, 'schema'),
    join(harnessDir, 'templates'),
    join(harnessDir, 'memory'),
    join(harnessDir, 'handoffs'),
    join(harnessDir, 'plan'),
    join(runDir, 'reports'),
    join(runDir, 'verdicts'),
    join(runDir, 'splits'),
    join(runDir, 'logs'),
  ]) mkdirSync(dir, { recursive: true });

  const tasksJson = join(root, 'tasks.json');
  writeFileSync(tasksJson, JSON.stringify({ version: 1, tasks }, null, 2) + '\n');

  // Empty-but-valid memory files (headers only; real templates arrive with the
  // template/.harness/templates content).
  writeFileSync(join(harnessDir, 'memory', 'PROJECT.md'), '# PROJECT\n\n## Convenciones fijas\n');
  writeFileSync(join(harnessDir, 'memory', 'DECISIONS.md'), '# DECISIONS\n');
  writeFileSync(join(harnessDir, 'memory', 'LESSONS.md'), '# LESSONS\n');
  writeFileSync(join(harnessDir, 'PROFILE.md'), PROFILE_FIXTURE);
  writeFileSync(join(runDir, 'journal.md'), '');
  writeFileSync(join(harnessDir, 'runs', 'current'), runId + '\n');

  // Copy the real schema into the fixture when it already exists in the template
  // (it is created by the schema task; earlier tests do not need it).
  if (existsSync(TEMPLATE_SCHEMA)) {
    copyFileSync(TEMPLATE_SCHEMA, join(harnessDir, 'schema', 'tasks.schema.json'));
  }

  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'harness@test.local');
  git(root, 'config', 'user.name', 'Harness Test');
  git(root, 'config', 'commit.gpgsign', 'false');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'chore: initial fixture commit');

  return { root, tasksJson, harnessDir, runDir };
}

export function readState(root) {
  return JSON.parse(readFileSync(join(root, 'tasks.json'), 'utf8'));
}

export function git(root, ...args) {
  const res = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout };
}
