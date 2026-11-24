# Lumina Functional Refactor Roadmap

Last updated: 2026-11-24

## Purpose

This artifact defines the refactoring sequence for Lumina's backend and shared client control surfaces. It is not a separate product roadmap. It is the Phase 1 implementation companion referenced by [ROADMAP.md](./ROADMAP.md), supporting the REST-first core and shared-domain goals in that main roadmap.

The goal is not cosmetic cleanup. The goal is to make Lumina a codebase that teaches expert functional programming by example while staying practical, testable, and operationally safe on the live daemon host.

The target end state is:

- the domain layer owns business rules
- transports decode inputs and dispatch commands
- selectors derive snapshots and playback decisions
- side effects are explicit, isolated, and observable
- the code reads as composition of small, purposeful functions rather than a sequence of ad hoc mutations

The [current Step6 checkpoint](#step-6-prepare-the-codebase-for-typescript-without-a-premature-rewrite)
owns engineering status/next work. Product direction remains in [ROADMAP.md](./ROADMAP.md).
Historical per-helper notes are in the developer journal, not repeated here.

## Continuous Functional-Excellence Ledger

Apply [CONVENTIONS.md](./CONVENTIONS.md#roadmap-and-complexity-discipline): retain
generic rationale/tests in DEVELOPER_LOG, design/acceptance here, product feedback
in ROADMAP and task readiness in Beads. Functional clarity is a product objective;
do not duplicate a per-helper journal in every document.

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

Step4 is accepted against the criteria above. Detailed historical slices,
including later contract observations, moved to the developer journal. Use Step6
below for current work rather than reopening the completed readability pass.

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
- Repeated REST action effects use small, pure request/patch projections and one explicit effect interpreter.
- Client boundary helpers carry JSDoc contracts that can be converted to TypeScript without changing their data shapes.

### Step 6: Prepare the codebase for TypeScript without a premature rewrite

Current checkpoint (2026-11-24): **4/10 outcomes accepted**. AR-1 callback injection, AR-2 vision ownership and AR-3 construction remain accepted. **fix(runtime): make stopped resource work inert and retryable** and **refactor(app): own idempotent startup and unconditional shutdown** complete the selected lifecycle outcome. Start does not duplicate resources; stop attempts all cleanup, joins concurrent calls and retries failures, with stale callback/read/launch protection through existing owners.

Terminal disposal per instance uses a fresh constructor/native service process for restart, not a new reattachment/supervision layer. App resource disposal is not transactional cancellation/rollback of every adapter effect. Small ephemeral owned-handle sets and generation tokens are real added state, not a persistent ledger. Full930runtime/13sensor/3compiler/87native and clean lint/diff pass; independent review and real loopback HTTP/Engine.IO/WebSocket/failure probes accept source. Production remains1.0.2; final rollout must separately qualify candidate-owned shutdown.

**Next: AR-4 concrete persistence writers through the existing dispatcher dependencies**, preserving ordered effects, aliases, errors and pure boundaries. Then AR-5 rendering-test extraction, Wallhaven/AIC/partial-query resilience and release. Physical-TV, unavailable vision/auth, security and broader strict readiness remain open; the prior strict290core/59transitive baseline is not a current green claim. Detailed bridge criteria below retain acceptance and removal rationale.

Why sixth:

- The refactor should leave boundaries ready for TypeScript, but the current goal is architectural clarity in JavaScript first.

Changes:

- Expand `@ts-check` and JSDoc around command contracts, environment objects, effect payloads, and selector inputs.
- Keep internal helper APIs stable and explicit so later `.ts` conversion is mostly mechanical.
- Avoid introducing dynamic or shape-shifting patterns that will become typing liabilities later.

Acceptance criteria:

- Core refactored modules expose stable, documented contracts.
- TypeScript migration can adopt the modules without redesigning their public shapes.

### Historical Step6 audits

The October25/26 audits and subsequent per-helper observations are preserved in
[DEVELOPER_LOG.md](./DEVELOPER_LOG.md#historical-roadmap-checkpoints--2026-11-23).
They explain earlier gaps and decisions, not the present compiler/tool inventory.
The current checkpoint above and the acceptance criteria remain authoritative.

## Architecture bridge — 2026-11-24

Origin: Alex's request to control complexity through good architecture. Current
C1/C2/C3 and proposed C3 diagrams, source mapping and trade-offs are in
[the architecture record](./docs/architecture/README.md). Keep the existing modular
monolith and functional core; no new services, state manager, DI container or
framework. These are proposed bounded outcomes, not five automatically authorized
tasks or a replacement product phase. AR-0 (investigation/model) is accepted;
AR-1/AR-2/AR-3 are accepted; AR-4/AR-5 remain to be implemented and independently accepted.

### AR-1 — remove the legacy entrypoint back-reference

**Accepted,2026-11-24:** real callback injection, static cycle1→0 and preserved compatibility behavior; see the current checkpoint. Criteria below retain the intended contract.

Inventory fallback callers, then supply the existing image-analysis callback
through socket/legacy configuration instead of requiring app from lower layers.
Preserve add-category crawl, persistence, broadcast and analysis/failure behavior;
do not delete compatibility or silently replace analysis with a no-op.
Acceptance: legacy and dispatcher-path regression tests pass; no lower-layer
import of app/server entrypoint; the observed static app/socket/fallback cycle
drops from one to zero without hiding it behind a dynamic loader. Use the existing
test harness, not a new graph framework. No new runtime module should be necessary.

### AR-2 — give vision-workflow execution one home

**Accepted,2026-11-24:** execution lives in the existing job boundary; all callers share the directly bound runner. Native photo iteration deliberately preserves awaited live-array semantics; no new concurrency policy.

Move the existing image-analysis execution out of app into its existing
jobs/visionAnalysis boundary, with concrete injected analysis/persist/refresh
capabilities. Separate deterministic candidate/tag projections from sequential
network effects. Preserve scoped categories, broken/banned skips, progress,
three-consecutive-failure behavior, metadata identity and manual-vs-background
error semantics. Inventory overlapping startup/crawl/job callers before changing
concurrency; do not introduce a second scheduler or a speculative job framework.
Acceptance: app loses the workflow body (not replaces it with pass-through
wrappers); offline success/partial/failure/progress tests cover all existing callers.

### AR-3 — make owned startup and shutdown explicit

**Construction and lifecycle accepted,2026-11-24:** bare import is inert; startServer owns resource acquisition and stopServer performs unconditional retryable disposal through existing owners. Terminal per-instance lifetime keeps native service restart ownership, not an in-process controller. Constructor snapshot/adapter effects and previously dispatched adapter work retain explicit limits. Default CommonJS behavior/type shape is preserved; source acceptance is separate from final live shutdown qualification.

Separate construction from starting app-owned timers, sensor/history resources
and listeners, using the existing app/runtime boundaries. Keep the service and
startServer facade compatible. Adapter/config imports may still read defaults:
audit and state those effects rather than calling the whole graph pure.
Acceptance: import alone does not start owned timers/crawls/listeners or open the
history store; repeated start cannot duplicate resources; stop after partial
startup or failure releases every owned handle and remains unconditional.
Use injected native handles/test doubles; no lifecycle daemon, persistent latch
or custom supervisor. Characterize scheduling/legacy semantics before changing them.

### AR-4 — keep persistence at the effect boundary, protect the pure core

The dispatcher and snapshot apply/replace/sync helpers are already effectful shell
code despite their domain paths; only snapshot build/projection helpers belong to
the pure conceptual core. Preserve this distinction without a cosmetic file move. Where
direct collection/env-writer imports couple tests to test-mode switches, pass
concrete writers through its existing dependency object from composition instead.
Preserve sequential order, aliases, rejection propagation, state-before-effects
and events-after-effects behavior. No universal repository interface or new
state owner. Acceptance: failure/ordering tests exercise injected writers; pure
reducers/selectors/codecs do not acquire I/O/transport imports; client/state keeps
its pure dependency boundary. Add narrow assertions through existing npm test
entrypoints. Do not rename/move dispatch just for directory cosmetics.

### AR-5 — reduce a demonstrated navigation hotspot without abstracting it

The 13,393-line runner is a bigger navigation burden than app. Select the coherent
runClientRenderingTests body for extraction beside the existing client-state test
module, reusing supplied assertions/import helpers and the same npm test owner.
Acceptance: function-body behavior, pass/fail inventory, awaited order, root-relative
paths and failure exit remain equivalent; the runner shrinks by the actual moved
body; no duplicated framework or assertions. Reassess before splitting the
1,794-line reducer or large UI panels: require repeated change friction and a real
responsibility boundary, not a file-size target.

### Selection, guardrails and acceptance

The order above is a recommended learning sequence, not fake dependency edges.
AR-1 makes a cleaner callback path for AR-2; only add Beads prerequisites when
source inspection shows a real need. Translate one selected outcome at a time;
keep proposals here. The existing failed-provider item owns Wallhaven/AIC and
partial-query recovery. Reuse the tested run-local request policy there; do not
create another generic integration layer or make it wait for this whole bridge.

Each selected slice records removed coupling/branches/duplicate ownership, actual
diff and tests, retained compatibility and a simple Git rollback. Tests/diagrams
are evidence, not runtime controllers. Enforce zero unneeded services, dependencies,
persistent stores and wrappers; fewer lines alone is not sufficient. Retain strict
diagnostics honestly, preserve functional clarity and existing product deferrals.
Update current/target DSL views in the same change when a boundary actually moves;
keep task history out of the model. Stop or redesign a slice that merely relocates
complexity or adds more concepts than it removes.

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
