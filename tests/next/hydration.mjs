import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const baseUrl = process.env.NEXT_TEST_BASE_URL ?? 'http://127.0.0.1:3002';
const server = process.env.NEXT_TEST_BASE_URL ? undefined : spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', resolve(root, 'examples/next'), '-p', '3002'], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: 'pipe' });
let serverOutput = '';
server?.stdout.on('data', data => { serverOutput += data.toString(); });
server?.stderr.on('data', data => { serverOutput += data.toString(); });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server && server.exitCode !== null) throw new Error(`Next server exited: ${serverOutput}`);
    try { if ((await fetch(baseUrl)).ok) { ready = true; break; } } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error(`Next server did not become ready: ${serverOutput}`);
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const response = await page.goto(baseUrl);
  assert.equal(response.status(), 200);
  const html = await response.text(); assert.match(html, /first form/); assert.match(html, /second form/);
  await page.getByLabel('first title').fill('User input');
  await page.locator('section[aria-label="first form"] form-assist-button').getByRole('button').click();
  await page.getByPlaceholder('Describe what you would like to do…').fill('Create title');
  await page.getByRole('button', { name: 'Create suggestions' }).click();
  await page.getByRole('button', { name: 'Apply selected' }).click();
  await page.waitForFunction(() => document.querySelector('input[aria-label="first title"]').value === 'A thoughtful article title');
  assert.equal(await page.getByLabel('second title').inputValue(), '');
  assert.deepEqual(errors, []);
  console.log('SSR and hydration passed; proposal applied only to first form.');
} finally { await browser.close(); server?.kill('SIGTERM'); }
