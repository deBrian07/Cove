# Native Cove controls

These controls use Chromium's real tab, split, navigation and session models. They do not use the retired Electron renderer.

The native build covers the 55-patch series. Live checks confirmed the final empty-to-real tab, Archive Today and reopen behavior; the full Arc control set remains incomplete.

| macOS shortcut | Action |
| --- | --- |
| ⌘T | Open command bar |
| ⌘L | Edit the focused tab or split pane's address |
| ⌘D | Pin or unpin the current tab |
| ⌘S | Collapse or expand the sidebar |
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

Type a command into ⌘T, or type `/` to list browser commands: Pin Tab, Unpin Tab, Toggle Sidebar, Add Split View, Remove Split View, Focus Left Pane, Focus Right Pane, Duplicate Tab, Reopen Closed Tab and Copy Current URL. Arrow keys choose a row; Return runs it. Disabled commands explain why they are unavailable. ⌘Return searches the literal query even when it matches a command.

The footer's + menu exposes Add/Remove Favorites, Pin this page, New folder, New Space and Archive Today. Unsupported blank-page Favorite/Pin actions are disabled. Favorites are shared between Spaces and use Chromium's cached favicons. Click a Favorite to focus its page or open it; right-click to remove it.

Space dots switch live pages without closing them. Right-click a dot to rename its Space. New Spaces open a blank canvas; Cmd+T opens navigation. Full Space membership/session restoration across restart remains unfinished.

Pin rows retain their native tab after it navigates elsewhere, and reopen the saved page after closing. Cmd+W on a retained pin uses normal beforeunload handling without Chrome's extra pinned-tab toast. Closing the last retained pin keeps a blank browser window. Uncovered native pins retain upstream confirmation behavior. Right-click a pin to rename it, move it into a folder or remove it. Right-click a folder to rename/remove it; removal keeps its pins. Click a folder row to expand/collapse, with the choice saved.

Archive Today closes current-Space unpinned pages through Chromium's native history and unsaved-page handling, retaining pins and Favorites. Cmd+Shift+T reopens recently closed pages. The current native split model supports two panes. Split-pin flag synchronization, pinned-home reset rules and folder/Space drag behavior are still incomplete.

Arc's published [command-bar actions](https://start.arc.net/command-bar-actions) informed command names and separation behavior. This is the implemented Cove control set, not a claim that every Arc shortcut or feature is present.

The native sidebar address field shows the current host when idle and the full URL when focused. Return navigates the focused tab or split pane, Command+Return opens a new tab, and Escape cancels editing and focuses the page. Back, Forward, Reload and site information are adjacent native controls. URL/search classification uses Chromium and the configured search engine.
