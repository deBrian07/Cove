# Durable Space restore: implementation constraints

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
