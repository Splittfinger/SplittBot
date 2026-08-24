# Phase 4 implementation handoff

- Completed: August 24, 2026
- Version: 0.4.0
- Repository: https://github.com/Splittfinger/SplittBot
- Runtime: local Codex App Server with ChatGPT-managed authentication
- OpenAI API key: not used

## Delivered

### Source and continuous verification

- Established the verified Phase 0–3 implementation as the first `main` commit in the public GitHub repository.
- Added macOS GitHub Actions verification for dependency audit, typecheck, unit tests, Electron E2E, local packaging/signature verification, and packaged launch.
- Added monthly Dependabot checks for npm and GitHub Actions dependencies.
- Added a private vulnerability-reporting policy that explicitly excludes credentials, conversations, databases, and screenshots from public issues.

### Branded local and production packaging

- Added a 1024×1024 SplittBot application icon and verified that the packaged bundle contains the generated `.icns` resource.
- Kept `npm run package:mac` deterministic and locally ad-hoc signed for development on this Mac.
- Added `npm run dist:mac` for a universal DMG and ZIP using Developer ID signing and notarization.
- Added a tag-triggered GitHub release workflow that requires the release tag to match `package.json`, validates notarization stapling, writes SHA-256 checksums, and publishes only the resulting DMG/ZIP artifacts.

The production workflow expects these GitHub Actions secrets and never stores them in the repository:

- `MAC_CSC_LINK`
- `MAC_CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

### Local data recovery

- Added **Settings → Data and recovery** with explicit create-backup, restore-backup, and reveal-data actions.
- Backups are owner-only SQLite files created from the live in-memory database, including agent profiles, conversations, grants, routines, approvals, artifacts, and audit history.
- Restore validates the SQLite header, integrity result, and required SplittBot tables before stopping the runtime.
- Restore creates an owner-only timestamped safety copy of the current database, replaces the live database atomically, and restarts the app.
- GUI screenshot files are not duplicated by a database backup; their recorded paths remain valid when restoring on the same Mac. The Settings UI states this boundary.

### Lifecycle controls

- Artifacts can be exported to a user-selected Markdown or text file.
- Routines can be deleted with an explicit confirmation; their attempt history is removed in the same database transaction.
- Settings shows the installed SplittBot version.

## Verification

Run the complete deterministic suite with:

```bash
npm run verify
```

The Phase 4 suite covers backup creation and validation, safety-copy restoration, invalid-backup rejection, artifact export, routine deletion, app icon packaging, the existing Phase 0–3 desktop workflow, code-signature verification, and packaged launch.

Verification completed on August 24, 2026:

- `npm run verify`: passed 11 unit-test files / 18 tests, the full Electron desktop flow, local packaging and code-signature validation, icon-resource validation, and launch of the exact packaged `release/mac-arm64/SplittBot.app` bundle.
- `npm run test:codex-live`: passed ChatGPT authentication, model/skill discovery, one live turn, App Server restart, and persistent-thread resume. The observed account was ChatGPT Pro with 7 models and 111 skills; this is a point-in-time runtime result, not a guarantee of future availability.
- `npm audit --omit=dev`: reported 0 vulnerabilities.

This live protocol check does not claim that Accessibility, Screen Recording, iMessage access, or third-party OAuth acceptance has been completed; those remain in the Phase 5 real-Mac acceptance slice.

Run the separate live ChatGPT/Codex protocol check with:

```bash
npm run test:codex-live
```

## Publication boundary

Phase 4 prepares but does not fabricate Apple credentials. A public GitHub Release is complete only after the owner supplies a valid Developer ID Application certificate and Apple notarization credentials as repository secrets, pushes a version-matching tag, and the signed-release workflow passes.

The generated app icon was created with Codex's built-in image-generation capability and saved as `build/icon.png`. It did not use an OpenAI API key.
