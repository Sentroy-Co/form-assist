import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';
import type { FormatsPlugin } from 'ajv-formats';
const addFormats = addFormatsImport as unknown as FormatsPlugin;
import { AssistError } from './types.js';
import type { ApplyResult, Change, ChangePlan, FieldOption, FieldPolicy, FormSnapshot, JsonValue, OptionResolver, UndoReceipt } from './types.js';
export * from './types.js';

const fail = (code: string, message: string): never => { throw new AssistError(code, message); };
const has = (o: object, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);
const blocked = new Set(['__proto__', 'prototype', 'constructor']);
function json(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object') return fail('INVALID_JSON', 'Value must contain only JSON data');
  const o = value as object;
  if (seen.has(o)) return fail('INVALID_JSON', 'Cyclic values are not JSON');
  if (!Array.isArray(o) && Object.getPrototypeOf(o) !== Object.prototype && Object.getPrototypeOf(o) !== null) return fail('INVALID_JSON', 'Only plain JSON objects are allowed');
  seen.add(o);
  const keys = Reflect.ownKeys(o);
  for (const k of keys) {
    if (typeof k !== 'string' || (Array.isArray(o) && k === 'length')) continue;
    if (blocked.has(k)) return fail('INVALID_JSON', 'Unsafe object key');
    const d = Object.getOwnPropertyDescriptor(o, k);
    if (!d || !d.enumerable || !('value' in d)) return fail('INVALID_JSON', 'JSON properties must be enumerable data properties');
    json(d.value, seen);
  }
  if (Array.isArray(o) && (keys.length !== o.length + 1 || Object.keys(o).some((k, i) => k !== String(i)))) return fail('INVALID_JSON', 'Sparse or extended arrays are not JSON');
  if (keys.some(k => typeof k === 'symbol')) return fail('INVALID_JSON', 'Symbols are not JSON');
  seen.delete(o);
}
function clone<T>(value: T): T { json(value); return JSON.parse(JSON.stringify(value)) as T; }
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const ak = Object.keys(a).sort(), bk = Object.keys(b).sort();
  return ak.length === bk.length && ak.every((k, i) => k === bk[i] && equal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
function pointer(path: unknown): string[] {
  if (typeof path !== 'string' || !path.startsWith('/') || path === '/') return fail('INVALID_PATH', 'Expected a non-root JSON pointer');
  const parts = path.slice(1).split('/').map(part => {
    if (/~(?![01])/.test(part)) return fail('INVALID_PATH', 'Invalid JSON pointer escape');
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    if (blocked.has(key)) return fail('INVALID_PATH', 'Unsafe JSON pointer');
    return key;
  });
  return parts;
}
const prefix = (a: string[], b: string[]) => a.length <= b.length && a.every((p, i) => p === b[i]);
const protectedField = (f: FieldPolicy) => !f.aiWritable || !!f.readOnly || !!f.sensitive || !!f.hidden || ['password', 'file', 'hidden'].includes((f.inputType ?? '').toLowerCase());
function indexFor(part: string, length: number, add: boolean): number {
  if (add && part === '-') return length;
  if (!/^(0|[1-9]\d*)$/.test(part)) return fail('INVALID_PATH', 'Invalid array index');
  const n = Number(part);
  if (!Number.isSafeInteger(n) || n > length || (!add && n === length)) return fail('INVALID_PATH', 'Array index out of bounds');
  return n;
}
function locate(root: unknown, parts: string[]): { parent: Record<string, unknown> | unknown[]; key: string | number; exists: boolean; value: unknown } {
  let current: unknown = root;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current || typeof current !== 'object') return fail('INVALID_PATH', 'Path parent does not exist');
    const part = parts[i]!;
    const key = Array.isArray(current) ? indexFor(part, current.length, false) : part;
    if (!has(current, String(key))) return fail('INVALID_PATH', 'Path parent does not exist');
    current = (current as Record<string | number, unknown>)[key];
  }
  if (!current || typeof current !== 'object') return fail('INVALID_PATH', 'Path parent does not exist');
  const part = parts[parts.length - 1]!;
  const key = Array.isArray(current) ? indexFor(part, current.length, true) : part;
  const exists = has(current, String(key));
  return { parent: current as Record<string, unknown> | unknown[], key, exists, value: (current as Record<string | number, unknown>)[key] };
}
function execute(values: Record<string, JsonValue>, change: Change): void {
  const { parent, key, exists } = locate(values, pointer(change.path));
  if (change.op !== 'add' && !exists) return fail('INVALID_PATH', 'Target does not exist');
  if (change.op === 'add' && exists && !Array.isArray(parent)) return fail('INVALID_PATH', 'Add target already exists');
  if (Array.isArray(parent)) {
    const n = key as number;
    if (change.op === 'add') parent.splice(n, 0, clone(change.value));
    else if (change.op === 'remove') parent.splice(n, 1);
    else parent[n] = clone(change.value);
  } else if (change.op === 'remove') delete parent[key as string];
  else parent[key as string] = clone(change.value);
}
function validateValues(form: FormSnapshot, values: Record<string, JsonValue>): void {
  try {
    const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true });
    addFormats(ajv);
    const valid = ajv.compile(form.schema);
    if (!valid(values)) return fail('SCHEMA_VALIDATION', ajv.errorsText(valid.errors));
  } catch (e) {
    if (e instanceof AssistError) throw e;
    return fail('INVALID_SCHEMA', e instanceof Error ? e.message : 'Invalid JSON Schema');
  }
  for (const f of form.fields) if (f.options) {
    let entry: ReturnType<typeof locate>;
    try { entry = locate(values, pointer(f.path)); } catch { continue; }
    if (!entry.exists) continue;
    const allowed = (v: unknown) => f.options!.some(o => equal(o.value, v));
    if (Array.isArray(entry.value) ? !entry.value.every(allowed) : !allowed(entry.value)) return fail('INVALID_OPTION', `Value is not an allowed option at ${f.path}`);
  }
}
export function validateForm(form: FormSnapshot): void {
  json(form);
  if (!form || typeof form !== 'object' || ![form.formId, form.schemaVersion, form.revision].every(x => typeof x === 'string' && x.length > 0) || !form.schema || typeof form.schema !== 'object' || Array.isArray(form.schema) || !form.values || typeof form.values !== 'object' || Array.isArray(form.values) || !Array.isArray(form.fields)) return fail('INVALID_FORM', 'Invalid form snapshot');
  const paths = new Set<string>();
  for (const f of form.fields) {
    if (!f || typeof f !== 'object' || typeof f.aiWritable !== 'boolean') return fail('INVALID_FORM', 'Invalid field policy');
    pointer(f.path);
    if (paths.has(f.path)) return fail('INVALID_FORM', 'Duplicate field path');
    paths.add(f.path);
    if (f.options && (!Array.isArray(f.options) || f.options.some(o => !o || typeof o.label !== 'string' || !has(o, 'value')))) return fail('INVALID_FORM', 'Invalid field options');
    if (f.dependsOn && (!Array.isArray(f.dependsOn) || f.dependsOn.some(p => { pointer(p); return false; }))) return fail('INVALID_FORM', 'Invalid dependencies');
  }
  validateValues(form, form.values);
}
export function validatePlan(form: FormSnapshot, plan: ChangePlan): void {
  validateForm(form); json(plan);
  if (!plan || plan.protocolVersion !== '1' || typeof plan.requestId !== 'string' || !plan.requestId || plan.formId !== form.formId || !Array.isArray(plan.changes) || !Array.isArray(plan.questions) || !plan.questions.every(x => typeof x === 'string') || !Array.isArray(plan.warnings) || !plan.warnings.every(x => typeof x === 'string')) return fail('INVALID_PLAN', 'Invalid change plan');
  if (plan.baseRevision !== form.revision) return fail('REVISION_CONFLICT', 'Form revision has changed');
  const values = clone(form.values), seen: string[][] = [];
  for (const c of plan.changes) {
    if (!c || !['add', 'replace', 'remove'].includes(c.op) || (c.reason !== undefined && typeof c.reason !== 'string') || (c.op === 'remove' ? has(c, 'value') : !has(c, 'value'))) return fail('INVALID_PLAN', 'Invalid change');
    const path = pointer(c.path);
    if (seen.some(p => prefix(p, path) || prefix(path, p))) return fail('INVALID_PLAN', 'Overlapping changes are not allowed');
    seen.push(path);
    const policy = form.fields.find(f => f.path === c.path);
    if (!policy || protectedField(policy)) return fail('FORBIDDEN_PATH', `Path is not writable: ${c.path}`);
    if (form.fields.some(f => protectedField(f) && (prefix(pointer(f.path), path) || prefix(path, pointer(f.path))))) return fail('FORBIDDEN_PATH', `Path overlaps a protected field: ${c.path}`);
    const target = locate(values, path);
    if (Array.isArray(target.parent) && c.op !== 'replace') {
      const parentPath = path.slice(0, -1);
      if (form.fields.some(f => protectedField(f) && prefix(parentPath, pointer(f.path)))) return fail('FORBIDDEN_PATH', 'Array operation shifts a protected field');
    }
    if (schemaHides(form.schema, path, form.schema)) return fail('FORBIDDEN_PATH', `Schema protects path: ${c.path}`);
    const beforeValues = clone(values);
    execute(values, c);
    if (changesProtectedSchemaValue(form.schema, beforeValues, values, [])) return fail('FORBIDDEN_PATH', `Change affects a schema-protected value: ${c.path}`);
  }
  validateValues(form, values);
}
let revisionCounter = 0;
function nextRevision(previous: string): string { return `${previous}:${Date.now().toString(36)}:${(++revisionCounter).toString(36)}:${Math.random().toString(36).slice(2)}`; }
export function applyPlan(form: FormSnapshot, plan: ChangePlan, selectedPaths?: string[]): ApplyResult {
  validatePlan(form, plan);
  if (selectedPaths !== undefined && (!Array.isArray(selectedPaths) || selectedPaths.some(p => typeof p !== 'string' || !plan.changes.some(c => c.path === p)) || new Set(selectedPaths).size !== selectedPaths.length)) return fail('INVALID_SELECTION', 'Selection contains unknown or duplicate paths');
  const selected = plan.changes.filter(c => selectedPaths === undefined || selectedPaths.includes(c.path));
  const next = clone(form);
  for (const c of selected) execute(next.values, c);
  validateValues(next, next.values);
  if (selected.length) next.revision = nextRevision(form.revision);
  return { form: next, receipt: { before: clone(form), after: clone(next), changedPaths: selected.map(c => c.path) } };
}
export function undo(form: FormSnapshot, receipt: UndoReceipt): FormSnapshot {
  validateForm(form); json(receipt); validateForm(receipt.before); validateForm(receipt.after);
  if (form.formId !== receipt.before.formId || form.formId !== receipt.after.formId || !Array.isArray(receipt.changedPaths)) return fail('INVALID_RECEIPT', 'Invalid undo receipt');
  const next = clone(form);
  const restored = new Set<string>();
  for (const path of receipt.changedPaths) {
    const parts = pointer(path);
    // Array edits change sibling indices: treat the whole array as the conflict unit.
    let unit = parts;
    let cur: unknown = receipt.before.values;
    for (let i = 0; i < parts.length; i++) {
      if (Array.isArray(cur)) { unit = parts.slice(0, i); break; }
      if (!cur || typeof cur !== 'object') break;
      cur = (cur as Record<string, unknown>)[parts[i]!];
    }
    if (!unit.length) return fail('INVALID_RECEIPT', 'Cannot undo root array');
    const unitKey = JSON.stringify(unit);
    if (restored.has(unitKey)) continue;
    restored.add(unitKey);
    const before = locate(receipt.before.values, unit), after = locate(receipt.after.values, unit), now = locate(next.values, unit);
    if (now.exists !== after.exists || (now.exists && !equal(now.value, after.value))) return fail('UNDO_CONFLICT', `Field changed after apply: ${path}`);
    if (before.exists) {
      if (Array.isArray(now.parent)) now.parent[now.key as number] = clone(before.value);
      else now.parent[now.key as string] = clone(before.value);
    } else if (now.exists) {
      if (Array.isArray(now.parent)) now.parent.splice(now.key as number, 1);
      else delete now.parent[now.key as string];
    }
  }
  validateValues(next, next.values);
  if (receipt.changedPaths.length) next.revision = nextRevision(form.revision);
  return next;
}
// Schema annotations are advisory in JSON Schema, but are confidentiality boundaries here.
// Walk every applicable branch, resolving local references; uncertainty excludes the value.
function schemaHides(schema: unknown, path: string[], root: Record<string, unknown>, seen = new Set<unknown>()): boolean {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return false;
  if (seen.has(schema)) return true;
  const node = schema as Record<string, unknown>;
  if (node.readOnly === true || node.writeOnly === true) return true;
  const nextSeen = new Set(seen); nextSeen.add(schema);
  if (typeof node.$ref === 'string') {
    if (!node.$ref.startsWith('#/')) return true;
    let ref: unknown = root;
    for (const part of node.$ref.slice(2).split('/')) {
      const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
      if (!ref || typeof ref !== 'object' || !has(ref, key)) return true;
      ref = (ref as Record<string, unknown>)[key];
    }
    if (schemaHides(ref, path, root, nextSeen)) return true;
  }
  for (const branch of ['allOf', 'anyOf', 'oneOf']) {
    if (Array.isArray(node[branch]) && (node[branch] as unknown[]).some(child => schemaHides(child, path, root, nextSeen))) return true;
  }
  for (const branch of ['if', 'then', 'else']) if (node[branch] && schemaHides(node[branch], path, root, nextSeen)) return true;
  if (!path.length) return false;
  const part = path[0]!;
  const properties = node.properties;
  if (properties && typeof properties === 'object' && has(properties, part) && schemaHides((properties as Record<string, unknown>)[part], path.slice(1), root, nextSeen)) return true;
  const patterns = node.patternProperties;
  if (patterns && typeof patterns === 'object') for (const [pattern, child] of Object.entries(patterns)) {
    try { if (new RegExp(pattern, 'u').test(part) && schemaHides(child, path.slice(1), root, nextSeen)) return true; } catch { return true; }
  }
  if (/^(0|[1-9]\d*)$/.test(part)) {
    const index = Number(part);
    const child = Array.isArray(node.prefixItems) && index < node.prefixItems.length ? node.prefixItems[index] : node.items;
    if (child && schemaHides(child, path.slice(1), root, nextSeen)) return true;
  }
  if (node.additionalProperties && typeof node.additionalProperties === 'object' && (!properties || !has(properties as object, part)) && schemaHides(node.additionalProperties, path.slice(1), root, nextSeen)) return true;
  return false;
}
// Compare all affected descendants, including array positions shifted by insertion/removal.
function changesProtectedSchemaValue(schema: Record<string, unknown>, before: unknown, after: unknown, path: string[]): boolean {
  if (equal(before, after)) return false;
  if (path.length && schemaHides(schema, path, schema)) return true;
  const beforeObject = before !== null && typeof before === 'object';
  const afterObject = after !== null && typeof after === 'object';
  if (!beforeObject && !afterObject) return false;
  const keys = new Set<string>([...(beforeObject ? Object.keys(before as object) : []), ...(afterObject ? Object.keys(after as object) : [])]);
  for (const key of keys) {
    const oldValue = beforeObject ? (before as Record<string, unknown>)[key] : undefined;
    const newValue = afterObject ? (after as Record<string, unknown>)[key] : undefined;
    if (changesProtectedSchemaValue(schema, oldValue, newValue, [...path, key])) return true;
  }
  return false;
}
export function contextForModel(form: FormSnapshot): FormSnapshot {
  validateForm(form);
  const result = clone(form);
  const protectedPaths = form.fields.filter(protectedField).map(f => pointer(f.path));
  const eligible = form.fields.filter(f => !protectedField(f) && !protectedPaths.some(p => prefix(p, pointer(f.path))) && !schemaHides(form.schema, pointer(f.path), form.schema));
  result.fields = clone(eligible);
  // Schema metadata may contain private defaults, examples, or unlisted definitions.
  result.schema = { type: 'object' };
  const paths = eligible.map(f => pointer(f.path));
  const project = (value: JsonValue, path: string[]): JsonValue | undefined => {
    if (protectedPaths.some(p => prefix(p, path)) || schemaHides(form.schema, path, form.schema)) return undefined;
    const exact = paths.some(p => p.length === path.length && prefix(p, path));
    const descendant = paths.some(p => prefix(path, p) && p.length > path.length);
    if (Array.isArray(value)) {
      // A declared scalar list is a field; objects and individually protected items
      // require explicit child policies and are projected recursively.
      if (exact && !descendant && !protectedPaths.some(p => prefix(path, p) && p.length > path.length) && value.every(v => v === null || typeof v !== 'object') && value.every((_, i) => !schemaHides(form.schema, [...path, String(i)], form.schema))) return clone(value);
      if (!descendant) return undefined;
      return value.map((v, i) => project(v, [...path, String(i)]) ?? null);
    }
    if (value && typeof value === 'object') {
      if (!descendant) return undefined;
      const out: Record<string, JsonValue> = {};
      for (const [key, child] of Object.entries(value)) {
        const projected = project(child, [...path, key]);
        if (projected !== undefined) out[key] = projected;
      }
      return out;
    }
    return exact ? value : undefined;
  };
  result.values = (project(form.values, []) ?? {}) as Record<string, JsonValue>;
  return result;
}
export async function resolveOptions(form: FormSnapshot, resolver: OptionResolver): Promise<FormSnapshot> {
  validateForm(form);
  const result = clone(form);
  for (const field of result.fields) {
    if (!field.options && !field.dependsOn) continue;
    const options: FieldOption[] = await resolver(clone(field), clone(result));
    json(options);
    if (!Array.isArray(options) || options.some(o => !o || typeof o.label !== 'string' || !has(o, 'value'))) return fail('INVALID_OPTION', 'Resolver returned invalid options');
    field.options = clone(options);
  }
  validateForm(result);
  return result;
}
