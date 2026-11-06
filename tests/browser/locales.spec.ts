import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loadCatalog, supportedLocales } from '../../packages/form-assist/src/i18n/index.js';

test('every supported catalog reaches both the launch page and prepared button', async ({ page }) => {
  await page.goto('/');
  for (const locale of supportedLocales) {
    const catalog = await loadCatalog(locale.code);
    await page.locator('#locale').selectOption(locale.code);
    await expect(page.locator('html')).toHaveAttribute('lang', locale.code);
    await expect(page.locator('html')).toHaveAttribute('dir', locale.dir);
    await expect(page.locator('[data-i18n=heroLine1]')).toHaveText(catalog.demo.heroLine1);
    await expect(page.locator('form-assist-button').getByRole('button')).toHaveAccessibleName(catalog.ui.button);
    await expect(page.locator('textarea[name=body]')).toHaveAttribute('placeholder', catalog.demo.bodyPlaceholder);
  }
});

test('launch page passes accessibility checks in dark and light themes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-i18n=heroLine1]')).not.toBeEmpty();
  for (const theme of ['dark', 'light']) {
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await page.locator('#theme').click();
  }
});

test('automatic mode follows changed browser preferences and manual mode stays selected', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['zz-ZZ', 'fr-CA', 'en-US'] }));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['ar-EG'] });
    window.dispatchEvent(new Event('languagechange'));
  });
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await page.locator('#locale').selectOption('ja');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['tr-TR'] });
    window.dispatchEvent(new Event('languagechange'));
  });
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await page.locator('#locale').selectOption('auto');
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
});
