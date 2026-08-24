import { spawn, type ChildProcess } from 'node:child_process'
import { desktopCapturer, screen, shell, systemPreferences } from 'electron'
import type { GuiPermissionValue, GuiPermissions, GuiStep } from '../../shared/contracts'
import type { GuiAutomationAdapter, GuiEnvironmentState } from './gui-automation'

const INSPECT_SCRIPT = String.raw`
tell application "System Events"
  set frontProcess to first application process whose frontmost is true
  set frontName to name of frontProcess
  set modalOpen to false
  try
    if exists sheet 1 of window 1 of frontProcess then set modalOpen to true
  end try
  try
    repeat with candidateWindow in windows of frontProcess
      set windowSubrole to value of attribute "AXSubrole" of candidateWindow
      if windowSubrole is "AXDialog" or windowSubrole is "AXSystemDialog" then set modalOpen to true
    end repeat
  end try
  return frontName & tab & (modalOpen as text)
end tell
`

const CLICK_SCRIPT = String.raw`
on run argv
  set targetName to item 1 of argv
  set buttonName to item 2 of argv
  tell application "System Events"
    if not (exists application process targetName) then error "The target app is not running."
    tell application process targetName
      if not frontmost then error "The target app lost focus."
      if not (exists window 1) then error "The target app has no front window."
      if not (exists button buttonName of window 1) then error "No visible front-window button named “" & buttonName & "” was found."
      click button buttonName of window 1
    end tell
  end tell
end run
`

const TYPE_SCRIPT = String.raw`
on run argv
  set targetName to item 1 of argv
  set exactText to item 2 of argv
  tell application "System Events"
    set frontName to name of first application process whose frontmost is true
    if frontName is not targetName then error "The target app lost focus."
    keystroke exactText
  end tell
end run
`

const KEY_SCRIPT = String.raw`
on run argv
  set targetName to item 1 of argv
  set exactKeyCode to (item 2 of argv) as integer
  tell application "System Events"
    set frontName to name of first application process whose frontmost is true
    if frontName is not targetName then error "The target app lost focus."
    key code exactKeyCode
  end tell
end run
`

const KEY_CODES: Record<Extract<GuiStep, { type: 'pressKey' }>['key'], number> = {
  tab: 48,
  escape: 53,
  arrowLeft: 123,
  arrowRight: 124,
  arrowDown: 125,
  arrowUp: 126
}

export class MacGuiAutomationAdapter implements GuiAutomationAdapter {
  private currentProcess: ChildProcess | null = null

  async getPermissions(): Promise<GuiPermissions> {
    if (process.platform !== 'darwin') return { accessibility: 'unavailable', screenRecording: 'unavailable' }
    return {
      accessibility: systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'denied',
      screenRecording: mapMediaStatus(systemPreferences.getMediaAccessStatus('screen'))
    }
  }

  async requestPermission(kind: 'accessibility' | 'screenRecording'): Promise<GuiPermissions> {
    if (process.platform !== 'darwin') return this.getPermissions()
    if (kind === 'accessibility') {
      systemPreferences.isTrustedAccessibilityClient(true)
    } else {
      await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 2, height: 2 } }).catch(() => [])
    }
    return this.getPermissions()
  }

  async openPermissionSettings(kind: 'accessibility' | 'screenRecording'): Promise<void> {
    const anchor = kind === 'accessibility' ? 'Privacy_Accessibility' : 'Privacy_ScreenCapture'
    await shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${anchor}`)
  }

  async inspect(): Promise<GuiEnvironmentState> {
    const output = await this.run('/usr/bin/osascript', ['-e', INSPECT_SCRIPT])
    const [frontmostApp = '', modalText = 'false'] = output.trim().split('\t')
    return { frontmostApp, modalOpen: modalText.toLocaleLowerCase() === 'true' }
  }

  async execute(step: GuiStep, targetApp: string): Promise<void> {
    if (step.type === 'activateApp') {
      await this.run('/usr/bin/open', ['-a', targetApp])
      return
    }
    if (step.type === 'wait') return
    if (step.type === 'clickElement') {
      await this.run('/usr/bin/osascript', ['-e', CLICK_SCRIPT, '--', targetApp, step.label])
      return
    }
    if (step.type === 'typeText') {
      await this.run('/usr/bin/osascript', ['-e', TYPE_SCRIPT, '--', targetApp, step.text])
      return
    }
    await this.run('/usr/bin/osascript', ['-e', KEY_SCRIPT, '--', targetApp, String(KEY_CODES[step.key])])
  }

  async capture(): Promise<Buffer> {
    const primaryDisplayId = String(screen.getPrimaryDisplay().id)
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1440, height: 900 } })
    const source = sources.find((candidate) => candidate.display_id === primaryDisplayId) ?? sources[0]
    if (!source || source.thumbnail.isEmpty()) throw new Error('Screen Recording did not return a usable screenshot.')
    return source.thumbnail.toPNG()
  }

  cancelCurrent(): void {
    this.currentProcess?.kill('SIGTERM')
  }

  private run(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
      this.currentProcess = child
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => child.kill('SIGTERM'), 20_000)
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => { stdout += chunk })
      child.stderr.on('data', (chunk: string) => { stderr += chunk })
      child.on('error', reject)
      child.on('close', (code, signal) => {
        clearTimeout(timer)
        if (this.currentProcess === child) this.currentProcess = null
        if (code === 0) resolve(stdout)
        else reject(new Error(stderr.trim() || `GUI helper exited with ${signal || code}.`))
      })
    })
  }
}

function mapMediaStatus(status: string): GuiPermissionValue {
  if (status === 'granted') return 'granted'
  if (status === 'denied') return 'denied'
  if (status === 'restricted') return 'restricted'
  if (status === 'not-determined') return 'notDetermined'
  return 'unavailable'
}
