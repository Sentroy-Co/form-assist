# Ready-made UI

Importing `@sentroy-co/form-assist/ui` is safe during SSR. Call `registerFormAssist()` in the browser, then set the controller as a property. The browser and UI entry points are independent; no provider credential belongs in either.

```js
import { registerFormAssist } from '@sentroy-co/form-assist/ui';
registerFormAssist();
const spotlight = document.querySelector('form-assist-spotlight');
spotlight.controller = controller;
spotlight.examples = ['Bu notlardan bir taslak oluştur'];
const button = document.querySelector('form-assist-button');
button.spotlight = spotlight;
```

The button can instead use `for="spotlight-id"`, or create its own spotlight when given a controller. Both expose `open()`, `close()` and `toggle()`. Spotlight properties include `messages` (partial replacement of `turkishMessages`), `examples`, `scope` (`viewport` by default or `container`), `portalRoot`, `zIndex`, and an optional `shortcut` such as `Ctrl+Shift+k`. No shortcut is installed by default. For container scope, position the containing element (for example `position: relative`) and place the spotlight there; use `portalRoot` when it must render in another element. Set configuration properties before opening. The host may style `--fa-radius`, `--fa-accent`, `--fa-text`, `--fa-muted`, `--fa-surface`, `--fa-density` and `--fa-z-index`, and `::part(button)`, `::part(icon)`, `::part(overlay)` and `::part(panel)`.

The review presents old and proposed values as escaped plain text, including Markdown source, and never interprets HTML. Select individual fields before applying. The controller validates the result and handles conflicts and undo; the UI does not submit the host form. The non-streaming browser controller currently provides generation state, cancellation and retry, rather than token streaming.

## Credential administration

`form-assist-credentials` is an optional admin component. Assign an authenticated `CredentialManagerAdapter` property before connecting it, then call `refresh()` after changing the adapter. Its list returns masked summaries only; create/update accept a secret transiently, and delete/test use an ID. The adapter must call an application-protected server endpoint using the host session and authorization. It must never store secrets in HTML, localStorage, client configuration, logs, or read responses. The test action explicitly asks for confirmation because it can incur real provider charges. The application is responsible for access control, CSRF protection and mapping this callback contract to its server's management API.

The built-in HTTP adapter maps directly to `createCredentialManager` routes:

```js
import { registerFormAssist, createCredentialHttpAdapter } from '@sentroy-co/form-assist/ui';
registerFormAssist();
const admin = document.querySelector('form-assist-credentials');
admin.adapter = createCredentialHttpAdapter('/api/admin/credentials');
await admin.refresh();
```

The endpoint must be mounted with server-side session-based authorization. Provide a CSRF-aware fetch as the second argument if required. The helper maps the single entered key to `secrets.apiKey`; providers requiring multiple secret fields need a custom adapter and admin form. Set the `styleNonce` property before connecting each component when a CSP nonce is required for its shadow style. Customize the button icon with a child bearing `slot="icon"`.

## Language and appearance

Each element has an optional `locale` property (for example, `element.locale = 'ar'`). If unset, its `lang` attribute is used; without either, it follows `navigator.languages` and responds to browser `languagechange` events. Unsupported languages fall back to English. Catalogs load on demand; await `element.updateComplete` after connecting or changing a locale, or listen for `localechange`. Shadow content receives the appropriate language and text direction. `messages` remains a partial override across language changes, and `turkishMessages` remains available for existing consumers. The input draft and credential edits are retained when the language changes.

Set `data-theme="dark"` or `data-theme="light"` on each component; without it the components follow the system color scheme. An owned spotlight inherits the button's theme and locale. Existing custom properties can override palette details.
