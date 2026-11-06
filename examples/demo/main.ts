import { createAssistant } from '../../packages/form-assist/src/browser/index.js';
import { registerFormAssist, type FormAssistButton, type FormAssistSpotlight } from '../../packages/form-assist/src/ui/index.js';
import { detectLocale, direction, englishCatalog, loadCatalog, supportedLocales, type Catalog } from '../../packages/form-assist/src/i18n/index.js';
import type { FormSnapshot, ProposeRequest, ChangePlan } from '../../packages/form-assist/src/core/index.js';
import fixture from '../../fixtures/article.json';

registerFormAssist();
const element = document.querySelector<HTMLFormElement>('#article')!;
const title = element.elements.namedItem('title') as HTMLInputElement;
const spotlight = document.querySelector<FormAssistSpotlight>('#assistant')!;
const assistantButton = document.querySelector<FormAssistButton>('form-assist-button')!;
const selector = document.querySelector<HTMLSelectElement>('#locale')!;
const theme = document.querySelector<HTMLButtonElement>('#theme')!;
const status = document.querySelector<HTMLElement>('#status')!;
let catalog: Catalog = englishCatalog;
let form = structuredClone(fixture) as FormSnapshot;
let titleTouched = false, localeSequence = 0, selectedLocale = 'auto';
const listeners = new Set<() => void>();
selector.append(new Option('', 'auto'));
for (const locale of supportedLocales) selector.append(new Option(locale.name, locale.code));
element.addEventListener('submit', event => event.preventDefault());
element.addEventListener('input', event => {
  if (event.target === title) titleTouched = true;
  for (const control of Array.from(element.elements)) {
    if ((control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) && control.name in form.values) form.values[control.name] = control.value;
  }
  form.revision = crypto.randomUUID(); listeners.forEach(listener => listener());
});
async function transport(request: ProposeRequest, signal: AbortSignal): Promise<ChangePlan> {
  const text = catalog.demo;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 900);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); }, { once: true });
  });
  return { protocolVersion: '1', requestId: request.requestId, formId: request.formId, baseRevision: request.baseRevision,
    changes: [
      { op: 'replace', path: '/title', value: text.fixtureTitle, reason: text.fixtureReason },
      { op: 'replace', path: '/excerpt', value: text.fixtureExcerpt, reason: text.fixtureReason },
      { op: 'replace', path: '/body', value: text.fixtureBody, reason: text.fixtureReason },
      { op: 'replace', path: '/seoTitle', value: text.fixtureSeoTitle, reason: text.fixtureReason },
    ], questions: [], warnings: [text.fixtureWarning] };
}
const controller = createAssistant({ connectionId: 'demo', model: 'fixture', transport, binding: {
  read: () => structuredClone(form),
  write(next, _paths, expected) {
    if (expected && JSON.stringify(expected) !== JSON.stringify(form)) throw new Error('CONFLICT');
    if (next.values.title !== form.values.title) titleTouched = true;
    form = structuredClone(next);
    for (const control of Array.from(element.elements)) if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) { const value = form.values[control.name]; if (typeof value === 'string') control.value = value; }
    listeners.forEach(listener => listener());
  },
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
} });
spotlight.controller = controller;
function updateStatus() {
  const state = controller.getSnapshot();
  const labels: Record<string, string> = { idle: catalog.demo.idle, generating: catalog.ui.generating, review: catalog.demo.review, applied: catalog.ui.applied, cancelled: catalog.ui.cancelled, conflict: catalog.ui.conflict, error: catalog.ui.error };
  status.textContent = labels[state.status] ?? catalog.demo.idle;
}
controller.subscribe(updateStatus);
async function updateLocale() {
  const sequence = ++localeSequence;
  const locale = selectedLocale === 'auto' ? detectLocale() : selectedLocale;
  const next = await loadCatalog(locale);
  if (sequence !== localeSequence) return;
  catalog = next; document.documentElement.lang = locale; document.documentElement.dir = direction(locale); document.title = catalog.demo.pageTitle;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(node => { const key = node.dataset.i18n as keyof Catalog['demo']; node.textContent = catalog.demo[key]; });
  document.querySelectorAll<HTMLElement>('[data-i18n-ui]').forEach(node => { const key = node.dataset.i18nUi as keyof Catalog['ui']; node.textContent = catalog.ui[key]; });
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-placeholder]').forEach(node => { const key = node.dataset.placeholder as keyof Catalog['demo']; node.placeholder = catalog.demo[key]; });
  selector.options[0]!.textContent = catalog.demo.automatic;
  selector.setAttribute('aria-label', catalog.demo.language);
  const dark = document.documentElement.dataset.theme === 'dark'; theme.setAttribute('aria-label', dark ? catalog.demo.themeLight : catalog.demo.themeDark); theme.title = dark ? catalog.demo.themeLight : catalog.demo.themeDark;
  spotlight.locale = locale; assistantButton.locale = locale;
  spotlight.examples = [catalog.demo.samplePrompt1, catalog.demo.samplePrompt2, catalog.demo.samplePrompt3];
  if (!titleTouched && !['generating', 'review'].includes(controller.getSnapshot().status)) { title.value = catalog.demo.initialTitle; form.values.title = catalog.demo.initialTitle; }
  updateStatus();
}
selector.addEventListener('change', () => { selectedLocale = selector.value; void updateLocale(); });
window.addEventListener('languagechange', () => { if (selectedLocale === 'auto') void updateLocale(); });
theme.addEventListener('click', () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; spotlight.dataset.theme = next; assistantButton.dataset.theme = next; void updateLocale(); });
document.querySelector('#launch')!.addEventListener('click', () => spotlight.open());
document.querySelector('#undo')!.addEventListener('click', () => { void controller.undo(); });
const codeElement = document.querySelector<HTMLElement>('#code')!;
const filename = document.querySelector<HTMLElement>('#code-filename')!;
const sourceCode = codeElement.textContent ?? '';
const viewButtons = document.querySelectorAll<HTMLButtonElement>('[data-view]');
viewButtons.forEach(button => button.addEventListener('click', () => {
  const view = button.dataset.view;
  viewButtons.forEach(item => item.classList.toggle('side-active', item === button));
  if (view === 'editor') { document.querySelector('#playground')!.scrollIntoView({ behavior: 'smooth' }); title.focus({ preventScroll: true }); return; }
  codeElement.textContent = view === 'schema' ? JSON.stringify(fixture.schema, null, 2) : sourceCode;
  filename.textContent = view === 'schema' ? 'form.schema.json' : 'form-assist.ts';
  document.querySelector('#developer')!.scrollIntoView({ behavior: 'smooth' });
}));
document.querySelector('#copy')!.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(codeElement.textContent ?? ''); document.querySelector('#copy')!.textContent = catalog.demo.copied; }
  catch { document.querySelector('#copy')!.textContent = catalog.ui.error; }
});
spotlight.dataset.theme = 'dark'; assistantButton.dataset.theme = 'dark';
void updateLocale();

// Only track a fine pointer while motion is enabled and the document is visible.
const motion = matchMedia('(prefers-reduced-motion: reduce)'); const fine = matchMedia('(pointer: fine)');
const grid = document.querySelector<HTMLElement>('.grid')!; let frame = 0, x = 0, y = 0, listening = false;
function move(event: PointerEvent) { x = event.clientX; y = event.pageY; if (!frame) frame = requestAnimationFrame(() => { grid.style.setProperty('--x', `${x}px`); grid.style.setProperty('--y', `${y}px`); frame = 0; }); }
function updateMotion() { const active = !document.hidden && !motion.matches && fine.matches; if (active && !listening) { window.addEventListener('pointermove', move, { passive: true }); listening = true; } else if (!active && listening) { window.removeEventListener('pointermove', move); listening = false; cancelAnimationFrame(frame); frame = 0; } }
motion.addEventListener('change', updateMotion); fine.addEventListener('change', updateMotion); document.addEventListener('visibilitychange', updateMotion); updateMotion();
window.addEventListener('pagehide', () => { window.removeEventListener('pointermove', move); motion.removeEventListener('change', updateMotion); fine.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', updateMotion); cancelAnimationFrame(frame); controller.dispose(); }, { once: true });
