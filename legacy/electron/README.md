# Retired Electron prototype

This directory preserves the original Electron implementation and its unfinished visual work as reference material for the native Chromium port. It is archived and is no longer Cove's application or active development target.

Root `npm start`, `npm run build` and `npm run test:ui` use the native Chromium build. Root dependencies do not include Electron. There is no automatic fallback to this prototype.

The prototype's source, `package.reference.json`, `package-lock.reference.json`, test scripts and configuration are retained here. The dependency snapshots are reference files, not an active npm application. Its original user profile and saved data have not been removed or imported into the native profile. Port useful behavior into the native Chromium patch series rather than continuing development here.
