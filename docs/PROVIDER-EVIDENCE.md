# Provider evidence

Accessed 2026-11-06. Documentation was reachable; no credentialed or paid live requests were made. Model IDs are deliberately not embedded. Consult current documentation and configure supported IDs per deployment.

- [OpenAI Chat Completions API](https://platform.openai.com/docs/api-reference/chat/create), [authentication and key security](https://developers.openai.com/api/reference/overview).
- [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages), [API keys](https://platform.claude.com/docs/en/get-api-key).
- [Gemini generateContent API](https://ai.google.dev/api/generate-content), [API key](https://ai.google.dev/gemini-api/docs/api-key).
- [Cloudflare Workers AI REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/), [Workers AI binding](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/).
- [Cloudflare AI Gateway providers](https://developers.cloudflare.com/ai-gateway/usage/providers/), [BYOK](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/).
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), [BYOK and fallback](https://vercel.com/docs/ai-gateway/authentication-and-byok/byok).

These references establish intended API shapes, not proof that every model, account configuration, gateway upstream, or provider feature works with this adapter. Mock contract tests do not establish live interoperability.
