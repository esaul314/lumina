# 📖 Lumina Developer Log & AI Learnings Journal

This document serves as a public-facing, generic history of technical developments, architectural decisions, and key technical lessons learned. Any developer or visiting AI agent should read this file to understand why certain features were built in a specific way and to avoid repeating past mistakes.

---

## 📅 Technical Changelog & Milestones

### 2026-06-29: Selector-Core Reuse & Declarative Feed Config Presets
* **Goal**: Make another ES6+/functional cleanup pass without sacrificing readability, and keep the JavaScript surface closer to the reducer/selector foundation that will later migrate to TypeScript.
* **Implementation**:
  * **Legacy app dedupe**: Refactored [`server/app.js`](file:///home/alex/work/lumina/server/app.js) so `combineFeedsBalanced`, `selectWeightedRandomPhoto`, `isTimeInSchedule`, and the smart-photo filter pipeline now reuse the shared implementations in [`server/domain/selectors.js`](file:///home/alex/work/lumina/server/domain/selectors.js) instead of carrying parallel copies.
  * **Preset-driven config builder**: Reworked [`server/config/state.js`](file:///home/alex/work/lumina/server/config/state.js) so feed configs are assembled from a small keyword-source factory plus a frozen built-in override table, replacing the long category `if/else` ladder with a declarative `Object.fromEntries(...)` projection.
  * **Collection projection reuse**: Updated [`server/config/collections.js`](file:///home/alex/work/lumina/server/config/collections.js) to reuse the immutable `updatePhotoInCollections(...)` selector helper and compact state-photo sync helpers instead of nested mutation loops.
  * **Regression coverage**: Added tests in [`run-tests.js`](file:///home/alex/work/lumina/run-tests.js) covering declarative feed-config layering and legacy crop projection across `photosList` plus `activeSecondPhoto`.
* **Learning**: For Lumina, the cleanest “functional” move is often not adding more combinators or point-free wrappers, but collapsing duplicate implementations onto the existing pure selector layer. That reduces drift now and lowers the TypeScript conversion surface later.
* **Verification**: `npm test` passed. `npm run lint` passed. The known sandbox-only ephemeral localhost bind warning still appears in the smoke-test section, but the regression suite exits successfully.

### 2026-06-28 (Part 3): Persistent `systemd --user` Service Installation
* **Goal**: Stop relying on ad hoc manual launches for the TV host and make Lumina survive logout and reboot through `systemd`.
* **Implementation**:
  * Added a tracked service template at [`systemd/lumina.service.template`](file:///home/alex/work/lumina/systemd/lumina.service.template) rather than committing host-specific absolute paths directly into git.
  * Added [`scripts/install-systemd-user-service.sh`](file:///home/alex/work/lumina/scripts/install-systemd-user-service.sh), which resolves the current repo root, `node` binary, user, UID, and user config directory at install time, then materializes `~/.config/systemd/user/lumina.service`.
  * Updated [`README.md`](file:///home/alex/work/lumina/README.md) with `systemctl --user` installation and operations guidance.
  * Installed and enabled the user service on `playwright`, then enabled lingering for `alex` so the service stays available across logout/reboot.
* **Operational Result**:
  * `systemctl --user status lumina` reports the service active.
  * `curl http://127.0.0.1:5000/api/config` responds successfully.
* **Learning**: Because Lumina depends on the logged-in GNOME stack, Mutter DBus, PulseAudio/PipeWire, and kiosk browser launch behavior, a `systemd --user` service is the correct execution model; a root system service would be the wrong integration boundary here.
* **Verification**: `npm test` passed. The long-standing sandbox-only `listen EPERM` warning still appears in the ephemeral localhost smoke-test section, but all assertions passed and the real host service responds on port `5000`.

### 2026-06-28 (Part 2): Nullish-Safe Selector Defaults & Declarative Cleanup
* **Goal**: Make the selection and persistence layers more fluent and falsy-safe by using modern ES6+ operators where they improve both readability and behavior.
* **Implementation**:
  * **Selector cleanup**: Refactored [`server/domain/selectors.js`](file:///home/alex/work/lumina/server/domain/selectors.js) to use `??`, `?.`, default parameters, and `Array.prototype.at()` in category normalization, weighted selection, split-frame derivation, and weather/news fallbacks.
  * **Night-percentage bugfix**: Replaced `nightPercentage || 50` with `nightPercentage ?? 50` in both the domain selectors and legacy [`server/app.js`](file:///home/alex/work/lumina/server/app.js), so an explicit `0` percent night preference is no longer silently treated as `50`.
  * **Persistence codec cleanup**: Refactored [`server/config/collectionsCodec.js`](file:///home/alex/work/lumina/server/config/collectionsCodec.js) with destructuring, nullish-aware cloning helpers, and explicit fallback handling for persisted split crop values and manual location state.
  * **Regression coverage**: Added tests proving that explicit `false` metadata is preserved during photo tagging and that persisted `splitCropPercent: 0` survives normalization.
* **Learning**: Apply `??` only where `null`/`undefined` are the real “missing value” states. Keep truthy fallbacks or validation guards when empty strings or wrong types should still collapse to safe defaults.
* **Verification**: `npm test` passed. The known ephemeral localhost bind warning (`listen EPERM`) still appears in the smoke-test section but the command exits successfully and all assertions pass.

### 2026-06-24: TV Controller Rating Fallback Bugfix
* **Issue**: The remote control rating widget displayed `undefined (Weight: 1)` for photos that did not yet have a rating set.
* **Root Cause**: The client-side rating component was reading the photo's rating field without providing a default value.
* **Fix**: Added a safe fallback expression: `const currentRating = activePhoto && activePhoto.rating !== undefined ? activePhoto.rating : 10;`.
* **Learning**: Avoid assuming all metadata properties are initialized; provide logical defaults (e.g. standard rating weight `10`).

### 2026-06-25: REST API Integration & Test Automation
* **Goal**: Implement a fully RESTful API to configure and control Lumina next to the real-time Socket.IO synchronization layer.
* **Implementation**:
  * Refactored server routes to expose endpoints for state query/updates (`GET`/`PATCH` `/api/state`), screensaver toggle (`POST` `/api/state/screensaver`), scenic pool configuration (`GET`/`POST`/`PATCH`/`DELETE` `/api/pools`), and photo actions (rating, cropping/zooming, previews, next/prev transitions).
  * Automated testing: Added programmatic server start and teardown on a dedicated test port (`5001`) during integration testing to guarantee smoke tests run reliably and independently.
* **Verification**: Established a suite of 50 unit and integration tests.

### 2026-06-26: Live Weather Humidity & Cursor Auto-Hiding
* **Goal**: Display relative humidity in the weather widget and hide the mouse pointer during screensaver playback.
* **Implementation**:
  * **Humidity**: Extracted `relative_humidity_2m` from the live meteorological API payload and added a soft-styled `.weather-humidity` display utilizing a droplet icon.
  * **Cursor Auto-Hide**: Implemented a mouse-movement listener in the main dashboard. If no movement is detected for 3 seconds, a `.hide-cursor` class is applied via CSS (`cursor: none !important`). The timer clears automatically on movement and is paused when the settings drawer is open.

### 2026-06-27: Custom Keyword Chip UI & Safety Bounds
* **Goal**: Upgrade keyword configuration to a tag chip UI and ensure rating input bounds are safe.
* **Implementation**:
  * **Tag Chip UI**: Replaced comma-separated text strings with an interactive tag chip component supporting tag creation via commas, semicolons, or the Enter key. Added automatic deduplication and validation for time-restricted keyword items.
  * **Safe Rating display**: Unified fallbacks across the remote dashboard, formatting `undefined` or default states explicitly as `10 (Default / Max)`.

### 2026-06-27 (Part 2): TV Screensaver Rapid Skipping Fix & Default Pool Config
* **Goal**: Fix rapid screensaver wallpaper rotation (every 3-5 seconds) when creating/activating new pools, and disable broken Art Institute of Chicago URLs by default.
* **Implementation**:
  * **Preloader Hook Cleanup**: Added cleanup logic to the preloader `useEffect` hook in `Dashboard.jsx` to abort previous preloading requests when the state or categories change, preventing orphaned background loaders from triggering slide skips on error.
  * **Crawl Defaults**: Changed the default pool configurations to disable the `artic` crawler by default. This avoids flooding new custom pools with broken URLs that get Cloudflare 403 blocks in datacenter environments.
* **Verification**: Added automated tests to assert the crawler configuration, rebuilt client assets, and successfully passed the Playwright E2E integration test (`test_split_sync.js`).

### 2026-06-27 (Part 3): Functional Programming Refactor & State Synchronization Fix
* **Goal**: Refactor server-side state projection, tagging/filtering algorithms, and client-side preloader to use clean, declarative, functional programming paradigms, and resolve split portrait synchronization bugs.
* **Implementation**:
  * **Unified Photo Updaters**: Refactored `collections.js` to replace duplicate, imperative loops in `updatePhotoRating`, `markPhotoBroken`, `updatePhotoCrop`, and `updatePhotoPreventPairing` with a single, curried `updatePhotoField` orchestrator. This fixed a bug where setting ratings/crops on portrait photos did not synchronize to the split/paired second photo (`state.activeSecondPhoto`).
  * **Declarative Server Pipelines**:
    * Refactored keyword tagging inside `app.js` using composed, curried classifiers (`tagSinglePhoto`, `classifyAtmosphere`).
    * Refactored `combineFeedsBalanced` using functional pipe-composition of pure `shuffle` and `interleave` functions.
    * Replaced imperative loops in `selectWeightedRandomPhoto` with a mathematical Cumulative Distribution Function (CDF) reducer and `find` predicate.
    * Composed the smart wallpaper selection filters (`getSmartPhoto`) using curried, piped stages (`filterByTime`, `filterByWeather`, `filterByNight`).
  * **Promise-based Client Preloader**: Rewrote the nested recursive callback queue in `Dashboard.jsx` to use a clean async/await loop based on a Promise-wrapped image loading utility.
* **Verification**: All 50 diagnostic and integration smoke tests pass 100%. Compilation builds successfully.

### 2026-06-27 (Part 4): Comprehensive Backend Functional Upgrades
* **Goal**: Refactor secondary backend modules (weather codes, news sentiment, audio sink inputs, crawler configuration builders, and IP retrievers) to remove mutable variables, index loops, and imperative conditions.
* **Implementation**:
  * **News Sentiment Regex & Classifier**: Replaced the mutative `while` loop parsing Google News RSS feed with a declarative `matchAll` mapping in `sentiment.js`, and extracted sentiment label calculations into a pure `classifyScore` mapper.
  * **WMO Weather Code Lookup**: Replaced the nested `if/else` condition chains in `weather.js` (`classifyWeatherCode`) with a constant-time $O(1)$ lookup mapping dictionary.
  * **Declarative Audio Active Checker**: Refactored the imperative `for` loop in `system.js` (`isAudioPlaying`) to cleanly slice, filter, and match active inputs via the `.some` array predicate.
  * **Crawler Config Mapper**: Refactored `buildFeedConfigsFromKeywords` in `crawler.js` to flatMap custom categories and reduce configs into a clean declarative output.
  * **Local IP Resolver**: Refactored `getLocalIpAddresses` in `app.js` to use a single chain of `Object.values`, `.flat()`, `.filter()`, and `.map()`.
* **Verification**: All 50 diagnostics and smoke tests passed. Integration split sync test suite passed.

### 2026-06-27 (Part 5): Pure System Reducers & Curried Validators
* **Goal**: Refactor the main screensaver daemon activation loop, crawler scheduling blocks, and endpoint validators to use pure state machine reducers, declarative map-flatMap queues, and curried parameter validator scopes.
* **Implementation**:
  * **Daemon State Machine Reducer**: Extracted Mutter idle loop condition checks into a pure `getNextScreensaverState` state transition reducer. Unit tests were added to run-tests.js to assert action schedules ('launch' vs 'kill') and idle ticks.
  * **Crawler Jobs mapping**: Refactored `crawlAllCollections` in `crawler.js` to flatMap configs into a flat Crawl Jobs array, replacing nested loops with flat sequential executions.
  * **Curried validation scopes**: Created `validation.js` containing a curried `validateRange` factory, defining and exporting `validateRating` and `validatePercent`. We replaced inline parameter validations in routes.js and sockets.js with these clean validators.
* **Verification**: All 51 assertions passed. Integration E2E tests verified successfully.

### 2026-06-27 (Part 6): Functional Core Dispatch, Derived Frames, and REST-First Snapshots
* **Goal**: Move Lumina toward a functional core / imperative shell architecture in JavaScript, with TypeScript-ready JSDoc contracts and a REST-first derived snapshot model.
* **Implementation**:
  * **Typed Domain Layer**: Added `server/domain/` modules with `@ts-check` JSDoc contracts for command types, reducers, selectors, domain snapshots, and persistence-oriented tests.
  * **Unified Command Path**: Added a shared reducer/dispatcher flow for category selection, photo rating, preview/advance actions, split settings, exclusions, screensaver activation, and pool lifecycle transitions. Both REST routes and Socket.IO handlers now decode into the same command shapes for the refactored surface area.
  * **Derived `currentFrame` Snapshot**: Introduced a server-derived `currentFrame` object and started removing client-side split-pair orchestration. The dashboard now reports photo metadata to the server and renders the server-selected secondary portrait instead of inventing its own pairing state.
  * **Persistence Codec**: Added `server/config/collectionsCodec.js` to normalize persisted collections/config, re-seed empty categories after dedupe, and write a canonical snapshot shape.
  * **Transport Hardening**: Fixed test harnesses to bind ephemeral localhost ports instead of assuming `5001`, and changed the client Socket.IO URL logic to use same-origin by default with a Vite-dev exception (`5173 -> 5000`). This fixes split sync and REST smoke tests when the daemon self-heals onto fallback ports.
* **Verification**: `npm test` passed with 64/64 assertions. `npm run test:integration` passed on `playwright` after rebuilding the client bundle.

### 2026-06-27 (Part 7): Split Portrait Wallpaper Failures Fix
* **Goal**: Prevent the screensaver from displaying a half-blank/black screen when a secondary split portrait wallpaper fails to load.
* **Implementation**:
  * **Secondary Preload Handling**: Updated the client-side preloader in [Dashboard.jsx](file:///home/alex/work/lumina/client/src/components/Dashboard.jsx) to track if the secondary photo loads successfully.
  * **Pruning and Fallback**: If the secondary photo fails to load, the client now emits a `mark-photo-broken` socket event using the secondary image URL to immediately flag and prune it from the collections, and falls back to rendering the primary photo as a fullscreen single slide (`addSingleSlide`).
* **Verification**: Verified that unit tests (`npm test`) and E2E integration tests (`node test_split_sync.js`) pass successfully.

### 2026-06-27 (Part 8): Optional Tumblr Tag Search via API Key
* **Goal**: Add Tumblr tag-based crawling without disturbing the existing zero-credential public-blog Tumblr source.
* **Implementation**:
  * **Optional authenticated crawler**: Added `fetchTumblrTaggedImages` in [`server/services/crawler.js`](file:///home/alex/work/lumina/server/services/crawler.js) using Tumblr's official `GET /v2/tagged` API. The crawler activates only when `TUMBLR_API_KEY` is present in the server environment; otherwise it logs a skip and returns an empty result safely.
  * **Feed config support**: Added a new `tumblrTags` source alongside existing `tumblr` blog crawling in the default feed config builders so built-in scenic pools can opt into curated tag queries without losing the legacy blog lists.
  * **Remote UI**: Extended [`ImageFeedsTab.jsx`](file:///home/alex/work/lumina/client/src/components/remote/ImageFeedsTab.jsx) with a new `Tumblr Tag Search` source card and inline operator guidance that the source requires `TUMBLR_API_KEY`.
  * **Regression coverage**: Added test coverage proving the tagged crawler is exported and safely no-ops when the API key is absent.
* **Verification**: `npm test` passed. In this sandbox, the live endpoint smoke sub-suite still logs `listen EPERM` when trying to bind an ephemeral localhost port, but the command exits successfully and the new Tumblr-tag assertions pass.

### 2026-06-27 (Part 8): Remove Google DeepMind Footer Attribution
* **Goal**: Remove incorrect footer attribution "POWERED BY GOOGLE DEEPMIND" from the Remote Control user interface.
* **Implementation**:
  * Modified [RemoteControl.jsx](file:///home/alex/work/lumina/client/src/components/RemoteControl.jsx) to omit the "• POWERED BY GOOGLE DEEPMIND" string from the system info paragraph.
* **Verification**: Verified that all diagnostics and tests run successfully.

### 2026-06-27 (Part 9): Portrait Split Crop/Zoom Refinement & Touch Isolation
* **Goal**: Fix touchpad drag-to-crop vs. swipe-to-skip touch conflicts, reduce slider zoom response latency on the TV, add focus-based dual photo controls, and correct in-place slide check caching bugs.
* **Implementation**:
  * **Touch Isolation**: Called `e.stopPropagation()` in touchstart, mousedown, and touchend handlers on both single and split preview panes in [DirectControlTab.jsx](file:///home/alex/work/lumina/client/src/components/remote/DirectControlTab.jsx), preventing drag gestures from triggering the parent swipe-to-skip controller.
  * **Focus-Based Controls**: Introduced a `selectedPhotoSide` state in [RemoteControl.jsx](file:///home/alex/work/lumina/client/src/components/RemoteControl.jsx). Tapping on either the Left or Right preview pane focuses that photo (highlighted by a glowing border), dynamically binding the zoom slider, rating deck, and pairing toggle below to it.
  * **Real-Time Responsiveness**: Reduced debounced socket emits from `200ms` to `30ms` on the Direct Control tab, and added a local crop range state with `30ms` throttled emits on the Image Feeds rating deck. Zoom changes now update the TV screen dynamically as you drag.
  * **Resolved In-place Check**: Updated the TV view slide-change check in [Dashboard.jsx](file:///home/alex/work/lumina/client/src/components/Dashboard.jsx) to compare resolved crop values rather than raw values, ensuring changes to global defaults (like `splitCropPercent`) are applied instantly.
* **Verification**: Verified successfully via automated unit tests (`npm test`) and Playwright E2E split sync tests (`node test_split_sync.js`).

### 2026-06-27 (Part 10): Standardized Secret Storage on `.env`
* **Goal**: Stop scattering secrets across `config.json`, sidecar JSON files, and ad hoc runtime paths by making `.env` the single secret store.
* **Implementation**:
  * **Central env helper**: Added [`server/config/env.js`](file:///home/alex/work/lumina/server/config/env.js) to load `.env`, read environment variables consistently, and persist updated keys back to the same file with quoted serialization.
  * **Config hardening**: Updated [`configLoader.js`](file:///home/alex/work/lumina/server/config/configLoader.js) so secret-like keys in `config.json` are ignored with a warning instead of being treated as supported configuration.
  * **Credential migration**:
    * `USEAPI_TOKEN`, `TUMBLR_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NASA_API_KEY` are now read from `.env`.
    * Google Photos credentials no longer persist to `server/config/.google_credentials.json`; they are written to `.env` through the shared helper.
  * **Admin UI alignment**: Added a Tumblr API key field in [`SystemSettingsTab.jsx`](file:///home/alex/work/lumina/client/src/components/remote/SystemSettingsTab.jsx) and updated Google/UseAPI copy so the operator-facing UI reflects the `.env` policy.
  * **Documentation and examples**: Added a tracked [`.env.example`](file:///home/alex/work/lumina/.env.example), updated [`README.md`](file:///home/alex/work/lumina/README.md), and removed secret fields from [`config.json.example`](file:///home/alex/work/lumina/config.json.example).
  * **Regression coverage**: Added an env-helper unit test proving secret values are appended/replaced safely with quoted serialization.
* **Verification**: `npm test` passed. `npm run lint` passed cleanly. The existing smoke-test sandbox limitation still logs `listen EPERM` when binding ephemeral localhost ports.

### 2026-06-27 (Part 11): Direct Control Portrait Zoom Sync Hardening
* **Goal**: Make per-image zoom changes from the Direct Control slider show up immediately on the TV for split portrait layouts and stay persisted on the correct image.
* **Implementation**:
  * **Live photo resolution**: Updated [`Dashboard.jsx`](file:///home/alex/work/lumina/client/src/components/Dashboard.jsx) and [`RemoteControl.jsx`](file:///home/alex/work/lumina/client/src/components/RemoteControl.jsx) to resolve crop metadata by image URL from the current frame, active photo pointers, and live feed list before falling back to stale slide snapshots.
  * **Split-frame crop refresh**: Hardened the dashboard's in-place active-slide crop refresh so paired portrait updates read from the resolved live secondary photo instead of whichever `activeSecondPhoto` object happened to be cached.
  * **Regression coverage**: Added a reducer test proving `set-photo-crop` updates flow through both the active portrait and its derived split partner frame metadata.
* **Verification**: `npm test` passed, including the new crop regression. `npm --prefix client run build` passed. In this sandbox, the existing live-endpoint smoke section still logs `listen EPERM` when it attempts an ephemeral localhost bind.

### 2026-06-28: Frame-Selector Cleanup for Zoom/Crop State
* **Goal**: Reduce the client-side state ambiguity around `activePhoto`, `activeSecondPhoto`, `photosList`, and `currentFrame` so zoom/crop rendering follows one consistent execution path.
* **Implementation**:
  * **Single client selector layer**: Added [`frameSelectors.js`](file:///home/alex/work/lumina/client/src/state/frameSelectors.js) to normalize transport snapshots and expose helpers for current-frame lookup, split-layout detection, frame orientation, URL-based photo lookup, and effective crop state resolution.
  * **TV renderer cleanup**: Refactored [`Dashboard.jsx`](file:///home/alex/work/lumina/client/src/components/Dashboard.jsx) to drive active slide updates and rendered crop math from the frame selectors instead of mixing `activePhoto`, `activeSecondPhoto`, local orientation guesses, and feed scans.
  * **Remote control cleanup**: Refactored [`RemoteControl.jsx`](file:///home/alex/work/lumina/client/src/components/RemoteControl.jsx), [`useActivePhotoSync.js`](file:///home/alex/work/lumina/client/src/hooks/useActivePhotoSync.js), and [`useCropDrag.js`](file:///home/alex/work/lumina/client/src/hooks/useCropDrag.js) so the Direct Control tab resolves the focused image and crop values from the same frame-based selectors the TV uses.
  * **UI-path regression**: Updated [`test_split_sync.js`](file:///home/alex/work/lumina/test_split_sync.js) so the integration test moves the actual Direct Control slider UI for both split portrait and single-landscape flows rather than bypassing the UI with a raw socket emit.
* **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. In this sandbox, `node test_split_sync.js` still exits after the known ephemeral localhost bind warning (`listen EPERM`) before producing usable browser-stage logs, so the UI-path assertions could not be fully observed here.
### 2026-06-29: Dynamic OAuth Host Redirection
* **Goal**: Support Google Photos OAuth handshake on local network environments without HTTPS by using `localhost` combined with SSH port forwarding.
* **Implementation**:
  * **Dynamic Redirect URI**: Modified [routes.js](file:///home/alex/work/lumina/server/routes.js) to build `redirectUri` using `req.headers.host` dynamically in the login, callback, and sandbox-callback routes, rather than utilizing the hardcoded `localIp` IP address.
  * **Credential Correction**: Resolved a Client ID mismatch in `.env` by aligning it with the active project credentials.
  * **Seamless Handshake**: Allows redirection to `http://localhost:5000/api/auth/google/callback` (which Google permits over plain HTTP) via SSH tunnel forwarding.
* **Verification**: `npm test` passed successfully. Tested systemd service restarts and verified service is active.

---

## 🧬 Crucial Gotchas & Design Rules

To prevent regressions, all visiting developers must strictly abide by the following architectural constraints:

### 1. React useEffect Hook Cleanup for Preloaders
When writing components that preload images dynamically in response to state changes:
* **Rule**: Always maintain an `active = true` local flag and return a cleanup function in the `useEffect` that sets `active = false` and cancels event handlers (`onload`/`onerror`). Verify this flag before executing any callbacks or emitting socket actions.
* **Why**: Outstanding background preloaders from previous renders will otherwise trigger state updates or error cascades (e.g. next-photo skips) when they complete, leading to rapid slideshow rotation cycles.

### 2. Always Bind Image Event Handlers Before Setting `src`
When preloading wallpaper images dynamically via Javascript (`new Image()`), **always** assign `onload` and `onerror` handlers *before* setting the `src` property:
```javascript
const img = new Image();
img.onload = () => { /* Handle load */ };
img.onerror = () => { /* Handle error */ };
img.src = imageUrl;
```
* **Why**: For cached images, browsers may execute the load handler synchronously upon setting `src`. Setting `src` first can cause these events to fire before the handlers are attached, resulting in frozen preloader spinners.

### 2. Double-Buffer Slideshow (DOM Memory Guard)
Chromium kiosk sessions running high-resolution (2K/4K) images can experience huge memory leaks if multiple slides linger in the DOM.
* **Architecture**: The screensaver uses a double-buffering scheme keeping **at most two slide elements** in the DOM (one active, one fading out). Preloading is done off-screen in memory. Do not refactor the slideshow to keep large arrays of images in the DOM.

### 3. Target Active Slides in Automated Integration/E2E Tests
* **Gotcha**: Because the slideshow uses cross-fades, the old slide remains in the DOM temporarily while fading out.
* **Rule**: When writing UI automation tests or selecting image elements, always qualify selectors with the active class (e.g. `.slide.active img`) to ensure you do not query an obsolete, transitioning-out element.

### 4. Atmospheric Weather & News Sentiment Alignment
The screensaver automatically maps live conditions and global sentiment to active wallpaper choices:
* Meteorological rain/snow overrides everything, forcing rainy or snowy wallpapers.
* If weather is clear, news sentiment RSS feeds are parsed: highly positive sentiment prioritizes sunny/golden wallpapers, while highly negative sentiment prioritizes stormy/rainy wallpapers.

### 5. API / Crawler Test Tolerance
* **Gotcha**: The crawler relies on keyless third-party APIs (Lexica, Bing, Wallhaven). Lexica can occasionally throw transient HTTP 500 errors.
* **Rule**: The integration test suite tolerates single crawler failures (e.g., Lexica 500) as long as backup crawler pools return at least one valid image, preventing the entire suite from failing due to external network instability. Do not disable or break tests due to transient endpoint errors.

### 6. Target Host Execution Only (Never Copy to Gateway)
* **Failed Assumption**: Attempting to run tests, build the client, or start server daemons locally on the gateway host environment (`filament`) instead of the target TV host (`playwright`).
* **Why it Fails**: The local gateway lacks graphical libraries, Wayland/X11 displays, Chromium dependencies, and the DBus session connections required by Mutter.
* **Rule**: Perform all edits through the sshfs mount, but execute all commands, tests, and server processes strictly on the `playwright` host (`alex@playwright`).


---

## 🧪 Verification & Diagnostics

To run the regression suite, run:
```bash
node run-tests.js
```

A local diagnostic utility script is available at `.agents/skills/lumina-diagnostics/scripts/diagnose.sh` to check port status, daemon status, Mutter DBus connection, and PulseAudio streams.
