import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCredentialManager, createMemoryCredentialStore } from '../packages/form-assist/src/server/credentials.js';
import { createEncryptedFileCredentialStore } from '../packages/form-assist/src/server/node.js';
const record = { id: 'one', name: 'main', provider: 'test', model: 'model', enabled: true, default: true, secrets: { apiKey: 'super-secret' } };
describe('credentials', () => {
  it('isolates tenants, masks responses, requires authorization and paid test opt-in', async () => {
    const store = createMemoryCredentialStore(); await store.set('a', record); let called = false;
    const manager = createCredentialManager({ store, getContext: async r => ({ tenantId: r.headers.get('tenant')! }), authorize: async c => c.tenantId !== 'denied', test: async () => { called = true; } });
    const list = await manager.handle(new Request('https://example/admin', { headers: { tenant: 'a' } })); expect(await list.text()).not.toContain('super-secret');
    const other = await manager.handle(new Request('https://example/admin', { headers: { tenant: 'b' } })); expect(await other.json()).toEqual([]);
    const denied = await manager.handle(new Request('https://example/admin', { headers: { tenant: 'denied' } })); expect(denied.status).toBe(403);
    const test = await manager.handle(new Request('https://example/admin/one/test', { method: 'POST', headers: { tenant: 'a' }, body: '{}' })); expect(test.status).toBe(400); expect(called).toBe(false);
    const crossTest = await manager.handle(new Request('https://example/admin/one/test', { method: 'POST', headers: { tenant: 'b' }, body: JSON.stringify({ allowPaidTest: true }) })); expect(crossTest.status).toBe(404); expect(called).toBe(false);
    await manager.handle(new Request('https://example/admin/one', { method: 'DELETE', headers: { tenant: 'b' } })); expect((await store.get('a', 'one'))?.secrets.apiKey).toBe('super-secret');
  });
  it('does not start an aborted paid test and times out an unresponsive test', async () => {
    const store = createMemoryCredentialStore(); await store.set('a', record); let calls = 0; let aborted = false;
    const manager = createCredentialManager({ store, getContext: async () => ({ tenantId: 'a' }), authorize: () => true, testTimeoutMs: 5, test: async (_record, signal) => { calls++; signal.addEventListener('abort', () => { aborted = true; }); await new Promise(() => {}); } });
    const controller = new AbortController(); controller.abort();
    const preaborted = await manager.handle(new Request('https://example/admin/one/test', { method: 'POST', body: '{"allowPaidTest":true}', signal: controller.signal })); expect(preaborted.status).toBe(499); expect(calls).toBe(0);
    const timeout = await manager.handle(new Request('https://example/admin/one/test', { method: 'POST', body: '{"allowPaidTest":true}' })); expect(timeout.status).toBe(504); expect(calls).toBe(1); expect(aborted).toBe(true);
  });
  it('encrypts on disk, isolates tenant, detects tampering and supports key rotation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fa-')); const key = new Uint8Array(32).fill(1); const next = new Uint8Array(32).fill(2);
    try {
      const store = createEncryptedFileCredentialStore({ directory, activeKeyId: 'old', keys: { old: key } }); await store.set('a', record);
      expect(await store.get('b', 'one')).toBeUndefined(); const tenantDir = join(directory, (await readdir(directory))[0]!); const file = join(tenantDir, (await readdir(tenantDir))[0]!); expect(await readFile(file, 'utf8')).not.toContain('super-secret');
      const rotated = createEncryptedFileCredentialStore({ directory, activeKeyId: 'new', keys: { old: key, new: next } }); await rotated.set('a', (await rotated.get('a', 'one'))!);
      const newOnly = createEncryptedFileCredentialStore({ directory, activeKeyId: 'new', keys: { new: next } }); expect((await newOnly.get('a', 'one'))?.secrets.apiKey).toBe('super-secret');
      const copied = createEncryptedFileCredentialStore({ directory, activeKeyId: 'new', keys: { new: new Uint8Array(32).fill(3) } }); await expect(copied.get('a', 'one')).rejects.toThrow();
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
