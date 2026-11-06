import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { loadCatalog } from '../packages/form-assist/dist/i18n/index.js';

const root = resolve(import.meta.dirname, '..');
const base = 'http://127.0.0.1:4173/form-assist/';
const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', resolve(root, 'examples/demo'), '--outDir', resolve(root, 'artifacts/launch'), '--base', '/form-assist/', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { cwd: root, stdio: 'pipe' });
let output = '';
server.stdout.on('data', data => { output += data.toString(); });
server.stderr.on('data', data => { output += data.toString(); });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(output);
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error(`Production preview did not start: ${output}`);
  browser = await chromium.launch();
  const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1440, height: 1320 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`); });
  page.on('request', request => { if (new URL(request.url()).origin !== new URL(base).origin) errors.push('Unexpected external request'); });
  await page.goto(base);
  await expect(page.locator('[data-i18n=heroLine1]')).toHaveText('Your intent.');
  await mkdir(resolve(root, 'docs/assets'), { recursive: true });
  await page.screenshot({ path: resolve(root, 'docs/assets/launch.png') });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#launch').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('Prepare an article draft from my notes.');
  await dialog.getByRole('button', { name: 'Create suggestions', exact: true }).click();
  await expect(dialog.getByRole('checkbox')).toHaveCount(4);
  await page.screenshot({ path: resolve(root, 'docs/assets/spotlight.png') });
  await dialog.getByRole('button', { name: 'Apply selected', exact: true }).click();
  await expect(page.locator('input[name=title]')).toHaveValue((await loadCatalog('en')).demo.fixtureTitle);
  await page.keyboard.press('Escape');
  await page.locator('#locale').selectOption('ja');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.locator('form-assist-button').getByRole('button')).toHaveAccessibleName((await loadCatalog('ja')).ui.button);
  if (errors.length) throw new Error(errors.join('\n'));
  const context = await browser.newContext({ locale: 'ar-SA', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const mobile = await context.newPage();
  await mobile.goto(base); await expect(mobile.locator('html')).toHaveAttribute('dir', 'rtl');
  const arabic = await loadCatalog('ar');
  await mobile.locator('#launch').click();
  const mobileDialog = mobile.getByRole('dialog');
  await mobileDialog.getByRole('textbox').fill(arabic.demo.samplePrompt1);
  await mobileDialog.getByRole('button', { name: arabic.ui.send, exact: true }).click();
  await expect(mobileDialog.getByRole('checkbox')).toHaveCount(4);
  await mobile.screenshot({ path: resolve(root, 'docs/assets/mobile.png') });
  await context.close();
  console.log('Production subpath assets, lazy locale chunks, real review/apply, RTL mobile and README captures passed.');
} finally { await browser?.close(); server.kill('SIGTERM'); }
