# Durable Space restore: implementation constraints

Current status: patches 0082–0083 implement the snapshot/metadata/restore integration below. Seventeen distinct native browser cases passed after fixes, including real disk readback, exact clean-close history, pending blank panes and canceled-unload reparking. The audit text below records the original constraints. Full process-restart/crash and saved-group sync acceptance remain outstanding; see VALIDATION for precise evidence.

Source audit on 2026-10-29. This is a design for unfinished work, not an implemented restore feature.

Live Space switches preserve native pages by parking inactive Tab/Group/Split collections. Shutdown currently rejoins those pages for Chromium's unload and session pipeline. That protects pages but does not preserve complete Space ownership after restart.

Store stable Space IDs, pin IDs, per-Space ordering, selection and Cove-owned empty-canvas markers on tabs. Persist the active Space separately per window. IDs such as `personal` and `work` are valid; do not require UUIDs. Unknown or malformed IDs must fall back without dropping pages.

## Session hooks

- `browser_live_tab_context.cc`: `GetExtraDataForTab` and `GetExtraDataForWindow` support recently closed restoration. These alone do not cover full session rebuilds.
- `sessions/session_service.cc`: `BuildCommandsForTab` must serialize Cove metadata too. Incremental changes need `AddTabExtraData` and `AddWindowExtraData`.
- `browser_tabrestore.cc`: restore tab metadata before insertion, preventing initial observers from assigning the wrong Space or pin home. Restore active-window metadata before normal assignment, including `BrowserLiveTabContext::Create` for recently closed windows.
- Finalize Space partitioning only after the full window restore sequence: tab creation, split visuals, group metadata, focused group, session notification, startup replacement and finished tab creation. Group restoration can delete WebContents. Use weak window references for deferred work rather than repartitioning during each insertion.

## Parked pages and journal resets

`SessionServiceBase::BuildCommandsForBrowser` enumerates attached TabStripModel pages. `SessionService::ScheduleResetCommands` clears and rebuilds the journal, so parked pages can disappear from persisted history even if incremental metadata was written correctly.

Extend the Cove window bridge with read-only enumeration of parked tabs and their group/split metadata. Serialize attached and parked pages together with stable window-wide journal positions. Do not temporarily reinsert parked pages to serialize them: insertion observers can reenter Space assignment and cleanup. Active-only history synchronization can also collide with parked positions.

Ordinary Space detachment must remain distinct from closing a tab. `SessionServiceBrowserHelper` journals a close only for `WillDeleteTab`; preserve that distinction and the existing beforeunload cancellation/reparking behavior.

## Acceptance before calling restore durable

1. Restart with two Spaces, navigated pins with multiple history entries, a collapsed group and a stacked split with a nondefault divider ratio. Preserve ownership, selection, structure and history.
2. Restore two windows with different active Spaces.
3. Force `ResetFromCurrentBrowsers`, flush/read the session and restore while pages are parked. Check every page remains present.
4. Exercise crash restore after navigation in a parked Space.
5. Cancel beforeunload during window close and retain every live page and Space assignment.
6. Restore legacy, unknown, orphaned and malformed metadata without data loss.

A clean-close metadata-only change would leave journal-reset and crash-restore gaps. Keep those gaps explicit instead of shipping a partial migration that can silently lose parked pages.

## Integration map from the continuation audit

The 81-patch build remains unchanged by this audit. The functions below were read in the mounted pinned checkout; these are implementation requirements, not completed features or executed restore tests.

### One snapshot for attached and parked pages

`CoveSidebarLibraryView::SpaceTabs` owns a variant of detached loose tabs and detached collections, plus stable handles and the saved selection. Add a window-scoped, read-only snapshot to `CoveSpaceCloseHandler` so session services do not depend on Views. Enumerate the currently attached model and every inactive collection exactly once; do not turn parked pages into temporary attached pages for saving.

Include native group and split visual data as well as page membership. A parked `TabGroupTabCollection` owns its `TabGroup`, and a `SplitTabCollection` owns its split data. Splits can be nested inside groups, so enumerating only the top-level detached variant is insufficient. Copy the required metadata while its owner is alive; do not post tasks holding borrowed collection pointers.

Preserve native group sync identifiers using the existing session-service mapping rules. Keep journal indices unique across the entire window and derive the selected window index from the same snapshot. Per-Space order and selection must be explicit metadata: restored pinned tabs are inserted before unpinned tabs, so the restore insertion order alone cannot represent every Space's original order.

### Cover incremental writes as well as resets

`SessionServiceBase::BuildCommandsForBrowser` currently writes the active model's selected index, group metadata, split visuals and tab loop. All four must use the complete window snapshot for Cove windows. `SessionService::BuildCommandsForTab` already adds native group and split membership after the base navigation serialization; add Cove tab metadata there too. Keep unrelated app-window behavior unchanged.

`SessionServiceBrowserHelper::SyncHistoryWithTabs` currently rewrites attached tab indices, pin state and group membership starting from a model index. Its insertion, removal, replacement and move callers, plus its direct selected-index writes, must use the same window-wide position mapping. Otherwise a Space switch can leave attached and parked tabs with colliding journal indices even after full-reset enumeration is fixed. Do not serialize an intermediate incoming-plus-outgoing switch state as the final Space assignment.

`SessionServiceBase::TabRestored` calls `BuildCommandsForTab` with index -1 and no group or split. This path does not replace the complete snapshot pass. Keep ordinary detachment separate from deletion: `SessionServiceBrowserHelper` only calls `TabClosing` when `WillDeleteTab` is true.

### Restore in two phases

`browser_tabrestore.cc::CreateRestoredTab` creates WebContents and restores other extra data before `AddRestoredTabImpl` inserts it. Parse Cove metadata before insertion too. Keep that metadata available before native pin observers run, so they cannot turn a restored navigated pin into a new saved home.

Full session restore creates windows in `SessionRestoreImpl::CreateRestoredBrowser`; recently closed windows use `BrowserLiveTabContext::Create`. Both need the saved active Space before normal assignment. Restoring into an existing startup browser also needs that handoff; covering only new-window creation misses this case.

The full restore sequence in `session_restore.cc` inserts tabs, restores split visuals, restores group metadata (which may delete WebContents), restores the focused group, notifies SessionService and closes the replaced startup tab. It then processes startup URLs and calls `FinishedTabCreation`. Repartition only after this sequence, using weak window references and newly resolved tab handles. Never retain raw restored WebContents pointers across group restoration. Audit recently closed tab, group, split and window completion separately because those entrypoints do not all call `FinishedTabCreation`.

If malformed ownership metadata would put members of one native group or split in different Spaces, preserve the collection together in a deterministic fallback Space. Do not repair a malformed ownership record by dropping pages or breaking their live collection.

### Required executable regression coverage

Use the existing `session_service_unittest.cc` and `session_restore_browsertest.cc` harnesses for journal reset/readback and end-to-end reconstruction. Add cases for unique window indices after repeated switches, nested group/split metadata, reopening a navigated pin without changing its home, two windows with different active Spaces, and invalid ownership metadata. These supplement the six acceptance cases above; pure metadata codec tests cannot establish durable restoration.

The full browser_tests and unit_tests executables are absent from the current output. The 61-test focused executable covers animation, gestures and the folder model only. Plan the restore test build explicitly rather than treating those 61 passing tests as coverage for session persistence.
