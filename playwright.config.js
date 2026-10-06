// @ts-check
import { defineConfig, devices } from '@playwright/test';

// Testy parytetu: oryginalny index.html (reference/) vs build Astro (dist/).
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    { command: 'npm run serve:reference', url: 'http://localhost:4322/original.html', reuseExistingServer: false },
    { command: 'npm run build && npm run preview', url: 'http://127.0.0.1:4321/', reuseExistingServer: false },
  ],
});
