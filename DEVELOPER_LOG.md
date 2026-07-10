# 📖 Lumina Developer Log & AI Learnings Journal

This document serves as a public-facing, generic history of technical developments, architectural decisions, and key technical lessons learned. Any developer or visiting AI agent should read this file to understand why certain features were built in a specific way and to avoid repeating past mistakes.

---

## 📅 Technical Changelog & Milestones
### 2026-07-10: Socket Settings Transport Now Uses Shared Patch-State Decoders
- **Goal**: Start the next Phase 1 implementation-companion step by thinning `server/sockets.js` so the dashboard's durable socket settings stop owning their own mutation rules.
- **Implementation**:
  - Added a small functional patch-decoder toolkit in `server/domain/commands.js` built around curried field-patch builders plus `createStatePatchCommandDecoder(...)`, so socket adapters can express `build patch -> decode shared command` instead of hand-rolling transport-local updates.
  - Refactored `server/sockets.js` to use an object-shaped environment plus shared `createCommandListener(...)` / `listenForStatePatch(...)` helpers for widget toggles, theme, slideshow interval, scale/split controls, alignment toggles, vision config, and location settings.
  - Moved those socket events onto the same `patch-state` / `set-screensaver-active` command path the REST layer already uses, leaving Socket.IO in a thinner adapter role while preserving the old fallback behavior as a contained compatibility shim.
  - Expanded `server/domain/tests.js` with regression coverage for the new pure decoder builders, including valid shared-command composition and rejection of invalid enum/percent payloads.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the next checkpoint is explicit: continue shrinking the remaining category/photo/admin compatibility handlers in `server/sockets.js`.
- **Learning**: The cleanest way to thin a transport is not to add more transport branching, but to make decoding itself composable. Once socket events can be described as pure patch builders feeding the shared command decoder, the transport layer becomes wiring instead of business logic.
- **Verification**: `npm run lint` and `npm test` passed. The live smoke section still hit the known sandbox-only `listen EPERM` Unix-socket bind guard and was skipped as expected.

### 2026-07-09: Manual Vision Analysis Now Uses a REST-First Async Job Boundary
- **Goal**: Complete the next Phase 1 roadmap step by moving manual vision-analysis runs onto the same explicit REST-first async job flow already used for recrawls.
- **Implementation**:
  - Added `server/jobs/visionAnalysis.js` as a dedicated observable job shell for scoped manual vision-analysis runs, reusing the shared `job-status` transport with typed `vision-analysis` payloads.
  - Extended the domain command/effect surface with `trigger-vision-analysis` plus `start-vision-analysis-job`, so REST and the legacy socket shim dispatch the same async intent instead of owning separate background-analysis orchestration.
  - Upgraded `triggerImageAnalysisBackground(...)` in `server/app.js` to accept scoped categories, emit progress snapshots, fail fast when the Vision API is manually requested but not configured, and only refresh the active live feed when the analyzed categories actually affect it.
  - Added `POST /api/jobs/vision-analysis`, client REST helpers, and a new remote-control operator button/status panel so manual analysis is now queued through the REST job path and observed through Socket.IO progress updates.
  - Added coverage for the new decoder/reducer effect, the vision-analysis job service, and the REST route contract in `server/domain/tests.js`, `server/jobs/tests.js`, and `run-tests.js`.
- **Learning**: Once one operator-triggered background workflow has a clean REST job boundary, follow-up workflows should reuse that same command/effect language instead of treating “background work” as a special socket-only case. The transport stays simple when long-running work is modeled as a first-class job and Socket.IO is only the status stream.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. The live server smoke section still hit the sandbox-only `listen EPERM` guard and was skipped as expected.

### 2026-07-09: Manual Recrawls Now Use a REST-First Async Job Boundary
- **Goal**: Complete the next Phase 1 roadmap step by moving manual recrawls off the socket-owned mutation path and onto an explicit REST-first async job flow with live progress updates.
- **Implementation**:
  - Added `server/jobs/recrawl.js` as a small shell module that composes scope normalization, crawl execution, collection merge/persist, active-feed refresh, state broadcast, and background-analysis scheduling behind one observable job service.
  - Extended the shared domain path with a `trigger-recrawl` command plus `start-recrawl-job` effect so REST and legacy socket triggers now dispatch the same async intent instead of carrying duplicate crawl orchestration.
  - Rewired `server/routes.js` so `POST /api/jobs/recrawl` and `POST /api/pools/:name/crawl` enqueue recrawl jobs and return `202 Accepted` job snapshots, while `server/sockets.js` now acts as a backward-compatible shim that only dispatches the same command and relays job status.
  - Updated the remote UI to submit recrawls through the shared REST client and render live progress text from socket-pushed job updates instead of directly emitting `trigger-recrawl`.
  - Added reducer, job-service, and route coverage for the new async boundary in `server/domain/tests.js`, `server/jobs/tests.js`, and `run-tests.js`.
- **Learning**: Async operator actions should not bypass the shared command/effect language just because they are long-running. A small job shell lets REST own the durable intent while Socket.IO stays in its proper role as the observable status transport.
- **Verification**: `npm run lint`, `npm test`, and `npm --prefix client run build` passed. The network-bound live server smoke section was skipped in this sandbox because all listen attempts returned `EPERM`, but the new route contract is covered by direct handler invocation tests.

### 2026-07-09: Realigned the Product Roadmap and Functional Companion Wording
- **Goal**: Resolve the stale roadmap checkpoint and make the relationship between `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` unambiguous across the repo docs.
- **Implementation**:
  - Updated `ROADMAP.md` so Phase 1 Step 3 is marked complete instead of still listed as next.
  - Set the next product checkpoint to the remaining asynchronous operator-triggered REST migration work, starting with recrawl flows and live progress events.
  - Clarified in `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, `AGENTS.md`, and `README.md` that the functional refactor document is a supporting Phase 1 implementation track with its own local step numbering, not a separate product roadmap.
- **Learning**: Once a repo carries both a product roadmap and an implementation-companion roadmap, both documents need explicit scope labels. Otherwise, old step numbers are easy to misread as conflicting priorities instead of different layers of the same plan.

### 2026-07-06: Integrated TypeScript Migration Strategy into the Product Roadmap
- **Goal**: Update the Lumina product roadmap to include a detailed TypeScript migration plan and determine the most appropriate timing and scope for execution.
- **Implementation**:
  - Analyzed the codebase to determine the best phase for migration. Identified that migrating during Phase 1 (REST-first API migration) adds unnecessary churn, whereas migrating between Phase 1 and Phase 2 (as a transition bridge) is optimal because the API contracts and domain logic are stabilized.
  - Updated [ROADMAP.md](file:///home/alex/work/lumina/ROADMAP.md) to define a dedicated "TypeScript Migration (Transition Bridge)" stage.
  - Specified frontend migration scopes (Vite config, TSX conversion) and backend scopes (Node v22 `--experimental-strip-types`, domain conversions, `run-tests.js` updates).
  - Added specific criteria to the Acceptance Plan and updated Defaults rules.
- **Learning**: Implementing structural language migrations (like JavaScript to TypeScript) is most efficient when scheduled directly after major API and data model restructuring (Phase 1) is complete, preventing double-refactoring effort. Node v22's native type-stripping capabilities permit a lightweight transition without introducing heavy compile-step wrappers in production.

### 2026-07-05: Bypassed Test-Environment Crawls & Robust Photo Selection for Integration Suite
* **Goal**: Fix a regression in the integration tests where `POST /api/photos/prev` failed to return the expected preview photo.
* **Implementation**:
  * Identified that background dynamic crawlers were being triggered asynchronously during integration tests (when creating pools via `POST /api/pools`), which recomputed the feed and wiped out the temporary Picsum photo from `state.photosList`.
  * Bypassed the dispatcher's `run-crawler` effect when `process.env.NODE_ENV === 'test'` inside `server/domain/dispatch.js` to ensure test state remains undisturbed.
  * Discovered that the mock Picsum photo `https://picsum.photos/id/1025/1200/1800` was marked as `isBroken: true` in the git-tracked `curated_collections.json` database, causing it to be filtered out of sequential navigation.
  * Updated `run-tests.js` to dynamically select the first non-broken, non-banned photo from the pool for `samplePhotoUrl` instead of blindly taking index `0`.
* **Learning**: Background effects (like crawling) and disk persistence states from developer tests must be properly isolated under automated testing. Bypassing side-effect queues and writing robust fallback selectors keeps automated testing deterministic and fast.
* **Verification**: All 98 unit, domain, and integration tests passed cleanly in under 10 seconds.

### 2026-07-06: Optimize Vision Service Cache Initialization, Implement Circuit Breaker, and Isolate Tests
- **Goal**: Fix screensaver freezes and high CPU/swap thrashing caused by the background Vision Service loop attempting to process all 336 images on every daemon start when the local qwen3-vl API is offline/down, and prevent test runs from killing/interrupting the production kiosk browser.
- **Implementation**:
  - **Lazy Cache Init**: Modified [vision.js](file:///home/alex/work/lumina/server/services/vision.js#L8-L15) to use a `cacheInitialized` boolean flag, ensuring `analysis_cache.json` is read and parsed from disk exactly once per process lifetime instead of on every image evaluation (which previously caused 336 synchronous disk reads).
  - **Circuit Breaker**: Added a failure-counter circuit breaker in `triggerImageAnalysisBackground` inside [app.js](file:///home/alex/work/lumina/server/app.js#L320-L330). If 3 consecutive Vision API inference failures are encountered on cache misses, the background analyzer immediately aborts the loop, preventing 336 high-bandwidth image downloads and inference requests.
  - **Test Isolation Bypass**: Updated [system.js](file:///home/alex/work/lumina/server/services/system.js#L102-L272) to check `process.env.NODE_ENV === 'test'` and bypass real hardware CPU governor modifications, browser GUI spawns, and global process kills (which were executing `killall` and terminating the production TV screensaver browser).
- **Learning**: Background loops processing large datasets must be safeguarded with circuit breakers when hitting external/local microservices. Unbounded retry loops and redundant disk I/O block event loops and saturate swap spaces on low-resource hardware. Additionally, test suites running integration smoke checks must be strictly decoupled from the host system's hardware configurations and active user sessions to avoid unexpected side effects (such as terminating active processes).
- **Verification**:
  - Verified the `lumina` systemd service successfully restarted and logged the early abort after exactly 3 consecutive 404 inference failures.
  - Verified that running `node run-tests.js` no longer affects the production kiosk browser on `playwright`.
  - All 98 regression tests passed cleanly.

### 2026-07-05: Feed Category Active-State Rendering Now Follows Canonical Selected Categories
* **Goal**: Fix the remaining `Image Feeds` category-toggle regression where a tapped category could flash active on the initiating remote and then immediately appear inactive again.
* **Implementation**:
  * Extracted a small functional category-selection core in `client/src/state/categorySelection.js` to canonicalize aliases (`Liminal Space`/`AI Creation`), derive the active selection from `playback.selectedCategories` before falling back to older snapshot fields, and compose toggle operations against that canonical selection.
  * Updated `client/src/state/feedMutations.js` and `client/src/state/frameSelectors.js` so optimistic category patches and general snapshot normalization both reconcile `currentCategory`, `playback.selectedCategories`, and `currentFrame.context.categories` to the same canonical value.
  * Rewired `client/src/components/RemoteControl.jsx`, `client/src/components/remote/ImageFeedsTab.jsx`, and `client/src/components/Dashboard.jsx` to render and toggle category buttons through the shared selector helpers instead of directly splitting `state.currentCategory`.
  * Added regression coverage in `run-tests.js` for stale top-level category drift, alias normalization, snapshot reconciliation, and snapshot-driven category toggling.
* **Learning**: The real bug boundary was no longer “did the mutation succeed?” but “which category field does the client trust after several transport migrations?” Once multiple snapshot shapes coexist, active-state rendering must be derived from one canonical selector layer or harmless field drift turns into visible toggle flicker.
* **Verification**: `npm run lint` passed. `npm --prefix client run build` passed. The new client category regression assertions passed inside `npm test`; the suite still finishes with the pre-existing unrelated `POST /api/photos/prev reverses the direct-control sequence after next` failure.

### 2026-07-05: Image Feeds Toggles Now Patch the Initiating Remote Snapshot Optimistically
* **Goal**: Fix the `Image Feeds` regression where category and per-source enable/disable clicks could leave the initiating remote looking unchanged until a later sync or refresh.
* **Implementation**:
  * Added `client/src/state/feedMutations.js` as a small pure helper layer for category-selection normalization, toggle composition, feed-source config merges, and snapshot patch projection.
  * Updated `client/src/hooks/useLuminaActions.js` so `changeCategory(...)` and `updateFeedConfig(...)` apply those pure snapshot transforms immediately, then reconcile against the REST response or a fallback refresh if the request fails.
  * Rewired `client/src/components/RemoteControl.jsx` to build category toggles through the shared pure helper instead of ad hoc `split(',')` state juggling.
  * Added regression coverage in `run-tests.js` for category normalization/toggling plus feed-source config merge projection on the client snapshot layer.
* **Learning**: The REST/domain path was still correct; the gap was on the initiating client. If the remote waits entirely on a later sync to reflect a durable click, the UI can feel broken even though the write contract itself is sound. Small pure snapshot projections are the right boundary here.
* **Verification**: `npm run lint`, `npm --prefix client run build`, and `npm test` passed. The existing sandbox-only ephemeral localhost `listen EPERM` warning still appears in the smoke-test section without failing the suite.

### 2026-07-05: Direct Control Prev/Next Now Uses Deterministic Feed Navigation
* **Goal**: Fix the Direct Control `Prev/Next` controls so multi-feed navigation can round-trip back to the same image instead of sampling another weighted candidate.
* **Implementation**:
  * Added a pure circular feed navigator in `server/domain/selectors.js` that advances over the already-balanced `photosList` order with wraparound behavior and explicit fallback when the active photo is no longer in the feed.
  * Extended `advance-photo` commands with a small `strategy` discriminator in `server/domain/commands.js` / `server/domain/reducer.js`, keeping `smart` selection available for slideshow-style paths while routing the REST `/api/photos/next|prev` operator controls to deterministic `sequence` navigation.
  * Added regression coverage in `server/domain/tests.js` for multi-feed next/prev round-tripping and in `run-tests.js` for the REST next-then-prev path.
* **Learning**: `prev` cannot be modeled as “smart selection with a different flag” if the selector is still probabilistic. For operator navigation, the correct source of truth is the precomputed balanced feed order, not a fresh weighted pick.
* **Verification**: `npm test` passed successfully.

### 2026-07-05: Category, Pool, and Feed Configuration Controls Now Use REST Mutations by Default
* **Goal**: Complete Phase 1 Step 3 by moving category selection plus pool/feed-configuration writes off socket-only operator mutations and onto the shared REST/domain command path.
* **Implementation**:
  * Extended `server/domain/commands.js` and `server/domain/reducer.js` with pure pool lifecycle/config commands for add/delete, keyword updates, and per-source feed-config merges.
  * Rewired `server/routes.js` so `POST /api/state/categories`, `POST|PATCH|DELETE /api/pools`, and `PATCH /api/pools/:name/feed-sources/:source` all flow through the same reducer/dispatcher contract, preserving source-level feed-config merges instead of clobbering sibling fields.
  * Added dispatcher-backed crawler execution in `server/app.js` for `add-pool`, and updated `server/sockets.js` so the legacy socket events remain thin adapters over the same command shapes instead of carrying a second mutation implementation.
  * Updated `client/src/api/luminaClient.js`, `client/src/hooks/useLuminaActions.js`, `client/src/components/remote/ImageFeedsTab.jsx`, and `client/src/components/Dashboard.jsx` so operator category/pool/feed actions now call REST by default.
  * Expanded regression coverage in `server/domain/tests.js` and `run-tests.js` for pool command decoding, source-config merge behavior, `POST /api/state/categories`, and the dedicated feed-source patch route.
  * Updated `AGENTS.md` to mark Phase 1 Step 3 complete.
* **Learning**: Pool feed-config writes need source-level merge semantics. A shallow category-level merge is not transport parity because it silently drops sibling fields like `enabled` when only `subreddits` or `keywords` are being edited.
* **Verification**: `npm run lint` passed. `npm --prefix client run build` passed. `npm test` passed its functional/domain/API assertions; the long-standing sandbox-only ephemeral localhost `listen EPERM` warning still appears in the smoke section but does not fail the suite.

### 2026-07-05: Remote Durable State & Settings Controls Now Use REST Mutations by Default
* **Goal**: Continue Phase 1 by moving the remote's durable settings/state slice off socket-only mutations and onto `PATCH /api/state` plus `POST /api/state/screensaver`.
* **Implementation**:
  * Extended `client/src/api/luminaClient.js` with state mutation helpers and updated `client/src/hooks/useLuminaActions.js` so widget toggles, theme, slideshow interval, scale/split settings, weather/night alignment, vision config, fallback consent, location settings, excluded keywords, and screensaver activation all use REST by default.
  * Rewired `client/src/components/remote/SystemSettingsTab.jsx` to call the shared action layer instead of emitting those durable mutations directly over Socket.IO, and cleaned up the last Direct Control rating button that was still emitting `rate-photo`.
  * Added REST parity for location settings in `server/routes.js` by teaching `PATCH /api/state` about `autoLocation` and `manualLocation`, including weather refresh behavior, and broadened the screensaver route response to return the updated unified snapshot.
  * Updated roadmap and agent-facing docs to mark Phase 1 Step 2 complete and Phase 1 Step 3 as the next slice: categories, pools, and feed-config mutation migration.
* **Learning**: The clean boundary is becoming clearer now that two slices are in place. REST should own durable operator intent, while Socket.IO should remain for live push paths like `state-sync`, viewport reporting, crawler completion, and similar server-initiated events.
* **Verification**: `npm test` and `npm --prefix client run build` passed successfully.

### 2026-07-05: Remote Photo Controls Now Use REST Mutations by Default
* **Goal**: Take the first real Phase 1 roadmap step by moving the remote's photo-control slice off socket-only mutations and onto the existing REST surface, while keeping Socket.IO for live sync.
* **Implementation**:
  * Added a small typed-ish client REST wrapper at `client/src/api/luminaClient.js` for photo patching, previewing, advancing, and snapshot refreshes.
  * Updated `client/src/hooks/useLuminaActions.js` so photo rating, crop, pairing, preview, next/prev, and broken-photo marking use REST by default, then patch or refresh the initiating client's local snapshot directly instead of waiting for a socket round-trip.
  * Added `patchPhotoInSnapshot(...)` in `client/src/state/frameSelectors.js` so local crop/rating/pairing changes update `photosList`, active-photo pointers, and derived frame crop fields consistently.
  * Extended `server/routes.js` so `PATCH /api/photos` supports `preserveActive` parity for pairing edits and `POST /api/photos/preview` can preview photos from the active feed snapshot, including source-backed items that are not only present in curated collections.
* **Learning**: The first transport migration should target a slice where the server semantics already exist and tests already cover the domain surface. Photo controls fit that boundary well, but they still needed one client-side correction: REST mutations must update the initiating client directly, otherwise a socket disconnect still leaves the UI stale even though the write succeeded.
* **Verification**: `npm test` passed successfully.

### 2026-07-05: Product Roadmap Added for REST-First, Metadata, Sharing, and Sensor Work
* **Goal**: Capture Lumina's next major product and architecture phases in one tracked roadmap so future work stops drifting back toward socket-only mutations and ad hoc feature additions.
* **Implementation**:
  * Added `ROADMAP.md` as the repo's phase-based planning document, anchored on a REST-first backend API, a functional core / imperative shell direction, and three major delivery phases.
  * Aligned `README.md` with the current architecture reality by describing Lumina as a REST-first migration with Socket.IO reserved for live sync and low-latency events, and linked the new roadmap.
  * Corrected `AGENTS.md` wording so future agents see Socket.IO as the real-time transport rather than the long-term durable control surface.
* **Learning**: The repo already contains the server-side beginnings of this plan (`server/routes.js`, `server/domain/`, transport-parity tests), but the top-level docs were still describing Lumina as if Socket.IO were the primary integration boundary. That mismatch makes it too easy for future feature work to reintroduce transport drift.
* **Verification**: `npm test` passed successfully.

### 2026-07-04: TV Preview Resolution & Display Info Refactor & Adapter Filtering
* **Goal**: Move the best-effort TV preview resolution metadata off the actual TV-frame preview outlines onto the outer layouts (under section headings), and hide it completely if a real physical TV make/model cannot be resolved (e.g. generic name "display" or video converters like "VGA to HDMI").
* **Implementation**:
  * **Generic & Adapter Filter**: Updated `formatTvPreviewMetaLabel` in `client/src/components/RemoteControl.jsx` to match against generic words (`display`, `unknown`, `default`) and video adapters/converters (`vga to hdmi`, `hdmi to vga`, `adapter`, `converter`, `vga-`, `hdmi-`, `dp-`). If matched, it returns `null` to indicate no meta label should be rendered.
  * **Direct Control Relocation**: Removed the meta span overlay from the preview frame inside `client/src/components/remote/DirectControlTab.jsx`, and rendered it as an outer text layout just below the "TV Gesture Controller" section header.
  * **Image Feeds Relocation**: Removed the meta span overlay from all three states (loading, failed, loaded) of the preview frame in `client/src/components/remote/ImageFeedsTab.jsx`, and rendered it as an outer text layout below the "Independent Rating Deck" header.
* **Learning**: High-fidelity TV preview overlays can easily look cluttered if metadata captions are rendered on top of them. Placing metadata on the outer card layout and hiding it when it is generic/adapter-based yields a cleaner and more professional remote control interface.
* **Verification**: `npm test` and `npm --prefix client run build` passed successfully.

### 2026-07-04: Shared Detected TV Outline for Direct Control and Rating Deck
* **Goal**: Keep the remote previews honest by rendering the same automatically detected TV frame outline in both `TV Gesture Controller` and `Independent Rating Deck`.
* **Implementation**:
  * **Single TV-frame helper**: Added `client/src/components/remote/tvPreview.js` so remote preview surfaces share the same fallback aspect ratio and fit logic instead of each card carrying its own sizing assumptions.
  * **Detection confirmation path**: Kept `client/src/components/Dashboard.jsx` as the source of truth that reports `window.innerWidth` / `window.innerHeight`, with `server/sockets.js` persisting that live `tvViewport` snapshot for remotes.
  * **Rating deck parity**: Updated `client/src/components/RemoteControl.jsx` and `client/src/components/remote/ImageFeedsTab.jsx` so the rating deck preview uses the detected TV aspect ratio, renders inside the same outlined shell, and drives crop math from that frame rather than a fixed generic thumbnail box.
* **Learning**: A crop/rating preview is misleading even when the image itself is correct if the surrounding frame does not match the real TV viewport. The frame outline is part of the editing truth, not just decoration.
* **Verification**: `npm test` passed. `npm --prefix client run build` passed.

### 2026-07-04: Google Photos Category Selection Rehydrates the Active Pool
* **Goal**: Fix the `No photos in active pool to display` regression that appeared when selecting the `Google Photos` feed.
* **Implementation**:
  * **Shared external-feed support**: Extended the functional-core feed builder in `server/domain/selectors.js` so category selection can merge curated collections with source-specific external collections such as cached Google Photos items.
  * **Reducer and snapshot plumbing**: Updated `server/domain/reducer.js`, `server/domain/snapshot.js`, and `server/app.js` so the live dispatcher receives Google Photos cache rows as runtime `externalCollections` instead of treating `Google Photos` like a curated category with no backing list.
  * **Regression coverage**: Added domain tests in `server/domain/tests.js` proving that `buildBalancedFeed(...)` and `select-categories` both keep a Google Photos pool populated from external cache state.
* **Learning**: Category normalization was already permissive enough to accept `Google Photos`, but the pure recompute path only looked at curated collections. A category can be valid in the selector layer yet still collapse to an empty pool unless the feed source is represented explicitly in the shared state model.
* **Verification**: `npm test` passed. `npm run lint` passed. `systemctl --user restart lumina` succeeded. Live checks against `http://127.0.0.1:5000/api/config` and `http://127.0.0.1:5000/api/photos?category=Google%20Photos` showed `currentCategory: "Google Photos"` with `74` photos in the active pool.

### 2026-07-04: Google Photos Crop Persistence & Aspect-Preserving Preview Fix
* **Goal**: Fix three related Google Photos regressions: squished paired images in the `TV Gesture Controller` preview, Direct Control crop/scroll snap-back, and a non-working `Photo Crop/Zoom (Rating Deck)` slider.
* **Implementation**:
  * **Aspect-preserving proxy URLs**: Updated `server/services/googlePhotos.js` and `server/routes.js` so Google Photos proxy URLs no longer request server-side cropped landscape bytes by default. Explicit crop remains opt-in, but the normal rendering path now preserves the source aspect ratio.
  * **Unified metadata projection**: Extended `server/sockets.js` so `report-photo-metadata` and `set-photo-crop` use the same cache-backed Google Photos metadata path as pairing updates, instead of falling through the curated-collections reducer path that cannot see proxy-only photos.
  * **REST metadata parity**: Broadened the Google Photos branch in `server/routes.js` so crop updates (`cropPercent`, `cropPositionY`) and pairing flags can be patched through one declarative metadata payload, with crop validation still flowing through the existing decoder.
  * **Preview-dimension hygiene**: Updated `client/src/hooks/useImagePreloader.js` to cache `naturalWidth` / `naturalHeight` for preview math instead of relying on the looser `width` / `height` properties.
  * **Regression coverage**: Expanded `run-tests.js` to lock the new no-default-crop proxy contract while preserving an explicit crop opt-in path.
* **Learning**: For Google Photos, the remote preview and the live crop state are coupled through two independent truths: the actual proxied bitmap shape and the persisted per-image metadata. If either one falls back to a curated-only assumption, the operator sees either a squished preview or a crop value that snaps back after interaction.
* **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. `systemctl --user restart lumina` succeeded, `http://127.0.0.1:5000/api/config` responded afterward, and the live Google Photos normalization now emits proxy URLs without the `c=1` crop flag by default.

### 2026-07-04: Google Photos Pairing Toggle Persists Outside Curated Collections
* **Goal**: Fix the `Allow Side-by-Side Pairing` toggle when used on Google Photos items, where the switch appeared stuck in the `On` position.
* **Implementation**:
  * **Google Photos metadata helpers**: Extended `server/services/googlePhotos.js` with proxy-url id parsing plus focused helpers to merge cached metadata updates and project them back onto the live runtime snapshot.
  * **Socket fix**: Updated `server/sockets.js` so `set-photo-prevent-pairing` bypasses the curated-collections reducer path for Google Photos proxy URLs and persists the pairing flag directly into `google_photos_cache.json` while keeping the in-memory state in sync.
  * **REST parity**: Updated `server/routes.js` so `PATCH /api/photos` can apply a Google Photos pairing-only mutation through the same cache-backed path instead of silently missing the photo.
  * **Regression coverage**: Added cache-helper assertions in `run-tests.js` covering proxy id extraction, cached pairing metadata updates, and live-state projection.
* **Learning**: Per-image display metadata no longer belongs conceptually to only `curated_collections.json`. Source-specific feeds like Google Photos need the mutation path to target their own persistence store instead of assuming every editable image lives in the curated collections map.
* **Verification**: `npm test`, `npm run lint`, and `.agents/skills/lumina-diagnostics/scripts/diagnose.sh` passed. `systemctl --user restart lumina` succeeded and `curl http://127.0.0.1:5000/api/config` responded successfully afterward.

### 2026-06-30: Direct Control Pairing Toggle Preserves Focused Portrait Preview
* **Goal**: Make the `Allow Side-by-Side Pairing` toggle in Direct Control behave like an editable preview control instead of seeming to skip away from the portrait being adjusted.
* **Implementation**:
  * **Focused single-photo preservation**: Updated `server/domain/reducer.js` so a `set-photo-prevent-pairing` command can optionally preserve the targeted portrait as the active photo when pairing is turned off from a split view.
  * **Socket passthrough**: Extended `server/sockets.js` to forward the new `preserveActive` intent and keep the legacy fallback path aligned.
  * **Direct Control UX fix**: Updated `client/src/components/remote/DirectControlTab.jsx` so disabling pairing on the focused portrait requests that single-photo preservation instead of immediately collapsing back to the other half of the split frame.
  * **Regression coverage**: Added a reducer test in `server/domain/tests.js` proving that disabling pairing on the focused secondary portrait yields a single-image frame with that same portrait still active.
* **Learning**: In split portrait mode, metadata edits that change layout must preserve the operator's focused image when the intent is preview/editing, otherwise the toggle reads like a slideshow navigation action.
* **Verification**: `npm test` passed. `npm run lint` passed. `npm --prefix client run build` passed. The known sandbox-only `listen EPERM` log still appears inside the ephemeral localhost smoke section, but the suite exits successfully.

### 2026-06-29: Selector-Core Reuse & Declarative Feed Config Presets
* **Goal**: Make another ES6+/functional cleanup pass without sacrificing readability, and keep the JavaScript surface closer to the reducer/selector foundation that will later migrate to TypeScript.
* **Implementation**:
  * **Legacy app dedupe**: Refactored `server/app.js` so `combineFeedsBalanced`, `selectWeightedRandomPhoto`, `isTimeInSchedule`, and the smart-photo filter pipeline now reuse the shared implementations in `server/domain/selectors.js` instead of carrying parallel copies.
  * **Preset-driven config builder**: Reworked `server/config/state.js` so feed configs are assembled from a small keyword-source factory plus a frozen built-in override table, replacing the long category `if/else` ladder with a declarative `Object.fromEntries(...)` projection.
  * **Collection projection reuse**: Updated `server/config/collections.js` to reuse the immutable `updatePhotoInCollections(...)` selector helper and compact state-photo sync helpers instead of nested mutation loops.
  * **Regression coverage**: Added tests in `run-tests.js` covering declarative feed-config layering and legacy crop projection across `photosList` plus `activeSecondPhoto`.
* **Learning**: For Lumina, the cleanest “functional” move is often not adding more combinators or point-free wrappers, but collapsing duplicate implementations onto the existing pure selector layer. That reduces drift now and lowers the TypeScript conversion surface later.
* **Verification**: `npm test` passed. `npm run lint` passed. The known sandbox-only ephemeral localhost bind warning still appears in the smoke-test section, but the regression suite exits successfully.

### 2026-06-28 (Part 3): Persistent `systemd --user` Service Installation
* **Goal**: Stop relying on ad hoc manual launches for the TV host and make Lumina survive logout and reboot through `systemd`.
* **Implementation**:
  * Added a tracked service template at `systemd/lumina.service.template` rather than committing host-specific absolute paths directly into git.
  * Added `scripts/install-systemd-user-service.sh`, which resolves the current repo root, `node` binary, user, UID, and user config directory at install time, then materializes `~/.config/systemd/user/lumina.service`.
  * Updated `README.md` with `systemctl --user` installation and operations guidance.
  * Installed and enabled the user service on `playwright`, then enabled lingering for `alex` so the service stays available across logout/reboot.
* **Operational Result**:
  * `systemctl --user status lumina` reports the service active.
  * `curl http://127.0.0.1:5000/api/config` responds successfully.
* **Learning**: Because Lumina depends on the logged-in GNOME stack, Mutter DBus, PulseAudio/PipeWire, and kiosk browser launch behavior, a `systemd --user` service is the correct execution model; a root system service would be the wrong integration boundary here.
* **Verification**: `npm test` passed. The long-standing sandbox-only `listen EPERM` warning still appears in the ephemeral localhost smoke-test section, but all assertions passed and the real host service responds on port `5000`.

### 2026-06-28 (Part 2): Nullish-Safe Selector Defaults & Declarative Cleanup
* **Goal**: Make the selection and persistence layers more fluent and falsy-safe by using modern ES6+ operators where they improve both readability and behavior.
* **Implementation**:
  * **Selector cleanup**: Refactored `server/domain/selectors.js` to use `??`, `?.`, default parameters, and `Array.prototype.at()` in category normalization, weighted selection, split-frame derivation, and weather/news fallbacks.
  * **Night-percentage bugfix**: Replaced `nightPercentage || 50` with `nightPercentage ?? 50` in both the domain selectors and legacy `server/app.js`, so an explicit `0` percent night preference is no longer silently treated as `50`.
  * **Persistence codec cleanup**: Refactored `server/config/collectionsCodec.js` with destructuring, nullish-aware cloning helpers, and explicit fallback handling for persisted split crop values and manual location state.
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
  * **Secondary Preload Handling**: Updated the client-side preloader in `client/src/components/Dashboard.jsx` to track if the secondary photo loads successfully.
  * **Pruning and Fallback**: If the secondary photo fails to load, the client now emits a `mark-photo-broken` socket event using the secondary image URL to immediately flag and prune it from the collections, and falls back to rendering the primary photo as a fullscreen single slide (`addSingleSlide`).
* **Verification**: Verified that unit tests (`npm test`) and E2E integration tests (`node test_split_sync.js`) pass successfully.

### 2026-06-27 (Part 8): Optional Tumblr Tag Search via API Key
* **Goal**: Add Tumblr tag-based crawling without disturbing the existing zero-credential public-blog Tumblr source.
* **Implementation**:
  * **Optional authenticated crawler**: Added `fetchTumblrTaggedImages` in `server/services/crawler.js` using Tumblr's official `GET /v2/tagged` API. The crawler activates only when `TUMBLR_API_KEY` is present in the server environment; otherwise it logs a skip and returns an empty result safely.
  * **Feed config support**: Added a new `tumblrTags` source alongside existing `tumblr` blog crawling in the default feed config builders so built-in scenic pools can opt into curated tag queries without losing the legacy blog lists.
  * **Remote UI**: Extended `client/src/components/remote/ImageFeedsTab.jsx` with a new `Tumblr Tag Search` source card and inline operator guidance that the source requires `TUMBLR_API_KEY`.
  * **Regression coverage**: Added test coverage proving the tagged crawler is exported and safely no-ops when the API key is absent.
* **Verification**: `npm test` passed. In this sandbox, the live endpoint smoke sub-suite still logs `listen EPERM` when trying to bind an ephemeral localhost port, but the command exits successfully and the new Tumblr-tag assertions pass.

### 2026-06-27 (Part 8): Remove Google DeepMind Footer Attribution
* **Goal**: Remove incorrect footer attribution "POWERED BY GOOGLE DEEPMIND" from the Remote Control user interface.
* **Implementation**:
  * Modified `client/src/components/RemoteControl.jsx` to omit the "• POWERED BY GOOGLE DEEPMIND" string from the system info paragraph.
* **Verification**: Verified that all diagnostics and tests run successfully.

### 2026-06-27 (Part 9): Portrait Split Crop/Zoom Refinement & Touch Isolation
* **Goal**: Fix touchpad drag-to-crop vs. swipe-to-skip touch conflicts, reduce slider zoom response latency on the TV, add focus-based dual photo controls, and correct in-place slide check caching bugs.
* **Implementation**:
  * **Touch Isolation**: Called `e.stopPropagation()` in touchstart, mousedown, and touchend handlers on both single and split preview panes in `client/src/components/remote/DirectControlTab.jsx`, preventing drag gestures from triggering the parent swipe-to-skip controller.
  * **Focus-Based Controls**: Introduced a `selectedPhotoSide` state in `client/src/components/RemoteControl.jsx`. Tapping on either the Left or Right preview pane focuses that photo (highlighted by a glowing border), dynamically binding the zoom slider, rating deck, and pairing toggle below to it.
  * **Real-Time Responsiveness**: Reduced debounced socket emits from `200ms` to `30ms` on the Direct Control tab, and added a local crop range state with `30ms` throttled emits on the Image Feeds rating deck. Zoom changes now update the TV screen dynamically as you drag.
  * **Resolved In-place Check**: Updated the TV view slide-change check in `client/src/components/Dashboard.jsx` to compare resolved crop values rather than raw values, ensuring changes to global defaults (like `splitCropPercent`) are applied instantly.
* **Verification**: Verified successfully via automated unit tests (`npm test`) and Playwright E2E split sync tests (`node test_split_sync.js`).

### 2026-06-27 (Part 10): Standardized Secret Storage on `.env`
* **Goal**: Stop scattering secrets across `config.json`, sidecar JSON files, and ad hoc runtime paths by making `.env` the single secret store.
* **Implementation**:
  * **Central env helper**: Added `server/config/env.js` to load `.env`, read environment variables consistently, and persist updated keys back to the same file with quoted serialization.
  * **Config hardening**: Updated `server/config/configLoader.js` so secret-like keys in `config.json` are ignored with a warning instead of being treated as supported configuration.
  * **Credential migration**:
    * `USEAPI_TOKEN`, `TUMBLR_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NASA_API_KEY` are now read from `.env`.
    * Google Photos credentials no longer persist to `server/config/.google_credentials.json`; they are written to `.env` through the shared helper.
  * **Admin UI alignment**: Added a Tumblr API key field in `client/src/components/remote/SystemSettingsTab.jsx` and updated Google/UseAPI copy so the operator-facing UI reflects the `.env` policy.
  * **Documentation and examples**: Added a tracked `.env.example`, updated `README.md`, and removed secret fields from `config.json.example`.
  * **Regression coverage**: Added an env-helper unit test proving secret values are appended/replaced safely with quoted serialization.
* **Verification**: `npm test` passed. `npm run lint` passed cleanly. The existing smoke-test sandbox limitation still logs `listen EPERM` when binding ephemeral localhost ports.

### 2026-06-27 (Part 11): Direct Control Portrait Zoom Sync Hardening
* **Goal**: Make per-image zoom changes from the Direct Control slider show up immediately on the TV for split portrait layouts and stay persisted on the correct image.
* **Implementation**:
  * **Live photo resolution**: Updated `client/src/components/Dashboard.jsx` and `client/src/components/RemoteControl.jsx` to resolve crop metadata by image URL from the current frame, active photo pointers, and live feed list before falling back to stale slide snapshots.
  * **Split-frame crop refresh**: Hardened the dashboard's in-place active-slide crop refresh so paired portrait updates read from the resolved live secondary photo instead of whichever `activeSecondPhoto` object happened to be cached.
  * **Regression coverage**: Added a reducer test proving `set-photo-crop` updates flow through both the active portrait and its derived split partner frame metadata.
* **Verification**: `npm test` passed, including the new crop regression. `npm --prefix client run build` passed. In this sandbox, the existing live-endpoint smoke section still logs `listen EPERM` when it attempts an ephemeral localhost bind.

### 2026-06-28: Frame-Selector Cleanup for Zoom/Crop State
* **Goal**: Reduce the client-side state ambiguity around `activePhoto`, `activeSecondPhoto`, `photosList`, and `currentFrame` so zoom/crop rendering follows one consistent execution path.
* **Implementation**:
  * **Single client selector layer**: Added `client/src/state/frameSelectors.js` to normalize transport snapshots and expose helpers for current-frame lookup, split-layout detection, frame orientation, URL-based photo lookup, and effective crop state resolution.
  * **TV renderer cleanup**: Refactored `client/src/components/Dashboard.jsx` to drive active slide updates and rendered crop math from the frame selectors instead of mixing `activePhoto`, `activeSecondPhoto`, local orientation guesses, and feed scans.
  * **Remote control cleanup**: Refactored `client/src/components/RemoteControl.jsx`, `client/src/hooks/useActivePhotoSync.js`, and `client/src/hooks/useCropDrag.js` so the Direct Control tab resolves the focused image and crop values from the same frame-based selectors the TV uses.
  * **UI-path regression**: Updated `test_split_sync.js` so the integration test moves the actual Direct Control slider UI for both split portrait and single-landscape flows rather than bypassing the UI with a raw socket emit.
* **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. In this sandbox, `node test_split_sync.js` still exits after the known ephemeral localhost bind warning (`listen EPERM`) before producing usable browser-stage logs, so the UI-path assertions could not be fully observed here.
### 2026-06-29: Google Photos Picker API Migration
* **Goal**: Fix the 403 Forbidden errors when listing media items due to Google's deprecation of broad `photoslibrary.readonly` scopes on March 31, 2025, and transition to the secure, privacy-respecting Google Photos Picker API.
* **Implementation**:
  * **OAuth Scopes**: Updated scopes in `server/services/googlePhotos.js` to request `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
  * **Picker Session Manager**: Implemented `createPickerSession()`, `getPickerSession()`, `listPickerMediaItems()`, and `deletePickerSession()` to manage user-initiated photo picking sessions.
  * **Dynamic Redirect URI**: Modified `server/routes.js` to build `redirectUri` dynamically from `req.headers.host` for localhost SSH tunneling.
  * **Background Polling & Sync**: Added a background polling process in `routes.js` that checks for session selection completion, pulls the selected private photo metadata, updates the display feed, and cleans up the session resources.
* **Verification**: `npm test` passed successfully. Tested systemd service restarts and verified service is active.

### 2026-06-29: Google Photos Admin Preview Proxy Repair
* **Issue**: Google Photos items in the admin Image Feeds panel were showing "Source link is broken or restricted."
* **Root cause**:
  * The Picker sync layer was reading `item.baseUrl` even though the Picker API returns image data under `item.mediaFile.baseUrl`, so Lumina cached `url: "undefined=w2560-h1440-c"` entries in `server/config/google_photos_cache.json`.
  * Even with a valid Picker `baseUrl`, the browser cannot fetch Google Photos image bytes directly from CSS/`Image()` because the Picker guide requires the app to attach an OAuth bearer token when requesting that URL.
* **Fix**:
  * Refactored `server/services/googlePhotos.js` to normalize cached Google Photos items into Lumina-owned proxy URLs (`/api/google-photos/media/:id`), while storing the actual Picker `mediaFile.baseUrl`, MIME type, dimensions, and picker session id separately for server-side fetches.
  * Added a protected proxy route in `server/routes.js` that fetches the Google image bytes with the server's OAuth token and returns them to the browser as same-origin media.
  * Kept completed picker sessions instead of deleting them immediately so Lumina can rehydrate stale Google base URLs later instead of treating the initial cached response as permanent.
  * Persisted `GOOGLE_REFRESH_TOKEN` in Lumina's shared `.env` store and taught the service to mint a fresh access token on demand at startup, so Google Photos access now survives daemon restarts instead of living only in process memory.
  * Added regression coverage in `run-tests.js` for the nested `mediaFile` shape and the proxy URL contract.
* **Verification**: `npm test` passed. `npm run lint` passed. `systemctl --user restart lumina` succeeded and `GET /api/photos?category=Google Photos` now returns proxy URLs under `/api/google-photos/media/...`.

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

### 2026-06-29 (Phase 12): Proxy-backed Google Photos Exposed Two Separate Jump Loops
- **Issue**: After Google Photos started rendering on the TV again, the slideshow still appeared to "jump" rapidly as if many photos were broken or inaccessible.
- **Root Causes**:
  - `Dashboard.jsx` treated a slide as uninitialized unless `primaryPhoto.url.startsWith('http')`. That was accidentally true for older third-party feeds, but false for the new same-origin Google Photos proxy URLs (`/api/google-photos/media/...`), so the client kept re-fetching and re-randomizing the category.
  - Separately, the idle daemon loop in `server/app.js` combined `isAudioPlaying()` with `isSessionInhibited()`. Once Lumina launched its own Chromium kiosk, the running browser session could trip the inhibition check and make the daemon dismiss the kiosk it had just spawned, then relaunch it again on the next idle poll.
- **Fix**:
  - `Dashboard.jsx` now treats any truthy `primaryPhoto.url` as initialized instead of assuming valid slide URLs must begin with `http`.
  - `server/app.js` now only considers session inhibition when the kiosk browser is not already running, which stops Lumina from using its own kiosk session as a reason to tear itself down.
  - `server/services/system.js` also defaults Chromium back to a safer acceleration profile, with the more aggressive GPU flags available only through `LUMINA_CHROMIUM_ACCELERATION_PROFILE=aggressive`.
- **Verification**:
  - Live probe on `2026-06-29` showed the same `activePhoto.url` remaining stable across six 4-second samples on `Scenic Nature`.
  - After switching the live category back to `Google Photos`, the same proxy URL remained stable across six 4-second samples instead of rotating every few seconds.
  - `journalctl --user -u lumina` stopped showing the prior rapid `Spawning Fullscreen Kiosk Screensaver...` / `Dismissing Kiosk Browser...` oscillation after the service restart with the daemon fix.

### 2026-06-30 (Phase 13): Resolved Fullscreen Chromium Error Pages & Spurious Dismissals
- **Issue**: The HTPC would sometimes show a default Chromium connection error page full screen on the TV, and once displayed, the screensaver would not restart or recover automatically. Additionally, when the screensaver did launch, it would often immediately dismiss itself.
- **Root Causes**:
  - **Startup Race Condition**: When the server restarts (e.g. during a port collision), it takes up to 1 second to bind to the fallback port. Meanwhile, if the system is already idle, the Mutter daemon polls and spawns Chromium immediately, before the server is actually listening on the port.
  - **No Auto-Reload**: Chromium doesn't try to auto-retry page loads by default, leaving the error screen displayed indefinitely.
  - **Stuck Daemon State**: The launch callback in `launchChromiumKiosk` was broken. Normal exits (code 0) didn't call `onUnexpectedExit`, leaving `isBrowserRunning = true` stuck in the daemon. Post-launch crashes tried to run X11/Wayland startup fallbacks instead of just notifying the daemon.
  - **Synthetic mousemove Dismissal**: The TV dashboard listened to any `mousemove` event to dismiss the screensaver, but Chromium fires synthetic `mousemove` events when elements are mounted/updated in the DOM, causing immediate self-dismissal.
- **Fix**:
  - **Kiosk Launch Guard**: Added `server.listening` check in `app.js` to defer spawning the kiosk browser if the server is not yet fully listening.
  - **Auto-Reload**: Added `--enable-offline-auto-reload` to `BASE_CHROMIUM_FLAGS` in `system.js` so Chromium auto-retries on connection failures.
  - **Robust Exit Monitoring**: Refactored `launchChromiumKiosk` to run a clean launch sequence. Checked process running duration: if a process exits after >5 seconds (crashes or normal exits), call `onUnexpectedExit` directly.
  - **Synthetic Event Filter**: Added `lastMousePosRef` in `Dashboard.jsx` to store coordinates, ignoring `mousemove` events unless coordinates have actually changed.
- **Verification**:
  - All 77 unit and integration tests successfully passed.
  - Manually verified that the screensaver successfully handles manual activation, respects audio playing/movie guards, and filters out synthetic mouse moves.

### 2026-07-03 (Phase 14): Direct Control Preview Now Uses the TV's Real Viewport
- **Issue**: The `TV Gesture Controller` preview on the remote used the full swipe-pad aspect ratio, which is wider than the actual TV viewport on the phone-sized card. That made the preview show misleading side borders and made crop/zoom adjustments harder to judge.
- **Fix**:
  - `Dashboard.jsx` now reports the live TV viewport size (`window.innerWidth` / `window.innerHeight`) back to the server after mount and resize.
  - `server/sockets.js` stores that ephemeral `tvViewport` payload in live state and broadcasts it to remotes.
  - `RemoteControl.jsx` now fits the preview into a traced inner TV frame using the reported aspect ratio, with `16:9` only as fallback before the TV reports in.
  - `DirectControlTab.jsx` renders the active image inside that centered frame instead of stretching it across the entire gesture pad, and the crop drag math now targets the traced frame height rather than the wider outer card.
- **Verification**:
  - `npm test`, `npm run lint`, and `npm --prefix client run build` passed.
  - Restarted the real `systemd --user` `lumina` service on `playwright`; `systemctl --user is-active lumina` returned `active`.
### 2026-07-04 (Phase 15): Refactored TV Preview Resolution Labels, Layout Cleanups, and Enhanced Diagnostics
- **Issue**:
  - The TV-frame previews had a resolution note overlaid directly on the picture preview, cluttering the UI. The word "display" was used generically when HDMI device make/model couldn't be resolved, and the swipe instructions on the TV Gesture Controller pad had a heavy dark gradient and bouncing icons.
  - The diagnostic check script `/scripts/diagnose.sh` was unable to detect running chromium processes correctly on the TV host due to a pattern matching only `chrome` instead of `chromium-browser` or `chromium`.
- **Fix**:
  - **Resolution metadata**: Refactored `formatTvPreviewMetaLabel` in `RemoteControl.jsx` to return `null` if generic display names (such as "display", "unknown", "default", adapters, or raw port names) are found. If display info has a valid vendor or model name, it formats the make/model and resolution dimensions.
  - **Layout Refactor**: Moved the resolution note off the TV preview frame onto the card's outer subtitle layout in `DirectControlTab.jsx` and `ImageFeedsTab.jsx`.
  - **Gesture pad updates**: Removed the dark gradient overlay and bouncing icon from the TV Gesture Controller pad. Placed the `swipeStatus` instructions underneath the swipe pad for a cleaner look.
  - **Diagnostics & Health checks**: Replaced `pgrep -f "chrome.*kiosk.*mode=tv"` in `diagnose.sh` with `pgrep -f "chrom.*(kiosk|mode=tv)"` and filtered out search utility processes, enabling accurate detection of active `chromium-browser` processes. Added checks to verify the installation of `chromium`/`chromium-browser` and verify the presence/accessibility of the active Wayland display socket `/run/user/1000/wayland-0`.
- **Verification**:
  - All 84 unit and integration tests passed.
  - Diagnostics script ran successfully, verifying the correct active status of the Wayland socket and path availability.

### 2026-07-05 (Phase 16): Documentation Overhaul & Local Screensaver Previews Added
- **Goal**: Bring the main project `README.md` fully up to date with the actual features and backend behaviors, and add local screenshots for direct visual reference.
- **Changes**:
  - Downloaded high-resolution screenshots of the TV weather display dashboard and the mobile remote control interface directly into the repository under a new `screenshots/` directory.
  - Overhauled `README.md` to feature the two local screenshots side-by-side.
  - Updated the Features section to cover Reddit crawls, Lorem Picsum, Bing Image of the Day, the Lexica/Wallhaven fallback AI creation aggregation, and detailed weather-news sentiment alignment logic.
  - Documented mobile remote control updates (swipe pad, system switchboard, mood themes) and Chromium kiosk acceleration profiles (Wayland display resolution, max V8 space size).
- **Verification**:
  - Commits were structured clean and conventional: `docs(readme): overhaul features, architecture, and add screenshots`.
  - Verified files and relative links to `screenshots/remote_control.png` and `screenshots/tv_dashboard.png`.

### 2026-07-07 (Phase 17): Refactored `server/routes.js` Into a Functional HTTP Adapter
- **Goal**: Make `server/routes.js` read like an intentional functional adapter instead of a mixed transport/domain module.
- **Changes**:
  - Replaced the old positional route-registration call with an object-based environment contract, keeping route dependencies grouped by concern instead of argument order.
  - Added shared higher-order route helpers in `server/routes.js` for async routes, single-command routes, and sequential batch-command routes, so the recurring `decode -> dispatch -> present` flow is expressed once.
  - Removed the route-local balanced-feed/category-selection implementation and now build HTTP photo responses through `server/domain/selectors.js`, including Google Photos via `externalCollections`.
  - Added `decodeStatePatchCommand` plus a reducer-backed `patch-state` command so `PATCH /api/state` no longer mutates legacy state inline. Weather refresh now flows through a reducer effect interpreted by `server/domain/dispatch.js`.
  - Collapsed the photo-next/photo-prev handlers into one partially applied factory and moved photo/pool patch batching onto sequential command dispatch instead of ad hoc inline branching.
  - Added domain tests for the new state-patch and screensaver decoders/reducer path, and route smoke coverage for raw-state `PATCH /api/state` responses plus combined `PATCH /api/photos` batching.
- **Learning**:
  - The real FP win was not inventing more small helpers inside the route file; it was deleting route-owned business rules and making the route layer structurally incapable of performing domain mutations outside the reducer.
  - Sequential batch dispatch is the safer default for Lumina command routes because command order matters, and `Promise.all` hides stateful coupling instead of reducing it.
- **Verification**:
  - `npm test` passed.
  - `npm run lint` passed.

### 2026-07-07 (Phase 18): Added Functional Refactor Roadmap Artifact
- **Goal**: Capture the next architectural cleanup sequence in one dedicated artifact that explicitly states Lumina's functional programming objectives and the intended order of refactors.
- **Changes**:
  - Added `FUNCTIONAL_REFACTOR_ROADMAP.md` at the repository root.
  - Documented the coding philosophy, conventions, style rules, and objectives for the refactor program, with explicit bias toward composition, currying, partial application, pure reducers/selectors, and explicit effects.
  - Expanded the roadmap into a step-by-step sequence, starting with `server/sockets.js`, then the remaining domain command surface, `server/app.js`, the command/effect pipeline, the client control surface, and the TypeScript-ready boundary pass.
- **Learning**:
  - The roadmap needed its own artifact instead of being merged into the product roadmap because the product roadmap answers "what Lumina should become," while this artifact answers "how the code should be reshaped to get there cleanly."

### 2026-07-09 (Phase 19): Cross-linked the Global Roadmap to the Functional Refactor Roadmap
- **Goal**: Make the engineering cleanup track discoverable from the main roadmap without collapsing product planning and refactor planning into one document.
- **Changes**:
  - Updated `ROADMAP.md` near the top with an `Implementation Companion` section linking to `FUNCTIONAL_REFACTOR_ROADMAP.md`.
  - Clarified that `ROADMAP.md` remains the product/platform direction document, while the functional roadmap carries the ordered refactor sequence and coding philosophy for the architecture cleanup program.

---

## 🧪 Verification & Diagnostics

To run the regression suite, run:
```bash
node run-tests.js
```

A local diagnostic utility script is available at `.agents/skills/lumina-diagnostics/scripts/diagnose.sh` to check port status, daemon status, Mutter DBus connection, and PulseAudio streams.
