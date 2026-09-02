import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HANDOFF_MAX_LINES } from './constants.mjs';
import { paths } from './paths.mjs';
import { loadState, getTask } from './state.mjs';

// Absolute path to a task's handoff: <root>/.harness/handoffs/<id>.md
export function handoffPath(root, id) {
  return join(paths(root).handoffsDir, `${id}.md`);
}

// Mechanical handoff validation (spec §8): three checks — file present, at most
// HANDOFF_MAX_LINES lines, and the FIRST `## ` heading is `## Interfaz expuesta`.
// Curation tasks carry no handoff and are exempt (spec §8). → {ok, reason}.
export function validateHandoff(root, id) {
  const state = loadState(root);
  const task = getTask(state, id);
  if (task.type === 'curation') {
    return { ok: true, reason: null };
  }
  const file = handoffPath(root, id);
  if (!existsSync(file)) {
    return { ok: false, reason: `handoff file missing: .harness/handoffs/${id}.md` };
  }
  const text = readFileSync(file, 'utf8');
  const lines = text.replace(/\n$/, '').split('\n');
  if (lines.length > HANDOFF_MAX_LINES) {
    return {
      ok: false,
      reason: `handoff has ${lines.length} lines, max ${HANDOFF_MAX_LINES}`,
    };
  }
  const firstHeading = lines.find((line) => line.startsWith('## '));
  if (!firstHeading || firstHeading.trimEnd() !== '## Interfaz expuesta') {
    return {
      ok: false,
      reason: 'first "## " heading must be "## Interfaz expuesta"',
    };
  }
  return { ok: true, reason: null };
}

// → Map<taskId, files[]> parsing the `## Archivos` section of every existing handoff.
export function listHandoffFiles(root) {
  const { handoffsDir } = paths(root);
  const result = new Map();
  if (!existsSync(handoffsDir)) return result;
  for (const entry of readdirSync(handoffsDir)) {
    if (!entry.endsWith('.md')) continue;
    const taskId = entry.slice(0, -3);
    const lines = readFileSync(join(handoffsDir, entry), 'utf8').split('\n');
    const files = [];
    let inFilesSection = false;
    for (const line of lines) {
      if (line.startsWith('## ')) {
        inFilesSection = line.trim() === '## Archivos';
        continue;
      }
      if (!inFilesSection) continue;
      const match = line.match(/`([^`]+)`/);
      if (match) files.push(match[1]);
    }
    result.set(taskId, files);
  }
  return result;
}
