#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { AssistError, type FormSnapshot, type ProposeRequest } from '../core/types.js';
import { validateForm } from '../core/index.js';
import { createAssistantServer } from '../server/index.js';
import type { Provider } from '../providers/types.js';
import { createOpenAIProvider, createAnthropicProvider, createGeminiProvider, createWorkersAIProvider, createCloudflareGatewayProvider, createVercelGatewayProvider, createOpenAICompatibleProvider } from '../providers/index.js';

interface ConnectionConfig { type: string; credentialEnv?: string; models: string[]; [key: string]: unknown }
interface Config { forms: Record<string, FormSnapshot>; connections: Record<string, ConnectionConfig> }
const demoForm: FormSnapshot = { formId: 'demo', schemaVersion: '1', revision: '1', schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'], additionalProperties: false }, values: { title: 'Original' }, fields: [{ path: '/title', aiWritable: true }] };
const demoConfig: Config = { forms: { demo: demoForm }, connections: { demo: { type: 'demo', models: ['demo'] } } };
const demoProvider: Provider = { id: 'demo', capabilities: { authentication: 'none', modelListing: false, structuredOutput: true, streaming: false, cancellation: true, usage: false }, async propose({ request }) { return { plan: { protocolVersion: '1', requestId: request.requestId, formId: request.formId, baseRevision: request.baseRevision, changes: [], questions: [], warnings: ['Demo fixture: no changes were generated.'] } }; } };
function fail(code: string, message: string): never { throw new AssistError(code, message); }
function option(args: string[], name: string): string | undefined { const i = args.indexOf(name); if (i < 0) return undefined; const value = args[i + 1]; if (!value || value.startsWith('--')) fail('USAGE', `Missing value for ${name}`); if (args.indexOf(name, i + 1) !== -1) fail('USAGE', `Repeated ${name}`); return value; }
async function stdinJson(): Promise<unknown> { const chunks: Buffer[] = []; let size = 0; for await (const part of process.stdin) { const b = Buffer.from(part as Buffer); size += b.length; if (size > 256_000) fail('BODY_TOO_LARGE', 'Input too large'); chunks.push(b); } try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return fail('INVALID_REQUEST', 'Invalid JSON input'); } }
async function config(args: string[]): Promise<Config> { if (option(args, '--fixture') === 'demo') return demoConfig; if (args.includes('--fixture')) fail('USAGE', 'Unknown fixture'); try { const parsed: unknown = JSON.parse(await readFile(option(args, '--config') ?? 'form-assist.config.json', 'utf8')); if (!parsed || typeof parsed !== 'object' || !('forms' in parsed) || !('connections' in parsed)) throw new Error(); return parsed as Config; } catch { return fail('CONFIG_ERROR', 'Could not read configuration'); } }
function json(value: unknown): void { process.stdout.write(JSON.stringify(value) + '\n'); }
const codes: Record<string, number> = { USAGE: 2, INVALID_REQUEST: 2, BODY_TOO_LARGE: 2, CONFIG_ERROR: 3, NOT_FOUND: 3, FORBIDDEN: 4, UNAUTHORIZED: 4, TIMEOUT: 5, CANCELLED: 130, RATE_LIMITED: 6, INVALID_OUTPUT: 7 };
async function main(args: string[], signal: AbortSignal): Promise<void> {
 const valueOptions = new Set(['--config', '--fixture', '--connection', '--model']); const flags = new Set(['--stdin', '--json', '--stream']);
 for (let i = 0; i < args.length; i++) { const arg = args[i]!; if (arg.startsWith('--')) { if (valueOptions.has(arg)) { if (!args[i + 1] || args[i + 1]!.startsWith('--')) fail('USAGE', 'Missing option value'); i++; } else if (!flags.has(arg)) fail('USAGE', 'Unknown option'); } }
 const command = args.filter((s, i) => !s.startsWith('--') && (i === 0 || !args[i - 1]?.startsWith('--'))).slice(0, 2).join(' ');
 if (args.includes('--json') && args.includes('--stream')) fail('USAGE', 'Choose --json or --stream');
 if (command === 'init') { const path = option(args, '--config') ?? 'form-assist.config.json'; try { await writeFile(path, JSON.stringify({ forms: { demo: demoForm }, connections: {} }, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); } catch { fail('CONFIG_ERROR', 'Could not create configuration'); } process.stderr.write(`Created ${path}\n`); return; }
 if (command === 'validate-schema') { if (!args.includes('--stdin')) fail('USAGE', '--stdin is required'); try { validateForm(await stdinJson() as FormSnapshot); } catch { fail('INVALID_REQUEST', 'Invalid form snapshot'); } json({ valid: true }); return; }
 if (command === 'doctor') { json({ protocolVersion: '1', node: process.version, status: 'ok' }); return; }
 const cfg = await config(args);
 if (command === 'connections list') { json(Object.entries(cfg.connections).map(([id, c]) => ({ id, type: c.type, models: c.models }))); return; }
 const id = option(args, '--connection'); if (!id || !Object.hasOwn(cfg.connections, id)) fail('NOT_FOUND', 'Connection not found'); const connection = cfg.connections[id]!;
 if (!Array.isArray(connection.models) || !connection.models.every(m => typeof m === 'string')) fail('CONFIG_ERROR', 'Invalid model allowlist');
 if (command === 'models list') { json(connection.models); return; }
 if (command !== 'propose' || !args.includes('--stdin') || (!args.includes('--json') && !args.includes('--stream'))) fail('USAGE', 'Unknown command or missing options');
 const model = option(args, '--model'); if (!model) fail('USAGE', '--model is required');
 const input = await stdinJson() as ProposeRequest;
 if (!input || typeof input !== 'object' || (input.connectionId !== undefined && input.connectionId !== id) || (input.model !== undefined && input.model !== model)) fail('INVALID_REQUEST', 'Connection or model mismatch');
 const request = { ...input, connectionId: id, model };
 let provider: Provider;
 if (connection.type === 'demo' && option(args, '--fixture') === 'demo') provider = demoProvider;
 else provider = await createConfiguredProvider(id, connection);
 const server = createAssistantServer({ forms: cfg.forms, connections: { [id]: { provider, models: connection.models } }, authorize: () => true, getContext: async () => ({ tenantId: 'local-cli' }) });
 if (args.includes('--stream')) json({ protocolVersion: '1', requestId: request.requestId, type: 'start' });
 try { const plan = await server.propose(request, { tenantId: 'local-cli' }, signal); if (args.includes('--stream')) json({ protocolVersion: '1', requestId: request.requestId, type: 'result', plan }); else json(plan); }
 catch (error) { if (args.includes('--stream')) { const safe = safeError(error); json({ protocolVersion: '1', requestId: typeof request.requestId === 'string' ? request.requestId : '', type: 'error', error: safe }); process.exitCode = codes[safe.code] ?? 1; return; } throw error; }
}
async function createConfiguredProvider(id: string, c: ConnectionConfig): Promise<Provider> {
 const env = (name: unknown): string => { if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || !process.env[name]) return fail('CONFIG_ERROR', 'Missing credential environment variable'); return process.env[name]!; };
 const string = (v: unknown): string => { if (typeof v !== 'string' || !v) return fail('CONFIG_ERROR', 'Missing provider setting'); return v; };
 const apiKey = env(c.credentialEnv);
 switch (c.type) {
  case 'openai': return createOpenAIProvider({ id, apiKey });
  case 'anthropic': return createAnthropicProvider({ id, apiKey });
  case 'gemini': return createGeminiProvider({ id, apiKey });
  case 'workers-ai': return createWorkersAIProvider({ id, apiKey, accountId: string(c.accountId) });
  case 'cloudflare-gateway': return createCloudflareGatewayProvider({ id, apiKey, accountId: string(c.accountId), gatewayId: string(c.gatewayId), upstream: string(c.upstream), ...(c.upstreamCredentialEnv ? { upstreamApiKey: env(c.upstreamCredentialEnv) } : {}) });
  case 'vercel-gateway': return createVercelGatewayProvider({ id, apiKey });
  case 'openai-compatible': { if (!Array.isArray(c.allowedHosts) || !c.allowedHosts.every(v => typeof v === 'string')) return fail('CONFIG_ERROR', 'Missing host allowlist'); return createOpenAICompatibleProvider({ id, apiKey, endpoint: string(c.endpoint), allowedHosts: c.allowedHosts as string[] }); }
  default: return fail('CONFIG_ERROR', 'Unsupported provider configuration');
 }
}
function safeError(error: unknown): { code: string; message: string } { const code = error instanceof AssistError ? error.code : 'INTERNAL_ERROR'; const messages: Record<string, string> = { USAGE: 'Invalid command or options', INVALID_REQUEST: 'Invalid request', BODY_TOO_LARGE: 'Input too large', CONFIG_ERROR: 'Invalid configuration', NOT_FOUND: 'Resource not found', FORBIDDEN: 'Not authorized', UNAUTHORIZED: 'Authentication required', TIMEOUT: 'Request timed out', CANCELLED: 'Request cancelled', RATE_LIMITED: 'Rate limit exceeded', INVALID_OUTPUT: 'Invalid provider output' }; return { code, message: messages[code] ?? 'Request failed' }; }
const controller = new AbortController(); process.once('SIGINT', () => controller.abort()); process.stdout.on('error', (error: NodeJS.ErrnoException) => { if (error.code === 'EPIPE') { controller.abort(); process.exit(0); } });
main(process.argv.slice(2), controller.signal).catch(error => { const safe = safeError(error); json({ error: safe }); process.exitCode = codes[safe.code] ?? 1; });
