# Public entry points and protocol

| Import | Purpose | Runtime |
| --- | --- | --- |
| `@sentroy-co/form-assist` or `/core` | Portable types, schema/plan validation, apply and undo | JS, no DOM/Node initialization |
| `/server` | Guarded proposal HTTP handler and credential API interfaces | Web APIs, Node 22+/Workers |
| `/server/node` | Encrypted filesystem credential storage | Node only |
| `/providers` | Fetch provider factories and capabilities | Server only; never expose keys to browser |
| `/browser` | Controller, bindings interface, HTTP transport | Browser, safe to import in SSR |
| `/native` | Explicitly selected native HTML form binding | Browser, safe to import in SSR |
| `/react` | Controlled React state hook | React peer dependency |
| `/react-hook-form` | RHF binding with setter and validation | React/RHF peers |
| `/i18n` | 54 typed lazy catalogs, browser preference detection, direction and locale negotiation | SSR-safe; browser detection only on call |
| `/ui` | Explicit Web Component registration and theme/i18n contracts | Browser, safe to import in SSR |

Use the generated `.d.ts` files as the exact API reference. Imports preserve ESM boundaries; core never imports UI, credentials, Node or a provider SDK. React and RHF are optional peers. Importing UI does not register elements; call `registerFormAssist()` after mount.

Browser builds reject `/server`, `/server/node` and `/providers` through conditional exports. Workers builds must enable the `workerd` resolution condition for the portable `/server` and `/providers` entries. `/server/node` stays unavailable there. The package verification script compiles that Workers graph without Node built-ins; this is a build check, not a deployed Workers test.

`FormSnapshot` includes `formId`, `schemaVersion`, opaque `revision`, JSON Schema 2020-12 `schema`, JSON `values` and explicit `fields` policies. Runtime option resolvers, setters and authorization callbacks are not serialized. Missing, null and empty string remain different values.

`ProposeRequest` has protocolVersion `1`, requestId, formId, baseRevision, values, prompt, connectionId and model. The browser only sends allowed model context. Server schema registration is authoritative. A `ChangePlan` has the same protocol/request/form/revision identifiers, changes, questions and warnings. Changes use JSON Pointers and add/replace/remove operations. Exact allowlisted paths are required. Overlapping changes and pollution keys are rejected. `add` inserts array elements or creates a missing object member; it does not overwrite an existing object member. `replace` and `remove` require existing targets. Final values are validated as a complete document, including selected subsets.

`validateForm(form)` and `validatePlan(form, plan)` throw `AssistError`. `applyPlan(form, plan, selectedPaths?)` returns a new form plus an undo receipt; inputs are not mutated. `undo(currentForm, receipt)` restores the last application only when touched values have not subsequently changed. Array edits use the entire array as the conflict unit. `contextForModel(form)` projects permitted data and excludes schema metadata and protected fields. `resolveOptions(form, resolver)` resolves options for fields declaring options/dependencies; hosts must rerun it before authoritative validation when dependencies change.

HTTP: POST an authenticated request to your host route; JSON returns a complete plan. `Accept: application/x-ndjson` returns a versioned result event with the same plan. This release does **not** expose token-by-token JSON generation. No partial proposal is applied to a form. Errors are sanitized JSON with code/message. See [openapi.json](openapi.json) and [SERVER.md](SERVER.md).

Fixtures: [article.json](../fixtures/article.json), [request.json](../fixtures/request.json), [plan.json](../fixtures/plan.json). These are examples, not hardcoded domain rules. Article slug and publication status are protected. The host owns all save/publish/payment/delete actions.
