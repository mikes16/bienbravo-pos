// lib/frontier.mjs — calculo de la frontera de trabajo, reporte de estado y
// creacion/edicion de tareas (import / edit-task). Cero dependencias externas.

import fs from 'node:fs';
import { paths } from './paths.mjs';
import { loadState, saveState, getTask } from './state.mjs';
import { loadProfile } from './profile.mjs';
import { lintTasks } from './lint.mjs';
import { loadSchema, validate } from './schema.mjs';

// Orden canonico de la frontera: priority ascendente (1 = maxima), luego id.
function byPriorityThenId(a, b) {
  if (a.priority !== b.priority) return a.priority - b.priority;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function nextTask(state) {
  const statusById = new Map(state.tasks.map((t) => [t.id, t.status]));
  const eligible = state.tasks.filter(
    (t) =>
      t.status === 'pending' &&
      t.depends_on.every((dep) => statusById.get(dep) === 'done'),
  );
  eligible.sort(byPriorityThenId);
  return eligible[0] ?? null;
}

export function statusReport(root) {
  const state = loadState(root);
  const tasks = state.tasks;
  const statusById = new Map(tasks.map((t) => [t.id, t.status]));
  const depsById = new Map(tasks.map((t) => [t.id, t.depends_on]));

  const isEligible = (t) =>
    t.status === 'pending' &&
    t.depends_on.every((dep) => statusById.get(dep) === 'done');

  // Ancestros transitivos en estado 'blocked' (DFS con guarda anti-ciclo).
  const blockedAncestors = (id) => {
    const found = new Set();
    const seen = new Set();
    const stack = [...(depsById.get(id) ?? [])];
    while (stack.length > 0) {
      const cur = stack.pop();
      if (seen.has(cur)) continue;
      seen.add(cur);
      if (statusById.get(cur) === 'blocked') found.add(cur);
      for (const dep of depsById.get(cur) ?? []) stack.push(dep);
    }
    return [...found].sort();
  };

  const frontier = tasks
    .filter(isEligible)
    .sort(byPriorityThenId)
    .map((t) => ({ id: t.id, title: t.title, priority: t.priority, attempts: t.attempts }));

  const inFlight = tasks
    .filter((t) => t.status === 'in_progress' || t.status === 'in_review')
    .map((t) => ({ id: t.id, status: t.status }));

  const blocked = tasks
    .filter((t) => t.status === 'blocked')
    .map((t) => ({ id: t.id, title: t.title }));

  const frozen = tasks
    .filter((t) => t.status === 'pending' && !isEligible(t))
    .map((t) => ({ id: t.id, blockedBy: blockedAncestors(t.id) }))
    .filter((f) => f.blockedBy.length > 0);

  const curationFlagCleared = reconcileCurationFlag(root, tasks);

  return { frontier, inFlight, blocked, frozen, curationFlagCleared };
}

// Borra .harness/curation-active si quedo huerfano (sin tarea curation en
// in_progress/in_review). Devuelve true solo si lo borro.
function reconcileCurationFlag(root, tasks) {
  const flag = paths(root).curationFlag;
  if (!fs.existsSync(flag)) return false;
  const active = tasks.some(
    (t) =>
      t.type === 'curation' &&
      (t.status === 'in_progress' || t.status === 'in_review'),
  );
  if (active) return false;
  fs.rmSync(flag);
  return true;
}

// ---- import / edit-task --------------------------------------------------

const EDITABLE_FIELDS = [
  'title',
  'description',
  'acceptance_criteria',
  'context',
  'files',
  'depends_on',
  'priority',
  'type',
];

function runtimeDefaults() {
  return {
    status: 'pending',
    attempts: 0,
    redispatches: 0,
    split_from: null,
    review_feedback: [],
  };
}

function nextIdNumber(tasks) {
  let max = 0;
  for (const t of tasks) {
    const m = /^T-(\d{3})/.exec(t.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function formatId(n) {
  return `T-${String(n).padStart(3, '0')}`;
}

function invalid(message, items) {
  const err = new Error([message, ...items.map((i) => `  - ${i}`)].join('\n'));
  err.code = 'IMPORT_INVALID';
  return err;
}

// Valida el estado completo: primero esquema (evita que el lint crashee con
// borradores malformados), luego lint capa 1 contra el perfil activo.
function assertValid(root, state) {
  const schemaErrors = validate(state, loadSchema(root));
  if (schemaErrors.length > 0) {
    throw invalid(
      'El borrador no cumple el esquema de tasks.json:',
      schemaErrors.map((e) => `${e.path}: ${e.message}`),
    );
  }
  const { errors } = lintTasks(state, loadProfile(root), { root });
  if (errors.length > 0) {
    throw invalid(
      'El lint rechazo el borrador:',
      errors.map((e) => `${e.taskId} [${e.rule}] ${e.detail}`),
    );
  }
}

export function importTasks(root, draftPath) {
  const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
  const drafts = Array.isArray(draft?.tasks) ? draft.tasks : [];
  if (drafts.length === 0) {
    throw invalid('El borrador no contiene tareas.', []);
  }

  const state = loadState(root);
  let counter = nextIdNumber(state.tasks);
  const added = [];
  const newTasks = drafts.map((d) => {
    const id = formatId(counter++);
    added.push(id);
    return {
      id,
      title: d.title,
      description: d.description,
      acceptance_criteria: d.acceptance_criteria,
      context: d.context ?? [],
      files: d.files ?? [],
      depends_on: d.depends_on ?? [],
      priority: d.priority,
      type: d.type,
      ...runtimeDefaults(),
    };
  });

  const nextState = { ...state, tasks: [...state.tasks, ...newTasks] };
  assertValid(root, nextState);
  saveState(root, nextState);
  return { added };
}

export function editTask(root, id, draftPath) {
  const state = loadState(root);
  getTask(state, id); // valida existencia: lanza si no esta
  const task = state.tasks.find((t) => t.id === id);
  const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));

  for (const field of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(draft, field)) {
      task[field] = draft[field];
    }
  }

  assertValid(root, state);
  saveState(root, state);
  return { task };
}
