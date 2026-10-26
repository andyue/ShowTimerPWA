import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', timeout: 30000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
  webServer: [
    { command: 'npm run lan', url: 'http://127.0.0.1:8790/health', reuseExistingServer: false, env: { LAN_PORT: '8790' } },
    { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: false },
    { command: 'npm run sync:server', url: 'http://127.0.0.1:8787/health', reuseExistingServer: false },
    { command: 'npm run osc:bridge', url: 'http://127.0.0.1:8788/health', reuseExistingServer: false, env: { OSC_TOKEN: 'e2e-pairing' } },
  ],
})
