import { describe, expect, it } from 'vitest';
import { createAssistant, createHttpTransport } from '../packages/form-assist/src/browser/index.js';
import type { FormBinding } from '../packages/form-assist/src/browser/index.js';
import type { ChangePlan, FormSnapshot } from '../packages/form-assist/src/core/types.js';
const initial = (): FormSnapshot => ({ formId: 'f', schemaVersion: '1', revision: '1', schema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['title','body'] }, values: { title: 'old', body: 'old' }, fields: [{ path: '/title', aiWritable: true }, { path: '/body', aiWritable: true }] });
function store() { let value = initial(); const listeners = new Set<() => void>(); const binding: FormBinding = { read: () => structuredClone(value), write(next, _, expected) { if (JSON.stringify(value) !== JSON.stringify(expected)) throw new Error('stale'); value = structuredClone(next); listeners.forEach(f => f()); }, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } }; return { binding, change() { value.values.title = 'typed'; value.revision = '2'; listeners.forEach(f => f()); }, current: () => value }; }
function plan(id: string): ChangePlan { return { protocolVersion: '1', requestId: id, formId: 'f', baseRevision: '1', changes: [{ op: 'replace', path: '/title', value: 'new' }, { op: 'replace', path: '/body', value: 'new body' }], questions: [], warnings: [] }; }
describe('browser controller', () => {
  it('ignores a late proposal after user edits or cancellation', async () => {
    const form = store(); let resolve!: (p: ChangePlan) => void; let id = '';
    const c = createAssistant({ binding: form.binding, connectionId: 'c', model: 'm', transport: request => { id = request.requestId; return new Promise(r => { resolve = r; }); } });
    const pending = c.propose('help'); form.change(); resolve(plan(id)); await pending;
    expect(c.getSnapshot().status).toBe('conflict'); expect(form.current().values.title).toBe('typed');
    const pending2 = c.propose('again'); c.cancel(); resolve(plan(id)); await pending2; expect(c.getSnapshot().status).toBe('cancelled'); c.dispose();
  });
  it('applies selected paths and prevents undo from overwriting edits', async () => {
    const form = store(); const c = createAssistant({ binding: form.binding, connectionId: 'c', model: 'm', transport: async r => plan(r.requestId) });
    await c.propose('help'); await c.apply(['/title']); expect(form.current().values).toEqual({ title: 'new', body: 'old' });
    form.change(); await c.undo(); expect(form.current().values.title).toBe('typed'); expect(c.getSnapshot().status).toBe('conflict');
  });
  it('does not perform work after disposal', async () => {
    const form = store(); let calls = 0; const c = createAssistant({ binding: form.binding, connectionId: 'c', model: 'm', transport: async r => { calls++; return plan(r.requestId); } });
    c.dispose(); await c.propose('ignored'); await c.apply(); await c.undo(); c.cancel(); expect(calls).toBe(0); expect(c.getSnapshot().status).toBe('idle');
  });
  it('limits response bytes', async () => {
    const transport = createHttpTransport('/test', async () => new Response('x'.repeat(30)), 20);
    await expect(transport({ protocolVersion:'1', requestId:'x', formId:'f', baseRevision:'1', values:{}, prompt:'', connectionId:'c', model:'m' }, new AbortController().signal)).rejects.toThrow();
  });
});
