# Provider adapters

Import factories from `@sentroy-co/form-assist/providers` only on the server. Supply an explicit model ID on each authorized request and resolve credentials on the server. No SDK or model catalog is bundled. `listModels` is not implemented; configure and allowlist model IDs externally. No adapter streams. All use a bounded JSON-text response and the server must validate the plan against the registered form. Native structured-schema enforcement is not claimed. `usage` is not returned. Never put credentials in the browser, prompts, logs, or CLI arguments.

| Factory | Authentication | Transport and limits |
| --- | --- | --- |
| `createOpenAIProvider` | API key | Chat Completions |
| `createAnthropicProvider` | API key | Messages API |
| `createGeminiProvider` | AI Studio API key | generateContent JSON MIME mode; model must support it |
| `createWorkersAIProvider` | Workers binding or account ID and API token | Workers AI run; model must accept chat messages and return a `response` string |
| `createCloudflareGatewayProvider` | Gateway token and optional separate upstream API key | OpenAI upstream route only; the selected model must support chat completions. Gateway-managed BYOK depends on gateway configuration. |
| `createVercelGatewayProvider` | Gateway credential | OpenAI-compatible chat completions; model is gateway model ID |
| `createOpenAICompatibleProvider` | Bearer API key | Explicit HTTPS endpoint and exact `allowedHosts` list; chat-completions subset only. Host operators must also enforce DNS/egress policy against rebinding and private-address resolution. Redirects are rejected. |

Each accepts an `id`; fetch adapters accept `fetch`, `timeoutMs` (default 30 seconds, max 300 seconds) and `maxRetries` (default one, maximum three). HTTP 429 and 5xx are retried within the same timeout; Retry-After is honored within the timeout budget; a delay exceeding the budget is returned to the caller without retrying. Other HTTP failures, malformed output, timeout and cancellation become sanitized errors. Requests never silently select a different provider or credential. Binding calls are bounded by the same timeout and receive an abort signal; stopping underlying work depends on the runtime honoring that signal.

Gateway routing, caching, upstream fallback, retention and billing are controlled by the gateway, not this package. Vercel documents possible fallback to system credentials when BYOK fails. `strictByok: true` is rejected for both gateway adapters because this implementation cannot prove exclusive upstream credentials. Use a direct provider if strict credential or budget isolation is required. Gateway operators must configure authentication and upstream routing before use.

Provider results and availability vary by model; no live provider tests were run. Only mock transport contracts have been tested. The adapters do not provide model discovery, streaming, token usage reporting, arbitrary tools, or a general OpenAI compatibility guarantee.
