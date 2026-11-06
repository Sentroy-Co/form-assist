import { describe, it, expect } from 'vitest';
import { applyPlan, contextForModel, undo, validateForm, validatePlan, resolveOptions } from '../packages/form-assist/src/core/index.js';
import type { ChangePlan, FormSnapshot } from '../packages/form-assist/src/core/index.js';

function form(): FormSnapshot { return { formId: 'article', schemaVersion: '1', revision: 'r1', schema: { type: 'object', required: ['title', 'meta', 'tags'], additionalProperties: false, properties: { title: { type: 'string', maxLength: 10 }, meta: { type: 'object', required: ['secret', 'description'], properties: { secret: { type: 'string', default: 'private' }, description: { type: 'string' } } }, tags: { type: 'array', items: { type: 'string' }, maxItems: 3 } } }, values: { title: 'old', meta: { secret: 'private', description: 'old description' }, tags: ['a'] }, fields: [{ path: '/title', aiWritable: true }, { path: '/meta', aiWritable: true }, { path: '/meta/secret', aiWritable: false, sensitive: true }, { path: '/meta/description', aiWritable: true }, { path: '/tags', aiWritable: true }, { path: '/tags/0', aiWritable: true }] }; }
function plan(changes: ChangePlan['changes']): ChangePlan { return { protocolVersion: '1', requestId: 'q', formId: 'article', baseRevision: 'r1', changes, questions: [], warnings: [] }; }
describe('core plans', () => {
  it('validates schema, revision, protected descendants and path safety', () => {
    expect(() => validatePlan(form(), plan([{ op: 'replace', path: '/title', value: 'too long title' }]))).toThrow();
    expect(() => validatePlan(form(), { ...plan([]), baseRevision: 'stale' })).toThrow(/revision/i);
    expect(() => validatePlan(form(), plan([{ op: 'replace', path: '/meta', value: { secret: 'stolen', description: 'x' } }]))).toThrow();
    expect(() => validatePlan(form(), plan([{ op: 'add', path: '/__proto__/polluted', value: true }]))).toThrow();
    expect(() => validatePlan(form(), plan([{ op: 'replace', path: '/tags/01', value: 'x' }]))).toThrow();
    expect(() => validatePlan(form(), plan([{ op: 'replace', path: '/title', value: NaN }]))).toThrow();
  });
  it('applies selected changes atomically and undo preserves other edits', () => {
    const source = form();
    const p = plan([{ op: 'replace', path: '/title', value: 'new' }, { op: 'replace', path: '/meta/description', value: 'new description' }]);
    const applied = applyPlan(source, p, ['/title']);
    expect(applied.form.values.title).toBe('new');
    expect(source.values.title).toBe('old');
    expect(applied.form.revision).not.toBe(source.revision);
    const edited = structuredClone(applied.form); (edited.values.meta as Record<string, string>).description = 'human'; edited.revision = 'human-revision';
    const restored = undo(edited, applied.receipt);
    expect(restored.values.title).toBe('old');
    expect((restored.values.meta as Record<string, string>).description).toBe('human');
    edited.values.title = 'human';
    expect(() => undo(edited, applied.receipt)).toThrow(/changed after apply/);
  });
  it('removes sensitive values, field metadata and schema definitions from context', () => {
    const context = contextForModel(form());
    expect(JSON.stringify(context)).not.toContain('private');
    expect(context.fields.some(f => f.path === '/meta/secret')).toBe(false);
  });
  it('respects option values and resolver results', async () => {
    const f = form(); f.fields[0]!.options = [{ label: 'Old', value: 'old' }, { label: 'New', value: 'new' }];
    expect(() => validatePlan(f, plan([{ op: 'replace', path: '/title', value: 'other' }]))).toThrow();
    const resolved = await resolveOptions(f, async field => field.path === '/title' ? [{ label: 'Old', value: 'old' }] : []);
    expect(resolved.fields[0]!.options).toEqual([{ label: 'Old', value: 'old' }]);
  });
  it('rejects non-JSON values and cycles', () => {
    const f = form(); (f.values as Record<string, unknown>).title = undefined;
    expect(() => validateForm(f)).toThrow();
    const cyclic = form(); (cyclic.values as Record<string, unknown>).cycle = cyclic.values;
    expect(() => validateForm(cyclic)).toThrow();
  });
});

describe('adversarial boundaries', () => {
  it('exposes only explicitly allowed leaf values, including nested and array paths', () => {
    const f: FormSnapshot = { formId: 'x', schemaVersion: '1', revision: 'r', schema: { type: 'object', properties: { profile: { type: 'object' }, rows: { type: 'array' }, unlisted: { default: 'schema-secret' } } }, values: { profile: { name: 'Alice', secret: 'unlisted-secret' }, rows: [{ name: 'first', secret: 'row-secret' }, { name: 'second' }], unlisted: 'top-secret' }, fields: [{ path: '/profile', aiWritable: true }, { path: '/profile/name', aiWritable: true }, { path: '/rows', aiWritable: true }, { path: '/rows/0/name', aiWritable: true }] };
    const context = contextForModel(f);
    expect(context.values).toEqual({ profile: { name: 'Alice' }, rows: [{ name: 'first' }, null] });
    expect(JSON.stringify(context)).not.toMatch(/secret|second/);
  });
  it('excludes schema readOnly and writeOnly annotations, including referenced and conditional schemas', () => {
    const f: FormSnapshot = { formId: 'x', schemaVersion: '1', revision: 'r', schema: { type: 'object', $defs: { protected: { type: 'string', writeOnly: true } }, properties: { name: { type: 'string' }, token: { $ref: '#/$defs/protected' }, locked: { allOf: [{ type: 'string' }, { readOnly: true }] } } }, values: { name: 'ok', token: 'secret', locked: 'private' }, fields: ['name', 'token', 'locked'].map(path => ({ path: '/' + path, aiWritable: true })) };
    const context = contextForModel(f);
    expect(context.values).toEqual({ name: 'ok' });
    expect(context.fields.map(f => f.path)).toEqual(['/name']);
  });
  it('guards encoded unsafe keys and ambiguous pointer encodings', () => {
    const f = form();
    for (const path of ['/meta/~2', '/meta/constructor', '/meta/prototype', '/meta/__proto__']) {
      f.fields.push({ path, aiWritable: true });
      expect(() => validatePlan(f, plan([{ op: 'add', path, value: 'x' }]))).toThrow();
      f.fields.pop();
    }
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
  it('honors escaped pointer property names and rejects overlapping paths', () => {
    const f: FormSnapshot = { formId: 'article', schemaVersion: '1', revision: 'r1', schema: { type: 'object' }, values: { 'a/b': { '~key': 'old' } }, fields: [{ path: '/a~1b', aiWritable: true }, { path: '/a~1b/~0key', aiWritable: true }] };
    expect(applyPlan(f, plan([{ op: 'replace', path: '/a~1b/~0key', value: 'new' }])).form.values).toEqual({ 'a/b': { '~key': 'new' } });
    expect(() => validatePlan(f, plan([{ op: 'replace', path: '/a~1b', value: { '~key': 'x' } }, { op: 'replace', path: '/a~1b/~0key', value: 'y' }]))).toThrow(/overlapping/i);
  });
  it('checks array bounds and restores array operations without overwriting later edits', () => {
    const f = form(); f.fields.push({ path: '/tags/1', aiWritable: true }, { path: '/tags/-', aiWritable: true }, { path: '/tags/3', aiWritable: true });
    expect(() => applyPlan(f, plan([{ op: 'add', path: '/tags/3', value: 'x' }]))).toThrow(/bounds/);
    const appended = applyPlan(f, plan([{ op: 'add', path: '/tags/-', value: 'b' }]));
    expect(appended.form.values.tags).toEqual(['a', 'b']);
    expect(undo(appended.form, appended.receipt).values.tags).toEqual(['a']);
    const edited = structuredClone(appended.form); edited.values.tags = ['a', 'b', 'human'];
    expect(() => undo(edited, appended.receipt)).toThrow(/changed after apply/);
    const removed = applyPlan(appended.form, { ...plan([{ op: 'remove', path: '/tags/0' }]), baseRevision: appended.form.revision });
    expect(removed.form.values.tags).toEqual(['b']);
    expect(undo(removed.form, removed.receipt).values.tags).toEqual(['a', 'b']);
  });
  it('prevents partial selections from violating cross-field constraints', () => {
    const f: FormSnapshot = { formId: 'article', schemaVersion: '1', revision: 'r1', schema: { type: 'object', properties: { a: { type: 'boolean' }, b: { type: 'boolean' } }, allOf: [{ if: { properties: { a: { const: true } }, required: ['a'] }, then: { properties: { b: { const: true } } } }] }, values: { a: false, b: false }, fields: [{ path: '/a', aiWritable: true }, { path: '/b', aiWritable: true }] };
    const p = plan([{ op: 'replace', path: '/a', value: true }, { op: 'replace', path: '/b', value: true }]);
    expect(() => applyPlan(f, p, ['/a'])).toThrow();
    expect(f.values).toEqual({ a: false, b: false });
    expect(applyPlan(f, p).form.values).toEqual({ a: true, b: true });
  });
});

describe('schema protected writes', () => {
  it('rejects direct and parent changes to annotated fields, including additions and removals', () => {
    const f: FormSnapshot = { formId: 'article', schemaVersion: '1', revision: 'r1', schema: { type: 'object', properties: { profile: { type: 'object', properties: { name: { type: 'string' }, locked: { readOnly: true }, secret: { writeOnly: true } } } } }, values: { profile: { name: 'old', locked: 'fixed', secret: 'hidden' } }, fields: [{ path: '/profile', aiWritable: true }, { path: '/profile/locked', aiWritable: true }, { path: '/profile/secret', aiWritable: true }] };
    expect(() => validatePlan(f, plan([{ op: 'replace', path: '/profile/locked', value: 'new' }]))).toThrow(/protect/i);
    expect(() => validatePlan(f, plan([{ op: 'remove', path: '/profile/secret' }]))).toThrow(/protect/i);
    expect(() => validatePlan(f, plan([{ op: 'replace', path: '/profile', value: { name: 'new', locked: 'changed', secret: 'hidden' } }]))).toThrow(/protect/i);
    expect(() => validatePlan(f, plan([{ op: 'replace', path: '/profile', value: { name: 'new', secret: 'hidden' } }]))).toThrow(/protect/i);
    expect(applyPlan(f, plan([{ op: 'replace', path: '/profile', value: { name: 'new', locked: 'fixed', secret: 'hidden' } }])).form.values.profile).toEqual({ name: 'new', locked: 'fixed', secret: 'hidden' });
    const missing = structuredClone(f); (missing.values.profile as Record<string, unknown>).secret = undefined; delete (missing.values.profile as Record<string, unknown>).secret;
    expect(() => validatePlan(missing, plan([{ op: 'replace', path: '/profile', value: { name: 'old', locked: 'fixed', secret: 'added' } }]))).toThrow(/protect/i);
  });
  it('rejects array shifts affecting annotated index and references', () => {
    const f: FormSnapshot = { formId: 'article', schemaVersion: '1', revision: 'r1', schema: { type: 'object', $defs: { locked: { readOnly: true } }, properties: { items: { type: 'array', prefixItems: [{ $ref: '#/$defs/locked' }], items: { type: 'string' } } } }, values: { items: ['fixed', 'free'] }, fields: [{ path: '/items/0', aiWritable: true }, { path: '/items/1', aiWritable: true }] };
    expect(() => validatePlan(f, plan([{ op: 'add', path: '/items/0', value: 'new' }]))).toThrow(/protect/i);
    expect(() => validatePlan(f, plan([{ op: 'remove', path: '/items/0' }]))).toThrow(/protect/i);
    expect(applyPlan(f, plan([{ op: 'replace', path: '/items/1', value: 'new' }])).form.values.items).toEqual(['fixed', 'new']);
  });
});
