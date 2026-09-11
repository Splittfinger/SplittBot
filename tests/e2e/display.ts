import type { CDPSession, Page } from '@playwright/test'

const sessions = new WeakMap<Page, CDPSession>()
async function displaySession(page: Page): Promise<CDPSession> {
  let session = sessions.get(page)
  if (!session) {
    session = await page.context().newCDPSession(page)
    sessions.set(page, session)
  }
  return session
}

// Hosted Macs can clamp native windows to a small display and enable reduced
// transparency. Layout tests must choose their conditions, not inherit the host.
export async function setDesktopViewport(page: Page, width = 1420, height = 900): Promise<void> {
  const session = await displaySession(page)
  await session.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
}

export async function emulateAppearance(page: Page, preferences: {
  colorScheme?: 'light' | 'dark'
  reducedMotion?: 'reduce' | 'no-preference'
  contrast?: 'more' | 'no-preference'
  reducedTransparency?: 'reduce' | 'no-preference'
} = {}): Promise<void> {
  const session = await displaySession(page)
  await session.send('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-color-scheme', value: preferences.colorScheme ?? 'light' },
    { name: 'prefers-reduced-motion', value: preferences.reducedMotion ?? 'no-preference' },
    { name: 'prefers-contrast', value: preferences.contrast ?? 'no-preference' },
    { name: 'prefers-reduced-transparency', value: preferences.reducedTransparency ?? 'no-preference' }
  ] })
}
