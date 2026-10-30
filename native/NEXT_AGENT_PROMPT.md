# Continue Cove native Chromium

Work in `/Users/brianchen/Documents/Cove`. Read `AGENTS.md`, `native/HANDOFF.md`, `native/VALIDATION.md`, `native/ARC_PARITY.md` and `native/SPACE_RESTORE_DESIGN.md` first. Run:

```sh
python3 scripts/chromium/handoff.py
```

That script is read-only. It prints Git state, patch count, live build processes if available, configuration identities and the latest build log. Do not infer a passing build from an existing app bundle.

The user wants native Cove to match Arc's functions and supplied screenshots, and requested a continuation handoff before the usage limit. They also authorized pushing the complete project history to `https://github.com/deBrian07/Cove.git`, branch `main`, without co-author trailers. Preserve existing history; do not reinitialize Git or replace README with a one-line stub. The requested remote was empty when checked, and GitHub authentication uses `deBrian07`.

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

QA87 is open at `/Volumes/CoveBuild/checkout/profiles/CoveUIValidation-Native87`. It was reopened only after the final build/smoke. This session had no CUA input tools. Native compositor artifacts were inspected for the palette and all six settings sections; real command-path tests inspect actual NSWindow controls. Manual physical hover/re-entry, keyboard feel, titlebar/fullscreen/menu checks remain. Do not bypass CUA guards with AppleScript/CGEvent or alternate UI automation.

The user wants Arc-inspired settings, similar but explicitly not identical, and **no separate Cove account**. The native Profiles section uses existing profiles and a Google account page link. It does not add Google OAuth, Chrome/sidebar sync or a new account service. Current shortcuts are searchable/read-only; custom bindings, Peek and Little Arc remain unfinished. Continue with real native behavior, not dummy controls.

The browser-test filter now includes `CoveSessionBrowserTest.*:CoveSidebarLibraryBrowserTest.*:CoveCaptionButtonsBrowserTest.*:CoveSettingsBrowserTest.*`. Render only the test window via optional `--cove-palette-snapshot=/tmp/example.png --cove-settings-snapshots=/tmp/example-settings`; native compositor capture includes layered controls without a desktop capture request. Do not use old ScreenCaptureKit/plain-View artifacts as visual evidence.

The 83-patch notes below are retained history, not the newest acceptance or running profile.

## Previous 83-patch acceptance

The native source now extends through 0083. 0082 (`38efda9`) adds per-tab/window Space metadata, complete parked/attached journals and deferred restore; 0083 (`0e48b1d`) preserves real pending marked blank canvases. All 67 focused native tests, all 36 tooling tests and all 17 distinct browser regression cases passed after fixes. Browser evidence is split: 16/17 in the full rerun, then the one corrected split fixture passed separately. Do not claim a single clean full-suite run. Final build records match `6ed21115f2e1f16a4890e5ca46382f445f5191d52de228c634254f34696cb5ca`; renderer smoke passed. QA83 was open in that earlier run; read-only CUA captured expanded/collapsed frames, but input is blocked by the repeated app-changed/get_app_state guard despite refresh/rebinding. Resolve that normal tool state before claiming manual UI acceptance; do not bypass it with AppleScript/CGEvent or alternate UI automation. Refresh live status with the handoff script.

The bounded browser target is `cove_session_browsertests`. To rerun relevant native browser acceptance after future changes (isolated profiles are managed by Chromium's harness):

```sh
cd /Volumes/CoveBuild/checkout/chromium/src
export PATH="/Volumes/CoveBuild/checkout/depot_tools:$PATH"
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
export PATH="/Volumes/CoveBuild/checkout/depot_tools:$PATH"
export DEPOT_TOOLS_UPDATE=0 DEPOT_TOOLS_METRICS=0
cd /Volumes/CoveBuild/checkout/chromium/src
autoninja -C out/Cove -j2 cove_animation_tests
out/Cove/cove_animation_tests
```

Executed: 61 tests (43 animation controller, 12 gesture/Cocoa phase, 6 folder model), all passed. Logs are `/tmp/cove-native81-focused-build.log` and `/tmp/cove-native81-focused-tests.log`; HANDOFF and VALIDATION retain the evidence. Root `npm test` has 36 tooling/verifier tests. The final corrected ordered 81-patch series passed original-file/SHA verification. The original fixture is `/tmp/cove-original-source`, reconstructed from pinned `git show HEAD:<path>` originals, never from patched source.

Renderer smoke already passed for this digest. After future rebuilds, run it only with no QA CUA attachment to the same bundle:

```sh
cd /Users/brianchen/Documents/Cove
python3 scripts/chromium/cove_chromium.py smoke
```

Both `generated_config` and `built_config` in `/Volumes/CoveBuild/checkout/.cove-chromium-state.json` must match the final ordered patch/config digest. The driver enforces this; do not bypass it for ordinary launch.

## Native UI acceptance

Use CUA exclusively for UI input. Native CUA tooling is available again. Read current HANDOFF/VALIDATION for actual UI results before repeating checks; earlier sessions without tools did not validate the UI. After context compaction, call `await cua.rewriteDocumentation()`. Binding `await cua.getApp('dev.cove.browser')` worked in the earlier session; the old blanket cgWindowNotFound blocker was resolved there. Observe fresh AX IDs before acting. CUA `getApp` can launch a default window if the app has quit, so launch the isolated QA profile deliberately first.

The user has authorized closing all Cove and reopening the QA profile. Quit through the Cove menu if held Cmd+Q does not quit. Preserve every profile. Use exactly one production-bundle QA instance rather than renamed app bundles, which previously caused long attachment stalls:

```sh
open -na /Volumes/CoveBuild/checkout/chromium/src/out/Cove/Cove.app --args \
  --user-data-dir=/Volumes/CoveBuild/checkout/profiles/CoveUIValidation-Native83 \
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
- APFS mount: `/Volumes/CoveBuild`; checkout `/Volumes/CoveBuild/checkout`.
- Source: `checkout/chromium/src`; app/output: `src/out/Cove`.
- Retained internal backup: `CoveChromium/CoveBuild.local-backup.sparsebundle`; never mount both copies together.
- Normal user profile: `checkout/profiles/CoveDevelopment`; tests use separate QA profiles.

Never format a disk, replace an occupied mount point, reset the checkout, delete build output or replace browser data. Native code belongs in `native/patches/`; Electron is retired reference only. No image, output or profile belongs in Git.

## What remains after this batch

Durable per-Space session ownership is the largest correctness gap. Read SPACE_RESTORE_DESIGN before coding: full session resets currently omit parked tabs unless enumeration covers them. Stable per-tab/window metadata alone does not solve crash restore. Preserve groups/splits/history and normal beforeunload cancellation.

Other gaps: drag organization and cross-Space moves, unified live pin/Favorite ownership, joined split rows and per-pane headers, drag-to-split/more panes, MRU switcher, configurable keybindings, Peek, Little Arc, import, per-Space profiles/themes, services/sync, packaging/signing/updater and security maintenance. ARC_PARITY is the complete working ledger. Do not claim exact Arc parity, no bugs or superiority over Stedding from a build/smoke.

Before finishing: update permanent validation/handoff with actual evidence and precise blockers, make focused commits without co-author trailers, push `main` to the authorized remote without force, and verify remote HEAD equals local HEAD. `python3 scripts/chromium/handoff.py --prompt` prints this continuation prompt.
