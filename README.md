# SplittBot

SplittBot is a working Mac application for a team of persistent Codex agents. Each agent has a name, role, avatar, working instructions, model, AI effort, approved local boundaries, and a persistent Codex thread.

This repository contains the working Phase 0–4 desktop app plus the first Phase 5 lifecycle and image-attachment controls, research, and product/technical design:

- [Grok Bot research brief](docs/grok-bot-research.md)
- [SplittBot product and UX design](docs/splittbot-design.md)
- [Mac + Codex architecture decision](docs/mac-codex-architecture.md)
- [Phase 0–1 implementation handoff](docs/phase-0-1-handoff.md)
- [Phase 2 implementation handoff](docs/phase-2-handoff.md)
- [Phase 3 implementation handoff](docs/phase-3-handoff.md)
- [Phase 4 implementation handoff](docs/phase-4-handoff.md)
- [Phase 5 roadmap](docs/phase-5-roadmap.md)

## Current implementation

Phase 0 through Phase 4 are implemented as a working Electron macOS application. The app uses the Codex runtime installed with ChatGPT, signs in through Codex-managed ChatGPT authentication, discovers the models available to the account, creates persistent agent threads, and resumes them after an application or App Server restart.

The desktop includes named agent profiles, image/emoji/initial avatars, per-agent model and reasoning-effort selection, `@AgentName`/`@all` collaboration, streamed conversations, local SQLite persistence, task runs and handoffs, artifacts, durable approval cards, per-agent workspace grants, an audit history, isolated typed IPC, and secret-redacted structured logs.

Phase 2 adds a live Codex MCP connector catalog with OAuth launch, a reviewed skill catalog with explicit `$skill` invocation and per-agent grants, awake-only daily/interval routines, wake catch-up rules, persisted retries and restart recovery, local/native notifications, and an approval-gated Apple Shortcuts adapter. User-configured MCP entries are reconstructed as complete per-thread configuration so disabling a connector for one agent does not corrupt its transport settings. Codex-owned runtime services remain visibly marked as runtime-managed.

Phase 3 adds opt-in macOS Accessibility and Screen Recording checks, exact structured GUI plans, one globally serialized keyboard/focus lane, durable one-time approvals, live verification captures, focus-change and modal-dialog safety pauses, pause/resume, manual takeover, safe-step retries, and a persistent emergency stop. Direct computer-use connectors and common shell-based GUI automation paths are blocked so agents cannot bypass the control room.

Phase 4 adds the public GitHub source-control baseline, macOS CI, dependency monitoring, a branded app icon, a Developer ID/notarization-ready release workflow, private database backup and validated restore with a safety copy, version visibility, artifact export, and deletion of routines with their attempt history. Public release builds still require repository secrets backed by the owner's Apple Developer credentials.

The first Phase 5 slice makes the composer attachment control functional for up to four local PNG, JPEG, or WebP images per direct agent turn. The main process validates file signatures and size, keeps absolute paths out of the renderer and audit log, and revalidates each image immediately before sending it to the installed Codex App Server as typed `localImage` input. Generic document attachments remain pending a supported local-file input shape.

Tagged collaboration is enforced by the app rather than simulated in one prompt. Each receiving agent runs in its own persistent thread with its own selected model, AI effort, working directory, sandbox, grants, and approval flow. SplittBot records the handoff and gives the returned contribution to the primary agent for a final synthesis.

Run it in development:

```bash
npm install
npm run dev
```

Build and locally sign the macOS app:

```bash
npm run package:mac
open release/mac-arm64/SplittBot.app
```

Build a Developer ID-signed and notarized universal DMG/ZIP after configuring the documented GitHub secrets:

```bash
npm run dist:mac
```

Run the complete deterministic verification suite:

```bash
npm run verify
```

Run the opt-in live ChatGPT/Codex protocol test:

```bash
npm run test:codex-live
```

## Agent setup

- Choose any model returned by the signed-in Codex account, or keep the plan default.
- Choose one of the reasoning-effort levels supported by that model, or keep the model default.
- Use initials, a preset emoji, or a local PNG/JPEG/WebP picture up to 5 MB. Pictures are validated by file signature and saved only in the local SQLite database.
- Type `@` in working instructions or chat to select a teammate. Use `@all` to ask every active agent to contribute.
- Inspect collaboration status in the conversation and durable handoff/audit records.
- Review skills under Tools before granting them to an agent. An explicit `$skill-name` is rejected unless the skill is enabled, reviewed, and granted.
- Grant only the MCP connectors and Apple Shortcuts that agent needs. Shortcut runs always stop in Approvals with the exact text input visible.

## Routines and local tools

- Routines can run daily at a local time or at a minute interval.
- Choose whether a run missed during sleep is skipped or caught up once after wake.
- Select zero to three persisted retries and completion/failure notification behavior.
- The Mac must be awake and SplittBot must be running. This build does not claim cloud or asleep execution.
- Computer control is opt-in and visible. Add exact app names to an agent, grant macOS Accessibility and Screen Recording to SplittBot, then prepare and approve a structured plan under **Computer**.
- Coordinate clicks and consequential controls such as Send, Publish, Purchase, Delete, Install, Grant, and Save are blocked. Take over the Mac to complete those actions yourself.

## Recommendation

Build SplittBot first as a signed, desktop-first macOS app. It should launch Codex App Server locally, authenticate through the owner's ChatGPT account, and keep agent state, approvals, and local-tool policy on the Mac. No OpenAI API key is required for the initial Codex path.

The app should use a local web-technology UI inside a native macOS shell. The main process owns Codex, persistence, credentials, permissions, and tool execution; the UI never receives tokens or unrestricted local-process access.

## Account and availability boundary

Codex App Server supports ChatGPT sign-in for a rich local client. SplittBot should use that supported login flow and the Codex access included with the owner's plan, subject to the plan's model availability and usage limits. Third-party connectors may still require their own OAuth authorization.

This is a local runtime, not a cloud worker. Scheduled agents cannot continue while the Mac is asleep or offline. OpenAI image generation is also not assumed to be available through this no-key path and is outside the first release.

## Release roadmap

The first production slice should include:

1. Named agents with roles, avatars, instructions, and per-agent memory.
2. One-to-one chat, group workspaces, delegation, and visible handoffs.
3. Background task runs with progress, cancel, persisted retry, and notifications. **Implemented in Phase 2.**
4. MCP/OAuth connectors plus per-agent grants for user-configured services. **Implemented in Phase 2.**
5. Reviewed skills and awake-only scheduled routines. **Implemented in Phase 2.**
6. A centralized approval inbox and immutable action audit trail.
7. Per-agent connector, file, command, and application permissions.
8. Visible approval prompts, pause/takeover/emergency stop, and one serialized lane for GUI automation. **Implemented in Phase 3.**
9. Source control, CI, branded packaging, recovery, and notarization-ready releases. **Implemented in Phase 4; Apple credentials are required to publish.**
10. Image attachments, group workspaces, richer approvals, connector lifecycle, and explicit memory/retention controls. **Phase 5 image attachments are implemented; the remaining slices are planned.**

Prefer MCP, provider APIs, Shortcuts, Apple Events, and command-line interfaces over screen clicking. Accessibility/screen-based control should be enabled only when no structured integration is suitable and remains separately gated per agent and per plan.
