import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: true, retries: 0,
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: { command: 'npm run demo -- --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  reporter: [['list']],
});
