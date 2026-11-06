import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CredentialRecord, CredentialStore } from './credentials.js';

export interface EncryptedFileStoreOptions { directory: string; activeKeyId: string; keys: Record<string, Uint8Array> }
/** Keys are 32-byte AES keys kept outside the storage directory. Writes use the active key. */
export function createEncryptedFileCredentialStore(options: EncryptedFileStoreOptions): CredentialStore {
  const keys = new Map(Object.entries(options.keys).map(([id, key]) => [id, Buffer.from(key)]));
  if (!options.activeKeyId || !keys.has(options.activeKeyId) || [...keys.values()].some(key => key.length !== 32)) throw new Error('AES-256 keys and active key ID required');
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  const dir = (tenant: string) => join(options.directory, hash(tenant));
  const path = (tenant: string, id: string) => join(dir(tenant), `${hash(id)}.json`);
  const aad = (tenant: string, id: string, keyId: string) => Buffer.from(JSON.stringify([tenant, id, keyId]));
  async function read(tenant: string, file: string): Promise<CredentialRecord> {
    const envelope = JSON.parse(await readFile(file, 'utf8')) as { keyId: string; id: string; iv: string; tag: string; data: string };
    const key = keys.get(envelope.keyId); if (!key) throw new Error('Credential encryption key unavailable');
    const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64')); cipher.setAAD(aad(tenant, envelope.id, envelope.keyId)); cipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const record = JSON.parse(Buffer.concat([cipher.update(Buffer.from(envelope.data, 'base64')), cipher.final()]).toString('utf8')) as CredentialRecord;
    if (record.id !== envelope.id || file !== path(tenant, record.id)) throw new Error('Credential integrity failure'); return record;
  }
  return {
    async get(tenant, id) { try { return await read(tenant, path(tenant, id)); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; } },
    async list(tenant) { let files: string[]; try { files = await readdir(dir(tenant)); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } return Promise.all(files.filter(file => /^[a-f0-9]{64}\.json$/.test(file)).map(file => read(tenant, join(dir(tenant), file)))); },
    async set(tenant, record) {
      if (!tenant || !record.id) throw new Error('Invalid credential key'); const keyId = options.activeKeyId; const key = keys.get(keyId)!; const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(aad(tenant, record.id, keyId)); const data = Buffer.concat([cipher.update(JSON.stringify(record)), cipher.final()]);
      const envelope = JSON.stringify({ keyId, id: record.id, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') });
      await mkdir(dir(tenant), { recursive: true, mode: 0o700 }); const temp = join(dir(tenant), `.${randomBytes(16).toString('hex')}.tmp`);
      try { await writeFile(temp, envelope, { mode: 0o600, flag: 'wx' }); await rename(temp, path(tenant, record.id)); } finally { await unlink(temp).catch(() => {}); }
    },
    async delete(tenant, id) { await unlink(path(tenant, id)).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }); },
  };
}
