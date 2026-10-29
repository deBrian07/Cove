# Cove continuation — 2026-10-29

## Latest state: reference-frame and folder pass

Continuation entrypoint: `python3 scripts/chromium/handoff.py`; copyable agent prompt: [NEXT_AGENT_PROMPT.md](NEXT_AGENT_PROMPT.md), also printed by `python3 scripts/chromium/handoff.py --prompt`. The status script is read-only.

The current source series extends through 0081. The native compile is in progress; do not call the new app accepted until the final build, smoke and UI observations below are updated. The generated configuration is `75d4bf2d065b8f347e740b406c9f33f3b6002840ea3daa2688005aa84cb1ea66`.

- 0079 adds a separate folder-tree model with regression source and native nested-folder menus: subfolder creation, moving whole folders, sibling ordering, moving pins to nested paths or the root, and removing folders while reparenting their contents. It rejects self/descendant moves and ambiguous duplicate IDs. Rendering handles malformed parents and cycles without recursion. Six model tests cover data preservation, JSON round trips, collapse, cycles, duplicates and 10,000 levels of nesting.
- 0080 addresses the latest screenshots: removes the extra 36 DIP caption strip when the sidebar is hidden, avoids doubling its leading frame inset, tightens single-page corners from 12 to 8 DIP and darkens the default violet surfaces. Native window buttons hide with the sidebar and return on reveal; fullscreen keeps AppKit ownership. Explicit/custom/accessibility themes retain their existing handling.
- 0081 separates the untouched default browser appearance from ordinary website appearance. Cove chrome remains dark; ordinary pages follow the system. Explicit appearance preferences, WebUI, incognito, enterprise and guest behavior retain their existing handling. Three browser regressions were added, but browser_tests has not been built/run.

CUA attached successfully this turn and showed the user's screenshot mismatch in the running app. The old blanket cgWindowNotFound blocker is resolved. The old instance was quit normally through Cove's menu before compilation, preserving its data. New runtime acceptance is pending. The user withdrew the latest Cmd+S pop-back report as already fixed; this batch does not change the sidebar hover state machine.

The first development compile caught Chromium's required explicit out-of-line destructor for the complex folder model; the next caught a New Folder local variable shadowing its command ID. Both were corrected and re-exported before final GN generation. All 36 Python tooling/verifier tests passed. The final corrected 81-patch series passed original-file SHA256/application verification too. Build logs are `/tmp/cove-native81-build-final.log` and `/tmp/cove-native81-gen-final.log`; these are disposable and not the permanent validation record.

See [SPACE_RESTORE_DESIGN.md](SPACE_RESTORE_DESIGN.md) for the audited next implementation. Full session journal resets omit parked tabs unless serialization enumerates them explicitly; recently-closed extra data alone is insufficient. Do not implement a metadata-only migration and call it durable restore.

New focused commits: `4b6eb90` nested folders, `a1bf750` reference frame and `9ebaf88` website appearance. None has a co-author trailer. The authorized GitHub remote is `https://github.com/deBrian07/Cove.git`; publication status must be checked with Git rather than inferred from these notes.

## Previous 78-patch feature baseline

The complete 78-patch native series builds and starts. `generated_config` and `built_config` both equal `a64d8332da85feb3a5c0599ffa31e054e68dfc94c4e6fdd51c1064a903a4a878`. The last incremental compile rebuilt two steps in 57.57s after the larger feature build. Final renderer smoke passed in an isolated temporary profile. All 55 focused native tests and 36 tooling/verifier tests passed, and the complete ordered series applies against the pinned original files. Full Chromium browser/unit/interactive suites have not run.

New feature work:

- 0076 adds Control+1–9 Space selection, stable-ID Space-name results in Cmd+T, next/previous Space actions, named Space/folder creation, rename commands, Favorite/Clear Today actions, pin reset, replacing a pin's home URL and resetting the current Space's live pins. The palette now has 44 static enabled-state-aware actions after 0078, plus dynamic Space-name results.
- 0077 fixes a native crash found while exercising Control+2 immediately after a same-document history change. A parked tab's pending navigation reached LensOverlayHomeworkPageActionController, which dereferenced its absent BrowserWindowInterface. The homework action now ignores parked pages. Evidence: Cove-2026-10-29-025302.ips. The exact final GUI round trip still needs repetition.
- 0078 adds side-by-side/top-bottom split layouts, swapping panes, equal-size reset and native routing for Control+Shift+1/2 pane focus. Focus labels follow the split orientation. Unavailable numeric targets leave palette text intact. These use native TabStripModel operations and keep pages alive.
- The first 0078 smoke caught duplicate pane-focus accelerator entries. The duplicate was removed; the existing Cocoa mapping remains, with hidden global key routing added. AcceleratorsCocoa permits one canonical accelerator per command ID; aliases belong in hidden shortcut dispatch. Final startup smoke passed.

Current UI validation limit: the running isolated profile is `/Volumes/CoveBuild/checkout/profiles/CoveUIValidation-Native78`. The app/renderer starts, but CUA repeatedly returns `cgWindowNotFound` even after reconnect/reset. A user question asks to bring that window onto the current desktop. Do not call the newest Space, pin-home or split actions GUI-accepted merely because the build passed. The 0074/0075 live checks did verify Customize Cove, explicit native-field typing and contextual Cmd+S. Earlier 0068 checks retained immediate raw input; final immediate-input acceptance is still incomplete because automation can reactivate the parent window.

CUA horizontal scrolling delivered raw dx=0/dy=0 events in 0075 logs. That cannot validate a physical swipe; do not lower the gesture threshold to make zero-movement events switch Spaces. The 12 gesture tests cover actual Cocoa phase mapping, wheel bursts, axis locking, momentum and one switch per touch. Physical gesture feel, layer motion/reduced motion and rapid cancellation still require a real input pass.

Next live acceptance, once attached:

1. Type a draft, push history, immediately Control+2, then Control+1. Confirm the exact page instance, draft and #kept history return without a crash.
2. Cmd+T → type a Space name → Enter; repeat next/previous and first/last boundaries. With only two Spaces, Control+9 in the palette must retain its query.
3. Run New Space and New Folder; submit names and verify persistent rows. Exercise Favorite and Clear Today.
4. Pin a local HTTP fixture, navigate away, Reset Tab, replace the home, navigate again and reset to the replacement. Check stable live-tab ownership and normal unload handling. Reset Space must affect only its current live pins.
5. Add a split; change orientation, swap, resize/reset, focus each pane and separate. Both pages must survive; custom pin/folder drag-to-split, joined rows, pane headers and more than two panes are still unfinished.
6. Recheck Cmd+S with and without the palette and final immediate typing after Cmd+L → Cmd+T. Then use an actual trackpad for Space slides.

Focused commits so far: `5b8e0d6` native command bar/cache/lifetime, `79b5ef1` Space motion, `473aa31` Cove labels, `8552015` input diagnostics/fallback, `8abdbaf` Space/pin/action functions and `210c1a4` split controls. None has a co-author trailer. The external SSD, sparsebundle, native profiles and retired Electron archive remain separate and intact.

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

The earlier 55-patch baseline was built at digest `d623603353096572a62dd1ea4be06bb221d3a7b0e412855bdce177e3fac77ab3`. The current series extends through 0078; see the latest validation section below for final build status. Final GUI checks confirmed tab rows and Archive Today become available after in-place canvas navigation, Archive closes the ordinary page while preserving the window, and Cmd+Shift+T restores the page with its visible row. Queued cleanup then removes the temporary placeholder. Final native renderer smoke passed. Read VALIDATION.md before claiming broader parity.

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

Use CUA for UI interaction. Freshly read AX state before using element IDs. Native menus can lose stale AX item handles between tool calls; direct mouse opening and keyboard item selection in one interaction worked. The old WebUI palette needed an observation before typing. Normal Cove windows now use a native textfield; immediate raw-key input passed on the 0068 build. Verify the query text before submitting; automation paste/typing occasionally failed to deliver the intended punctuation or text. Do not diagnose that as a navigation classifier bug without inspecting the actual field value.

A real crash at `/Users/brianchen/Library/Logs/DiagnosticReports/Cove-2026-10-26-205025.ips` had a null virtual dispatch from View::HandleAccessibleAction during native accessibility activation. The ViewTracker fix addresses that exact gap; the small native regression passed. After a crash, CUA can auto-launch a default-profile window. Confirm the process/profile before further input instead of treating that window as QA.

Unique renamed QA app bundles caused very long CUA attachment calls, including a 3682-second stall, despite the underlying native build already succeeding. Prefer the production dev.cove.browser bundle with exactly one explicitly launched QA-profile instance. The ordinary run command intentionally refuses profile overrides, so QA launch is a separate controlled development operation. Never weaken Keychain, browser security warnings or OS permissions to fix an attachment problem. Mock Keychain is confined to explicit test profiles; normal npm start does not use it.

A local-only fixture at `/tmp/cove-runtime-fixture` is served on 127.0.0.1:8765 for forms, stable page identity, history and beforeunload. Temporary files/logs disappear across reboots; retain conclusions here rather than relying on /tmp alone.

## Shortcut bug pass — 2026-10-27

0056 makes Cmd+S dismiss an open/loading command bar before changing sidebar state. Both declarative and legacy native dispatch use the same helper. It also aligns native button accelerators/tooltips with Cmd+S and adds opt-in presentation timing without query/URL logging. Live QA on the 57-patch build confirmed expanded and collapsed sidebar state survives palette dismissal, rapid Cmd+T then Cmd+S, URL submission and Escape. No app exit reproduced. The added browser regression is source coverage only; browser_tests was not built/run.

0057 preloads the primary command bar without historical engagement or waiting for a page's first non-empty paint (about:blank may never provide one). Explicit feature parameters, disabling the preload feature and existing memory-pressure safeguards remain respected. That build measured first presentation 236.213 ms, cached 56.291 ms; after the old 30-second cache expiration, 630.837 ms, then cached 38.86 ms. These are isolated QA samples, not broad performance benchmarks.

0058 replaces the persistent collapsed icon rail with a 6 DIP native edge target, hides its child controls at rest, retains native animation/reveal ownership, and reserves 36 DIP above content for caption buttons while hidden. Cmd+L still requests expansion before address focus. Custom library/Favorites/address/footer presentation follows expanded hover width too. 0059 retains only Tab Search's cached page for ten minutes instead of thirty seconds and makes Favorites collapse updates idempotent so layout does not recreate buttons continuously. The longer cache retains a hidden WebContents for longer; other bubble cache lifetimes stay unchanged.

0060 tried retaining address focus during expansion; 0063 added an active-widget guard. Both are superseded by 0064: the rapid Cmd+L then Cmd+T case still lost focus after initial palette display. Final code completes only a focus-requested sidebar expansion synchronously with BrowserAnimationController::Reset, then focuses/selects the address. It removes the pending property and delayed layout callback entirely. Ordinary Cmd+S and hover animations remain unchanged. Validate by typing after the palette has initially appeared, not just observing its first AX snapshot.

The 59-patch idle sample remained cached after 55 seconds: 81.97 ms, versus a first opening of 89.088 ms in that process. These are QA samples, not a general performance benchmark.

0061 anchors the command bar to the always-visible BrowserView instead of the sidebar button. Full hiding makes that button invisible; tying the palette to it left later openings invisible during QA. Keep the View anchor and its native activation ownership; a rectangle-only anchor changed activation/shortcut behavior during QA and was replaced before final validation.

0062 adds opt-in native routing diagnostics (no URLs or query text) to distinguish palette dismissal from collapse. On the settled 62-patch QA window, repeated Cmd+T/Cmd+S correctly logged palette dismissal; explicit sidebar hiding logged collapse only with no palette widget. That run measured 84.819 ms first presentation and 57.571–66.746 ms cached presentations.

0065 fixes a real fatal crash exposed by 0064's fast-forward: BrowserAnimationController::GroupData::Reset completed the current motion without stopping its Animator. A later compositor frame reached UpdateCurrentValues with no current_motion_ and CHECK-failed at browser_animation_controller.cc:659. Reset now stops the existing ticker before OnAnimationEnded. The new ResetRunningMotionStopsItsTicker unit regression advances frames after resetting both running motions; all 43 real animation-controller tests passed in the focused cove_animation_tests executable, including the Reset regression. The full unit_tests binary has not been built/run. The fatal was captured in /tmp/cove-final64-runtime.log; preserve this explanation because /tmp is disposable. Do not call the 64-patch binary validated.

## Native command bar and Space motion — 2026-10-28

0066 replaces the primary normal-window WebUI palette with a native Views textfield and result rows. It supports stable live tab handles, URL/search classification, recent-session restoration, keyboard selection and the existing allowlisted browser actions. The old WebUI path remains for nonnormal windows and explicit WebUI test cases. On build 0068, raw r/a/p immediately after Cmd+T arrived intact, including after collapsed Cmd+L → Cmd+T; typed URL submission dismissed the palette. Cmd+S dismissed the palette without changing the sidebar, and ordinary pin/unpin/toggle-sidebar commands worked. These are actual UI checks, separate from the unexecuted native browser test source.

0069 precreates and reuses the native palette window instead of destroying it after every dismissal. 0068 removes unused eager WebUI warmup from normal Cove windows. 0070 uses client-owned BubbleDialogDelegate and Widget objects with explicit destruction order and synchronous close cleanup. The earlier deprecated creation path leaked its unowned delegate, which retained an anchor/theme observer and crashed during a theme update at Widget::ThemeChanged (report Cove-2026-10-28-214816.ips). Hidden cached palettes now detach their anchor and reconnect before showing. Revalidate repeated hide/show, parent close, and theme changes after any ownership edit.

0071 uses horizontal wheel/trackpad gestures on the sidebar to select adjacent Spaces, clamped at the ends. Vertical gestures and address/top controls pass through. A pure state machine locks the axis, requires 75 DIP travel, switches once per touch, ignores momentum and treats phase-less wheel bursts separately. Sidebar rows slide in/out over 240 ms; Favorites and footer remain stationary. Snapshots retain painted layers, not WebContents; the existing live tab parking model still performs the actual Space switch. Reduced motion skips the slide. Cleanup is posted outside layer animation callbacks with a generation guard, and rapid switching cancels/restores the prior transform before taking a new snapshot.

The 0071 app built and 51 focused tests passed, but real UI checks found two additional failures. Its Cmd+T cached reopen cast Widget::GetContentsView() (a nonclient wrapper) to CoveCommandBarView, corrupting access to the view's weak reference and crashing with lock_impl_posix DCHECK. 0072 retrieves the delegate's actual contents through checked Views metadata instead. Do not use the 0071 binary as an accepted baseline.

0073 handles actual Cocoa phases: MAY_BEGIN is touch begin, NONE is touch update, INERTIAL_UPDATE is momentum, and standalone END with displacement is wheel input. A tracked touch/momentum stream distinguishes its final END (even with displacement) from a fresh wheel burst. 0075 subsequently allows descendant wheel fallback when no matching raw event was received, using the event timestamp to avoid counting its raw scroll again. Four focused native phase-normalization tests were added after the first UI swipe check failed.

0074 rebrands 84 English product messages including Customize Cove and the default PDF viewer infobar. The latter uses a generic document icon instead of the Chromium logo. Chromium Authors, license, Chromium OS and engine references remain accurate; translations and a custom application icon still need their own pass.

The final 0078 native build and renderer smoke passed. All 55 focused native tests (43 controller and 12 gesture/phase cases) and all 36 Python tooling/verifier tests passed. Live acceptance of the newest functions is incomplete because CUA cannot attach to the current QA window. Do not interpret patch application or a source-only browser regression as runtime validation. See STEDDING_BENCHMARK.md for the pinned source comparison and the remaining gaps.

## Next work, in order

1. Persist per-Space ownership across native session restore. Current shutdown reunites inactive tabs for Chromium persistence, so restart can merge ownership; URL snapshots are only a fallback. BrowserLiveTabContext::GetExtraDataForTab and SessionService::AddTabExtraData can store a stable Space ID. Restore it in browser_tabrestore.cc before insertion. Persist the active Space per window via GetExtraDataForWindow too. Reconstruct detached ownership after bulk restore, preserving native groups/splits and respecting canceled unload. This was researched, not implemented.
2. Validate the new pin-home commands, then complete pin-model unification, folder move/reorder coverage, nested folders and dragging between folders/Spaces. Favorites are global saved URLs; do not infer complete global live-tab ownership from that.
3. Add Arc-style pane-specific URL/navigation headers and joined split rows. Current native controls support two panes; exact reference layout, drag-to-split and more panes remain unfinished.
4. Validate new Space shortcuts/name selection, then implement the recent-tab chooser, configurable keybindings, Peek, Little Arc and import.
5. Measure focus/frame-time/memory behavior and validate reduced motion/accessibility. Finish branding/icons, standalone packaging, signing/notarization, updater and Chromium security maintenance before treating this as a production browser.
