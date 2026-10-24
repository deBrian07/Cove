# Cove architecture

The target is a native Chromium browser with Arc-style UI and workflows. Electron is the current prototype runtime, not the final architecture. Cove must own the browser UI and tab/window model inside the Chromium application rather than ship an Electron shell around embedded pages.

The existing TypeScript implementation remains a runnable interaction reference during migration. A successful Electron build does not establish native Chromium migration progress.

## Migration sequence

1. Pin an upstream Chromium revision, choose a checkout/build volume and produce an unmodified macOS arm64 build with an isolated test profile. Keep upstream sources and build output out of this small application repository.
2. Maintain Cove changes as a reproducible patch series against that revision. Add branding and a native browser-window/sidebar implementation using Chromium browser UI infrastructure.
3. Implement spaces, favorites, pinned tabs, folders and temporary tabs against Chromium's tab and profile services. Port the command palette and its dismissal/focus behavior into the native UI.
4. Add an explicit importer for the prototype's library. Preserve the original library and verify tab order, URLs, folders, spaces and profiles in a separate destination profile.
5. Validate navigation, history, downloads, extensions, permissions, keyboard focus and session restore in the native application. Establish upstream security-update, packaging and signing workflows before replacing the prototype as the main app.

Acceptance requires a runnable Cove application built through Chromium's GN/Ninja toolchain with no Electron runtime dependency. An architecture document or an unbuilt patch does not satisfy that requirement.

## Migration status

The initial native source pin, GN arguments, build driver and sidebar-default patch are now in [`native/`](native/README.md). The patch has been applied to a disposable fixture of the exact pinned upstream files, with SHA-256 checks. Tooling tests exercise disk/revision safeguards. No full native compilation or native UI validation has been completed; `npm start` still runs the Electron prototype.

The first patch reuses Chromium's native Views vertical tabs. It does not yet port Spaces, Favorites, folders, the command palette, page framing or branding. The original internal-disk storage blocker is resolved by the external SSD setup described in [`native/EXTERNAL_BUILD.md`](native/EXTERNAL_BUILD.md). The source checkout is in progress on its dedicated APFS build image.

## Build planning

The development machine is macOS arm64 with Xcode selected. The initial internal-disk check reported only `41.58 GiB` free. The user subsequently authorized the attached `SanDisk 1TB` SSD for the build.

The SSD remains ExFAT. A growable 700 GiB APFS image inside `/Volumes/SanDisk 1TB/CoveChromium` is mounted at `/Volumes/CoveBuild`, with the dedicated checkout at `/Volumes/CoveBuild/checkout`. The mounted image passed the initial storage check with `699.63 GiB` free. Existing SSD files and the drive's partitioning were preserved. A full native compilation has not yet completed.

Upstream Chromium is the selected base, initially pinned to `156.0.8078.48`. Helium is a useful native Chromium reference, but inheriting its patches and product decisions is a separate choice.

References:

- [Chromium macOS build instructions](https://github.com/chromium/chromium/blob/main/docs/mac_build_instructions.md)
- [Helium source and upstream credits](https://github.com/imputnet/helium)
- [Helium macOS development workflow](https://github.com/imputnet/helium-macos/blob/main/docs/building.md)
