# Native UI validation - 2026-10-24

The copied local APFS image was used; the external SSD was not needed or modified. All eight patches apply in order to pinned Chromium `d0c02bfad08ec92a6ffcf989e53cd995e6381a4c` (`156.0.8078.48`).

The native `chrome` target compiled and linked successfully in the existing `out/Cove`. Native WebUI TypeScript, template and CSS lint passed as part of that build. The application is `Cove.app`, bundle ID `dev.cove.browser`, with the native Cove framework rather than Electron.

`npm run test:ui` passed using the actual native renderer and a separate temporary profile. The final Tab Search WebUI regression TypeScript target also compiled successfully.

`npm test` passed: 29 build-tool tests and 3 patch-verifier tests. The verifier also applied the complete series against original source files with pinned SHA256 checks.

In the actual native UI, an isolated `CoveUIValidation-*` profile was used for testing, with a mock Keychain confined to that test profile. Normal `npm start` does not enable a mock Keychain. Verified observations:

- Cmd+T opened the centered native command bar.
- Native URL submission opened `chrome://version/` and closed the bar, with focus returned to the page.
- Typing immediately after Cmd+T filtered the query `zzcove`. Return opened the default-engine Google results in a new tab and dismissed the bar.
- Reopening the cached palette accepted the query `ab`; Escape dismissed it and returned focus to the Google page.
- Sidebar New Tab opened the same palette.
- The dark purple frame and compact palette were inspected in a native screenshot.

Runtime checking caught an action-dispatch recursion in the initial New Tab wiring. The final callback calls the native palette directly, preserving the regular new-tab fallback for incognito and other window types. Native widget activation and WebView focus are explicit on show; DOM input focus is restored on cached reopens.

Limits: the three new WebUI regression cases were type-checked, not executed in `browser_tests`. Mouse submission and extended tab-switch/IME/Command+Return interaction checks remain incomplete because the UI automation lost popup handles and the user interacted with the app during validation. There is no measured latency, frame-time, reduced-motion, accessibility or complete Arc-parity claim. Remaining visible layout gaps are recorded in [ARC_PARITY.md](ARC_PARITY.md).
