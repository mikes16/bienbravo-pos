import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFixtureProject } from './test-helpers.mjs';
import { parseProfile, loadProfile } from './lib/profile.mjs';

const REACT_PROFILE = `# Perfil: react
## Comandos
install: npm ci        test: npm test -- <filtro>       build: npm run build
lint: npm run lint     typecheck: npm run typecheck
## Límites
files_max: 5           diff_max: 800        timeout_check: 120s
diff_excludes: package-lock.json, *.lock
## Convenciones
- Componentes de función con hooks; un componente por archivo.
## Trampas conocidas
- Testing Library: usar findBy* para lo asíncrono.
`;

test('parseProfile extrae comandos y límites del formato del spec', () => {
  const profile = parseProfile(REACT_PROFILE);
  assert.deepEqual(profile.commands, {
    install: 'npm ci',
    test: 'npm test -- <filtro>',
    build: 'npm run build',
    lint: 'npm run lint',
    typecheck: 'npm run typecheck',
  });
  assert.deepEqual(profile.limits, {
    files_max: 5,
    diff_max: 800,
    timeout_check_s: 120,
    diff_excludes: ['package-lock.json', '*.lock'],
  });
});

test('parseProfile lanza error si falta un comando requerido', () => {
  const noBuild = REACT_PROFILE.replace('build: npm run build', '');
  assert.throws(() => parseProfile(noBuild), /falta el comando "build"/);
});

test('parseProfile lanza error si falta la sección ## Límites', () => {
  const noLimits = REACT_PROFILE.replace('## Límites', '## Otros');
  assert.throws(() => parseProfile(noLimits), /falta la sección "## Límites"/);
});

test('parseProfile acepta perfil sin diff_excludes y devuelve lista vacía', () => {
  const noExcludes = REACT_PROFILE.replace(
    'diff_excludes: package-lock.json, *.lock\n',
    ''
  );
  assert.deepEqual(parseProfile(noExcludes).limits.diff_excludes, []);
});

test('parseProfile lanza error si un límite no es entero', () => {
  const bad = REACT_PROFILE.replace('files_max: 5', 'files_max: cinco');
  assert.throws(() => parseProfile(bad), /"files_max" debe ser un entero/);
});

test('loadProfile lee y parsea .harness/PROFILE.md del proyecto', () => {
  const { root, harnessDir } = makeFixtureProject();
  writeFileSync(join(harnessDir, 'PROFILE.md'), REACT_PROFILE);
  const profile = loadProfile(root);
  assert.equal(profile.commands.install, 'npm ci');
  assert.equal(profile.limits.files_max, 5);
  assert.equal(profile.limits.timeout_check_s, 120);
});

test('loadProfile lanza error legible si no existe PROFILE.md', () => {
  const { root } = makeFixtureProject();
  rmSync(join(root, '.harness', 'PROFILE.md'), { force: true });
  assert.throws(() => loadProfile(root), /No se encontró el perfil/);
});

// --- Task 19: the repo's real profiles (profiles/<fw>/PROFILE.md) ---
// template/.harness/scripts/ sits 3 levels below the template repo root.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// profiles/<fw>/PROFILE.md vive en el repo harness-base pero no viaja al destino:
// install.sh copia SOLO el elegido a .harness/PROFILE.md. Cuando el suite corre
// como smoke dentro de un destino instalado, profiles/ no existe: se salta.
const skipIfNoProfile = (fw) =>
  existsSync(join(REPO_ROOT, 'profiles', fw, 'PROFILE.md'))
    ? {}
    : { skip: `profiles/${fw}/PROFILE.md ausente (contexto de destino instalado, no del repo harness-base)` };

test('perfil react: parseProfile devuelve los comandos y límites del spec', skipIfNoProfile('react'), () => {
  const text = readFileSync(join(REPO_ROOT, 'profiles', 'react', 'PROFILE.md'), 'utf8');
  assert.match(text, /^# Perfil: react\n/, 'el título debe ser "# Perfil: react"');
  assert.ok(text.trimEnd().split('\n').length <= 150, 'PROFILE.md react supera 150 líneas');
  // parseProfile already throws if Comandos/Límites are missing; the two prose
  // sections of the fixed format (spec §11) are asserted here.
  for (const heading of ['## Convenciones', '## Trampas conocidas']) {
    assert.ok(text.includes(heading), `falta la sección "${heading}"`);
  }
  const profile = parseProfile(text);
  assert.deepEqual(profile.commands, {
    install: 'npm ci',
    test: 'npm test -- <filtro>',
    build: 'npm run build',
    lint: 'npm run lint',
    typecheck: 'npm run typecheck',
  });
  assert.deepEqual(profile.limits, {
    files_max: 5,
    diff_max: 800,
    timeout_check_s: 120,
    diff_excludes: ['package-lock.json', '*.lock'],
  });
});

test('perfil android: parseProfile devuelve los comandos y límites del spec', skipIfNoProfile('android'), () => {
  const text = readFileSync(join(REPO_ROOT, 'profiles', 'android', 'PROFILE.md'), 'utf8');
  assert.match(text, /^# Perfil: android\n/, 'el título debe ser "# Perfil: android"');
  assert.ok(text.trimEnd().split('\n').length <= 150, 'PROFILE.md android supera 150 líneas');
  for (const heading of ['## Convenciones', '## Trampas conocidas']) {
    assert.ok(text.includes(heading), `falta la sección "${heading}"`);
  }
  const profile = parseProfile(text);
  assert.deepEqual(profile.commands, {
    install: './gradlew help',
    test: 'timeout 600 ./gradlew testDebugUnitTest',
    build: 'timeout 600 ./gradlew assembleDebug',
    lint: './gradlew lintDebug',
    typecheck: './gradlew compileDebugKotlin',
  });
  assert.deepEqual(profile.limits, {
    files_max: 8,
    diff_max: 800,
    timeout_check_s: 600,
    diff_excludes: ['gradle.lockfile', '*.lockfile'],
  });
  // Spec §11: the time cap is mechanical — test and build are wrapped in coreutils timeout.
  assert.match(profile.commands.test, /^timeout 600 /);
  assert.match(profile.commands.build, /^timeout 600 /);
  // Spec §11: the profile must state explicitly that instrumented tests are out of v1.
  assert.match(text, /instrumentados[^\n]*fuera de v1/i);
});
