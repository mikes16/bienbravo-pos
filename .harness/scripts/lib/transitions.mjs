import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadState, saveState, getTask } from './state.mjs';
import { MAX_ATTEMPTS, MAX_REDISPATCHES } from './constants.mjs';
import {
  isTreeCleanExceptHarness,
  dirtyNonHarnessFiles,
  revertKeepingHarness,
  commitAll,
} from './gitops.mjs';
import { listHandoffFiles, validateHandoff } from './handoff.mjs';
import { paths, runPaths } from './paths.mjs';
import { loadProfile } from './profile.mjs';
import { lintTasks } from './lint.mjs';

export class TransitionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TransitionError';
    this.code = code; // 'ILLEGAL_TRANSITION' | 'PRECONDITION'
  }
}

function assertStatus(task, allowed) {
  if (!allowed.includes(task.status)) {
    throw new TransitionError(
      'ILLEGAL_TRANSITION',
      `${task.id}: transition requires status ${allowed.join('|')}, found '${task.status}'`,
    );
  }
}

// pending -> in_progress. Called BEFORE dispatching the executor:
// preconditions (deps done, tree clean except harness paths) + write-ahead
// (state hits disk here, before the orchestrator spends any tokens).
// Also computes files[] ∩ files listed in existing handoffs, so the dispatch
// can force stale-handoff updates (spec §8).
export function start(root, id) {
  const state = loadState(root);
  const task = getTask(state, id);
  assertStatus(task, ['pending']);

  const byId = new Map(state.tasks.map((t) => [t.id, t]));
  const unmetDeps = task.depends_on.filter((depId) => byId.get(depId)?.status !== 'done');
  if (unmetDeps.length > 0) {
    throw new TransitionError(
      'PRECONDITION',
      `${id}: dependencies not done: ${unmetDeps.join(', ')}`,
    );
  }

  if (!isTreeCleanExceptHarness(root)) {
    throw new TransitionError(
      'PRECONDITION',
      `${id}: working tree has non-harness changes: ${dirtyNonHarnessFiles(root).join(', ')}`,
    );
  }

  const handoffOverlaps = [];
  for (const [handoffTaskId, files] of listHandoffFiles(root)) {
    if (handoffTaskId === id) continue; // a task's own handoff is not an overlap
    const overlap = files.filter((file) => task.files.includes(file));
    if (overlap.length > 0) handoffOverlaps.push({ taskId: handoffTaskId, files: overlap });
  }

  task.status = 'in_progress';
  saveState(root, state); // write-ahead
  return { task, handoffOverlaps };
}

// in_progress -> in_review (the executor's report said RESULT: DONE).
export function toReview(root, id) {
  const state = loadState(root);
  const task = getTask(state, id);
  assertStatus(task, ['in_progress']);
  task.status = 'in_review';
  saveState(root, state);
  return { task };
}

const REVIEW_FEEDBACK_MAX = 2; // spec §7.4: max 2 entries until close

// lib/runs.mjs arrives in Task 14; transitions resolves the current run id
// directly from .harness/runs/current (local helper, not exported).
function currentRunId(root) {
  const { currentRunFile } = paths(root);
  if (!existsSync(currentRunFile)) {
    throw new TransitionError('PRECONDITION', 'no current run (.harness/runs/current missing)');
  }
  return readFileSync(currentRunFile, 'utf8').trim();
}

// Collapses review_feedback to a single 1-line summary (spec §7.4 Historial style).
function collapseFeedback(task) {
  const parts = task.review_feedback
    .filter((entry) => entry.criteria)
    .map((entry) => `a${entry.attempt} falló ${(entry.criteria.fail || []).join(',')}`);
  const summary = parts.length > 0
    ? parts.join('; ')
    : `blocked tras ${task.attempts} attempts, ${task.redispatches} redispatches`;
  return { summary };
}

// Shared terminal closure for reject/fail/redispatch at cap (spec §5.1):
// blocked + safe revert + state commit `<id>: blocked`. State is saved BEFORE
// reverting: revertKeepingHarness never touches tasks.json/.harness (spec §6),
// so the write-ahead survives and the commit picks it up.
function blockTask(root, state, task) {
  task.status = 'blocked';
  task.review_feedback = [collapseFeedback(task)];
  saveState(root, state);
  revertKeepingHarness(root);
  commitAll(root, `${task.id}: blocked`);
  return { task, blocked: true };
}

// in_review -> in_progress. Reads the verdict of the attempt just judged from
// runs/<runId>/verdicts/<id>.a<attempts+1>.json (inverted channel, spec §7.2).
export function reject(root, id) {
  const state = loadState(root);
  const task = getTask(state, id);
  assertStatus(task, ['in_review']);

  const attemptJudged = task.attempts + 1;
  const verdictFile = join(
    runPaths(root, currentRunId(root)).verdictsDir,
    `${id}.a${attemptJudged}.json`,
  );
  if (!existsSync(verdictFile)) {
    throw new TransitionError('PRECONDITION', `${id}: verdict file not found: ${verdictFile}`);
  }
  let verdict;
  try {
    verdict = JSON.parse(readFileSync(verdictFile, 'utf8'));
  } catch (err) {
    throw new TransitionError('PRECONDITION', `${id}: unreadable verdict ${verdictFile}: ${err.message}`);
  }

  task.attempts = attemptJudged;
  task.review_feedback.push({
    attempt: attemptJudged,
    criteria: verdict.criteria,
    reasons: verdict.reasons,
  });
  if (task.review_feedback.length > REVIEW_FEEDBACK_MAX) {
    task.review_feedback = task.review_feedback.slice(-REVIEW_FEEDBACK_MAX);
  }

  if (task.attempts >= MAX_ATTEMPTS) {
    const info = blockTask(root, state, task);
    return { ...info, verdict };
  }
  task.status = 'in_progress'; // retry keeps the tree: incremental fix (spec §5.1)
  saveState(root, state);
  return { task, verdict, blocked: false };
}

// in_progress -> in_progress|blocked. The executor's own judgment
// (RESULT: FAILED) counts as a real attempt (spec §5.1). No verdict file:
// the retry's PENDING_FIXES comes from the executor's failure report, which
// the orchestrator reads via report --show (spec §7.4).
export function fail(root, id) {
  const state = loadState(root);
  const task = getTask(state, id);
  assertStatus(task, ['in_progress']);
  task.attempts += 1;
  if (task.attempts >= MAX_ATTEMPTS) {
    return blockTask(root, state, task);
  }
  saveState(root, state); // tree is kept: retry fixes incrementally
  return { task, blocked: false };
}

// Evaporated dispatch without judgment (no parseable report / orphan found on
// re-entry, spec §5.1 y §16). Valid from in_progress (executor evaporated) and
// in_review (reviewer evaporated). Status is unchanged below the cap.
export function redispatch(root, id) {
  const state = loadState(root);
  const task = getTask(state, id);
  assertStatus(task, ['in_progress', 'in_review']);
  task.redispatches += 1;
  if (task.redispatches >= MAX_REDISPATCHES) {
    return blockTask(root, state, task);
  }
  saveState(root, state);
  return { task, blocked: false };
}

// blocked -> pending. Human-only path, after edit-task (spec §5.1).
// Resets both counters so the revived task gets a full budget again.
export function unblock(root, id) {
  const state = loadState(root);
  const task = getTask(state, id);
  assertStatus(task, ['blocked']);
  task.status = 'pending';
  task.attempts = 0;
  task.redispatches = 0;
  saveState(root, state);
  return { task };
}

// in_review -> done (spec §5.1). The handoff must pass mechanical validation
// (spec §8) or approval is refused with PRECONDITION — the orchestrator (Task 18)
// owns the handoff-repair path, not this function. Order is deliberate: saveState
// runs BEFORE commitAll so the single commit carries code + state together
// (spec §6, same write-ahead pattern as blockTask). A curation task carries no
// handoff (validateHandoff exempts it) and, being a terminal transition, clears
// the curation-active flag inline — clearCurationFlag lives in lib/memory.mjs
// (Task 13), not importable here yet. journal/touchLock belong to harness.mjs (Task 16).
export function approveTask(root, id) {
  const state = loadState(root);
  const task = getTask(state, id);
  assertStatus(task, ['in_review']);

  const handoff = validateHandoff(root, id);
  if (!handoff.ok) {
    throw new TransitionError('PRECONDITION', `${id}: invalid handoff — ${handoff.reason}`);
  }

  task.status = 'done';
  saveState(root, state); // write-ahead: state on disk before the commit
  if (task.type === 'curation') {
    rmSync(paths(root).curationFlag, { force: true }); // spec §14: terminal curation clears the flag
  }
  const sha = commitAll(root, `${id}: ${task.title}`);
  return { task, sha };
}

// in_progress -> split (spec §5.1 y §13). Reads the split proposal the executor
// wrote to runs/<runId>/splits/<id>.json, runs anti-fission brakes, and — on a
// valid proposal — creates 2–4 children with inherited priority/type, sequential
// dependency chaining and rewired dependents. The current-run id is resolved via
// the local currentRunId helper (reads .harness/runs/current, PRECONDITION if
// absent). journal/touchLock belong to harness.mjs (Task 16), not this function.
const CHILD_SUFFIXES = ['a', 'b', 'c', 'd'];

// Anti-fission block path (spec §16): the parent freezes at 'blocked' and the
// subtree is left untouched. saveState persists the ORIGINAL state (never a
// half-rewired candidate); write-ahead ordering mirrors blockTask —
// revertKeepingHarness excludes tasks.json/.harness (spec §6), so the state
// survives the revert and the `<id>: blocked` commit carries it. Unlike blockTask
// this keeps review_feedback intact: a split brake is not an attempt failure.
function blockInvalidSplit(root, state, task, reason) {
  task.status = 'blocked';
  saveState(root, state);
  revertKeepingHarness(root);
  commitAll(root, `${task.id}: blocked`);
  return { task, blocked: true, reason };
}

function isValidSplitChild(child) {
  return child !== null && typeof child === 'object'
    && typeof child.title === 'string' && child.title.length > 0
    && typeof child.description === 'string'
    && Array.isArray(child.acceptance_criteria)
    && Array.isArray(child.files);
}

export function applySplit(root, id) {
  const state = loadState(root);
  const task = getTask(state, id);
  assertStatus(task, ['in_progress']);

  const splitFile = join(runPaths(root, currentRunId(root)).splitsDir, `${id}.json`);
  if (!existsSync(splitFile)) {
    throw new TransitionError('PRECONDITION', `${id}: split proposal not found: ${splitFile}`);
  }

  // Anti-fission brake: a split child cannot itself be split (single level, spec §13).
  if (task.split_from !== null) {
    return blockInvalidSplit(root, state, task,
      `only one split level allowed: ${id} is already a split child of ${task.split_from}`);
  }

  let proposal;
  try {
    proposal = JSON.parse(readFileSync(splitFile, 'utf8'));
  } catch (err) {
    return blockInvalidSplit(root, state, task, `unparseable split proposal: ${err.message}`);
  }

  const children = Array.isArray(proposal.children) ? proposal.children : [];
  if (children.length < 2 || children.length > 4) {
    return blockInvalidSplit(root, state, task,
      `split needs 2-4 children, got ${children.length}`);
  }
  if (!children.every(isValidSplitChild)) {
    return blockInvalidSplit(root, state, task,
      'every child needs title, description, acceptance_criteria[] and files[]');
  }

  // Work on a clone: the block path above must persist the ORIGINAL state.
  const candidate = structuredClone(state);
  const parent = getTask(candidate, id);
  const childIds = children.map((_, i) => `${id}${CHILD_SUFFIXES[i]}`);
  const lastChildId = childIds[childIds.length - 1];

  const childTasks = children.map((child, i) => ({
    id: childIds[i],
    title: child.title,
    description: child.description,
    acceptance_criteria: child.acceptance_criteria,
    context: Array.isArray(child.context) ? child.context : [],
    files: child.files,
    depends_on: i === 0 ? [...parent.depends_on] : [childIds[i - 1]],
    priority: parent.priority,
    type: parent.type,
    status: 'pending',
    attempts: 0,
    redispatches: 0,
    split_from: id,
    review_feedback: [],
  }));

  // Rewire tasks that depended on the parent onto the LAST child (spec §13).
  for (const t of candidate.tasks) {
    if (t.id !== id && t.depends_on.includes(id)) {
      t.depends_on = t.depends_on.map((d) => (d === id ? lastChildId : d));
    }
  }
  parent.status = 'split';
  candidate.tasks.push(...childTasks);

  // Layer-1 lint gate BEFORE persisting: a lint failure is an invalid split —
  // the parent is blocked and the children are never written to disk.
  const profile = loadProfile(root);
  const { errors } = lintTasks(candidate, profile, { root, changedIds: [id, ...childIds] });
  if (errors.length > 0) {
    const detail = errors.map((e) => `${e.taskId}:${e.rule}`).join(', ');
    return blockInvalidSplit(root, state, task, `lint failed on split children: ${detail}`);
  }

  saveState(root, candidate);
  const sha = commitAll(root, `${id}: split`);
  return { task: parent, children: childIds, sha };
}
