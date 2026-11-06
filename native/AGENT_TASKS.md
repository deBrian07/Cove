# Agent tasks and shared workspace

Start with [HANDOFF.md](HANDOFF.md), [NEXT_AGENT_PROMPT.md](NEXT_AGENT_PROMPT.md) and [VALIDATION.md](VALIDATION.md). The completed 0122 gate is the baseline. No 0123 implementation exists at this checkpoint. The SSD was disconnected at the last inspection; check live state before assuming it is still absent. This guide describes work boundaries, not active agent assignments.

## First checks

```sh
git status --short --branch
git log -5 --oneline
python3 scripts/chromium/handoff.py
```

On this machine, reconnect and mount the existing SanDisk image before native work. Reuse the checkout and `out/Cove`; preserve all profiles. On another machine, follow [LOCAL_BUILD.md](LOCAL_BUILD.md) for setup. Ignored checkouts, compiled binaries, profiles and local validation logs are not included in Git. The recorded results document the maintainer's completed run; another machine needs its own build and validation.

## Work boundaries

All source paths below are relative to `.chromium/checkout/chromium/src/`. Claim a task and list its files with the coordinator before editing. Read-only investigations can run concurrently. Ownership must include any additional shared files discovered during implementation.

In a solo session, the agent is the coordinator. These ownership rules coordinate agents sharing a checkout; they do not add a user approval step for ordinary authorized edits.

| Task | Starting source files | Required result |
| --- | --- | --- |
| Command-bar click coordinates, highest priority | `chrome/browser/ui/views/cove/cove_command_bar_view.{cc,h}`, `cove_caption_buttons_browsertest.mm` in that directory | Reproduce cursor/event disagreement deterministically; distinguish it from palette deactivation in desktop logs. Preserve inside clicks, outside page-click delivery, cached reuse and draft/URL/tab count. See the conversion details in HANDOFF.md. |
| Command-bar monitor lifetime, after coordinate work | Same command-bar files and caption fixture | Release the monitor while hidden and recreate on show; test repeated outside-click and explicit dismissal. Keep the same owner as the preceding task because the files overlap. Performance impact remains unmeasured. |
| Rapid Space-motion interruption | `chrome/browser/ui/views/frame/vertical_tab_strip_region_view.{cc,h}`, `chrome/browser/ui/views/cove/cove_sidebar_drag_browsertest.cc` | Preserve the visuals already on screen during interruption/reversal; use pixel continuity checks, bounded state, repeated switching, resize/collapse, reduced motion and destruction coverage. Preserve both presented trees rather than resetting transforms. |
| Little Cove and media acceptance | `chrome/browser/ui/cove/cove_temporary_window*`, `chrome/browser/ui/views/cove/cove_mini_media_view*`, `cove_mini_player_browsertest.cc` in the latter directory | First review existing specific-Space transfer, address/history, routing and media coverage. Record concrete site/desktop or visual gaps. Global Little Cove launch and broader site acceptance remain. Coordinate any edits to shared frame, toolbar or sidebar files. |
| Split headers, joined rows and Peek planning | Trace native split/navigation owners before claiming files | Produce a concrete native design and acceptance cases. Preserve initiator/referrer/permission semantics, pane identity, history and profile boundaries. Avoid a blanket interception of new-window links. |

Keep the palette coordinate and monitor-lifetime tasks serial. Motion and media can also collide in `vertical_tab_strip_region_view`, sidebar code and test fixtures; split those edits explicitly. Desktop interaction and real-input tests share foreground focus and must run at separate times.

## One coordinator for shared operations

- The coordinator owns `native/patches/series`, `native/chromium.json`, `native/upstream-files.json`, build configuration and any shared BUILD.gn edits. Allocate the next patch number from the live series, not this document. A worker can propose metadata changes for integration.
- Use separate before/after export snapshots for each patch. Do not regenerate an earlier patch from a later worker's live tree. Versioned patches must reproduce the final checkout; review unrelated diffs before committing.
- Freeze source, patch and configuration edits before generation/build. Run only one builder against `out/Cove`. Do not link while Cove or native fixtures are running. Resume edits only after the build completes.
- Run foreground native tests with one job and no desktop focus changes. Enable UI controls before fake-focus setup and use Chromium's native activation helper. Preserve the accepted 0122 fixture correction.
- The coordinator collects results and updates HANDOFF.md, VALIDATION.md, ARC_PARITY.md and NEXT_AGENT_PROMPT.md. Earlier process IDs in [HANDOFF_HISTORY.md](HANDOFF_HISTORY.md) are not live ownership records.

## Acceptance and handback

Run browser binaries from repository cwd with `TMPDIR=/tmp`, one job, zero retries and `--use-mock-keychain`. Use a fresh ignored evidence directory. See NEXT_AGENT_PROMPT.md for the full browser command, official generation/build/smoke sequence and identity check. Raw build helpers do not stamp the official build receipt.

For pinned-source patch verification, this machine has historically used `.chromium/tmp/cove114/upstream`. It contains pristine originals, not the patched checkout. If that local cache is unavailable on another machine, `python3 native/tools/verify_patches.py` downloads pinned originals into its default ignored cache and verifies their checksums. Patch application alone does not establish compilation or runtime acceptance.

Each worker hands back: changed files and patch, behavior and reproduction, exact commands/results, evidence paths, remaining failures or unverified behavior, and whether any process is still running. Report results separately for deterministic tests, desktop input, physical trackpad/frame times and visual comparison. The 108-case baseline does not validate later edits automatically.

Commit only intended files without co-author trailers. Keep disk images, outputs, profiles and local logs out of Git. Preserve failed evidence and other agents' work. Exact Arc parity and production readiness remain unfinished.
