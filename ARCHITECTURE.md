# Cove architecture

Cove's active application is a native Chromium fork. The completed `Cove.app` uses Chromium `156.0.8078.48`, bundle ID `dev.cove.browser`, and the isolated `CoveDevelopment` profile.

The user copied the completed build image into `CoveChromium/`. Default commands mount that local image at `/Volumes/CoveBuild` and use its existing checkout and `out/Cove` directory. The external SSD is no longer required. See [the local build setup](native/LOCAL_BUILD.md).

## Retired prototype

The former Electron application is preserved under `legacy/electron/` as reference material. Its package and lockfile are dependency snapshots, not an active npm application. Root dependencies and launch/build/test commands do not use Electron. Its profile and saved data have not been deleted or automatically imported.

All further UI and workflow work belongs in Chromium's native UI and services through the patch series in `native/patches/`. Editing archived TypeScript or CSS does not change the native app.

## Native status

The current native patches enable vertical tabs by default, adjust sidebar dimensions and hover delays, add Cove development branding, and isolate the default native profile from Chromium and the prototype. The completed binary's identity and native rendering are verified from the copied workspace.

The native application does not yet include Arc-style Spaces, Favorites, folders, the command palette, page framing or custom icons. Native rendering validation does not establish Arc workflow or visual parity.

## Next native work

1. Implement Spaces, Favorites, pinned/temporary tab organization and folders against Chromium's tab and profile services.
2. Port the reference command palette into the native UI, including result selection, dismissal and keyboard-focus behavior.
3. Match the supplied Arc screenshot's sidebar hierarchy, page framing, compact controls, theme and motion. Validate the actual native app after incremental builds.
4. Add an explicit importer for the retired prototype's library, preserving the original and validating the destination profile.
5. Maintain upstream security updates, native tests, packaging and signing as part of the Chromium fork.

Keep source and artifacts out of Git, preserve user profiles, and reuse the existing build output. Do not reset a checkout or erase a disk as a substitute for an incremental build.
