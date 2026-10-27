# Arc reference and native parity

The supplied Arc screenshots are the target: a roughly 250px violet sidebar, traffic lights and navigation on one row, a filled compact address field, icon-only Favorites cards, folder/pin hierarchy, a quiet New Tab row, bottom Space indicators and a narrow rounded frame around the page. Split views have independent headers and a joined sidebar row. All implementation belongs to the native Chromium fork; Electron is reference only.

The native series through patch 0055 implements:

- Caption-row Back/Forward/Reload/site information and a 36px filled address field, preserving current-tab editing, search-engine classification, Escape and Command+Return behavior.
- Profile-global Favorites as real persisted URLs, with 48px-high icon-only cards that share available row width and local Chromium favicon-cache lookup. No default websites or dummy app tiles are inserted.
- A compact Space title/folder/pin library, native rename dialogs and saved folder expansion. Folder removal retains pins.
- A flat left-aligned New Tab row above tabs, with the native command palette callback retained.
- Bottom Archive Today, Space dots and a plus/options menu. Archive uses native close/history and beforeunload, retaining pins/Favorites and the window.
- Softer violet default surfaces plus a 6 DIP native frame and 12 DIP single-page corners, while preserving custom themes, high contrast, fullscreen, side panels and native split corner handling.
- Live Space switching, stable pin activation after navigation, first-press close for retained pins and a placeholder when the last retained pin closes.
- Native Cocoa footer menus on macOS. Repeated New Folder use, Favorite creation, pin close and command/address navigation were exercised in the running app.
- Cleanup guards that keep intentionally blank split canvases, plus safe accessibility event dispatch when a native menu action deletes its target view.

The latest live pass also exercised split creation, focus and separation, command-bar URL submission, and the retained-pin lifecycle. Patches 0054–0055 passed the final native empty-to-real tab, Archive Today and reopen checks. Other build and runtime observations are in [VALIDATION.md](VALIDATION.md). Cove remains an incomplete Arc replica; source changes and renderer smoke do not establish full interaction parity.

## Remaining gaps

1. Full per-Space session ownership after restart. Inactive pages rejoin Chromium's session service for shutdown, so restored tabs can be merged. URL snapshots are a compatibility fallback, not full native state restoration.
2. Complete pin-model unification, pinned-home/reset rules, nested folders and drag/reorder between folders and Spaces. Covered native pin tiles are hidden in the expanded sidebar; collapsed and uncovered pins retain native rendering. Split-pin removal currently preserves native split membership rather than fully synchronizing every flag.
3. Exact split-pane address/navigation headers, joined split sidebar rows, drag-to-split and more than two panes. Native creation/focus/separation commands exist, but reference layout parity is not established.
4. Arc's recent-tabs chooser, Space keybindings, configurable shortcuts, Peek, Little Arc and import.
5. Measured focus/motion latency, accessibility, reduced-motion and performance parity. Production signing, updater, complete icons/metadata and Chromium security maintenance remain.

The command bar targets approximately 760px width, a 64px query field and five 48px single-line result rows, with a dark surface, blue selection, thin border and restrained shadow. URL/search/tab-switch submission dismisses the native bubble. Remaining layout differences must be assessed from the rendered app rather than a mockup.
