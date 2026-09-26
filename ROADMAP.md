# Lumina Product Roadmap

Last updated: 2026-09-26

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
- Done: implementation companion Step 4 is complete. Its acceptance criteria are met: repeated reducer/result/effect patterns are shared, new command branches have low ceremony, and the reducer/transport shells remain readable. The final audit found no remaining named Step 4 requirement; future cleanup is maintenance-only and must remain selective.
- Step 4 audit result: its backend acceptance criteria remain satisfied, but the broader functional-programming bar also requires the client action boundary to be compositional and TypeScript-ready; that work belongs in implementation companion Step 5 rather than being hidden inside Step 4.
- Done: implementation companion Step 5 now shares pure, partially applicable client state-patch builders and declarative REST-first mutation request plans; its live-sync audit is complete.
- Done: the first Step 5 snapshot seam now normalizes direct snapshots and `{ state: snapshot }` mutation responses through one pure response projection used by actions and live `state-sync`.
- Done: the initial client state read now uses the strict shared JSON read contract, so HTML or other non-JSON fallback pages fail before snapshot application.
- Done: the Dashboard no longer subscribes directly to raw `state-sync`; screensaver-dependent effects derive from the canonical normalized state owned by `App.jsx`.
- Done: remaining credential-save live acknowledgements now share one pure status projection and declarative RemoteControl subscription table; Socket.IO remains the effectful status shell.
- Done: modern `job-status` and legacy `recrawl-complete` acknowledgements now share one pure job-event projection and declarative RemoteControl listener table; job-specific React targets remain explicit.
- Done: paired primary and secondary photo-update acknowledgements now share one pure event-envelope projection and declarative App listener table; frame-side application remains explicit through the canonical snapshot transform.
- Done: the Step 5 live-sync audit found no further repeated client consumer policy after normalizing paired photo, job, credential, and snapshot event boundaries; transport-specific effects remain explicit.
- Active: implementation companion Step 6 is expanding stable JSDoc contracts around the refactored client and domain boundaries without starting a premature TypeScript rewrite.
- In parallel: continue the Phase 1 implementation companion track in [FUNCTIONAL_REFACTOR_ROADMAP.md](./FUNCTIONAL_REFACTOR_ROADMAP.md), where Steps 1 through 5 are complete and Step 6 is active.
- Operating rule: every substantive improvement, including a deliberate no-change audit, must be recorded in `DEVELOPER_LOG.md` and reflected in the active roadmap when it changes design direction or the next seam. Code clarity and functional composition are product requirements; performance is their evidence.
- Latest Step 4 slice: effect and event interpretation now use the same closed indexed interpreter as reducer families, so unknown and inherited effect/event keys remain silent no-ops without open object-property dispatch.
- Latest Step 4 slice: effect and event interpretation now share a small closed handler-record interpreter over the indexed vocabulary helper, removing duplicate lookup setup while preserving silent unknown and inherited-key behavior.
- Latest Step 4 slice: the Socket.IO command-family adapter now uses that same closed handler-record interpreter, so state-patch, durable-command, async-job, and secret-save specializations remain declarative while unknown and inherited family keys retain their identity fallback.
- Latest Step 4 slice: the REST-first client API now shares one higher-order 404 fallback adapter across category, screensaver, async-job, and admin-secret mutations, keeping mixed-version Socket.IO compatibility as explicit transport metadata while preserving non-404 failures.
- Latest Step 5 slice: REST-first category, screensaver, async-job, and admin-secret actions now derive their REST and legacy Socket.IO payloads from pure request plans, preserving operation-specific shape differences while keeping request execution in one effectful interpreter.
- Latest Step 5 slice: dashboard, environment administration, and Google credential views now share one typed/JSDoc-ready JSON transport boundary for reads and JSON posts; response media-type/error interpretation stays in the API shell while view-specific state and presentation remain explicit.
- Latest Step 5 slice: `normalizeSnapshotResponse(...)` now composes direct REST reads, `{ state: snapshot }` mutation responses, and Socket.IO `state-sync` payloads through one pure compatibility projection; React remains responsible only for applying the normalized result.
- Latest Step 5 slice: `getStateSnapshot()` now composes through `readJson(...)`, aligning the initial state read with the shared strict JSON media-type contract used by the other client reads.
- Latest Step 5 slice: Dashboard screensaver-dependent effects now consume the canonical `state.screensaverActive` prop instead of maintaining a second raw Socket.IO synchronization subscription; the dismissal pending guard remains local because it represents an in-flight UI effect.
- Latest Step 5 slice: RemoteControl credential-save acknowledgements now compose through `projectCredentialSaveStatus(...)` and a shared subscription table, preserving per-credential input clearing and transient status resets without duplicating event handlers.
- Latest Step 5 slice: RemoteControl job acknowledgements now compose through `projectJobEvent(...)`, so modern and legacy recrawl envelopes share the existing job-status algebra and one effectful application path without hiding view-specific targets.
- Latest Step 5 slice: App photo acknowledgements now compose through `projectPhotoEvent(...)`, so primary and secondary wire events share one subscription shell while the side-aware immutable snapshot update remains explicit.
- Latest Step 6 slice: `client/src/state/frameSelectors.js` now exposes local `@ts-check` contracts for snapshots, frames, photo-event envelopes, and crop selectors; browser-facing types remain independent from server-only modules so later TypeScript conversion can stay mechanical.
- Latest Step 6 slice: `client/src/state/categorySelection.js` now exposes a checked pure selection contract for canonical aliases, snapshot fallback sources, serialization, and immutable toggles; the existing data-first helper signatures remain unchanged.
- Latest Step 6 slice: `client/src/state/jobStatus.js` now exposes checked contracts for the closed recrawl/vision job vocabulary, modern and legacy event envelopes, and the shared pure status projection; React effect targets remain explicit.
- Latest Step 6 slice: `client/src/state/feedMutations.js` now exposes checked client-owned snapshot/config contracts for immutable category and feed-source projections; unknown edit inputs remain identity-preserving at the pure boundary.
- Latest Step 6 slice: `client/src/state/environmentHistory.js` now exposes checked contracts for pure metric conversion, timestamp formatting, and environment-status presentation shared by TV and remote views; adapter-specific data remains outside the client vocabulary.
- Latest Step 6 slice: `client/src/state/photoCrop.js` now exposes a checked scalar contract for contain/cover baselines and crop interpolation; its historical absent-mode fallback and pure numeric formulas remain unchanged.
- Latest Step 6 slice: `client/src/state/screensaverActivity.js` now exposes a checked pure activity contract for Escape and dismissal-event classification; active-state gating and unknown-event no-ops remain unchanged.
- Latest Step 6 slice: `client/src/state/poolPolicyDrafts.js` now exposes checked contracts for normalized policy defaults and immutable, partially applied draft merges; HTML form strings and nested schedule updates remain compatible at the pure boundary.
- Latest Step 6 slice: `client/src/state/keywordInput.js` now exposes a checked pure parser contract for pasted phrases and timed feed parameters; exact per-line keyword text and malformed-input empty identities remain unchanged.
- Latest Step 6 slice: `client/src/state/credentialStatus.js` now exposes a checked pure acknowledgement contract for credential saves; success/error projection and effect-shell input clearing remain unchanged.
- Latest Step 6 slice: `client/src/state/cssImage.js` now exposes a checked pure presentation contract for CSS image values; empty-input identity and URL escaping remain unchanged.
- Latest Step 6 slice: `client/src/state/clock.js` now exposes a checked pure clock-parts contract; locale/options composition and the separate `{ time, period }` projection remain unchanged.
- Latest Step 6 slice: `client/src/components/remote/tvPreview.js` now exposes a checked pure preview-geometry contract; measured-dimension fallbacks and aspect-ratio fitting remain unchanged.
- Latest Step 6 slice: `client/src/state/poolLifecycleView.js` now exposes client-owned schedule, policy, summary, row, and policy-reader contracts; schedule defaults and presentation mapping remain pure while React state and persisted-policy effects stay outside the helper.
- Latest Step 6 slice: `client/src/components/remote/googlePhotosPicker.js` now exposes explicit client-owned copy and status contracts; Picker copy/status projection remains pure while OAuth, transport, and React effects stay outside the helper.
- Latest Step 6 slice: `client/src/state/actionPlans.js` now exposes checked patch-result contracts for partially applied field and widget builders; patch construction remains pure while action execution and React state effects stay outside the helper.
- Latest Step 6 slice: the TV slideshow now keeps media loading authoritative and connectivity-aware: `client/src/state/mediaRecovery.js` projects a bounded 1s/2s/4s/8s retry policy, while the Dashboard probes the image origin before classifying a URL as broken and holds the current slide during an unreachable-host outage.
- Latest Step 5 slice: the Image Feeds admin surface now uses a bounded desktop workspace, compact responsive pool-lifecycle cards, constrained time controls, and a two-column source manager that collapses to one column on narrow displays; lifecycle row presentation is derived through a pure view-model helper.
- Latest Step 5 refinement: pool lifecycle cards now use closed native disclosure panels by default; each summary retains the current retention, photo-cap, and schedule facts while advanced fields appear only after an explicit Configure action.
- Latest Step 5 refinement: the Image Feeds workspace now treats Curated Scenic Categories, Independent Rating Deck, Scenic Feed Source Manager, and Google Photos Picker as four first-class panels. The pure panel-state algebra supports immutable collapse/expand, transient focus/Escape restoration, and keyboard-accessible earlier/later ordering; browser storage persists only open preferences and order.
- Latest Step 5 UX refinement: the workspace grid now aligns panels to their content height so the Rating Deck does not stretch beside the longer Source Manager. Its title row keeps only compact disclosure/focus controls; labeled order actions live in a separate toolbar, and category/rating/chip controls use real keyboard-accessible buttons with mobile touch sizing.
- Latest Step 5 focus refinement: Rating Deck Focus mode now expands the responsive TV preview surface itself, capped by viewport height, and remeasures the pure frame-fit projection after focus changes. The mobile rating scale uses a five-by-two, 44px-minimum grid without introducing horizontal overflow.
- Latest Step 5 focus correction: Rating Deck content and media now clamp to their containing slot, preventing a stale focused frame from widening the normal two-column layout when Escape returns to all-panels mode.
- Latest Step 5 responsive correction: the Image Feeds workspace now leaves the two-column layout at 959px so Source Manager ordering controls have a dedicated, separated toolbar and do not compete with title-row Expand/Focus actions in compressed tablet widths.
- Latest Image Feeds correction: Google Photos now appears in the nested Pool Lifecycle editor, accepts the shared policy REST path, and applies its retention and maximum-photo policy to the external cache while preserving loved and legacy undated items.
- Latest Google Photos correction: source-local cache normalization and Picker merges now keep one row per stable Google media item ID, preserving the first row's metadata when duplicate selections or legacy duplicate cache rows are encountered.
- Latest Google Photos accumulation correction: completed Picker sessions now append/upsert into the persistent pool instead of replacing ordinary rows. The latest synced representation wins for duplicate IDs while rating, crop, pairing, and loved metadata survive; retention and the 5,000-photo policy cap run after the accumulated union, with empty/failed sessions leaving the last successful cache intact. Picker remains the sole ingestion path and no daily revalidation job is added.
- UI decision: Pool Lifecycle remains a nested native disclosure inside Curated Scenic Categories. Focus mode is never restored from storage. Pointer drag-reordering remains deferred because its isolated handle and touch/keyboard contract would need to coexist with the Rating Deck crop gesture; keyboard ordering covers the accessible initial contract.
- Latest runtime correction: scheduled pool activation now appends the scheduled pool to the existing active selection and restores that exact baseline at the schedule boundary; it no longer replaces unrelated active pools.
- Step 5 closeout: the client live-sync audit is complete after the response-to-state, paired-photo, credential, and job-event boundaries were normalized; no further repeated consumer policy was identified.
- Latest Step 4 slice: the client Socket.IO photo-update handlers now share one pure side-aware snapshot projection, keeping primary and secondary frame updates immutable while removing duplicate legacy/canonical state synchronization.
- Latest Step 4 slice: the remote UI now projects recrawl and vision-analysis job events through one pure status algebra, so one Socket.IO listener applies the shared queued/running/completed/failed semantics while job-specific React targets remain explicit.
- Latest Step 4 slice: recrawl and vision-analysis services now share one declarative async-job lifecycle interpreter for scope normalization, progress merging, active-run reuse, terminal status, and error projection while their crawler/analyzer execution and legacy event policy remain explicit.
- Latest Step 4 slice: the mixed-version Socket.IO compatibility adapter now shares one higher-order pool-mutation shell for existence checks, persistence, and state broadcasts while keyword, feed-config, and policy updates remain explicit.
- Latest Step 4 slice: the mixed-version Socket.IO photo compatibility adapter now shares one higher-order curated-mutation broadcast shell, while Google Photos metadata, active-photo recovery, and broken-photo no-op policy remain explicit.
- Latest Step 4 slice: dispatcher effects and events now share one closed typed-handler invoker, while their distinct sequential result and emission algebras remain explicit.
- Latest Step 4 slice: Socket.IO command execution now resolves shared-dispatch, legacy-fallback, or no-handler behavior through one pure command runner, keeping precedence and fallback payload forwarding explicit at the listener boundary.
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
- Latest Step 4 slice: Socket.IO command registration now passes declarative listener records directly into the listener shell, removing positional reshaping while preserving dispatch, fallback, interception, and error behavior.

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
  - Current focus: implementation companion Step 6 is active. The client now has pure state-patch builders, declarative REST-first request plans, a shared JSON transport boundary, normalized event projections, and checked contracts across the stable client state seams.

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
