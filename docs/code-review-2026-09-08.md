# SplittBot code review and optimization — September 8, 2026

## Outcome

Completed a cross-cutting source review and targeted reliability, performance, privacy, and packaging improvements. The updated local macOS build is available. Automated checks pass; live authenticated-agent and computer-control acceptance require renewed user sign-in and Mac permissions.

Scope: Electron lifecycle and IPC, runtime discovery/transport, agent orchestration and collaboration, account/connector grants, schedules, database/recovery, Actions, imports, local automation, GUI control, renderer state/layout, dependencies, packaging, CI, and existing tests. This is a code review with regression testing, not a penetration test or a guarantee that every defect is eliminated. Existing unrelated workspace edits were preserved. No GitHub push, tag, or public release was made.

## Findings addressed

| Priority | Finding | Change and verification |
| --- | --- | --- |
| High | A failed connector-config read could result in incomplete access overrides. | Agent turns now stop if connector settings cannot be verified. Connected apps default to disabled even when discovery returns none. Regression covers failed configuration. |
| High | Concurrent starts could use the runtime before initialization; broken pipes and failed child launches could leave a false running state. | Startup is shared until initialization completes; transport failures reject pending requests and retire the exact child. Late approval replies cannot reach a replacement child. Slow startup, failed launch, crash, and recovery tests pass. |
| High | Multiple turns for one agent could race thread creation or overlap on its persistent thread. | Serialize each agent's turns while allowing different agents to progress independently. Locking is per turn, not the whole collaboration, avoiding circular team-lock waits. Four rapid messages reuse one thread and complete. |
| High | Very fast completion notifications could arrive before a turn was registered and then be lost. | Buffer startup notifications, register the turn, and replay them. A fixture that completes before its start response now succeeds. |
| High | Cancellation during setup could be overwritten; approval cancellation could leave a queue blocked; cancelled routines could retry. | Recheck cancellation at setup boundaries, reject local waits, interrupt the runtime, expire ended approvals, avoid resurrecting terminal runs, and never retry user-cancelled routines. Regression covers setup, queued work, pending approval, and routine cancellation. |
| High | Working database files used ordinary permissions; repeated exports reset SQLite foreign-key enforcement. | Atomic private writes use mode 0600; restore foreign-key enforcement after each export. Tests check file mode, persistence, and rejection of orphan records. This is file permission protection, not encryption. |
| Medium | Each logical mutation exported and rewrote the full database. | Coalesce concurrent writes using a revision-aware flush; wait for tracked work and pending persistence on shutdown/restore. Forty concurrent mutations require at most two writes in the regression test and all survive reopen. |
| Medium | Agent history loaded the oldest 300 messages, omitting the newest conversation in longer threads. | Fetch the newest bounded window and return it chronologically, with a stable row-order tie breaker. A 320-message test returns messages 20–319. Older messages remain stored; there is still no user-facing history pagination. |
| Medium | Renderer snapshot requests overlapped; event subscriptions and streaming updates did excess work. | Coalesce refresh bursts, ignore stale selection responses, keep the subscription stable, and batch text deltas once per frame. The queue test reduces an initial refresh plus 1,000 pending requests to two executed refreshes. No wall-clock speedup is claimed. |
| Medium | Draft text was shared across agents and attachments could land on the wrong agent after a delayed picker. | Keep drafts and attachment lists per agent; capture the intended recipient before awaiting the picker. Clear only the submitted draft/attachments. Desktop test verifies switching both ways. Drafts are in-memory, not durable across app restart. |
| Medium | Closing the last Mac window could prevent Dock activation from reopening it or lead to duplicate initialization. | Separate window creation from service/IPC setup, clear the closed reference, and focus/reopen the existing application safely. Desktop test verifies close, reopen, and repeated activation. |
| Medium | Catch-up iterated through missed intervals and failed after sufficiently long downtime. | Calculate the next interval directly while preserving alignment; compute daily schedules from current local time. A years-long one-minute schedule gap is covered. |
| Medium | Missing scheduled skills were silently omitted. | Fail the attempt with a clear error; existing enabled/review/grant checks still run before invoking an available skill. |
| Medium | Interrupted collaboration and AI Action follow-ups could remain “running” or “waiting” after restart. | Mark interrupted handoffs failed and only interrupted AI-linked Action items blocked. Ordinary user-managed Waiting items remain unchanged. Reopen test covers both. |
| Medium | GUI ownership was claimed after awaiting permissions, allowing competing executions. | Reserve the single control lane before asynchronous checks and release it on every failure. An emergency stop during a delayed permission check executes no GUI commands. |
| Medium | Incomplete import pagination could label older monitored tasks missing. | Treat absence as deletion evidence only after complete discovery, not when the 300-task cap stopped enumeration. |
| Medium | Scheduled Actions could retain Scheduled status after their date was cleared. | Validate the resulting combined date/status, including explicit null. Regression permits moving to Next while clearing the date but rejects Scheduled without a date. |
| Medium | Packaging and CI could select the wrong app or omit the code-mode host. | Target the explicit/current-architecture bundle for signing/tests, support an explicit bundle override, supply both fixture runtime components in CI, and map x64 to Mach-O's x86_64 name. Verify both embedded executable hashes and sizes. |
| Medium | Two development-only transitive dependencies had published advisories. | Updated @xmldom/xmldom 0.8.14 → 0.8.15 and fast-uri 3.1.5 → 3.1.7, without major upgrades or dependency overrides. Full npm audit reports zero known vulnerabilities. |
| Low | A failed first snapshot could leave only an indefinite loading screen. | Show the error with a retry button. |

Dependency advisory references: [xmldom advisory](https://github.com/advisories/GHSA-6gmq-8vp8-gcm6) and [fast-uri advisory](https://github.com/advisories/GHSA-f65p-4m7j-42xc). These affect build-tool dependencies in this checkout, not evidence of exploitation of SplittBot.

## Verification record

| Gate | Result | Evidence |
| --- | --- | --- |
| TypeScript | Passed | `npm run typecheck` |
| Unit/integration tests | Passed | 57 tests across 19 files; baseline was 39 tests across 17 files |
| Desktop UI tests | Passed | 6 Playwright flows, including drafts/Dock, grants/accounts, collaboration, approvals, Actions, layouts/history, usage, and manual-only import |
| Dependency audit | Passed | Full `npm audit`: zero known vulnerabilities, including development dependencies |
| Production build/package | Passed | `npm run package:mac` with real arm64 runtime and code-mode host |
| Local signature | Passed | Strict deep codesign verification of the exact bundle below; ad-hoc signature, not Developer ID/notarization |
| Packaged smoke tests | Passed | Isolated renderer launch plus standalone bundled runtime startup without an external Codex command; manifest checks |
| Actual installed-app launch | Passed | Native UI identified the exact app.asar path below; existing agents and local Actions were retained; no automatic import picker |
| Live authenticated model turn | Blocked | Runtime reported an expired token and `refresh_token_reused`; Settings displays Not signed in. Sign in again through Settings. Credentials were not copied, replaced, or exposed. No real bot was run. |
| Current Mac GUI permissions | Blocked | Computer page reports Accessibility denied and Screen Recording denied for this rebuilt app. Existing historical acceptance records are not current passes. Re-enable this exact copy before live GUI testing. |
| Live iMessage, OAuth connect/revoke, real sleep/wake | Not run | No test messages, mailbox changes, connector revocations, or simulated claims of live acceptance |
| Public distribution | Not run | No Developer ID signing, notarization, universal Intel execution, GitHub release, or clean-Mac installation |

Test counts describe this review's latest checks; they do not imply exhaustive scenario coverage. Native acceptance followed the packaged-app checklist, keeping deterministic tests separate from live permissions and authentication.

## Exact local build

- Checkout: `/Users/markallen/Documents/ChatGPT/SplittBot`, branch `main`.
- App: `/Users/markallen/Documents/ChatGPT/SplittBot/release/mac-arm64/SplittBot.app`.
- Identity: `ai.splittbot.desktop`; version remains `0.7.0`; architecture arm64; Electron `43.4.1`.
- Bundled runtime: `codex-cli 0.153.4`, sourced from the installed ChatGPT runtime during packaging. Its code-mode host is embedded alongside it. No separate running Codex desktop is required.
- Runtime SHA-256: `a30ec314bbd0e3721632234d07db7c99855db3b9f1e32dbe8c791947f07e7629`.
- Code-mode host SHA-256: `fdd977821def000939dd48da48b39d581845470671135bd4642584eeb0762a6b`.
- Previous app copy retained at `/tmp/splittbot-before-review.tbNAVo/SplittBot.app`. This is a temporary local rollback copy, not a durable data backup.
- The rebuild did not delete conversations, agents, or Actions. The working database was upgraded to private file permissions on normal startup.

## Remaining risks and recommended next work

1. **Security boundary — important:** the readable-root list is profile metadata and the command templates are model instructions, not complete OS-enforced read/command allowlists. Runtime read-only/workspace-write/network policies and connector enablement provide narrower controls, but do not make every third-party tool harmless. Consequential external-tool behavior still depends on runtime/provider approval support and agent compliance. Do not position these profiles as hostile-tenant isolation. Stronger tool-by-tool authorization and filesystem enforcement require a dedicated design and adversarial tests before broader distribution.
2. **Large histories:** database export remains whole-file, now coalesced. For much larger datasets, benchmark real workloads before migrating to incremental native SQLite/WAL, paginated history, and narrower snapshot APIs.
3. **Maintainability:** the renderer and orchestration service remain large. Extract feature modules incrementally behind the expanded tests, rather than performing a broad rewrite in this maintenance pass.
4. **Release process:** CI has a deterministic runtime fixture; release jobs still require provisioned real runtimes for both architectures, redistribution clearance, Apple credentials, notarization, and clean-install acceptance. A local green build does not satisfy those gates.
5. **Current user action:** sign in again in SplittBot Settings and re-enable Accessibility/Screen Recording for the exact rebuilt app. No permission changes or fresh OAuth authorization were performed during this review.
