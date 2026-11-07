<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/01_Logos/Cove-Horizontal-OnDark.png">
    <img alt="Cove" src="brand/01_Logos/Cove-Horizontal-OnLight.png" width="320">
  </picture>
</p>

<p align="center"><em>A calmer way to browse.</em></p>

# Cove

Cove is a native Chromium browser. This repository holds everything needed to build it: the pinned Chromium revision (`native/chromium.json`), the GN configuration (`native/args.gn`) and Cove's ordered patch series (`native/patches/`). Chromium itself is fetched into the ignored `.chromium/` directory inside this repository, so no other location is involved.

## Build

You need an Apple Silicon Mac, full Xcode (selected with `xcode-select`), Git, Python 3.9 or newer, and about 150 GB free on the APFS volume that holds this repository. The clone path cannot contain spaces.

```sh
git clone <this repository> Cove
cd Cove
npm run setup -- --jobs 4
npm start
```

`npm run setup` runs each stage that has not finished yet:

1. fetch the pinned depot_tools and Chromium source into `.chromium/checkout`;
2. run Chromium's hooks;
3. apply `native/patches/series`;
4. generate `out/Cove`;
5. build `Cove.app`.

Rerunning it resumes where it stopped. Downloads, caches and temporary files stay in `.chromium/`. The first build takes several hours. Choose `--jobs` to fit your memory (roughly 4 GB per job).

`npm start` opens the built app with an isolated development profile in `.chromium/checkout/profiles/CoveDevelopment`.

```sh
npm run doctor
npm test
npm run test:ui
```

`npm test` checks native build tooling and patch verification. `test:ui` runs the actual native Chromium renderer headlessly in a fresh temporary profile; it is a smoke test, not a claim of Arc UI parity.

For incremental native development:

```sh
npm run chromium:gen
npm run quick -- --jobs 6        # compile only the sources you changed; catches errors in minutes
npm run build -- --jobs 6        # build the app only
npm run build:tests -- --jobs 6  # also build the browser-test binary, when you run tests
```

Builds reuse a local compile cache in `.chromium/checkout/cache/siso`. Compiles whose exact inputs were seen before are restored instead of recompiled, for example after reverting an edit or re-applying patches.

Pick `--jobs` from memory: 6 works on an 18 GB Mac. Most edits rebuild in minutes. Changing `args.gn` or a widely included header recompiles much of Chromium. The build is also much slower on an ExFAT or USB disk image than on internal or APFS-formatted storage.

The existing `out/Cove` directory is reused. If the repository sits on a non-APFS drive, an APFS disk image at `CoveChromium/CoveBuild.sparsebundle` is mounted at `.chromium/` automatically; see [the local build setup](native/LOCAL_BUILD.md). No Electron dependency, entrypoint or fallback is part of the active project. The previous implementation and unfinished visual work are preserved under [`legacy/electron/`](legacy/electron/README.md) as reference material.

The native patches add a centered dark command palette, URL/default-engine search, tab switching and compact vertical tabs. ⌘T opens the palette; Return opens a selected tab or submits a URL/search, and ⌘Return opens the query in a new tab. The sidebar also has live Spaces, global Favorites, folders and native address/navigation controls. Native Space ownership, parked-page journals, clean-close restoration and one-window fresh-process restoration have browser regression coverage. Broader multi-window/crash recovery and other Arc workflows remain unfinished; see the [parity notes](native/ARC_PARITY.md) and [validation record](native/VALIDATION.md). All product work belongs in the native Chromium patch series.

Logos, app icons, colors and usage rules are in [`brand/`](brand/README.md).

See [native controls and shortcuts](native/CONTROLS.md), [the local build setup](native/LOCAL_BUILD.md), [native development](native/README.md) and [architecture](ARCHITECTURE.md).

To resume native development in another agent session, run `python3 scripts/chromium/handoff.py` and read the [continuation prompt](native/NEXT_AGENT_PROMPT.md). The script reports current build/Git state without changing the checkout or browser data.

For concurrent agent work, use the [task ownership and validation guide](native/AGENT_TASKS.md). Local checkouts, build artifacts and evidence logs remain outside Git.
