# Phase 5 real-Mac acceptance — August 24, 2026

This record separates implementation verification from external permissions and authorization that SplittBot cannot safely assume.

## Verified implementation

- Version 0.5.0 passed TypeScript checking, all 18 unit tests, and the expanded Electron desktop flow.
- The desktop flow covered approval steering without approval, connector add/edit/remove, a two-agent workspace handoff and synthesis, explicit memory policy/export, routine recovery-code execution, and deterministic GUI safety controls.
- `release/mac-arm64/SplittBot.app` was rebuilt, locally signed, passed strict deep signature verification, and passed the packaged renderer-isolation test.
- After terminating a stale earlier process, the exact packaged bundle launched from its `app.asar` and visibly exposed the new Workspaces, Memory, and Real-Mac Acceptance interfaces.

## Actual Mac results

| Check | Result | Evidence and boundary |
| --- | --- | --- |
| ChatGPT-authenticated runtime | Passed | The exact packaged app reported a live Codex-managed ChatGPT session and discovered the account’s current model catalog. No API key was used. |
| Accessibility | Blocked | The packaged app’s native adapter reported `denied`. Opening System Settings or showing a permission prompt is not counted as access. |
| Screen Recording | Blocked | The packaged app’s native adapter reported `denied`. Deterministic test captures are not counted as packaged access. |
| Local iMessage skill | Passed under the Codex/ChatGPT host; blocked under the packaged SplittBot host | The Local iMessage helper reported Messages available and readable, a unique nonce search returned no messages, and a draft for a non-routable test recipient returned `sent: false` under the current Codex/ChatGPT host. The same packaged check stopped at status because SplittBot could not read Messages in its own permission context. No conversation content was retained and the send command was never called. |
| OAuth connect and revoke | Awaiting action-time confirmation | The available disposable candidate was signed out. Creating OAuth access requires confirmation immediately before authorization; no existing useful connector was revoked merely to manufacture a pass. Successful SplittBot disconnect records the revoke as evidence. |
| Sleep/wake catch-up | Recovery path passed; real sleep/wake outstanding | Automated coverage exercised restart/wake catch-up policy and notifications. The app intentionally records the in-app exercise as blocked until an actual Mac sleep/wake and notification are observed. |

## Release interpretation

The Phase 5 product code is implemented and packaged. This Mac is not yet approved for GUI control or packaged iMessage access because the required macOS permissions are denied or absent. OAuth and real sleep/wake acceptance remain operational sign-off items; they do not weaken deterministic coverage and are not represented as completed evidence.
