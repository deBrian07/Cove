# Original external SSD build setup

This is the historical engine-build location. The active workspace is now the local copy in `CoveChromium/`; see [LOCAL_BUILD.md](LOCAL_BUILD.md). Default commands no longer select the external SSD image.

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

The image has a 700 GiB virtual capacity. It grows as files are written; creating it did not immediately allocate 700 GiB on the SSD. Its backing files remain inside `CoveChromium`, even though macOS exposes its mounted filesystem at `/Volumes/CoveBuild`.

## Setup verification

On 2026-10-23, the mounted image passed the native driver's storage, Xcode and SDK checks with 699.63 GiB free. The initial bootstrap was started under `caffeinate`, with output at `/Volumes/CoveBuild/logs/bootstrap.log`. At that point, the native browser had not yet been built or run. Passing the setup checks does not establish a successful Chromium compilation.

The first source fetch from googlesource stalled before receiving objects. The same pinned SHA was then fetched through the public Chromium GitHub mirror, with progress in `source-mirror.log`; the checkout keeps the original upstream origin.

The source/dependency checkout, setup hooks and GN generation have since completed. As of 2026-10-24, the first native `Cove.app` build is compiling with four local jobs. The current compilation log is `/Volumes/CoveBuild/logs/build.log`; a started compilation is not a successful native build or UI validation.

Keep the SSD connected while checkout, dependency downloads, compilation or the native browser are running.

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
npm run chromium:build -- --jobs 4
npm run chromium:run
```

The last command launches the native build with its separate `CoveDevelopment` profile. It does not use an existing Chrome, Arc or prototype profile. The expected application, once the build succeeds, is:

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
