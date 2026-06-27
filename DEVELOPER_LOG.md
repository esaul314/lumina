# 📖 Lumina Developer Log & AI Learnings Journal

This document serves as a public-facing, generic history of technical developments, architectural decisions, and key technical lessons learned. Any developer or visiting AI agent should read this file to understand why certain features were built in a specific way and to avoid repeating past mistakes.

---

## 📅 Technical Changelog & Milestones

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
