# Contributing

Use Node 22+ and `npm ci` with the committed lockfile. Read the ADR and the public implementation contract before changing module boundaries. Keep DOM/React code out of core, Node imports out of the portable server entry, and credentials out of browser bundles. Add tests for behavioral boundaries, cancellation races, unsafe paths or tenant access when changing them.

Run `npm run build`, `npm run typecheck`, `npm test`, `npm run test:browser`, and `npm run pack:local`. The browser suite needs Playwright Chromium. `node scripts/verify-package.mjs` installs the generated tarball into a clean temporary consumer and verifies exports and runtime boundaries. Do not call real providers without deliberately supplied test credentials. Never print raw keys or form prompts in test output.

Update compatibility statuses only after actual versioned verification. Transport contract tests do not prove live provider behavior. Do not publish packages or deploy services without a separate explicit instruction from the owner. The repository is UNLICENSED until the owner chooses a release license.
