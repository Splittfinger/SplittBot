import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /(?:desktop|glass|navigation|pilot)\.spec\.ts/,
  timeout: 60_000,
  workers: 1,
  reporter: [['list']]
})
