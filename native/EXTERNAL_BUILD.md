# Active external SSD build

The user selected this existing CoveChromium directory again on 2026-10-25 after the internal drive fell below the native build reserve. The project's ignored `CoveChromium/CoveBuild.sparsebundle` is now a symbolic link to this external image, so `npm start` and build commands keep using the same project path. The previous internal image is retained as `CoveBuild.local-backup.sparsebundle`; its profile data has not been merged into the external image.

The native Chromium checkout and build live in a dedicated folder on `SanDisk 1TB`. The SSD remains ExFAT. An APFS sparse bundle inside that folder provides the filesystem Chromium needs without reformatting the SSD or moving its existing files.

| Item | Path |
| --- | --- |
| Dedicated SSD folder | `/Volumes/SanDisk 1TB/CoveChromium` |
| Growable APFS image | `/Volumes/SanDisk 1TB/CoveChromium/CoveBuild.sparsebundle` |
| Mounted APFS volume | `/Volumes/CoveBuild` |
| Build driver root | `/Volumes/CoveBuild/checkout` |
| Chromium source | `/Volumes/CoveBuild/checkout/chromium/src` |
| Build output | `/Volumes/CoveBuild/checkout/chromium/src/out/Cove` |
| Logs | `/Volumes/CoveBuild/logs` |
| Initial source retry log | `/Volumes/CoveBuild/logs/source-mirror.log` |
| Temporary files | `/Volumes/CoveBuild/tmp` |
| CIPD cache | `/Volumes/CoveBuild/cache/cipd` |
| vpython cache | `/Volumes/CoveBuild/cache/vpython` |
| Native development profile | `/Volumes/CoveBuild/checkout/profiles/CoveDevelopment` |

The image has a 700 GiB virtual capacity. It grows as files are written; creating it did not immediately allocate 700 GiB on the SSD. Its backing files remain inside `CoveChromium`, even though macOS exposes its mounted filesystem at `/Volumes/CoveBuild`. The ignored project path points to the SSD image with a symlink.

## Current setup

The SSD is still ExFAT. Its existing growable APFS image has 700 GiB virtual capacity, and the native checkout stays at /Volumes/CoveBuild/checkout. At selection, the image had 655.23 GiB free and the SSD had 814.59 GiB free. These are observed values, not reservations.

The external source matched the first two Cove patches exactly. The remaining patches were applied in order without resetting the checkout, deleting output or downloading a second engine. See VALIDATION.md for actual compiled/runtime status; an active build alone is not success.

The checkout is already bootstrapped. Routine UI changes need generation and an incremental build; sync/bootstrap are not part of that loop. The setup sequence below applies to a new engine checkout.

Keep the SSD attached during compilation and native browser use. Do not mount the retained internal image simultaneously: it is a copy with the same APFS identity and uses the same mount point.

## Reattach after reconnecting the SSD

Run this only when `/Volumes/CoveBuild` is not already mounted:

```sh
hdiutil attach -nobrowse -mountpoint /Volumes/CoveBuild \
  '/Volumes/SanDisk 1TB/CoveChromium/CoveBuild.sparsebundle'
```

Confirm that the mount is available before starting a build:

```sh
df -h /Volumes/CoveBuild
```

The mount point contains no spaces, as required by the Chromium checkout workflow. Do not rename the mounted volume or move the backing image during a build.

## Use the existing checkout

From the Cove application repository, set these variables in the shell used for the build:

```sh
export COVE_CHROMIUM_ROOT=/Volumes/CoveBuild/checkout
export TMPDIR=/Volumes/CoveBuild/tmp
export CIPD_CACHE_DIR=/Volumes/CoveBuild/cache/cipd
export VPYTHON_VIRTUALENV_ROOT=/Volumes/CoveBuild/cache/vpython
npm run chromium:doctor
```

Inspect the bootstrap log without starting a second checkout:

```sh
tail -n 40 /Volumes/CoveBuild/logs/build.log
```

After bootstrap finishes successfully, continue with the pinned native build sequence:

```sh
npm run chromium:sync
npm run chromium:patch
npm run chromium:gen
npm run chromium:build -- --jobs 2
npm run chromium:run
```

The last command launches the native build with its separate `CoveDevelopment` profile. It does not use an existing Chrome, Arc or prototype profile. The active runtime is Chromium `156.0.8078.48` at pinned revision `d0c02bfad08ec92a6ffcf989e53cd995e6381a4c`; the ordered Cove patch series currently has 78 patches. See [VALIDATION.md](VALIDATION.md) for the exact build digest and executed checks. The expected application is:

```text
/Volumes/CoveBuild/checkout/chromium/src/out/Cove/Cove.app
```

The development branding patch names the application `Cove.app`. Its default Finder-launched profile is `Cove Native`, while the build driver always uses the isolated SSD profile listed above. See [native build instructions](README.md) for the current migration limits and required native tests.

## Detach safely

Wait for build/download commands to finish and quit the native browser. Close terminals whose working directory is under `/Volumes/CoveBuild`, or change their directory back to the application repository. Then detach the image:

```sh
hdiutil detach /Volumes/CoveBuild
```

If macOS reports that the volume is busy, stop the process using it and retry. Do not force detach during a checkout or build. After the image detaches, eject `SanDisk 1TB` through Finder before unplugging the SSD. Reattaching the same sparse bundle restores the existing checkout, build output and development profile.
