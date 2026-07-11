# Lumina Product Roadmap

Last updated: 2026-07-11

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
- Next: continue the Phase 1 implementation companion with Step 4, focused on extending the new reducer-local combinators, shared dispatch-route shell, dispatcher readability patterns, route-decode algebra, and declarative listener/command specs only where they remove real repeated command/effect ceremony. The latest slice standardized the remaining simple reducer setter/effect branches into shared command reducers for split-layout, scale, theme, interval, screensaver, admin-secret, and async-job payload shaping, but the broader Step 4 readability pass remains active and intentionally selective.
- In parallel: continue the Phase 1 implementation companion track in [FUNCTIONAL_REFACTOR_ROADMAP.md](./FUNCTIONAL_REFACTOR_ROADMAP.md), where Steps 1 through 3 are complete and Step 4 is the active refactor checkpoint.

## Architectural Rule

Lumina should continue moving toward one stable integration boundary:

- The backend REST API is the primary control surface for both the local app and the future public-sharing service.
- Socket.IO should shrink to live sync, push notifications, TV viewport/reporting, and low-latency playback events.
- The codebase should keep moving toward a functional core / imperative shell split with pure reducers, selectors, codecs, and transport adapters.

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
  - Next focus: Steps 1 through 3 of the implementation companion are complete; the active companion work is now Step 4's command/effect readability pass across the shared reducer, shared dispatch-route shell, dispatcher boundaries, route-decode composition layer, and socket listener registration boundary, with photo/config/pool/feed-finalization helpers, guarded REST shells, decode-aware photo routes, keyword-spec normalization, dispatcher-local effect sequencing, shared route-decode combinators, declarative socket listener specs, and simple setter/effect reducer specs already standardized. The remaining work should stay limited to future seams that still show real repeated ceremony.

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

- Add a normalized local sensor platform with Ecowitt as the first adapter.
- Ingest local-device readings through a general adapter model rather than device-specific UI wiring.
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
