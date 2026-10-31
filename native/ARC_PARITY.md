# Arc function parity

Cove targets Arc's macOS workflows in the native Chromium application. Feature coverage takes priority over further cosmetic polish. This is the working acceptance list, not a claim that all of Arc is implemented. An implemented command must perform its native operation; a matching label or screenshot does not count.

The latest reviewed product series is 0106. Handoff evidence reports a full 75-case browser run, tooling and renderer smoke at 0105, then 18 focused drag/Favorites cases and isolated real OS pin/Favorite drags at 0106. Features added since 0095 include hover locks, drag-edge autoscroll, per-Space themes/icons/deletion/export, Control-Tab MRU switching, Move to Space, the mini player and floating drag rows. The 75 model/animation tests last passed on 0089; those implementations are unchanged. These reported checks predate the repository-local checkout relocation. Its interrupted rebuild left no accepted build receipt; the active 0107 continuation is rebuilding before claiming current runtime acceptance.

Patch 0107 addresses a code-audited data-loss risk in Move to Space: a navigated pin must retain its saved home, title and unknown fields rather than be recreated from its current page. New normal/collision/rejection regressions are pending native compilation. See [HANDOFF.md](HANDOFF.md) and [VALIDATION.md](VALIDATION.md) for current evidence and logs. This remains an incomplete Arc implementation.

## Spaces and organization

| Function | Cove status | Remaining acceptance or implementation |
| --- | --- | --- |
| Create, rename and delete Spaces | Native footer/menu; 0099 adds confirmation, neighbor selection and normal close handling for deleted Space pages | Broader beforeunload/multi-window acceptance and Space ordering remain |
| Switch Spaces through footer | Live native switching preserves pages | Repeat after new features; preserve drafts, history, groups and splits |
| Swipe between Spaces with a slide | Native gesture state and 240 ms layer transition implemented | Physical trackpad acceptance remains. Automation delivered dx=0/dy=0, so its horizontal scroll is not evidence |
| Control+1–9 Space selection | Added in 0076 | Verify native shortcuts, missing slots and use while the palette is open |
| Type a Space name in Cmd+T | Stable Space IDs added in 0076 | Verify switching to both populated and empty Spaces |
| Next/previous Space actions | Added in 0076 | Verify boundaries and slide direction |
| Independent Space themes and icons | 0098 stores sidebar/accent/highlight colors separately; 0099 persists emoji/symbol footer icons | Broader light/dark/high-contrast and restart acceptance remain |
| Profiles assigned to Spaces | Missing | Separate cookies, storage, credentials and profile-specific Favorites |
| Tab moves and Space ordering | 0102 adds tab-menu Move to Space, including split partners and source blank canvas | 0107 saved-pin record preservation is in progress; group ownership and Space ordering remain |
| Restore Spaces after restart | 0082–0083 add ownership, parked journals and pending canvases; 0093 passes real PRE_/fresh-process restoration for one window/two Spaces, exact history, navigated pin home/ID and saved organization | Multi-window/group/split fresh-process and actual process-kill recovery, saved-group sync and migration acceptance remain |
| Air Traffic Control | Missing | URL rules, default destination and external-link routing |
| Share/import Spaces | 0100 exports a Space into a folder in another Space, retaining live pages and renaming colliding IDs | File/share import and hosted shared views remain |

The Space baseline comes from Arc's [Space guide](https://resources.arc.net/hc/en-us/articles/19228064149143-Spaces-Distinct-Browsing-Areas), including Control+number and name-based selection. Cove does not use Arc accounts or services.

## Tabs, pins, folders and archive

| Function | Cove status | Remaining acceptance or implementation |
| --- | --- | --- |
| Pin/unpin and keep a saved home | Native, previously live-tested | Unify persisted and live ownership across windows/restart |
| Reset a pin to its original URL | Added in 0076 | Verify the same native tab returns home and normal navigation protections apply |
| Replace a pin's home with its current page | Added in 0076 | Verify home persists and a later reset uses the replacement |
| Reset all pins in a Space | Added in 0076 | Verify only the current Space's live pins navigate |
| Rename pins | Native context menu; 0076 adds command | Ordinary unpinned custom tab labels remain missing |
| Favorites | Saved URLs/grid, reordering and URL/live-tab drops; 0096 source hover locks and 0106 floating live-drag row | Isolated real mouse drags passed at 0106; broader drag/trackpad and shared live Favorite ownership remain |
| Create, rename and collapse folders | Native nested rows, New Subfolder and visible New Folder action; 0095 adds aligned blue folder rows | Automated nesting/collapse/hover tests pass; physical UI acceptance remains |
| Move and reorder whole folders | Mixed saved order, native dragging and common menu ordering; 0094 scrolling/reveal, 0096 hover locks and 0097 edge autoscroll | Broader hardware drag and cross-Space folder moves remain |
| Remove folders while retaining contents | 0079 reparents direct child folders and pins to the removed folder's parent | Verify saved children, pins and open pages survive removal |
| Closed saved-pin site icons | 0095 reads local cached icons for rendered rows; live icons take priority, stale callbacks are rejected | Missing cache data retains a globe; exact Arc folder artwork/font tuning remain |
| Move pins into or outside folders | Native menus and saved-row dragging; loose live-tab drops pin the same page into a folder without reloading, including only-tab case | Physical drag, grouped/split/multi-tab and cross-Space live moves remain |
| Clear Today and reopen closed tabs | Native; 0076 exposes Clear Today in palette | Timed automatic archiving and Arc-style archive/library UI remain missing |
| Recently used tab switcher | 0101 adds Control-Tab MRU overlay, reverse traversal and modifier-release activation | Broader multi-window/Space keyboard acceptance remains |
| Sidebar undo/restore | Missing | Recover sidebar organization changes without replacing browser profiles |

## Command bar and keyboard

| Function | Cove status | Remaining acceptance or implementation |
| --- | --- | --- |
| Native Cmd+T input and URL/search submission | Implemented; current desktop checks accept text with sidebar shown/hidden, Cmd+S/Escape dismiss safely; submission previously exercised | Measured cold/warm latency and broader activation/multi-window acceptance remain |
| Open tabs and recently closed results | Native stable handles/session IDs | Parked tabs in inactive Spaces are not yet searched or activated directly |
| Actions mode | Native `/` or `>` mode | 0076 expands browser and library actions; verify enabled-state and actual effects |
| Common browser actions | 0076 adds window/private-window, navigation, find, downloads, history, preferences, extensions, developer tools, fullscreen, save/print, zoom and open-file entries | Native Chromium operations are reused; Arc-specific panel layouts are separate work |
| Cmd+L, Cmd+S, Cmd+D, copy URL and split shortcuts | Native routing exists; current desktop checks pass Cmd+S palette dismissal and persistent sidebar collapse | Broader shortcut combinations, split contexts and editable bindings remain |
| Editable keybindings | Missing | User-defined bindings, conflict reporting, reset and persistence |
| Full address suggestions | Partial | Current native bar classifies destinations; history/bookmark/online suggestion ranking is incomplete |

The action baseline is Arc's [command-bar reference](https://start.arc.net/command-bar-actions). That reference also contains historical features; retired Arc Notes should not be presented as a current parity requirement without checking the target Arc release.

## Split views and link workflows

| Function | Cove status | Remaining acceptance or implementation |
| --- | --- | --- |
| Two live split panes, resize, focus and separate | Native; prior live checks passed | Repeat with pins, folders and Space commands |
| Joined sidebar split rows | Missing | Show membership and active pane together |
| Pane-specific address/navigation headers | Missing | Match the supplied reference and route each control to its pane |
| Drag or Option-click into a split | Missing | Drag targeting, replacing panes and moving existing tabs |
| Split layouts, pane swap and size reset | Added in 0078 | Live-check side-by-side/top-bottom, swap, equal sizing and Control+Shift+1/2 focus |
| More than two split panes | Missing | Extend native model and persistence |
| Peek previews | Missing | Shift-click and pinned-link rules, overlay navigation, promote/dismiss and focus return |
| Little Arc | Missing | Lightweight external-link window, routing, promotion and global shortcut |
| Picture-in-picture and media | 0105 adds automatic video mini player on tab/Space/app departure and return-to-tab routing; six focused cases and full suite reported passing | Broader site/media/desktop acceptance and mini audio surfaces remain |

## Native settings

Cove → Settings and Cmd+, open Cove's native settings window with General, Profiles, Appearance, Links, Shortcuts and Advanced sections. It uses grouped dark controls inspired by the supplied settings screenshots, with Cove's own layout and labels. Startup restoration, quitting confirmation, download prompts, color scheme and sidebar hover use existing preferences; other entries open real Chromium management pages. Startup URLs survive toggling restoration. Repeated opening and closing, preference persistence, real command routing and view cleanup pass browser tests.

The user explicitly requested no separate Cove account. Existing profiles and a Google account page link are available. That link uses the selected profile's browsing session; it does not implement a Cove identity layer, Chrome Sync or cross-device sidebar sync. Shortcuts display actual current native bindings; customization remains unfinished. Peek/Little Arc settings are not represented by dummy switches.

## Remaining product functions

These need their own native work and acceptance; they are not covered by the current sidebar patches:

- Per-Space appearance editing exists in 0098–0099; advanced themes and broader rendered appearance acceptance remain. Patch 0081 separates system-following web appearance from browser chrome.
- Boosts, site-specific styling and element hiding.
- Capture tools, saved captures and Easel workflows where supported by the target Arc version.
- Live folders and calendar/service integrations.
- Cross-device sidebar sync and conflict recovery. Future work must honor the user’s preference to reuse Google identity rather than introducing a separate Cove account; current Google account links do not provide sidebar sync.
- Arc Max-style optional remote features, with explicit data controls and an independent service rather than Arc backend access.
- Arc import, first-run migration and sidebar backup/restore. Native settings organization is now implemented in 0087; broader settings coverage remains.
- Complete profile, password/autofill, extension and download surfaces. Chromium supplies the engines; engine availability alone is not UI parity.
- Signed standalone packages, updates and Chromium security maintenance.

## Retained visual reference and earlier native baseline

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

Those frame dimensions describe the earlier baseline. Patch 0080 removes the 36 DIP top strip and uses 8 DIP page corners in hidden-toolbar mode, with darker violet surfaces. Its build and renderer smoke passed; rendered frame and caption-control acceptance remain pending.

The latest live pass also exercised split creation, focus and separation, command-bar URL submission, and the retained-pin lifecycle. Patches 0054–0055 passed the final native empty-to-real tab, Archive Today and reopen checks. Other build and runtime observations are in [VALIDATION.md](VALIDATION.md). Cove remains an incomplete Arc replica; source changes and renderer smoke do not establish full interaction parity.

The command bar targets approximately 760px width, a 64px query field and five 48px single-line result rows, with a dark surface, blue selection, thin border and restrained shadow. URL/search/tab-switch submission dismisses the native bubble. Remaining layout differences must be assessed from the rendered app rather than a mockup.

## Implementation order

1. Complete the current Space, pin and command functions and validate their effects.
2. Manually validate the corrected drag/folder paths, finish saved-row/Favorites hover lifetime and drag-edge autoscroll, then complete multi-window/crash restoration and grouped/split/cross-Space moves.
3. Split rows, pane headers, split-by-drag and additional layouts.
4. Peek, Little Arc and editable shortcuts; broaden MRU keyboard acceptance.
5. Appearance/Boosts, capture/library/media and integration features.
6. Optional sync using existing identity, import/recovery and release packaging.

Reliability checks follow each functional batch. Avoid spending the whole session polishing one popup while major Arc workflows are absent.
