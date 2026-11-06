import { AssistError } from '../core/types.js';
import type { FormSnapshot, JsonValue } from '../core/types.js';
import { sameSnapshot } from '../browser/index.js';
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export function segments(path: string): string[] {
  if (!path.startsWith('/') || /~(?![01])/.test(path)) throw new AssistError('INVALID_PATH', 'Invalid field path.');
  const parts = path.slice(1).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (parts.some(s => ['__proto__', 'constructor', 'prototype'].includes(s))) throw new AssistError('INVALID_PATH', 'Unsafe field path.');
  return parts;
}
export function get(values: unknown, path: string): JsonValue | undefined {
  let current: unknown = values;
  for (const part of segments(path)) { if (!current || typeof current !== 'object') return undefined; current = (current as Record<string, unknown>)[part]; }
  return current as JsonValue | undefined;
}
export function set(values: Record<string, JsonValue>, path: string, value: JsonValue | undefined): void {
  const parts = segments(path); let current: Record<string, unknown> = values;
  for (const part of parts.slice(0, -1)) { if (!current[part] || typeof current[part] !== 'object') current[part] = {}; current = current[part] as Record<string, unknown>; }
  const last = parts[parts.length - 1]!; if (value === undefined) delete current[last]; else current[last] = copy(value);
}
export function assertExpected(actual: FormSnapshot, expected?: FormSnapshot): void {
  if (expected && !sameSnapshot(actual, expected)) throw new AssistError('CONFLICT', 'The form changed before the update.');
}
