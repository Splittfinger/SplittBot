# Apple 27 interface redesign

SplittBot 0.7 adopts an Apple-platform visual system for macOS 27 while retaining every Phase 0–6 workflow and the app's local-first security boundaries. The implementation follows Apple's current Human Interface Guidelines and uses the verified Apple iOS and iPadOS 27 community kit as a visual reference. Exact Figma node extraction was unavailable on the connected Starter workspace, so the production implementation is grounded in the official HIG rather than copied from inaccessible kit internals.

## Product-shell mapping

- The persistent left rail is a macOS-style primary sidebar. At wide window sizes it shows grouped labels; at compact widths it collapses to an icon rail.
- The agent roster is a secondary sidebar. It remains visible beside conversations and is removed from non-agent sections when horizontal space is limited.
- Navigation, conversation chrome, composers, menus, and modal overlays use a restrained translucent material with saturation and blur.
- Reading surfaces, forms, tables, approval cards, artifacts, and settings use standard opaque or near-opaque materials to preserve contrast and hierarchy.
- Typography uses the Apple system stack with platform-native weights, tracking, and type hierarchy.
- Controls share one accent color, consistent rounded geometry, clear hover/pressed states, and visible keyboard focus rings.

## Adaptive window behavior

| Window width | Navigation | Agent roster | Content |
| --- | --- | --- | --- |
| Above 1220 px | Labeled 184 px sidebar | 272 px | Full multi-column layouts |
| 1051–1220 px | 72 px icon rail | 250 px | Inspector hidden where needed |
| 900–1050 px | 72 px icon rail | Hidden outside Agents; 238 px in Agents | Single-column task surfaces |

The production macOS window can be resized down to 900 by 640 points. These compact behaviors also provide the layout foundation for a future native iPadOS shell without forcing tablet navigation conventions into the Mac app.

## Appearance and accessibility

- Light and dark appearances use semantic surface, separator, text, and selection tokens.
- Reduced Motion removes nonessential transitions and animations.
- Reduced Transparency replaces glass materials with solid surfaces.
- Increased Contrast strengthens separators, selection outlines, and card borders.
- Keyboard focus uses a high-visibility system-blue ring.
- Existing accessible names, roles, labels, and keyboard-operable controls are retained.

## Acceptance coverage

The desktop end-to-end test verifies the wide labeled sidebar, material separation, system typography, compact icon rail, conditional agent roster, and restoration to the wide conversation layout. The same test continues through the complete Phase 0–6 workflow to catch behavioral regressions. The packaged-app suite verifies the locally signed application, isolated renderer, and bundled Codex runtime.

## Official references

- [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/)
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)
- [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)
- [Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields)
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Windows](https://developer.apple.com/design/human-interface-guidelines/windows)
- [Apple iOS and iPadOS 27 Figma community kit](https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27)
