# Arc function parity

## Current — Nov 6: 0122 gate passed; desktop follow-up remains

Cove targets Arc's macOS workflows through the native Chromium application. Appearance and functional behavior both matter. Exact Arc visual parity, physical trackpad smoothness and frame-time parity have not been validated.

Patches 0119–0121 provide editable Little Cove address/navigation, scoped Cmd+L/Cmd+O/Cmd+Shift+O, searchable specific-Space promotion, a real external-link routing preference and outside-click command-bar dismissal. Patch 0122 corrects test activation. All 108 browser executions passed in one run with retries disabled, in 870 seconds (107 JSON SUCCESS keys with PRE_ folded). All 122 patches verified; 38 tooling tests, official generation/build receipt and isolated renderer smoke passed. Current/generated/built identity matched `562f3b871baecf2266ea2d9e1eade5a83fd276ca614f1f2281f7344c352bb971`.

The SanDisk disconnected before the final desktop investigation finished; logs and checkout are currently inaccessible. CUA confirmed query entry/Escape/draft retention but inconsistently targeted the floating palette. Do not count its click attempt as independent physical acceptance. Native mouse tests passed inside retention and outside page-button delivery. Current-cursor versus native-event coordinates are a code-audited robustness candidate requiring a deterministic regression, not an accepted 0123 change. See [HANDOFF.md](HANDOFF.md) for exact evidence and resume instructions.

## Archived — Nov 7

Cove is archived; see the README. Patches 0132–0137 and the codec setting compile and apply cleanly but were never built into an app or tested. Treat their rows below as written, not accepted.

## Nov 6: 0123–0131 committed; VM testing

0123 judges command-bar outside clicks by the press location. 0124 searches pages parked in other Spaces. 0125 continues interrupted Space slides. 0126 fixes a launch crash after any unclean exit, where Chromium's restore prompt anchored to the hidden toolbar before the window was shown. 0127 archives idle unpinned tabs. 0128 keeps typed text as the first command-bar result; Space and command suggestions follow it and match word prefixes. 0129 hides the Little Cove profile chip when only one profile exists. 0130 drives the mini player from audio-focus and session events instead of a 250 ms poll. 0131 releases the command bar's application-wide event monitor while it is hidden.

On the terminal-mac VM, CommandBarPutsTypedTextFirst, OutsideClickUsesPressLocationNotCursor and InterruptedSpaceSlideContinuesFromScreen passed. Little Cove external-link opening and Cmd+O promotion were checked by hand. The remaining runs need test data and a longer timeout in the slower VM; see HANDOFF.md. H.264/AAC playback was missing because proprietary codecs were not enabled; args.gn now enables them.

## Historical accepted baseline — 0118

All 104 browser executions passed in one run with retries disabled, in 840 seconds. JSON records 103 SUCCESS keys because the PRE_ phase is folded. This includes six OS mouse-drag cases, seven media cases, 17 Little Cove cases and session/restart/settings/sidebar/Favorites coverage. All 118 patches verified; 38 tooling tests, official generation/build receipt and isolated renderer smoke passed. The configuration identity was `d55ae794329c5ebfb59a49d3c0ad5bf633a188ff558daac4a507cc8856fb155d`. Evidence is under `.chromium/tmp/cove118/`; this is historical evidence superseded by the completed 0122 gate above.

That baseline includes saved-pin preservation during Move to Space, retained pin icons, frame-paced drag-edge scrolling, corrected empty pin/Favorite drop targets, compact media controls and native temporary external-link windows. Patch 0118 preserves Chromium's required `CustomCornersBackground`, fixes the temporary-window header crash and enables scoped Cmd+O promotion from page focus. Its header image was inspected at `.chromium/tmp/cove118/header.png`. These checks do not establish production readiness or exact Arc parity.

## Spaces and organization

| Function | Cove status | Remaining acceptance or implementation |
| --- | --- | --- |
| Create, rename and delete Spaces | Native footer/menu; 0099 adds confirmation, neighbor selection and normal close handling for deleted Space pages | Broader beforeunload/multi-window acceptance and Space ordering remain |
| Switch Spaces through footer | Live native switching preserves pages | Repeat after new features; preserve drafts, history, groups and splits |
| Swipe between Spaces with a slide | Native gesture state and 240 ms layer transition; 0125 continues an interrupted slide from its on-screen position and lets a reversal pick up the departing copy | Pixel-continuity and physical trackpad/frame-time acceptance remain |
| Control+1–9 Space selection | Added in 0076 | Verify native shortcuts, missing slots and use while the palette is open |
| Type a Space name in Cmd+T | Stable Space IDs added in 0076 | Verify switching to both populated and empty Spaces |
| Next/previous Space actions | Added in 0076 | Verify boundaries and slide direction |
| Independent Space themes and icons | 0098 stores sidebar/accent/highlight colors separately; 0099 persists emoji/symbol footer icons | Broader light/dark/high-contrast and restart acceptance remain |
| Profiles assigned to Spaces | Missing | Separate cookies, storage, credentials and profile-specific Favorites |
| Tab moves and Space ordering | 0102 adds tab-menu Move to Space, including split partners and source blank canvas; 0107 preserves saved home, title, ID and unknown fields, including collision/rejection coverage accepted in 0118 | Broader group ownership and Space ordering remain |
| Restore Spaces after restart | 0082–0083 add ownership, parked journals and pending canvases; 0093 passes real PRE_/fresh-process restoration for one window/two Spaces, exact history, navigated pin home/ID and saved organization | Multi-window/group/split fresh-process and actual process-kill recovery, saved-group sync and migration acceptance remain |
| Air Traffic Control | 0113/0120 route external web links to Little Cove or a same-profile main window through a real preference | URL rules, automatic destination-Space selection and broader Air Traffic Control UI remain |
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
| Favorites | Saved URLs/grid, reordering and URL/live-tab drops; source hover locks, floating live-drag row and corrected first-Favorite drop targets are included in accepted 0118 coverage | Broader hardware drag/trackpad and shared live Favorite ownership remain |
| Create, rename and collapse folders | Native nested rows, New Subfolder and visible New Folder action; 0095 adds aligned blue folder rows | Automated nesting/collapse/hover tests pass; physical UI acceptance remains |
| Move and reorder whole folders | Mixed saved order, native dragging and common menu ordering; scrolling/reveal, source hover locks and 0111 frame-paced edge autoscroll are implemented | Broader hardware drag and cross-Space folder moves remain |
| Remove folders while retaining contents | 0079 reparents direct child folders and pins to the removed folder's parent | Verify saved children, pins and open pages survive removal |
| Closed saved-pin site icons | Local cached icons load for rendered rows, live icons take priority and stale callbacks are rejected; 0110 retains cached icons during row rebuilds | Missing cache data retains a globe; exact Arc folder artwork/font tuning remain |
| Move pins into or outside folders | Native menus and saved-row dragging; loose live-tab drops pin the same page into a folder without reloading, including only-tab case | Physical drag, grouped/split/multi-tab and cross-Space live moves remain |
| Clear Today and reopen closed tabs | Native; 0127 adds Arc-style automatic archiving of idle unpinned tabs into recently closed history (12 h default; 24 h, 7 days, 30 days or Never in Settings) | Archive/library browsing UI remains missing; parked Spaces archive when next shown |
| Recently used tab switcher | 0101 adds Control-Tab MRU overlay, reverse traversal and modifier-release activation | Broader multi-window/Space keyboard acceptance remains |
| Sidebar undo/restore | Missing | Recover sidebar organization changes without replacing browser profiles |

## Command bar and keyboard

| Function | Cove status | Remaining acceptance or implementation |
| --- | --- | --- |
| Native Cmd+T input and URL/search submission | Native palette with shown/hidden-sidebar input and safe Cmd+S/Escape dismissal; 0121 mouse regression passes three outside-click/reopen cycles in the full 0122 run while preserving click delivery, draft, URL, tab count and cached widget | Measured cold/warm latency, multi-window activation, native context-menu edges and the desktop click discrepancy remain |
| Open tabs and recently closed results | Native stable handles/session IDs; 0124 lists pages parked in other Spaces as "In <Space>" and opening one switches to its Space | Ranking by recency remains basic |
| Actions mode | Native `/` or `>` mode | 0076 expands browser and library actions; verify enabled-state and actual effects |
| Common browser actions | 0076 adds window/private-window, navigation, find, downloads, history, preferences, extensions, developer tools, fullscreen, save/print, zoom and open-file entries | Native Chromium operations are reused; Arc-specific panel layouts are separate work |
| Cmd+L, Cmd+S, Cmd+D, copy URL and split shortcuts | Native routing exists; 0119 tests included in the full 0122 run pass Little Cove Cmd+L address focus, Escape/Enter/history and scoped Cmd+O/Cmd+Shift+O promotion/chooser behavior | Broader shortcut combinations, split contexts and editable bindings remain |
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
| Peek previews | 0134: Shift+click, or a link that leaves a pinned tab's site, opens a floating card over the page; Esc, Cmd+W or a click outside closes it; Open as Tab (Cmd+Return) moves the same page into the Space | Same-tab cross-site links in pins, Favorites-specific rules, Open in Split and inline find remain |
| Little Arc | 0113–0120 implement native temporary external-link windows, a compact header, searchable specific-Space promotion preserving the exact page/history/draft, editable address, scoped Cmd+L/Cmd+O/Cmd+Shift+O and a real external-routing preference; native input checks pass in the full 0122 run | Global launch shortcut, broader desktop/site acceptance and exact visual matching remain |
| Picture-in-picture and media | Automatic video mini player on tab/Space/app departure and return-to-tab routing; 0114 adds compact sidebar audio/media controls. Seven media cases passed in the full 0122 run | Broader site/media/desktop acceptance and visual comparison remain |

## Native settings

Cove → Settings and Cmd+, open Cove's native settings window with General, Profiles, Appearance, Links, Shortcuts and Advanced sections. It uses grouped dark controls inspired by the supplied settings screenshots, with Cove's own layout and labels. Startup restoration, quitting confirmation, download prompts, color scheme and sidebar hover use existing preferences; other entries open real Chromium management pages. Startup URLs survive toggling restoration. Patch 0120 adds the real `cove.external_links_in_temporary_windows` profile preference, default true, and a Links toggle selecting temporary windows or a same-profile main window for external URLs. Its regression passed preference persistence, reopening settings and both routing choices in the full 0122 run. Repeated settings opening/closing, existing preference persistence, command routing and view cleanup passed the accepted baseline tests.

The user explicitly requested no separate Cove account. Existing profiles and a Google account page link are available. That link uses the selected profile's browsing session; it does not implement a Cove identity layer, Chrome Sync or cross-device sidebar sync. Shortcuts display actual current native bindings; customization remains unfinished. The Links toggle controls implemented Little Cove routing. Peek (0134) has no setting yet.

## First run

| Function | Cove status | Remaining acceptance or implementation |
| --- | --- | --- |
| Welcome for new profiles | 0136: full-window welcome modeled on Arc's (gradient intro, then split screens with a live sidebar preview): import from another browser, pick a sidebar color, make Cove the default browser, the basics | Shown only on a brand-new profile; there is no Cove account by design |
| New tab address | 0135: a new tab shows the empty "Search or Enter URL" field instead of chrome://newtab | — |

## Efficiency and media

| Function | Cove status | Remaining acceptance or implementation |
| --- | --- | --- |
| Idle work | 0130 replaces the mini player's 250 ms poll with audio-focus and session events; 0131 releases the command bar's application-wide event monitor while it is hidden | Measured idle wakeups on low-end Macs |
| Memory from unused Spaces | 0132 discards pages in Spaces left unused for two hours (Settings → General → Tabs); they keep history and reload when shown, and playing, captured or unsaved pages are kept | Per-Space exceptions |
| Common video and audio | args.gn enables H.264/AAC (proprietary codecs) | Release packaging and licensing notes |
| Product naming | 0133 renames user-facing Chromium strings to Cove; translations fall back to English for changed strings | Localized Cove strings |

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

The earlier live pass exercised split creation, focus and separation, command-bar URL submission and the retained-pin lifecycle. Patches 0054–0055 passed the final native empty-to-real tab, Archive Today and reopen checks. Other build and runtime observations are in [VALIDATION.md](VALIDATION.md). Cove remains an incomplete Arc replica; source changes and renderer smoke do not establish full interaction parity.

The command bar targets approximately 760px width, a 64px query field and five 48px single-line result rows, with a dark surface, blue selection, thin border and restrained shadow. URL/search/tab-switch submission dismisses the native bubble. Remaining layout differences must be assessed from the rendered app rather than a mockup.

## Implementation order

1. Reconnect the existing SSD, inspect the interrupted desktop activation trace and resolve click-coordinate robustness with deterministic coverage before claiming physical acceptance. The 0122 native gate passed.
2. Validate corrected drag/folder paths on physical input and address rapid Space-transition interruption/reversal with pixel and bounded-state checks. Hover locks and frame-paced edge scrolling already exist.
3. Complete joined split rows, pane headers, split-by-drag and broader grouped/split/cross-Space and multi-window/crash restoration.
4. Implement Peek, a global Little Cove launch shortcut and editable shortcuts; broaden MRU keyboard acceptance. Preserve safe specific-Space transfer and ordinary popup behavior.
5. Compare rendered appearance and media workflows with the supplied Arc references, then extend appearance/Boosts, capture/library and integrations.
6. Add profile assignment to Spaces, optional sync using existing identity, import/recovery and release packaging.

Reliability checks follow each functional batch. Native fixture coverage and renderer smoke do not replace desktop interaction, physical trackpad or frame-time validation.
