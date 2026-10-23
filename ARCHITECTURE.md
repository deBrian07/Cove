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

## Build planning

The current development machine is macOS arm64 with Xcode selected. On 2026-10-23, `df -h .` reported `50Gi` available on the repository's volume. Choose a build location with sufficient headroom before a large source sync or compilation; neither has been started for this migration.

Upstream Chromium is the proposed base. Helium is a useful native Chromium reference, but inheriting its patches and product decisions is a separate choice.

References:

- [Chromium macOS build instructions](https://github.com/chromium/chromium/blob/main/docs/mac_build_instructions.md)
- [Helium source and upstream credits](https://github.com/imputnet/helium)
- [Helium macOS development workflow](https://github.com/imputnet/helium-macos/blob/main/docs/building.md)
