# Workers handler adapter

`createWorkerHandler(config)` returns a standard Web Request/Response `fetch` handler. Construct it with a `ServerConfig` whose `getContext` verifies the host session and whose `authorize` checks form and connection access. Supply a Workers-compatible provider and credential bindings on the server; do not import `server/node`. The host owns routing, origin/CSRF policy, durable shared rate limits where needed, and deployment. This adapter has not been deployed to a live Workers runtime.

For package conditional exports, enable the `workerd` resolution condition. Portable server and provider entries are available under that condition; `/server/node` is deliberately rejected. `npm run verify:package` checks this dependency graph without Node built-ins.
