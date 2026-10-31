# Cove project rules

- Cove's active application is the native Chromium fork. Chromium lives in the ignored `.chromium/` directory of this repository (`npm run setup` fetches, patches and builds it; `npm start` launches it). Never depend on a path outside the repository; an optional APFS image in `CoveChromium/` is mounted at `.chromium/`.
- Read `native/HANDOFF.md` for the latest build, validation and unfinished-work status before extending the native app.
- Implement browser UI and behavior in Chromium's native UI/services through the versioned patch series in `native/patches/`. Electron renderer edits do not change the native application.
- `legacy/electron/` is a retired reference archive. Do not add features there, restore Electron dependencies or add an Electron fallback to active commands.
- Reuse the existing native checkout and `out/Cove` for incremental builds. Do not delete build output or reset the source tree to pick up a feature change.
- Keep native, Arc and archived prototype profiles separate. Never remove or replace the user's browser data as part of migration.
- Keep the local disk image, compiled artifacts and browser profiles out of Git. Never reformat a disk or replace an occupied mount point.
- Make focused commits without co-author trailers.
