import type { ChangePlan, FormSnapshot, ProposeRequest } from '../core/types.js';
export interface ProviderCapabilities {
  authentication: string; modelListing: boolean; structuredOutput: boolean;
  streaming: boolean; cancellation: boolean; usage: boolean;
}
export interface ProviderInput { form: FormSnapshot; request: ProposeRequest; signal?: AbortSignal }
export interface ProviderResult { plan: ChangePlan; usage?: { inputTokens?: number; outputTokens?: number } }
export interface Provider {
  id: string; capabilities: ProviderCapabilities;
  propose(input: ProviderInput): Promise<ProviderResult>;
  listModels?(signal?: AbortSignal): Promise<string[]>;
}
