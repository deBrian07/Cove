# Cove native continuation

## Current — Nov 6 evening: 0123–0131 committed; codec rebuild running

Patches 0123–0131 are committed one per change (see ARC_PARITY.md for what each does). All 131 patches pass the pinned-original verifier, and applying the series to pristine sources reproduces the built checkout exactly. `upstream-files.json` gained `session_crashed_bubble_view.cc` (0126). Each patch compiled in an incremental `chrome cove_session_browsertests` build.

`args.gn` now sets `proprietary_codecs = true` and `ffmpeg_branding = "Chrome"`: H.264/AAC (MP4) media did not play before. `out/Cove/args.gn` was reconciled explicitly, official `gen` succeeded, and a long official `build --jobs 2` is the next gate. After it, smoke-test MP4 playback, then commit the args change.

### Testing in the terminal-mac VM

Real-input tests must not run on the user's own Mac. A shared terminal-mac VM (`default`, user `bibimbap`, macOS 27.2, 4 GB) is used instead. Another agent (the Nalana session) shares it; coordinate turns with SendMessage ("taking VM", "VM free"). Close every window you are done with.

- Host serves `.chromium/tmp/vm/` on `192.168.64.1:18765`; `.chromium/tmp/vm/upload_server.py` receives uploads on `:18766` into `uploads/`.
- Guest layout: `~/CoveTest/src/out/Cove` holds the component build (`~/CoveTest/build` links to it); test pages sit under `~/CoveTest/src/chrome/test/data` and `net/data/ssl`. Run `curl -fsS 192.168.64.1:18765/s | sh` once to create it.
- `pack-delta.sh`, `pack-tests.sh` package changed outputs and the test bundle; in the guest, `u` updates, `t '<filter>'` runs tests with a 300 s timeout and uploads `test.log`, `d` uploads diagnostics, `run.sh` launches Cove with `~/CoveTest/profile`.
- Type commands through Terminal's Shell > New Command (⇧⌘N). The MCP `type` tool drops text unless one `key` press precedes it.

VM results: CommandBarPutsTypedTextFirst, OutsideClickUsesPressLocationNotCursor, InterruptedSpaceSlideContinuesFromScreen and RejectsNonWebDestinations passed. Three new tests hit the default 45 s timeout in the slow VM, and 17 Little Cove plus one mini-player test failed only because their test pages were absent. Rerun them with the data layout above before claiming acceptance.

## Previous — Nov 6: 0122 validated; SSD disconnected on resume

Read this section before the historical checkpoints below. Patches 0119–0121 were committed by the other agent and preserved. Patch 0122, committed as `d7e1dd4`, corrects the native test fixtures to use Chromium's standard foreground activation helper. The full suite, official generation/build receipt and isolated renderer smoke all passed before the interruption. On the latest resume, `/Volumes/SanDisk 1TB` is absent and `.chromium/` is unmounted. Do not replace it with the older local image or create a second checkout. The user has been asked to reconnect the SSD.

### Completed behavior and validation

- 0119: Little Cove's native address field is editable. Cmd+L reaches it; Escape, Enter and back/forward work. Cmd+O promotes the exact page into a specific Space; Cmd+Shift+O opens the searchable Space chooser, and Escape returns focus. Ordinary popup semantics remain intact.
- 0120: the real Links setting `cove.external_links_in_temporary_windows` defaults to true and routes external URLs to temporary windows or a same-profile main browser. Persistence, reopening settings and both routes pass.
- 0121: the command bar dismisses on an outside mouse press without consuming the click or stealing focus. Its native regression performs three open/inside-click/outside-page-button cycles, preserves the draft, URL and tab count, and retains the cached widget.
- 0122 is test-only: both native-input fixtures enable UI controls in `SetUpCommandLine`, before Chromium installs fake focus, and call `ui_test_utils::BringBrowserWindowToFront(browser())`. The target links `//chrome/test/base:interactive_test_utils`. Do not return to `activateIgnoringOtherApps`; upstream documents it as unreliable. Keep jobs=1 and avoid desktop focus changes during these tests.

All **108 browser executions passed in one run, retries disabled, in 870 seconds**. JSON contains one iteration with **107 SUCCESS keys**, no repeated results; the PRE_ phase is folded. This includes actual mouse drops into Pins/Favorites/folders, media controls, external routing, editable address/history and keyboard/mouse Space promotion. All **122 patches** pass pinned-original SHA/sequential application checks. All **38 tooling tests** passed (33 scripts + 5 verifier tests; tooling source unchanged afterward). Official gen and build succeeded; renderer smoke succeeded outside the command sandbox. The first sandboxed smoke failed to start successfully; its log is retained, not counted as a pass.

Current/generated/built configuration were all verified equal to:

`562f3b871baecf2266ea2d9e1eade5a83fd276ca614f1f2281f7344c352bb971`

Evidence on the SSD, relative to `.chromium/tmp/`:

| Check | Evidence |
| --- | --- |
| Full browser run | `cove122/full-tests.log`, `cove122/full-results.json` |
| Patch verifier | `cove122/verify.json`, `cove122/verify-errors.log` |
| Tooling | `cove121/accepted/tooling.log` |
| App/test incremental build | `cove122/build.log` |
| Official generation/build receipt | `cove122/gen-final.log`, `cove122/receipt-final.log` |
| Identity comparison | `cove122/identity-final.log` |
| Passing renderer smoke | `cove122/smoke-unsandboxed.log` |
| Earlier sandboxed smoke failure | `cove122/smoke-final.log` |
| Desktop check/diagnostics | `cove122/desktop-check.log`, `cove122/desktop-diagnostics.log` |

### Desktop check and unresolved follow-up

The isolated profile `CoveUIValidation-OutsideClick122` opened the built native app and local `cove122/outside-click.html` page. Cmd+T accepted queries; Escape returned to an edited page with its draft intact. Outside coordinate clicks dismissed the palette, but the desktop tool also dismissed it on an intended inside click and failed to resolve the page-button position while the floating window was active. Do not count this as an independent desktop click-delivery acceptance or a confirmed physical-input regression. The existing native real-mouse regression passed inside-click retention and page-click delivery. A second diagnostic launch enabled `--vmodule=tab_search_bubble_host=1,cove_command_bar_view=1`; inspection was interrupted. No Cove app was present in the latest CUA inventory after disk disconnection. Confirm processes again after reconnecting; do not assume an old exec session is still live.

Read-only audit found a concrete robustness concern worth testing next: `EventMonitorMac::GetLastMouseLocation()` reads the current global cursor, rather than the native press coordinates. A queued click can disagree with the later cursor position. Distinguish this from the desktop tool raising the main window and deactivating the palette; host activation logs can identify that path. No 0123 product change has been made.

A narrow Mac correction, if the deterministic regression reproduces it: derive the point from `NSEvent.locationInWindow`, convert through `native.window` with `convertPointToScreen:`, then `gfx::ScreenPointFromNSPoint`. Nil-window mouse locations already use Cocoa screen coordinates. Keep the cursor fallback only for events without a native event. **Do not use `EventSystemLocationFromNative` on macOS: this checkout returns (0,0) after NOTIMPLEMENTED.** LocatedEvent root coordinates are window-relative here. Add a regression with cursor outside/native press inside, then the inverse, plus the existing real-click delivery test. Preserve ordinary popups, context menus and multiple displays.

A separate small optimization is to release the palette's application monitor in `VisibilityChanged(View*, bool)` when `is_visible` is false, keeping `RemovedFromWidget` cleanup and lazy recreation in `ShowExisting`. Widget visibility propagates to child Views. Extend the existing three-cycle test to verify monitor presence while shown and absence after outside-click/explicit dismissal. This is unmeasured overhead, not established latency. Do not combine speculative changes without tests.

### Resume safely

1. Reconnect the existing SanDisk, then run `python3 scripts/chromium/cove_chromium.py mount`. Never reformat, replace an occupied mount point, delete output, reset source or replace profiles. The existing sparsebundle symlink targets `/Volumes/SanDisk 1TB/CoveChromium/CoveBuild.sparsebundle` and mounts at this repository's `.chromium/`.
2. Read `python3 scripts/chromium/handoff.py`, Git state, live processes and diagnostic logs before edits. Reuse `.chromium/checkout/chromium/src/out/Cove`. No source/patch/config edits during GN/Ninja; no linking while the app/tests run. Keep native, Arc and archived prototype profiles separate.
3. Continue the click-coordinate investigation with a deterministic regression and inspect the desktop activation trace. Do not claim exact Arc UI, physical trackpad/frame-time parity or production readiness. Broader work remains rapid Space-motion interruption/reversal, Peek, joined split rows/pane headers, Space ordering/profile assignment and global Little Cove launch.
4. Run native browser binaries from repository cwd with `TMPDIR=/tmp`, jobs=1, retries=0 and `--use-mock-keychain`. Do not use the old `cove107/run-checks.py`: it changes cwd and caused GPU/dyld sandbox failures. Verify patches against pristine originals at `.chromium/tmp/cove114/upstream`, never the patched live checkout.
5. After any new source changes, rebuild/test, then official `gen` → `build --jobs 2` → `smoke` and confirm current/generated/built equality. Never stamp the receipt manually. Preserve every diagnostic log and update these continuation documents. Use focused commits without co-author trailers; never commit disk images, build artifacts or profiles.

## Working with other agents

Use the [task ownership and validation guide](AGENT_TASKS.md) to divide work. One coordinator owns shared patch metadata, builds and native test runs. Start with the [continuation prompt](NEXT_AGENT_PROMPT.md); earlier checkpoints are preserved in [HANDOFF_HISTORY.md](HANDOFF_HISTORY.md) for investigation only.
