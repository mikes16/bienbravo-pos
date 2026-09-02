#!/usr/bin/env node
// Entry del CLI del harness: parseo de argv + dispatch de los comandos del contrato.
// Salida: JSON por stdout en next/status/show/report; texto simple en el resto.
// Exit codes: 0 ok · 1 validación/lint/reporte-inválido · 2 transición ilegal.
// Pipeline mutador: transición (saveState adentro) → journal → touchLock → lint incremental.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { REPORT_CLIP_LINES } from './lib/constants.mjs';
import { findRoot, runPaths } from './lib/paths.mjs';
import { loadState, appendJournal, touchLock } from './lib/state.mjs';
import { loadProfile } from './lib/profile.mjs';
import { lintTasks } from './lib/lint.mjs';
import * as tr from './lib/transitions.mjs';
import { nextTask, statusReport, importTasks, editTask } from './lib/frontier.mjs';
import {
  addLesson,
  addDecision,
  lintMemory,
  memoryInit,
  maybeEnqueueCuration,
  setCurationFlag,
  clearCurationFlag,
} from './lib/memory.mjs';
import { runStart, runEnd, currentRunId } from './lib/runs.mjs';
import { latestReportPath, showReport, buildDispatch } from './lib/report.mjs';

class CliError extends Error {
  constructor(exitCode, message) {
    super(message);
    this.exitCode = exitCode;
  }
}

// Flags que nunca consumen el token siguiente como valor.
const BOOLEAN_FLAGS = new Set(['from-file', 'force']);

function parseArgv(argv) {
  const [command, ...rest] = argv;
  const positionals = [];
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const body = token.slice(2);
    const eq = body.indexOf('=');
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
    } else if (BOOLEAN_FLAGS.has(body)) {
      flags[body] = true;
    } else if (rest[i + 1] !== undefined && !rest[i + 1].startsWith('--')) {
      flags[body] = rest[i + 1];
      i += 1;
    } else {
      flags[body] = true;
    }
  }
  return { command, positionals, flags };
}

function requirePositional(ctx, name) {
  if (ctx.positionals[0] === undefined) throw new CliError(1, `falta el argumento <${name}>`);
  return ctx.positionals[0];
}

function requireFlag(ctx, name) {
  const value = ctx.flags[name];
  if (value === undefined || value === true) throw new CliError(1, `falta el flag --${name}`);
  return value;
}

// El journal vive en el run vigente; sin run activo (p. ej. memory-init pre-run) se omite.
function journalSafe(root, line) {
  if (currentRunId(root) !== null) appendJournal(root, line);
}

function runIncrementalLint(root, changedIds) {
  const { errors, warnings } = lintTasks(
    loadState(root),
    loadProfile(root),
    changedIds.length > 0 ? { changedIds, root } : { root },
  );
  for (const w of warnings) process.stderr.write(`WARN ${w.taskId} ${w.rule}: ${w.detail}\n`);
  if (errors.length > 0) {
    for (const e of errors) process.stderr.write(`ERROR ${e.taskId} ${e.rule}: ${e.detail}\n`);
    throw new CliError(1, 'lint con errores (el estado ya quedó persistido)');
  }
}

// Cierre de todo comando mutador: journal → touchLock → lint incremental.
function finishMutation(root, journalLines, changedIds) {
  for (const line of journalLines) journalSafe(root, line);
  touchLock(root);
  runIncrementalLint(root, changedIds);
}

// ACs fallidos del veredicto recién juzgado (attempt ya viene post-incremento).
function failedAcs(root, id, attempt) {
  const runId = currentRunId(root);
  if (runId === null) return '';
  const file = path.join(runPaths(root, runId).verdictsDir, `${id}.a${attempt}.json`);
  if (!fs.existsSync(file)) return '';
  try {
    const verdict = JSON.parse(fs.readFileSync(file, 'utf8'));
    return (verdict.criteria?.fail ?? []).join(',');
  } catch {
    return '';
  }
}

function clearCurationIfTerminal(root, task) {
  if (task.type === 'curation' && (task.status === 'done' || task.status === 'blocked')) {
    clearCurationFlag(root);
  }
}

function maybeCuration(root) {
  const curationId = maybeEnqueueCuration(root);
  if (curationId !== null) journalSafe(root, `curation-enqueued ${curationId}`);
}

const COMMANDS = {
  'run-start'(ctx) {
    const { runId, resumed } = runStart(ctx.root, ctx.flags.force === true ? { force: true } : {});
    journalSafe(ctx.root, `run-start ${runId}`);
    touchLock(ctx.root);
    process.stdout.write(`run-start ${runId}${resumed ? ' (resumed)' : ''}\n`);
  },
  'run-end'(ctx) {
    journalSafe(ctx.root, 'run-end');
    runEnd(ctx.root);
    process.stdout.write('run-end: SUMMARY.md escrito, lock liberado\n');
  },
  status(ctx) {
    process.stdout.write(`${JSON.stringify(statusReport(ctx.root))}\n`);
  },
  next(ctx) {
    process.stdout.write(`${JSON.stringify(nextTask(loadState(ctx.root)))}\n`);
  },
  show(ctx) {
    const id = requirePositional(ctx, 'id');
    const role = requireFlag(ctx, 'for');
    if (role !== 'executor' && role !== 'reviewer') {
      throw new CliError(1, `--for debe ser executor|reviewer, no "${role}"`);
    }
    const dispatch = buildDispatch(ctx.root, id, { role });
    process.stdout.write(`${JSON.stringify({ id, role, dispatch })}\n`);
  },
  start(ctx) {
    const id = requirePositional(ctx, 'id');
    const { task, handoffOverlaps } = tr.start(ctx.root, id);
    if (task.type === 'curation') setCurationFlag(ctx.root);
    finishMutation(ctx.root, [`start ${id} a${task.attempts + 1}`], [id]);
    process.stdout.write(`start ${id} -> in_progress (a${task.attempts + 1})\n`);
    for (const overlap of handoffOverlaps) {
      process.stdout.write(`handoff-overlap ${overlap.taskId}: ${overlap.files.join(', ')}\n`);
    }
  },
  'to-review'(ctx) {
    const id = requirePositional(ctx, 'id');
    const { task } = tr.toReview(ctx.root, id);
    finishMutation(ctx.root, [`to-review ${id} a${task.attempts + 1}`], [id]);
    process.stdout.write(`to-review ${id} -> in_review\n`);
  },
  approve(ctx) {
    const id = requirePositional(ctx, 'id');
    const { task } = tr.approveTask(ctx.root, id);
    clearCurationIfTerminal(ctx.root, task);
    finishMutation(ctx.root, [`approve ${id}`], [id]);
    process.stdout.write(`approve ${id} -> done\n`);
  },
  reject(ctx) {
    const id = requirePositional(ctx, 'id');
    const { task } = tr.reject(ctx.root, id);
    const acs = failedAcs(ctx.root, id, task.attempts);
    const lines = [`reject ${id} a${task.attempts}${acs === '' ? '' : ` ${acs}`}`];
    if (task.status === 'blocked') lines.push(`blocked ${id}`);
    clearCurationIfTerminal(ctx.root, task);
    finishMutation(ctx.root, lines, [id]);
    process.stdout.write(`reject ${id} -> ${task.status}\n`);
  },
  fail(ctx) {
    const id = requirePositional(ctx, 'id');
    const { task } = tr.fail(ctx.root, id);
    const lines = [`fail ${id} a${task.attempts}`];
    if (task.status === 'blocked') lines.push(`blocked ${id}`);
    clearCurationIfTerminal(ctx.root, task);
    finishMutation(ctx.root, lines, [id]);
    process.stdout.write(`fail ${id} -> ${task.status}\n`);
  },
  redispatch(ctx) {
    const id = requirePositional(ctx, 'id');
    const { task } = tr.redispatch(ctx.root, id);
    const lines = [`redispatch ${id} r${task.redispatches}`];
    if (task.status === 'blocked') lines.push(`blocked ${id}`);
    clearCurationIfTerminal(ctx.root, task);
    finishMutation(ctx.root, lines, [id]);
    process.stdout.write(`redispatch ${id} -> ${task.status} (r${task.redispatches})\n`);
  },
  'apply-split'(ctx) {
    const id = requirePositional(ctx, 'id');
    if (ctx.flags['from-file'] !== true) throw new CliError(1, 'apply-split requiere --from-file');
    const { task } = tr.applySplit(ctx.root, id);
    const children = loadState(ctx.root).tasks
      .filter((t) => t.split_from === id)
      .map((t) => t.id)
      .sort();
    const lines = task.status === 'split'
      ? [`split ${id} -> ${children[0]}..${children[children.length - 1]}`]
      : [`blocked ${id}`];
    finishMutation(ctx.root, lines, [id, ...children]);
    process.stdout.write(
      `apply-split ${id} -> ${task.status}${children.length > 0 ? ` (${children.join(', ')})` : ''}\n`,
    );
  },
  unblock(ctx) {
    const id = requirePositional(ctx, 'id');
    tr.unblock(ctx.root, id);
    finishMutation(ctx.root, [`unblock ${id}`], [id]);
    process.stdout.write(`unblock ${id} -> pending\n`);
  },
  'import'(ctx) {
    const file = requireFlag(ctx, 'file');
    const { added } = importTasks(ctx.root, file);
    finishMutation(ctx.root, [`import +${added.length}`], added);
    process.stdout.write(`import: ${added.join(', ')}\n`);
  },
  'edit-task'(ctx) {
    const id = requirePositional(ctx, 'id');
    const file = requireFlag(ctx, 'file');
    editTask(ctx.root, id, file);
    finishMutation(ctx.root, [`edit-task ${id}`], [id]);
    process.stdout.write(`edit-task ${id}: actualizado\n`);
  },
  lint(ctx) {
    const { errors, warnings } = lintTasks(loadState(ctx.root), loadProfile(ctx.root), { root: ctx.root });
    for (const w of warnings) process.stdout.write(`WARN ${w.taskId} ${w.rule}: ${w.detail}\n`);
    for (const e of errors) process.stdout.write(`ERROR ${e.taskId} ${e.rule}: ${e.detail}\n`);
    if (errors.length > 0) throw new CliError(1, `lint: ${errors.length} error(es)`);
    process.stdout.write(`lint: OK (${warnings.length} warning(s))\n`);
  },
  'lint-memory'(ctx) {
    const { errors } = lintMemory(ctx.root);
    for (const e of errors) process.stdout.write(`ERROR ${e.file} ${e.rule}: ${e.detail}\n`);
    if (errors.length > 0) throw new CliError(1, `lint-memory: ${errors.length} error(es)`);
    process.stdout.write('lint-memory: OK\n');
  },
  'add-lesson'(ctx) {
    const tag = requireFlag(ctx, 'tag');
    const task = requireFlag(ctx, 'task');
    const text = ctx.positionals.join(' ');
    if (text === '') throw new CliError(1, 'falta el texto de la lección');
    const { line } = addLesson(ctx.root, { tag, task, text });
    const count = /\(x(\d+)/.exec(line)?.[1] ?? '1';
    journalSafe(ctx.root, `lesson [${tag}] x${count}`);
    maybeCuration(ctx.root);
    touchLock(ctx.root);
    process.stdout.write(`${line}\n`);
  },
  'add-decision'(ctx) {
    const task = requireFlag(ctx, 'task');
    const substitutes = typeof ctx.flags.substitutes === 'string' ? ctx.flags.substitutes : null;
    const text = ctx.positionals.join(' ');
    if (text === '') throw new CliError(1, 'falta el texto de la decisión');
    const { id } = addDecision(ctx.root, { task, text, substitutes });
    journalSafe(ctx.root, `decision ${id}`);
    maybeCuration(ctx.root);
    touchLock(ctx.root);
    process.stdout.write(`${id}\n`);
  },
  'memory-init'(ctx) {
    const file = requireFlag(ctx, 'file');
    memoryInit(ctx.root, file);
    journalSafe(ctx.root, 'memory-init');
    touchLock(ctx.root);
    process.stdout.write('memory-init: PROJECT.md instalado\n');
  },
  report(ctx) {
    const id = requireFlag(ctx, 'show');
    const result = showReport(ctx.root, id);
    const reportFile = latestReportPath(ctx.root, id);
    // .replace(/\n+$/, '') evita contar el newline final como línea extra.
    if (
      reportFile !== null &&
      fs.readFileSync(reportFile, 'utf8').replace(/\n+$/, '').split('\n').length >
        REPORT_CLIP_LINES
    ) {
      journalSafe(ctx.root, `report_overflow ${id}`);
    }
    touchLock(ctx.root);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.valid) throw new CliError(1, result.reason ?? 'reporte inválido');
  },
};

function usage() {
  return [
    'Uso: node .harness/scripts/harness.mjs <comando> [args] [--flag=valor | --flag valor]',
    'Comandos: run-start | run-end | status | next | show <id> --for=<executor|reviewer> |',
    '  start <id> | to-review <id> | approve <id> | reject <id> | fail <id> |',
    '  redispatch <id> | apply-split <id> --from-file | unblock <id> |',
    '  import --file <ruta> | edit-task <id> --file <ruta> | lint | lint-memory |',
    '  add-lesson --tag=<tag> --task=<id> <texto> |',
    '  add-decision --task=<id> [--substitutes=D-NNN] <texto> |',
    '  memory-init --file <ruta> | report --show <id>',
  ].join('\n');
}

function main() {
  const parsed = parseArgv(process.argv.slice(2));
  if (parsed.command === undefined || !Object.hasOwn(COMMANDS, parsed.command)) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
    return;
  }
  const root = findRoot(process.cwd());
  // run-start es dueño del ciclo de vida del lock: tocarlo aquí refrescaría el
  // mtime de un lock stale ANTES de que runStart→assertLockFree lo lea, matando
  // la detección de staleness (LOCKED_DIRTY y --force quedarían inalcanzables).
  // Su handler ya toca el lock después de reclamarlo.
  if (parsed.command !== 'run-start') {
    touchLock(root); // heartbeat: TODO comando refresca el lock, también los de lectura
  }
  COMMANDS[parsed.command]({ root, positionals: parsed.positionals, flags: parsed.flags });
}

try {
  main();
} catch (err) {
  if (err instanceof tr.TransitionError) {
    process.stderr.write(`transición ilegal: ${err.message}\n`);
    process.exitCode = 2;
  } else if (err instanceof CliError) {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = err.exitCode;
  } else {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  }
}
