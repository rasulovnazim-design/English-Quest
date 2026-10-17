import { defineConfig, devices } from '@playwright/test';

// BASE_URL=https://english-quest.rasulovnazim.workers.dev/ npm run e2e   — test the live site
// npm run e2e                                                              — test a local production build
const remote = process.env.BASE_URL;
const baseURL = remote ?? 'http://localhost:4173/';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 10_000 },
  retries: remote ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'laptop', use: { viewport: { width: 1366, height: 768 } } }
  ],
  webServer: remote
    ? undefined
    : { command: 'npm run build && npm run preview', url: baseURL, reuseExistingServer: true, timeout: 180_000 }
});
