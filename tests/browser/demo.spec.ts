import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ locale: 'tr-TR' });

test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(page.locator('html')).toHaveAttribute('lang', 'tr'); await page.locator('#assistant').evaluate(async (el: any) => { await el.updateComplete; }); });
async function open(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'AI ile düzenle' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox')).toBeFocused();
  return dialog;
}
test('reviews selected fields, applies to one form and undoes without submitting', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const dialog = await open(page);
  await dialog.getByRole('textbox').fill('Bir makale taslağı hazırla');
  await dialog.getByRole('button', { name: 'Öneri oluştur', exact: true }).click();
  await expect(dialog.getByRole('checkbox')).toHaveCount(4);
  await dialog.getByRole('checkbox', { name: 'Alanı seç: /body', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Seçilenleri uygula' }).click();
  await expect(page.locator('input[name=title]')).toHaveValue('Kaynak notlarından güçlü bir ilk taslağa');
  await expect(page.locator('textarea[name=body]')).toHaveValue('');
  await dialog.getByRole('button', { name: 'Geri al', exact: true }).click();
  await expect(page.locator('input[name=title]')).toHaveValue('Başlıksız taslak');
  await expect(page).toHaveURL('http://127.0.0.1:5173/');
  expect(errors).toEqual([]);
});
test('cancellation prevents a late result from modifying the form', async ({ page }) => {
  const dialog = await open(page);
  await dialog.getByRole('textbox').fill('İptal edilecek istek');
  await dialog.getByRole('button', { name: 'Öneri oluştur', exact: true }).click();
  await dialog.getByRole('button', { name: 'İptal et', exact: true }).click();
  await expect(dialog.getByText('İşlem iptal edildi.', { exact: true }).first()).toBeVisible();
  await expect(page.locator('input[name=title]')).toHaveValue('Başlıksız taslak');
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
});
test('typing during generation reports a conflict and preserves user text', async ({ page }) => {
  const dialog = await open(page);
  await dialog.getByRole('textbox').fill('Bir başlık öner');
  await dialog.getByRole('button', { name: 'Öneri oluştur', exact: true }).click();
  await page.locator('input[name=title]').evaluate((input: HTMLInputElement) => {
    input.value = 'Kullanıcının kendi başlığı'; input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(dialog.getByText('Form değişti. Lütfen yeniden öneri oluşturun.', { exact: true }).first()).toBeVisible();
  await expect(page.locator('input[name=title]')).toHaveValue('Kullanıcının kendi başlığı');
});
test('keyboard focus survives updates and returns to launcher', async ({ page }) => {
  const launcher = page.getByRole('button', { name: 'AI ile düzenle' });
  await launcher.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog'); const input = dialog.getByRole('textbox');
  await expect(input).toBeFocused(); await input.fill('Başlık hazırla'); await input.press('Enter');
  await expect(input).toBeFocused();
  await expect(dialog.getByRole('checkbox')).toHaveCount(4);
  await expect(input).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(launcher).toBeFocused();
});
test('desktop visual fixture', async ({ page }) => {
  await page.screenshot({ path: 'artifacts/demo-desktop.png', fullPage: true });
  const dialog = await open(page);
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: 'artifacts/demo-spotlight.png', fullPage: true });
});
test('dialog and review pass automated accessibility checks', async ({ page }) => {
  const dialog = await open(page);
  let results = await new AxeBuilder({ page }).include('form-assist-spotlight').analyze();
  expect(results.violations).toEqual([]);
  await dialog.getByRole('textbox').fill('Başlık öner');
  await dialog.getByRole('button', { name: 'Öneri oluştur', exact: true }).click();
  await expect(dialog.getByRole('checkbox')).toHaveCount(4);
  results = await new AxeBuilder({ page }).include('form-assist-spotlight').analyze();
  expect(results.violations).toEqual([]);
});
test.describe('small screens', () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', colorScheme: 'dark' });
  test('sheet remains on-screen with reduced motion and keyboard navigation', async ({ page }) => {
    const dialog = await open(page); const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.width).toBeLessThanOrEqual(390);
    await dialog.getByRole('textbox').fill('Örnek hazırla');
    await dialog.getByRole('button', { name: 'Öneri oluştur', exact: true }).click();
    await expect(dialog.getByRole('checkbox')).toHaveCount(4);
    await page.screenshot({ path: 'artifacts/demo-mobile.png', fullPage: true });
    expect(await dialog.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  });
});


test('locale, theme, and pointer atmosphere preserve edits', async ({ page }) => {
  await page.locator('input[name=title]').fill('Benim başlığım');
  const selector = page.locator('#locale');
  await selector.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('Your intent.')).toBeVisible();
  await selector.selectOption('ar'); await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await selector.selectOption('ja'); await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await selector.selectOption('zh-TW'); await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await expect(page.locator('input[name=title]')).toHaveValue('Benim başlığım');
  await page.locator('#theme').click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#theme').click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.mouse.move(210, 130); await expect.poll(() => page.locator('.grid').evaluate(el => (el as HTMLElement).style.getPropertyValue('--x'))).toBe('210px');
});

test('automatic locale follows browser preferences and falls back', async ({ browser }) => {
  for (const [locale, expected] of [['en-US', 'en'], ['ar-SA', 'ar'], ['ja-JP', 'ja'], ['zh-HK', 'zh-TW'], ['xx-XX', 'en']]) {
    const context = await browser.newContext({ locale }); const page = await context.newPage(); await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', expected); await context.close();
  }
});

test('changing language during review retains proposal and form', async ({ page }) => {
  const dialog = await open(page); await dialog.getByRole('textbox').fill('Bir başlık öner');
  await dialog.getByRole('button', { name: 'Öneri oluştur', exact: true }).click(); await expect(dialog.getByRole('checkbox')).toHaveCount(4);
  await page.locator('#locale').selectOption('en', { force: true });
  await expect(dialog.getByRole('checkbox')).toHaveCount(4); await expect(page.locator('input[name=title]')).toHaveValue('Başlıksız taslak');
});

test('editor navigation switches schema and integration code; copy errors are visible', async ({ page }) => {
  await page.getByRole('button', { name: 'Şema', exact: true }).click();
  await expect(page.locator('#code-filename')).toHaveText('form.schema.json');
  await expect(page.locator('#code')).toContainText('"properties"');
  await page.getByRole('button', { name: 'Entegrasyon', exact: true }).click();
  await expect(page.locator('#code-filename')).toHaveText('form-assist.ts');
  await expect(page.locator('#code')).toContainText('createAssistant');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } }));
  await page.locator('#copy').click(); await expect(page.locator('#copy')).toHaveText('Bir sorun oluştu.');
  await page.getByRole('button', { name: 'Editör', exact: true }).click(); await expect(page.locator('input[name=title]')).toBeFocused();
});
