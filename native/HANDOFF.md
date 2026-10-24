# Cove handoff — 2026-10-24

## Start here

Cove's active application is the native Chromium fork. Electron is retired under `legacy/electron/`; it is reference material, not a launch target. Read the root `AGENTS.md`, this file, `CONTROLS.md` and `ARC_PARITY.md` before continuing.

The user wants Arc's actual workflows as well as its appearance. Their latest reference includes a purple vertical sidebar, favorite tiles, folders, a joined split-tab row, two independently navigable panes and pane-specific controls. They specifically asked to fix keybindings, splits and pins. They requested wrapping up before their usage limit, with an honest account of unfinished work. Make commits without co-author trailers.

## Exact workspace

- Repository: `/Users/brianchen/Documents/Cove`
- User-copied image: `/Users/brianchen/Documents/Cove/CoveChromium/CoveBuild.sparsebundle`
- Image mount: `/Volumes/CoveBuild`
- Managed checkout: `/Volumes/CoveBuild/checkout`
- Chromium source: `/Volumes/CoveBuild/checkout/chromium/src`
- Output: `/Volumes/CoveBuild/checkout/chromium/src/out/Cove`
- App: `out/Cove/Cove.app`, executable `Contents/MacOS/Cove`
- Runtime: Chromium `156.0.8078.48`; source `d0c02bfad08ec92a6ffcf989e53cd995e6381a4c`
- Bundle ID: `dev.cove.browser`
- Normal development profile: `/Volumes/CoveBuild/checkout/profiles/CoveDevelopment`

The external SSD is not required for this copied workspace. Do not reformat it, delete its original image, replace an occupied mount point, reset the native checkout or delete `out/Cove`. The build image and profiles are ignored by Git. Disk checks account for the backing drive, not just the image's virtual capacity. Incremental builds retain a 20 GiB reserve when a compiled native output exists.

## Run/build/check commands

```sh
npm start
npm run doctor
npm test
npm run test:ui
npm run chromium:gen
npm run build -- --jobs 4
```

Default commands mount the copied local image when necessary. `npm start` launches the existing binary; it does not compile. New patches require `gen` before `build`. Reuse the cached output. A shared Mojo interface change recompiles several minutes of native UI dependencies; a leaf UI change is much smaller.

The patch series and upstream checksums are in `native/patches/series` and `native/upstream-files.json`. Patches 0009–0012 are deltas over the earlier applied series. Do not regenerate these with an unrestricted `git diff HEAD` against already-patched files: that duplicates previous patches. Save pre-edit contents, generate the new delta, and verify the entire ordered series.

`verify_patches.py --source` expects ORIGINAL pinned source files, not the modified checkout. This session kept an original-source fixture at `/tmp/cove-original-source`; this is temporary and may disappear. The verifier can also download its bounded set of pinned public files normally.

## Completed earlier and committed

- `279b3f2`: retired Electron, made the copied native build the default, preserved the archive and separate profiles, added local image/build safety checks.
- `d67a64f`: native centered command bar, URL/default-engine search, explicit dismissal, compact one-line results, dark purple chrome and sidebar spacing.
- That pass compiled and its native renderer smoke test passed. `npm test` passed 29 tooling plus 3 patch-verifier tests.
- Actual native UI observations from that pass: Cmd+T, URL submission, default-engine search, command-bar dismissal, cached reopening and Escape. See `VALIDATION.md` for limits.

## Current controls pass (0009–0012)

Implemented in source:

- Show Chromium's native Split View button by default; preserve an explicit saved unpin choice.
- Map Cmd+D to native pin/unpin and Cmd+S to sidebar collapse/expand.
- Move Save Page to Cmd+Shift+S, retain bookmark access through the native menu.
- Map Cmd+Shift+C to Copy Current URL, keeping Cmd+Option+C for Inspect.
- Map Cmd+Option+Up/Down to previous/next sidebar tab.
- Add Control+Shift+Plus to create a split, Control+Shift+1/2 to focus its panes, and Control+Shift+Minus to separate it while keeping both tabs/history.
- Expose the new controls in the native Tab menu.
- Add real command-bar actions for explicit Pin and Unpin, sidebar visibility, split creation/removal, pane focus, duplicate, reopen and copy URL.
- Disable unavailable actions with an explanation; keep Cmd/Ctrl+Return searching literal command words.
- Use native command allowlisting and current model-state checks, avoiding arbitrary command IDs from the renderer.
- Handle Cove-only split command IDs in the browser command controller before Chromium's declarative action adapter, avoiding recursive command dispatch.

New private IDs are in `chrome/app/cove_command_ids.h` (35070–35072). They are deliberately separate from the large upstream command-ID header. Audit for collisions when updating Chromium.

Added native browser regressions cover create/focus/separate preserving tabs/URLs and pin/unpin retention. Added Mac menu shortcut coverage and split-button preference coverage. Added WebUI action, modified-Return, disabled-action and explicit pin/unpin regressions. Added tests are not evidence of execution; see final validation status below.

## What remains unfinished

### First priority: runtime verification of this controls pass

Walk through every shortcut in `CONTROLS.md` in the final compiled binary, including after restarting the app. Check actual pin persistence, split creation with a new page and with an existing tab, independent navigation, pane focus, separator dragging, swapping, orientation, closing one pane, separation and session restoration. Verify command-bar mouse submission as well as keyboard actions. Verify these from page content, not only from an already-focused toolbar.

The full native test binaries have not been built/run for these changes. Useful targets/filters, once built:

- `browser_tests`: `BrowserCommandControllerBrowserTest.Cove*` and `TabSearchTest.*Page*` (check the current platform's MAYBE_Page/disabled status).
- `unit_tests`: `MainMenuBuilderTest.CoveControlsHaveDiscoverableShortcuts`.
- `interactive_ui_tests`: `*CoveDefaultVisibleAndExplicitUnpin*`.
- WebUI typecheck target: `chrome/test/data/webui/tab_search:build_ts`.

The default split-button preference changes an upstream default. Other toolbar-customization suites may need explicit baseline preferences, rather than changing Cove's intended default to satisfy an old assumption.

### Arc behavior/model gaps

- Favorites, Spaces and folders are not implemented natively.
- Pins currently use Chromium's pinned-tab/session model. Arc's pinned-home URL, reset/replacement, close-without-removing-pin and archive behavior are not implemented. Chromium's pinned-tab close confirmation remains.
- Native splits currently support two panes. Arc's larger splits and exact sidebar drag-to-split behavior are not established.
- Arc's five-recent-tabs Ctrl+Tab chooser is missing. Do not present Chromium's existing tab cycle/MRU behavior as an exact equivalent.
- Cmd+L currently uses Chromium's native address bar; centered current-tab URL editing is not ported.
- Spaces shortcuts, Little Arc, Peek, archive/Clear Today, custom shortcut settings, pin renaming and full Arc split/favorite semantics remain.

### Visual/layout gaps

- The full-width Chromium toolbar remains above the page. Arc's compact sidebar address/navigation host and page starting at the top edge are not implemented.
- Existing layout owner: `chrome/browser/ui/views/frame/layout/browser_view_tabbed_layout_impl.cc`. `CalculateTopContainerLayout()` consumes toolbar height; vertical-sidebar layout is also managed there.
- Do not blindly reparent/narrow the entire ToolbarView: it can be backed by WebUI and has minimum-width/security/menu assumptions. Build a compact native sidebar location/navigation host, then change vertical-mode layout while preserving horizontal mode, fullscreen and side panels.
- Favorite tiles, folder hierarchy, bottom space dots, exact pane headers/borders, flat command results and detailed typography/spacing still differ from the reference.
- No measured animation latency, frame time, reduced-motion, accessibility or memory/performance parity claim is justified yet.

### Product maintenance

Native branding still includes upstream Chromium icon/descriptions in places. Production signing/notarization, update delivery, upstream security maintenance and an explicit data importer remain. Keep Arc, Electron and native profiles separate.

## UI automation lessons

Use CUA for interactive app control. Its macOS `typeText`/paste sometimes chose the main omnibox while a popup was open; individual `pressKey` characters worked for command-bar checks. Popup destruction can leave a stale window handle (`cgWindowNotFound`) or cause a large AX snapshot timeout even when the browser is healthy. Reconnect and verify before diagnosing a product crash.

Test-only `CoveUIValidation-*` profiles used `--use-mock-keychain`; normal launch does not. Never enable that flag for the user's normal profile to avoid a Keychain prompt. Do not accept permissions or disable encryption as a UI fix. The normal development profile previously showed a Keychain/relaunch notice after a canceled OS prompt.

A real earlier crash was action-dispatch recursion: calling `ExecuteCommand(IDC_NEW_TAB)` from its own action callback reinvoked the same action. The committed code calls the native helper directly instead. Maintain that separation when wiring future controls.

## Final validation status for this controls pass

Updated at wrap-up below; source implementation and patch applicability must be distinguished from compiled/runtime-verified behavior.

At the wrap-up checkpoint, ordered patch verification passes and the 32 Python tooling/verifier tests pass. The current native `chrome` build is still compiling; it has not completed final validation for patches 0009–0012. Latest pin/action availability fixes require one final `npm run chromium:gen` followed by `npm run build -- --jobs 4` after the in-flight compile finishes. `built_config` remains unset while compilation is in progress, and the launcher intentionally refuses a stale binary. Do not bypass this safeguard.

New control tests have been added but have not been compiled/executed as test binaries. The current controls pass has not had its end-to-end GUI walkthrough. These are the first continuation tasks, ahead of adding more features.
