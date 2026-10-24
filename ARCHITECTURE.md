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

The first patch reuses Chromium's native Views vertical tabs. It does not yet port Spaces, Favorites, folders, the command palette, page framing or branding. The build driver refuses to begin a full checkout on the current volume because it is below the configured 100 GiB bootstrap guardrail.

## Build planning

The current development machine is macOS arm64 with Xcode selected. On 2026-10-23, the native doctor most recently reported `41.58 GiB` free on the repository's volume. Choose a build location with sufficient headroom before a large source sync or compilation; a full source checkout and native compilation have not been started. Only bounded downloads of touched upstream files have been performed.

Upstream Chromium is the selected base, initially pinned to `156.0.8078.48`. Helium is a useful native Chromium reference, but inheriting its patches and product decisions is a separate choice.

References:

- [Chromium macOS build instructions](https://github.com/chromium/chromium/blob/main/docs/mac_build_instructions.md)
- [Helium source and upstream credits](https://github.com/imputnet/helium)
- [Helium macOS development workflow](https://github.com/imputnet/helium-macos/blob/main/docs/building.md)
