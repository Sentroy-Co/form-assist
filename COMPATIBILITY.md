# Compatibility

Status reflects the exact versions and checks below. Mounting a Web Component does not bind framework-controlled widgets automatically. `tested` means the stated local checks passed; it does not imply all browsers, live providers or all accessibility technologies. A dash means no version was researched or installed. Planned integrations are not working examples.

| Layer | Target | Version | Status | Approach | Example | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| Web / SSR | Vanilla JS/TS | TS 5.9.3 / Chromium 158 | tested | Explicit form binding + Web Components | examples/demo | Playwright full flow + strict build |
| Web / SSR | React | 19.3.1 | tested | Controlled state hook; client registration | examples/next | Mounted state + real hydration tests |
| Web / SSR | Next.js | 16.4.5 | tested | Client effect + authenticated route factory | examples/next | Production build; SSR/hydration; two-form isolation |
| Web / SSR | React Router framework / Remix | — | planned | Explicit state binding + client registration | — | Not installed or exercised |
| Web / SSR | Vue / Nuxt | — | planned | Custom element + Vue state adapter | — | Not installed or exercised |
| Web / SSR | Angular | — | planned | CUSTOM_ELEMENTS_SCHEMA + form adapter | — | Not installed or exercised |
| Web / SSR | Svelte / SvelteKit | — | planned | Custom element + explicit state adapter | — | Not installed or exercised |
| Web / SSR | Solid / SolidStart | — | planned | Custom element + signal setter binding | — | Not installed or exercised |
| Web / SSR | Astro | — | planned | Client-only custom element + state binding | — | Not installed or exercised |
| Web / SSR | Lit / Web Components | Native elements / Chromium 158; Lit — | tested / planned | Shadow DOM elements tested; Lit wrapper planned | examples/demo | Playwright; Lit not installed |
| React UI | shadcn/ui + Radix | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| React UI | Material UI | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| React UI | Chakra UI | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| React UI | Mantine | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| React UI | Ant Design | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| React UI | Headless UI | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| Vue UI | Vuetify | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| Vue UI | PrimeVue | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| Vue UI | Quasar | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| Vue UI | Naive UI | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| Angular UI | Angular Material | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| Angular UI | PrimeNG | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| Angular UI | NG-ZORRO | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| Svelte UI | Skeleton | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| Svelte UI | shadcn-svelte | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| Svelte UI | Flowbite Svelte | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| CSS | Tailwind CSS | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| CSS | Bootstrap | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| CSS | daisyUI | — | planned | Shadow DOM isolation; widgets require explicit binding | — | Not installed or exercised |
| CSS | Plain CSS | Browser CSS / Chromium 158 | tested | Shadow DOM + custom properties | examples/demo | Desktop/mobile tests |
| Form state | Native HTML forms | Chromium 158 | tested | createNativeBinding, explicit form ref | tests/adapters.test.tsx | DOM binding tests |
| Form state | React Hook Form | 7.91.0 | tested | setValue + trigger per form | tests/adapters.test.tsx | Mounted RHF state test |
| Form state | Formik | — | planned | Explicit setter/validation binding | — | Not installed or exercised |
| Form state | TanStack Form | — | planned | Explicit store/validation binding | — | Not installed or exercised |
| Form state | VeeValidate | — | planned | Vue state adapter | — | Not installed or exercised |
| Form state | Angular Reactive Forms | — | planned | Angular form-group adapter | — | Not installed or exercised |
| Form state | SvelteKit Superforms | — | planned | Svelte store adapter | — | Not installed or exercised |
| Backend | Rust | 1.99.1 | tested | Node CLI process + serde | examples/rust | Real shared-fixture integration |
| Backend | ASP.NET Core / C# | .NET SDK 8.0.427; ASP.NET — | tested / planned | C# process client tested; ASP.NET host planned | examples/csharp | Real shared-fixture integration; ASP.NET untested |
| Backend | Cloudflare Workers | Web Request/Response | experimental | Portable handler + binding interface | examples/workers | Portable tests only; not deployed |

See [provider capabilities](docs/PROVIDERS.md) and [official documentation evidence](docs/PROVIDER-EVIDENCE.md). Firefox, WebKit, manual screen readers and real Workers deployment remain unverified.
