# SplittBot glass workspace

The September 8, 2026 refresh reimagines the desktop shell around Apple's material hierarchy: glass for navigation and controls, quieter standard surfaces for content. It replaces the previous flat three-column layout. The work follows official Human Interface Guidelines, not extracted Figma nodes.

## What changed

- A floating, rounded sidebar uses translucent material, edge highlights, capsule selections, grouped navigation, and an always-available New agent control.
- Native macOS under-window vibrancy sits behind the transparent renderer. A subtle blue/teal tint provides depth without decorative wallpaper competing with the content.
- Home, Actions, Tools, and other workspace pages use the full remaining width. The secondary roster now appears only in conversations.
- Home has a clearer greeting, grouped metrics, a durable attention queue, and full-width agent rows that open the selected conversation directly. Long names and recent-work summaries remain within their containers; recent work allows three preview lines.
- The conversation roster supports name/role search. Floating conversation controls include a working details-panel toggle, and the composer follows the same rounded material system.
- Account usage stays at the bottom of primary navigation in every section, including compact windows.
- Shared sheets, segmented controls, forms, menus, and feedback use consistent geometry, system fonts, and light/dark tokens.

## Implementation boundary

This remains an Electron application. BrowserWindow supplies native macOS vibrancy; glass.css supplies the custom glass-style navigation and controls. It is **not** a native AppKit NSGlassEffectView implementation and does not claim Apple's exact Liquid Glass refraction. Reading panels deliberately remain opaque or near-opaque, rather than blurring long agent outputs.

The material layer is centralized in src/renderer/src/glass.css, loaded after functional/layout defaults in styles.css. The obsolete Apple-theme override block was removed rather than retained underneath the new theme.

## Adaptive window behavior

| Window width | Primary navigation | Conversation roster | Details |
| --- | --- | --- | --- |
| Above 1320 px | 220 px labeled sidebar | 238 px, Agents only | Visible; user can hide it |
| 1221–1320 px | 220 px labeled sidebar | 238 px, Agents only | Hidden |
| 1051–1220 px | 72 px icon rail | 238 px, Agents only | Hidden |
| 900–1050 px | 72 px icon rail | 215 px, Agents only | Hidden; secondary content stacks |

The supported minimum window remains 900 × 640 points. Navigation scrolls when vertical space is limited while Settings and account usage remain available. Existing conversation drafts, attachments, and latest-message positioning are retained.

## Accessibility

- Native material updates when macOS appearance or accessibility preferences change, with its listener removed when the window closes.
- Reduced Transparency and Increased Contrast disable decorative blur and use solid surfaces. Increased Contrast strengthens separators and selection outlines.
- Reduced Motion removes nonessential transitions and animations.
- Keyboard focus remains visible, with rounded focus treatment on roster search and the composer.
- Current navigation exposes aria-current=page; agent cards and the attention shortcut are real keyboard-operable buttons.

## Verification

tests/e2e/glass.spec.ts uses isolated sample data and a deterministic runtime. It checks light/dark appearance, material separation, traffic-light position, direct agent navigation, roster search, details visibility, draft retention, compact overflow, reduced transparency, increased contrast, reduced motion, and renderer errors. It captures Home, conversation, Actions, Tools, editor, dark, and compact screenshots.

The existing desktop workflow suite still exercises account isolation, approval gates, scheduling, Actions, imports, drafts, and window reopening. Unit tests and the isolated packaged-app suite remain separate gates. These UI checks do not send messages, operate real mailboxes, change permissions, or establish public-release/notarization readiness.

### September 8 build acceptance

- Type checking and production build: passed.
- Unit tests: 57 passed. Desktop interaction/appearance tests: 7 passed, including the corrected navigation selectors in the end-to-end workflow. Packaged tests: 2 passed.
- Ad-hoc signature verification: passed for the staged build and installed `release/mac-arm64/SplittBot.app`, version 0.7.0, bundle ID `ai.splittbot.desktop`.
- Bundled runtime integrity and launch without an external Codex command: passed in an isolated profile.
- Screenshots: visually reviewed light/dark Home, conversation, compact layout, Actions, Tools, and agent editor; copies are in `design/glass-ui`.
- Live desktop replacement and final native visual inspection: passed after the user unlocked the Mac. The idle previous app was quit through its native menu and preserved at `/tmp/splittbot-before-glass.ppm3n4/SplittBot.app`. The staged build was copied to the same `release/mac-arm64/SplittBot.app` location, signature-verified, and both packaged tests passed again there. The exact installed app was then launched normally. Native screenshots confirmed the glass Home and conversation layouts; direct bot opening and the details toggle worked. Existing bots, run history, and authenticated Pro usage remained available. No bot task was started; the app was left on Home.
- Real mailbox actions, account sign-in, macOS permission changes, notarization, and publication: not performed.

## Official references

- [Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Apple Liquid Glass overview](https://developer.apple.com/documentation/technologyoverviews/liquid-glass)
- [Apple design resources announcement](https://developer.apple.com/news/?id=e2lxw9l1)
- [Electron BrowserWindow: vibrancy and window appearance](https://www.electronjs.org/docs/latest/api/browser-window)
