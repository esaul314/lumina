# Lumina Product Roadmap

Last updated: 2026-11-24

- Screensaver cursor correction (2026-10-25): the active TV kiosk restarts its three-second inactivity timer when screensaver state changes and hides the pointer across the page, including over settings panels.
- Reported TV pointer regression (2026-11-13; unverified): the pointer is again
  remaining visible. Prioritize an investigation of the actual Playwright-host
  service, served build, kiosk launch mode and active state, then reproduce on
  the physical TV after at least three seconds without pointer activity. Check
  timer rearming, page-wide cursor CSS, settings overlays and pointer events;
  distinguish a kiosk regression from admin-preview behavior. Add deterministic
  browser coverage and verify any eventual fix on the actual TV. Do not infer a
  cause or claim resolution without runtime evidence.
- Cursor investigation (2026-11-13): the host service was active, the live
  screensaver state was true, and the Chromium kiosk was launched with
  `?mode=tv`. The served HTML matched the local built HTML. Isolated built-client
  browser tests cover the three-second timer, settings, activity rearming,
  activation/deactivation and the admin-preview body boundary. The physical
  pointer and live kiosk DOM could not be inspected; the reported regression
  remains open. Next observe the physical TV and live pointer events before
  choosing a fix; a passing isolated browser test is not proof of resolution.

## Implementation Companion

For the code-shaping program that supports this roadmap, see [FUNCTIONAL_REFACTOR_ROADMAP.md](./FUNCTIONAL_REFACTOR_ROADMAP.md).

- Use this product roadmap for platform direction, phase goals, and acceptance criteria.
- Use the functional refactor roadmap for the ordered engineering cleanup sequence, coding philosophy, and transport/domain refactor plan.
- Treat the functional refactor roadmap as a supporting Phase 1 implementation track inside this roadmap, not as a separate product roadmap with its own platform phases.

## Living roadmap operation

Apply [roadmap and complexity discipline](./CONVENTIONS.md#roadmap-and-complexity-discipline) to feedback, discoveries, task selection and acceptance. Beads contains only selected executable work, not this whole roadmap. Guide/checkpoint consolidation is accepted; keep current engineering work in the companion rather than adding another status narrative. Product priorities and existing deferrals remain unchanged.

The five additional Step6 contract boundaries are accepted at source/test level; the companion owns the current counts and remaining seam. Review sharpened the raw-versus-canonical data and effect/spread contracts without changing runtime behavior. Phase1 remains open. The real dependency queue now avoids routine execution-note mirroring, but lease gaps and unmeasured net savings keep unattended/concurrent orchestration unqualified; no new controller or product scope is authorized.

### Concrete complexity-reduction actions — 2026-11-23

These are bounded maintenance outcomes, not a new platform phase or a mandate to
rewrite the application. The current engineering result and next selected action live in the companion's
single Step 6 checkpoint. Materialize a maintenance action in Beads only when selected.

| Action | Deliverable and acceptance | Order |
| --- | --- | --- |
| **Shorten the agent guide** | Remove the accumulated per-helper migration history from `AGENTS.md`, retaining the full standing prompt, architecture and operational contracts plus one link to the current engineering checkpoint. Preserve unique rationale in the existing developer journal and an exact original archive. Aim for a guide at most 20 KiB; verify no capability or accepted requirement was lost. | Guide consolidated to18,858bytes with prompt/rationale preservation verified. |
| **Keep one current engineering checkpoint** | Consolidate competing current/next-seam paragraphs in this roadmap, the companion and the guide. The companion owns one concise current Step 6 result/next action; other documents link to it. Label older diagnostic/tooling audits as history. Verify current tests/counts and deferrals agree, without duplicating a Beads checklist. | Canonical checkpoint consolidation complete; dependent implementation proceeds through Beads. |
| **Reduce the test-runner hotspot selectively** | Extract the coherent `runClientStateTests` group from the large `run-tests.js` into a domain-owned test module, reusing the existing assertion/log interface and entrypoint. Preserve assertions, execution order, failure exit and runtime. No second framework, duplicated runner or broad test rewrite. | Accepted: group body byte-exact, shared runner 1,111 lines shorter, same930pass-line inventory/order and verified failure exit. No new framework. |
| **Keep or retire the tracker on evidence** | This slice observed ready → claim → implementation close → dependent acceptance readiness, with stable task/evidence references. Retain narrow opt-in; manual task translation and short claim-lease renewal remain costs, not an unattended/concurrent-safety proof. No measured productivity uplift. Reassess after the next selected slice; add no dashboard, synchronizer or scheduler to justify the tool. | Queue-first two-outcome trial accepted: one import/two atomic selections, zero between-outcome full-roadmap context reloads.17total tracker calls include5custody updates/3renewals; the older14-call slice is not equivalent. Selection/context are simpler, net time/token/quality savings unproved. Keep narrow opt-in and status-neutral execution links; no new monitor. |
| **Use source-grounded architecture to remove coupling** | Current/target C4 model and concrete AR-1–AR-5 acceptance/removal criteria are in the [engineering bridge](./FUNCTIONAL_REFACTOR_ROADMAP.md#architecture-bridge--2026-11-24). Keep the same daemon/state/stores; begin with the observed legacy back-reference, not a framework rewrite. | Audit and bounded AR-1–AR-5 bridge accepted and qualified in1.0.3; the companion owns exact evidence, remaining coverage and next selection. |

The existing state-path gauge includes client modules and fixture/persistence
paths; it is not evidence of 24 unnecessary ledgers. Inspect a touched persistence
path before changing it, and remove only demonstrated duplicate state. Review
new state/dependencies/wrappers and instruction growth in every accepted diff.

## Execution Status

Phase 1 remains in progress. The REST-first control/job migration and functional
companion Steps1–5 are accepted; Step6 contract readiness remains incomplete.
The single current engineering checkpoint, measured diagnostics and next seam
are in [the companion](./FUNCTIONAL_REFACTOR_ROADMAP.md#step-6-prepare-the-codebase-for-typescript-without-a-premature-rewrite).

The reported physical-TV pointer regression remains open. Isolated built-client
coverage and a correct kiosk launch are not physical-TV acceptance. Product
features, priorities and deferrals below remain authoritative; historical
per-helper implementation narratives are in [the developer journal](./DEVELOPER_LOG.md#historical-roadmap-checkpoints--2026-11-23), not another task queue.

### Photo timestamp foundation (2026-07-31)

- Done: newly accepted crawler photos receive a canonical per-photo `addedAt`
  ISO timestamp.
- Done: persisted photo timestamps are normalized and malformed values are
  discarded without inventing dates for legacy photos.
- Done: legacy snapshot-level `lastUpdated` and `lastFeedUpdated` fields remain
  separate from per-photo acquisition timestamps.
- Done: `addedAt` drives the tested age-retention policy. Legacy photos without
  `addedAt` remain exempt from age-based pruning; any backfill policy remains a
  separate decision.

### Pool lifecycle controls (2026-07-31)

- Done: the Image Feeds admin surface now exposes per-pool retention days and
  maximum photo count controls through the shared pool REST command path.
- Done: recrawls prune dated, non-loved photos past the configured age and cap
  each pool with its configured maximum; loved photos and legacy undated photos
  remain protected.
- Backlog: clarify when a reduced maximum takes effect and show its impact before
  any destructive cleanup; see the lifecycle semantics audit below. Legacy-date
  backfill remains optional and requires an explicit policy.

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

## Optional Feature Candidates

### Minimal display mode

The feasibility work in [docs/MINIMAL_MODE_FEASIBILITY_PLAN.md](./docs/MINIMAL_MODE_FEASIBILITY_PLAN.md)
describes a possible optional low-power TV presentation runtime. It is not a
committed phase or a replacement for Chromium: it should remain behind an
explicit feature flag and proceed only if a real-host presenter spike proves
measurable CPU/memory savings, visual sufficiency, and reliable recovery. The
canonical state, selectors, metadata, and persistence layers should remain
shared if this feature is pursued.

### Beautiful Code Spotlight — later candidate (Alex, 2026-11-24)

Use a dedicated, repository-versioned prompt to ask an AI agent to select a code
snippet it considers especially beautiful and explain why. Showcase Lumina's
project-wide declarative/functional objective: clarity, composition, useful lawful
abstractions and modern language constructs, not cleverness or shortest code.
Retain the source path, revision and enough context to understand the selection;
link existing tests where relevant. A different selection roughly monthly is the
initial idea, not an enabled schedule.

Deferred until selected: agree the prompt, presentation surface (developer docs,
admin or TV), cadence and simple repeat-selection policy. Prefer one reviewed
output through the existing agent/workflow rather than a new service, selection
DB or scheduler. Alex recalls a similar pdf_chunker idea; verify/reuse its useful
parts during design, without assuming that feature already exists. Acceptance:
a representative selection and explanation are useful to Alex and match actual
source; no application behavior or public publication is implied by capture.

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
- Accepted REST-first milestones (history):
  - Step 1 complete: remote photo-control mutations use REST by default.
  - Step 2 complete: remote durable state/settings mutations use REST by default.
  - Step 3 complete: categories, pools, and feed-config mutations now use REST endpoints and shared domain commands by default.
  - Step 4 complete: manual recrawls are queued through REST-first async jobs with socket-pushed progress/status events.
  - Step 5 complete: manual vision-analysis runs are queued through REST-first async jobs with socket-pushed progress/status events.
  - Current engineering work and acceptance live only in [the companion checkpoint](./FUNCTIONAL_REFACTOR_ROADMAP.md#step-6-prepare-the-codebase-for-typescript-without-a-premature-rewrite); the accepted milestones above are not another current queue.
  - Picker identity hardening follow-up: choose a canonical-id policy before changing union matching. Cached deduplication trims comparison keys, but removal/upsert lookup uses raw ids; padded/numeric cached ids can coexist with equivalent incoming rows and earlier padded duplicates can hide an exact match. Preserve metadata and migration behavior through a separately scoped correction.
  - Cached metadata hardening follow-up: choose normalization/write atomicity and metadata validation explicitly; normalization can persist before invalid inputs fail, !== treats NaN and equal-looking objects as changes, and returned unvalidated values may normalize differently on reread. Keep policy changes separate from contract work.
  - Live metadata hardening follow-up: decide identifier normalization and atomicity separately; decoded input ids and row ids trim differently, truthy row ids bypass URLs, and active-frame failures can leave committed list/field updates. Accessor effects are not rolled back.
  - Security follow-up: validate media ids and enforce media-directory containment before filesystem access in the media proxy and background download paths; path construction alone does not provide that guarantee. Track this separately from behavior-preserving contracts.
  - Media retrieval hardening follow-up: choose bounded network/decoding failure recovery, refreshed-token reuse, consistent empty-byte handling, validated MIME values, and thrown-value normalization explicitly. Current retries retain the original token/hint, and prior cache/byte writes survive later failures; keep policy changes separate from contract-only work.
  - Step 6 acceptance audit (2026-10-25): the shared Effect vocabulary now includes the already-emitted/handled `refresh-active-feed`; four regressions cover vocabulary parity, payload/result aliases, absent adapters, and rejected refresh ordering. Core contracts remain incomplete; this is not a TypeScript compilation claim or Phase 1 closeout.
  - Done: Step 6 reducer/dispatcher execution and result contracts are explicit, with seven regressions and no executable production changes. Defaults, identity, ordered effects, and pre-effect snapshots remain unchanged.
  - Done: all exported domain selectors have explicit shared-shape contracts, with ten regressions preserving pool balance, time/random injection, aliases, immutable projections, and existing defaults. No executable production change or export added.
  - Done: Step 6 now documents all 25 command payload variants, nullable decoder results, ten discriminated effects, and dispatcher dependencies/public methods. Ten regressions preserve pass-through fields, aliases, ordered effects, optional adapters, and failure boundaries without executable production changes.
  - Current Step 6 evidence and next contract seam live in the [companion checkpoint](./FUNCTIONAL_REFACTOR_ROADMAP.md#step-6-prepare-the-codebase-for-typescript-without-a-premature-rewrite); strict compilation is measured and remains nonzero. Older audit statements are historical, not the current tooling inventory.

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
- Add admin-authored comments alongside image ratings: create, view, edit, and
  clear a comment without changing the rating. Define stable image identity and
  source-specific persistence, including Google Photos metadata preservation;
  keep comments distinct from captions and AI descriptions and private by
  default. Preserve them through refresh, deduplication, and restarts, and
  explicitly decide how comments follow an image belonging to multiple pools.

### Advisory AI metadata

- Store detected concepts, confidence, and mismatch warnings as advisory metadata.
- Keep human ratings and exclusions authoritative unless explicit automation is added later.
- Treat vision-generated descriptions the same way: persisted metadata first, optional policy later.

### Local platform work

- Add blue light filter as a first-class display setting in backend state and client rendering.
- Add a background job subsystem for recrawls, vision analysis, later AI generation, and sensor polling or ingestion.
- Add a typed frontend API client as the transport boundary for the remote UI.
- Add a persistent admin control to hide the city/region label on the TV weather
  card independently of the weather widget. Hiding the label must not disable
  location selection, forecasts, or weather-based photo selection; keep the
  location available where needed in the admin UI.
  **Feedback clarified by Alex, 2026-11-24:** for a single current location the
  label is usually redundant; make its screensaver-side display optional. A
  future multi-location forecast may make explicit labels useful again, but this
  option does not commission multi-location tracking. Reuse one existing
  presentation-setting boundary, not a second location model. Test persistence,
  hidden/shown TV layout and unchanged forecast/location-dependent behavior.
  **Selected, 2026-11-24:** the second commissioned sequence implements this
  existing Phase1 item through the current widget/collection boundary.
  **Delivered in1.0.2:** remote System→General and TV widget settings expose
  “Show weather location.” Existing/legacy snapshots default visible; hiding
  persists and forecasts remain enabled. Both layouts and synchronization/reload
  behavior pass headless checks; the rebuilt native release is live. This is
  presentation only, not multi-location support or physical-TV visual acceptance.

### Photo source investigation

- Investigate subscribing to Unsplash collections as a distinct feed option
  alongside existing keyword search. Verify supported APIs, authorization,
  attribution, licensing and rate limits before choosing an implementation;
  evaluate collection identifiers, periodic refresh, removed items, duplicates,
  failures, and existing pool lifecycle and metadata-preservation rules. Record
  feasibility and tradeoffs before committing to a subscription design.

### TypeScript Migration (Transition Bridge)

**Runtime upgrade candidate — Alex, 2026-11-23.** Evaluate a newer supported
Node.js release to enable useful recent language/runtime features and simplify
TypeScript/tooling where appropriate. This is a planned evaluation, not a runtime
change or a premature TypeScript rewrite. Select the target from current upstream
support status and a concrete feature payoff, not merely the highest version.
**Qualification accepted, 2026-11-24:** the commissioned runtime/release slice
selects official LTS/security Node 26.13.1, declared once in `.nvmrc`. It exposes
native Temporal, Map upsert and iterator composition without adding polyfills;
using these APIs remains a separate, need-driven code choice. Locked-dependency
suites, native history compatibility and headless/client-build checks pass.
The existing service/launcher are aligned; native promotion/live acceptance completed
for release1.0.1. The owner verified process, served assets, HTTP/Socket.IO and
private-data preservation. Editing the pin alone still does not authorize deployment.

- Compare the current application runtime with the candidate using the locked
  dependencies, native-addon compatibility, full tests, strict diagnostic
  baseline and relevant client build checks. Browser language targets remain a
  separate decision; a server upgrade does not upgrade the kiosk browser.
- Verify the developer/test commands, launchers and existing service resolve the
  intended runtime consistently. Keep the node-agent runtime independent; do not
  silently change a global/default runtime or duplicate version configuration.
- Retain the current runtime, define a scoped rollback, and qualify candidate
  failure/recovery before any separately commissioned service switch. Record
  benefits, incompatibilities and the go/no-go decision in the developer journal.


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
  - Use the qualified project runtime's supported native type stripping for an erasable TypeScript subset, or standard transpilation where language/tooling semantics require it. Verify module resolution and non-erasable constructs before migration; do not copy obsolete runtime flags.
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
- Add temperature and humidity trends to the TV weather/environment display,
  using available hourly history where appropriate. Compare with a clearly
  defined earlier reference such as the corresponding time yesterday, and assess
  compact sparklines versus up/down indicators or warmer/cooler coloring. Decide
  indoor and outdoor coverage explicitly, respect units and timestamps, and
  handle missing, sparse, stale, or incomparable readings without inventing a
  trend. Direction must remain understandable without color alone, with legible
  contrast and a bounded display footprint.

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
- Admin image comments survive supported refresh and restart paths, remain
  independent of ratings and captions, and are private by default.
- Hiding the city/region label persists and leaves weather data and
  location-dependent behavior intact.
- Unsplash collection feasibility documents API/policy constraints and a
  refresh-and-identity design or a clear reason not to proceed.
- Domain tests cover REST and socket adapters producing the same command semantics.

### TypeScript Migration (Transition Bridge)

- Frontend runs entirely on TypeScript (.ts/.tsx) with Vite compiler checks passing.
- Backend uses the qualified runtime's supported erasable-TypeScript execution or standard build transpilation, with module/language compatibility tested.
- Domain logic compiles under strict mode and all existing `run-tests.js` tests execute successfully without errors.
- The TV client stays within a measured memory budget on the reference host. The
  existing sub-80MB aspiration must be validated against total process RSS and
  GPU allocations, separately from the V8 heap limit.

### Phase 2

- Public bundle export excludes private feeds and secrets.
- Shared ratings, descriptions, and analysis round-trip cleanly between local instance and the public service.
- Publish flows omit non-shareable assets such as Google Photos.
- Ecowitt-class devices ingest into normalized sensor records that the UI can render without device-specific logic.
- Hourly sensor snapshots are recorded into local SQLite database and served via REST query/export API for Grafana.
- Temperature and humidity trend presentation identifies its comparison window,
  handles missing or stale data, and conveys direction without relying on color
  alone; tests cover the selected sources and time boundaries.

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

## Resource pressure follow-up (2026-10-25)

- Done: the Lumina user service uses `MemoryHigh=1536M` and `MemoryMax=2G`;
  active manual pools recover from OOM or service restarts. The 2 GiB ceiling
  leaves headroom above the measured 1.4 GiB peak on the 8 GiB reference host.
- Next: collect several days of `MemoryCurrent`, `MemoryPeak`, and `memory.events`
  data under ordinary kiosk use. Revisit the ceiling only from those measurements;
  investigate host-wide pressure separately from Node.js heap growth.

## Backlog & Audit Findings (2026-10-04)

These items came from a source-and-documentation consistency sweep. They are
design work, not claims that the current behavior has already been changed.

### High priority

- **Separate image identity from pool membership.**
  `server/config/collectionsCodec.js`
  currently deduplicates persisted rows by exact URL and keeps the first pool's
  row. This prevents repeated rows, but can erase a later pool's membership and
  pool-specific metadata. URL variants and expiring signed URLs can still refer
  to the same underlying media. Define a canonical media identity and represent
  one stored asset with explicit pool memberships, or explicitly document
  first-pool ownership if memberships are intentionally exclusive. Preserve
  metadata conflict rules, visible-feed uniqueness, and equal-turn pool
  playback through migration and regression coverage.
- **Make pool lifecycle limits understandable and actionable.** A policy update
  persists the new value, while crawler retention/capping runs on later crawl
  work; lowering `maxPhotos` does not itself trim the existing collection, and
  loved photos may exceed the cap. Choose whether the field is a prospective
  ingestion target or an enforceable current limit. Expose that behavior in the
  UI and, if immediate cleanup is supported, preview affected rows and preserve
  explicit loved-photo and legacy-date rules.
- **Harden the Google OAuth callback boundary.** The current authorization URL
  has no OAuth `state` value and the callback rebuilds its redirect URI from the
  request `Host` header. Add a one-time state check and use a configured,
  trusted public origin for callback construction; cover callback mismatch and
  replay behavior with focused tests.

- **Bound failed-provider work and expose degraded capability.** The November24
  rollout found repeated Unsplash401/Reddit403 responses and aborted background
  vision analysis; the OLD process journal confirms the same provider failures
  before the runtime upgrade. Cached playback and saved data remain available.
  In a separately selected slice, classify auth/policy/rate/capability failures,
  bound retries per run instead of repeating hundreds of rejected queries, and
  present a concise degraded result through existing job/status boundaries.
  Preserve cached pools/metadata and manual-operation failure semantics. Cover
  rejected/unavailable providers and recovery with injected transport fixtures.
  Do not add a health daemon/state mirror, silently rotate credentials, enable a
  model fallback, or change source policy.
  **Second sequence, 2026-11-24:** targeted Unsplash/Reddit run-local bounds and
  request deadlines are independently accepted;12 offline cases cover rejection,
  decoding/transport/deadline failure, cache and recovery. Existing job/daily
  reporting now preserves warnings through modern and legacy events, including
  no-change passes, and clears them on recovery; independently accepted.
  **Live1.0.2 acceptance:** this crawl logged one Reddit403 and one Unsplash401,
  not one per query/pool. Wallhaven429 and AIC403 still repeat; the old process
  journal confirms both, so they remain the next concrete source-boundary
  candidates, not a new runtime regression or a claim of full provider health.
  Unavailable vision keeps its existing three-failure bound and separate auth/
  capability gate. No extra health service, retry timer or model fallback.
  **Third sequence source acceptance, 2026-11-24:** Wallhaven now shares the
  existing run-local policy across configured queries and keyless AI fallback.
  Rejections/deadlines stop later Wallhaven work, not Lexica or retained results;
  fallback identity/order/full cardinality and next-pass recovery remain covered.
  Art Institute now also receives the existing pass-local policy, preserving IIIF
  identity/base/fallback and display metadata. Both source repairs are independently
  accepted with awaited offline failures/recovery. Unsplash now retains already
  accepted fresh results after a later transport/JSON/deadline interruption in
  the same query, preserving its existing filters/identity/count and truthful
  warning. Independent differential review confirms the former loss case. Final
  **Live1.0.3 acceptance:** native rollout/lifetime/API/data checks pass. Observed
  startup has one Art Institute403, one Reddit403 and one Unsplash401; Wallhaven
  answers successful requests in that observation, so its429 branch remains an
  offline failure qualification, not an observed live429 recovery. Other providers
  and unavailable vision/auth remain open; partial/cache preservation and bounded
  rejections are not full provider recovery.

### Medium priority

- **Await legacy asynchronous regression checks — accepted,2026-11-24.**
  The eight old async assertTest callbacks and their catch-and-ignore/live-provider
  checks are removed. The existing awaited native crawler owner now covers their
  mappings, fixture-local absent credentials and real custom-keyword requests,
  with delayed transport/JSON and rejected-transport cases. A native AST inventory
  guards against direct async callbacks returning to the synchronous helper.
  The actual npm test entrypoint exits1 for an injected late NASA assertion and
  passes normally afterward:145native/922legacy/13sensor/3compiler checks.
  The legacy count fell by8 because false labels were removed, not because those
  behaviors lost coverage. This does not turn the synchronous helper into a
  general Promise-aware assertion API, qualify live providers or alter crawler
  production behavior; rendering extraction remains preserved/accepted.

- **Align news-sentiment scope with the product language.** The configured RSS
  URL is Canada-specific (`en-CA` / `CA`), while the remote UI still describes
  the signal as global. Either make the region a deliberate setting with a
  deterministic default or describe the actual source accurately.
- **Establish measured TV resource budgets.** The two-slide DOM bound and
  `--max-old-space-size=256` are implementation controls, not evidence of an
  80MB total footprint or a particular CPU reduction. Measure renderer and
  server RSS, GPU allocation where observable, idle/active CPU, and image-swap
  behavior on the reference device; then set a reproducible budget and update
  the existing sub-80MB aspiration from that evidence.
- **Automatic IP geolocation — delivered source-only, 2026-11-25.**
  `fix(weather): bound and validate automatic location lookup` replaces insecure,
  unbounded lookup with one HTTPS request, a three-second fetch-plus-body deadline,
  finite geographic validation, exact configured fallback and manual bypass.
  Native offline service/composition tests and independent adversarial review
  verify failure, cancellation, cleanup, fresh recovery and weather/cache updates.
  **Design learning:** a headers-only timeout leaves stalled body reads unbounded;
  partial provider labels must fall back as one coherent location, never attach
  guessed names to unrelated coordinates. Keep pure unknown-to-location projection
  separate from the local async/abort shell; no new request framework or retry loop.
  **Provider decision:** ipapi.co free access is development-only, so use keyless
  HTTPS ipwho.is instead. Its [documented free tier](https://ipwhois.io/documentation)
  permits commercial use,1,000/day per client IP and no SLA. Require explicit
  success and canonical country. Check deployment terms, quota and privacy with
  schema before implementation; the late policy check caused avoidable rework.
  **Limits:** IP lookup exposes server egress IP and is approximate; manual
  selection avoids that lookup, not forecasts. No live-provider probe, deployment
  or physical-TV acceptance; source delivery does not change the running release.
  See [weather/location behavior](./README.md#weather-and-location) and the
  [design lesson](./DEVELOPER_LOG.md#2026-11-25--bounded-weather-location-and-provider-suitability).
- **Bound forecast transport separately (follow-up, not selected).** Open-Meteo's
  forecast request is unchanged and still has no whole-operation deadline. Before
  selecting that work, define failure/cache semantics and test stalled headers
  AND body through the existing weather composition. Reuse the simple boundary
  pattern if it fits; don't extract a generic framework merely for symmetry.

### Backlog maintenance

- The agent guide's roadmap list named Google Photos OAuth as unimplemented,
  although credentials, token persistence, login, and callback routes already
  exist. That item is retired in favor of the callback hardening work above.
- The agent guide's geolocation item described adding a flow that already
  exists; it is replaced by the transport/resilience work above.
