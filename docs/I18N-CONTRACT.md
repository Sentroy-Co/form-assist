# Localization implementation contract

All code under packages/form-assist/src/i18n. Canonical keys/types are in types.ts and English values in en.ts. Each language gets its own locales/<locale>.ts default export object `satisfies Catalog` imported type-only from ../types.js. ALL UI and demo keys must be translated with real language-specific text, including warnings, accessibility and fixed fixture prose. Never fill missing entries with English spreads, numbered locale prefixes, or generic same-string placeholders. Brand/protocol names can remain unchanged. Use proper Unicode and natural text. Preserve fixtureBody Markdown structure. No HTML in translated values.

Engine agent owns index.ts, registry.ts and tests/i18n*.test.ts docs/I18N.md. API: supportedLocales metadata [{code,name,dir}], resolveLocale(preferences:readonly string[]): SupportedLocale, detectLocale():SupportedLocale (SSR safe, only reads navigator on call), loadCatalog(locale:string):Promise<Catalog>, englishCatalog sync export, direction(locale):ltr|rtl. Explicit locale setter normalizes aliases; auto mode reads navigator.languages with languagechange listener. Lazy import each locale; no module-level browser globals. Concurrent loading cached; unsupported => en. zh-TW/HK/Hant => zh-TW, otherwise zh-CN; pt-*=>pt, no->nb, iw->he, in->id, tl->fil.

UI element .locale string | undefined; undefined means automatic browser detection, `lang` attribute supported. .messages partial overrides catalog UI and persists across locale changes. Three components (button/spotlight/credentials) all update language with race protection and cleanup. Set Shadow DOM lang/dir. Initial English fallback while lazy catalog loads, user can await .updateComplete or localechange event for tests (coordinate). Existing turkishMessages export preserved via locale module or deprecate with backward compatibility. Theme dark supports host data-theme or color-scheme.

Demo uses same loadCatalog and metadata, renders ALL static labels/placeholders/nav/fixture/reason/status messages through catalog, HTML lang+dir, auto/manual language selector and browser languagechange. Changing language must not erase user form edits or active proposals (fixture generated at request-time locale). Initial title may translate only if unedited; empty fields unchanged. Default dark atmospheric launch page, light toggle, pointer-follow grid, reduced-motion/touch/visibility cleanup. Logo assets root copies to examples/demo/public/brand. Repo URL https://github.com/Sentroy-Co/form-assist. Retain underlying selected apply/undo/cancel/conflict behavior and native form names for existing tests.

Locale ownership (54 total incl English):
- core agent: tr es fr de it pt nl pl cs hu ro uk ru sv da nb fi el sr
- server agent: ar he fa ur hi bn ta te mr zh-CN zh-TW ja ko th vi id ms fil ne
- providers agent: sk bg hr sl ca et lv lt is sq mk sw af eu gl

Root handles package exports/scripts, README, assets, repo publishing and final checks. Do not change root config independently.
