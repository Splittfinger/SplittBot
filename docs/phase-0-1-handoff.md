# Phase 0–1 implementation handoff

- Completed: August 21, 2026
- Application: SplittBot for macOS
- Runtime: local Codex App Server with ChatGPT-managed authentication
- OpenAI API key: not used

## Delivered

### Phase 0 — feasibility

- Resolves the Codex executable installed inside the ChatGPT desktop application, with environment and PATH fallbacks.
- Launches and supervises `codex app-server` over newline-delimited JSON-RPC on standard input/output.
- Completes the required `initialize` / `initialized` handshake.
- Reads ChatGPT authentication state and starts the documented browser sign-in flow when needed.
- Discovers the models and reasoning options available to the signed-in account.
- Creates persistent Codex threads and resumes them after an App Server restart.
- Streams agent message and plan events and handles completed, failed, and interrupted turns.
- Builds a runnable macOS `.app`, gives it an ad-hoc local signature, and verifies that signature.

### Phase 1 — agent desktop

- Three-pane desktop interface with command center, agent roster, direct conversations, runs, approvals, artifacts, audit history, and settings.
- Create, edit, and archive named agents with role, instructions, live plan-aware model selection, model-supported AI effort, working directory, access mode, app list, command templates, and network policy.
- Per-agent initials, emoji, or local image avatars. PNG/JPEG/WebP uploads are magic-byte validated, limited to 5 MB, converted to a local data URL, and never sent to a separate image service.
- `@AgentName` and `@all` autocomplete in agent instructions and chat, with unique agent names for deterministic routing.
- Real agent-to-agent handoffs: each collaborator executes a separate turn in its own persistent thread with its own model, effort, sandbox, grants, workspace, and approval flow; the primary agent receives the contributions for final synthesis.
- Local SQLite database for agents, messages, thread identifiers, runs, handoffs, approvals, artifacts, and audit events, including migrations for existing Phase 0–1 databases.
- Persistent thread-to-agent mapping and automatic fallback to a replacement thread if a stored thread cannot be resumed.
- Read-only or workspace-write Codex sandbox policies derived from each agent profile.
- Durable user approval cards for Codex command-execution and file-change requests.
- Streaming UI, stop/cancel handling, run recovery, error cards, and saved response artifacts.
- Context-isolated, sandboxed renderer with no Node.js access and a narrow Zod-validated IPC surface.
- External navigation denied by default; only explicit HTTPS links can open in the system browser.
- JSONL operational logs with recursive secret and bearer-token redaction.

## Verification evidence

The following checks passed on the target Mac:

| Check | Result |
|---|---|
| TypeScript strict typecheck | Passed |
| SQLite persistence and interrupted-run recovery | Passed |
| Agent model, AI effort, emoji avatar, collaborator IDs, and handoff persistence | Passed |
| Avatar signature validation for PNG, JPEG, WebP, and renamed invalid files | Passed |
| Recursive secret redaction | Passed |
| JSON-RPC initialize, streaming, approval response, restart, and resume against deterministic App Server | Passed |
| Electron UI: chat, streaming result, approval gate, model/effort selection, emoji avatar, `@AgentName` handoff, synthesis, archive, restart, thread resume | Passed |
| Renderer isolation: `process` and `require` unavailable | Passed |
| Live ChatGPT-authenticated account read and model discovery | Passed |
| Live Codex turn | Returned the expected Phase 0 marker |
| Live App Server restart, thread resume, and second turn | Returned the expected resume marker |
| macOS application build and ad-hoc signature verification | Passed |
| Packaged application launch and UI smoke test | Passed |
| Packaged application using the installed live ChatGPT/Codex runtime | Passed |

Run deterministic checks with `npm run verify`. The live subscription check is deliberately separate and runs with `npm run test:codex-live`.

## Local state

By default, Electron stores SplittBot data in its macOS user-data directory. The primary database is `splittbot.sqlite`, and redacted operational logs are in `logs/splittbot.jsonl` beneath that directory.

SplittBot reuses the standard Codex authentication managed by the installed ChatGPT/Codex runtime. Set `SPLITTBOT_CODEX_HOME` only when an intentionally separate Codex profile is required.

Development and tests can isolate state with:

- `SPLITTBOT_DATA_DIR`
- `SPLITTBOT_DATABASE_PATH`
- `SPLITTBOT_DEFAULT_CWD`
- `SPLITTBOT_CODEX_PATH`
- `SPLITTBOT_CODEX_COMMAND` and `SPLITTBOT_CODEX_ARGS_JSON` for protocol fixtures

## Distribution boundary

The generated app is locally and ad-hoc signed, which is appropriate for development and validation on this Mac. Public distribution still requires an Apple Developer ID certificate, production entitlements, notarization, a branded application icon, and release/update infrastructure.

## Phase 2 boundary

This was the Phase 0–1 boundary at the time of handoff. Connectors, MCP catalog management, reviewed skills, awake-only scheduling, notifications, and the approval-gated Shortcuts adapter are now delivered in [Phase 2](phase-2-handoff.md).

Accessibility and screen-driven Mac control remain Phase 3 and are not silently enabled by this build.
