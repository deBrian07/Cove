# Cove continuation — 2026-10-26

## Objective and boundaries

Cove is an unfinished native Chromium fork targeting the supplied Arc screenshots and workflows. Use native source and the ordered patch series. Electron stays retired in `legacy/electron/`. Do not call the result exact Arc parity or fully validated. Make focused commits without co-author trailers.

The user authorized closing all Cove instances and reopening the isolated QA profile. Preserve Arc, other apps and all saved browser data. Normal `npm start` uses CoveDevelopment; QA must use a separate CoveUIValidation-* profile. Never reset a profile to fix UI behavior.

## Active storage

- Repository: `/Users/brianchen/Documents/Cove`
- External backing image: `/Volumes/SanDisk 1TB/CoveChromium/CoveBuild.sparsebundle`
- Ignored project link: `CoveChromium/CoveBuild.sparsebundle` points to that image.
- Retained internal backup: `CoveChromium/CoveBuild.local-backup.sparsebundle`
- APFS mount: `/Volumes/CoveBuild`
- Checkout: `/Volumes/CoveBuild/checkout`
- Source: `/Volumes/CoveBuild/checkout/chromium/src`
- Output: `/Volumes/CoveBuild/checkout/chromium/src/out/Cove`
- App: `out/Cove/Cove.app`; executable `Contents/MacOS/Cove`; bundle `dev.cove.browser`
- Normal profile: `/Volumes/CoveBuild/checkout/profiles/CoveDevelopment`
- Chromium: `156.0.8078.48`, revision `d0c02bfad08ec92a6ffcf989e53cd995e6381a4c`

The SSD remains ExFAT, with source/builds inside its dedicated APFS image. No disk was reformatted. Do not mount the internal backup and external copy simultaneously: they share an APFS identity and mount point. Do not let a missing external mount silently create an internal `/Volumes/...` directory. Keep the 20 GiB build reserve. Quit Cove and stop builds before detaching/ejecting normally; never force-detach a busy image.

On reconnection, `python3 scripts/chromium/cove_chromium.py doctor --stage run` mounted the existing image and passed. It reported 655.4 GiB inside the image and 811.68 GiB on the backing SSD at that check. Reuse the checkout and out/Cove; do not reset or delete them.

## Build and launch

```sh
npm run doctor
npm start
npm test
npm run test:ui
npm run chromium:gen
npm run build -- --jobs 2
```

`npm run build` already maps to the native build command. The build and launch guards compare the ordered patch/configuration digest with `generated_config` and `built_config` in `/Volumes/CoveBuild/checkout/.cove-chromium-state.json`. Do not edit patch inputs during GN/Ninja. Root repository commits do not change the pinned Chromium checkout revision.

This is a component development build. Keep the complete out/Cove and image available; copying only Cove.app is not a standalone distribution. Signing, packaging and updating remain unfinished.

## Saved work

- `b9d6df1`: build identity and ordered patch verification.
- `76e3020`: patches 0013–0022, navigation and live Space ownership.
- `37da263`: patches 0023–0036, native sidebar layout and persistent workflows.
- `46628f7`: patches 0037–0047, rendered layout, command-bar geometry, pin/canvas presentation and control lifetime fixes.
- `bdc093f`: patches 0048–0053, reserved focus shortcuts, Cocoa menus, organized canvas protection, active pin appearance and the accessibility lifetime regression.
- `9ecabbc`: patches 0054–0055, tab-list visibility and navigation-driven canvas/Archive Today state.

The complete 55-patch series is committed and built. Both generated_config and built_config equal `d623603353096572a62dd1ea4be06bb221d3a7b0e412855bdce177e3fac77ab3`. Final GUI checks confirmed tab rows and Archive Today become available after in-place canvas navigation, Archive closes the ordinary page while preserving the window, and Cmd+Shift+T restores the page with its visible row. Queued cleanup then removes the temporary placeholder. Final native renderer smoke passed. Read VALIDATION.md before claiming broader parity.

## Implementation that matters for safety

0018 parks detached native Tab/Group/Split collections per window rather than closing/recreating pages on Space changes. It preserves WebContents, drafts, JavaScript, history and active selection. Incoming tabs are inserted before outgoing tabs detach, avoiding the last-tab close path. Inactive pages rejoin Chromium's unload/session pipeline before window close; cancellation parks them again. Retain the corresponding 0020 delayed-tab-metrics and 0021 split-navigation guards for detached tabs.

0033–0036 bind persistent pins to stable live native handles. A navigated pin reuses its current page; after closing, its saved row reopens the stored home URL. Retained pin close uses native beforeunload without Chrome's extra pin toast. Last-pin close and Archive Today keep a marked blank canvas instead of closing the window. Archive uses normal close/history and retains pins/Favorites.

0040 hides the duplicate expanded native pin grid only when every native pin is represented by the library. Collapsed/uncovered native pins retain upstream rendering. 0041 marks only Cove-created placeholders and performs deferred stable-handle cleanup. 0043 distinguishes ordinary user-created about:blank tabs from those placeholders. 0051 excludes pinned, split or grouped canvases from cleanup, including a final recheck before closing a handle. Do not remove these model/lifecycle guards as a cosmetic shortcut.

0049 reserves sidebar location/search focus before macOS's first responder while preserving the upstream app/fullscreen policy gates. Cmd+L routes to the visible address field; command dispatch through hidden toolbar actions is also handled.

0050 uses system Cocoa menus on macOS. Destroy the old menu runner before replacing its model. Keep the native MenuButton controller, pressed lock and weak guard after RunMenuAt, because the Cocoa call can block and an action can rebuild/delete its originating button.

0052 updates pin selection/favicon styling in place instead of recreating buttons on selection/navigation. It also adds native folder icons and corrects footer icon/dot insets. 0053 fixes the reproduced accessibility use-after-free in View::HandleAccessibleAction: a native menu action can delete the pressed view, so a ViewTracker must suppress the subsequent synthetic release when the target no longer exists.

0054 derives unpinned-list visibility from newly calculated bounds, not the scroll view's previous hidden state. 0055 refreshes canvas coverage and Archive Today availability when a tab changes, including navigation of an existing placeholder without a model insertion.

## Verification

See `VALIDATION.md` for the final build digest and latest GUI results.

- All 32 build-tool Python tests and 4 patch-verifier tests pass.
- The ordered series applies against the original pinned upstream files with SHA256 checks. `/tmp/cove-original-source` is a disposable fixture, reconstructed from `git show HEAD:<path>` using native/upstream-files.json. Do not pass the patched checkout to verify_patches.py as original source.
- Native application builds and renderer smoke tests have passed repeatedly. Final state must still match the current patch/config digest.
- The native `cove_accessibility_lifetime_smoke` executable passed. It calls the real View accessibility default-action dispatcher with a small custom event fixture, checks normal press/release, and checks target deletion during press. It initializes AXPlatform and avoids unrelated Widget/AppKit setup. This is not a full Cocoa/widget test.
- Real GUI checks passed for repeated native folder creation, Favorite addition, Cmd+L navigation after menus, one-press persistent pin close, selected pin state, command-bar URL submission/dismissal, split creation from a marked empty Space, right-pane navigation, pane focus and separation. Both separated tabs remained reachable through native tab cycling.
- Earlier live-Space QA preserved the exact page UUID, unsent draft and history across a Space round trip. Inactive guarded pages participated in native beforeunload; cancellation preserved the original live page.

The full browser_tests/unit_tests/interactive_ui_tests binaries have not run. Five CoveSidebarLibraryBrowserTest source cases, split/pin command regressions and the detached-metrics regression are not execution evidence. Earlier WebUI test TypeScript compiled, but those browser tests were not executed.

To build/run the small native lifetime check after a valid gen/build:

```sh
export PATH="/Volumes/CoveBuild/checkout/depot_tools:$PATH"
export DEPOT_TOOLS_UPDATE=0 DEPOT_TOOLS_METRICS=0
cd /Volumes/CoveBuild/checkout/chromium/src
autoninja -C out/Cove -j 2 cove_accessibility_lifetime_smoke
out/Cove/cove_accessibility_lifetime_smoke
```

## QA cautions

Use CUA for UI interaction. Freshly read AX state before using element IDs. Native menus can lose stale AX item handles between tool calls; direct mouse opening and keyboard item selection in one interaction worked. Cmd+T needs an observation after opening before typing into its newly focused WebUI field. Verify the query text before submitting; automation paste/typing occasionally failed to deliver the intended punctuation or text. Do not diagnose that as a navigation classifier bug without inspecting the actual field value.

A real crash at `/Users/brianchen/Library/Logs/DiagnosticReports/Cove-2026-10-26-205025.ips` had a null virtual dispatch from View::HandleAccessibleAction during native accessibility activation. The ViewTracker fix addresses that exact gap; the small native regression passed. After a crash, CUA can auto-launch a default-profile window. Confirm the process/profile before further input instead of treating that window as QA.

Unique renamed QA app bundles caused very long CUA attachment calls, including a 3682-second stall, despite the underlying native build already succeeding. Prefer the production dev.cove.browser bundle with exactly one explicitly launched QA-profile instance. The ordinary run command intentionally refuses profile overrides, so QA launch is a separate controlled development operation. Never weaken Keychain, browser security warnings or OS permissions to fix an attachment problem. Mock Keychain is confined to explicit test profiles; normal npm start does not use it.

A local-only fixture at `/tmp/cove-runtime-fixture` is served on 127.0.0.1:8765 for forms, stable page identity, history and beforeunload. Temporary files/logs disappear across reboots; retain conclusions here rather than relying on /tmp alone.

## Next work, in order

1. Persist per-Space ownership across native session restore. Current shutdown reunites inactive tabs for Chromium persistence, so restart can merge ownership; URL snapshots are only a fallback. BrowserLiveTabContext::GetExtraDataForTab and SessionService::AddTabExtraData can store a stable Space ID. Restore it in browser_tabrestore.cc before insertion. Persist the active Space per window via GetExtraDataForWindow too. Reconstruct detached ownership after bulk restore, preserving native groups/splits and respecting canceled unload. This was researched, not implemented.
2. Complete pin-model unification, home/reset behavior, folder move/reorder coverage, nested folders and dragging between folders/Spaces. Favorites are global saved URLs; do not infer complete global live-tab ownership from that.
3. Add Arc-style pane-specific URL/navigation headers and joined split rows. Current native controls support two panes; exact reference layout, drag-to-split and more panes remain unfinished.
4. Finish Space shortcuts, recent-tab chooser, configurable keybindings, Peek, Little Arc and import.
5. Measure focus/frame-time/memory behavior and validate reduced motion/accessibility. Finish branding/icons, standalone packaging, signing/notarization, updater and Chromium security maintenance before treating this as a production browser.
