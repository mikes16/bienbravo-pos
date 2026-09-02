import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFixtureProject } from './test-helpers.mjs';
import { validate, loadSchema } from './lib/schema.mjs';

test('validate: type mismatches report path and expected type', () => {
  assert.deepEqual(validate('x', { type: 'string' }), []);
  const errs = validate(5, { type: 'string' });
  assert.equal(errs.length, 1);
  assert.equal(errs[0].path, '$');
  assert.match(errs[0].message, /string/);
});

test('validate: integer satisfies number, float does not satisfy integer', () => {
  assert.deepEqual(validate(3, { type: 'number' }), []);
  assert.deepEqual(validate(3, { type: 'integer' }), []);
  assert.equal(validate(3.5, { type: 'integer' }).length, 1);
});

test('validate: type array admits any listed type (split_from string|null)', () => {
  const node = { type: ['string', 'null'] };
  assert.deepEqual(validate('T-001', node), []);
  assert.deepEqual(validate(null, node), []);
  assert.equal(validate(7, node).length, 1);
});

test('validate: required and additionalProperties on objects', () => {
  const node = {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: { id: { type: 'string' } },
  };
  assert.deepEqual(validate({ id: 'x' }, node), []);
  assert.match(validate({}, node)[0].message, /required property "id"/);
  assert.match(validate({ id: 'x', extra: 1 }, node)[0].message, /unexpected property "extra"/);
});

test('validate: enum, pattern, maxLength, minimum', () => {
  assert.equal(validate('bogus', { enum: ['a', 'b'] }).length, 1);
  assert.deepEqual(validate('a', { enum: ['a', 'b'] }), []);
  assert.equal(validate('T-02', { type: 'string', pattern: '^T-\\d{3}[a-z]?$' }).length, 1);
  assert.deepEqual(validate('T-020', { type: 'string', pattern: '^T-\\d{3}[a-z]?$' }), []);
  assert.equal(validate('abc', { type: 'string', maxLength: 2 }).length, 1);
  assert.equal(validate(0, { type: 'integer', minimum: 1 }).length, 1);
});

test('validate: items, minItems, maxItems recurse with indexed paths', () => {
  const node = { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string' } };
  assert.deepEqual(validate(['a'], node), []);
  assert.equal(validate([], node).length, 1);
  assert.equal(validate(['a', 'b', 'c'], node).length, 1);
  const errs = validate(['a', 5], node);
  assert.equal(errs.length, 1);
  assert.equal(errs[0].path, '$[1]');
});

function validTask(overrides = {}) {
  return {
    id: 'T-001',
    title: 'Tarea de prueba',
    description: 'Una tarea válida para los tests.',
    acceptance_criteria: [{ id: 'AC-1', desc: 'tests pass', check: 'npm test', kind: 'test' }],
    context: [],
    files: ['src/a.ts'],
    depends_on: [],
    priority: 1,
    type: 'feature',
    status: 'pending',
    attempts: 0,
    redispatches: 0,
    split_from: null,
    review_feedback: [],
    ...overrides,
  };
}

test('loadSchema + validate: a well-formed state passes green', () => {
  const { root } = makeFixtureProject();
  const schema = loadSchema(root);
  const state = {
    version: 1,
    tasks: [validTask(), validTask({ id: 'T-002', depends_on: ['T-001'] })],
  };
  assert.deepEqual(validate(state, schema), []);
});

test('tasks.schema.json rejects the violations that matter', () => {
  const { root } = makeFixtureProject();
  const schema = loadSchema(root);
  const cases = [
    [{ version: 1, tasks: [validTask({ id: 'T-2' })] }, /pattern/],
    [{ version: 1, tasks: [validTask({ status: 'bogus' })] }, /enum/],
    [{ version: 1, tasks: [validTask({ type: 'megafeature' })] }, /enum/],
    [{ version: 1, tasks: [validTask({ acceptance_criteria: [] })] }, /minItems/],
    [{ version: 1, tasks: [validTask({ priority: 0 })] }, /minimum/],
    [{ version: 1, tasks: [validTask({ attempts: 'many' })] }, /integer/],
    [{ version: 1, tasks: [validTask({ split_from: 7 })] }, /string\|null/],
    [{ version: 1, tasks: [{ ...validTask(), rogue: true }] }, /unexpected property "rogue"/],
    [{ version: 1 }, /required property "tasks"/],
  ];
  for (const [state, re] of cases) {
    const errs = validate(state, schema);
    assert.ok(errs.length >= 1, `expected at least one error for ${re}`);
    assert.ok(errs.some((e) => re.test(e.message)),
      `no message matched ${re}: ${JSON.stringify(errs)}`);
  }
});

test('tasks.schema.json caps description, context and criteria per the core limits', () => {
  const { root } = makeFixtureProject();
  const schema = loadSchema(root);
  const ctx = (n) => Array.from({ length: n }, (_, i) => (
    { type: 'doc', path: `docs/${i}.md`, reason: 'context fixture' }
  ));
  const sixCriteria = Array.from({ length: 6 }, (_, i) => (
    { id: `AC-${i + 1}`, desc: 'd', check: 'npm test', kind: 'test' }
  ));
  assert.ok(validate({ version: 1, tasks: [validTask({ description: 'x'.repeat(1201) })] }, schema)
    .some((e) => /maxLength/.test(e.message)));
  assert.ok(validate({ version: 1, tasks: [validTask({ context: ctx(8) })] }, schema)
    .some((e) => /maxItems/.test(e.message)));
  assert.deepEqual(validate({ version: 1, tasks: [validTask({ context: ctx(7) })] }, schema), []);
  assert.ok(validate({ version: 1, tasks: [validTask({ acceptance_criteria: sixCriteria })] }, schema)
    .some((e) => /maxItems/.test(e.message)));
});
