# Next.js fixture example

Build the package first (`npm run build` from the repository root), then run `npm run dev --prefix examples/next` and visit http://localhost:3001. The page server-renders two controlled forms; each mounts an independent Web Component after hydration. Suggestions are fixed local fixtures: no credentials, provider, or API call is involved.

`lib/route-adapter.ts` illustrates the authenticated server route boundary. A host can create its own `app/api/assist/route.ts` exporting `POST = makeAuthenticatedPost(config)`, where `config.getContext` derives the tenant from a verified server session and `config.authorize` checks access to both form and connection. Provide registered schemas, server-only providers, model allowlists and CSRF/origin protections appropriate to the session. No public proxy route is installed by this example.

Verified locally with Next.js 16.4.5: `npm run build --prefix examples/next` succeeds, and `npm run test:next` passes against a self-managed production server on port 3002 with Playwright Chromium installed. Set `CHROMIUM_PATH` if Playwright's default browser executable is unavailable. The check verifies server-rendered form text, hydration without browser errors, proposal application, and isolation of the second form.
