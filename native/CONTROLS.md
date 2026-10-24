# Native Cove controls

These controls use Chromium's real tab, split, navigation and session models. They do not use the retired Electron renderer.

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

The Split View toolbar button is shown by default, while respecting a saved choice to unpin it. Click it to create a split. In a split, its menu offers separate views, swap, side-by-side/stacked orientation and closing either pane. The native Tab menu also exposes split creation, pane focus, separation and pinning.

Type a command into ⌘T, or type `/` to list browser commands: Pin Tab, Unpin Tab, Toggle Sidebar, Add Split View, Remove Split View, Focus Left Pane, Focus Right Pane, Duplicate Tab, Reopen Closed Tab and Copy Current URL. Arrow keys choose a row; Return runs it. Disabled commands explain why they are unavailable. ⌘Return searches the literal query even when it matches a command.

Native pins persist through Chromium's session model and support right-click pin/unpin and drag reordering. They are not yet Arc's separate Favorites/Spaces library or pinned-home reset/archive model. Chromium's pinned-tab close confirmation and native Ctrl+Tab behavior remain in effect. The current native split model supports two panes.

Arc's published [command-bar actions](https://start.arc.net/command-bar-actions) informed command names and separation behavior. This is the implemented Cove control set, not a claim that every Arc shortcut or feature is present.
