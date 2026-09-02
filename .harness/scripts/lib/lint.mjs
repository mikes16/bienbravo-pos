import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ID_PATTERN,
  CRITERIA_MIN,
  CRITERIA_MAX,
  DESCRIPTION_MAX,
  CONTEXT_MAX,
  REASON_MAX,
  CRITERIA_KINDS,
} from './constants.mjs';

export function lintTasks(state, profile, opts = {}) {
  const errors = [];
  const warnings = [];
  const tasks = state.tasks;
  const byId = new Map();
  const seen = new Set();

  for (const task of tasks) {
    if (!ID_PATTERN.test(task.id)) {
      errors.push({
        taskId: task.id,
        rule: 'id-pattern',
        detail: `id "${task.id}" no cumple el patrón T-NNN[a-z]`,
      });
    }
    if (seen.has(task.id)) {
      errors.push({ taskId: task.id, rule: 'duplicate-id', detail: `id duplicado: ${task.id}` });
    }
    seen.add(task.id);
    byId.set(task.id, task);
  }

  const cycle = findCycle(tasks, byId);
  if (cycle) {
    errors.push({
      taskId: cycle[0],
      rule: 'cycle',
      detail: `ciclo de dependencias: ${cycle.join(' -> ')}`,
    });
  }

  const scope = scopeSet(tasks, byId, opts.changedIds);

  for (const task of tasks) {
    if (!scope.has(task.id)) continue;
    lintOneTask(task, byId, profile, opts.root, errors, warnings);
  }

  lintSplitChains(tasks, scope, errors);
  lintSharedFiles(tasks, byId, scope, warnings);

  return { errors, warnings };
}

// Incremental mode: changed tasks + their direct graph neighbors
// (dependencies and dependents). Without changedIds, everything is in scope.
function scopeSet(tasks, byId, changedIds) {
  if (!changedIds || changedIds.length === 0) {
    return new Set(tasks.map((task) => task.id));
  }
  const scope = new Set(changedIds);
  for (const id of changedIds) {
    const task = byId.get(id);
    for (const dep of task ? task.depends_on ?? [] : []) scope.add(dep);
  }
  for (const task of tasks) {
    if ((task.depends_on ?? []).some((dep) => changedIds.includes(dep))) {
      scope.add(task.id);
    }
  }
  return scope;
}

function lintOneTask(task, byId, profile, root, errors, warnings) {
  const err = (rule, detail) => errors.push({ taskId: task.id, rule, detail });
  const warn = (rule, detail) => warnings.push({ taskId: task.id, rule, detail });

  for (const dep of task.depends_on ?? []) {
    if (!byId.has(dep)) err('dep-missing', `depends_on referencia "${dep}", que no existe`);
  }

  const files = task.files ?? [];
  if (files.length > profile.limits.files_max) {
    err('files-max', `files tiene ${files.length} rutas; el perfil permite ${profile.limits.files_max}`);
  }

  const criteria = task.acceptance_criteria ?? [];
  if (criteria.length < CRITERIA_MIN || criteria.length > CRITERIA_MAX) {
    err('criteria-count', `${criteria.length} criterios; se exigen entre ${CRITERIA_MIN} y ${CRITERIA_MAX}`);
  }

  const description = task.description ?? '';
  if (description.length > DESCRIPTION_MAX) {
    err('description-max', `description tiene ${description.length} chars; máximo ${DESCRIPTION_MAX}`);
  }

  const context = task.context ?? [];
  if (context.length > CONTEXT_MAX) {
    err('context-max', `context tiene ${context.length} entradas; máximo ${CONTEXT_MAX}`);
  }

  for (const criterion of criteria) {
    if (!criterion.id || !criterion.desc || !criterion.kind) {
      err('criterion-fields', `criterio ${criterion.id || '(sin id)'} sin id/desc/kind completos`);
      continue;
    }
    if (!CRITERIA_KINDS.includes(criterion.kind)) {
      err('criterion-fields', `criterio ${criterion.id}: kind "${criterion.kind}" no está en ${CRITERIA_KINDS.join('|')}`);
      continue;
    }
    if (criterion.kind === 'manual') {
      warn('manual-check', `criterio ${criterion.id} es manual: queda fuera de CHECKS y exige verificación humana`);
    } else if (typeof criterion.check !== 'string' || criterion.check.trim() === '') {
      err('criterion-check', `criterio ${criterion.id} (kind ${criterion.kind}) sin comando en check`);
    }
  }

  for (const entry of context) {
    const reason = typeof entry.reason === 'string' ? entry.reason : '';
    if (reason.length > REASON_MAX) {
      err('reason-max', `context "${entry.path}": reason tiene ${reason.length} chars; máximo ${REASON_MAX}`);
    }
    if (root) lintContextPath(entry, root, err);
  }
}

function lintContextPath(entry, root, err) {
  const [rawPath, anchor] = String(entry.path).split('#');
  const absolute = join(root, rawPath);
  if (!existsSync(absolute)) {
    err('context-path-missing', `context path "${rawPath}" no existe en disco`);
    return;
  }
  if (!anchor) return;
  const wanted = anchor.trim().toLowerCase();
  const content = readFileSync(absolute, 'utf8');
  const found = content.split('\n').some((line) => {
    const heading = line.match(/^##?\s+(.+?)\s*$/);
    return heading !== null && heading[1].toLowerCase() === wanted;
  });
  if (!found) {
    err('context-anchor-missing', `"${rawPath}" no contiene un heading "# ${anchor}" ni "## ${anchor}"`);
  }
}

function lintSplitChains(tasks, scope, errors) {
  const groups = new Map();
  for (const task of tasks) {
    if (task.split_from == null) continue;
    if (!groups.has(task.split_from)) groups.set(task.split_from, []);
    groups.get(task.split_from).push(task);
  }
  for (const [parentId, children] of groups) {
    const touchesScope = scope.has(parentId) || children.some((child) => scope.has(child.id));
    if (!touchesScope) continue;
    children.sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 1; i < children.length; i++) {
      const prev = children[i - 1];
      const child = children[i];
      if (!(child.depends_on ?? []).includes(prev.id)) {
        errors.push({
          taskId: child.id,
          rule: 'split-chain',
          detail: `hija de ${parentId}: "${child.id}" debe depender de "${prev.id}" (cadena secuencial)`,
        });
      }
    }
  }
}

function lintSharedFiles(tasks, byId, scope, warnings) {
  const ancestors = buildAncestors(tasks, byId);
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i];
      const b = tasks[j];
      if (!scope.has(a.id) && !scope.has(b.id)) continue;
      const shared = (a.files ?? []).filter((file) => (b.files ?? []).includes(file));
      if (shared.length === 0) continue;
      const related = ancestors.get(a.id)?.has(b.id) || ancestors.get(b.id)?.has(a.id);
      if (related) continue;
      warnings.push({
        taskId: a.id,
        rule: 'shared-files',
        detail: `comparte [${shared.join(', ')}] con ${b.id} sin relación de dependencia`,
      });
    }
  }
}

function buildAncestors(tasks, byId) {
  const memo = new Map();
  function ancestorsOf(id) {
    if (memo.has(id)) return memo.get(id);
    const set = new Set();
    memo.set(id, set); // set BEFORE recursing: cuts cycles (already reported by 'cycle')
    const task = byId.get(id);
    for (const dep of task ? task.depends_on ?? [] : []) {
      set.add(dep);
      for (const transitive of ancestorsOf(dep)) set.add(transitive);
    }
    return set;
  }
  for (const task of tasks) ancestorsOf(task.id);
  return memo;
}

function findCycle(tasks, byId) {
  const color = new Map(); // undefined = white, 1 = gray, 2 = black
  const stack = [];
  let found = null;

  function visit(id) {
    if (found) return;
    color.set(id, 1);
    stack.push(id);
    const task = byId.get(id);
    for (const dep of task ? task.depends_on ?? [] : []) {
      if (!byId.has(dep)) continue; // dep-missing is reported per task
      const depColor = color.get(dep);
      if (depColor === 1) {
        found = [...stack.slice(stack.indexOf(dep)), dep];
        return;
      }
      if (depColor === undefined) visit(dep);
      if (found) return;
    }
    stack.pop();
    color.set(id, 2);
  }

  for (const task of tasks) {
    if (color.get(task.id) === undefined) visit(task.id);
    if (found) return found;
  }
  return null;
}
