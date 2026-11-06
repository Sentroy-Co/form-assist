import { describe, expect, it } from 'vitest';
import { detectLocale, direction, englishCatalog, loadCatalog, resolveLocale, supportedLocales } from '../packages/form-assist/src/i18n/index.js';

describe('localization', () => {
  it('contains 54 distinct locale metadata entries', () => {
    expect(supportedLocales).toHaveLength(54);
    expect(new Set(supportedLocales.map(locale => locale.code)).size).toBe(54);
    expect(supportedLocales.every(locale => locale.name.trim() && ['ltr', 'rtl'].includes(locale.dir))).toBe(true);
  });
  it('resolves preferences, aliases, scripts and regions safely', () => {
    expect(resolveLocale(['xx-YY', 'fr-CA'])).toBe('fr');
    expect(resolveLocale(['zh-Hant-HK'])).toBe('zh-TW');
    expect(resolveLocale(['zh-Hans-SG'])).toBe('zh-CN');
    expect(resolveLocale(['zh-Hans-HK'])).toBe('zh-CN');
    expect(resolveLocale(['zh-Hant-CN'])).toBe('zh-TW');
    expect(resolveLocale(['zh-HK'])).toBe('zh-TW');
    expect(resolveLocale(['pt-BR'])).toBe('pt');
    expect(resolveLocale(['iw-IL'])).toBe('he');
    expect(resolveLocale(['no-NO'])).toBe('nb');
    expect(resolveLocale(['in-ID'])).toBe('id');
    expect(resolveLocale(['tl-PH'])).toBe('fil');
    expect(resolveLocale(['not a locale', 'unsupported'])).toBe('en');
    expect(direction('ar-EG')).toBe('rtl');
    expect(direction('unknown')).toBe('ltr');
  });
  it('is safe to detect on the server even when Node exposes a navigator', () => { expect(detectLocale()).toBe('en'); });
  it('loads and caches complete localized UI and demo catalogs', async () => {
    for (const locale of supportedLocales) {
      const pending = loadCatalog(locale.code);
      expect(loadCatalog(locale.code)).toBe(pending);
      const catalog = await pending;
      for (const section of ['ui', 'demo'] as const) {
        expect(Object.keys(catalog[section]).sort(), locale.code).toEqual(Object.keys(englishCatalog[section]).sort());
        for (const value of Object.values(catalog[section])) expect(typeof value === 'string' && value.trim().length > 0, locale.code).toBe(true);
        if (locale.code !== 'en') expect(Object.values(catalog[section]).filter((value, i) => value !== Object.values(englishCatalog[section])[i]).length, locale.code).toBeGreaterThan(Object.keys(englishCatalog[section]).length / 2);
      }
    }
    expect(await loadCatalog('not a locale')).toEqual(englishCatalog);
  });
});
