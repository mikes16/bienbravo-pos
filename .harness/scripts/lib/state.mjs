import {
  readFileSync, writeFileSync, renameSync, appendFileSync, existsSync, mkdirSync, utimesSync,
} from 'node:fs';
import { paths, runPaths } from './paths.mjs';
import { loadSchema, validate } from './schema.mjs';

// Local helper: id of the current run, read from .harness/runs/current.
// lib/runs.mjs (created later) also exposes currentRunId; reading the file here
// keeps state.mjs free of a state -> runs -> state circular dependency.
function currentRunId(root) {
  const file = paths(root).currentRunFile;
  if (!existsSync(file)) return null;
  const id = readFileSync(file, 'utf8').trim();
  return id === '' ? null : id;
}

function formatErrors(errors) {
  return errors.map((e) => `${e.path}: ${e.message}`).join('\n  ');
}

export function loadState(root) {
  const file = paths(root).tasksJson;
  if (!existsSync(file)) throw new Error(`tasks.json not found at ${file}`);
  const raw = readFileSync(file, 'utf8');
  let state;
  try {
    state = JSON.parse(raw);
  } catch (err) {
    throw new Error(`tasks.json is not valid JSON: ${err.message}`);
  }
  const errors = validate(state, loadSchema(root));
  if (errors.length > 0) {
    throw new Error(`tasks.json failed schema validation:\n  ${formatErrors(errors)}`);
  }
  return state;
}

export function saveState(root, state) {
  const p = paths(root);
  const errors = validate(state, loadSchema(root));
  if (errors.length > 0) {
    throw new Error(`refusing to save invalid state:\n  ${formatErrors(errors)}`);
  }
  // Rotating backup of the previous content (only when a run is active: the
  // backup lives inside the run directory).
  const runId = currentRunId(root);
  if (runId !== null && existsSync(p.tasksJson)) {
    const { backupFile, runDir } = runPaths(root, runId);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(backupFile, readFileSync(p.tasksJson, 'utf8'));
  }
  // Atomic write: tmp file + rename.
  const tmp = `${p.tasksJson}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  renameSync(tmp, p.tasksJson);
}

export function getTask(state, id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) throw new Error(`unknown task ${id}`);
  return task;
}

export function appendJournal(root, event) {
  const runId = currentRunId(root);
  if (runId === null) return; // no active run -> nowhere to journal (no-op)
  const { journal, runDir } = runPaths(root, runId);
  mkdirSync(runDir, { recursive: true });
  appendFileSync(journal, `${new Date().toISOString()} ${event}\n`);
}

export function touchLock(root) {
  const lock = paths(root).lockFile;
  if (!existsSync(lock)) return; // never creates it; runStart owns creation
  const now = new Date();
  writeFileSync(lock, `${now.toISOString()}\n`); // heartbeat: single ISO line
  utimesSync(lock, now, now);
}
