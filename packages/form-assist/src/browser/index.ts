import { applyPlan, contextForModel, undo as undoPlan, validatePlan } from '../core/index.js';
import { AssistError } from '../core/types.js';
import type { ChangePlan, FormSnapshot, ProposeRequest, UndoReceipt } from '../core/types.js';

/** A write must compare expected with the current state immediately before committing. */
export interface FormBinding {
  read(): FormSnapshot;
  write(next: FormSnapshot, changedPaths: string[], expected?: FormSnapshot): void | Promise<void>;
  subscribe?(listener: () => void): () => void;
}
export type AssistantStatus = 'idle' | 'generating' | 'review' | 'applied' | 'error' | 'conflict' | 'cancelled';
export interface AssistantState { status: AssistantStatus; form: FormSnapshot; plan?: ChangePlan; error?: { code: string; message: string } }
export type AssistantTransport = (request: ProposeRequest, signal: AbortSignal) => Promise<ChangePlan>;
export interface AssistantOptions { binding: FormBinding; transport: AssistantTransport; connectionId: string; model: string }
export interface AssistantController {
  getSnapshot(): AssistantState; subscribe(listener: () => void): () => void;
  propose(prompt: string): Promise<void>; apply(paths?: string[]): Promise<void>; undo(): Promise<void>;
  cancel(): void; dispose(): void;
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function sameSnapshot(a: FormSnapshot, b: FormSnapshot): boolean { return stable(a) === stable(b); }
function fail(code: string, message: string): never { throw new AssistError(code, message); }
export function createAssistant({ binding, transport, connectionId, model }: AssistantOptions): AssistantController {
  let state: AssistantState = { status: 'idle', form: clone(binding.read()) };
  let receipt: UndoReceipt | undefined;
  let current: AbortController | undefined;
  let generation = 0, disposed = false, writing = false;
  const listeners = new Set<() => void>();
  const emit = (next: AssistantState) => { if (disposed) return; state = next; for (const listener of listeners) listener(); };
  const change = () => {
    if (disposed || writing) return;
    const form = clone(binding.read());
    if (sameSnapshot(form, state.form)) return;
    if (state.status === 'generating' || state.status === 'review') {
      current?.abort(); generation++;
      emit({ status: 'conflict', form, error: { code: 'CONFLICT', message: 'The form changed. Generate a new proposal.' } });
    } else emit({ ...state, form });
  };
  const unsubscribe = binding.subscribe?.(change);
  const report = (error: unknown) => {
    const e = error instanceof AssistError ? error : new AssistError('ERROR', error instanceof Error ? error.message : 'Operation failed');
    emit({ status: e.code === 'CONFLICT' || e.code === 'REVISION_CONFLICT' || e.code === 'UNDO_CONFLICT' ? 'conflict' : 'error', form: clone(binding.read()), error: { code: e.code, message: e.message } });
  };
  return {
    getSnapshot: () => state,
    subscribe(listener) { if (disposed) return () => {}; listeners.add(listener); return () => listeners.delete(listener); },
    async propose(prompt) {
      if (disposed) return;
      current?.abort(); const token = ++generation; const controller = new AbortController(); current = controller;
      const form = clone(binding.read()); emit({ status: 'generating', form });
      try {
        const context = contextForModel(form);
        const request: ProposeRequest = { protocolVersion: '1', requestId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, formId: form.formId, baseRevision: form.revision, values: context.values, prompt, connectionId, model };
        const plan = await transport(request, controller.signal);
        if (disposed || token !== generation || controller.signal.aborted) return;
        const latest = clone(binding.read());
        if (!sameSnapshot(form, latest)) fail('CONFLICT', 'The form changed. Generate a new proposal.');
        if (plan.requestId !== request.requestId) fail('INVALID_PLAN', 'Proposal request ID does not match.');
        validatePlan(latest, plan);
        emit({ status: 'review', form: latest, plan });
      } catch (e) { if (!disposed && token === generation && !controller.signal.aborted) report(e); }
      finally { if (current === controller) current = undefined; }
    },
    async apply(paths) {
      if (disposed) return;
      try {
        if (state.status !== 'review' || !state.plan) fail('INVALID_STATE', 'There is no proposal to apply.');
        const before = clone(binding.read());
        if (!sameSnapshot(before, state.form)) fail('CONFLICT', 'The form changed. Generate a new proposal.');
        const result = applyPlan(before, state.plan, paths);
        writing = true;
        try { await binding.write(clone(result.form), result.receipt.changedPaths, before); } finally { writing = false; }
        const after = clone(binding.read());
        if (!sameSnapshot(after, result.form)) fail('CONFLICT', 'The form changed during application.');
        receipt = result.receipt; emit({ status: 'applied', form: after });
      } catch (e) { report(e); }
    },
    async undo() {
      if (disposed) return;
      try {
        if (!receipt) fail('INVALID_STATE', 'There is no application to undo.');
        const before = clone(binding.read()); const next = undoPlan(before, receipt);
        writing = true;
        try { await binding.write(clone(next), receipt.changedPaths, before); } finally { writing = false; }
        const after = clone(binding.read());
        if (!sameSnapshot(after, next)) fail('CONFLICT', 'The form changed during undo.');
        receipt = undefined; emit({ status: 'idle', form: after });
      } catch (e) { report(e); }
    },
    cancel() { if (disposed) return; current?.abort(); current = undefined; generation++; emit({ status: 'cancelled', form: clone(binding.read()) }); },
    dispose() { if (disposed) return; current?.abort(); generation++; disposed = true; unsubscribe?.(); listeners.clear(); },
  };
}
export function createHttpTransport(endpoint: string, fetchImpl: typeof fetch = globalThis.fetch, maxBytes = 1_000_000): AssistantTransport {
  return async (request, signal) => {
    const body = JSON.stringify(request);
    if (new TextEncoder().encode(body).byteLength > maxBytes) fail('LIMIT_EXCEEDED', 'Request is too large.');
    const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body, signal });
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > maxBytes) fail('LIMIT_EXCEEDED', 'Response is too large.');
    if (!response.ok) throw new AssistError(`HTTP_${response.status}`, `Request failed (${response.status}).`);
    if (!response.body) fail('INVALID_RESPONSE', 'Empty response.');
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBytes) { await reader.cancel(); fail('LIMIT_EXCEEDED', 'Response is too large.'); } chunks.push(value); } } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder().decode(bytes)) as ChangePlan; } catch { return fail('INVALID_RESPONSE', 'Response is not valid JSON.'); }
  };
}
