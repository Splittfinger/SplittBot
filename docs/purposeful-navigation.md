# Purposeful navigation — September 8, 2026

The Home summaries are now shortcuts, not decorative counters. Each is a keyboard-operable button with an explicit action label, chevron, hover feedback, and visible focus.

| Home shortcut | Destination |
| --- | --- |
| Active agents | Agent conversations, or agent creation if the team is empty |
| Working now | Only queued, running, and approval-blocked attempts |
| Needs attention | Open Action Center items |
| Need approval | Pending approval requests, not resolved history |

Zero counts still lead to a useful empty state with navigation to agents or history. Selecting a summary never starts a bot or grants approval.

## Related dead ends repaired

- Individual Home actions select that exact item; recent results select the exact run.
- Runs now have status filters and selectable records exposing the full request, result/error, status, timestamps, agent conversation, and captured actions.
- Source-run links can load a retained record older than the recent 100-run snapshot through a typed, UUID-validated, read-only IPC route. A missing record is reported rather than silently substituting another result.
- Action Center summary counts filter their corresponding queues, including due-soon items. The detail pane can no longer show an unrelated item excluded by the current filter/search. Captured-action links scope the queue to the originating run, with an explicit way to clear that scope.
- Conversation starter cards fill and focus the draft without sending it. Existing draft text is preserved.
- The conversation inspector links to schedule editing and collaborator conversations.
- Saved artifacts can be read in full inside the app, exported, or followed back to their source run/agent.
- Notifications offer explicit destinations and a separate mark-read action. Notices with no destination remain records rather than pretending to be clickable navigation.
- Pending approvals and approval history are separate views. Reviewing history or navigating to a request never approves it.
- A connector with no setup URL now shows an explanatory note instead of a permanently disabled "Managed in ChatGPT" button. A source audit checked the remaining button elements for action handlers.

## Scope and verification

Status badges, evidence, audit entries, and explanatory text remain clearly informational. Their purpose is to support a decision or provide accountability; they are not disguised as action controls. Existing Tools, Workspaces, Routines, Memory, Computer, and Settings operations retain their approval and access boundaries.

The navigation regression suite checks all four shortcuts, zero-count states, keyboard activation, draft preservation/no auto-send, exact action selection, action filtering, full saved outputs, notification destinations, live-work filtering, pending-versus-historical approvals, and older source-run retrieval. All tests use isolated data and a deterministic runtime. The complete desktop suite and unit suite also pass. No real mailbox task, send, permission grant, or account change is part of these checks.

Screenshots in `design/purposeful-navigation` contain synthetic test data, not live user results. Package and live-Mac acceptance are recorded separately after installation.

### Installed-build checks

- Production build and type checking passed; 57 unit tests, 9 desktop interaction/appearance tests, and 2 isolated packaged-app tests passed.
- Source inspection found 162 HTML button elements, each with an action handler. Conditional disabled states still protect incomplete forms, unavailable capabilities, and in-progress operations.
- The exact installed bundle is `release/mac-arm64/SplittBot.app` (`ai.splittbot.desktop`, version 0.7.0). Its ad-hoc signature and bundled-runtime launch passed verification.
- The previous version was cleanly quit while idle and preserved at `/tmp/splittbot-before-navigation.d2FwAY/SplittBot.app` before replacement.
- Live native-app inspection passed: all four Home shortcuts opened their intended destinations with the user's existing data. Working now and pending approvals correctly showed empty states, Needs attention opened the open queue, and Active agents opened the team conversation. Existing run counts were unchanged; the app was left on Home.
- No account, connector grant, Mac permission, public-release, or notarization changes were made.
