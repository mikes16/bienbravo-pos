import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ATTEMPTS, MAX_REDISPATCHES, CRITERIA_MIN, CRITERIA_MAX, DESCRIPTION_MAX,
  CONTEXT_MAX, REASON_MAX, SCOPE_TOLERANCE, HANDOFF_MAX_LINES, REPORT_CLIP_LINES,
  MEMORY_LIMITS, MEMORY_SOFT_RATIO, LOCK_STALE_MINUTES, DEDUP_OVERLAP,
  STATUSES, TASK_TYPES, CRITERIA_KINDS, CONTEXT_TYPES, LESSON_TAGS,
  ID_PATTERN, HARNESS_EXCLUDES,
} from './lib/constants.mjs';

test('numeric core limits match the contract', () => {
  assert.equal(MAX_ATTEMPTS, 3);
  assert.equal(MAX_REDISPATCHES, 2);
  assert.equal(CRITERIA_MIN, 1);
  assert.equal(CRITERIA_MAX, 5);
  assert.equal(DESCRIPTION_MAX, 1200);
  assert.equal(CONTEXT_MAX, 7);
  assert.equal(REASON_MAX, 140);
  assert.equal(SCOPE_TOLERANCE, 2);
  assert.equal(HANDOFF_MAX_LINES, 60);
  assert.equal(REPORT_CLIP_LINES, 30);
  assert.equal(MEMORY_SOFT_RATIO, 0.8);
  assert.equal(LOCK_STALE_MINUTES, 30);
  assert.equal(DEDUP_OVERLAP, 0.8);
  assert.deepEqual(MEMORY_LIMITS, { 'PROJECT.md': 60, 'DECISIONS.md': 80, 'LESSONS.md': 60 });
});

test('closed enums match the contract', () => {
  assert.deepEqual(STATUSES, ['pending', 'in_progress', 'in_review', 'done', 'blocked', 'split']);
  assert.deepEqual(TASK_TYPES, ['feature', 'fix', 'chore', 'curation']);
  assert.deepEqual(CRITERIA_KINDS, ['test', 'build', 'lint', 'manual']);
  assert.deepEqual(CONTEXT_TYPES, ['spec', 'decision', 'code_pattern', 'interface', 'doc']);
  assert.deepEqual(LESSON_TAGS, ['test', 'estilo', 'api', 'deps', 'build', 'datos', 'seguridad']);
  assert.deepEqual(HARNESS_EXCLUDES, [':(exclude)tasks.json', ':(exclude).harness']);
});

test('ID_PATTERN accepts task and split-child ids, rejects malformed ones', () => {
  assert.match('T-001', ID_PATTERN);
  assert.match('T-002a', ID_PATTERN);
  assert.doesNotMatch('T-02', ID_PATTERN);
  assert.doesNotMatch('T-002ab', ID_PATTERN);
  assert.doesNotMatch('T-002A', ID_PATTERN);
  assert.doesNotMatch('X-002', ID_PATTERN);
});
