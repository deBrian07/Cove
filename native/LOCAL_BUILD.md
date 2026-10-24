# Copied Chromium workspace

The active build image is `CoveChromium/CoveBuild.sparsebundle` inside this repository. It is the user's copy of the completed native build, not a fresh checkout. The folder is ignored by Git because it contains build artifacts, caches and private browser profiles.

The native launcher mounts this exact image at `/Volumes/CoveBuild`. Keeping that mount path preserves the source paths recorded in the existing Ninja build files.

| Item | Path |
| --- | --- |
| Copied image | `CoveChromium/CoveBuild.sparsebundle` |
| Managed checkout | `/Volumes/CoveBuild/checkout` |
| Chromium source | `/Volumes/CoveBuild/checkout/chromium/src` |
| Native application | `/Volumes/CoveBuild/checkout/chromium/src/out/Cove/Cove.app` |
| Development profile | `/Volumes/CoveBuild/checkout/profiles/CoveDevelopment` |

## Run and verify

```sh
npm start
npm run doctor
npm test
npm run test:ui
```

No source fetch, compilation or Electron installation is performed by `npm start`. The launcher verifies the recorded build and native application identity, then uses the isolated development profile. The smoke test uses a different temporary profile and does not modify normal browsing data.

The copied image is preferred over an older `COVE_CHROMIUM_ROOT` environment value. An explicit `--checkout PATH` takes precedence for deliberate alternate-checkout work. If `/Volumes/CoveBuild` is occupied by another image, the default launcher stops; it does not detach that volume or select another image automatically.

## Native changes

Keep native source changes represented in `native/patches/`. Generate a changed configuration when required, then incrementally rebuild:

```sh
npm run chromium:gen
npm run build -- --jobs 4
npm start
```

Reuse `out/Cove`; do not remove it. The runtime is Chromium `156.0.8078.48`, bundle ID `dev.cove.browser`. The current sidebar is Chromium's native vertical tab strip with Cove defaults; Spaces, Favorites and the command palette have not yet been ported from the retired prototype.

The APFS image has a growable virtual capacity. Its backing drive must also have real free space. Default storage checks use the smaller of the image's free space and the backing drive's free space, so a large virtual capacity cannot hide a full host disk.

Quit native Cove and finish all build commands before detaching the image:

```sh
hdiutil detach /Volumes/CoveBuild
```

The original SSD image is no longer the default. Its creation and handling are recorded in [the historical external setup](EXTERNAL_BUILD.md).
