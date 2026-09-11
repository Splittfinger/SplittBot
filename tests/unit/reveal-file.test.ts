import { execFile } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { revealFile } from '../../src/main/services/reveal-file'

vi.mock('node:child_process', () => ({ execFile: vi.fn() }))
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers() })

describe('bounded Finder reveal', () => {
  it('passes the path as one argument without shell expansion', async () => {
    vi.mocked(execFile).mockImplementation(((_file: unknown, _args: unknown, _options: unknown, callback: (error: Error | null) => void) => {
      queueMicrotask(() => callback(null))
      return { kill: vi.fn() }
    }) as any)
    const path = '/tmp/SplittBot $(not-a-command).app'
    await revealFile(path)
    expect(execFile).toHaveBeenCalledWith('/usr/bin/open', ['-R', path], expect.objectContaining({ timeout: 8_000, killSignal: 'SIGKILL' }), expect.any(Function))
  })

  it('rejects non-local and malformed paths before launching a helper', async () => {
    await expect(revealFile('https://example.com')).rejects.toThrow('absolute local path')
    await expect(revealFile('/tmp/invalid\0path')).rejects.toThrow('absolute local path')
    expect(execFile).not.toHaveBeenCalled()
  })

  it('fails promptly even when the OS helper never exits', async () => {
    vi.useFakeTimers()
    const kill = vi.fn()
    vi.mocked(execFile).mockReturnValue({ kill } as any)
    const assertion = expect(revealFile('/tmp/Example.app')).rejects.toThrow('SplittBot is still available')
    await vi.advanceTimersByTimeAsync(10_000)
    await assertion
    expect(kill).toHaveBeenCalledWith('SIGKILL')
  })

  it('does not expose helper stderr or private errors', async () => {
    vi.mocked(execFile).mockImplementation(((_file: unknown, _args: unknown, _options: unknown, callback: (error: Error) => void) => {
      queueMicrotask(() => callback(new Error('private provider details')))
      return { kill: vi.fn() }
    }) as any)
    await expect(revealFile('/tmp/Example.app')).rejects.toThrow('Finder could not reveal')
  })
})
