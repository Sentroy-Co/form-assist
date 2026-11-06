import { describe, it, expect } from 'vitest';
import { createAssistantServer } from '../packages/form-assist/src/server/index.js';
import type { Provider } from '../packages/form-assist/src/providers/types.js';
import { createAssistant, createHttpTransport } from '../packages/form-assist/src/browser/index.js';
import { readFileSync } from 'node:fs';
import type { FormSnapshot, ProposeRequest } from '../packages/form-assist/src/core/types.js';
const form: FormSnapshot = { formId: 'f', schemaVersion: '1', revision: 'r', schema: { type: 'object', properties: { title: { type: 'string' }, password: { type: 'string' } }, required: ['title', 'password'], additionalProperties: false }, values: { title: 'old', password: 'private' }, fields: [{ path: '/title', aiWritable: true }, { path: '/password', aiWritable: false, sensitive: true }] };
const request: ProposeRequest = { protocolVersion: '1', requestId: 'q', formId: 'f', baseRevision: 'r', values: { title: 'old' }, prompt: 'change', connectionId: 'c', model: 'm' };
const provider = (run: Provider['propose']): Provider => ({ id: 'p', capabilities: { authentication: 'test', modelListing: false, structuredOutput: true, streaming: false, cancellation: true, usage: false }, propose: run });
const plan = { protocolVersion: '1' as const, requestId: 'q', formId: 'f', baseRevision: 'r', changes: [{ op: 'replace' as const, path: '/title', value: 'new' }], questions: [], warnings: [] };
function server(p: Provider, extra = {}) { return createAssistantServer({ forms: { f: form }, connections: { c: { provider: p, models: ['m'] } }, getContext: async () => ({ tenantId: 'a' }), authorize: () => true, ...extra }); }
describe('server boundary', () => {
  it('uses registered policy, removes protected values and emits only a complete validated stream event', async () => {
    const s = server(provider(async input => { expect(input.form.values).toEqual({ title: 'old' }); expect(JSON.stringify(input)).not.toContain('private'); return { plan }; }));
    const response = await s.handle(new Request('https://host/propose', { method: 'POST', headers: { accept: 'application/x-ndjson' }, body: JSON.stringify({ ...request, schema: {}, tenantId: 'evil' }) }));
    expect(response.status).toBe(200); expect(JSON.parse(await response.text())).toMatchObject({ type: 'result', plan });
  });
  it('rejects forbidden provider output and models without leaking provider errors', async () => {
    const s = server(provider(async () => ({ plan: { ...plan, changes: [{ op: 'replace', path: '/password', value: 'stolen' }] } })));
    const bad = await s.handle(new Request('https://host', { method: 'POST', body: JSON.stringify(request) })); expect(bad.status).toBe(502);
    const model = await s.handle(new Request('https://host', { method: 'POST', body: JSON.stringify({ ...request, model: 'other' }) })); expect(model.status).toBe(403);
    const failing = server(provider(async () => { throw new Error('super-secret'); })); const response = await failing.handle(new Request('https://host', { method: 'POST', body: JSON.stringify(request) })); expect(await response.text()).not.toContain('super-secret');
  });

  it('connects the browser controller to the handler with required protected fixture fields', async () => {
    const article = JSON.parse(readFileSync(new URL('../fixtures/article.json', import.meta.url), 'utf8')) as FormSnapshot;
    const p = provider(async input => ({ plan: { protocolVersion: '1', requestId: input.request.requestId, formId: article.formId, baseRevision: input.request.baseRevision, changes: [{ op: 'replace', path: '/title', value: 'Updated' }], questions: [], warnings: [] } }));
    const s = createAssistantServer({ forms: { [article.formId]: article }, connections: { c: { provider: p, models: ['m'] } }, getContext: async () => ({ tenantId: 'tenant' }), authorize: () => true });
    let snapshot = article;
    const controller = createAssistant({ binding: { read: () => snapshot, write: next => { snapshot = next; } }, connectionId: 'c', model: 'm', transport: createHttpTransport('https://host', async (input, init) => s.handle(new Request(input, init))) });
    await controller.propose('update title'); expect(controller.getSnapshot().status).toBe('review'); await controller.apply(); expect(snapshot.values).toMatchObject({ title: 'Updated', slug: 'existing-article', published: false });
  });
  it('rejects protected and unlisted values and checks resolved revision per tenant', async () => {
    const s = server(provider(async () => ({ plan })), { resolveForm: async (_id: string, context: { tenantId: string }) => ({ ...form, revision: context.tenantId === 'a' ? 'r' : 'other' }) });
    await expect(s.propose({ ...request, values: { title: 'old', password: 'private' } }, { tenantId: 'a' })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(s.propose({ ...request, values: { title: 'old', extra: 'x' } }, { tenantId: 'a' })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(s.propose(request, { tenantId: 'b' })).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
  });
  it('preserves schema-hidden required fields and rejects nested unlisted fields', async () => {
    const nested: FormSnapshot = { formId: 'f', schemaVersion: '1', revision: 'r', schema: { type: 'object', properties: { hidden: { type: 'string', readOnly: true }, object: { type: 'object', properties: { allowed: { type: 'string' }, secret: { type: 'string', writeOnly: true }, other: { type: 'string' } }, required: ['allowed', 'secret', 'other'] } }, required: ['hidden', 'object'] }, values: { hidden: 'private', object: { allowed: 'old', secret: 'hidden', other: 'unlisted' } }, fields: [{ path: '/hidden', aiWritable: true }, { path: '/object', aiWritable: true }, { path: '/object/allowed', aiWritable: true }, { path: '/object/secret', aiWritable: true }] };
    const s = createAssistantServer({ forms: { f: nested }, connections: { c: { provider: provider(async () => ({ plan: { ...plan, changes: [{ op: 'replace', path: '/object/allowed', value: 'new' }] } })), models: ['m'] } }, getContext: async () => ({ tenantId: 'a' }), authorize: () => true });
    const valid = { ...request, values: { object: { allowed: 'old' } } }; await expect(s.propose(valid, { tenantId: 'a' })).resolves.toMatchObject({ requestId: 'q' });
    await expect(s.propose({ ...valid, values: { hidden: 'private', object: { allowed: 'old' } } }, { tenantId: 'a' })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(s.propose({ ...valid, values: { object: { allowed: 'old', other: 'injected' } } }, { tenantId: 'a' })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });
  it('propagates cancellation when a provider does not settle', async () => {
    const s = server(provider(async () => new Promise(() => {}))); const controller = new AbortController();
    const pending = s.propose(request, { tenantId: 'a' }, controller.signal); controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
  });
  it('enforces body size and times out even when a provider ignores cancellation', async () => {
    const s = server(provider(async () => new Promise(() => {})), { limits: { timeoutMs: 10, maxBodyBytes: 1000 } });
    const timeout = await s.handle(new Request('https://host', { method: 'POST', body: JSON.stringify(request) })); expect(timeout.status).toBe(504);
    const large = await s.handle(new Request('https://host', { method: 'POST', body: 'x'.repeat(1001) })); expect(large.status).toBe(413);
  });
});
