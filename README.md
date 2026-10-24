# Cove

Cove is a native Chromium browser. The active application is the compiled `Cove.app` in the build image copied into `CoveChromium/`.

```sh
npm start
```

This mounts `CoveChromium/CoveBuild.sparsebundle` at `/Volumes/CoveBuild` when needed, reuses the existing native build and opens its isolated `CoveDevelopment` profile. The external SSD is no longer required. An explicit `--checkout` argument can select another managed checkout.

```sh
npm run doctor
npm test
npm run test:ui
```

`npm test` checks native build tooling and patch verification. `test:ui` runs the actual native Chromium renderer headlessly in a fresh temporary profile; it is a smoke test, not a claim of Arc UI parity.

For incremental native development:

```sh
npm run build -- --jobs 4
```

The existing `out/Cove` directory is reused. No Electron dependency, entrypoint or fallback is part of the active project. The previous implementation and unfinished visual work are preserved under [`legacy/electron/`](legacy/electron/README.md) as reference material.

The native patches add a centered dark command palette, URL/default-engine search, tab switching and compact vertical tabs. ⌘T opens the palette; Return opens a selected tab or an unmatched search, and ⌘Return opens the query in a new tab. Arc-style Spaces, Favorites, folders and the full window layout still need native implementations. All product work belongs in the native Chromium patch series.

See [the local build setup](native/LOCAL_BUILD.md), [native development](native/README.md) and [architecture](ARCHITECTURE.md).
