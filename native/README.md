# Native Cove

This directory contains the active native Chromium patch series and build configuration. The completed native application is in the user-copied build image under `CoveChromium/`; see [the local workspace](LOCAL_BUILD.md). Electron is retired.

## What exists

- Chromium `156.0.8078.48`, pinned to `d0c02bfad08ec92a6ffcf989e53cd995e6381a4c` in `chromium.json`.
- A pinned `depot_tools` revision and local macOS arm64 development GN configuration.
- A native C++ patch that uses Chromium's Views vertical tab strip by default, with 260-pixel expanded width and 120-millisecond hover/edge delays. Existing saved preferences take precedence.
- Development branding for `Cove.app` with bundle ID `dev.cove.browser`, plus a separate native default profile directory.
- A bounded verifier that checks the patched upstream files against `upstream-files.json` and applies the series in a temporary fixture.
- Python build tooling and regression tests for the build safeguards.

The native palette opens with ⌘T and uses Chromium’s omnibox classifier to open URLs or default-engine searches. Return switches a selected tab or opens an unmatched query; ⌘Return opens the query regardless of tab matches. A centered Views bubble hosts the compact dark WebUI, and submission closes it. New profiles default to dark browser chrome; explicit saved theme preferences remain in effect.

The patches do not yet port Spaces, Arc-style Favorites/folders, page framing, prototype data import or custom icons. Native tab behavior comes from upstream Chromium. The completed application is named `Cove.app`; its initial icon remains the upstream Chromium icon.

## Verify without a full checkout

```sh
npm run chromium:test
npm run chromium:verify-patches
```

The verifier's source download is bounded to 64 MiB total and 16 MiB per file; the source-file checksum manifest covers every patched upstream file. It accepts `--source /path/to/pinned/src` for offline verification against unmodified upstream files. The cache under `native/.cache/` is ignored by Git.

These checks establish patch applicability and build-tool behavior. They do not establish that Chromium compiles, that the native unit tests pass, or that the UI matches Arc.

## Build on macOS arm64

Use full Xcode with a compatible macOS SDK and Python 3.9 or newer. The mounted checkout directory must be dedicated to Cove and contain no spaces. The default copied image is mounted outside the repository at `/Volumes/CoveBuild`, while its backing files remain ignored under `CoveChromium/`.

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

`bootstrap`, `sync`, `patch`, and `gen` prepare the checkout. They are not part of changing a feature. `build` runs an incremental compile of the existing `out/Cove` directory: Ninja rebuilds only the objects invalidated by the edit, then relinks the affected component. `args.gn` sets `is_component_build = true` and `symbol_level = 0` for that reason. A one-line change in a Cove UI source file is minutes, not another from-scratch compile. `run` launches that same app with a separate `CoveDevelopment` profile and refuses an override that could open an existing Chrome or Arc profile.

All new shell and interaction work targets the native application. The former Electron source is archived in `legacy/electron/` for reference only. `npm start` mounts the copied build image and launches the existing native `Cove.app`; it does not compile Chromium.

The hours-long compile happens when `out/Cove` does not exist yet, when `args.gn` or the patch series changes enough that GN must regenerate the build, or when the pinned Chromium revision changes. Do not delete `out/Cove` to pick up a feature change.

The storage thresholds are Cove's conservative local guardrails, not measured upstream minimum requirements. Bootstrap requires 100 GiB free before any checkout or network mutation. The internal volume initially failed this check. The user-authorized external SSD now has a dedicated APFS build image and checkout; see [the current local setup](LOCAL_BUILD.md) and [the historical external setup](EXTERNAL_BUILD.md). No existing files are removed to make room.

The scripts refuse a mismatched revision, an unmanaged nonempty checkout, or an unsafe patch state rather than resetting a source tree. Keep source and build output out of this repository. Consult `python3 scripts/chromium/cove_chromium.py --help` for options and `scripts/chromium/README.md` for stage safeguards.

## Native validation still required

After compilation, build and run the native tests added by the patch:

```sh
export PATH="$COVE_CHROMIUM_ROOT/depot_tools:$PATH"
cd "$COVE_CHROMIUM_ROOT/chromium/src"
autoninja -C out/Cove unit_tests
out/Cove/unit_tests --gtest_filter='CoveSidebarDefaultsTest.*:VerticalTabStripStateControllerTest.*'
```

Run the native application with its separate profile. Check navigation, pinning, tab dragging, session restore, sidebar resize/collapse/hover, focus, fullscreen and reduced motion. The baseline native build is verified. Implement Spaces and the remaining command-palette workflows in this native application, using the archive only as a behavior/design reference.

## Upstream references

- [Chromium release metadata](https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Mac&num=1), resolved for the initial pin on 2026-10-23.
- [Chromium macOS build instructions](https://github.com/chromium/chromium/blob/main/docs/mac_build_instructions.md).
- [Pinned native tab-strip sources](https://github.com/chromium/chromium/tree/d0c02bfad08ec92a6ffcf989e53cd995e6381a4c/chrome/browser/ui/tabs).
