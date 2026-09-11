import { execFile } from 'node:child_process'
import { isAbsolute } from 'node:path'

// NSWorkspace's synchronous reveal can block Electron's main thread while
// macOS issues a sandbox extension. Keep Finder work in a bounded subprocess.
export function revealFile(path: string): Promise<void> {
  if (!isAbsolute(path) || path.includes('\0')) return Promise.reject(new Error('Choose an absolute local path to reveal.'))
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve()
    }
    const child = execFile('/usr/bin/open', ['-R', path], { timeout: 8_000, killSignal: 'SIGKILL', maxBuffer: 16_384 }, (error) => {
      finish(error ? new Error('Finder could not reveal this item. Open Finder manually and use Go → Go to Folder with the item’s location.') : undefined)
    })
    // execFile's timeout waits for process exit. Reject independently too, so
    // even a stuck OS helper cannot keep the app's controls busy indefinitely.
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish(new Error('Finder did not respond. SplittBot is still available; open Finder manually to locate the item.'))
    }, 10_000)
  })
}
