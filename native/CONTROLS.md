# Native Cove controls

These controls use Chromium's real tab, split, navigation and session models. They do not use the retired Electron renderer.

The current native build extends through 0083. Renderer smoke, 67 focused tests, 36 tooling tests and 17 distinct browser cases passed after fixes. Space/session ownership has disk readback and exact clean-close coverage; full separate-process/crash and migration acceptance remain.

Both sidebar states were inspected in QA, but CUA's repeated app-changed guard blocks further input. Final native-menu/shortcut acceptance and the three appearance browser regressions remain pending. See [VALIDATION.md](VALIDATION.md). The full Arc function set is incomplete.

| macOS shortcut | Action |
| --- | --- |
| ⌘T | Open command bar |
| ⌘L | Edit the focused tab or split pane's address |
| ⌘D | Pin or unpin the current tab |
| ⌘S | Dismiss an open command bar; otherwise hide or reveal the sidebar |
| ⌃1–9 | Select Space 1–9 |
| ⌃⇧+ | Add a side-by-side Split View |
| ⌃⇧1 | Focus the first pane (left, or top when stacked) |
| ⌃⇧2 | Focus the second pane (right, or bottom when stacked) |
| ⌃⇧− | Separate the split, retaining both tabs |
| ⌘⌥↑ / ⌘⌥↓ | Previous / next tab in sidebar order |
| ⌘⇧C | Copy the focused page's URL |
| ⌘⇧T | Reopen the last closed tab |
| ⌘W | Close the focused pane or current tab |
| ⌘⇧S | Save Page As |

The full-width toolbar is hidden in vertical-sidebar mode. Create a split from the native Tab menu, the command bar or the shortcut. The upstream Split View toolbar button remains available when the toolbar is shown, respecting a saved choice to unpin it. In a split, its menu offers separate views, swap, side-by-side/stacked orientation and closing either pane. The native Tab menu also exposes split creation, pane focus, separation and pinning.

Patch 0080 removes the 36 DIP top strip in hidden-toolbar mode, changes the page corners to 8 DIP and darkens the violet frame surfaces. Patch 0081 defaults web pages to the system appearance while keeping Cove's chrome dark; saved explicit appearance choices take precedence. These changes compile and pass renderer smoke; actual UI and appearance-browser validation remain pending.

Type a command into ⌘T, or use `/` or `>` for actions mode. The native palette has 44 static actions plus Space-name results. Type more text to narrow the visible list; unavailable actions are omitted. Arrow keys choose a row and Return runs it. ⌘Return submits the typed text directly through URL/search classification instead of activating the selected command or tab match.

New native action groups:

- New Space, New Folder, Rename Space, next/previous Space and direct Space-name selection.
- Favorite Tab, Clear Today, Rename Current Tab (retained pins), Reset Tab, Replace Pin with Current Page and Reset Space.
- Add/Separate Split View, Split Side by Side, Split Top and Bottom, Swap Split Panes and Reset Split Sizes. Focus actions show left/right or top/bottom labels for the current orientation.
- Window/private-window, navigation/reload, find, downloads, history, preferences, extensions, developer tools, fullscreen, open-file, save/print and zoom actions.

Reset Tab navigates the current live pin to its saved home. Replace Pin with Current Page changes that saved home while retaining its label. Reset Space returns the current Space's live pins home; it does not open closed pins or navigate inactive Spaces.

The footer's + menu exposes Add/Remove Favorites, Pin this page, New folder, New Space and Archive Today. Unsupported blank-page Favorite/Pin actions are disabled. Favorites are shared between Spaces and use Chromium's cached favicons. Click a Favorite to focus its page or open it; right-click to remove it.

Space dots, Control+number and typing a Space name in Cmd+T switch live pages without closing them. Horizontal sidebar swipes and a 240 ms slide are implemented; physical trackpad acceptance is still pending because automated horizontal events contained zero movement. Right-click a dot to rename its Space. New Spaces open a blank canvas; Cmd+T opens navigation. Full Space membership/session restoration across restart remains unfinished.

Pin rows retain their native tab after it navigates elsewhere, and reopen the saved page after closing. Cmd+W on a retained pin uses normal beforeunload handling without Chrome's extra pinned-tab toast. Closing the last retained pin keeps a blank browser window. Uncovered native pins retain upstream confirmation behavior.

Patch 0079 adds nested folder rows and menus. Right-click a folder for New Subfolder, rename, Move Up/Down among siblings, Move Outside Folders, a destination path such as Work / Research, or Remove Folder (Keep Contents). Moving a folder carries its descendants; self and descendant destinations are rejected. Removal reparents its direct child folders and pins to its parent, retaining their saved data and pages. Click a folder row to expand/collapse; collapsed ancestors hide their descendants, and the choice is saved.

Right-click a pin to rename it, remove it or move it to a nested folder path. Move Outside Folders returns it to the Space's root. Moving content into a folder expands the destination path. The new folder and pin-menu behavior awaits build, focused tests and live acceptance.

Archive Today closes current-Space unpinned pages through Chromium's native history and unsaved-page handling, retaining pins and Favorites. Cmd+Shift+T reopens recently closed pages. The current native split model supports two panes. Split-pin flag synchronization, complete cross-window ownership and folder/Space dragging are still incomplete. The new pin-home actions need final live acceptance.

Arc's published [command-bar actions](https://start.arc.net/command-bar-actions) informed command names and separation behavior. This is the implemented Cove control set, not a claim that every Arc shortcut or feature is present.

The native sidebar address field shows the current host when idle and the full URL when focused. Return navigates the focused tab or split pane, Command+Return opens a new tab, and Escape cancels editing and focuses the page. Back, Forward, Reload and site information are adjacent native controls. URL/search classification uses Chromium and the configured search engine.
