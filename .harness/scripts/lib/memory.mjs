import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEDUP_OVERLAP, LESSON_TAGS, MEMORY_LIMITS, MEMORY_SOFT_RATIO,
} from './constants.mjs';
import { paths } from './paths.mjs';
import { loadState } from './state.mjs';
import { importTasks } from './frontier.mjs';

const LESSON_RE = /^- \[([a-z]+)\] \(x(\d+), (T-\d{3}[a-z]?(?:\/T-\d{3}[a-z]?)*)\) (.+)$/;
const DECISION_RE = /^- \[D-(\d{3})\] (\d{4}-\d{2}-\d{2}) \((T-\d{3}[a-z]?)\) (.+)$/;
const SUBSTITUTED_RE = /^- \[D-(\d{3})\] SUSTITUIDA por D-(\d{3})\.?$/;
const TERMINAL_STATUSES = new Set(['done', 'blocked', 'split']);

function memoryFile(root, name) {
  return join(paths(root).memoryDir, name);
}

// Lines of a file, without the empty element a trailing newline produces.
function readLines(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function countLines(file) {
  if (!existsSync(file)) return 0;
  return readLines(file).length;
}

// lowercase, strip punctuation, split on whitespace -> Set of tokens
function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
}

// Jaccard overlap: |A ∩ B| / |A ∪ B|
function overlap(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function addLesson(root, { tag, task, text }) {
  if (!LESSON_TAGS.includes(tag)) {
    throw new Error(`tag invalido: ${tag} (validos: ${LESSON_TAGS.join(', ')})`);
  }
  const file = memoryFile(root, 'LESSONS.md');
  const lines = readLines(file);
  const incoming = tokenize(text);
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(LESSON_RE);
    if (!m) continue;
    if (overlap(incoming, tokenize(m[4])) >= DEDUP_OVERLAP) {
      const count = Number(m[2]) + 1;
      const ids = m[3].split('/');
      if (!ids.includes(task)) ids.push(task);
      lines[i] = `- [${m[1]}] (x${count}, ${ids.join('/')}) ${m[4]}`;
      writeFileSync(file, lines.join('\n') + '\n');
      return { merged: true, line: lines[i] };
    }
  }
  const line = `- [${tag}] (x1, ${task}) ${text}`;
  lines.push(line);
  writeFileSync(file, lines.join('\n') + '\n');
  return { merged: false, line };
}

export function addDecision(root, { task, text, substitutes = null }) {
  const file = memoryFile(root, 'DECISIONS.md');
  const lines = readLines(file);
  let max = 0;
  for (const l of lines) {
    const m = l.match(/^- \[D-(\d{3})\]/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const id = `D-${String(max + 1).padStart(3, '0')}`;
  if (substitutes) {
    const idx = lines.findIndex((l) => l.startsWith(`- [${substitutes}]`));
    if (idx === -1) throw new Error(`decision a sustituir no existe: ${substitutes}`);
    lines[idx] = `- [${substitutes}] SUSTITUIDA por ${id}`;
  }
  const date = new Date().toISOString().slice(0, 10);
  lines.push(`- [${id}] ${date} (${task}) ${text}`);
  writeFileSync(file, lines.join('\n') + '\n');
  return { id };
}

export function lintMemory(root) {
  const errors = [];
  for (const [name, limit] of Object.entries(MEMORY_LIMITS)) {
    const file = memoryFile(root, name);
    if (!existsSync(file)) {
      errors.push({ file: name, rule: 'missing-file', detail: 'no existe en .harness/memory/' });
      continue;
    }
    const lines = readLines(file);
    if (lines.length > limit) {
      errors.push({
        file: name,
        rule: 'line-limit',
        detail: `${lines.length} lineas > tope ${limit}`,
      });
    }
    if (name === 'LESSONS.md') {
      for (const l of lines) {
        if (!l.startsWith('- ')) continue;
        const m = l.match(LESSON_RE);
        if (!m || !LESSON_TAGS.includes(m[1])) {
          errors.push({ file: name, rule: 'entry-format', detail: l });
        }
      }
    }
    if (name === 'DECISIONS.md') {
      for (const l of lines) {
        if (!l.startsWith('- ')) continue;
        if (!DECISION_RE.test(l) && !SUBSTITUTED_RE.test(l)) {
          errors.push({ file: name, rule: 'entry-format', detail: l });
        }
      }
    }
  }
  return { errors };
}

export function memoryInit(root, draftPath) {
  if (!existsSync(draftPath)) throw new Error(`borrador no existe: ${draftPath}`);
  const lines = readLines(draftPath);
  const limit = MEMORY_LIMITS['PROJECT.md'];
  if (lines.length > limit) {
    throw new Error(`borrador de PROJECT.md: ${lines.length} lineas > tope ${limit}`);
  }
  writeFileSync(memoryFile(root, 'PROJECT.md'), lines.join('\n') + '\n');
  return { lines: lines.length };
}

export function setCurationFlag(root) {
  writeFileSync(paths(root).curationFlag, new Date().toISOString() + '\n');
}

export function clearCurationFlag(root) {
  rmSync(paths(root).curationFlag, { force: true });
}

export function maybeEnqueueCuration(root) {
  const overThreshold = Object.entries(MEMORY_LIMITS).some(
    ([name, limit]) => countLines(memoryFile(root, name)) >= MEMORY_SOFT_RATIO * limit,
  );
  if (!overThreshold) return null;
  const state = loadState(root);
  const inFlight = state.tasks.some(
    (t) => t.type === 'curation' && !TERMINAL_STATUSES.has(t.status),
  );
  if (inFlight) return null;
  const template = join(paths(root).templatesDir, 'CURATION-TASK.json');
  const { added } = importTasks(root, template);
  return added[0];
}
