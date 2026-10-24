# Native Chromium build driver

This Python 3.9+ command-line driver builds the native Cove patch series in a dedicated Chromium checkout. It never falls back to Electron. It reads pinned source/depot_tools revisions and file paths from `native/chromium.json`.

Default commands use the completed build image copied into `CoveChromium/`, mounting it at `/Volumes/CoveBuild` when necessary. See [the local setup](../../native/LOCAL_BUILD.md). An explicit `--checkout` selects another managed checkout; the environment variable is used only when no local image exists.

For a fresh source checkout, choose a directory outside the application repository, on a volume with enough storage. The directory path cannot contain whitespace. The copied local image takes precedence over a previous `COVE_CHROMIUM_ROOT` setting.

```sh
python3 scripts/chromium/cove_chromium.py doctor --checkout /Volumes/Build/CoveChromium
python3 scripts/chromium/cove_chromium.py bootstrap --checkout /Volumes/Build/CoveChromium
python3 scripts/chromium/cove_chromium.py sync --checkout /Volumes/Build/CoveChromium
python3 scripts/chromium/cove_chromium.py patch --checkout /Volumes/Build/CoveChromium --check
python3 scripts/chromium/cove_chromium.py patch --checkout /Volumes/Build/CoveChromium
python3 scripts/chromium/cove_chromium.py gen --checkout /Volumes/Build/CoveChromium
python3 scripts/chromium/cove_chromium.py build --checkout /Volumes/Build/CoveChromium --jobs 8
python3 scripts/chromium/cove_chromium.py run --checkout /Volumes/Build/CoveChromium -- --disable-background-networking about:blank
```

`bootstrap` creates a pinned depot_tools checkout, initializes its Python/CIPD wrappers with `ensure_bootstrap` without moving the Git pin, and creates a `.gclient` configuration targeting macOS, then syncs source/dependencies directly to the pinned Chromium SHA without running hooks. It uses `gclient sync --no-history --nohooks --revision src@SHA` so it does not first download dependencies for an unrelated upstream main revision. `sync` checks the pinned revisions and clean source tree before syncing and running Chromium hooks. The actual checkout lives under `CHECKOUT/chromium/src`.

The host must be an Apple Silicon Mac with Git, full Xcode and the macOS SDK selected. Bootstrap and doctor verify APFS; an ExFAT SSD can host an APFS disk image as described in [the external build setup](../../native/EXTERNAL_BUILD.md). Checkouts under `/Volumes` require their volume to be mounted, so a disconnected disk cannot silently redirect a checkout to the internal drive. Chromium's pinned depot_tools handles its own Python tooling. No global packages or shell startup files are changed. The [upstream macOS build instructions](https://github.com/chromium/chromium/blob/main/docs/mac_build_instructions.md) explain the toolchain requirements.

Cove applies local free-space guardrails before work: at least the manifest's `minimum_free_gib` (currently 100 GiB) for bootstrap, 50 GiB for sync/build, 20 GiB for GN generation, and 2 GiB for patch validation or launch. These are conservative local gates, not an upstream guarantee about final disk usage. `doctor --stage build`, for example, checks the build gate without starting a compilation. Storage failures exit with code 2 before creating a checkout or starting that operation.

Patch validation resolves the series against pinned HEAD in an isolated temporary Git index and object directory. A single composite patch is then checked against the working tree and applied in one invocation. Dependent patches work; invalid series and conflicting local files are rejected before any working-tree patch is applied. Validation does not change the real source index or object database. Reapplying a fully applied series is harmless. The driver never resets or deletes a source checkout, and sync refuses tracked or untracked changes.

The driver records completed hooks, generated configuration and successful builds. Changing GN arguments, application name or patches invalidates the recorded build configuration. GN generation requires the patches to be applied and hooks to have completed; build requires the current generated configuration. Existing `args.gn` changes are preserved and must be reconciled explicitly.

Native development launches use `CHECKOUT/profiles/CoveDevelopment`. Overriding `--user-data-dir` is refused so these commands cannot accidentally open an existing Arc, Chrome or prototype profile. The manifest selects `app_name: Cove`, so the expected native binary is `chromium/src/out/Cove/Cove.app`; a successful launch requires a recorded build for the current patch/configuration digest.

Run the offline safety tests without downloading Chromium:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/chromium -p 'test_*.py'
```

The tests cover storage failure before side effects, immutable pins, checkout ownership/path boundaries, dependent patch series and idempotence, conflicting work preservation, hook/configuration gating and isolated launch argument parsing. They do not establish that the native C++ patch compiles or that the resulting browser UI works.
