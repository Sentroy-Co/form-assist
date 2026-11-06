export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonSchema = Record<string, unknown>;
export interface FieldOption { label: string; value: JsonValue }
export interface FieldPolicy {
  path: string; description?: string; aiWritable: boolean; readOnly?: boolean;
  sensitive?: boolean; hidden?: boolean; inputType?: string;
  options?: FieldOption[]; dependsOn?: string[];
}
export interface FormSnapshot {
  formId: string; schemaVersion: string; revision: string;
  schema: JsonSchema; values: Record<string, JsonValue>; fields: FieldPolicy[];
}
export interface Change { op: 'add' | 'replace' | 'remove'; path: string; value?: JsonValue; reason?: string }
export interface ChangePlan {
  protocolVersion: '1'; requestId: string; formId: string; baseRevision: string;
  changes: Change[]; questions: string[]; warnings: string[];
}
export interface ProposeRequest {
  protocolVersion: '1'; requestId: string; formId: string; baseRevision: string;
  values: Record<string, JsonValue>; prompt: string; connectionId: string; model: string;
}
export interface UndoReceipt { before: FormSnapshot; after: FormSnapshot; changedPaths: string[] }
export interface ApplyResult { form: FormSnapshot; receipt: UndoReceipt }
export type OptionResolver = (field: FieldPolicy, form: FormSnapshot) => Promise<FieldOption[]>;
export interface StreamEvent {
  protocolVersion: '1'; requestId: string; type: 'start' | 'progress' | 'result' | 'error';
  plan?: ChangePlan; error?: { code: string; message: string }; message?: string;
}
export class AssistError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryAfterMs?: number) {
    super(message); this.name = 'AssistError';
  }
}
