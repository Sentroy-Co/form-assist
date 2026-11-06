import { AssistError } from '../core/types.js';
import { errorResponse, readBody, type ServerContext, type ServerAction } from './index.js';

export interface CredentialRecord { id: string; name: string; provider: string; model: string; enabled: boolean; default: boolean; secrets: Record<string, string> }
export interface CredentialSummary { id: string; name: string; provider: string; model: string; enabled: boolean; default: boolean; secretFields: string[]; masked: string }
export interface CredentialStore {
  get(tenantId: string, id: string): Promise<CredentialRecord | undefined>;
  list(tenantId: string): Promise<CredentialRecord[]>;
  set(tenantId: string, record: CredentialRecord): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
}
function validKey(value: string): boolean { return typeof value === 'string' && value.length > 0 && value.length <= 200; }
export function createMemoryCredentialStore(): CredentialStore {
  const tenants = new Map<string, Map<string, CredentialRecord>>();
  return {
    async get(tenant, id) { const value = tenants.get(tenant)?.get(id); return value && structuredClone(value); },
    async list(tenant) { return [...(tenants.get(tenant)?.values() ?? [])].map(value => structuredClone(value)); },
    async set(tenant, record) { if (!validKey(tenant) || !validKey(record.id)) throw new Error('Invalid credential key'); let entries = tenants.get(tenant); if (!entries) tenants.set(tenant, entries = new Map()); entries.set(record.id, structuredClone(record)); },
    async delete(tenant, id) { tenants.get(tenant)?.delete(id); },
  };
}
/** Read-only environment mapping, supplied by the host rather than reading process.env at import. */
export function createEnvironmentCredentialStore(entries: Record<string, Record<string, Omit<CredentialRecord, 'secrets'> & { secretEnv: Record<string, string> }>>, env: Record<string, string | undefined>): CredentialStore {
  const get = async (tenant: string, id: string): Promise<CredentialRecord | undefined> => {
    const entry = Object.hasOwn(entries, tenant) && Object.hasOwn(entries[tenant] ?? {}, id) ? entries[tenant]?.[id] : undefined;
    if (!entry) return undefined; const secrets: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const [field, key] of Object.entries(entry.secretEnv)) { const value = env[key]; if (value === undefined) throw new Error('Credential environment variable missing'); secrets[field] = value; }
    const { secretEnv: _, ...record } = entry; return { ...record, secrets };
  };
  return { get, async list(tenant) { return Promise.all(Object.keys(entries[tenant] ?? {}).map(id => get(tenant, id))).then(values => values.filter((v): v is CredentialRecord => !!v)); }, async set() { throw new Error('Environment store is read-only'); }, async delete() { throw new Error('Environment store is read-only'); } };
}
export function summarizeCredential(record: CredentialRecord): CredentialSummary { return { id: record.id, name: record.name, provider: record.provider, model: record.model, enabled: record.enabled, default: record.default, secretFields: Object.keys(record.secrets), masked: '••••••••' }; }
export interface CredentialManagerConfig {
  store: CredentialStore;
  getContext(request: Request): Promise<ServerContext>;
  authorize(context: ServerContext, action: ServerAction, resource: string): boolean | Promise<boolean>;
  test?: (record: CredentialRecord, signal: AbortSignal) => Promise<void>;
  maxBodyBytes?: number;
  testTimeoutMs?: number;
}
/** Routes: GET /, PUT /:id, DELETE /:id, POST /:id/test. Mount at an authenticated admin endpoint. */
export function createCredentialManager(config: CredentialManagerConfig) {
  if (!config.authorize || !config.getContext) throw new Error('authorize and getContext are required');
  return { async handle(request: Request): Promise<Response> {
    try {
      const context = await config.getContext(request); if (!context || typeof context.tenantId !== 'string' || !context.tenantId) throw new AssistError('UNAUTHORIZED', 'Authentication required');
      const url = new URL(request.url); const segments = url.pathname.split('/').filter(Boolean); const test = segments.at(-1) === 'test'; const id = decodeURIComponent(segments.at(test ? -2 : -1) ?? '');
      const list = request.method === 'GET'; const action: ServerAction = list ? 'credentials:list' : test && request.method === 'POST' ? 'credentials:test' : request.method === 'DELETE' ? 'credentials:delete' : 'credentials:write';
      if (!await config.authorize(context, action, list ? '*' : id)) throw new AssistError('FORBIDDEN', 'Not authorized');
      if (list) return Response.json((await config.store.list(context.tenantId)).map(summarizeCredential), { headers: { 'cache-control': 'no-store' } });
      if (!validKey(id)) throw new AssistError('INVALID_REQUEST', 'Invalid id');
      if (request.method === 'DELETE' && !test) { await config.store.delete(context.tenantId, id); return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } }); }
      if (request.method === 'POST' && test) {
        const body = await readBody(request, config.maxBodyBytes ?? 32_000) as { allowPaidTest?: unknown };
        if (body?.allowPaidTest !== true || !config.test) throw new AssistError('INVALID_REQUEST', 'Explicit paid test opt-in required');
        const record = await config.store.get(context.tenantId, id); if (!record) throw new AssistError('NOT_FOUND', 'Not found');
        if (request.signal.aborted) throw new AssistError('CANCELLED', 'Cancelled');
        const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), config.testTimeoutMs ?? 10_000); const abort = () => controller.abort(); request.signal.addEventListener('abort', abort, { once: true });
        let interrupted: (() => void) | undefined;
        try {
          const interruption = new Promise<never>((_, reject) => { interrupted = () => reject(new AssistError(request.signal.aborted ? 'CANCELLED' : 'TIMEOUT', 'Interrupted')); controller.signal.addEventListener('abort', interrupted, { once: true }); });
          if (request.signal.aborted) { controller.abort(); await interruption; }
          await Promise.race([config.test(record, controller.signal), interruption]);
        } finally { clearTimeout(timeout); request.signal.removeEventListener('abort', abort); if (interrupted) controller.signal.removeEventListener('abort', interrupted); }
        return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
      }
      if (request.method === 'PUT' && !test) {
        const input = await readBody(request, config.maxBodyBytes ?? 32_000) as Partial<CredentialRecord>;
        if (!input || typeof input.name !== 'string' || !input.name || typeof input.provider !== 'string' || !input.provider || typeof input.model !== 'string' || typeof input.enabled !== 'boolean' || typeof input.default !== 'boolean' || (input.secrets !== undefined && (!input.secrets || typeof input.secrets !== 'object' || Array.isArray(input.secrets) || Object.entries(input.secrets).some(([k, v]) => !validKey(k) || typeof v !== 'string' || !v)))) throw new AssistError('INVALID_REQUEST', 'Invalid credential');
        const old = await config.store.get(context.tenantId, id); const secrets = input.secrets === undefined ? old?.secrets : input.secrets;
        if (!secrets || !Object.keys(secrets).length) throw new AssistError('INVALID_REQUEST', 'Missing secrets');
        const record: CredentialRecord = { id, name: input.name, provider: input.provider, model: input.model, enabled: input.enabled, default: input.default, secrets };
        await config.store.set(context.tenantId, record); return Response.json(summarizeCredential(record), { headers: { 'cache-control': 'no-store' } });
      }
      return new Response(null, { status: 405 });
    } catch (error) { return errorResponse(error); }
  } };
}
