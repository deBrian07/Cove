# Continue Cove native Chromium

Work in `/Users/brianchen/Documents/Cove`. Read `AGENTS.md`, `native/HANDOFF.md`, `native/VALIDATION.md`, `native/ARC_PARITY.md` and `native/SPACE_RESTORE_DESIGN.md` first. Run:

```sh
python3 scripts/chromium/handoff.py
```

That script is read-only. It prints Git state, patch count, live build processes if available, configuration identities and the latest build log. Do not infer a passing build from an existing app bundle.

The user wants native Cove to match Arc's functions and supplied screenshots, and requested a continuation handoff before the usage limit. They also authorized pushing the complete project history to `https://github.com/deBrian07/Cove.git`, branch `main`, without co-author trailers. Preserve existing history; do not reinitialize Git or replace README with a one-line stub. The requested remote was empty when checked, and GitHub authentication uses `deBrian07`.

## First: actual UI acceptance of the built batch

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

Use CUA exclusively for UI input. The continuation session had no CUA tools and performed no UI acceptance or QA launch. Obtain a session with CUA before these checks; the earlier attachment success is historical. After context compaction, call `await cua.rewriteDocumentation()`. Binding `await cua.getApp('dev.cove.browser')` worked in the earlier session; the old blanket cgWindowNotFound blocker was resolved there. Observe fresh AX IDs before acting. CUA `getApp` can launch a default window if the app has quit, so launch the isolated QA profile deliberately first.

The user has authorized closing all Cove and reopening the QA profile. Quit through the Cove menu if held Cmd+Q does not quit. Preserve every profile. Use exactly one production-bundle QA instance rather than renamed app bundles, which previously caused long attachment stalls:

```sh
open -na /Volumes/CoveBuild/checkout/chromium/src/out/Cove/Cove.app --args \
  --user-data-dir=/Volumes/CoveBuild/checkout/profiles/CoveUIValidation-Native81 \
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
