import { readFileSync } from 'node:fs';
import { paths } from './paths.mjs';

const COMMAND_KEYS = ['install', 'test', 'build', 'lint', 'typecheck'];
const LIMIT_KEYS = ['files_max', 'diff_max', 'timeout_check', 'diff_excludes'];
const REQUIRED_LIMIT_KEYS = ['files_max', 'diff_max', 'timeout_check'];

export function parseProfile(text) {
  const sections = splitSections(text);
  const commandLines = sections['Comandos'];
  if (!commandLines) throw new Error('PROFILE.md: falta la sección "## Comandos"');
  const limitLines = sections['Límites'];
  if (!limitLines) throw new Error('PROFILE.md: falta la sección "## Límites"');

  const commands = extractPairs(commandLines, COMMAND_KEYS);
  for (const key of COMMAND_KEYS) {
    if (!commands[key]) {
      throw new Error(`PROFILE.md: falta el comando "${key}" en ## Comandos`);
    }
  }

  const raw = extractPairs(limitLines, LIMIT_KEYS);
  for (const key of REQUIRED_LIMIT_KEYS) {
    if (!raw[key]) {
      throw new Error(`PROFILE.md: falta el límite "${key}" en ## Límites`);
    }
  }

  return {
    commands,
    limits: {
      files_max: toInt('files_max', raw.files_max),
      diff_max: toInt('diff_max', raw.diff_max),
      timeout_check_s: toInt('timeout_check', raw.timeout_check.replace(/s$/, '')),
      diff_excludes: raw.diff_excludes
        ? raw.diff_excludes.split(',').map((part) => part.trim()).filter(Boolean)
        : [],
    },
  };
}

function splitSections(text) {
  const sections = {};
  let current = null;
  for (const line of text.split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = heading[1];
      sections[current] = [];
    } else if (current !== null) {
      sections[current].push(line);
    }
  }
  return sections;
}

// A line may hold several `key: value` pairs; values may contain spaces,
// so we anchor on the known keys instead of splitting by whitespace.
function extractPairs(lines, keys) {
  const pairs = {};
  const keyRe = new RegExp(`(?:^|\\s)(${keys.join('|')})\\s*:`, 'g');
  for (const line of lines) {
    keyRe.lastIndex = 0;
    const hits = [];
    let match;
    while ((match = keyRe.exec(line)) !== null) {
      hits.push({
        key: match[1],
        start: match.index,
        valueFrom: match.index + match[0].length,
      });
    }
    for (let i = 0; i < hits.length; i++) {
      const end = i + 1 < hits.length ? hits[i + 1].start : line.length;
      pairs[hits[i].key] = line.slice(hits[i].valueFrom, end).trim();
    }
  }
  return pairs;
}

function toInt(key, value) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`PROFILE.md: "${key}" debe ser un entero, recibido "${value}"`);
  }
  return Number(value);
}

export function loadProfile(root) {
  const { profileFile } = paths(root);
  let text;
  try {
    text = readFileSync(profileFile, 'utf8');
  } catch {
    throw new Error(
      `No se encontró el perfil en ${profileFile}; corre install.sh o crea .harness/PROFILE.md`
    );
  }
  return parseProfile(text);
}
