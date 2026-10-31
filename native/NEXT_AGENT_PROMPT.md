# Continue Cove native Chromium

Work in `/Users/brianchen/Documents/Cove`. Read `AGENTS.md`, `native/HANDOFF.md`, `native/VALIDATION.md`, `native/ARC_PARITY.md` and `native/SPACE_RESTORE_DESIGN.md` first. Run:

```sh
python3 scripts/chromium/handoff.py
```

That script is read-only. It prints Git state, patch count, live build processes if available, configuration identities and the latest build log. Do not infer a passing build from an existing app bundle.

The user wants native Cove to match Arc's functions and supplied screenshots, and requested a continuation handoff before the usage limit. They also authorized pushing the complete project history to `https://github.com/deBrian07/Cove.git`, branch `main`, without co-author trailers. Preserve existing history; do not reinitialize Git or replace README with a one-line stub. The requested remote was empty when checked, and GitHub authentication uses `deBrian07`.

## Current accepted 95-patch build: folder rows and cached pin icons

Implementation commit `46f1854` finishes `0095-polish-folder-rows-and-load-cached-pin-icons.patch`. Saved folder/pin rows use a 36-DIP minimum matching native Today rows, 16-DIP nesting, trailing ellipsis, blue native folder icons, semibold folder labels and rounded hover feedback that preserves selected-pin styling. Expanded/collapsed accessibility semantics and native context/drag controllers remain intact.

Closed pins load site icons from Chromium's local FaviconService cache without opening pages. Requests cover rendered rows only, share reads for matching home URLs and update only the matching weak row. A current bound page's favicon wins over the saved-home fallback. Rebuild cancels requests; callbacks revalidate row identity, saved index, pin ID and home URL. Duplicate saved IDs are excluded from cache requests. Three new browser cases check cache loading/rebuild without opening pages or losing the active draft, rejection of stale home/index callbacks, and live-icon precedence after navigating a retained pin away from home.

All **54 browser executions passed in one clean combined run with retries disabled**. JSON contains 53 SUCCESS results because the PRE_ restart phase is folded into its dependent result. The three favicon cases also passed separately. All **36 tooling tests**, all **95 patches** in original-file SHA/sequential-application verification, native app/test linking, matching build receipt and isolated renderer smoke passed. Generated/built/current identity: `c6d19b41f0c17ee7de92373a69b5a0d6c3dd013a3806a88fd675fb0da5796648`. The 75 model/animation tests last passed on 0089; those implementations are unchanged.

Evidence: `/tmp/cove-native95-browser-tests.log`, `/tmp/cove-native95-browser-results.json`, `/tmp/cove-native95-icon-tests.log`, `/tmp/cove-native95-icon-results.json`, `/tmp/cove-native95-final-build.log`, `/tmp/cove-native95-build-accepted.log`, `/tmp/cove-native95-smoke.log`, `/tmp/cove-native95-tooling.log` and `/tmp/cove-native95-verify.json`. Initial compile attempts caught protected LabelButton label access and a missing test-only ImageSkiaRep include; both are corrected. Earlier failures are not acceptance evidence.

Visual review: `/tmp/cove-native95-sidebar-static.png` shows the final native folder-row layout. It came from the fixture compositor with `--animation-duration-scale=0`; the focused capture test passed. The default-motion full run also passed, but its `/tmp/cove-native95-sidebar.png` snapshot occurs mid-expansion and is clipped, so do not use that image for static layout acceptance. Arc's filled two-tone folder artwork, font tuning and other appearance differences remain. This is not exact Arc parity.

Desktop keyboard checks through CUA now work. In the preserved isolated QA91 profile, Cmd+T focused the native palette and accepted typed test text; Cmd+S dismissed the palette without closing Cove. A second Cmd+S hid the sidebar and it stayed hidden across a later screenshot. Cmd+T accepted text while hidden; Escape dismissed it while retaining collapse; Cmd+S restored the sidebar and the original page stayed selected. These are observed input/AX/screenshot checks, not latency measurements or physical trackpad/drag/fullscreen acceptance. No test query was submitted and no page was replaced.

Cove is now OPEN on `.chromium/checkout/profiles/CoveUIValidation-Native91` (the original QA profile name, reused intentionally), launched without a URL and with `--restore-last-session`. UI log: `/tmp/cove-native95-ui.log`; launch exec session 16982. Normal, Arc and archived prototype profiles are preserved. Before any new native linking, identify this QA process and quit it normally, then verify exit. Do not force quit or replace running binaries. Keep the SSD connected; no mount layout or disk format was changed.

`/tmp/cove95-before/` stores pre-95 sources; `/tmp/cove95-export.py` is the idempotent exporter. `/tmp/cove95-install.py` and `/tmp/cove95-optimize-current.py` already ran and must not be repeated. Versioned patches are authoritative. Continue through the next-work notes below, not old install scripts.

### Next functional work

1. Keep saved-row/Favorites OS source drags hover-expanded. Add an `ExpandOnHoverLock` with `kKeepExpanded`, acquire once in `OnWillStartDragForView()`, and release in library `FinishRowDrag()` / Favorites `FinishSourceDrag()`. Do not release on target exit: the source may merely leave a child target. Native live-tab drags already hold this lock in `common/tab_drag_handler.cc`. Test completion, cancellation and teardown while preserving the saved collapsed preference. Region destruction clears lock back-pointers before child destruction.
2. Shared-viewport drag-edge autoscroll is patch 0097. A region-owned weak timer scrolls 5 DIP every 20 ms only while the stationary screen pointer is inside the shared viewport's 24-DIP top or bottom band, then retargets the saved or live-tab indicator from the validated source. Native dragged containers also observe that outer scroll without replacing their inner layout ScrollViews. Scrolling stops on exit, drop, cancel, Space transition, explicit collapse, widget removal and teardown. `CoveSidebarDragBrowserTest.DragEdgeAutoscrollFollowsStationaryPointer` passed with retries disabled: both directions, center/Favorites/footer exclusions, and the open page, history, and draft stayed put.
3. Right-click a Space and choose Edit Theme Colors…. Sidebar, accent, and highlight are stored separately and painted on that Space. Preset palettes remain available through `SetSpacePalette`. Patch 0098. `SpaceThemesKeepSeparateSidebarAccentAndHighlight` passed. A navigated pin shows a quiet “Return to saved URL” line; choosing it loads the saved page in the same tab and leaves the previous page in history. Trackpad scrolling on the main-thread sidebar no longer hits the layer-scroll check.
4. Space right-click menu now follows Arc's order: Change Space Icon…, Rename Space…, Edit Theme Colors…, New Folder, Delete Space…. Patch 0099. An icon is an emoji or short symbol stored as `icon` on the Space and shown in place of the footer dot; inactive icons are dimmed. Clearing it restores the dot. Delete Space asks first and is disabled for the last Space. If the Space is shown, the window moves to its neighbor first. The Space is then removed from prefs, and every window closes that Space's parked tabs through the normal close path, so beforeunload runs and the tabs stay in recently closed history. A window showing a Space deleted elsewhere moves to the first Space. New Folder from another Space's menu switches to that Space first. `SpaceMenuFollowsArcOrderAndDeletesParkedSpace`, `DeletingShownSpaceLandsOnNeighbor` and `SpaceIconReplacesFooterDot` passed. Series repair: 0096 never applied after 0001–0095 because the tree held three stray blank lines no patch recorded. 0096–0099 were rebuilt from the per-patch snapshots, the blank lines folded into 0096, and the full 99-patch series now verifies as applied. Build identity `1f711732529ee09a418a16e19c627ad161ca7bb2d2e9dece856ec7624903b168`. The full 62-case `cove_session_browsertests` run found one crash in the 0098 return line (subpixel text in a transparent layer, hit by `PRE_RestartKeepsParkedHistoryPinHomeAndFolderOrder`); it is fixed in 0098, and that test plus all 20 sidebar drag cases pass. Not yet done: Set Profile, Live Folders, Share Space and Manage Spaces.
5. Export a Space into another Space's folder from the Space menu: Export “Name” into Folder lists the other Spaces. Patch 0100. The target gets a root folder named after the exported Space, placed after its existing rows; the exported folders nest under it and its root pins move into it, keeping saved order. Pin or folder IDs that collide with the target are renamed, and live pinned tabs stay bound to the renamed pin. The window switches to the target, the exported Space's open and parked tabs join it without closing, and the Space is removed. A `space_redirects` entry (capped at 32) lets other windows move their parked tabs and pin bindings instead of closing them. `ExportShownSpaceKeepsTabsAndNestsRows` and `ExportParkedSpaceMovesItsTabsIntoShownSpace` passed; the Space menu order test now includes the submenu. Build identity `086cd244ae369216c2c87f72c53f8a8ee5704bd4f67506e653d01ba7b0208b1b` (100 patches, verified applied).
6. Control-Tab walks tabs in recently used order, like Arc. Patch 0101. Holding Control and pressing Tab (Shift reverses) opens a centered, non-activating switcher themed from the active Space that lists the window's tabs most recent first, with favicon and title; releasing Control activates the highlighted tab. The main-menu Control-Tab key equivalents were removed so `global_keyboard_shortcuts_mac.mm` maps the keys to `IDC_COVE_RECENT_TAB`/`IDC_COVE_RECENT_TAB_BACK`; Command-Option-arrow strip cycling is unchanged. Switching Spaces or any active-tab change made outside the switcher closes it. `ControlTabWalksTabsInRecentlyUsedOrder` and `ControlTabMapsToRecentTabSwitcher` passed, and the full suite passed (66 tests). Build identity `43f2c89f7127154c1b4b2cf0354981eb71bf1d1c522be8ca95da394968a568cb` (101 patches, verified applied).
7. Move tabs between Spaces from the tab right-click menu: Move to Space lists the window's other Spaces. Patch 0102. The selected tabs (and any split partners) keep their live pages and history; the window switches to the target Space with the first moved tab active, whether that Space was parked or not yet visited this session. Moved tabs leave their tab group, pinned tabs become pins in the target and their source pin is removed, and a Space emptied by the move keeps a blank canvas. `MoveToSpaceCarriesLiveTabIntoUnvisitedSpace` and `MoveToSpaceCarriesPinAndLeavesBlankCanvas` passed. Patch 0103 removes the Space header's Pin button, which Arc does not have; pinning stays on drag, the tab menu and Command-D (`SpaceHeaderHasNoPinButtonAndCommandDPins`). Patch 0104 gives live-drag tests a browser-only `WindowFinder` so another app's floating window (for example a picture-in-picture video) can no longer tear a tab off mid-test; `ScrolledFolderDropKeepsLivePageAndHistory` had failed 1 in 5 and then passed 10 of 10. Full suite: 69 of 69 passed with retries disabled. Build identity `1c379c64b8ff48a7b89779438da8f609e75020972b260b86e53961819335ac71` (104 patches, verified applied).
8. Arc's mini player: a playing video floats in Chromium's video picture-in-picture window when you leave its tab, switch Spaces or switch to another app, without the site opting in. Patch 0105. Cove enables `kBrowserInitiatedAutomaticPictureInPicture` and `kAutoPictureInPictureOnWindowOccluded` by default on Mac and defaults the auto picture-in-picture content setting to Allow. Mac now builds the widget occlusion helper, which counts the browser losing focus to another app as occlusion; browser-owned popups and child widgets do not float the video. Tabs parked in an inactive Space are marked so the tab-strip observer treats them as left (not as mid-drag), and they get a small library-owned delegate that routes picture-in-picture and activation, so back-to-tab switches to the video's Space and activates its tab and window. Returning to the tab, Space or app closes the mini player; the close button pauses, minimize keeps playing. `CoveMiniPlayerBrowserTest` (6 tests) passed; full suite 75/75, tooling 36/36 and `npm run test:ui` passed. Build identity `75e0a777419a9589bdb96caaa5c7f048ac495fffca0af1a139675b879da47a19` (105 patches, verified applied).
9. Arc's floating drag row: a live tab dragged out of the tab list over Favorites, pins or folders now shows a translucent copy of its row (favicon, title, close glyph) under the pointer, while the source row stays in place. Patch 0106. `VerticalTabStripRegionView::ShowCoveDragGhost` owns one layer-backed, event-transparent overlay; the library and Favorites drag targets update it on every move and hide it on exit, and drag end hides it. An empty Favorites box no longer opens at drag start (which pushed every row down about 48 pt under the pointer); it opens only when the pointer reaches the top of the sidebar and stays open while the pointer is over it. `CoveRealMouseTabDragBrowserTest` drives real `ui_controls` mouse drags into a folder, existing Favorites and the first Favorite; the live-drag tests now assert the ghost tracks the pointer and the rows do not move at drag start. 18/18 drag and Favorites tests passed; a real OS drag in an isolated QA profile pinned a tab and created a first Favorite. Build identity `60a8423d1d4d0c91e43ac9877bf50adbb29483d7c5d29cab2e1293ce22853901` (106 patches, verified applied).
10. Watch Favorites' lifecycle trap: `OnTabDragUpdated()` calls `OnTabDragEnded()` before every preview update. Separate preview clearing from actual lifetime cleanup before adding cleanup there.
11. Finish grouped/split/multi-tab and cross-Space organization, multi-window/group/split fresh-process restoration and real process-kill recovery. Saved-group sync, joined split rows/pane headers, Peek, Little Arc and editable shortcuts remain. See ARC_PARITY.md. Keep the no-separate-Cove-account preference.

## Latest user reference and desktop-tool availability

The user supplied a close sidebar reference (`/var/folders/8k/y53qrn1x7d59fjjnwt238tvw0000gn/T/codex-clipboard-JzjIOf.png`): blue folder icons without text chevrons, heavier folder names, indented page rows with site favicons, consistent row spacing and trailing ellipsis. Patch95 targets those details; its native blue outline folder icon still differs from Arc's filled two-tone icon. Assess rendered output before claiming visual acceptance. Do not fetch sites or open tabs just to load an icon.

The user explicitly authorized computer use. The current continuation exposes `mcp__cua_repl`; its app inventory found no running Cove window during the build. Earlier sessions lacked that tool or encountered stale-window input guards. Re-query through CUA and respect its guards; do not inject input through other APIs. Fixture-owned native Views events and compositor captures remain available, but do not establish hardware acceptance.

## Previous accepted 94-patch build: saved-list scrolling and active-tab reveal

Patch `0094-keep-long-saved-sidebars-and-live-tabs-scrollable.patch` wraps the saved library, New Tab and native tab strip in one transparent native ScrollView. Favorites and the footer remain outside it. Main-thread scrolling preserves native drag hit testing and the existing Space-slide layer. Cove's inner tab viewports propagate reveal requests to the outer viewport and retain full native list height; other tab-strip modes keep upstream scrolling. Opening a tab waits for its insertion animation to reach final size before revealing it. Selecting an existing tab also reveals it after the saved list is scrolled away.

All **51 browser executions passed in one clean combined run with retries disabled**, including the PRE_ restart phase. JSON contains 50 SUCCESS entries because that PRE_ phase is folded into its dependent result. Four new cases cover 60-folder overflow, a real live-tab drop into a scrolled folder with history/draft/window retention, 12 native fallback pins, and automatic reveal after new/existing-tab selection. All 36 tooling tests and 94-patch SHA/sequential verification pass. Native app/test linking, accepted receipt and isolated renderer smoke pass. Generated/built identity: `6c6858f9dd306b54eb95baaefb9485281205648dc3b163ff66afe39ac8926acb`. The 75 focused model/animation cases last passed on 0089, and those implementations are unchanged.

Evidence: `/tmp/cove-native94-browser-tests.log`, `/tmp/cove-native94-browser-results.json`, `/tmp/cove-native94-animation-build.log`, `/tmp/cove-native94-build-accepted.log`, `/tmp/cove-native94-smoke.log`, `/tmp/cove-native94-tooling.log`, `/tmp/cove-native94-verify.json`. The selection case also passed separately in `/tmp/cove-native94-animation-tests.log`. Earlier failed checks are retained under `/tmp/cove-native94-*`: the original real saved-folder clipping was valid; initial native-tab visibility assertions mistakenly inspected the intentionally hidden drag adapter and were corrected to the displayed collection node. Native fallback fixtures must use chrome://version/ because about:blank can become a saved pin. INFO tracing established that new rows were revealed at height zero; temporary diagnostics were removed, and existing target-size tracking fixes the real insertion-animation issue.

Cove remains closed. QA91 and all normal/Arc/prototype profiles remain intact. No hardware mouse/trackpad acceptance has been claimed. The user now requests the supplied close-up folder/pin appearance; next address blue folder icons, spacing/indentation, trailing ellipsis and cached favicons for closed pins. Drag-edge autoscroll and saved-row/Favorites hover-expansion lifetime still need dedicated fixes/tests. Grouped/split/multi-tab/cross-Space organization and the larger parity gaps remain.

Scratch: `/tmp/cove94-before/` stores six pre-94 source files; `/tmp/cove94-export.py` idempotently exports 94. Non-idempotent install/insert scripts were already applied; do not rerun. Reuse the current checkout/out/Cove at jobs=2 and keep the SSD connected. Never modify source/patch/config inputs during GN/Ninja or run a second Ninja. Future work starts after this accepted baseline.

## Previous accepted 93-patch build: reported drag/folder fixes and fresh-process restoration

The user's pin-drag tear-off and missing right-click New Folder fixes are committed/pushed in 0092 (`76a3bb0`; validation `628bb01`). The previous direct-to-folder tests missed the real pointer journey. The new tests walk every pixel through New Tab/separators/padding, retain the existing window and pages, and check cancellation/empty pin areas. A right-click dispatched through the test widget opens the real native menu and naming dialog twice. See the 92 section below for implementation and earlier fixture failures.

Patch 0093 adds a real PRE_/fresh-process restoration pair. With one window, Work active and three saved pages, the new process restores exact history URLs/counts/indices, the selected personal tab, a navigated pin's original home and stable ID, nested/collapsed folders, mixed saved order and Favorites with unknown fields. The fixture verifies that the PRE_ PID differs. It does not manually reconstruct the session in the same process and does not use a real saved browser profile. This patch changes test coverage only; product behavior remains the accepted 92 implementation.

All **47 browser cases passed in one clean final run, with retries disabled**. The two restart phases also passed separately after correcting the fixture's startup. The default browser-test harness appends an about:blank URL argument, so this fixture disables that injected argument to model a normal restore launch; the expected three restored pages remains unchanged. The initial post-process wait failure is retained in `/tmp/cove-native93-restart-tests.log`, not counted as acceptance. The final source uses normal SessionRestore completion and INFO-level test-only snapshot diagnostics. No product workaround was added to make the restart test pass.

All 93 patches pass original-file SHA256/sequential-application verification; all 36 tooling tests pass. The last 75 focused native model/animation cases passed on 0089, and those implementations remain unchanged. Final app/test build, accepted build receipt and isolated renderer smoke pass. Generated/built identities match `0e0ad2341ae96cac6cca6beda735ce9fa58d3d85dcd02e9a649d8e87597433e0`. Final evidence: `/tmp/cove-native93-browser-tests.log`, `/tmp/cove-native93-browser-results.json` (46 SUCCESS entries with the PRE_ phase folded into its dependent result; all 47 executions pass, no retries), `/tmp/cove-native93-final-build.log`, `/tmp/cove-native93-build-accepted.log`, `/tmp/cove-native93-smoke.log`, `/tmp/cove-native93-tooling.log`, `/tmp/cove-native93-verify.json`. The passing focused restart pair is `/tmp/cove-native93-restart-fixed-tests.log` and `/tmp/cove-native93-restart-fixed-results.json`.

Cove remains closed because the user asked to continue source work. For the next interactive pass, reuse the preserved isolated QA profile `.chromium/checkout/profiles/CoveUIValidation-Native91`; the suffix records its creation build and reuse preserves the user's QA session. Launch without a URL argument and with `--restore-last-session` to avoid adding another blank tab. No QA93 window has been launched. Existing normal/Arc/prototype profiles and other QA profiles remain intact. Before future linking, identify the live profile and request normal Quit, then verify exit; never force quit, replace running app files or remove profiles. No CUA input tools were available. The earlier normal application Quit was a lifecycle request for the sole owned QA process, not a workaround for an automation input guard.

### Continue here

The user requested sustained Arc-parity work and a reliable handoff before the token limit. Do not claim perfect/100% parity. First manually check the reported drag route and background right-click in the updated app when normal input tools are available. Native fixture results are not hardware mouse/trackpad/fullscreen acceptance.

Long-list scrolling and active-tab reveal are now accepted in 0094 (see above). Continue with the latest supplied folder/pin appearance, cached saved-pin favicons, drag-edge autoscroll and saved-row/Favorites hover lifetime. Preserve the native page/history behavior already covered by the drag and restoration suites.

Grouped/split/multi-tab and cross-Space live organization, multi-window/group/split fresh-process restoration and actual process-kill recovery, saved-group sync, pane headers/joined rows, Peek, Little Arc and editable shortcuts remain. Keep the no-separate-Cove-account preference. See ARC_PARITY.md for the full list.

Reuse `.chromium/checkout/chromium/src` and out/Cove, jobs=2; keep the SSD connected. Never edit source/patch/config inputs while GN/Ninja runs, and never run two Ninja instances against that output. Versioned patches are authoritative. `/tmp/cove92-export.py` exports 92 against `/tmp/cove92-before/`; `/tmp/cove93-export.py` exports 93 against `/tmp/cove93-before/`. Do not rerun non-idempotent install/edit scripts. Session tests are in `chrome/browser/ui/cove/cove_session_browsertest.cc`, not under views/cove. Main sidebar/drag source is under views/cove, views/frame and views/tabs/dragging.

For future relevant changes, the full bounded browser filter includes the restart fixture:

```text
CoveSessionBrowserTest.*:CoveSessionRestartBrowserTest.*:CoveSidebarLibraryBrowserTest.*:CoveCaptionButtonsBrowserTest.*:CoveSettingsBrowserTest.*:CoveSidebarDragBrowserTest.*:CoveFavoritesDragBrowserTest.*:CoveLiveTabDragBrowserTest.*
```

Use `--test-launcher-jobs=1 --test-launcher-retry-limit=0 --use-mock-keychain`. Optional `--cove-sidebar-snapshot=/tmp/example.png` copies only the fixture's compositor. Do not rerun unchanged passing checks merely to resume. Run `python3 scripts/chromium/handoff.py` first to refresh Git, process and build state.

## Accepted 92-patch build: pin-drag route and right-click folder creation

The user reproduced a QA91 failure after the earlier direct-to-folder tests passed: dragging toward pins could detach a tab into a window, and blank-sidebar right-click had no New Folder action. Patch 0092 covers the missing pointer journey through New Tab, separators and padding. The visible sidebar keeps the native drag attached across those non-drop surfaces; pinning remains bounded to saved-row targets. Even an unsaveable internal page no longer starts a window move just because it is the only tab. Leaving the sidebar retains upstream tear-off behavior.

Blank library and outer sidebar/content surfaces now register a context-menu controller. New Folder is available in background, pin, Space and folder menus; existing New Subfolder remains. The creation command opens the real naming dialog. Borrowed parent controllers are cleared before child destruction.

All **45 browser cases passed in one clean run with retries disabled**. Four new cases walk every pixel from a native tab across the sidebar to a folder or empty pin area, covering one/two tabs, cancellation, drafts/history and internal-page rejection. The fifth dispatches right-click through the fixture widget's Views event path and creates/names two folders in succession. It opens the native menu and real dialog. Earlier attempts timed out because NSMenu tracking does not pump Chromium application tasks; the final fixture uses a one-shot CFRunLoop timer in menu tracking mode to inspect/cancel its own menu. Production menu scheduling is unchanged. Those earlier timeout logs are not final acceptance.

All 92 patches verify against original-file SHA256/sequential application; all 36 tooling tests pass. The 75 focused model/animation tests last passed on 0089; those implementations are unchanged. Final native app/test linking, accepted build receipt and renderer smoke pass. Generated/built identities match `6c631c28c9a82714608f9eaa52710dcc34d9d1482f8f5986ce85576c018b83e6`. Evidence: `/tmp/cove-native92-browser-tests.log`, `/tmp/cove-native92-browser-results.json` (45 SUCCESS, no retries), `/tmp/cove-native92-menu-final-tests.log`, `/tmp/cove-native92-menu-final-rebuild.log`, `/tmp/cove-native92-build-accepted.log`, `/tmp/cove-native92-smoke.log`, `/tmp/cove-native92-tooling.log`, `/tmp/cove-native92-verify.json`. The first four new drag cases passed separately before the corrected menu fixture.

QA91 was quit via a normal application Quit request and process exit verified before final linking. No force quit, desktop input-event injection, saved-profile replacement or migration occurred. Cove stays closed during further native work. Existing QA91 and normal/Arc/prototype profiles remain intact. Manual hardware drag/hover, fullscreen and keyboard acceptance remain; native fixture tests do not establish 100% Arc parity. Grouped/split/multi-tab/cross-Space live organization, saved-library overflow/edge scrolling, full process/crash restoration, pane headers, Peek, Little Arc and editable shortcuts still need work.

The user requested sustained work during this session and a usable handoff before the token limit. Keep these notes current. Next: real PRE_/fresh-process restoration coverage for parked history, pin homes/IDs, nested/collapsed folders, mixed order and Favorites. A draft is in `/tmp/cove93-restart-tests.txt`; it has not yet been installed or compiled at this acceptance point. Preserve the existing checkout/out/Cove and keep the SSD connected. Never edit source/patch/config inputs while GN/Ninja runs. `/tmp/cove92-export.py` can reexport 92 from `/tmp/cove92-before/`; do not rerun the non-idempotent edit/insertion scripts.

## Previous accepted 91-patch build: folders, pins and Favorites drag-and-drop

The native sidebar now uses the mixed saved-order model from 0089 (`3a004b6`). Patch 0090 (`0e8f104`) connects that model to folder/pin rendering, drag insertion feedback and the existing Move Up/Down and destination menus. It adds visible Pin and New Folder controls, keeps saved rows visible during hover reveal, and accepts an individual loose live tab through Chromium's real TabDragController. Dropping into a folder pins the existing page without navigating, replacing WebContents or losing its draft/history. Two live pages at the same URL retain separate saved IDs and drafts; an existing navigated pin retains its home.

Patch 0091 (`4428b0e`) adds Favorites reordering and URL drops, plus an empty Favorite target during a live-tab drag. Creating a Favorite leaves the original page alive and unpinned. Both drag implementations revalidate stable sources/destinations, reject stale or foreign-profile moves, and defer source-view rebuilds until the native drag ends. Canceled drops leave saved organization intact. Folder cycle rejection, malformed records and unknown saved fields remain protected.

All **40 browser cases passed in one clean run with retries disabled**, including 17 existing session/library cases, three caption cases, five settings cases, six sidebar drag cases, four Favorites cases and five real live-tab drag cases. All **75 focused native tests** and **36 tooling tests** passed. All 91 patches passed original-file SHA256/sequential-application verification. The final native app/test compile, accepted build receipt and renderer smoke pass. Generated and built configuration identities both equal `578cdbbf4dac532ea6ad5710b60e681aa0f8246903586da0bdcc07274c44bb02`.

Evidence: `/tmp/cove-native91-browser-tests.log`, `/tmp/cove-native91-browser-results.json` (40 SUCCESS, no repeated cases), `/tmp/cove-native89-focused-tests.log` (75; model unchanged afterward), `/tmp/cove-native91-tooling.log` (32+4), `/tmp/cove-native91-verify.json`, `/tmp/cove-native91-final-build.log`, `/tmp/cove-native91-build-accepted.log` and `/tmp/cove-native91-smoke.log`. The earlier 13-case drag run also passed, but the 40-case run is final browser acceptance. The sidebar compositor crop `/tmp/cove-native91-sidebar.png` was inspected for Favorites, saved pins, nested folders and hover reveal. Its synthetic test data stays in an isolated fixture; no default Favorite websites are added to real profiles. The crop excludes the desktop and AppKit titlebar.

Scope: saved folder/pin moves operate in the active Space and the same Profile; Favorites belong to the Profile. Live drops accept one loose tab in the same browser, including its only tab. Grouped/split/multi-tab and cross-Space live moves are not implemented. Physical mouse drag/hover, fullscreen and keyboard feel still need manual acceptance; native fixture/compositor tests are not hardware input evidence. No CUA input tools were available. Do not claim 100% Arc parity. PRE_/process-kill recovery, saved-group sync, pane headers, Peek, Little Arc and editable shortcuts remain unfinished.

The user quit Cove normally before builds. Existing QA87 and all normal/Arc/prototype profiles were preserved. QA91 was opened after final acceptance and uses only `.chromium/checkout/profiles/CoveUIValidation-Native91` and `/tmp/cove-native91-ui.log`. Refresh live state before the next build; quit any running QA window normally before replacing its app. No separate Cove account or sync service was added; existing profiles and the Google account page link remain.

For subsequent source changes, the bounded browser filter is:

```text
CoveSessionBrowserTest.*:CoveSidebarLibraryBrowserTest.*:CoveCaptionButtonsBrowserTest.*:CoveSettingsBrowserTest.*:CoveSidebarDragBrowserTest.*:CoveFavoritesDragBrowserTest.*:CoveLiveTabDragBrowserTest.*
```

Use `--test-launcher-jobs=1 --test-launcher-retry-limit=0 --use-mock-keychain`. Optional `--cove-sidebar-snapshot=/tmp/example.png` captures the test window's hover-revealed sidebar compositor. Use the versioned patch series, not stale editing scripts in `/tmp`. Do not edit patch/config/source inputs while GN/Ninja runs. Keep the SSD connected and reuse `out/Cove`.

## Previous 88-patch build: actual macOS Settings menu corrected

The user reproduced Cove → Settings still opening Chromium settings. The macOS application menu uses AppController's `showPreferences:` selector, bypassing the browser-command paths changed in 0087. Patch 0088 routes its profile handler through the existing ActivateOrCreateBrowser helper and native ShowCoveSettings, including the no-browser fallback. The older command test called ShowCoveSettings itself after dispatch, which could mask a routing failure; it now waits for the command to create the named widget.

All five settings browser tests pass with retries disabled, including the actual NSMenu item's target/action via NSApp, unchanged tab count/URL, no-browser profile handling, startup URL preservation, preferences and window lifetime. App compilation, accepted build receipt, renderer smoke and 88-patch SHA/application verification pass. Both configuration identities are `c837cec71c546d7f75811971fba91c3bb3bc5259ff9c990263a599e2c7312c40`. Logs: `/tmp/cove-native88-compile.log`, `/tmp/cove-native88-build-accepted.log`, `/tmp/cove-native88-settings-tests.log`, `/tmp/cove-native88-settings-results.json`, `/tmp/cove-native88-smoke.log`, `/tmp/cove-native88-verify.json`. The broader 23-case run and 67/36 tests below belong to the preceding 87 build; do not claim a clean 25-case run on 88.

Cove is currently closed: the user quit normally before compilation. Keep it closed while further native builds run. QA87 and every normal/Arc profile remain intact. The user additionally requested Arc-style folders, pins and Favorites and explicitly chose to include drag-and-drop. That work is next; underlying folders/pins already exist, but saved-row drag/reorder and dragging live tabs into folders need implementation. Preserve live WebContents/history and stable saved identities; never reset profiles to add organization.

## Previous 87-patch acceptance

The current source extends through 0087. Native app build and renderer smoke pass; both configuration identities are `d84450259b7d916dcf65b7d72b57c0956be7071856f39a675edd832d5db0f44e`. All 23 bounded browser cases pass in one clean run, all 67 focused tests and all 36 tooling tests pass, and the complete 87-patch series verifies. Commits 85473d8, e3b6088, 2608595 and 739487f contain control timing, the reference command bar, the actual delayed sidebar-reopen fix and native settings. Read the new top sections in HANDOFF/VALIDATION for evidence and limitations.

QA87 is open at `.chromium/checkout/profiles/CoveUIValidation-Native87`. It was reopened only after the final build/smoke. This session had no CUA input tools. Native compositor artifacts were inspected for the palette and all six settings sections; real command-path tests inspect actual NSWindow controls. Manual physical hover/re-entry, keyboard feel, titlebar/fullscreen/menu checks remain. Do not bypass CUA guards with AppleScript/CGEvent or alternate UI automation.

The user wants Arc-inspired settings, similar but explicitly not identical, and **no separate Cove account**. The native Profiles section uses existing profiles and a Google account page link. It does not add Google OAuth, Chrome/sidebar sync or a new account service. Current shortcuts are searchable/read-only; custom bindings, Peek and Little Arc remain unfinished. Continue with real native behavior, not dummy controls.

The browser-test filter now includes `CoveSessionBrowserTest.*:CoveSidebarLibraryBrowserTest.*:CoveCaptionButtonsBrowserTest.*:CoveSettingsBrowserTest.*`. Render only the test window via optional `--cove-palette-snapshot=/tmp/example.png --cove-settings-snapshots=/tmp/example-settings`; native compositor capture includes layered controls without a desktop capture request. Do not use old ScreenCaptureKit/plain-View artifacts as visual evidence.

The 83-patch notes below are retained history, not the newest acceptance or running profile.

## Previous 83-patch acceptance

The native source now extends through 0083. 0082 (`38efda9`) adds per-tab/window Space metadata, complete parked/attached journals and deferred restore; 0083 (`0e48b1d`) preserves real pending marked blank canvases. All 67 focused native tests, all 36 tooling tests and all 17 distinct browser regression cases passed after fixes. Browser evidence is split: 16/17 in the full rerun, then the one corrected split fixture passed separately. Do not claim a single clean full-suite run. Final build records match `6ed21115f2e1f16a4890e5ca46382f445f5191d52de228c634254f34696cb5ca`; renderer smoke passed. QA83 was open in that earlier run; read-only CUA captured expanded/collapsed frames, but input is blocked by the repeated app-changed/get_app_state guard despite refresh/rebinding. Resolve that normal tool state before claiming manual UI acceptance; do not bypass it with AppleScript/CGEvent or alternate UI automation. Refresh live status with the handoff script.

The bounded browser target is `cove_session_browsertests`. To rerun relevant native browser acceptance after future changes (isolated profiles are managed by Chromium's harness):

```sh
cd .chromium/checkout/chromium/src
export PATH=".chromium/checkout/depot_tools:$PATH"
export DEPOT_TOOLS_UPDATE=0 DEPOT_TOOLS_METRICS=0
autoninja -C out/Cove -j2 cove_session_browsertests
out/Cove/cove_session_browsertests --gtest_filter='CoveSessionBrowserTest.*:CoveSidebarLibraryBrowserTest.*' --test-launcher-jobs=1 --test-launcher-retry-limit=0 --use-mock-keychain
```

These cover actual disk journal readback, clean-close restore with every history URL/index, pending canvas serialization, pin homes/IDs, foreground reopen, grouped splits, live drafts/history and canceled-unload reparking. Full PRE_/process-kill crash recovery and saved-group sync acceptance remain unfinished. Never launch a normal saved profile to test migration.

The following 81-patch notes are retained history, not the newest source/build identity.

The corrected 81-patch app build, renderer smoke, all 61 focused native tests, all 36 tooling tests and original-file/SHA patch verification passed. Both generated_config and built_config equal `4b18cf075b8f4eca2e03dc704a8e9019410fa33b6db2f0b64586dee38709529a`. Refresh these records with the handoff script before acting; do not repeat an unchanged passing build just to resume. Actual UI acceptance is next.

Three compiler findings were corrected: the folder model needs an out-of-line destructor; the New Folder local must not shadow its command ID; and patch 0080 must use `is_fullscreen(layout_data_->window_state)` because the layout stores browser_view as views::View*. Vertical tabs are already restricted to normal browser windows. Keep all three corrections.

- 0079: persistent nested folders, create subfolders, move whole folders, reorder siblings, move pins into nested paths or out to root, remove a folder while reparenting contents. A separate pure tree model rejects invalid/cyclic destinations and ambiguous duplicate IDs. Six new model tests include 10,000-level traversal and JSON/data-preservation checks.
- 0080: remove the extra 36 DIP top caption strip when the sidebar is hidden; keep a symmetric narrow frame; 8 DIP page corners; darker default violet. Native caption buttons hide at rest and return with sidebar reveal. Fullscreen/AppKit, custom themes and accessibility modes retain their handling. The final native compile and renderer smoke passed, but actual button hit testing, hover and fullscreen cycles need UI evidence.
- 0081: untouched default dark Cove chrome no longer forces ordinary websites dark. Pages follow system appearance; explicit appearance preferences remain authoritative. WebUI/incognito/enterprise/guest behavior is preserved. Three added browser regression cases are SOURCE ONLY unless subsequently built/run.

Do not edit patch/config inputs while GN/Ninja is running. Do not launch a second Ninja against the same output. Only if the source/configuration changes, and once idle, use the existing checkout/output:

```sh
python3 scripts/chromium/cove_chromium.py gen
python3 scripts/chromium/cove_chromium.py build --jobs 2
```

If the current build is already running, monitor it first instead of restarting. Logs under `/tmp/cove-native81*` are disposable. On this Mac there is 18 GiB RAM; two build jobs are deliberate. A BrowserView header change invalidates many native objects, so this batch is larger than the previous two-step rebuild. Never delete output to speed it up.

The focused target has already built and all 61 tests passed for this digest. After future relevant changes, compile and execute it sequentially:

```sh
export PATH=".chromium/checkout/depot_tools:$PATH"
export DEPOT_TOOLS_UPDATE=0 DEPOT_TOOLS_METRICS=0
cd .chromium/checkout/chromium/src
autoninja -C out/Cove -j2 cove_animation_tests
out/Cove/cove_animation_tests
```

Executed: 61 tests (43 animation controller, 12 gesture/Cocoa phase, 6 folder model), all passed. Logs are `/tmp/cove-native81-focused-build.log` and `/tmp/cove-native81-focused-tests.log`; HANDOFF and VALIDATION retain the evidence. Root `npm test` has 36 tooling/verifier tests. The final corrected ordered 81-patch series passed original-file/SHA verification. The original fixture is `/tmp/cove-original-source`, reconstructed from pinned `git show HEAD:<path>` originals, never from patched source.

Renderer smoke already passed for this digest. After future rebuilds, run it only with no QA CUA attachment to the same bundle:

```sh
cd /Users/brianchen/Documents/Cove
python3 scripts/chromium/cove_chromium.py smoke
```

Both `generated_config` and `built_config` in `.chromium/checkout/.cove-chromium-state.json` must match the final ordered patch/config digest. The driver enforces this; do not bypass it for ordinary launch.

## Native UI acceptance

Use CUA exclusively for UI input. Native CUA tooling is available again. Read current HANDOFF/VALIDATION for actual UI results before repeating checks; earlier sessions without tools did not validate the UI. After context compaction, call `await cua.rewriteDocumentation()`. Binding `await cua.getApp('dev.cove.browser')` worked in the earlier session; the old blanket cgWindowNotFound blocker was resolved there. Observe fresh AX IDs before acting. CUA `getApp` can launch a default window if the app has quit, so launch the isolated QA profile deliberately first.

The user has authorized closing all Cove and reopening the QA profile. Quit through the Cove menu if held Cmd+Q does not quit. Preserve every profile. Use exactly one production-bundle QA instance rather than renamed app bundles, which previously caused long attachment stalls:

```sh
open -na .chromium/checkout/chromium/src/out/Cove/Cove.app --args \
  --user-data-dir=.chromium/checkout/profiles/CoveUIValidation-Native83 \
  --no-first-run --no-default-browser-check --use-mock-keychain \
  --disable-background-networking --disable-component-update \
  --enable-logging --log-file=/tmp/cove-native81-runtime.log \
  --vmodule=cove_command_bar_view=1,tab_search_bubble_host=1,browser_commands=1 \
  https://chihbo.me/
```

Mock Keychain is QA-only. Never add it to normal npm start. The public website is the user's screenshot comparison; do not modify their site or stored theme to manufacture a match.

1. Confirm hidden page starts near the top edge without the old caption strip, with balanced frame and no invisible caption-button hot targets. Reveal sidebar, click native controls, repeat Cmd+S/Cmd+L/Cmd+T, enter/exit fullscreen and inspect both layouts. The user withdrew the latest sidebar pop-back report as already fixed; do not alter the hover state machine just for that canceled report.
2. Confirm ordinary page ambient appearance and dark WebUI behavior. Respect manual site themes and explicit browser preferences. Do not call OS-dark behavior a regression merely because the screenshot used a light page.
3. Create nested folders through actual native menus; rename, reorder, move parent/child, reject descendant cycles, move pins in/out, collapse/expand and remove parent while preserving descendants/pins/pages. Reopen QA to check saved organization. This does not establish full per-Space session restoration.
4. Repeat the existing pending Space/draft/history, pin-home/reset, split orientation/swap/ratio/pane-focus and command-bar typing checks listed in HANDOFF.
5. Automated horizontal scroll previously delivered dx=0/dy=0; it is not a physical swipe test. Do not lower thresholds to fake acceptance.

A temporary local fixture exists at `/tmp/cove-runtime-fixture`; `appearance.html` exposes live matchMedia appearance, a page-instance UUID, a draft and history button. Check/start a local HTTP server on an unused loopback port; do not assume an old server survived. Native palette automation may need an explicit AX click into its textfield before typing. Inspect query text before diagnosing classification.

## Storage and scope

- SSD: `/Volumes/SanDisk 1TB`, still ExFAT.
- Dedicated image: `/Volumes/SanDisk 1TB/CoveChromium/CoveBuild.sparsebundle`.
- Ignored repo link: `CoveChromium/CoveBuild.sparsebundle`.
- APFS mount: `.chromium`; checkout `.chromium/checkout`.
- Source: `checkout/chromium/src`; app/output: `src/out/Cove`.
- Retained internal backup: `CoveChromium/CoveBuild.local-backup.sparsebundle`; never mount both copies together.
- Normal user profile: `checkout/profiles/CoveDevelopment`; tests use separate QA profiles.

Never format a disk, replace an occupied mount point, reset the checkout, delete build output or replace browser data. Native code belongs in `native/patches/`; Electron is retired reference only. No image, output or profile belongs in Git.

## What remains after this batch

Durable per-Space session ownership is the largest correctness gap. Read SPACE_RESTORE_DESIGN before coding: full session resets currently omit parked tabs unless enumeration covers them. Stable per-tab/window metadata alone does not solve crash restore. Preserve groups/splits/history and normal beforeunload cancellation.

Other gaps: drag organization and cross-Space moves, unified live pin/Favorite ownership, joined split rows and per-pane headers, drag-to-split/more panes, MRU switcher, configurable keybindings, Peek, Little Arc, import, per-Space profiles/themes, services/sync, packaging/signing/updater and security maintenance. ARC_PARITY is the complete working ledger. Do not claim exact Arc parity, no bugs or superiority over Stedding from a build/smoke.

Before finishing: update permanent validation/handoff with actual evidence and precise blockers, make focused commits without co-author trailers, push `main` to the authorized remote without force, and verify remote HEAD equals local HEAD. `python3 scripts/chromium/handoff.py --prompt` prints this continuation prompt.
