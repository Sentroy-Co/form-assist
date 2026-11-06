# Quickstart

1. Run `npm ci && npm run build && npm test` in the repository.
2. Run `npm run demo` and open http://localhost:5173. Click **AI ile düzenle**, enter a command, review individual proposals, select fields and apply. Editing the form during generation produces a conflict. Undo will not overwrite later user edits. The demo response is a fixed fixture, explicitly labelled; it does not interpret your command.
3. Run `npm run pack:local` and install the tarball from `artifacts/` in your host project.
4. Register a form schema and allowed connection/model IDs in your authenticated server. Read [SERVER.md](SERVER.md) for authorization and tenant boundaries. Supply a verified model ID from your provider's current catalog; no model family is hardcoded.
5. Create a native or controlled state binding using [BINDINGS.md](BINDINGS.md). Create the browser controller with your endpoint, connection ID and model. Never provide a provider key to the browser controller or UI.
6. Register the UI on the client and attach the controller. For Next.js, register in `useEffect` in a client component; render an empty host ref server-side. Use the framework-independent server handler from an authenticated route. Examples are in [examples/next](../examples/next) and [examples/workers](../examples/workers).

Start headless by importing only `/browser` and subscribing to the controller. UI styles are not included unless you import and register `/ui`. Theme variables and accessible keyboard behavior are described in [UI.md](UI.md).

For CLI-only use:

```sh
node packages/form-assist/dist/cli/index.js init
node packages/form-assist/dist/cli/index.js doctor --json
node packages/form-assist/dist/cli/index.js validate-schema --stdin < fixtures/article.json
```

See [CLI.md](CLI.md) for the exact configuration and fixture request format; `init` writes a configuration only when a file does not already exist. Normal CLI stdout is machine-readable JSON; logs go to stderr. Rust and C# clients invoke the same CLI protocol with argument lists rather than shell commands.
