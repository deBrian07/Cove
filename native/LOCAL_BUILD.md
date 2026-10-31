# Local Chromium workspace

Everything Chromium needs lives in this repository's ignored `.chromium/` directory. A fresh clone builds with `npm run setup`; no path outside the repository is used.

| Item | Path |
| --- | --- |
| Workspace | `.chromium/` |
| Managed checkout | `.chromium/checkout` |
| depot_tools | `.chromium/checkout/depot_tools` |
| Chromium source | `.chromium/checkout/chromium/src` |
| Native application | `.chromium/checkout/chromium/src/out/Cove/Cove.app` |
| Development profile | `.chromium/checkout/profiles/CoveDevelopment` |
| Download caches and temporary files | `.chromium/cache`, `.chromium/tmp` |

Chromium's macOS build requires APFS. If the repository is on a drive that is not APFS (for example an ExFAT external SSD), create an APFS sparse image at `CoveChromium/CoveBuild.sparsebundle`; the tooling mounts it at `.chromium/` so every path above stays the same. On the maintainer's machine that image path links to `/Volumes/SanDisk 1TB/CoveChromium/CoveBuild.sparsebundle`, and the original internal copy is kept as `CoveBuild.local-backup.sparsebundle`. Do not mount both copies at once or merge their profiles.

## Run and verify

```sh
npm start
npm run doctor
npm test
npm run test:ui
```

No source fetch, compilation or Electron installation is performed by `npm start`. The launcher verifies the recorded build and native application identity, then uses the isolated development profile. The smoke test uses a different temporary profile and does not modify normal browsing data.

Checkout selection order: an explicit `--checkout PATH`, then the disk image when `CoveChromium/CoveBuild.sparsebundle` exists, then `COVE_CHROMIUM_ROOT`, then `.chromium/checkout`. If `.chromium/` already holds other files when the image needs mounting, the launcher stops; it does not detach a volume or select another image automatically.

## Native changes

Keep native source changes represented in `native/patches/`. Generate a changed configuration when required, then incrementally rebuild:

```sh
npm run chromium:gen
npm run build -- --jobs 2
npm start
```

Reuse `out/Cove`; do not remove it. The runtime is Chromium `156.0.8078.48` at pinned revision `d0c02bfad08ec92a6ffcf989e53cd995e6381a4c`, bundle ID `dev.cove.browser`. The native patch series currently has 78 ordered patches. The current build and executed checks are recorded in VALIDATION.md. It adds live Spaces, global Favorites, folders, pin handling and sidebar navigation; per-Space session restoration and other Arc workflows remain incomplete. See [ARC_PARITY.md](ARC_PARITY.md) and [VALIDATION.md](VALIDATION.md).

The APFS image has a growable virtual capacity. Its backing drive must also have real free space. Default storage checks use the smaller of the image's free space and the backing drive's free space, so a large virtual capacity cannot hide a full host disk.

Quit native Cove and finish all build commands before detaching the image:

```sh
hdiutil detach .chromium
```

The active image is on the external SanDisk SSD. See [EXTERNAL_BUILD.md](EXTERNAL_BUILD.md) for its location and safe reattach procedure.
