/**
 * Minimal JSON-Schema validator for public-function I/O contracts.
 *
 * Supports the subset declared in types.ts: object / string / number / integer /
 * boolean / array with nested objects, required[], enum, min/max, minLength/maxLength.
 *
 * Returns a list of validation errors (empty on success). Designed to be small and
 * dependency-free. If requirements grow, swap in ajv or similar — the entry-point
 * signature stays stable.
 */

import type { JsonSchema } from './types';

export interface ValidationError {
  path: string;
  message: string;
}

export function validate(value: unknown, schema: JsonSchema): ValidationError[] {
  const errors: ValidationError[] = [];
  walk(value, schema, '', errors);
  return errors;
}

function walk(value: unknown, schema: JsonSchema, path: string, errors: ValidationError[]): void {
  const typeOk = checkType(value, schema.type);
  if (!typeOk) {
    errors.push({ path: path || '/', message: `expected type ${schema.type}, got ${describeActualType(value)}` });
    return;
  }

  if (schema.enum && !schema.enum.includes(value as never)) {
    errors.push({ path: path || '/', message: `must be one of ${JSON.stringify(schema.enum)}` });
  }

  if (schema.type === 'string' && typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) {
      errors.push({ path: path || '/', message: `must be at least ${schema.minLength} characters` });
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      errors.push({ path: path || '/', message: `must be at most ${schema.maxLength} characters` });
    }
  }

  if ((schema.type === 'number' || schema.type === 'integer') && typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) {
      errors.push({ path: path || '/', message: `must be >= ${schema.minimum}` });
    }
    if (schema.maximum != null && value > schema.maximum) {
      errors.push({ path: path || '/', message: `must be <= ${schema.maximum}` });
    }
  }

  if (schema.type === 'object' && schema.properties) {
    const obj = value as Record<string, unknown>;
    for (const required of schema.required ?? []) {
      if (!(required in obj)) {
        errors.push({ path: joinPath(path, required), message: 'is required' });
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties)) {
      if (key in obj) {
        walk(obj[key], childSchema, joinPath(path, key), errors);
      }
    }
  }

  if (schema.type === 'array' && schema.items && Array.isArray(value)) {
    value.forEach((item, idx) => walk(item, schema.items!, `${path}[${idx}]`, errors));
  }
}

function checkType(value: unknown, type: JsonSchema['type']): boolean {
  switch (type) {
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
  }
}

function describeActualType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function joinPath(parent: string, child: string): string {
  return parent ? `${parent}.${child}` : child;
}

/**
 * Check whether a requested permission (e.g. 'app:wzbar-matcher:classify')
 * is granted by the given permission set. Supports trailing wildcards per segment.
 */
export function scopeMatches(requested: string, granted: string[]): boolean {
  const want = requested.split(':');
  return granted.some(g => {
    const have = g.split(':');
    if (have.length !== want.length) return false;
    return have.every((seg, i) => seg === '*' || seg === want[i]);
  });
}
