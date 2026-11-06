import { englishCatalog } from './en.js';
import { catalogLoaders, supportedLocales, type SupportedLocale } from './registry.js';
import type { Catalog } from './types.js';
export { englishCatalog, supportedLocales };
export type { SupportedLocale } from './registry.js';
export type { Catalog, UiMessages, DemoMessages } from './types.js';

const supported = new Set<string>(supportedLocales.map(locale => locale.code));
function normalize(input: string): SupportedLocale | undefined {
  if (typeof input !== 'string' || !input.trim()) return undefined;
  let tag: string;
  try { tag = Intl.getCanonicalLocales(input.trim().replace(/_/g, '-'))[0] ?? ''; } catch { return undefined; }
  const parts = tag.toLowerCase().split('-');
  let language = parts[0]!;
  const aliases: Record<string, string> = { iw: 'he', no: 'nb', in: 'id', tl: 'fil' };
  language = aliases[language] ?? language;
  if (language === 'zh') {
    if (parts.includes('hant')) return 'zh-TW';
    if (parts.includes('hans')) return 'zh-CN';
    return parts.includes('tw') || parts.includes('hk') || parts.includes('mo') ? 'zh-TW' : 'zh-CN';
  }
  if (supported.has(language)) return language as SupportedLocale;
  return undefined;
}
export function resolveLocale(preferences: readonly string[]): SupportedLocale {
  if (!Array.isArray(preferences)) return 'en';
  for (const preference of preferences) { const locale = normalize(preference); if (locale) return locale; }
  return 'en';
}
export function detectLocale(): SupportedLocale {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'en';
  const languages = navigator.languages?.length ? navigator.languages : navigator.language ? [navigator.language] : [];
  return resolveLocale(languages);
}
export function direction(locale: string): 'ltr' | 'rtl' {
  const code = resolveLocale([locale]);
  return supportedLocales.find(item => item.code === code)?.dir ?? 'ltr';
}
const cache = new Map<SupportedLocale, Promise<Catalog>>([['en', Promise.resolve(englishCatalog)]]);
export function loadCatalog(locale: string): Promise<Catalog> {
  const code = resolveLocale([locale]);
  let result = cache.get(code);
  if (!result) {
    result = catalogLoaders[code]().then(module => module.default).catch(() => englishCatalog);
    cache.set(code, result);
  }
  return result;
}
