# Phase 3 implementation handoff

- Completed: August 21, 2026
- Application: SplittBot for macOS
- Runtime: local Codex App Server with ChatGPT-managed authentication
- OpenAI API key: not used

## Delivered

### Opt-in Mac permissions

- Shows the live macOS Accessibility and Screen Recording state without prompting on launch.
- Provides deliberate **Request** and **Open Settings** actions for each permission.
- Includes the Apple Events usage description and signed-app automation entitlement needed for approved System Events control.
- Starts no GUI session until both permissions are granted.

### Controlled GUI plans

- An agent must have the exact target application in its **Approved apps** grant.
- Plans contain one to 20 structured steps: activate the approved app, wait, click an exact named front-window button, type exact literal text, or press a non-commit navigation key.
- Every plan begins with target-app activation, cannot change apps, is SHA-256 bound to its exact objective/steps/retry policy, and creates a durable one-time approval.
- Coordinate clicks and controls with consequential labels such as Send, Publish, Purchase, Delete, Install, Grant, Submit, Upload, Save, or Sign in are rejected. The user must take over for those actions.

### One visible GUI lane

- Only one approved session can own application focus, the keyboard, or screen capture at a time. Additional approved sessions remain queued.
- The live control room shows the owner, target app, current step, pause reason, plan digest, evidence count, and session history.
- Before every step after activation, SplittBot verifies the frontmost app and checks for sheets/dialog windows.
- Unexpected focus or a modal dialog safety-pauses execution. The user resolves the condition and resumes or chooses **Take over**.
- Automatic retries apply only to idempotent activation/wait steps. Text entry, key presses, and button clicks are never automatically repeated.

### Evidence and emergency control

- Screen captures are written under SplittBot's private Application Support data with owner-only file permissions.
- Before, intermediate, paused, final, failure, and stopped evidence is linked to the durable GUI session and exposed through a path-checked typed IPC reader.
- Completed sessions create a local verification artifact with the plan digest and final evidence path.
- **Emergency stop** cancels queued GUI work, cancels pending GUI approvals, interrupts the active helper, prevents new sessions, persists across restart, and requires an explicit user reset.
- **Take over** stops automation and releases the lane without attempting to continue after the user begins manual control.

## Enforced bypass protection

- The direct `computer-use` MCP service is disabled in per-agent thread configuration and cannot be granted from the connector UI.
- Common shell GUI paths including `osascript`, `screencapture`, `cliclick`, `pyautogui`, `CGEvent`, `shortcuts run`, and `open -a` are declined when requested by an agent.
- Agent instructions state that all screen, keyboard, mouse, System Events, and computer-use work must go through the SplittBot control room.
- GUI screenshots and any text visible in the target application are treated as untrusted evidence, never as instructions that can alter the approved plan.

## Verification evidence

| Check | Result |
|---|---|
| Strict TypeScript typecheck | Passed |
| GUI session, evidence, and persistent emergency-state migration | Passed |
| Prompt-injection text remains literal with no generated steps | Passed |
| Focus-change and modal-dialog safety pauses | Passed |
| Safe-step retry and no retry for non-idempotent steps | Passed |
| Active emergency interruption and persistent new-work block | Passed |
| Electron approval, pause/resume, evidence, takeover, and reset flow | Passed |
| Existing chat, collaboration, tools, routines, restart, and thread-resume regression | Passed |

Run deterministic, package, signature, and packaged-launch checks with `npm run verify`. Run the opt-in live ChatGPT/Codex regression with `npm run test:codex-live`.

## Operating boundary

SplittBot intentionally does not provide coordinate clicks, silent control, autonomous consequential actions, CAPTCHA or 2FA handling, secret entry, or background control while the Mac is asleep. Prefer APIs, MCP, Shortcuts, and app-specific structured integrations whenever possible. GUI control is the last-resort local adapter and always remains visible and interruptible.
