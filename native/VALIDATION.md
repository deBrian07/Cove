# Native validation — 2026-10-29

## New 81-patch source batch: acceptance pending

The current versioned source extends through 0081: nested folders, the reference-frame correction and separate ambient website appearance. Final GN generation passed at `75d4bf2d065b8f347e740b406c9f33f3b6002840ea3daa2688005aa84cb1ea66`. The native app compile is in progress in `/tmp/cove-native81-build-final.log`; its built_config is not yet accepted. Two compiler findings (folder-model destructor and a shadowed local) were corrected before this generation. Do not launch or report the old app bundle as the new completed build.

All 36 Python tests passed. The final corrected 81-patch series passed original-file SHA256/application verification. The six added folder tests (61 expected focused tests total) and three added appearance browser tests have not run. New native runtime and renderer-smoke acceptance remain pending. CUA did attach this turn, so the earlier blanket attachment blocker below is historical.

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
