# Cove

Cove is a native Chromium browser. The active application is the native `Cove.app` in the build image reached through `CoveChromium/`.

```sh
npm start
```

This mounts `CoveChromium/CoveBuild.sparsebundle` at `/Volumes/CoveBuild` when needed, reuses the existing native build and opens its isolated `CoveDevelopment` profile. The current image is on `/Volumes/SanDisk 1TB/CoveChromium`; the project path links to it. Keep that SSD attached while Cove or the build is running. The prior internal image is retained as `CoveChromium/CoveBuild.local-backup.sparsebundle`. An explicit `--checkout` argument can select another managed checkout.

```sh
npm run doctor
npm test
npm run test:ui
```

`npm test` checks native build tooling and patch verification. `test:ui` runs the actual native Chromium renderer headlessly in a fresh temporary profile; it is a smoke test, not a claim of Arc UI parity.

For incremental native development:

```sh
npm run chromium:gen
npm run build -- --jobs 2
```

The existing `out/Cove` directory is reused. No Electron dependency, entrypoint or fallback is part of the active project. The previous implementation and unfinished visual work are preserved under [`legacy/electron/`](legacy/electron/README.md) as reference material.

The native patches add a centered dark command palette, URL/default-engine search, tab switching and compact vertical tabs. ⌘T opens the palette; Return opens a selected tab or submits a URL/search, and ⌘Return opens the query in a new tab. The sidebar also has live Spaces, global Favorites, folders and native address/navigation controls. Full Space session restoration and other Arc workflows remain unfinished; see the [parity notes](native/ARC_PARITY.md) and [validation record](native/VALIDATION.md). All product work belongs in the native Chromium patch series.

See [the current handoff](native/HANDOFF.md), [native controls and shortcuts](native/CONTROLS.md), [the local build setup](native/LOCAL_BUILD.md), [native development](native/README.md) and [architecture](ARCHITECTURE.md).

To resume native development in another agent session, run `python3 scripts/chromium/handoff.py` and read the [continuation prompt](native/NEXT_AGENT_PROMPT.md). The script reports current build/Git state without changing the checkout or browser data.
