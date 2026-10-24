# Cove

Cove aims to reproduce Arc's browser UI and workflows on native Chromium.

The runnable app in `src/` is an Electron prototype. The native migration lives in `native/`: a pinned Chromium revision, a C++ patch series and macOS arm64 build tooling. The native fork has not yet been compiled or run. `npm start` still launches the prototype.

See [the native build instructions](native/README.md) for migration status and commands, and [the architecture contract](ARCHITECTURE.md) for the target.

## Electron prototype

```sh
npm ci
npm start
```

```sh
npm run typecheck
npm test
npm run test:ui
```

The UI check uses an isolated temporary profile.

## Native Chromium

```sh
npm run chromium:verify-patches
npm run chromium:test
npm run chromium:doctor -- --checkout /path/to/CoveChromium
```

Patch verification downloads only the touched files at the pinned revision, checks their SHA-256 hashes and applies the patch in a disposable fixture. This does not compile Chromium. A native build needs a dedicated source/build directory and sufficient free disk space; it never falls back to Electron.
