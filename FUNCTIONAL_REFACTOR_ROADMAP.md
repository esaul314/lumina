# Lumina Functional Refactor Roadmap

Last updated: 2026-07-11

## Purpose

This artifact defines the refactoring sequence for Lumina's backend and shared client control surfaces. It is not a separate product roadmap. It is the Phase 1 implementation companion referenced by [ROADMAP.md](./ROADMAP.md), supporting the REST-first core and shared-domain goals in that main roadmap.

The goal is not cosmetic cleanup. The goal is to make Lumina a codebase that teaches expert functional programming by example while staying practical, testable, and operationally safe on the live daemon host.

The target end state is:

- the domain layer owns business rules
- transports decode inputs and dispatch commands
- selectors derive snapshots and playback decisions
- side effects are explicit, isolated, and observable
- the code reads as composition of small, purposeful functions rather than a sequence of ad hoc mutations

Current checkpoint:

- Manual recrawl and manual vision-analysis now run through shared `trigger-* -> start-*-job` effect paths, with REST owning job submission and Socket.IO reduced to live status pushes plus backward-compatible shims.
- Step 1 is now complete: `server/sockets.js` is a transport adapter over shared command listeners, shared patch-state decoders, and explicit async/telemetry listener helpers.
- Optional mixed-version fallback business logic no longer lives inline in `server/sockets.js`; it now sits in `server/socketLegacyCompatibility.js` and is only used when a shared dispatcher is unavailable.
- The intentionally socket-specific tail is now explicit: connection lifecycle, viewport/reporting telemetry, transient pushes, and the on-demand Google Photos signed-URL refresh helper remain transport-owned by design.
- Step 2 is now complete: the durable socket audit did not uncover any remaining transport-owned settings or playback mutations that still required new domain commands or effects.
- Step 3 is now complete: `server/app.js` now delegates active-feed selection/refresh orchestration, environment refresh pipelines, kiosk/browser runtime control, and idle-daemon orchestration to dedicated runtime modules.
- The active work has moved into Step 4: make the shared command/effect pipeline more composable and legible without hiding straightforward reducer updates.

## Coding Philosophy, Conventions, Style, and Objectives

### Objectives

- Make Lumina a shining example of expert functional programming in production JavaScript.
- Prefer a functional core and imperative shell across backend, transport, and UI control logic.
- Reduce duplicated state-transition logic across REST, Socket.IO, daemon loops, and client helpers.
- Keep every refactor transport-safe, runtime-safe, and covered by tests before it is considered done.

### Philosophy

- Business rules belong in pure functions.
  Reducers, selectors, codecs, normalizers, and presenters should be deterministic and unit-testable.
- Side effects must be explicit.
  Persistence, weather refreshes, crawler runs, browser launch/kill, and socket emissions should happen through named effects or shell adapters, never hidden inside arbitrary branching.
- Composition beats branching.
  Prefer `decode -> validate -> transform -> dispatch -> present` pipelines over mixed handlers that mutate state, emit events, persist files, and shape responses all in one place.
- Data transformation should read top-down.
  A reader should be able to follow the flow by reading small function names, not by mentally simulating long imperative blocks.
- Functional style must improve clarity, not become point-free theater.
  Use composition, currying, and partial application when they make intent more obvious and reduce repeated ceremony.

### Conventions

- Use object-shaped environment arguments instead of long positional dependency lists.
- Prefer unary helpers and partially applied factories for handlers, selectors, and presenters.
- Prefer decoder functions that return either a command, a batch of commands, or a structured validation failure.
- Prefer sequential command batching when order matters.
- Keep source-specific behavior behind adapters, then project the results back into shared snapshot state.
- Add `@ts-check` and JSDoc at module boundaries that are intended to survive the later TypeScript migration.
- Preserve existing wire contracts unless there is a deliberate, tested API change.

### Style Rules for This Roadmap

- Use composition first: build flows from small functions with names that explain the stage.
- Use currying and partial application for factories and repeated policies.
  Examples: `createCommandListener(env)(eventName)(decode)`, `presentPoolUpdate(name)`, `withSourceCategory(category)`.
- Prefer declarative collection operations over manual loops when they are clearer.
- Avoid duplicating normalization logic across transports.
- Keep reducers and selectors pure; keep adapters thin.
- Make effect names concrete and finite: `persist`, `refresh-weather`, `run-crawler`, `launch-kiosk`, `kill-kiosk`.

## Sequential Refactoring Steps

These step numbers are local to this implementation companion. They are not replacements for the Phase/Step numbering in [ROADMAP.md](./ROADMAP.md).

### Step 1: Refactor `server/sockets.js` into a functional transport adapter

Why first:

- It still mirrors the old `server/routes.js` problems: a long positional constructor, duplicated state mutation logic, repeated fallback branches, inline persistence, and transport-owned business rules.

Changes:

- Replace the positional Socket.IO registration signature with one object-shaped environment.
- Introduce shared socket handler factories such as:
  - `createCommandListener`
  - `createBatchCommandListener`
  - `createAsyncListener`
  - `createTelemetryListener`
- Convert durable mutation events to `decode -> dispatch` flows.
- Remove inline fallback mutation branches for:
  - category selection
  - theme and interval changes
  - split portrait and crop controls
  - excluded keywords
  - location settings
  - screensaver toggles
  - pool lifecycle and feed config updates
- Keep only truly ephemeral socket-only behavior in the socket layer:
  - connection lifecycle
  - viewport reporting
  - display telemetry
  - transient remote status pushes
  - source-local Google Photos cache updates when they are not yet part of the domain model

Progress note:

- The object-shaped socket environment and shared command-listener / patch-decoder layer are now in place for widget, theme, interval, scale, split, alignment, vision-config, location settings, category selection, active-photo/navigation, and standard curated-photo mutations.
- `update-excluded-keywords` now belongs to that same shared command-listener path instead of living as a transport-local branch.
- Legacy compatibility branches no longer live inline in `server/sockets.js`; they are isolated in `server/socketLegacyCompatibility.js` and only exercised when the shared dispatcher is unavailable.
- Step 1 is complete. The remaining socket-only handlers are intentionally transport-specific and already wrapped behind explicit async/telemetry listener factories.

Acceptance criteria:

- Durable socket events use the same reducer semantics as REST.
- Socket handlers no longer recompute feeds or choose active photos inline.
- Transport-parity tests prove REST and Socket.IO adapters drive the same commands.

### Step 2: Expand the domain command surface to absorb remaining durable socket behavior

Why second:

- `server/sockets.js` cannot become thin unless the reducer can express the remaining settings and lifecycle mutations.

Changes:

- Add missing commands for any remaining durable mutations still trapped in transport code.
- Normalize command decoders so REST and Socket.IO share the same parsing rules wherever possible.
- Introduce any missing effects required to keep side effects explicit.
- Keep reducer branches small and compositional by extracting shared update helpers instead of growing a monolithic switch body.

Acceptance criteria:

- The reducer owns all durable settings mutations.
- New commands have direct domain tests.
- No transport layer performs persistence or recomputes durable playback state inline.

Progress note:

- The post-Step-1 audit found no additional durable socket mutations that still needed new domain commands or explicit effects.
- Step 2 is therefore complete as an audit checkpoint rather than a command-surface expansion slice; the remaining socket tail is intentionally ephemeral or source-local by design.

### Step 3: Refactor `server/app.js` from mixed orchestrator to explicit shell composition

Why third:

- After routes and sockets are thin, `server/app.js` becomes the main remaining place where domain decisions, runtime orchestration, service calls, and startup wiring are still interleaved.

Changes:

- Extract shell responsibilities into focused modules or factories:
  - weather update pipeline
  - sentiment update pipeline
  - crawler/background job pipeline
  - kiosk/browser runtime control
  - daemon idle-state orchestration
- Reuse selectors for feed refreshes and playback decisions instead of app-local variants.
- Convert mutable helper clusters into small, named pipelines.
- Keep `server/app.js` as assembly and scheduling code, not a second business-rules hub.

Acceptance criteria:

- `server/app.js` mostly wires modules together and schedules effects.
- Feed rebuilding and smart photo selection flow through shared selector utilities.
- Runtime effects remain explicit and testable at the boundary level.

Progress note:

- Active-feed selection and scoped refresh orchestration now live in `server/runtime/activeFeed.js`.
- Weather refresh, news-sentiment refresh, and daily feed update shell composition now live in `server/runtime/environmentRefresh.js`.
- Kiosk/browser runtime control now lives in `server/runtime/kioskControl.js`.
- Idle-daemon polling, transition reduction, and scheduling now live in `server/runtime/idleDaemon.js`.
- Step 3 is complete; `server/app.js` now reads primarily as bootstrap assembly plus a small set of remaining service boundaries.

### Step 4: Make the command/effect pipeline more composable and legible

Why fourth:

- Once the major transports are thin, the next leverage point is improving the readability and extension ergonomics of the domain pipeline itself.

Changes:

- Extract repeated reducer update shapes into helper combinators where they improve readability.
- Standardize result builders for:
  - state-sync only
  - photo-update plus state-sync
  - persistence-bearing updates
  - persistence plus follow-up effects
- Make command batching and effect interpretation easier to extend without rewriting existing branches.
- Keep this selective: do not introduce abstractions that hide simple updates.

Acceptance criteria:

- New command branches can be added with low ceremony.
- Repeated reducer patterns are expressed once.
- The reducer remains readable to a human who is learning from the code.

Progress note:

- The reducer now uses standardized result builders for unchanged returns, state-sync returns, photo-update plus state-sync returns, and effect-only returns.
- Repeated photo-mutation branches now share one composable `reducePhotoLibraryCommand(...)` path that handles `update -> optional playback finalization -> persistence effects -> event selection`.
- The next Step 4 slice standardized config/runtime mutation helpers and the `patch-state` branch, so repeated durable updates now flow through small equality-aware combinators instead of open-coded branching.
- The latest Step 4 slice applies that same selective-combinator approach to pool/config mutations, so pool keyword and feed-config updates now share reducer-local helpers and stay silent when the normalized effective config is unchanged.
- The latest Step 4 slice standardized async effect submission across the dispatcher and REST async-job routes, so recrawl and vision-analysis submission now share one `decode -> dispatch -> extract effect submission -> present` boundary with consistent missing-service handling.
- The latest Step 4 slice extracted a shared feed-mutation finalization path, so category selection, excluded-keyword updates, and pool deletion now share one explicit `apply -> recompute feed -> ensure active photo -> emit -> persist` boundary while normalized excluded-keyword no-ops stay silent.
- The latest Step 4 slice standardized guarded REST mutation shells, so pool mutation routes now share one `decode -> guard -> dispatch -> present` boundary across single-command, batch-command, and async submission handlers without inlining duplicate existence checks.
- The latest Step 4 slice made route decoding itself composable, so photo patch and preview routes now use the same shared command factories with explicit decode-phase failures and pre-dispatch photo guards instead of ad hoc wrapper handlers.
- The latest Step 4 slice moved the remaining keyword-config REST mutation onto the shared pool-keyword command path and introduced one pure keyword-spec helper boundary, so time-scoped keyword entries now normalize, compare, clone, and persist consistently across route decode, reducer state updates, snapshots, and persisted config projection.
- The latest Step 4 slice collapsed the remaining REST route factories onto one shared dispatch shell, so command, batch-command, and async effect-submission handlers now specialize the same `decode -> guard -> preflight -> dispatch -> present` boundary while preserving no-op handling, custom response envelopes, and async submission checks.
- `server/domain/dispatch.js` now interprets reducer effects and events through explicit handler tables, keeping the shell readable as `reduce -> apply snapshot -> interpret effects -> emit events`.
- The latest Step 4 slice standardized dispatcher-local effect sequencing and env/runtime payload normalization, so shell effects now flow through small interpreters and focused fail-safe helpers instead of repeating inline manual-override, payload-shape, and weather-refresh ceremony.
- The latest Step 4 slice extracted a tiny route-decode result algebra, so photo patch, pool patch, keyword, and preview decoders now compose as pure `decode -> collect -> map/chain` flows with explicit source-level failures instead of hand-rolled nullable command batching.
- The latest Step 4 slice moved durable socket command registration onto declarative listener specs, so state-patch, photo, pool, async-job, and admin-secret socket handlers now specialize one shared registration boundary while the intentional socket-only telemetry and Google Photos refresh tail stay explicit.
- The latest Step 4 slice standardized the remaining simple reducer setter/effect branches, so split-layout, scale, theme, interval, screensaver, admin-secret, and async-job commands now share small command reducers plus pure payload builders instead of repeating field-update and effect-shaping ceremony.
- The latest Step 4 slice standardized the remaining photo-library mutation branches into one reducer-spec boundary, so rating, broken-photo, crop, pairing, and metadata commands now specialize shared `url -> update -> persist -> finalize playback` plumbing while keeping their distinct updater and finalizer rules visible as data.
- The first Step 4 slice is complete, but the broader command/effect readability pass remains active for additional reducer and dispatcher polish where it clearly improves clarity.

### Step 5: Align the client control surface with the same functional boundaries

Why fifth:

- Lumina should not be functionally elegant only on the server. The client control surface should also read as composed state interpretation plus transport adapters.

Changes:

- Continue moving client actions through the REST-first command path.
- Keep socket use focused on live sync and ephemeral push events.
- Refactor client action helpers into declarative command/request builders and snapshot normalizers.
- Prefer selectors and pure state transforms in the remote UI over local behavioral branching.

Acceptance criteria:

- Client action code reflects the same command/snapshot vocabulary as the server.
- Remote/admin UI logic does not re-encode server rules locally.
- Snapshot normalization remains the only compatibility layer for transitional state shapes.

### Step 6: Prepare the codebase for TypeScript without a premature rewrite

Why sixth:

- The refactor should leave boundaries ready for TypeScript, but the current goal is architectural clarity in JavaScript first.

Changes:

- Expand `@ts-check` and JSDoc around command contracts, environment objects, effect payloads, and selector inputs.
- Keep internal helper APIs stable and explicit so later `.ts` conversion is mostly mechanical.
- Avoid introducing dynamic or shape-shifting patterns that will become typing liabilities later.

Acceptance criteria:

- Core refactored modules expose stable, documented contracts.
- TypeScript migration can adopt the modules without redesigning their public shapes.

## Testing and Verification Strategy

- Add domain tests before transport tests whenever a business rule moves.
- Keep transport-parity tests during the migration window:
  - REST and Socket.IO should decode to the same commands
  - the same command should produce the same state transitions regardless of transport
- Preserve smoke coverage for important wire contracts, especially where response envelopes differ intentionally.
- Keep `npm test` and `npm run lint` as the baseline gate for every slice.
- Prefer several small verified commits over one large multi-concern rewrite.

## Non-Goals

- Do not perform a big-bang TypeScript rewrite as part of these refactors.
- Do not introduce a heavy FP library unless standard JavaScript plus the local helpers becomes meaningfully less clear.
- Do not change public API contracts casually in the name of elegance.
- Do not move ephemeral telemetry into durable domain state unless there is a concrete product reason.

## Definition of Done

A refactor slice is done only when:

- transport code got smaller and more declarative
- duplicated business logic was removed rather than relocated
- the domain layer became the clearer source of truth
- tests prove the behavior still works
- the resulting code is easier to learn from than the code it replaced
