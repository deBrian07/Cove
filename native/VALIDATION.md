# Native validation — 2026-10-30

## Current accepted 93-patch build: reported drag/folder fixes and fresh-process restoration

The user's pin-drag tear-off and missing right-click New Folder fixes are committed/pushed in 0092 (`76a3bb0`; validation `628bb01`). The previous direct-to-folder tests missed the real pointer journey. The new tests walk every pixel through New Tab/separators/padding, retain the existing window and pages, and check cancellation/empty pin areas. A right-click dispatched through the test widget opens the real native menu and naming dialog twice. See the 92 section below for implementation and earlier fixture failures.

Patch 0093 adds a real PRE_/fresh-process restoration pair. With one window, Work active and three saved pages, the new process restores exact history URLs/counts/indices, the selected personal tab, a navigated pin's original home and stable ID, nested/collapsed folders, mixed saved order and Favorites with unknown fields. The fixture verifies that the PRE_ PID differs. It does not manually reconstruct the session in the same process and does not use a real saved browser profile. This patch changes test coverage only; product behavior remains the accepted 92 implementation.

All **47 browser cases passed in one clean final run, with retries disabled**. The two restart phases also passed separately after correcting the fixture's startup. The default browser-test harness appends an about:blank URL argument, so this fixture disables that injected argument to model a normal restore launch; the expected three restored pages remains unchanged. The initial post-process wait failure is retained in `/tmp/cove-native93-restart-tests.log`, not counted as acceptance. The final source uses normal SessionRestore completion and INFO-level test-only snapshot diagnostics. No product workaround was added to make the restart test pass.

All 93 patches pass original-file SHA256/sequential-application verification; all 36 tooling tests pass. The last 75 focused native model/animation cases passed on 0089, and those implementations remain unchanged. Final app/test build, accepted build receipt and isolated renderer smoke pass. Generated/built identities match `0e0ad2341ae96cac6cca6beda735ce9fa58d3d85dcd02e9a649d8e87597433e0`. Final evidence: `/tmp/cove-native93-browser-tests.log`, `/tmp/cove-native93-browser-results.json` (46 SUCCESS entries with the PRE_ phase folded into its dependent result; all 47 executions pass, no retries), `/tmp/cove-native93-final-build.log`, `/tmp/cove-native93-build-accepted.log`, `/tmp/cove-native93-smoke.log`, `/tmp/cove-native93-tooling.log`, `/tmp/cove-native93-verify.json`. The passing focused restart pair is `/tmp/cove-native93-restart-fixed-tests.log` and `/tmp/cove-native93-restart-fixed-results.json`.

Cove remains closed because the user asked to continue source work. For the next interactive pass, reuse the preserved isolated QA profile `/Volumes/CoveBuild/checkout/profiles/CoveUIValidation-Native91`; the suffix records its creation build and reuse preserves the user's QA session. Launch without a URL argument and with `--restore-last-session` to avoid adding another blank tab. No QA93 window has been launched. Existing normal/Arc/prototype profiles and other QA profiles remain intact. Before future linking, identify the live profile and request normal Quit, then verify exit; never force quit, replace running app files or remove profiles. No CUA input tools were available. The earlier normal application Quit was a lifecycle request for the sole owned QA process, not a workaround for an automation input guard.

### Continue here

The user requested sustained Arc-parity work and a reliable handoff before the token limit. Do not claim perfect/100% parity. First manually check the reported drag route and background right-click in the updated app when normal input tools are available. Native fixture results are not hardware mouse/trackpad/fullscreen acceptance.

The next source issue to investigate is long saved-list accessibility: `CoveSidebarLibraryView` is directly inside `space_rows_view_` in `chrome/browser/ui/views/frame/vertical_tab_strip_region_view.cc`, with preferred-size rows and a clipping ancestor but no saved-library scroll container. Many pins/folders can consume the visible area and hide later saved rows or Today tabs. Add a regression with a long nested/collapsed list, ensure both the last saved row and live tabs remain reachable, then implement scrolling without losing native drag handles, transforms, focus or Space-slide clipping. Existing native tab-list scroll views already have drag synchronization; an outer/unified scroller must account for that. Do not blindly cap/hide data. Drag-edge autoscroll and hover-revealed saved-row drag lifetime need dedicated acceptance. No patch 0094 has been started.

Grouped/split/multi-tab and cross-Space live organization, multi-window/group/split fresh-process restoration and actual process-kill recovery, saved-group sync, pane headers/joined rows, Peek, Little Arc and editable shortcuts remain. Keep the no-separate-Cove-account preference. See ARC_PARITY.md for the full list.

Reuse `/Volumes/CoveBuild/checkout/chromium/src` and out/Cove, jobs=2; keep the SSD connected. Never edit source/patch/config inputs while GN/Ninja runs, and never run two Ninja instances against that output. Versioned patches are authoritative. `/tmp/cove92-export.py` exports 92 against `/tmp/cove92-before/`; `/tmp/cove93-export.py` exports 93 against `/tmp/cove93-before/`. Do not rerun non-idempotent install/edit scripts. Session tests are in `chrome/browser/ui/cove/cove_session_browsertest.cc`, not under views/cove. Main sidebar/drag source is under views/cove, views/frame and views/tabs/dragging.

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

The user quit Cove normally before builds. Existing QA87 and all normal/Arc/prototype profiles were preserved. QA91 was opened after final acceptance and uses only `/Volumes/CoveBuild/checkout/profiles/CoveUIValidation-Native91` and `/tmp/cove-native91-ui.log`. Refresh live state before the next build; quit any running QA window normally before replacing its app. No separate Cove account or sync service was added; existing profiles and the Google account page link remain.

## Previous 88-patch build: actual macOS Settings menu corrected

The user reproduced Cove → Settings still opening Chromium settings. The macOS application menu uses AppController's `showPreferences:` selector, bypassing the browser-command paths changed in 0087. Patch 0088 routes its profile handler through the existing ActivateOrCreateBrowser helper and native ShowCoveSettings, including the no-browser fallback. The older command test called ShowCoveSettings itself after dispatch, which could mask a routing failure; it now waits for the command to create the named widget.

All five settings browser tests pass with retries disabled, including the actual NSMenu item's target/action via NSApp, unchanged tab count/URL, no-browser profile handling, startup URL preservation, preferences and window lifetime. App compilation, accepted build receipt, renderer smoke and 88-patch SHA/application verification pass. Both configuration identities are `c837cec71c546d7f75811971fba91c3bb3bc5259ff9c990263a599e2c7312c40`. Logs: `/tmp/cove-native88-compile.log`, `/tmp/cove-native88-build-accepted.log`, `/tmp/cove-native88-settings-tests.log`, `/tmp/cove-native88-settings-results.json`, `/tmp/cove-native88-smoke.log`, `/tmp/cove-native88-verify.json`. The broader 23-case run and 67/36 tests below belong to the preceding 87 build; do not claim a clean 25-case run on 88.

Cove is currently closed: the user quit normally before compilation. Keep it closed while further native builds run. QA87 and every normal/Arc profile remain intact. The user additionally requested Arc-style folders, pins and Favorites and explicitly chose to include drag-and-drop. That work is next; underlying folders/pins already exist, but saved-row drag/reorder and dragging live tabs into folders need implementation. Preserve live WebContents/history and stable saved identities; never reset profiles to add organization.

## Previous accepted 87-patch acceptance

Native app build and renderer smoke pass. Generated and built configuration identities both equal `d84450259b7d916dcf65b7d72b57c0956be7071856f39a675edd832d5db0f44e`. All 87 patches pass original-file SHA/application verification. All 23 browser cases passed in one clean run with retries disabled: 17 session/Space cases, three caption/sidebar cases and three settings cases. All 67 focused native tests and 36 tooling tests pass.

The new browser cases inspect all three NSWindow controls before pumping collapse animation events, repeat collapse/expansion, preserve sidebar state on command-bar dismissal, clear focused address fields and remain hidden beyond the hover delay, preserve startup URLs when changing restore mode, persist download preferences across settings-window reopening, render all six sections and exercise the actual Settings command followed by a Chromium settings destination. Closing the native settings window releases its widgets/views; the harness's accessibility leak check passes.

The command bar and six settings sections were inspected from their actual compositor output. Paths: `/tmp/cove-native87-final-palette.png`, `/tmp/cove-native87-final-settings/`. These are own-window rendered artifacts, not desktop captures or complete AppKit titlebar screenshots. ScreenCaptureKit -3811 and plain-View incomplete artifacts in earlier development logs do not establish visual acceptance.

Final run: `/tmp/cove-native87-browser-tests.log`, summary `/tmp/cove-native87-browser-results.json` (23 SUCCESS, zero retries). Build: `/tmp/cove-native87-polish-build.log` and `/tmp/cove-native87-build-accepted.log`; smoke: `/tmp/cove-native87-smoke.log`; tooling: `/tmp/cove-native87-tooling.log`; focused: `/tmp/cove-native86-focused-tests.log`; verifier: `/tmp/cove-native87-verify.json`. Earlier settings failures were corrected before the clean full run.

QA87 is open in its isolated profile. No CUA tools were available in this session. Physical hover/keyboard, fullscreen, caption hit testing and menu acceptance remain pending, as do PRE_/process-kill recovery and broader migration checks. Saved normal/Arc/prototype browser data remains intact. Google account access is a profile-local web link; no separate Cove account, OAuth identity layer or cloud/sidebar sync was added.

## Previous accepted 83-patch build: automated acceptance passed; manual UI limited

The native app and bounded browser-test target compile and link. Final native renderer smoke passed. Both configuration records equal `6ed21115f2e1f16a4890e5ca46382f445f5191d52de228c634254f34696cb5ca`. All 83 patches passed original-file SHA/application verification. All 67 focused native tests and 36 tooling tests passed. Patch 0082 adds session ownership; 0083 preserves the real pending about:blank navigation of a newly marked canvas during an immediate journal reset.

The first real browser run was 13/16 passing. After corrections, the next full run passed 16/17, with one split fixture crashing because it pumped navigation before organizing the intentional canvas. Correcting only that fixture's setup order made its focused rerun pass. All 17 distinct cases therefore passed after fixes, across these runs; the old full-run JSON is not a clean 17/17 artifact. Logs: `/tmp/cove-native83-browser-tests.log`, `/tmp/cove-native83-split-test.log`; summaries: `/tmp/cove-native83-browser-results.json`, `/tmp/cove-native83-split-results.json`.

Executed passing cases include actual disk journal saving/readback with parked history, clean-close native session reconstruction with exact history, independent window Space metadata, malformed ownership retaining native collections, preserved navigated pin homes, foreground recently-closed selection, immediate marked canvases, live drafts/history, grouped splits and canceled-unload reparking. Full crash/process-restart and broader actual UI acceptance remain required. The isolated QA83 window was launched and both expanded/collapsed frames were captured, visibly confirming removal of the old hidden-sidebar caption strip. CUA then repeatedly refused input with its Cove.app-changed/get_app_state guard despite refreshed snapshots and app rebinding. No final native menu, repeated shortcut, caption hit-target or fullscreen acceptance is claimed. See HANDOFF for precise current logs and continuation commands.

## Previous accepted 81-patch build: automated checks passed, UI acceptance pending

The current versioned source extends through 0081: nested folders, the reference-frame correction and separate ambient website appearance. GN generation and the native application build passed. Both generated_config and built_config equal `4b18cf075b8f4eca2e03dc704a8e9019410fa33b6db2f0b64586dee38709529a`.

Resuming the interrupted compile found an 0080 type error: the layout stores browser_view as views::View*, so BrowserView-only calls did not compile. The patch now uses the layout's existing fullscreen state; vertical tabs are already restricted to normal windows. The earlier folder-model destructor and shadowed-local fixes remain intact.

- All 36 Python tooling/verifier tests passed after the correction.
- All 81 patches passed original-file SHA256, sequential application and whitespace verification against `/tmp/cove-original-source`.
- The final incremental app build passed: 37 steps in 2m22.10s, reusing out/Cove.
- The focused native test build passed: two steps in 44.08s. All 61 executed tests passed: 43 animation controller, 12 gesture/Cocoa phase and six folder model tests.
- Native renderer smoke passed with a fresh temporary profile after the final app build.

The three appearance browser regressions remain source-only; browser_tests and the full Chromium unit/interactive suites have not run. This session has no CUA tools, so no new actual UI acceptance was attempted. Earlier successful CUA attachment is historical evidence, not current tool availability. Folder menus/persistence, frame/caption hit targets and fullscreen, live website appearance, plus the pending Space/pin/split/input checks still need the final UI pass. No normal browser profile was launched, replaced or migrated.

Disposable logs are `/tmp/cove-native81-build-resume.log`, `/tmp/cove-native81-focused-build.log`, `/tmp/cove-native81-focused-tests.log` and `/tmp/cove-native81-smoke.log`. The results above are the permanent record.

Run `python3 scripts/chromium/handoff.py` and read [NEXT_AGENT_PROMPT.md](NEXT_AGENT_PROMPT.md) for exact continuation commands and UI acceptance. No complete Arc-parity claim is made.

## Previous accepted 78-patch native build

Cove is native Chromium 156.0.8078.48 at pinned revision `d0c02bfad08ec92a6ffcf989e53cd995e6381a4c`. The ordered native series contains 78 patches. The final build and renderer startup smoke passed. Both configuration records equal:

```text
a64d8332da85feb3a5c0599ffa31e054e68dfc94c4e6fdd51c1064a903a4a878
```

The dedicated sparsebundle remains on the ExFAT SanDisk volume, mounted as the existing APFS build image at `/Volumes/CoveBuild`. Source, output and saved profiles were preserved. No format, checkout reset or output deletion was used.

## Executed checks

- 32 build-tool tests and four patch-verifier tests passed.
- All 78 patches applied against the pinned upstream fixture with SHA256 checks and whitespace validation.
- The native app compiled, including the new command, pin-home and split implementations. Final incremental build: two steps, 57.57s.
- All 55 tests in `cove_animation_tests` passed: 43 actual animation-controller tests and 12 gesture/Cocoa-phase cases. These do not exercise the new browser command workflows.
- Final native renderer smoke passed using its isolated temporary profile.
- A startup smoke failure in the first split batch detected duplicate accelerator registrations; the duplicates were removed before the final passing smoke. The final digest above contains the correction.

Full Chromium browser_tests, unit_tests and interactive_ui_tests have not run. Source-only browser regressions and engine smoke are not full UI acceptance.

## Live observations and limits

On earlier builds this session, native command-bar URL submission, selected-row activation, pin/unpin and contextual Cmd+S were exercised. The 0068 native input retained immediately typed r/a/p, including after collapsed Cmd+L → Cmd+T. On 0074, explicitly targeting the native input accepted rap and Cmd+S dismissed the palette while leaving the sidebar expanded. Final immediate-input acceptance remains incomplete because automation sometimes reactivates the parent window.

The rebuilt new-tab page visibly reported Customize Cove. Patch 0074 also changes the default PDF viewer prompt and 82 other English product messages; XML/resource generation passed. This does not claim every translated or engine-internal string has been rebranded.

The 0076 Control+2 check exposed a pending same-document navigation in a parked page calling LensOverlayEntryPointController::From(nullptr). Patch 0077 guards that parked-page path. The final round trip has not been rerun successfully through GUI automation: CUA returns cgWindowNotFound for the running CoveUIValidation-Native78 window. The app and renderer are running, and final renderer smoke passes, but Control+1–9, Space-name actions, pin reset/replace and new split actions remain awaiting final live acceptance.

Horizontal scrolling through CUA produced raw dx=0/dy=0, so it cannot demonstrate a real trackpad Space swipe. Gesture state tests pass; physical movement, slide presentation, rapid interruption and reduced motion remain unverified in the final GUI.

See [ARC_PARITY.md](ARC_PARITY.md) for functional scope and [HANDOFF.md](HANDOFF.md) for exact pending acceptance steps. Cove is not yet complete Arc parity or demonstrated better than Stedding.

## Earlier 55-patch validation record

The following is retained historical evidence, not the current build identity.


### Current build and storage

Cove is native Chromium `156.0.8078.48`, pinned to `d0c02bfad08ec92a6ffcf989e53cd995e6381a4c`. The current ordered series contains 55 patches. GN generation and the complete native build succeeded; the last incremental build completed 3 steps in 1m00.47s.

Both `generated_config` and `built_config` equal:

```text
d623603353096572a62dd1ea4be06bb221d3a7b0e412855bdce177e3fac77ab3
```

The user reconnected the external disk. Doctor mounted the existing `/Volumes/SanDisk 1TB/CoveChromium/CoveBuild.sparsebundle` at `/Volumes/CoveBuild` and passed. The SSD is still mounted as ExFAT; its last checked free space was 871531282432 bytes. Source/output remain inside the APFS image. Existing SSD files, the internal backup and browser profiles were preserved. No checkout reset, disk formatting or build-output deletion was used.

### Automated checks

- All 32 Python build-tool tests and 4 patch-verifier tests passed.
- The full ordered 55-patch series applies in a disposable fixture against original upstream files and pinned SHA256 checks.
- The native application built successfully with matching configuration records.
- Native Chromium renderer smoke passed on the final patch set with an isolated temporary profile.
- `cove_accessibility_lifetime_smoke` built and ran successfully against Cove's actual Views component. It checks a normal default action receives press/release and that a view deleted during press receives no subsequent release. Output: `PASS: accessible default action preserves release and survives target deletion on press`.

The lifetime executable uses a custom event fixture around the real View::HandleAccessibleAction dispatcher. It initializes AXPlatform but does not create a Widget/AppKit window. It is a focused lifetime regression, not proof of all Cocoa/screen-reader behavior. Its target is independent of the full browser test suite and does not access a browser profile.

### Actual native UI observations

CUA used isolated CoveUIValidation-* profiles. The final production-bundle profile is `/Volumes/CoveBuild/checkout/profiles/CoveUIValidation-Final-d6236033`. CoveDevelopment, Arc and the retired Electron profile were not used for test data. Mock Keychain is limited to these QA/smoke profiles; ordinary npm start does not use it.

Observed in the running native app:

- The filled sidebar address field, caption navigation, narrow rounded page frame, quiet New Tab row and footer controls render. Active pins expose selected state and avoid a duplicate expanded native pin grid. Folder icons and active Space dots have corrected insets.
- The native Cocoa footer menu created three folders through repeated open/action/reopen. Cmd+L remained responsive afterward and the fixture's page-instance UUID stayed identical. Favorite addition worked and its saved URL appeared across Spaces.
- Cmd+D produced one selected persistent pin row. One Cmd+W closed its page while preserving the saved row and window. The empty canvas had no visible placeholder tab row.
- The command bar accepted the controlled local URL `http://127.0.0.1:8765/second.html?command-check`; Return opened it, dismissed the bar and returned focus to the page. Its selected row has symmetric insets and an unclipped action arrow; hidden section headers no longer reserve phantom rows.
- Creating a native split from a marked blank Space retained the left blank pane while the right pane navigated to the local second page. Ctrl+Shift+1 and Ctrl+Shift+2 focused the correct panes. Ctrl+Shift+Minus separated them. Cmd+Alt+Up/Down reached both retained tabs afterward.
- Final patches 0054–0055 passed the specific empty-to-real transition: a fresh Work Space initially hid its canvas row, navigation of that same tab revealed the real page row and enabled Archive Today.
- Archive Today then closed that ordinary page while keeping the window on an empty canvas. Cmd+Shift+T restored the page and its visible tab row; after queued cleanup settled, the temporary blank placeholder was gone.

Earlier foundation/runtime passes also preserved the exact page UUID, unsent draft, history fragment, pin and split state across Space round trips. Inactive guarded pages participated in the native beforeunload pipeline, and canceling close preserved the original page. Those tests preceded the final presentation changes; they were not all rerun in this final pass. The native rename dialog previously selected the existing name, rejected whitespace and saved the replacement on Return. Folder move activation remains incompletely verified.

### Reproduced crash and fix

A real QA crash produced `/Users/brianchen/Library/Logs/DiagnosticReports/Cove-2026-10-26-205025.ips`. It was a null virtual dispatch from `views::View::HandleAccessibleAction` during native accessibility activation. A menu action could rebuild and delete its originating button during the synthetic press, after which the handler sent release to the destroyed view.

Patch 0053 tracks the target across press and suppresses release if it was destroyed. The native regression passed, and repeated menu actions plus subsequent keyboard navigation completed in the real app. This is stronger evidence than treating every stale AX handle or closed popup as a crash. It is not a general crash-free guarantee.

The earlier parked-tab delayed-metrics crash is separately guarded by 0020, and the split-navigation null-window path by 0021. Do not drop those patches while retaining live detached Spaces.

### Limits and next checks

Full browser_tests, unit_tests and interactive_ui_tests binaries have not been built/run. Five CoveSidebarLibraryBrowserTest cases, split/pin command source regressions and the detached-metrics regression remain unexecuted. An earlier optional single test-object build pulled thousands of prerequisites and was stopped; that does not count as test execution.

No exact Arc-parity, measured latency/frame-time, reduced-motion, complete accessibility or memory/performance claim is made. Full per-Space session ownership after restart, pinned-home/model unification, drag/nested folders, exact pane headers/joined split rows, more than two panes, recent-tabs/Space shortcuts, Peek/Little Arc/import, standalone packaging, signing and updater remain unfinished. See HANDOFF.md and ARC_PARITY.md.

### Completion note

The final renderer smoke passed, the configuration records match the 55-patch digest above, and Git whitespace checks passed. Native fixes are committed in `46628f7`, `bdc093f` and `9ecabbc`, without co-author trailers. Documentation records the remaining gaps instead of presenting this as full Arc parity.
