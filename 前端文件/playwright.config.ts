import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5174';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 45000,
  expect: { timeout: 12000 },
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      ...(process.env.SUNCRAFT_BROWSER_PATH
        ? { executablePath: process.env.SUNCRAFT_BROWSER_PATH }
        : {}),
      args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
