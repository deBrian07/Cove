# Continue Cove native Chromium

Read the current section of [HANDOFF.md](HANDOFF.md), then [VALIDATION.md](VALIDATION.md), [ARC_PARITY.md](ARC_PARITY.md), AGENTS.md and SPACE_RESTORE_DESIGN.md. The user wants Arc-like appearance and reliable daily behavior, specifically correct outside-click dismissal and Little Cove promotion into a specific Space. Keep the app fully native Chromium. No separate Cove account; no co-author trailers.

## Current state

Patches 0119–0121 are committed and preserved. Patch 0122 is committed as `d7e1dd4`; it is test-only and uses Chromium's standard native window-activation helper. Before the interruption, all 108 browser executions passed in one run with retries disabled (870 seconds; JSON 107 SUCCESS keys because PRE_ is folded), all 122 patches verified, 38 tooling tests passed, official gen/build receipt passed and renderer smoke passed outside the command sandbox. The verified current/generated/built identity was `562f3b871baecf2266ea2d9e1eade5a83fd276ca614f1f2281f7344c352bb971`. Evidence paths are in HANDOFF.md.

**The SanDisk is disconnected on the latest resume.** `/Volumes/SanDisk 1TB` is absent; `.chromium/` is unmounted. The user has been asked to reconnect it. Never mount an older local backup in its place, create another checkout, reset source/output or replace profiles. No Cove app was present in the latest CUA inventory, but inspect processes again after reconnection. Do not trust old exec IDs in historical notes.

## Immediate next work

1. Reconnect and mount the existing image with `python3 scripts/chromium/cove_chromium.py mount`. Run `python3 scripts/chromium/handoff.py`, inspect Git state and live processes, then read `.chromium/tmp/cove122/desktop-diagnostics.log`. Do not overlap Ninja or link with the app/tests running.
2. Resolve the desktop click discrepancy before claiming physical acceptance. Native real-mouse tests pass three inside/outside cycles with page-button delivery and draft/URL/tab-count retention. CUA opened/typed/Escaped correctly but coordinate clicks inconsistently targeted its floating window. The interrupted diagnostic launch enabled native palette/host VLOGs; distinguish main-window activation from hit-test dismissal.
3. Test the code-audited coordinate concern: EventMonitorMac reads the current cursor, whereas queued native clicks carry their own position. A regression can put the cursor outside while passing an inside NSEvent to the palette observer, then reverse them. A scoped Mac helper should convert NSEvent.locationInWindow through its NSWindow to Cocoa screen coordinates, then gfx::ScreenPointFromNSPoint; use cursor fallback only without a native event. Do not use EventSystemLocationFromNative (NOTIMPLEMENTED/(0,0) here), or compare window-relative root_location directly with screen bounds. No 0123 source change exists yet.
4. A separate unmeasured optimization is to unregister the cached palette's application monitor on VisibilityChanged(...,false), preserving RemovedFromWidget cleanup and lazy ShowExisting recreation. Extend the three-cycle regression plus explicit host dismissal to verify monitor lifetime and click delivery. Avoid claiming measured speed gains without measurements.
5. Continue broader Arc work after the reliability gate: rapid Space-motion interruption/reversal, joined split rows and pane headers, Peek, global Little Cove launch, Space ordering/profile assignment and broader restoration. Keep navigation protections and profile boundaries intact. A safe rapid-motion fix must preserve both presented trees; transform-only reset or unbounded snapshots are unsuitable. Do not blindly intercept link NEW_WINDOW dispositions and lose initiator/referrer/permission semantics.

## Build and validation contract

Reuse `.chromium/checkout/chromium/src` and `out/Cove`, jobs=2. Versioned patches in native/patches are authoritative. Keep each exporter's before/after snapshots separate; do not rerun old non-idempotent installers. Never edit source/patch/config during GN/Ninja or run two builders. Keep native, Arc and retired prototype profiles separate.

Run native browser tests from repository cwd with TMPDIR=/tmp, one job, zero retries, and --use-mock-keychain. The old cove107/run-checks.py changes cwd and caused GPU/dyld sandbox startup failures; do not reuse it unchanged. Fixtures using interactive_test_utils require foreground focus: enable UI controls in SetUpCommandLine before fake-focus setup, then BringBrowserWindowToFront. Do not use activateIgnoringOtherApps or interfere with desktop focus while these tests run.

Full gate, with a fresh evidence directory after future changes:

```sh
TMPDIR=/tmp .chromium/checkout/chromium/src/out/Cove/cove_session_browsertests \
  '--gtest_filter=Cove*' --test-launcher-jobs=1 --test-launcher-retry-limit=0 \
  --use-mock-keychain \
  --test-launcher-summary-output=/absolute/path/to/new-results.json
```

Verify sequential patch application against pristine pinned originals:

```sh
python3 native/tools/verify_patches.py --source .chromium/tmp/cove114/upstream
```

After stable source and passing tests, run official commands sequentially:

```sh
python3 scripts/chromium/cove_chromium.py gen
python3 scripts/chromium/cove_chromium.py build --jobs 2
python3 scripts/chromium/cove_chromium.py smoke
python3 scripts/chromium/handoff.py
```

Confirm current/generated/built identity equality; never manually stamp built_config. Raw cove107/build.py builds app/tests but does not stamp the receipt. Save evidence under the repository-local ignored .chromium/tmp directory, preserve failed logs, update all four continuation documents and make focused commits. Never commit disk images, compiled artifacts or profiles. Do not claim exact Arc visuals, physical trackpad/frame-time parity or production readiness from fixture checks alone.
