import { AssistError, type ChangePlan, type FormSnapshot, type ProposeRequest } from '../core/types.js';
import { validateForm, validatePlan, contextForModel } from '../core/index.js';
import type { Provider } from '../providers/types.js';

export interface ServerContext { tenantId: string; [key: string]: unknown }
export type ServerAction = 'propose' | 'credentials:list' | 'credentials:write' | 'credentials:delete' | 'credentials:test';
export interface ServerLimits { maxBodyBytes?: number; maxOutputBytes?: number; maxFields?: number; timeoutMs?: number; maxConcurrent?: number; requestsPerMinute?: number; maxInputTokens?: number; maxOutputTokens?: number }
export interface ServerConfig {
  forms: Record<string, FormSnapshot>;
  connections: Record<string, { provider: Provider; models: string[] } | Provider>;
  allowedModels?: Record<string, string[]>;
  authorize(context: ServerContext, action: ServerAction, resource: string): boolean | Promise<boolean>;
  getContext(request: Request): Promise<ServerContext>;
  /** Optional tenant-specific authoritative values and revision. Registered schema and policies remain authoritative. */
  resolveForm?(formId: string, context: ServerContext): Promise<FormSnapshot | undefined>;
  limits?: ServerLimits;
}
const encoder = new TextEncoder();
const size = (value: unknown) => encoder.encode(JSON.stringify(value)).length;
function fail(code: string, message: string): never { throw new AssistError(code, message); }
function contextValid(context: ServerContext): void { if (!context || typeof context.tenantId !== 'string' || !context.tenantId) fail('UNAUTHORIZED', 'Authentication required'); }
function mergeValues(form: FormSnapshot, incoming: Record<string, unknown>): FormSnapshot['values'] {
  const eligible = new Set(contextForModel(form).fields.map(field => field.path));
  const policies = form.fields.map(field => ({ parts: field.path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~')), writable: eligible.has(field.path) }));
  const prefix = (a: string[], b: string[]) => a.length <= b.length && a.every((part, i) => part === b[i]);
  const merge = (base: unknown, value: unknown, parts: string[]): unknown => {
    const relevant = policies.filter(policy => prefix(parts, policy.parts));
    const exact = relevant.find(policy => policy.parts.length === parts.length);
    if (exact && !exact.writable) return fail('INVALID_REQUEST', 'Protected value supplied');
    const descendant = relevant.some(policy => policy.parts.length > parts.length);
    if (exact?.writable && !descendant && (value === null || typeof value !== 'object' || (Array.isArray(value) && value.every(item => item === null || typeof item !== 'object')))) return structuredClone(value);
    if (!value || typeof value !== 'object' || (base !== undefined && (typeof base !== 'object' || base === null || Array.isArray(value) !== Array.isArray(base)))) return fail('INVALID_REQUEST', 'Unlisted value supplied');
    const source = base ?? (Array.isArray(value) ? [] : {});
    const result = structuredClone(source) as Record<string, unknown>;
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) return fail('INVALID_REQUEST', 'Invalid value');
      const childParts = [...parts, key];
      if (!policies.some(policy => prefix(childParts, policy.parts))) return fail('INVALID_REQUEST', 'Unlisted value supplied');
      // contextForModel uses null placeholders to preserve protected array indexes.
      if (Array.isArray(source) && child === null && policies.some(policy => !policy.writable && policy.parts.length === childParts.length && prefix(childParts, policy.parts))) continue;
      result[key] = merge((source as Record<string, unknown>)[key], child, childParts);
    }
    // An omitted writable field is absent in the browser snapshot, rather than its registered default.
    for (const policy of relevant) if (policy.writable && policy.parts.length === parts.length + 1 && !Object.hasOwn(value, policy.parts[parts.length]!) && !policies.some(other => prefix(policy.parts, other.parts) && other.parts.length > policy.parts.length)) {
      const old = (source as Record<string, unknown>)[policy.parts[parts.length]!];
      if (!old || typeof old !== 'object' || (Array.isArray(old) && old.every(item => item === null || typeof item !== 'object'))) delete result[policy.parts[parts.length]!];
    }
    return result;
  };
  const values = merge(form.values, incoming, []) as FormSnapshot['values'];
  const stable = (value: unknown): string => Array.isArray(value) ? `[${value.map(stable).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}` : JSON.stringify(value);
  try { if (stable(contextForModel({ ...form, values }).values) !== stable(incoming)) fail('INVALID_REQUEST', 'Invalid projected values'); } catch { fail('INVALID_REQUEST', 'Invalid projected values'); }
  return values;
}
export async function readBody(request: Request, limit: number): Promise<unknown> {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) fail('BODY_TOO_LARGE', 'Request body too large');
  if (!request.body) fail('INVALID_REQUEST', 'Missing request body');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > limit) { await reader.cancel(); fail('BODY_TOO_LARGE', 'Request body too large'); } chunks.push(value); } } finally { reader.releaseLock(); }
  const data = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)); } catch { return fail('INVALID_REQUEST', 'Invalid JSON'); }
}
export function safeError(error: unknown): { code: string; message: string } {
  if (error instanceof AssistError) {
    const allowed: Record<string, string> = { UNAUTHORIZED: 'Authentication required', FORBIDDEN: 'Not authorized', INVALID_REQUEST: 'Invalid request', BODY_TOO_LARGE: 'Request body too large', NOT_FOUND: 'Resource not found', RATE_LIMITED: 'Rate limit exceeded', CONCURRENCY_LIMIT: 'Concurrency limit exceeded', TIMEOUT: 'Request timed out', CANCELLED: 'Request cancelled', INVALID_OUTPUT: 'Invalid provider output', TOKEN_LIMIT: 'Token limit exceeded', REVISION_CONFLICT: 'Form revision has changed' };
    if (allowed[error.code]) return { code: error.code, message: allowed[error.code]! };
  }
  return { code: 'INTERNAL_ERROR', message: 'Request failed' };
}
export function errorResponse(error: unknown): Response {
  const safe = safeError(error); const status: Record<string, number> = { UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, INVALID_REQUEST: 400, BODY_TOO_LARGE: 413, RATE_LIMITED: 429, CONCURRENCY_LIMIT: 429, TIMEOUT: 504, CANCELLED: 499, INVALID_OUTPUT: 502, TOKEN_LIMIT: 413, REVISION_CONFLICT: 409 };
  return Response.json({ error: safe }, { status: status[safe.code] ?? 500, headers: { 'cache-control': 'no-store' } });
}
export function createAssistantServer(config: ServerConfig) {
  if (!config.authorize || !config.getContext) throw new Error('authorize and getContext are required');
  const limits = { maxBodyBytes: 256_000, maxOutputBytes: 256_000, maxFields: 200, timeoutMs: 30_000, maxConcurrent: 10, requestsPerMinute: 60, maxInputTokens: 32_000, maxOutputTokens: 8_000, ...config.limits };
  for (const value of Object.values(limits)) if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid server limit');
  const active = new Map<string, number>(); const rates = new Map<string, number[]>();
  async function propose(request: ProposeRequest, context: ServerContext, signal?: AbortSignal): Promise<ChangePlan> {
    contextValid(context);
    if (!request || request.protocolVersion !== '1' || typeof request.requestId !== 'string' || !request.requestId || typeof request.formId !== 'string' || typeof request.baseRevision !== 'string' || typeof request.prompt !== 'string' || typeof request.connectionId !== 'string' || typeof request.model !== 'string' || !request.values || typeof request.values !== 'object' || Array.isArray(request.values)) fail('INVALID_REQUEST', 'Invalid request');
    if (size(request) > limits.maxBodyBytes) fail('BODY_TOO_LARGE', 'Request body too large');
    const registered = Object.hasOwn(config.forms, request.formId) ? config.forms[request.formId] : undefined;
    const connection = Object.hasOwn(config.connections, request.connectionId) ? config.connections[request.connectionId] : undefined;
    if (!registered || !connection) fail('NOT_FOUND', 'Resource not found');
    const provider = 'provider' in connection ? connection.provider : connection;
    const models = 'provider' in connection ? connection.models : config.allowedModels?.[request.connectionId];
    if (!models?.includes(request.model)) fail('FORBIDDEN', 'Model not allowed');
    if (!await config.authorize(context, 'propose', request.formId) || !await config.authorize(context, 'propose', request.connectionId)) fail('FORBIDDEN', 'Not authorized');
    if (registered.fields.length > limits.maxFields) fail('INVALID_REQUEST', 'Too many fields');
    const resolved = config.resolveForm ? await config.resolveForm(request.formId, context) : undefined;
    if (config.resolveForm && !resolved) fail('NOT_FOUND', 'Resource not found');
    if (resolved && (resolved.formId !== registered.formId || resolved.schemaVersion !== registered.schemaVersion || resolved.revision !== request.baseRevision)) fail('REVISION_CONFLICT', 'Form revision has changed');
    const authoritative = { ...registered, values: resolved?.values ?? registered.values };
    const form = structuredClone({ ...authoritative, revision: request.baseRevision, values: mergeValues(authoritative, request.values) });
    try { validateForm(form); } catch { fail('INVALID_REQUEST', 'Invalid form values'); }
    const modelForm = contextForModel(form);
    // Only forward the protocol fields; caller-supplied schema, tenant or credential fields are ignored.
    const modelRequest: ProposeRequest = { protocolVersion: '1', requestId: request.requestId, formId: request.formId, baseRevision: request.baseRevision, values: modelForm.values, prompt: request.prompt, connectionId: request.connectionId, model: request.model };
    if (size({ form: modelForm, request: modelRequest }) > limits.maxInputTokens) fail('TOKEN_LIMIT', 'Input too large');
    const now = Date.now(); const recent = (rates.get(context.tenantId) ?? []).filter(t => t > now - 60_000);
    if (recent.length >= limits.requestsPerMinute) fail('RATE_LIMITED', 'Rate limit exceeded');
    if ((active.get(context.tenantId) ?? 0) >= limits.maxConcurrent) fail('CONCURRENCY_LIMIT', 'Concurrency limit exceeded');
    recent.push(now); rates.set(context.tenantId, recent); active.set(context.tenantId, (active.get(context.tenantId) ?? 0) + 1);
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
    try {
      if (signal?.aborted) fail('CANCELLED', 'Request cancelled');
      const interruption = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new AssistError(signal?.aborted ? 'CANCELLED' : 'TIMEOUT', 'Interrupted')), { once: true });
        timer = setTimeout(() => controller.abort(), limits.timeoutMs);
      });
      const result = await Promise.race([provider.propose({ form: modelForm, request: modelRequest, signal: controller.signal }), interruption]);
      if (!result || size(result.plan) > limits.maxOutputBytes || size(result.plan) > limits.maxOutputTokens || (result.usage?.outputTokens ?? 0) > limits.maxOutputTokens || (result.usage?.inputTokens ?? 0) > limits.maxInputTokens) fail('INVALID_OUTPUT', 'Invalid provider output');
      if (result.plan.requestId !== request.requestId || result.plan.formId !== request.formId || result.plan.baseRevision !== request.baseRevision || result.plan.protocolVersion !== '1') fail('INVALID_OUTPUT', 'Invalid provider output');
      try { validatePlan(form, result.plan); } catch { fail('INVALID_OUTPUT', 'Invalid provider output'); }
      return result.plan;
    } finally { if (timer) clearTimeout(timer); signal?.removeEventListener('abort', abort); const count = (active.get(context.tenantId) ?? 1) - 1; if (count) active.set(context.tenantId, count); else active.delete(context.tenantId); }
  }
  async function handle(request: Request): Promise<Response> {
    try {
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
      const context = await config.getContext(request); contextValid(context);
      const body = await readBody(request, limits.maxBodyBytes) as ProposeRequest;
      if (request.headers.get('accept')?.includes('application/x-ndjson')) {
        const plan = await propose(body, context, request.signal);
        const event = { protocolVersion: '1', requestId: plan.requestId, type: 'result', plan };
        return new Response(JSON.stringify(event) + '\n', { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
      }
      return Response.json(await propose(body, context, request.signal), { headers: { 'cache-control': 'no-store' } });
    } catch (error) { return errorResponse(error); }
  }
  return { propose, handle };
}
export * from './credentials.js';
