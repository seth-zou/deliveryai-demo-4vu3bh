import { defineConfig, devices } from '@playwright/test'

const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/usr/bin/chromium-browser'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['html', { outputDir: 'e2e-report/html' }], ['list']],
  timeout: 30000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'on',
    headless: true,
    launchOptions: {
      executablePath: CHROMIUM_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
    // 显式设置浅色主题为测试基准，避免主题改动影响现有断言
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5173',
          localStorage: [
            { name: 'theme', value: 'light' }
          ]
        }
      ]
    }
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
