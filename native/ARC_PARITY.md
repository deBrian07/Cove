# Arc reference and native parity

The user's supplied screenshot is the visual target. All implementation belongs in Chromium's native UI and services; the retired Electron archive is reference only.

The target window has a roughly 250px purple sidebar, navigation beside the window controls, a compact address field inside the sidebar, favorite tiles, folder/tab hierarchy and space controls at the bottom. The page begins near the window's top edge with a thin rounded frame. Chromium's current full-width toolbar is still a visible gap: moving it safely requires a native compact location-bar host and vertical-mode layout changes, while preserving security indicators, menus, fullscreen and side panels.

The target command bar is roughly 760px wide with a 64px query field and five compact rows. Each row has a small favicon, a single-line title and a right-aligned action. It uses a dark surface, a thin border, a strong blue selection and a restrained shadow.

Implemented in this pass:

- Native Cmd+T and sidebar New Tab open the same centered command palette.
- Native omnibox classification opens URLs or searches through the selected search engine.
- Submitting a new navigation or switching a tab closes the native bubble.
- Command+Return forces new navigation; IME composition does not submit.
- Dark purple default chrome, compact vertical-tab spacing and one-line palette rows.

Remaining native work includes the compact sidebar address/navigation host, Favorites, folders, Spaces, pinned/temporary-tab organization, current-tab URL editing with Cmd+L, history suggestions, the reference's flat result list and complete motion/focus parity. The current implementation still inherits Chromium's Open Tabs / Recently Closed sections. Visual resemblance is not a claim of exact Arc behavior or measured latency.
