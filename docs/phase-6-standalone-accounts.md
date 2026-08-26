# Phase 6 — Standalone runtime and account-aware authentication

## Delivered

- Packaged SplittBot now resolves `Contents/Resources/runtime/darwin-<arch>/codex` before any development fallback.
- `npm run package:mac` copies a locally supplied Codex executable, verifies that it runs, records its version, byte length, and SHA-256 hash, and embeds it before the app is signed.
- The runtime receives an app-owned `CODEX_HOME` at `<SplittBot data>/codex-profile`. ChatGPT browser sign-in, MCP OAuth credentials, config, and runtime state no longer depend on a separately running ChatGPT or Codex app.
- Development overrides remain available through `SPLITTBOT_CODEX_COMMAND`, `SPLITTBOT_CODEX_PATH`, and `SPLITTBOT_CODEX_HOME`.
- Settings reports whether the runtime is bundled and shows the app-owned profile boundary.

The first launch intentionally starts with a fresh profile. The user signs in once and reconnects required services. SplittBot does not silently copy authentication files or config that may contain static secrets from `~/.codex` or the ChatGPT app.

## Connector account model

A connector is the source definition; a connector account is one authenticated identity on that source.

1. The user adds one secure HTTP MCP connector source.
2. Creating an account identity clones the complete source transport configuration under a generated, non-user-facing MCP server name.
3. Codex starts OAuth against that unique server name, producing a distinct credential slot.
4. SplittBot stores only the account UUID, source name, friendly label, optional login identifier, and generated runtime name in SQLite.
5. An agent grant contains account UUIDs. Per-thread configuration enables only those UUIDs; other identities on the same source are explicitly disabled.
6. A source endpoint cannot be edited or removed while account identities exist, which prevents an OAuth credential from being reused against a different service. Removing an account revokes OAuth when connected, deletes its runtime config, and removes its grants from every agent. Active work blocks removal.

Existing shared connector grants remain supported for migration compatibility. New multi-user workflows should use connector-account grants.

## Verification

- Unit coverage validates bundled-runtime precedence, app-owned profile selection, account persistence across restart, and grant cleanup on removal.
- Desktop end-to-end coverage creates two OAuth identities on one source, grants one to Atlas and the other to Maya, and inspects the actual `thread/start` and `thread/resume` payloads to prove the identities are oppositely enabled.
- Packaged acceptance verifies the exact signed app contains a runtime and manifest, then launches without a Codex command override or useful Codex path and confirms Settings reports `Bundled with SplittBot`.
- Clean CI uses an explicit non-production runtime fixture so it can exercise the same package and no-external-runtime path without downloading or committing a Codex binary. Production prep rejects non-Mach-O or wrong-architecture inputs unless that test-only override is deliberately set.

## Evidence boundary

The deterministic OAuth fixture proves isolation and routing, not a real provider login. Each provider's live OAuth connect/revoke remains a user-driven, evidence-gated acceptance step. Public distribution additionally requires both architecture binaries, confirmation that their redistribution terms permit embedding, and the existing Developer ID/notarization credentials.
