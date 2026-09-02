import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFixtureProject } from './test-helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(__dirname, '..', '..');
const PROTECT_HOOK = path.join(TEMPLATE_DIR, '.claude', 'hooks', 'protect-paths.sh');
const REENTRY_HOOK = path.join(TEMPLATE_DIR, '.claude', 'hooks', 'reentry-reminder.sh');
const SETTINGS_FILE = path.join(TEMPLATE_DIR, '.claude', 'settings.json');

// Helper local de ESTE archivo (no se exporta): invoca un hook igual que Claude
// Code — payload JSON por stdin, raiz del proyecto destino como cwd.
function runHook(hookPath, root, payload) {
  return spawnSync('bash', [hookPath], {
    cwd: root,
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
  });
}

// Fixture local: tarea completa y valida segun el esquema del spec seccion 4.
function fullTask(id, status) {
  return {
    id,
    title: 'Tarea ' + id,
    description: 'Tarea de prueba para los tests de hooks.',
    acceptance_criteria: [
      { id: 'AC-1', desc: 'build pasa', check: 'npm run build', kind: 'build' },
    ],
    context: [],
    files: ['src/example.ts'],
    depends_on: [],
    priority: 2,
    type: 'feature',
    status,
    attempts: 0,
    redispatches: 0,
    split_from: null,
    review_feedback: [],
  };
}

describe('protect-paths.sh sin flag de curacion', () => {
  const { root } = makeFixtureProject();

  test('deniega Write a tasks.json con exit 2', () => {
    const r = runHook(PROTECT_HOOK, root, {
      tool_name: 'Write',
      tool_input: { file_path: path.join(root, 'tasks.json'), content: '{}' },
    });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /protect-paths/);
    assert.match(r.stderr, /tasks\.json/);
  });

  test('deniega Edit a .harness/memory/DECISIONS.md con exit 2', () => {
    const r = runHook(PROTECT_HOOK, root, {
      tool_name: 'Edit',
      tool_input: {
        file_path: path.join(root, '.harness', 'memory', 'DECISIONS.md'),
        old_string: 'a',
        new_string: 'b',
      },
    });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /\.harness\/memory/);
  });

  test('deniega NotebookEdit a .harness/memory con exit 2', () => {
    const r = runHook(PROTECT_HOOK, root, {
      tool_name: 'NotebookEdit',
      tool_input: {
        notebook_path: path.join(root, '.harness', 'memory', 'PROJECT.md'),
        new_source: 'x',
      },
    });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /\.harness\/memory/);
  });

  test('permite Write a src/ con exit 0', () => {
    const r = runHook(PROTECT_HOOK, root, {
      tool_name: 'Write',
      tool_input: { file_path: path.join(root, 'src', 'api', 'leads.ts'), content: 'export {};' },
    });
    assert.equal(r.status, 0);
    assert.equal(r.stderr, '');
  });

  test('deniega Bash con redireccion a tasks.json con exit 2', () => {
    const r = runHook(PROTECT_HOOK, root, {
      tool_name: 'Bash',
      tool_input: { command: 'echo "{}" > tasks.json' },
    });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /tasks\.json/);
  });

  test('deniega Bash con sed -i sobre .harness/memory con exit 2', () => {
    const r = runHook(PROTECT_HOOK, root, {
      tool_name: 'Bash',
      tool_input: { command: "sed -i '' 's/foo/bar/' .harness/memory/LESSONS.md" },
    });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /\.harness\/memory/);
  });

  test('deniega Bash con tee hacia .harness/memory con exit 2', () => {
    const r = runHook(PROTECT_HOOK, root, {
      tool_name: 'Bash',
      tool_input: { command: 'cat notas.md | tee .harness/memory/PROJECT.md' },
    });
    assert.equal(r.status, 2);
  });

  test('deniega Bash con cp y con mv que tocan tasks.json con exit 2', () => {
    const cp = runHook(PROTECT_HOOK, root, {
      tool_name: 'Bash',
      tool_input: { command: 'cp backup.json tasks.json' },
    });
    assert.equal(cp.status, 2);
    const mv = runHook(PROTECT_HOOK, root, {
      tool_name: 'Bash',
      tool_input: { command: 'mv tasks.json tasks.old.json' },
    });
    assert.equal(mv.status, 2);
  });

  test('permite Bash de solo lectura sobre ruta protegida con exit 0', () => {
    const r = runHook(PROTECT_HOOK, root, {
      tool_name: 'Bash',
      tool_input: { command: 'cat tasks.json' },
    });
    assert.equal(r.status, 0);
  });

  test('permite Bash sin rutas protegidas con exit 0', () => {
    const r = runHook(PROTECT_HOOK, root, {
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
    });
    assert.equal(r.status, 0);
  });

  test('stdin no parseable no bloquea: exit 0', () => {
    const r = runHook(PROTECT_HOOK, root, 'esto no es json');
    assert.equal(r.status, 0);
  });
});

describe('protect-paths.sh con flag de curacion activo', () => {
  const { root, harnessDir } = makeFixtureProject();
  fs.writeFileSync(path.join(harnessDir, 'curation-active'), '');

  test('permite Edit a .harness/memory con exit 0', () => {
    const r = runHook(PROTECT_HOOK, root, {
      tool_name: 'Edit',
      tool_input: {
        file_path: path.join(root, '.harness', 'memory', 'LESSONS.md'),
        old_string: 'a',
        new_string: 'b',
      },
    });
    assert.equal(r.status, 0);
    assert.equal(r.stderr, '');
  });

  test('permite Bash sed -i sobre .harness/memory con exit 0', () => {
    const r = runHook(PROTECT_HOOK, root, {
      tool_name: 'Bash',
      tool_input: { command: "sed -i '' 's/x/y/' .harness/memory/PROJECT.md" },
    });
    assert.equal(r.status, 0);
  });

  test('sigue denegando Write a tasks.json con exit 2', () => {
    const r = runHook(PROTECT_HOOK, root, {
      tool_name: 'Write',
      tool_input: { file_path: path.join(root, 'tasks.json'), content: '{}' },
    });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /tasks\.json/);
  });

  test('sigue denegando Bash con redireccion a tasks.json con exit 2', () => {
    const r = runHook(PROTECT_HOOK, root, {
      tool_name: 'Bash',
      tool_input: { command: 'node -e "x" > tasks.json' },
    });
    assert.equal(r.status, 2);
  });
});

describe('reentry-reminder.sh', () => {
  test('imprime el recordatorio si hay tarea in_progress', () => {
    const { root } = makeFixtureProject({
      tasks: [fullTask('T-001', 'done'), fullTask('T-002', 'in_progress')],
    });
    const r = spawnSync('bash', [REENTRY_HOOK], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /re-entrada/);
    assert.match(r.stdout, /T-002:in_progress/);
    assert.match(r.stdout, /harness\.mjs status/);
  });

  test('imprime el recordatorio si hay tarea in_review', () => {
    const { root } = makeFixtureProject({ tasks: [fullTask('T-003', 'in_review')] });
    const r = spawnSync('bash', [REENTRY_HOOK], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /T-003:in_review/);
  });

  test('silencio (stdout vacio, exit 0) si no hay tareas a medias', () => {
    const { root } = makeFixtureProject({
      tasks: [fullTask('T-001', 'done'), fullTask('T-002', 'pending')],
    });
    const r = spawnSync('bash', [REENTRY_HOOK], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  });

  test('silencio y exit 0 si no existe tasks.json', () => {
    const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-hook-'));
    const r = spawnSync('bash', [REENTRY_HOOK], { cwd: bareDir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  });
});

describe('settings.json del template', () => {
  const loadSettings = () => JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));

  test('permissions.allow es la lista exacta del spec seccion 14', () => {
    assert.deepEqual(loadSettings().permissions.allow, [
      'Task', 'Edit', 'Write', 'Read', 'Grep', 'Glob',
      'Bash(node .harness/scripts/harness.mjs:*)',
      'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git add:*)',
      'Bash(git commit:*)', 'Bash(git checkout:*)', 'Bash(git clean:*)',
      'Bash(npm test:*)', 'Bash(npm run:*)', 'Bash(npm ci:*)',
    ]);
  });

  test('env fija BASH_MAX_TIMEOUT_MS en 600000', () => {
    assert.equal(loadSettings().env.BASH_MAX_TIMEOUT_MS, '600000');
  });

  test('PreToolUse cablea protect-paths.sh con el matcher completo', () => {
    const pre = loadSettings().hooks.PreToolUse;
    assert.equal(pre.length, 1);
    assert.equal(pre[0].matcher, 'Write|Edit|MultiEdit|NotebookEdit|Bash');
    assert.deepEqual(pre[0].hooks, [
      { type: 'command', command: '.claude/hooks/protect-paths.sh' },
    ]);
  });

  test('SessionStart cablea reentry-reminder.sh con matcher compact|resume', () => {
    const ss = loadSettings().hooks.SessionStart;
    assert.equal(ss.length, 1);
    assert.equal(ss[0].matcher, 'compact|resume');
    assert.deepEqual(ss[0].hooks, [
      { type: 'command', command: '.claude/hooks/reentry-reminder.sh' },
    ]);
  });
});
