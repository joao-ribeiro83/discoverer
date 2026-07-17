import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.FRONTEND_PORT) || 5173

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The Vite dev server backing webServer below (unbundled, transform-on-
  // request) can't absorb a concurrent first-load stampede — even 4 workers
  // reproduced mass page.goto timeouts on the very first wave of tests here.
  // workers:1 was the only setting that ran green across repeated full
  // suite runs. If CI hardware proves more capable, the real fix is to point
  // webServer at a built+`vite preview` bundle instead of raising this.
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
