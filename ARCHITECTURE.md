# Cove architecture

Cove's active application is a native Chromium fork. The completed `Cove.app` uses Chromium `156.0.8078.48`, bundle ID `dev.cove.browser`, and the isolated `CoveDevelopment` profile.

Chromium is fetched, patched and built inside the repository's ignored `.chromium/` directory (`npm run setup`). An optional APFS image in `CoveChromium/` is mounted at that same path, so commands never depend on a location outside the repository. See [the local build setup](native/LOCAL_BUILD.md).

## Retired prototype

The former Electron application is preserved under `legacy/electron/` as reference material. Its package and lockfile are dependency snapshots, not an active npm application. Root dependencies and launch/build/test commands do not use Electron. Its profile and saved data have not been deleted or automatically imported.

All further UI and workflow work belongs in Chromium's native UI and services through the patch series in `native/patches/`. Editing archived TypeScript or CSS does not change the native app.

## Native status

The current native patches enable vertical tabs by default, adjust sidebar dimensions and hover delays, add Cove development branding, and isolate the default native profile from Chromium and the prototype. The completed binary's identity and native rendering are verified from the copied workspace.

The native command palette reuses Chromium’s Tab Search WebUI, Mojo handler and Views bubble, with URL/search classification through the native omnibox service. It closes after navigation or tab switching. The native application does not yet include Arc-style Spaces, Favorites, folders, page framing or custom icons. Native rendering validation does not establish Arc workflow or visual parity.

## Next native work

1. Implement Spaces, Favorites, pinned/temporary tab organization and folders against Chromium's tab and profile services.
2. Extend the native command palette with history suggestions and current-tab URL editing.
3. Match the supplied Arc screenshot's sidebar hierarchy, page framing, compact controls, theme and motion. Validate the actual native app after incremental builds.
4. Add an explicit importer for the retired prototype's library, preserving the original and validating the destination profile.
5. Maintain upstream security updates, native tests, packaging and signing as part of the Chromium fork.

Keep source and artifacts out of Git, preserve user profiles, and reuse the existing build output. Do not reset a checkout or erase a disk as a substitute for an incremental build.
