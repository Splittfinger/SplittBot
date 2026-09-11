import { describe, expect, it, vi } from 'vitest'
import { findDefaultBrowserBundleId, openHttpsInBrowser } from '../../src/main/services/external-browser'

const launchServices = `(
    {
        LSHandlerPreferredVersions = {
            LSHandlerRoleAll = "7778.97";
        };
        LSHandlerRoleAll = "com.google.chrome";
        LSHandlerURLScheme = https;
    },
    {
        LSHandlerContentType = "com.apple.default-app.web-browser";
        LSHandlerRoleAll = "com.google.chrome";
    }
)`

describe('external browser handoff', () => {
  it('finds the configured macOS HTTPS browser', () => {
    expect(findDefaultBrowserBundleId(launchServices)).toBe('com.google.chrome')
    expect(findDefaultBrowserBundleId('({ LSHandlerURLScheme = https; LSHandlerRoleAll = "bad value"; })')).toBeNull()
  })

  it('forces ChatGPT app links into the configured browser on macOS', async () => {
    const calls: Array<[string, string[]]> = []
    const fallback = vi.fn(async () => undefined)
    const result = await openHttpsInBrowser('https://chatgpt.com/apps/outlook-email/test', {
      platform: 'darwin',
      fallback,
      runCommand: async (executable, args) => {
        calls.push([executable, args])
        return executable === '/usr/bin/defaults' ? launchServices : ''
      }
    })

    expect(result).toEqual({ browserName: 'Google Chrome', forcedBrowser: true })
    expect(calls).toEqual([
      ['/usr/bin/defaults', ['read', 'com.apple.LaunchServices/com.apple.launchservices.secure', 'LSHandlers']],
      ['/usr/bin/open', ['-b', 'com.google.chrome', 'https://chatgpt.com/apps/outlook-email/test']]
    ])
    expect(fallback).not.toHaveBeenCalled()
  })

  it('uses Safari before the universal-link fallback when the browser lookup fails', async () => {
    const calls: Array<[string, string[]]> = []
    const fallback = vi.fn(async () => undefined)
    const result = await openHttpsInBrowser('https://chatgpt.com/apps/outlook-email/test', {
      platform: 'darwin',
      fallback,
      runCommand: async (executable, args) => {
        calls.push([executable, args])
        if (executable === '/usr/bin/defaults') throw new Error('No preference')
        return ''
      }
    })

    expect(result).toEqual({ browserName: 'Safari', forcedBrowser: true })
    expect(calls.at(-1)).toEqual(['/usr/bin/open', ['-b', 'com.apple.Safari', 'https://chatgpt.com/apps/outlook-email/test']])
    expect(fallback).not.toHaveBeenCalled()
  })

  it('rejects non-HTTPS destinations', async () => {
    await expect(openHttpsInBrowser('file:///tmp/example', { fallback: vi.fn() })).rejects.toThrow('Only HTTPS')
  })
})
