# Phase 2 implementation handoff

- Completed: August 21, 2026
- Application: SplittBot for macOS
- Runtime: local Codex App Server with ChatGPT-managed authentication
- OpenAI API key: not used

## Delivered

### MCP and OAuth connectors

- Reads live MCP state through `mcpServerStatus/list` and effective user configuration through `config/read`.
- Adds secure Streamable HTTP connectors or absolute-path STDIO executables through `config/value/write`, followed by a live MCP reload.
- Starts connector OAuth through `mcpServer/oauth/login`; the renderer only receives the HTTPS authorization URL and never receives OAuth tokens.
- Shows tool/resource/auth health and distinguishes user-configured connectors from Codex-owned runtime services.
- Grants user-configured connectors per agent. SplittBot reconstructs each complete MCP entry and changes only its per-thread `enabled` flag, avoiding the invalid partial-transport configuration that results from sending `{ enabled }` alone.
- Connector discovery is failure-isolated: a broken MCP server does not hide the skill catalog or local Shortcuts.

### Reviewed skill catalog

- Discovers skills for active agent working directories through `skills/list` and records local review status (`unreviewed`, `reviewed`, or `blocked`).
- Supports Codex’s global skill enable/disable operation through `skills/config/write`.
- Allows only reviewed skill paths in agent profiles and routines.
- Parses explicit `$skill-name` mentions, verifies enabled/reviewed/granted state, and sends both the text mention and the typed skill input item recommended by App Server.
- Records skill review and configuration changes in the local audit trail.

### Awake-only routines

- Persists daily local-time and minute-interval schedules in SQLite.
- Supports active/paused state, run-now, optional reviewed skill, zero to three retries, retry delay, and `always`/`failure`/`never` notifications.
- Detects application startup and wake gaps. Missed work follows the selected `runOnce` or `skip` policy and receives a durable attempt/audit record.
- Advances the next scheduled time before execution to avoid duplicate dispatch.
- Persists routine attempts and retry deadlines. Interrupted attempts are failed on restart and a remaining retry is recovered once without duplicating a newer attempt.
- Each routine creates an ordinary inspectable agent run in that agent’s persistent thread, model, effort, workspace, and grants.

### Notifications

- Stores approval, routine-completion, routine-failure, and missed-run notifications in SQLite.
- Shows unread state and mark-read/mark-all-read controls in the desktop.
- Uses native macOS notifications when supported; deterministic tests disable OS notification delivery while still testing the durable record.

### Apple Shortcuts adapter

- Discovers installed Shortcuts using the structured `/usr/bin/shortcuts` interface.
- Grants Shortcuts per agent.
- Stages the exact Shortcut name and text input as a durable approval. No Shortcut executes before a fresh **Approve once** decision.
- Passes input and output through a private temporary directory, invokes the executable with structured arguments rather than a shell, removes the temporary data, and stores returned text as an artifact.
- Records the request, decision, execution, and output presence in the audit trail.

The contents of a user-owned Shortcut are outside SplittBot’s ability to inspect. Only grant Shortcuts whose actions you have reviewed. A send, publish, purchase, delete, permission change, or production mutation must not be embedded in a drafting Shortcut.

## Security boundary

- ChatGPT/Codex credentials remain in the Codex-managed credential store.
- Connector OAuth tokens remain with Codex/MCP; SplittBot stores connector names and grants, not tokens.
- User-configured MCP connectors are disabled per agent unless granted.
- Codex-owned runtime services are displayed as runtime-managed and cannot be rewritten from the connector toggle UI.
- Consequential Codex requests, connector questions, temporary permission expansions, and local Shortcut runs use durable approval cards.
- Accessibility, screen capture, AppleScript UI scripting, keyboard/mouse control, and arbitrary screen automation are not enabled. Those remain Phase 3.

## Verification evidence

| Check | Result |
|---|---|
| Strict TypeScript typecheck | Passed |
| SQLite skill review, routine, attempt, and notification persistence | Passed |
| Daily/interval schedule calculation and missed-time advancement | Passed |
| Structured Shortcuts listing/run adapter with private input/output files | Passed |
| Deterministic App Server connector status, config, skill list, review, per-agent grant, and typed skill turn | Passed |
| Electron UI connector/skill grant, routine creation/run, and notification | Passed |
| Existing chat, approval, collaboration, archive, restart, and thread-resume regression flow | Passed |
| Live ChatGPT authentication, seven-model discovery, MCP catalog, skill catalog, connector-safe thread config, turn, restart, and resume | Passed |
| macOS package build, local signature verification, and packaged launch | Passed after running `npm run verify` |

Run deterministic, package, and launch checks with `npm run verify`. Run the opt-in live ChatGPT/Codex check with `npm run test:codex-live`.

## Phase 3 boundary

Phase 3 now delivers opt-in Accessibility and Screen Recording checks, one serialized GUI-control lane, live pause/takeover, emergency stop, and verification screenshots. See [Phase 3 implementation handoff](phase-3-handoff.md). None of those permissions or control paths are silently activated.
