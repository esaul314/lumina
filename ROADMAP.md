# Lumina Product Roadmap

Last updated: 2026-08-21

## Implementation Companion

For the code-shaping program that supports this roadmap, see [FUNCTIONAL_REFACTOR_ROADMAP.md](./FUNCTIONAL_REFACTOR_ROADMAP.md).

- Use this product roadmap for platform direction, phase goals, and acceptance criteria.
- Use the functional refactor roadmap for the ordered engineering cleanup sequence, coding philosophy, and transport/domain refactor plan.
- Treat the functional refactor roadmap as a supporting Phase 1 implementation track inside this roadmap, not as a separate product roadmap with its own platform phases.

## Execution Status

Phase 1 is in progress. The current checkpoint is:

- Done: Step 1. Remote photo-control mutations are REST-first by default.
- Done: Step 2. Remote durable state/settings mutations are REST-first by default.
- Done: Step 3. Category, pool, and feed-configuration mutations now use REST by default in the operator UIs.
- Done: Step 4. Manual recrawl flows now start on the REST command path and publish live job status over Socket.IO.
- Done: Step 5. Manual vision-analysis runs now start on the REST command path and publish live job status over Socket.IO.
- Done: implementation companion Step 3. `server/app.js` now delegates active-feed refresh, environment refresh, kiosk/browser lifecycle, and idle-daemon orchestration to dedicated runtime modules.
- Next: continue the Phase 1 implementation companion with Step 4, focused on extending the new reducer-local combinators, shared dispatch-route shell, dispatcher readability patterns, route-decode algebra, and declarative listener/command specs only where they remove real repeated command/effect ceremony. The latest slices collapsed the remaining standalone REST single-command registrations in `server/routes.js` onto one local method-aware spec table, collapsed the remaining socket command-listener registration ceremony onto one shared listener-family table in `server/domain/commands.js`, aligned the overlapping pool keyword/feed-config REST patch specs with their durable socket command specs through one shared pool transport family, collapsed the remaining photo/pool patch transport shapers in `server/domain/commands.js` onto one shared builder, collapsed the remaining ad hoc simple config/runtime setter branches in `server/domain/reducer.js` onto one shared field-entry interpreter, interpret reducer effects through an ordered promise-reduce pipeline, reuse that same small sequential async reducer for ordered REST command batches, express route-decode collection as a pure short-circuiting reduction with an explicit empty-success identity, and share the route-presence guard algebra across pool and photo resource checks. The broader Step 4 readability pass remains active and intentionally selective; future work should continue only where repeated command/effect ceremony is still materially clearer as shared data or small interpreters than as explicit route or reducer code.
- In parallel: continue the Phase 1 implementation companion track in [FUNCTIONAL_REFACTOR_ROADMAP.md](./FUNCTIONAL_REFACTOR_ROADMAP.md), where Steps 1 through 3 are complete and Step 4 is the active refactor checkpoint.
- Latest Step 4 slice: effect and event interpretation now use the same closed indexed interpreter as reducer families, so unknown and inherited effect/event keys remain silent no-ops without open object-property dispatch.
- Latest Step 4 slice: effect and event interpretation now share a small closed handler-record interpreter over the indexed vocabulary helper, removing duplicate lookup setup while preserving silent unknown and inherited-key behavior.
- Latest Step 4 slice: the Socket.IO command-family adapter now uses that same closed handler-record interpreter, so state-patch, durable-command, async-job, and secret-save specializations remain declarative while unknown and inherited family keys retain their identity fallback.
- Latest Step 4 slice: the REST-first client API now shares one higher-order 404 fallback adapter across category, screensaver, async-job, and admin-secret mutations, keeping mixed-version Socket.IO compatibility as explicit transport metadata while preserving non-404 failures.
- Latest Step 4 slice: the client Socket.IO photo-update handlers now share one pure side-aware snapshot projection, keeping primary and secondary frame updates immutable while removing duplicate legacy/canonical state synchronization.
- Latest Step 4 slice: the remote UI now projects recrawl and vision-analysis job events through one pure status algebra, so one Socket.IO listener applies the shared queued/running/completed/failed semantics while job-specific React targets remain explicit.
- Latest Step 4 slice: recrawl and vision-analysis services now share one declarative async-job lifecycle interpreter for scope normalization, progress merging, active-run reuse, terminal status, and error projection while their crawler/analyzer execution and legacy event policy remain explicit.
- Latest Step 4 slice: the mixed-version Socket.IO compatibility adapter now shares one higher-order pool-mutation shell for existence checks, persistence, and state broadcasts while keyword, feed-config, and policy updates remain explicit.
- Latest Step 4 slice: the mixed-version Socket.IO photo compatibility adapter now shares one higher-order curated-mutation broadcast shell, while Google Photos metadata, active-photo recovery, and broken-photo no-op policy remain explicit.
- Latest Step 4 slice: dispatcher effects and events now share one closed typed-handler invoker, while their distinct sequential result and emission algebras remain explicit.
- Latest Step 4 slice: environment-secret runtime flags now cross a pure normalization projection before the dispatcher shell assigns them, preserving boolean coercion and effect behavior while keeping input shaping deterministic and independently testable.
- Latest Step 4 slice: feed, pool, and playback reducer builders now share one higher-order payload boundary for invalid-command no-ops, while their distinct mutation, selection, and finalization rules remain explicit.
- Latest Step 4 slice: route-decode collection and route-guard evaluation now share one curried short-circuit reducer, keeping the decode algebra and guard predicates explicit while avoiding duplicate early-exit reduction ceremony.
- Latest Step 4 slice: the pool-photo read route now reuses the shared pool-presence guard, so pool resource failures have one route-level result shape across read and mutation paths while the successful collection response remains unchanged.
- Latest Step 4 slice: state and feed mutation reducers now share one higher-order clone/apply/unchanged boundary, keeping changed-state continuations explicit while removing duplicate no-op ceremony.
- Latest Step 4 slice: state and feed mutation reducers now share one pure result-builder boundary for resolving events/effects and prepending persistence, while feed-specific recomputation context remains explicit.
- Latest Step 4 slice: patch-state mutations now reuse the same pure result builder, preserving state-sync selection and `persist` before optional weather refresh effects while keeping patch recomputation explicit.
- Latest Step 4 slice: feed mutations and `patch-state` now share one pure `recompute -> ensure active photo` continuation, keeping visibility changes and active-photo recovery aligned while preserving each command's own flags and result policy.
- Latest Step 4 slice: photo-library mutations now reuse the same pure result builder as ordinary state, feed, and patch mutations, preserving photo-specific event selection and source-local persistence effects while removing the final duplicate result assembly.
- Latest Step 4 slice: active-photo rating and broken-photo mutations now reuse the shared `recompute -> ensure active photo` continuation already used by feed and patch mutations, preserving immutable recovery and one consistent transition boundary.
- Latest Step 4 slice: `patch-state` spec writers now return immutable next-state values and accumulate change flags through a pure context step, preserving no-op identity and patch result ordering while making the declarative patch pipeline easier to compose and test.
- Latest Step 4 slice: environment read routes now share one higher-order async JSON/error boundary, while each endpoint keeps its own response projection, status, and public error message explicit.
- Latest Step 4 slice: the weather read route now uses that same async JSON/error boundary, with cached reads, injected weather effects, and pure public response projection kept explicit.
- Latest Step 4 slice: environment-settings persistence now uses the same async JSON boundary with a pure validation hook, preserving its distinct 400 validation response and 500 service-failure contract.
- Latest Step 4 slice: photo mutation specs now derive the immutable in-memory update and source-local persistence metadata from one pure normalized patch, while active-photo recovery and transport-specific persistence remain explicit.
- Latest Step 4 slice: environment-history export now reuses the shared async route shell for both JSON and CSV responses, keeping format-specific presentation explicit while consolidating error handling.
- Latest Step 4 slice: the Google Photos media proxy now reuses the shared async route shell, keeping binary headers, dimension normalization, and its 502 failure projection explicit.
- Latest Step 4 slice: the Google Photos OAuth callback routes now reuse a small higher-order async error adapter, keeping authorization validation, picker synchronization, redirects, and route-specific failure text explicit.
- Latest Step 4 slice: Socket.IO command and transport listeners now share one async error-boundary runner, while command context, telemetry behavior, and Google Photos refresh acknowledgements remain explicit.

### Photo timestamp foundation (2026-07-31)

- Done: newly accepted crawler photos receive a canonical per-photo `addedAt`
  ISO timestamp.
- Done: persisted photo timestamps are normalized and malformed values are
  discarded without inventing dates for legacy photos.
- Done: legacy snapshot-level `lastUpdated` and `lastFeedUpdated` fields remain
  separate from per-photo acquisition timestamps.
- Next: use `addedAt` as the basis for an explicit, tested age-retention policy
  after the pool-size admin control is implemented. Legacy photos without
  `addedAt` must remain exempt from age-based pruning until a deliberate
  backfill policy exists.

### Pool lifecycle controls (2026-07-31)

- Done: the Image Feeds admin surface now exposes per-pool retention days and
  maximum photo count controls through the shared pool REST command path.
- Done: recrawls prune dated, non-loved photos past the configured age and cap
  each pool with its configured maximum; loved photos and legacy undated photos
  remain protected.
- Next: add optional lifecycle previews and a deliberate legacy-date backfill
  workflow only if operationally useful.

### Scheduled pool activation (2026-08-18)

- Done: pools can be assigned recurring daily local-time activation windows,
  including overnight windows such as 22:00–06:00.
- Done: overlapping schedules resolve deterministically by explicit priority,
  with category-name ordering as the stable tie-breaker.
- Done: scheduled activation uses the shared category-selection command path,
  persists with the existing pool policy snapshot, and restores the previous
  selection when the active window ends.
- Done: manual category selection temporarily overrides an active schedule
  until the next schedule boundary.
- Next: consider weekday filters, exceptions, and a configurable timezone only
  if recurring daily host-local schedules prove insufficient.

Implementation note (2026-07-22): the latest Step 4 slices route simple, photo, feed, pool, playback, and `patch-state` commands through one reusable indexed interpreter with explicit `now`/`rng` environment adapters, centralize feed/pool reducer option resolution, and capture the dispatcher effect interpreter once before its promise-reduce sequence. Unsupported and inherited object keys, plus unhandled effects, remain unchanged/no-op boundaries.

## Architectural Rule

Lumina should continue moving toward one stable integration boundary:

- The backend REST API is the primary control surface for both the local app and the future public-sharing service.
- Socket.IO should shrink to live sync, push notifications, TV viewport/reporting, and low-latency playback events.
- The codebase should keep moving toward a functional core / imperative shell split with pure reducers, selectors, codecs, and transport adapters.

## Optional Feature Candidate

### Minimal display mode

The feasibility work in [docs/MINIMAL_MODE_FEASIBILITY_PLAN.md](./docs/MINIMAL_MODE_FEASIBILITY_PLAN.md)
describes a possible optional low-power TV presentation runtime. It is not a
committed phase or a replacement for Chromium: it should remain behind an
explicit feature flag and proceed only if a real-host presenter spike proves
measurable CPU/memory savings, visual sufficiency, and reliable recovery. The
canonical state, selectors, metadata, and persistence layers should remain
shared if this feature is pursued.

## Current Baseline

The codebase already contains part of this direction, but Phase 1 is not complete yet.

- `server/routes.js` exposes REST endpoints for state, photos, pools, weather, and screensaver control.
- `server/domain/` already holds shared command decoding, reducers, selectors, and snapshot logic used by both REST and Socket.IO for part of the mutation surface.
- `client/src/hooks/useLuminaActions.js` is now REST-first for remote photo controls, durable state/settings controls, and category/pool/feed-config operator actions.
- `server/sockets.js` now acts as a thin transport adapter over shared command listeners, while the optional mixed-version fallback business logic lives separately in `server/socketLegacyCompatibility.js`.
- The live socket layer still intentionally owns connection lifecycle, viewport/reporting telemetry, transient push updates, and the on-demand Google Photos signed-URL refresh helper.
- Source-specific metadata persistence now exists for Google Photos, which reinforces the broader rule that metadata should live at the correct source boundary and then be projected back into the live snapshot.

## Phase 1

Goal: make Lumina locally coherent, transport-clean, and ready for richer metadata and external consumers.

### REST-first core

- Finish the REST-first interaction model.
- Frontend reads state from REST snapshots and writes state through REST mutations by default.
- Keep Socket.IO for `state-sync`, playback push events, TV viewport/reporting, and real-time status only.
- Replace socket-centric action helpers with a typed frontend API client plus a thinner live-sync layer.
- Current checkpoint:
  - Step 1 complete: remote photo-control mutations use REST by default.
  - Step 2 complete: remote durable state/settings mutations use REST by default.
  - Step 3 complete: categories, pools, and feed-config mutations now use REST endpoints and shared domain commands by default.
  - Step 4 complete: manual recrawls are queued through REST-first async jobs with socket-pushed progress/status events.
  - Step 5 complete: manual vision-analysis runs are queued through REST-first async jobs with socket-pushed progress/status events.
  - Next focus: Steps 1 through 3 of the implementation companion are complete; the active companion work is now Step 4's command/effect readability pass across the shared reducer, shared dispatch-route shell, dispatcher boundaries, route-decode composition layer, and socket listener registration boundary, with photo/config/pool/feed/playback helpers, guarded REST shells, decode-aware photo routes, keyword-spec normalization, dispatcher-local effect sequencing, shared route-decode combinators, declarative socket listener specs, reducer specs for simple setters/effects, photo-library mutations, feed mutations, shared transport command-decoder specs, shared photo/pool patch decoder-spec pipelines, shared pool-command reducer specs, shared playback-selection reducer specs, shared durable socket state-patch specs, shared durable socket command/async-job/secret spec tables, shared REST admin-secret/async-job/advance route specs, shared cross-transport family spec generators for those same admin-secret/async-job/advance families, a shared `patch-state` contract module, declarative `patch-state` reducer applier specs, shared REST photo/pool patch command-spec rows, permanent-collection loved-photo metadata flowing through that same shared path while crawler caps exempt loved items from the standard rotating-pool limit, shared photo-mutation transport specs that keep the REST photo patch table and durable socket photo command table aligned without flattening the intentional loved-versus-metadata transport split, shared pool-mutation transport specs that keep pool keyword and feed-config patch decoding aligned across REST and durable socket listeners, one local method-aware route-spec table for the remaining standalone REST single-command registrations in `server/routes.js`, one shared socket listener-family table that covers state-patch, durable-command, async-job, and secret-save registration through one small interpreter in `server/sockets.js`, one shared patch-transport builder that shapes both the photo and pool patch families while preserving route-only loved-photo patches, socket-only metadata reporting, and dynamic feed-config route expansion, and now one shared field-entry reducer shell that keeps the remaining simple config/runtime setters on the same explicit `assign fields -> maybe persist -> maybe emit effect` boundary. The remaining work should stay limited to future seams that still show real repeated ceremony.

### Shared domain flow

- Route every user-visible mutation through shared command decoding plus reducer/dispatcher logic.
- Remove legacy route/socket branches that still mutate state directly, except for host-IO-specific plumbing.
- Keep transport-parity tests so REST and Socket.IO adapters continue to produce the same command semantics during the migration window.
- The ordered cleanup sequence for this Phase 1 implementation workstream lives in [FUNCTIONAL_REFACTOR_ROADMAP.md](./FUNCTIONAL_REFACTOR_ROADMAP.md); its step numbering is local to that companion artifact.

### Metadata foundation

- Introduce canonical `rating: null` for unrated assets.
- Add configurable effective-selection policy without overwriting stored `null`.
- Keep `1` as banned or broken and explicit numeric scores as the only true human ratings.
- Extend image metadata to support:
  - acquisition timestamp (`addedAt`)
  - human rating
  - AI-derived tags and keyword matches
  - exclusion or mismatch signals
  - optional description or caption
  - provenance and source flags
  - visibility and share eligibility

### Advisory AI metadata

- Store detected concepts, confidence, and mismatch warnings as advisory metadata.
- Keep human ratings and exclusions authoritative unless explicit automation is added later.
- Treat vision-generated descriptions the same way: persisted metadata first, optional policy later.

### Local platform work

- Add blue light filter as a first-class display setting in backend state and client rendering.
- Add a background job subsystem for recrawls, vision analysis, later AI generation, and sensor polling or ingestion.
- Add a typed frontend API client as the transport boundary for the remote UI.

### TypeScript Migration (Transition Bridge)

Convert the stabilized local codebase to TypeScript to build a bulletproof type contract before expanding into Phase 2's public services and third-party sensors.

- **Frontend Migration**:
  - Configure `tsconfig.json` in the Vite client.
  - Rename `.js`/`.jsx` files to `.ts`/`.tsx`.
  - Type-safe React components, canvas bokeh particle engine, state selectors, and hooks.
  - Integrate type definitions for Socket.io-client.
- **Backend Domain Migration**:
  - Convert `server/domain/` from JSDoc `@ts-check` JS files to native `.ts` files.
  - Establish compile-time validation for the command reducer, selectors, and state models.
- **Backend Service & Daemon Migration**:
  - Configure Node.js TS execution using Node v22's native type stripping (`--experimental-strip-types`) with appropriate package script configurations, or standard transpilation if required for tooling compatibility.
  - Ensure the regression test runner (`run-tests.js`) and integration tests are updated to support TypeScript imports without breaking the zero-dependency execution model.

## Phase 2

Goal: make Lumina socially extensible and context-aware without mixing public and private data.

### Public sharing service

- Build a separate first-party online service that connects to Lumina instances through an API.
- Support public pools, feed definitions, public image ratings, public image metadata, and shared collection import or export.
- Base the service on Phase 1 export/import and metadata contracts.

### Privacy boundary

- Do not publish Google Photos content.
- Do not publish local secrets, tokens, or private host/runtime configuration.
- Merge shared ratings and descriptions by stable public asset identity only for share-eligible assets.

### Review workflows

- Add unrated-content workflows such as needs-review filters, bulk review flows, and coverage reporting.
- Add publish-facing AI review that surfaces keyword mismatches, exclusion warnings, and missing descriptions before publish.
- Persist generated descriptions for analyzable public-safe items, but only expose them publicly for non-private assets.

### Local sensor platform

- Initial Ecowitt GW1200 adapter slice is implemented: normalized indoor readings are available through a read-only API and an intentionally subordinate weather-card presentation, with stale fallback and independent outdoor-weather behavior.
- Add a normalized local sensor platform with Ecowitt as the first adapter.
- Ingest local-device readings through a general adapter model rather than device-specific UI wiring.
- Done: normalized GW1200 readings are recorded as one latest snapshot per UTC hour in the local `sensor_history.db` SQLite database, with outdoor Open-Meteo fields included when available.
- Done: history is exposed through `GET /api/environment/history` and CSV/JSON export through `GET /api/environment/history/export?format=csv` (with `/api/environment/export` as a short alias) for Grafana integration and direct downloads.
- Done: rolling day/night temperature and humidity aggregates are exposed through `GET /api/environment/history/stats` with bounded day-window parameters.
- Done: each hourly history row preserves the complete Ecowitt `get_livedata_info` payload under `gateway_metrics`, so optional rain, wind, UV/light, lightning, air-quality, soil, leaf, leak, distance, and multichannel sensor blocks are retained without schema changes.
- Done: introduced a general capability-aware sensor adapter platform; Ecowitt GW1200 is now the first registered adapter rather than the platform contract itself, with adapter discovery at `GET /api/environment/adapters`.
- Have widgets consume normalized sensor records plus source/device capability metadata.

## Phase 3

Goal: expand Lumina from a static-photo ambient display into a broader media engine.

### Rich playback

- Add video playback before AI image generation.
- Start with long-form ambient video sources such as fireplace, nature, and walking loops.
- Model video as a first-class media type rather than a photo-source hack.

### Generative media

- Add AI image generation on demand after the playback model is stable.
- Treat generated images as another provider class with prompt, settings, moderation, and provenance metadata.
- Persist generation metadata separately from human ratings.

### Platform reuse

- Reuse the background job subsystem for video refresh, vision analysis, public publishing/import, AI generation, and sensor polling.
- Keep widget consumers adapter-agnostic so more sensor sources can be added later without changing the rendering layer.

## Domain Additions

- `rating: number | null`
- configurable unrated-selection policy
- AI analysis metadata with confidence and provenance
- optional image description or caption
- public/private/share-eligibility flags
- media-type abstraction for photo, video, and generated assets
- normalized sensor/device readings and device capability metadata

## Acceptance Plan

### Phase 1

- Remote/admin flows work with REST mutations as the default path.
- Socket disconnects do not break correctness of persistence or controls.
- Unrated items remain stored as `null`.
- AI analysis is persisted as advisory metadata and does not silently override human judgment.
- Domain tests cover REST and socket adapters producing the same command semantics.

### TypeScript Migration (Transition Bridge)

- Frontend runs entirely on TypeScript (.ts/.tsx) with Vite compiler checks passing.
- Backend runs with Node's native type-stripping flags (`--experimental-strip-types`) or standard build transpilation.
- Domain logic compiles under strict mode and all existing `run-tests.js` tests execute successfully without errors.
- The screensaver client daemon continues to run under the strict 80MB memory footprint.

### Phase 2

- Public bundle export excludes private feeds and secrets.
- Shared ratings, descriptions, and analysis round-trip cleanly between local instance and the public service.
- Publish flows omit non-shareable assets such as Google Photos.
- Ecowitt-class devices ingest into normalized sensor records that the UI can render without device-specific logic.
- Hourly sensor snapshots are recorded into local SQLite database and served via REST query/export API for Grafana.

### Phase 3

- Video playback fits the same backend playback state model without photo-specific hacks.
- AI generation runs as asynchronous jobs with observable status and persisted results.
- Additional sensor adapters can be added without changing widget consumers.

### Continuous guardrails

- Keep `npm test` as the regression gate.
- Expand pure domain tests before UI tests whenever possible.
- Preserve transport-parity tests during the migration window.

## Defaults

- Three phases.
- First-party public sharing service in Phase 2.
- Selective FP-library adoption only when it improves clarity.
- Canonical unrated model: `null`.
- AI keyword and exclusion analysis stays advisory by default.
- Vision descriptions are stored for analyzable public-safe items, but shared only for non-private assets.
- General local sensor platform, with Ecowitt first.
- Video before AI generation.
- Blue light filter belongs in Phase 1.
- Typed frontend API client, public bundle contracts, source/device capability metadata, and background jobs are part of the intended platform foundation rather than optional extras.
- TypeScript migration happens as a transition bridge between Phase 1 and Phase 2.
