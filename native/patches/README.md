# Native Chromium patch series

Apply `series` in order to Chromium `d0c02bfad08ec92a6ffcf989e53cd995e6381a4c` (macOS Stable `156.0.8078.48`). The paths in each patch are relative to Chromium's `src` checkout.

`0001-native-sidebar-defaults.patch` starts Cove on Chromium's native Views vertical tab strip. New profiles open with an expanded 260-pixel sidebar. The normal hover delay and the cursor-at-edge heuristic delay are 120 milliseconds. Existing saved tab-strip preferences and restored window widths take precedence over the new defaults.

This uses Chromium's tab model, native tab rendering, pinning, drag-and-drop, close controls, session restoration, resize animation and hover-expansion implementation. It does not add an Electron or CEF runtime. The current Chromium sidebar still has its upstream collapsed rail and toolbar; Arc-style Spaces, Favorites, folders and the command palette have not been ported by this patch.

`0002-cove-development-branding.patch` changes the unbranded product name to Cove, sets the development bundle identifier to `dev.cove.browser` and sets the four-character macOS creator code to `Cove`. The top-level application plist uses Chromium's supported `CrProductDirName` override to put default native profile data in `~/Library/Application Support/Cove Native`, separate from Chromium and the Electron prototype's Cove data. The CLI should continue to pass its own isolated development profile.

At this pinned revision, `build/util/branding.gni` reads the branding file, `chrome/BUILD.gn` sets the macOS app output name from it and `chrome/common/chrome_constants.cc` derives executable/helper/framework names from `PRODUCT_FULLNAME_STRING`. The expected target output is `out/Cove/Cove.app/Contents/MacOS/Cove`, with `Cove Framework.framework` and `Cove Helper` app names. This is a source-derived expectation until a native build is completed.

The branding patch keeps upstream copyright and authorship, the Chromium icon and existing localized Chromium descriptions. It changes the nontranslated product-name strings only; complete branding/localization, a Cove icon, signing and update identity remain unfinished. The development bundle identifier is not a claim of an owned domain or registered production signing identity.

The patch also adds `CoveSidebarDefaultsTest` cases for the fresh-profile defaults and saved horizontal-tab preference, and gives existing mode-transition controller tests an explicit horizontal starting preference.

Validation performed: used the seven touched files at the pinned revision in a temporary fixture, then checked and applied both patches in series and checked and applied their reversals in reverse order. Parsed the modified application plist and used upstream `build/util/version.py` to verify the generated Cove branding values. No full native compilation or native UI run has been completed. These source checks do not establish that the fork builds or feels smooth.

After a full checkout and build environment are available, build and run the existing Chromium unit test target:

```sh
autoninja -C out/Cove unit_tests
out/Cove/unit_tests --gtest_filter='CoveSidebarDefaultsTest.*:VerticalTabStripStateControllerTest.*'
```

Run the browser separately with an isolated profile. Validate native tab activation, pin/unpin, dragging within and between windows, restored width, collapse/hover expansion, keyboard focus, fullscreen and reduced-motion behavior before treating this milestone as complete.
