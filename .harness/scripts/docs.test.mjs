import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...segs) => readFileSync(path.join(TEMPLATE_ROOT, ...segs), 'utf8');
const lineCount = (text) => text.replace(/\n$/, '').split('\n').length;

// CLAUDE.harness.md y .gitignore.harness son FUENTES de anexado: viven en el repo
// harness-base pero install.sh NO las copia al destino (las anexa a CLAUDE.md /
// .gitignore). Cuando este suite corre como smoke dentro de un destino instalado,
// esos archivos no existen: el test se salta en vez de fallar por un artefacto de
// autoría del repo que, por diseño, nunca viaja al destino.
const skipIfAbsent = (rel) =>
  existsSync(path.join(TEMPLATE_ROOT, rel))
    ? {}
    : { skip: `${rel} ausente (contexto de destino instalado, no del repo harness-base)` };

test('tasks.json inicial: cola vacía versión 1', () => {
  assert.deepEqual(JSON.parse(read('tasks.json')), { version: 1, tasks: [] });
});

test('.gitignore.harness cubre todo el runtime del harness', skipIfAbsent('.gitignore.harness'), () => {
  const lines = read('.gitignore.harness').split('\n');
  for (const entry of [
    '.harness/runs/',
    '.harness/run.lock',
    '.harness/curation-active',
    '.harness/lint-cache.json',
    '.harness/plan/',
  ]) {
    assert.ok(lines.includes(entry), `falta ${entry}`);
  }
});

test('HANDOFF.md: primera sección ## es Interfaz expuesta y ≤60 líneas', () => {
  const text = read('.harness', 'templates', 'HANDOFF.md');
  const firstH2 = text.split('\n').find((l) => l.startsWith('## '));
  assert.equal(firstH2, '## Interfaz expuesta');
  for (const h of ['## Archivos', '## Decisiones tomadas', '## Advertencias para dependientes']) {
    assert.ok(text.includes(h), `falta ${h}`);
  }
  assert.ok(lineCount(text) <= 60, 'HANDOFF.md supera 60 líneas');
});

test('plantillas de memoria: vacías-pero-válidas y dentro de topes', () => {
  const project = read('.harness', 'templates', 'PROJECT.md');
  assert.ok(project.startsWith('# PROJECT'));
  for (const h of ['## Qué es', '## Stack', '## Estructura', '## Convenciones fijas']) {
    assert.ok(project.includes(h), `falta ${h}`);
  }
  assert.ok(lineCount(project) <= 60, 'PROJECT.md supera 60 líneas');

  const decisions = read('.harness', 'templates', 'DECISIONS.md');
  assert.ok(decisions.startsWith('# DECISIONS'));
  assert.ok(lineCount(decisions) <= 80, 'DECISIONS.md supera 80 líneas');
  assert.ok(!decisions.split('\n').some((l) => l.startsWith('- [')), 'DECISIONS.md trae entradas iniciales');

  const lessons = read('.harness', 'templates', 'LESSONS.md');
  assert.ok(lessons.startsWith('# LESSONS'));
  assert.ok(lineCount(lessons) <= 60, 'LESSONS.md supera 60 líneas');
  assert.ok(!lessons.split('\n').some((l) => l.startsWith('- [')), 'LESSONS.md trae entradas iniciales');
});

test('CURATION-TASK.json es un borrador válido para importTasks', () => {
  const draft = JSON.parse(read('.harness', 'templates', 'CURATION-TASK.json'));
  assert.ok(Array.isArray(draft.tasks) && draft.tasks.length === 1);
  const t = draft.tasks[0];
  assert.equal(t.type, 'curation');
  assert.equal(t.priority, 1);
  assert.deepEqual(t.depends_on, []);
  assert.ok(t.title.length > 0);
  assert.ok(t.description.length > 0 && t.description.length <= 1200);
  assert.ok(t.acceptance_criteria.length >= 1 && t.acceptance_criteria.length <= 5);
  for (const ac of t.acceptance_criteria) {
    assert.match(ac.id, /^AC-\d+$/);
    assert.ok(ac.desc.length > 0);
    assert.ok(['test', 'build', 'lint', 'manual'].includes(ac.kind));
    assert.ok(ac.check.length > 0);
  }
  assert.ok(t.acceptance_criteria.some((ac) => ac.check.includes('lint-memory')));
  assert.deepEqual(t.files, [
    '.harness/memory/PROJECT.md',
    '.harness/memory/DECISIONS.md',
    '.harness/memory/LESSONS.md',
  ]);
  assert.ok(t.context.length <= 7);
  for (const c of t.context) {
    assert.ok(['spec', 'decision', 'code_pattern', 'interface', 'doc'].includes(c.type));
    assert.ok(c.reason.length > 0 && c.reason.length <= 140);
  }
  for (const k of ['id', 'status', 'attempts', 'redispatches', 'split_from', 'review_feedback']) {
    assert.ok(!(k in t), `el campo ${k} no va en un borrador`);
  }
});

test('CLAUDE.harness.md: reglas que sobreviven compactación', skipIfAbsent('CLAUDE.harness.md'), () => {
  const text = read('CLAUDE.harness.md');
  for (const marker of [
    'El disco manda',
    'protocolo de re-entrada',
    'harness.mjs',
    '`&&`',
    'tasks.json',
    '.harness/memory/',
  ]) {
    assert.ok(text.includes(marker), `falta ${marker}`);
  }
});

test('executor.md: protocolo completo del ejecutor', () => {
  const text = read('.claude', 'agents', 'executor.md');
  assert.ok(text.startsWith('---\n'), 'falta frontmatter');
  assert.ok(text.includes('name: executor'));
  for (const marker of [
    '--for=executor',
    'PENDING_FIXES',
    'NEEDS_SPLIT',
    'git add -A',
    'RESULT: DONE',
    '## Interfaz expuesta',
    'timeout',
    'exit 0',
    '## Prohibiciones',
  ]) {
    assert.ok(text.includes(marker), `falta ${marker}`);
  }
});

test('reviewer.md: protocolo completo del revisor', () => {
  const text = read('.claude', 'agents', 'reviewer.md');
  assert.ok(text.startsWith('---\n'), 'falta frontmatter');
  assert.ok(text.includes('name: reviewer'));
  for (const marker of [
    '--for=reviewer',
    ":(exclude)tasks.json",
    ":(exclude).harness",
    'diff_max',
    'no_evaluable',
    'diff_truncado',
    'checks_ejecutados',
    'leccion_sugerida',
    'RECHAZADO',
    'verdicts/',
    'DECISIONS',
    '## Prohibiciones',
  ]) {
    assert.ok(text.includes(marker), `falta ${marker}`);
  }
});

test('jerarquía de agentes: Jr, Sr, peer reviewer y Principal', () => {
  const jr = read('.claude', 'agents', 'executor-jr.md');
  assert.ok(jr.startsWith('---\n'), 'falta frontmatter en executor-jr.md');
  assert.ok(jr.includes('name: executor-jr'));
  assert.ok(jr.includes('model: sonnet'), 'el Jr no corre en sonnet');
  assert.ok(jr.includes('executor.md'), 'el Jr no apunta al protocolo del Sr');
  assert.ok(jr.includes('FAILED'), 'el Jr no sabe escalar lo no-mecánico');

  const principal = read('.claude', 'agents', 'principal-reviewer.md');
  assert.ok(principal.startsWith('---\n'), 'falta frontmatter en principal-reviewer.md');
  assert.ok(principal.includes('name: principal-reviewer'));
  assert.ok(principal.includes('model: claude-fable-5'), 'el Principal no corre en fable');
  assert.ok(principal.includes('PRINCIPAL-REVIEW.md'), 'falta la ruta del reporte final');
  assert.ok(principal.includes('REQUIERE_FIXES'), 'falta el veredicto que reabre la cola');
  const principalTools = principal.split('\n').find((l) => l.startsWith('tools:'));
  assert.ok(principalTools, 'falta la línea tools: en principal-reviewer.md');
  assert.ok(/\bWrite\b/.test(principalTools), 'el Principal no puede escribir su reporte');
  assert.ok(!/\bEdit\b/.test(principalTools), 'el Principal no es read-only sobre el código');

  const run = read('.claude', 'commands', 'harness-run.md');
  assert.ok(run.includes('executor-jr'), 'el orquestador no rutea al Jr');
  assert.ok(run.includes('principal-reviewer'), 'el orquestador no despacha el review final');

  // CLAUDE.harness.md es fuente de anexado: en un destino instalado no existe
  // (mismo motivo que skipIfAbsent), así que solo se asserta si está presente.
  if (existsSync(path.join(TEMPLATE_ROOT, 'CLAUDE.harness.md'))) {
    assert.ok(read('CLAUDE.harness.md').includes('Jerarquía'), 'CLAUDE.harness.md no documenta la jerarquía');
  }
});

test('harness-run.md: protocolo completo del orquestador', () => {
  const text = read('.claude', 'commands', 'harness-run.md');
  for (const marker of [
    'El disco manda',
    '## Re-entrada',
    'run-start',
    'report --show',
    'to-review',
    'apply-split',
    'redispatch',
    'Redactor de handoff',
    '## Higiene de contexto',
    '## Fin de corrida',
    'run-end',
    'congeladas por',
  ]) {
    assert.ok(text.includes(marker), `falta ${marker}`);
  }
});

test('harness-plan.md: onboarding, loop de lint e import, capa 2', () => {
  const text = read('.claude', 'commands', 'harness-plan.md');
  for (const marker of [
    'memory-init',
    'PROJECT.draft.md',
    '.harness/plan/draft.json',
    'import --file',
    '## 3. Capa 2',
    'verificable',
  ]) {
    assert.ok(text.includes(marker), `falta ${marker}`);
  }
});
