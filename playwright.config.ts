import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /(?:desktop|glass|navigation)\.spec\.ts/,
  timeout: 60_000,
  workers: 1,
  reporter: [['list']]
})
