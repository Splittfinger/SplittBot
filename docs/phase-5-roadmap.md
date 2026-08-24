# Phase 5 roadmap — production workflows

Phase 5 completes the everyday product workflows that sit above the verified local runtime, tool gateway, scheduler, and controlled GUI lane.

## Delivered first slice

- Export a saved artifact to a user-selected local Markdown or text file.
- Delete an obsolete routine and its attempt history after explicit confirmation.
- Surface the installed application version in Settings.
- Attach up to four validated local PNG, JPEG, or WebP images to a direct agent turn.
- Keep attachment paths in the main process, use opaque renderer IDs, and record metadata-only provenance in the audit history.

## Next implementation slices

### 5A — file-aware conversations (images delivered)

- The composer attachment control now selects and shows removable image chips.
- The main process validates canonical local paths, size, and PNG/JPEG/WebP file signatures at selection and send time.
- SplittBot passes images with the installed Codex App Server's typed `localImage` input while exposing only opaque selection IDs to the renderer.
- Run and audit history retain the image name, type, and size but not its local path or contents.
- Generic local documents remain pending until the installed App Server exposes a supported local-file input shape; SplittBot does not mislabel paths as prompt text.

### 5B — group workspaces

- Add a durable workspace with an explicit current-stage owner and selected members.
- Show handoffs and teammate contributions in one timeline.
- Keep each agent's thread, model, effort, sandbox, workspace, connector grants, and approvals separate.
- Default to mentioned agents only; require a deliberate opt-in for automatic coordination.

### 5C — richer approvals

- Add **Ask a question** without approving the pending action.
- Add **Edit and approve** only for request types whose exact payload can be safely rebound and revalidated.
- Show target resource, data leaving the Mac, reversibility, and post-approval behavior in structured fields.

### 5D — connector and memory lifecycle

- Add edit, reconnect, and remove controls for user-configured connectors.
- Prevent connector removal while a granted agent is actively using it.
- Add explicit agent-memory review, deletion, retention, and export controls instead of relying only on persistent Codex thread history.

### 5E — real-Mac acceptance

- Validate Accessibility and Screen Recording onboarding with the packaged bundle.
- Validate local iMessage read/search/draft flows without sending during acceptance.
- Exercise one real OAuth connector and revoke it afterward.
- Exercise sleep/wake routine catch-up and notifications.
- Record actual results without treating a deterministic adapter or an open permission panel as proof of access.

## Phase 5 completion gate

Phase 5 is complete only when the file, workspace, approval, connector, memory, and real-Mac acceptance slices above have implementation tests and a packaged-app verification record. Marketplace, mobile, enterprise SSO, and cloud execution remain separate future-edition decisions.

The current Phase 5 image slice passed the deterministic desktop flow and exact packaged-app launch on August 24, 2026. The separate live Codex smoke test also passed ChatGPT authentication and thread resume; it is not a substitute for the outstanding real-Mac permission and connector checks in 5E.
