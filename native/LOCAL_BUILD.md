# Copied Chromium workspace

Current selection (2026-10-25): the user reconnected SanDisk and selected its existing CoveChromium directory. The project image path is a symbolic link to `/Volumes/SanDisk 1TB/CoveChromium/CoveBuild.sparsebundle`. The original internal copy is preserved as `CoveBuild.local-backup.sparsebundle`. See [EXTERNAL_BUILD.md](EXTERNAL_BUILD.md). Do not mount both copies at once or merge their profiles.

The project path `CoveChromium/CoveBuild.sparsebundle` links to the user's existing native build image on SanDisk. It reuses the completed checkout and output. The folder is ignored by Git because it contains build artifacts, caches and private browser profiles.

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
npm run build -- --jobs 2
npm start
```

Reuse `out/Cove`; do not remove it. The runtime is Chromium `156.0.8078.48` at pinned revision `d0c02bfad08ec92a6ffcf989e53cd995e6381a4c`, bundle ID `dev.cove.browser`. The native patch series currently has 55 ordered patches. It adds live Spaces, global Favorites, folders, pin handling and sidebar navigation; per-Space session restoration and other Arc workflows remain incomplete. See [ARC_PARITY.md](ARC_PARITY.md) and [VALIDATION.md](VALIDATION.md).

The APFS image has a growable virtual capacity. Its backing drive must also have real free space. Default storage checks use the smaller of the image's free space and the backing drive's free space, so a large virtual capacity cannot hide a full host disk.

Quit native Cove and finish all build commands before detaching the image:

```sh
hdiutil detach /Volumes/CoveBuild
```

The active image is on the external SanDisk SSD. See [EXTERNAL_BUILD.md](EXTERNAL_BUILD.md) for its location and safe reattach procedure.
