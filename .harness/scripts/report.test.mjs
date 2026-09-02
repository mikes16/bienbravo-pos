import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeFixtureProject } from './test-helpers.mjs';
import { paths, runPaths } from './lib/paths.mjs';
import { latestReportPath, showReport, buildDispatch } from './lib/report.mjs';
import { REPORT_CLIP_LINES } from './lib/constants.mjs';

const RUN_ID = '2026-07-20-a';

function setup(tasks = []) {
  const fx = makeFixtureProject({ tasks, runId: RUN_ID });
  fs.writeFileSync(paths(fx.root).currentRunFile, `${RUN_ID}\n`);
  return fx;
}

function writeReport(root, name, content) {
  fs.writeFileSync(path.join(runPaths(root, RUN_ID).reportsDir, name), content);
}

test('latestReportPath devuelve null sin reportes o sin run vigente', () => {
  const { root } = setup();
  assert.equal(latestReportPath(root, 'T-002'), null);
  fs.rmSync(paths(root).currentRunFile, { force: true });
  assert.equal(latestReportPath(root, 'T-002'), null);
});

test('latestReportPath elige el intento mayor con orden numerico', () => {
  const { root } = setup();
  writeReport(root, 'T-002.a1.md', 'RESULT: FAILED\n');
  writeReport(root, 'T-002.a2.md', 'RESULT: DONE\n');
  writeReport(root, 'T-002.a10.md', 'RESULT: DONE\n');
  writeReport(root, 'T-003.a9.md', 'RESULT: DONE\n');
  const result = latestReportPath(root, 'T-002');
  assert.ok(result.endsWith(`${path.sep}T-002.a10.md`), `resolvio ${result}`);
});

const DONE_OK = [
  '# Reporte T-002 a1',
  'RESULT: DONE',
  'CHECKS:',
  '- AC-1 npm test -- tests/leads.test.ts → 12 passed, exit 0',
  '- AC-2 npm run build → exit 0',
  'FILES_CHANGED:',
  '- src/api/leads.ts',
].join('\n');

test('showReport sin archivo es invalido con reason', () => {
  const { root } = setup();
  const r = showReport(root, 'T-002');
  assert.deepEqual(r, { clipped: '', result: null, valid: false, reason: 'sin archivo de reporte' });
});

test('showReport DONE con CHECKS exit 0 es valido', () => {
  const { root } = setup();
  writeReport(root, 'T-002.a1.md', DONE_OK);
  const r = showReport(root, 'T-002');
  assert.equal(r.result, 'DONE');
  assert.equal(r.valid, true);
  assert.equal(r.reason, null);
});

test('showReport DONE sin exit 0 en CHECKS es invalido', () => {
  const { root } = setup();
  writeReport(
    root,
    'T-002.a1.md',
    ['RESULT: DONE', 'CHECKS:', '- AC-1 npm test → 2 failed, exit 1'].join('\n'),
  );
  const r = showReport(root, 'T-002');
  assert.equal(r.result, 'DONE');
  assert.equal(r.valid, false);
  assert.match(r.reason, /CHECKS/);
});

test('showReport DONE sin seccion CHECKS es invalido aunque diga exit 0 en otra parte', () => {
  const { root } = setup();
  writeReport(root, 'T-002.a1.md', ['RESULT: DONE', 'SUMMARY:', '- todo bien, exit 0'].join('\n'));
  const r = showReport(root, 'T-002');
  assert.equal(r.valid, false);
});

test('showReport FAILED es valido sin exigir CHECKS', () => {
  const { root } = setup();
  writeReport(root, 'T-002.a1.md', 'RESULT: FAILED\nBLOCKERS:\n- no compila\n');
  const r = showReport(root, 'T-002');
  assert.equal(r.result, 'FAILED');
  assert.equal(r.valid, true);
});

test('showReport sin linea RESULT es invalido', () => {
  const { root } = setup();
  writeReport(root, 'T-002.a1.md', 'prosa larga sin formato\n');
  const r = showReport(root, 'T-002');
  assert.equal(r.result, null);
  assert.equal(r.valid, false);
  assert.match(r.reason, /RESULT/);
});

test('showReport clippea a REPORT_CLIP_LINES lineas', () => {
  const { root } = setup();
  const filler = Array.from({ length: 60 }, (_, i) => `linea de relleno ${i + 1}`);
  writeReport(
    root,
    'T-002.a1.md',
    ['RESULT: DONE', 'CHECKS:', '- AC-1 npm test → 3 passed, exit 0', ...filler].join('\n'),
  );
  const r = showReport(root, 'T-002');
  assert.equal(r.clipped.split('\n').length, REPORT_CLIP_LINES);
  assert.equal(r.valid, true);
});

function mkTask(id, overrides = {}) {
  return {
    id,
    title: `Tarea ${id}`,
    description: 'Descripcion de prueba.',
    acceptance_criteria: [
      { id: 'AC-1', desc: 'pasa el test', check: 'npm test -- x', kind: 'test' },
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

const PROFILE_TEXT = `# Perfil: react
## Comandos
install: npm ci
test: npm test -- <filtro>
build: npm run build
lint: npm run lint
typecheck: npm run typecheck
## Límites
files_max: 5
diff_max: 800
timeout_check: 120s
diff_excludes: package-lock.json, *.lock
## Convenciones
- componentes en src/components
## Trampas conocidas
- vitest necesita --run en CI
`;

function setupDispatch(taskOverrides = {}) {
  const dep = mkTask('T-001', { status: 'done' });
  const task = mkTask('T-002', { depends_on: ['T-001'], status: 'in_progress', ...taskOverrides });
  const fx = setup([dep, task]);
  const p = paths(fx.root);
  fs.writeFileSync(p.profileFile, PROFILE_TEXT);
  fs.mkdirSync(p.handoffsDir, { recursive: true });
  fs.writeFileSync(
    path.join(p.handoffsDir, 'T-001.md'),
    '# Handoff T-001 — Tarea T-001\n## Interfaz expuesta\n- foo()\n## Archivos\n- Creado: `src/a.ts`\n',
  );
  return fx;
}

test('buildDispatch executor: primer intento sin PENDING_FIXES', () => {
  const { root } = setupDispatch();
  const out = buildDispatch(root, 'T-002', { role: 'executor' });
  const lines = out.split('\n');
  assert.equal(lines[0], 'TAREA T-002 · intento 1 de 3 · Tarea T-002');
  assert.ok(out.includes('DESCRIPCION: Descripcion de prueba.'));
  assert.ok(out.includes('- AC-1 [test] pasa el test || check: npm test -- x'));
  assert.ok(out.includes('FILES (alcance estricto): src/a.ts'));
  assert.ok(out.includes('HANDOFFS DE DEPS: .harness/handoffs/T-001.md'));
  assert.ok(out.includes('REPORTE → .harness/runs/2026-07-20-a/reports/T-002.a1.md'));
  assert.ok(!out.includes('Rechazo previo'));
});

test('buildDispatch executor: reintento con PENDING_FIXES exacto (§7.4)', () => {
  const feedback = [
    {
      attempt: 1,
      criteria: { pass: ['AC-1', 'AC-2'], fail: ['AC-3'], no_evaluable: [] },
      reasons: [
        {
          ac: 'AC-3',
          issue: 'logout no invalida el refresh token',
          fix: 'revocar en session.ts:invalidate()',
        },
      ],
    },
  ];
  const { root } = setupDispatch({ attempts: 1, review_feedback: feedback });
  const out = buildDispatch(root, 'T-002', { role: 'executor' });
  assert.ok(out.includes('INTENTO 2 de 3. Rechazo previo — corrige exactamente esto:'));
  assert.ok(
    out.includes('- [AC-3] logout no invalida el refresh token → revocar en session.ts:invalidate()'),
  );
  assert.ok(out.includes('Criterios ya en verde (no los rompas): AC-1, AC-2.'));
  assert.ok(out.includes('Historial: a1 falló AC-3.'));
  assert.ok(out.includes('reports/T-002.a2.md'));
});

test('buildDispatch executor: reintento tras fail sin veredicto apunta al reporte previo', () => {
  const { root } = setupDispatch({ attempts: 1, review_feedback: [] });
  const out = buildDispatch(root, 'T-002', { role: 'executor' });
  assert.ok(out.includes('INTENTO 2 de 3. Fallo previo — lee tu reporte y corrige:'));
  assert.ok(out.includes('- .harness/runs/2026-07-20-a/reports/T-002.a1.md'));
});

test('buildDispatch reviewer: criterios, comandos y limites del perfil', () => {
  const { root } = setupDispatch({
    status: 'in_review',
    acceptance_criteria: [
      { id: 'AC-1', desc: 'pasa el test', check: 'npm test -- x', kind: 'test' },
      { id: 'AC-2', desc: 'lo verifica un humano', check: 'abrir la pagina y mirar', kind: 'manual' },
    ],
  });
  const out = buildDispatch(root, 'T-002', { role: 'reviewer' });
  assert.equal(out.split('\n')[0], 'REVISION T-002 · intento 1 · Tarea T-002');
  assert.ok(out.includes('COMANDOS: test: npm test -- <filtro> · build: npm run build'));
  assert.ok(
    out.includes('LIMITES: diff_max 800 · tolerancia de alcance 2 archivos extra solo test/fixture · timeout_check 120s'),
  );
  assert.ok(out.includes('DIFF_EXCLUDES: package-lock.json, *.lock'));
  assert.ok(out.includes('- AC-2 [manual] (manual → no_evaluable) lo verifica un humano'));
  assert.ok(out.includes('REPORTE DEL EJECUTOR (afirmaciones a verificar): .harness/runs/2026-07-20-a/reports/T-002.a1.md'));
  assert.ok(out.includes('VEREDICTO → .harness/runs/2026-07-20-a/verdicts/T-002.a1.json'));
});

test('buildDispatch respeta el tope de 30 lineas en el peor caso', () => {
  const criteria = Array.from({ length: 5 }, (_, i) => ({
    id: `AC-${i + 1}`,
    desc: `criterio ${i + 1}`,
    check: 'npm test -- x',
    kind: 'test',
  }));
  const context = Array.from({ length: 7 }, (_, i) => ({
    type: 'doc',
    path: `docs/d${i}.md`,
    reason: `razon ${i}`,
  }));
  const feedback = [
    {
      attempt: 2,
      criteria: { pass: [], fail: ['AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5'], no_evaluable: [] },
      reasons: Array.from({ length: 5 }, (_, i) => ({
        ac: `AC-${i + 1}`,
        issue: `problema ${i + 1}`,
        fix: `arreglo ${i + 1}`,
      })),
    },
  ];
  const { root } = setupDispatch({
    attempts: 2,
    acceptance_criteria: criteria,
    context,
    review_feedback: feedback,
  });
  for (const role of ['executor', 'reviewer']) {
    const out = buildDispatch(root, 'T-002', { role });
    assert.ok(out.split('\n').length <= 30, `${role}: bloque de ${out.split('\n').length} lineas`);
  }
});

test('buildDispatch con role desconocido lanza error', () => {
  const { root } = setupDispatch();
  assert.throws(() => buildDispatch(root, 'T-002', { role: 'planner' }), /role invalido/);
});
