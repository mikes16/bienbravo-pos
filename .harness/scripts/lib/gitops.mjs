import { spawnSync } from 'node:child_process';
import { HARNESS_EXCLUDES } from './constants.mjs';

// Local helper: run git -C root, throw on non-zero exit. Not exported.
function sh(root, args) {
  const res = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed (exit ${res.status}): ${res.stderr}`);
  }
  return res.stdout;
}

function isHarnessPath(p) {
  return p === 'tasks.json' || p === '.harness' || p.startsWith('.harness/');
}

// Parse `git status --porcelain`: strip the 2-char status + space; on renames
// (`XY old -> new`) keep the destination path.
function porcelainPaths(root) {
  const out = sh(root, ['status', '--porcelain']);
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const entry = line.slice(3);
      const arrow = entry.indexOf(' -> ');
      return arrow === -1 ? entry : entry.slice(arrow + 4);
    });
}

export function dirtyNonHarnessFiles(root) {
  return porcelainPaths(root).filter((p) => !isHarnessPath(p));
}

export function isTreeCleanExceptHarness(root) {
  return dirtyNonHarnessFiles(root).length === 0;
}

// Safe revert (spec §6): restore tracked files excluding harness state, then
// remove untracked files except anything under .harness/. Never touches
// tasks.json nor .harness/** — that is the write-ahead state.
export function revertKeepingHarness(root) {
  sh(root, ['checkout', '--', '.', ...HARNESS_EXCLUDES]);
  sh(root, ['clean', '-fd', '-e', '.harness']);
}

export function stageAll(root) {
  sh(root, ['add', '-A']);
}

export function headSha(root) {
  return sh(root, ['rev-parse', '--short', 'HEAD']).trim();
}

// One commit per closed task (spec §6): code + harness state together.
// Throws (via sh) if there is nothing to commit — callers only invoke it
// after a state mutation, so an empty commit signals a bug upstream.
export function commitAll(root, message) {
  stageAll(root);
  sh(root, ['commit', '-m', message]);
  return headSha(root);
}

// The task's commit is derived, never stored (spec §4): message convention
// `T-NNN: <title>`, recovered with git log --grep. `-n 1` picks the most
// recent match (e.g. a `T-002: blocked` commit superseded after unblock).
export function taskCommitSha(root, taskId) {
  const out = sh(root, ['log', `--grep=^${taskId}:`, '--format=%h', '-n', '1']);
  const sha = out.trim();
  return sha === '' ? null : sha;
}
