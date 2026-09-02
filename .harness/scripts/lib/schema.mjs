// Hand-written subset of JSON Schema. Supported keywords: type (string or array;
// integer satisfies number), required, properties, items, enum, pattern, minimum,
// maxLength, minItems, maxItems, additionalProperties: false.
// Enum comparison uses Array.includes (primitive enum values only).
import { readFileSync } from 'node:fs';
import { paths } from './paths.mjs';

function jsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value; // 'string' | 'boolean' | 'object'
}

export function validate(value, schemaNode, path = '$') {
  const errors = [];
  if (schemaNode.type !== undefined) {
    const t = jsonType(value);
    const allowed = Array.isArray(schemaNode.type) ? schemaNode.type : [schemaNode.type];
    const ok = allowed.includes(t) || (t === 'integer' && allowed.includes('number'));
    if (!ok) {
      errors.push({ path, message: `expected type ${allowed.join('|')}, got ${t}` });
      return errors; // type mismatch: deeper checks would be meaningless
    }
  }
  if (schemaNode.enum !== undefined && !schemaNode.enum.includes(value)) {
    errors.push({
      path,
      message: `value ${JSON.stringify(value)} not in enum [${schemaNode.enum.join(', ')}]`,
    });
  }
  if (schemaNode.pattern !== undefined && typeof value === 'string'
      && !new RegExp(schemaNode.pattern).test(value)) {
    errors.push({ path, message: `"${value}" does not match pattern ${schemaNode.pattern}` });
  }
  if (schemaNode.maxLength !== undefined && typeof value === 'string'
      && value.length > schemaNode.maxLength) {
    errors.push({ path, message: `string length ${value.length} > maxLength ${schemaNode.maxLength}` });
  }
  if (schemaNode.minimum !== undefined && typeof value === 'number' && value < schemaNode.minimum) {
    errors.push({ path, message: `${value} < minimum ${schemaNode.minimum}` });
  }
  if (Array.isArray(value)) {
    if (schemaNode.minItems !== undefined && value.length < schemaNode.minItems) {
      errors.push({ path, message: `array length ${value.length} < minItems ${schemaNode.minItems}` });
    }
    if (schemaNode.maxItems !== undefined && value.length > schemaNode.maxItems) {
      errors.push({ path, message: `array length ${value.length} > maxItems ${schemaNode.maxItems}` });
    }
    if (schemaNode.items !== undefined) {
      value.forEach((item, i) => errors.push(...validate(item, schemaNode.items, `${path}[${i}]`)));
    }
  }
  if (jsonType(value) === 'object') {
    for (const key of schemaNode.required ?? []) {
      if (!(key in value)) errors.push({ path, message: `missing required property "${key}"` });
    }
    const props = schemaNode.properties ?? {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) errors.push(...validate(value[key], sub, `${path}.${key}`));
    }
    if (schemaNode.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push({ path, message: `unexpected property "${key}"` });
      }
    }
  }
  return errors;
}

export function loadSchema(root) {
  return JSON.parse(readFileSync(paths(root).schemaFile, 'utf8'));
}
