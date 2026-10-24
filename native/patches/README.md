# Native Chromium patch series

Apply `series` in order to Chromium `d0c02bfad08ec92a6ffcf989e53cd995e6381a4c` (macOS Stable `156.0.8078.48`). The paths in each patch are relative to Chromium's `src` checkout.

`0001-native-sidebar-defaults.patch` starts Cove on Chromium's native Views vertical tab strip. New profiles open with an expanded 260-pixel sidebar. The normal hover delay and the cursor-at-edge heuristic delay are 120 milliseconds. Existing saved tab-strip preferences and restored window widths take precedence over the new defaults.

This uses Chromium's tab model, native tab rendering, pinning, drag-and-drop, close controls, session restoration, resize animation and hover-expansion implementation. It does not add an Electron or CEF runtime. The current Chromium sidebar still has its upstream collapsed rail and toolbar; Arc-style Spaces, Favorites, folders and the command palette have not been ported by this patch.

The patch also adds `CoveSidebarDefaultsTest` cases for the fresh-profile defaults and saved horizontal-tab preference, and gives existing mode-transition controller tests an explicit horizontal starting preference.

Validation performed: downloaded only the four touched upstream files at the pinned revision, then ran `git apply --check`, applied the patch and ran `git apply --reverse --check` against that fixture. No full native compilation or native UI run has been completed. These source checks do not establish that the fork builds or feels smooth.

After a full checkout and build environment are available, build and run the existing Chromium unit test target:

```sh
autoninja -C out/Cove unit_tests
out/Cove/unit_tests --gtest_filter='CoveSidebarDefaultsTest.*:VerticalTabStripStateControllerTest.*'
```

Run the browser separately with an isolated profile. Validate native tab activation, pin/unpin, dragging within and between windows, restored width, collapse/hover expansion, keyboard focus, fullscreen and reduced-motion behavior before treating this milestone as complete.
