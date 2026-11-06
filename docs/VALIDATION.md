# Local verification

Verified on 2026-11-06 with Node 24.19.0 on Linux x64. This is an unpublished first vertical release, with scope and limitations described below. No real provider keys were used and no package, site, API proxy or paid resource was published.

| Check | Result | Reproduce |
| --- | --- | --- |
| Strict TypeScript ESM build and declarations | Passed | `npm run build && npm run typecheck` |
| Core, server, credentials, providers, browser, adapters, UI, CLI and protocol fixtures | 60 tests passed across 12 files | `npm test` after build |
| Chromium desktop/mobile UI and axe accessibility | 14 passed, including all 54 live language switches and both themes | `npm run test:browser` |
| Next.js 16.4.5 production build | Passed | `NEXT_TELEMETRY_DISABLED=1 npm run build --prefix examples/next` |
| Real SSR/hydration + isolated two-form application | Passed | `npm run test:next` after Next build; starts and stops its own local server |
| Rust 1.99.1 client against real Node CLI | Passed with shared JSON fixtures | `npm run test:languages` with Cargo installed |
| C#/.NET SDK 8.0.427 client against real Node CLI | Passed with the same fixtures | `npm run test:languages` with .NET 8 installed |
| Clean tarball consumer | Installed into a new temporary npm project; exported modules imported; real plan applied | `npm run pack:local && npm run verify:package` |
| Browser/server boundaries | Server/provider entries rejected in browser builds; core/browser/UI contain no server graph; Workers graph bundles without Node storage | `npm run verify:package` |
| Bundle budgets | Measured minified + gzip bytes in [measurements.json](measurements.json) | `npm run verify:package` |
| Static launch production build | Passed under a `/form-assist/` subpath, including relative assets, locale chunks, review/apply and mobile RTL | `npm run build:demo && npm run verify:launch` |
| Local plan-validation performance | Measured 50 iterations, p50/p95 in [performance.json](performance.json) | `npm run measure:performance` |

The tests cover enum/schema boundaries, protected paths, prototype pollution, nested object/array projection, selected application, stale edits, conflict-safe undo, cancellation and late responses, HTTP 401/403/429/5xx, Retry-After and bounded retries, timeout including body reads, masked credentials, cross-tenant isolation, encrypted storage tampering/key rotation, actual controlled React/RHF setters, SSR-safe imports, two forms, IME, focus restore/trap, stacked dialogs, unmount cleanup, reduced motion, mobile geometry and safe rendering of hostile strings. CLI integration uses the built executable, not a mocked function.

Budget gates for independently bundled exports are **50,000 gzip bytes core**, **52,000 browser**, **15,000 initial UI**, **8,000 initial i18n**. Browser includes core; do not add those figures together. The UI can be omitted entirely for headless usage. UI and i18n measurements count the initial static module graph; 53 language catalogs are separate lazy chunks. This increases the previous 10,000-byte UI budget to accommodate automatic localization; it does not load every catalog up front. Core includes AJV and formats; this is the main size cost. The local `validatePlan` p95 budget is 100ms for the article fixture with one change. Measurements include machine/runtime context and are neither provider latency predictions nor mobile performance claims. No performance number is an estimate presented as a measurement.

Live provider and model interoperability remains unverified; all provider tests use controlled HTTP transports. Adapters advertise manual model selection, complete JSON responses and cancellation; token streaming, automatic model catalogs and native structured-output guarantees are not implemented. NDJSON reports lifecycle/complete-result events. Cloudflare Gateway supports the OpenAI upstream only. Strict gateway BYOK guarantees are rejected. See [PROVIDERS.md](PROVIDERS.md).

Workers deployment, Firefox/WebKit, physical mobile/screen-reader checks and other framework/UI ecosystems have not been exercised. Next fixture mode demonstrates hydration and binding, not real provider authorization. Rate/concurrency limits and encrypted file storage are process/local deployment tools; distributed hosting requires host session policies, CSRF/origin protection, shared quota coordination and an appropriate secret manager. Token limits use conservative serialized-byte bounds plus provider usage when available; they do not guarantee a provider-side billing ceiling. React/RHF async validation limitations are explicit in [BINDINGS.md](BINDINGS.md).

Credential management supports masked CRUD, a host-authorized opt-in paid test callback and encrypted persistence. The prepared credential UI handles one API-key field; multi-field gateway identity/secret forms need a host adapter. The package name/scope and license remain owner decisions before any release.

The launch page and all prepared components use 54 complete catalogs, browser preference negotiation, manual overrides and RTL. A complete proposal for every locale is checked against the real registered form schema and length limits. Browser tests exercise all 54 language switches; English, Arabic, Japanese, Traditional Chinese and unsupported browser preferences are separately exercised. Translation phrasing is machine-assisted and has not been reviewed by native speakers for all languages. Sentroy branding references and asset origins are in [BRAND.md](BRAND.md).
