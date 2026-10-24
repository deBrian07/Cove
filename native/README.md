# Native Cove

This directory starts the migration from the Electron prototype to a Chromium fork. It does not contain a compiled browser.

## What exists

- Chromium `156.0.8078.48`, pinned to `d0c02bfad08ec92a6ffcf989e53cd995e6381a4c` in `chromium.json`.
- A pinned `depot_tools` revision and local macOS arm64 development GN configuration.
- A native C++ patch that uses Chromium's Views vertical tab strip by default, with 260-pixel expanded width and 120-millisecond hover/edge delays. Existing saved preferences take precedence.
- A bounded verifier that checks the four upstream files against `upstream-files.json` and applies the series in a temporary fixture.
- Python build tooling and regression tests for the build safeguards.

The patch does not yet port Spaces, Arc-style Favorites/folders, the command palette, page framing, prototype data import or Cove branding. Native tab behavior comes from upstream Chromium. The generated application is still named `Chromium.app` at this stage.

## Verify without a full checkout

```sh
npm run chromium:test
npm run chromium:verify-patches
```

The verifier's source download is bounded to 64 MiB total and 16 MiB per file; the first patch touches 24,735 bytes of upstream source. It accepts `--source /path/to/pinned/src` for offline verification. The cache under `native/.cache/` is ignored by Git.

These checks establish patch applicability and build-tool behavior. They do not establish that Chromium compiles, that the native unit tests pass, or that the UI matches Arc.

## Build on macOS arm64

Use full Xcode with a compatible macOS SDK and Python 3.9 or newer. The checkout directory must be dedicated to Cove, outside this repository, and contain no spaces.

```sh
export COVE_CHROMIUM_ROOT=/path/to/CoveChromium
npm run chromium:doctor
npm run chromium:bootstrap
npm run chromium:sync
npm run chromium:patch
npm run chromium:gen
npm run chromium:build -- --jobs 8
npm run chromium:run
```

`bootstrap` fetches pinned browser sources and dependencies; `sync` runs the Chromium hooks that obtain build tools. `patch` applies Cove's series. `gen` prepares `out/Cove`; `build` compiles the Chromium `chrome` target. `run` uses a separate `CoveDevelopment` user-data directory and refuses an override that could open an existing Chrome or Arc profile.

The storage thresholds are Cove's conservative local guardrails, not measured upstream minimum requirements. Bootstrap requires 100 GiB free before any checkout or network mutation. The latest doctor check reported 41.58 GiB free on the current system volume, so the full bootstrap and native build cannot proceed there. No existing files are removed to make room.

The scripts refuse a mismatched revision, an unmanaged nonempty checkout, or an unsafe patch state rather than resetting a source tree. Keep source and build output out of this repository. Consult `python3 scripts/chromium/cove_chromium.py --help` for options and `scripts/chromium/README.md` for stage safeguards.

## Native validation still required

After compilation, build and run the native tests added by the patch:

```sh
export PATH="$COVE_CHROMIUM_ROOT/depot_tools:$PATH"
cd "$COVE_CHROMIUM_ROOT/chromium/src"
autoninja -C out/Cove unit_tests
out/Cove/unit_tests --gtest_filter='CoveSidebarDefaultsTest.*:VerticalTabStripStateControllerTest.*'
```

Run the native application with its separate profile. Check navigation, pinning, tab dragging, session restore, sidebar resize/collapse/hover, focus, fullscreen and reduced motion. Port the prototype's Spaces and command palette only after a baseline native build can be verified.

## Upstream references

- [Chromium release metadata](https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Mac&num=1), resolved for the initial pin on 2026-10-23.
- [Chromium macOS build instructions](https://github.com/chromium/chromium/blob/main/docs/mac_build_instructions.md).
- [Pinned native tab-strip sources](https://github.com/chromium/chromium/tree/d0c02bfad08ec92a6ffcf989e53cd995e6381a4c/chrome/browser/ui/tabs).
