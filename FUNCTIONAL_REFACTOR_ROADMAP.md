# Lumina Functional Refactor Roadmap

Last updated: 2026-10-26

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

- Playback correction (2026-10-23): the displayed primary URL is a pure projection of bounded slide state and the sole image identity in the rotation effect's dependencies. Timer setup/cleanup remains in React; retry decisions stay in the existing pure data-first media policy. The server owns replacement selection after a broken-image report. No curried or algebraic wrapper is needed for this scalar selector and effect boundary. The Step 6 coverage-audit checkpoint remains unchanged.
- Manual recrawl and manual vision-analysis now run through shared `trigger-* -> start-*-job` effect paths, with REST owning job submission and Socket.IO reduced to live status pushes plus backward-compatible shims.
- Step 1 is now complete: `server/sockets.js` is a transport adapter over shared command listeners, shared patch-state decoders, and explicit async/telemetry listener helpers.
- Optional mixed-version fallback business logic no longer lives inline in `server/sockets.js`; it now sits in `server/socketLegacyCompatibility.js` and is only used when a shared dispatcher is unavailable.
- The intentionally socket-specific tail is now explicit: connection lifecycle, viewport/reporting telemetry, transient pushes, and the on-demand Google Photos signed-URL refresh helper remain transport-owned by design.
- Step 2 is now complete: the durable socket audit did not uncover any remaining transport-owned settings or playback mutations that still required new domain commands or effects.
- Step 3 is now complete: `server/app.js` now delegates active-feed selection/refresh orchestration, environment refresh pipelines, kiosk/browser runtime control, and idle-daemon orchestration to dedicated runtime modules.
- Latest playback correction: smart playback rotates eligible pools before applying within-pool preferences, and sequence playback keeps independent per-pool cursors; feed interleaving remains an explicit separate projection.
- Step 4 is complete: the shared command/effect pipeline is more composable and legible without hiding straightforward reducer updates.
- Step 5 is complete: the client now shares pure, partially applicable REST state-patch builders, REST-first mutation request plans, and normalized live-sync projections instead of repeating patch, fallback, or event-envelope construction in the React/API boundary.
- The first Step 5 snapshot seam is complete: `normalizeSnapshotResponse(...)` is the pure direct-or-enveloped response projection shared by `useLuminaActions` and the app-level `state-sync` listener.
- The initial state read now uses the shared strict `readJson(...)` contract, so the snapshot acquisition effect rejects non-JSON fallback responses consistently with the other client reads.
- The Dashboard now derives screensaver-dependent effects from the canonical normalized state prop; its duplicate raw `state-sync` listener was removed while the local dismissal-pending guard remains an explicit effect concern.
- RemoteControl credential-save acknowledgements now use one pure status projection and a declarative event subscription table; per-credential input clearing remains an explicit view effect.
- RemoteControl job acknowledgements now use one pure event-envelope projection and declarative listener table; modern job status and legacy recrawl completion share status application while React targets and reset effects remain explicit.
- App photo acknowledgements now use one pure event-envelope projection and declarative listener table; primary and secondary frame-side application remains explicit in the existing immutable snapshot transform.
- The latest Step 5 UI slice adds a pure `getPoolLifecycleRows(...)` presentation projection and keeps the React shell responsible only for draft updates and save effects; CSS handles the desktop/mobile field layout without introducing a generic form framework.
- The latest Image Feeds correction extends that pure lifecycle projection to the external Google Photos pool and reuses the shared pool-policy projection at the server boundary, so retention/cap behavior and active-feed refresh remain explicit without coupling the UI to the Google cache implementation.
- The latest Google Photos correction adds a small pure source-local deduplication projection keyed by stable media ID, so Picker merges and legacy cache normalization share one first-occurrence identity rule before persistence.
- The latest Google Photos accumulation slice keeps legacy normalization's first-occurrence rule but gives the Picker merge its own append/upsert projection: all existing usable rows remain in the union, the latest incoming duplicate wins, user-owned metadata is retained, and retention/cap policy is applied only after accumulation. The sync effect logs incoming, existing, merged, retained, and policy-dropped counts; Picker pagination and the equal mixed-feed interleave remain unchanged.
- The latest Google Photos presentation slice preserves Picker `createTime` through cache refresh and uses a checked pure client projection for localized date titles; Picker/cache effects and Dashboard rendering remain in their existing shells, while invalid or absent dates retain current titles.
- The latest Step 5 snapshot slice keeps the `{ state: snapshot }` compatibility rule at the functional boundary, so REST reads, mutation responses, and live sync all enter React as the same normalized snapshot shape without duplicating envelope checks.
- The Step 5 live-sync audit is complete: view-specific state effects remain outside the pure snapshot projection, and no further repeated client consumer policy was identified.
- The current live-sync audit has removed the remaining duplicated credential acknowledgement branch; continue with any other repeated view-specific status consumer only when the repetition is concrete.
- The latest live-sync audit removed the duplicated legacy/modern recrawl status application branch; continue with another view-specific status consumer only when its policy is genuinely repeated.
- The latest Step 6 slice adds a checked client-owned contract to `client/src/state/feedMutations.js`: category selection and feed-source patches remain pure, data-first snapshot projections, while malformed edit inputs retain identity and React/API effects stay outside the module.
- The latest Step 6 slice adds a checked environment presentation contract to `client/src/state/environmentHistory.js`: metric conversion, timestamp formatting, and status projection remain pure and client-owned, while adapter-specific readings and transport effects stay outside the module.
- The latest Step 6 slice adds a checked scalar contract to `client/src/state/photoCrop.js`: contain/cover defaults and crop-blend interpolation remain pure, data-in/data-out helpers, with the existing absent-mode cover fallback preserved for compatibility.
- The latest Step 6 slice adds a checked activity contract to `client/src/state/screensaverActivity.js`: Escape detection and active-screensaver dismissal classification remain pure, browser event classes stay outside the boundary, and unknown events remain inert.
- Screensaver dismissal now receives an explicit session capability: the `?mode=tv` kiosk may send dismissal mutations, while admin previews cannot change shared runtime state.
- The active TV kiosk reapplies its three-second cursor timeout when screensaver state changes and hides the pointer at the page body boundary; settings visibility does not keep the pointer visible during active screensaver mode.
- The latest Step 6 slice adds checked policy and draft contracts to `client/src/state/poolPolicyDrafts.js`: normalized defaults and nested schedule completion remain pure, while form-string values and React save effects stay at their existing boundaries.
- The latest Step 6 slice adds a checked parser contract to `client/src/state/keywordInput.js`: pasted phrases and timed feed parameters remain pure, exact keyword text is preserved, and malformed input retains its empty-list identity.
- The latest Step 6 slice adds a checked acknowledgement contract to `client/src/state/credentialStatus.js`: credential-save success/error projection remains pure and unknown-safe, while transport event names and input clearing stay in the effect shell.
- The latest Step 6 slice adds a checked presentation contract to `client/src/state/cssImage.js`: CSS image projection remains pure and unknown-safe, with empty values mapping to `none` and URL escaping kept inside the helper.
- The latest Step 6 slice adds a checked clock-parts contract to `client/src/state/clock.js`: locale/options composition and the separate `{ time, period }` projection remain pure, with formatter and rendering effects outside the helper.
- The latest Step 6 slice adds a checked preview-geometry contract to `client/src/components/remote/tvPreview.js`: measured-dimension fallbacks and aspect-ratio fitting remain pure, with DOM measurement and style effects outside the helper.
- The latest Step 6 slice adds checked patch-result contracts to `client/src/state/actionPlans.js`: partially applied field and widget builders remain pure and data-first, while API execution and React state application stay in the action shell.
- The latest Step 6 slice extracts `client/src/state/mediaRecovery.js` as a pure media-failure decision algebra: bounded retry scheduling, reachable-host skip policy, and origin URL projection are deterministic, while fetch probes, timers, logging, and socket effects remain explicit in the Dashboard shell.
- The latest Step 6 slice adds named contracts to `client/src/state/imageFeedsPanels.js`: immutable open-state transitions, unknown-safe preference codecs, and injected storage readers/writers remain client-owned and pure, while browser storage, document listeners, and focus restoration stay in the React shell.
- The latest Step 6 slice adds named contracts to `client/src/api/requestPlans.js`: mutation results, legacy fallback envelopes, and generic plan specifications remain pure and partially applicable, while request execution stays in `luminaClient.js`.
- The latest UI refinement uses native `<details>/<summary>` disclosure for each pool: collapsed summary state is pure projected data, while browser disclosure, focus behavior, and field effects remain explicit at the presentation shell.
- The latest UI refinement expands `client/src/state/imageFeedsPanels.js` into a four-panel JSDoc-typed state algebra. Immutable collapse/expand, transient focus/Escape restoration, normalized ordering, and a storage codec are pure; the React shell owns document Escape listeners, focus restoration, and the browser-storage effect while CSS interprets the responsive/focused layout.
- The four panel identifiers are Curated Scenic Categories, Independent Rating Deck, Scenic Feed Source Manager, and Google Photos Picker. Pool Lifecycle remains a nested native disclosure under Categories. Keyboard earlier/later actions now persist normalized order; pointer drag-reordering remains intentionally deferred because isolated drag handles must not compete with the Rating Deck crop gesture.
- The latest UX audit keeps the functional panel shell but separates title-row disclosure/focus actions from a labeled order toolbar, aligns the desktop grid to content height, and replaces nested/faux interactive category and chip controls with explicit buttons. Presentation density and touch sizing are now treated as part of the client boundary contract, not just CSS polish.
- The latest focus audit keeps media sizing compositional: CSS projects the responsive preview slot and five-by-two mobile rating scale, the TV aspect ratio remains presentation input, and pure `fitTvPreviewFrame(...)` derives the actual frame after focus-triggered measurement. Focus therefore enlarges the image surface rather than only the surrounding panel.
- The latest focus-return correction adds no imperative resize mutation: a bounded Rating Deck wrapper and bounded frame keep stale inline geometry from widening the parent, after which the pure frame-fit projection converges normally.
- The latest responsive panel correction keeps layout declarative: a 959px workspace breakpoint gives Source Manager enough width for its source grid, while a bordered order-toolbar lane separates keyboard ordering from title-row disclosure/focus actions without changing the panel state algebra.
- The pool scheduler now composes activation as an immutable baseline-plus-scheduled-category projection, keeping the runtime shell responsible only for dispatch and boundary restoration.
- The latest Step 4 slices collapsed the remaining standalone REST single-command registrations in `server/routes.js` onto one local method-aware spec table, then collapsed the remaining socket command-listener registration ceremony onto one shared listener-family table, then aligned the overlapping pool keyword/feed-config REST patch specs with their durable socket command specs through one shared pool transport family, then collapsed the remaining photo/pool patch transport shapers in `server/domain/commands.js` onto one shared builder, then collapsed the remaining ad hoc simple config/runtime setter branches in `server/domain/reducer.js` onto one shared field-entry interpreter, then interpreted reducer effects through an ordered promise-reduce pipeline so sequencing remains explicit without a mutable loop, and now share the route-presence guard algebra across pool and photo resource checks without hiding their distinct predicates or failure policies.
- The latest Step 4 slice also extracted `createClosedInterpreter`, a small partially applied handler-record adapter over the indexed vocabulary helper, so dispatcher effect and event lookup share one closed boundary without hiding their sequential shells.
- The latest Step 4 slice keeps environment-secret runtime flags on the same functional-core/imperative-shell boundary: a pure record-to-boolean projection now feeds one explicit shell assignment after persistence.
- The latest Step 4 slice shares one curried `reduceUntil(step, shouldStop, initial)(values)` boundary between route-decode collection and route-guard evaluation, preserving empty identities, first-failure short-circuiting, and explicit transport predicates without introducing a general routing framework.
- The latest Step 4 slice shares one higher-order `reduceClonedMutation(state, apply, onChanged)` boundary between ordinary state mutations and feed mutations, preserving strict no-op identity while leaving feed finalization and state result shaping visible at their respective continuations.
- The latest Step 4 slice shares one pure `recomputeAndEnsureActivePhoto(...)` continuation between feed mutations and `patch-state`, preserving deterministic active-photo recovery without hiding patch-specific recompute and weather-refresh flags.
- The latest Step 4 slice routes photo-library result assembly through the same pure `buildMutationResult(...)` boundary as ordinary state, feed, and patch mutations, preserving photo-specific persistence effects and dynamic event selection while keeping the photo updater/finalizer explicit.
- The latest Step 4 slice extends the shared `recomputeAndEnsureActivePhoto(...)` continuation to active-photo rating and broken-photo mutations, so all visibility-changing mutation families share one immutable recovery boundary while their source-specific update policies remain explicit.
- The latest Step 4 slice makes `patch-state` spec application pure: each patch writer returns a new state, while a separate context step accumulates `changed`, recompute, and weather-refresh flags without mutating the reducer context.
- The latest Step 4 slice shares the existing async route error shell through a small `createAsyncJsonRoute(...)` adapter for environment reads, keeping endpoint-specific projections and failure policy declarative at registration.
- The latest Step 4 slice extends that async JSON/error boundary to weather reads, keeping cache short-circuiting and weather persistence in the route-local resolver while extracting the pure public response projection for direct testing.
- The latest Step 4 slice extends the same boundary to environment-settings persistence, so the route composes `resolve -> validate -> project` while keeping invalid settings and thrown service errors on their existing response contracts.
- The latest Step 4 slice makes photo mutation specs patch-first: one pure `buildPatch(payload)` now feeds both the immutable photo updater and source-local metadata persistence, removing duplicated normalization while preserving each command's recovery and event policy.
- The latest Step 4 slice reuses the existing higher-order async route shell for environment-history export, so CSV and JSON response projections remain explicit while their thrown-error contract is interpreted once.
- The latest Step 4 slice reuses the same higher-order async route shell for the Google Photos media proxy, so binary response headers and dimension shaping remain explicit while its 502 error boundary is interpreted once.
- The latest Step 4 slice reuses a small higher-order async error adapter for both Google Photos OAuth callback routes, so logging and failure projection are interpreted once while their distinct picker flows remain explicit.
- The latest Step 4 slice shares one async error-boundary runner across Socket.IO command and transport listeners, preserving decode timing and listener-specific error context while removing duplicate try/catch ceremony.
- The latest Step 4 slice shares one pure side-aware client photo-event projection between primary and secondary Socket.IO updates, preserving legacy active-photo fields and canonical frame state without duplicating immutable snapshot synchronization.
- The latest Step 4 slice shares one pure client `projectJobStatus(...)` projection between recrawl and vision-analysis events, preserving job-specific messages/counts while collapsing duplicate Socket.IO listener state-machine branches into one explicit target table.
- The latest Step 4 slice extracts one small `createAsyncJobService(...)` lifecycle interpreter for recrawl and vision-analysis jobs, sharing immutable progress/status updates, scope normalization, active-run reuse, and terminal error projection while keeping each job's execution callback and legacy-event policy explicit.
- The latest Step 4 slice extracts one higher-order `createPoolMutationFallback(...)` shell for the mixed-version Socket.IO adapter, sharing pool existence checks, persistence, and broadcasts while keeping keyword, feed-config, and policy updates as explicit injected functions.
- The latest Step 4 slice extends that selective compatibility-boundary approach with one higher-order curated-photo broadcast shell, preserving source-local Google Photos handling, active-photo recovery, and silent missing-photo broken reports.
- The latest Step 4 slice shares one closed typed-handler invoker between dispatcher effects and events, preserving their separate sequential result and emission algebras while removing duplicate type lookup ceremony.
- The latest Step 4 slice extracts one pure Socket.IO command runner for shared-dispatch, legacy-fallback, and no-handler selection, preserving dispatcher precedence and fallback payload forwarding while keeping the async listener shell declarative.
- The latest Step 4 slice lets declarative Socket.IO command listener records flow directly into the registration shell, removing positional argument reshaping while preserving dispatch, fallback, interception, and error behavior.

## Continuous Functional-Excellence Ledger

This ledger is an operating rule for the entire roadmap, not a separate
milestone:

- Every substantive change must leave a concise improvement record in
  `DEVELOPER_LOG.md` and update the active roadmap checkpoint when the work
  changes the implementation direction, acceptance criteria, or next seam.
- Each record must name the repeated ceremony or design pressure found, the
  pure/compositional boundary chosen, the intentional imperative shell left in
  place, and the tests or runtime evidence that support the decision.
- A deliberate no-change audit is also an improvement record when it explains
  why another abstraction would reduce readability, weaken TypeScript
  migration seams, or move business rules rather than remove duplication.
- Functional clarity is a product requirement: runtime performance is evidence
  that the architecture is effective, not a substitute for code that is
  deterministic, compositional, explicit about effects, and teachable.
- Future agents must continue this ledger automatically as part of each
  roadmap slice; the record is part of the definition of done, not optional
  release paperwork.

Metadata foundation note (2026-07-31): `server/domain/photoTimestamps.js`
provides pure normalization and immutable stamping for per-photo `addedAt`
values. The crawler stamps newly accepted items through an injected clock, and
the persistence codec preserves valid timestamps while leaving legacy photos
undated. This is a product-foundation slice, not a retention policy or UI
change.

Pool lifecycle note (2026-07-31): `server/domain/poolRetention.js` keeps the
retention contract pure and curried: policy normalization is separate from
age pruning, and the crawler supplies the clock. The admin editor sends one
normalized `set-pool-policy` command through the existing pool patch transport
family rather than introducing a parallel settings path.

Latest Step 4 note (2026-07-20): reducer command families now share one pure table interpreter. Family-specific time/randomness context is supplied through explicit small adapters, preserving readable functional boundaries without adding context to simple or pool commands. The dispatcher now captures its partially applied effect interpreter once before the ordered promise-reduce sequence, keeping effect order and unhandled-effect behavior explicit.

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
- The latest Step 4 slice extracted a shared legacy photo-mutation broadcast boundary, so rating, crop, pairing, and broken-photo fallbacks now signal handled versus silent no-op outcomes through one small interpreter while source-local Google Photos updates remain separate.
- The latest Step 4 slice standardized guarded REST mutation shells, so pool mutation routes now share one `decode -> guard -> dispatch -> present` boundary across single-command, batch-command, and async submission handlers without inlining duplicate existence checks.
- The latest Step 4 slice made route decoding itself composable, so photo patch and preview routes now use the same shared command factories with explicit decode-phase failures and pre-dispatch photo guards instead of ad hoc wrapper handlers.
- The latest Step 4 slice moved the remaining keyword-config REST mutation onto the shared pool-keyword command path and introduced one pure keyword-spec helper boundary, so time-scoped keyword entries now normalize, compare, clone, and persist consistently across route decode, reducer state updates, snapshots, and persisted config projection.
- The latest Step 4 slice collapsed the remaining REST route factories onto one shared dispatch shell, so command, batch-command, and async effect-submission handlers now specialize the same `decode -> guard -> preflight -> dispatch -> present` boundary while preserving no-op handling, custom response envelopes, and async submission checks.
- `server/domain/dispatch.js` now interprets reducer effects and events through explicit handler tables, keeping the shell readable as `reduce -> apply snapshot -> interpret effects -> emit events`.
- The latest Step 4 slice standardized dispatcher-local effect sequencing and env/runtime payload normalization, so shell effects now flow through small interpreters and focused fail-safe helpers instead of repeating inline manual-override, payload-shape, and weather-refresh ceremony.
- The latest Step 4 slice extracted a tiny route-decode result algebra, so photo patch, pool patch, keyword, and preview decoders now compose as pure `decode -> collect -> map/chain` flows with explicit source-level failures instead of hand-rolled nullable command batching.
- The latest Step 4 slice extended the shared route-presence guard to the pool-photo read route, keeping missing-pool failures aligned across read and mutation paths without hiding the read response shape.
- The latest Step 4 slice moved durable socket command registration onto declarative listener specs, so state-patch, photo, pool, async-job, and admin-secret socket handlers now specialize one shared registration boundary while the intentional socket-only telemetry and Google Photos refresh tail stay explicit.
- The latest Step 4 slice standardized the remaining simple reducer setter/effect branches, so split-layout, scale, theme, interval, screensaver, admin-secret, and async-job commands now share small command reducers plus pure payload builders instead of repeating field-update and effect-shaping ceremony.
- The latest Step 4 slice standardized the remaining photo-library mutation branches into one reducer-spec boundary, so rating, broken-photo, crop, pairing, and metadata commands now specialize shared `url -> update -> persist -> finalize playback` plumbing while keeping their distinct updater and finalizer rules visible as data.
- The latest Step 4 slice standardized the remaining transport command decoders into shared required-value decoder specs, so photo and pool mutations now read as small normalization combinators plus command-local payload policies instead of repeating `require field -> normalize -> build command` shells across REST and Socket.IO adapters.
- The latest Step 4 slice standardized the remaining photo and pool REST patch decoders into shared optional-command spec pipelines, so `server/routes.js` now reads as declarative mutation-spec data plus one `decode -> collect -> dispatch` interpreter instead of hand-building the same optional command parts route by route.
- The latest Step 4 slice standardized the remaining feed-mutating reducer branches into one reducer-spec boundary, so category selection, excluded-keyword updates, and pool deletion now specialize one `normalize payload -> apply -> recompute -> finalize` interpreter while preserving forced reselect, no-op, and persistence semantics.
- The latest Step 4 slice standardized the remaining pool-creation and pool-config reducer branches into one reducer-spec boundary, so add-pool, pool-keyword, and feed-config commands now specialize one `read payload -> apply -> persist/effect` interpreter while preserving duplicate-add, missing-pool, and equality-aware no-op semantics.
- The latest Step 4 slice standardized the remaining playback-selection reducer branches into one reducer-spec boundary, so `set-active-photo` and `advance-photo` now specialize one `read payload -> select photo -> optionally stage preview -> activate` interpreter while preserving preview insertion, sequence-vs-smart navigation, and missing-photo no-op semantics.
- The latest Step 4 slice centralized durable socket state-patch specs in the shared command module, so the socket adapter, the legacy compatibility fallback, and the domain tests now reuse one declarative `event -> patch builder -> patch-state command` boundary instead of rebuilding that decoder wiring locally.
- The latest Step 4 slice centralized the remaining durable socket command metadata in the shared command module, so category/photo/pool/playback, async-job, and secret-save socket handlers now register from declarative shared specs while `server/sockets.js` keeps only transport-owned fallback resolution, acknowledgements, telemetry, and signed-URL refresh behavior.
- The latest Step 4 slice centralized the shared `patch-state` contract in `server/domain/statePatch.js`, so the decoder, reducer, and legacy socket fallback now reuse one scalar field inventory plus one pure normalization boundary for `visionConfig` and manual location instead of carrying parallel state-patch lists and normalizers.
- The latest Step 4 slice standardized `patch-state` reducer application through declarative spec rows, so scalar config fields, excluded keywords, widgets, vision config, and location settings now share one explicit `read -> compare -> apply -> flag` interpreter instead of a hand-built chain of patch handlers.
- The latest Step 4 slice moved the remaining repeated REST command registrations onto shared route specs, so admin-secret, async-job, and advance-photo POST families now specialize declarative metadata through the same `decode -> dispatch -> present` shell instead of repeating route registration ceremony inline.
- The latest Step 4 slice centralized the remaining cross-transport command-family metadata, so REST and Socket.IO now derive the admin-secret, async-job, and next/prev-photo families from one shared declarative source instead of re-declaring parallel transport-specific tables with the same command facts.
- The latest Step 4 slice centralized the remaining photo/pool REST patch command facts in the shared command module, so the route shell now consumes exported photo-patch spec rows, pool-patch spec builders, and pool-scoped recrawl decoding instead of restating those command details inline.
- The latest Step 4 slice extended that shared photo-patch path with permanent-collection loved metadata, so the reducer and remote controls gained one more declarative photo mutation while crawler capping became a pure partition of originals, loved dynamic photos, and standard dynamic photos.
- The latest Step 4 slice centralized overlapping photo-mutation transport specs, so the REST photo patch route specs and durable socket photo command specs now specialize one shared declarative family while keeping loved-photo patches route-only and metadata-reporting socket-only where those transport boundaries are intentional.
- The latest Step 4 slice collapsed the remaining standalone REST single-command registrations in `server/routes.js` onto one local method-aware spec table, so the route shell keeps its explicit `decode -> guard -> dispatch -> present` behavior while dropping another pocket of repeated registration ceremony without exporting route-only presentation policy into the domain layer.
- The latest Step 4 slice collapsed the remaining socket command-listener registration ceremony onto one shared listener-family table, so `server/sockets.js` now interprets state-patch, durable-command, async-job, and secret-save listeners through one explicit registration pipeline while keeping telemetry, viewport updates, signed-URL refresh, and disconnect lifecycle behavior outside that shared command boundary.
- The latest Step 4 slice centralized overlapping pool-mutation transport specs, so the REST pool patch specs and durable socket pool command specs now specialize one shared declarative family while keeping pool-scoped recrawl submission and pool create/delete routes outside that boundary where those transport differences are intentional.
- The latest Step 4 slice collapsed the remaining photo/pool patch transport shapers onto one shared builder, so the shared command module now derives both families' route specs and socket specs through the same declarative `route/socket transport family -> interpreter` boundary while preserving route-only loved-photo patches, socket-only metadata reporting, and dynamic feed-config route expansion where those differences are intentional.
- The latest Step 4 slice collapsed the remaining ad hoc simple config/runtime setter branches onto one shared field-entry reducer shell, so `set-split-portrait`, `set-split-crop`, `set-scale-mode`, `change-theme`, `change-interval`, and `set-screensaver-active` now specialize the same `read entries -> assign changed fields -> maybe persist/effect` boundary while the kiosk launch/kill effect remains explicit in the command table.
- The latest Step 4 slice collapsed the repeated REST-first client fallback branches onto one higher-order `request -> 404 legacy socket fallback` adapter, so category, screensaver, async-job, and admin-secret actions now provide transport metadata as data while preserving non-404 error propagation.
- The latest Step 5 slice moves that client fallback metadata into pure, JSDoc-covered mutation request plans, so REST bodies and legacy Socket.IO payloads are projected from one declarative vocabulary while fetch and socket emission remain an explicit imperative interpreter.
- The latest Step 5 slice extracts `client/src/api/jsonClient.js` as the shared JSON transport boundary, so dashboard reads, environment administration reads/posts, and Google credential posts use one typed/JSDoc-ready request interpreter while content-type/error classification remains explicit and view-specific presentation stays local.
- The latest Step 5 slice removes Dashboard's duplicate `state-sync` subscription: App-level normalization is now the sole live snapshot entry point, while Dashboard keeps only its local in-flight dismissal guard and derives particle lifecycle from `state.screensaverActive`.
- The latest Step 5 slice extracts `projectCredentialSaveStatus(...)` for the two RemoteControl credential acknowledgement events. Their event names, input setters, and status reset timing remain explicit at the effect boundary.
- The latest Step 5 slice extracts `projectJobEvent(...)` for `job-status` and `recrawl-complete`, adapting both envelopes to `projectJobStatus(...)` before one declarative RemoteControl application shell updates the selected job target.
- The latest Step 5 slice extracts `projectPhotoEvent(...)` for `photo-update` and `second-photo-update`, adapting both wire events to the existing side-aware frame projection before App applies the immutable snapshot update.
- Step 5 closeout: snapshot normalization and live-sync projections now have one pure boundary per repeated vocabulary, with explicit transport effects and view-specific state application; Step 6 is the next focus.
- Step 6 first slice: `frameSelectors.js` now has a local checked contract for client snapshots, current frames, photo-event projections, and crop selectors. The browser boundary stays independent from server domain imports so the later TypeScript move can preserve these public shapes mechanically.
- Step 6 second slice: `categorySelection.js` now has a local checked contract for category selections, legacy aliases, snapshot fallback sources, and toggle inputs. Its composed normalization pipeline and data-first signatures remain runtime-compatible with existing feed mutations.
- Step 6 third slice: `jobStatus.js` now has a local checked contract for the closed job-type vocabulary, modern and legacy event envelopes, and the shared status-update algebra. Payload compatibility remains at the pure projection boundary while React target selection stays explicit.
- Step 6 fourth slice: `photoCrop.js` now has a local checked scalar contract for display-mode baselines and crop interpolation. Its numeric formulas and absent-mode cover fallback remain unchanged, keeping the shared preview helpers ready for mechanical TypeScript conversion.
- Step 6 fifth slice: `screensaverActivity.js` now has a local checked event contract for Escape detection and active-screensaver dismissal classification. The safety-sensitive event vocabulary and inactive/unknown no-op behavior remain unchanged.
- Step 6 sixth slice: `poolPolicyDrafts.js` now has local checked contracts for normalized policy defaults, nested schedules, and the partially applied immutable draft merge. Draft form strings remain representable without moving coercion into the pure client boundary.
- Step 6 seventh slice: `keywordInput.js` now has a local checked contract for unknown-safe pasted keyword input and timed feed-parameter parsing. Its data-first parser signatures and exact phrase preservation remain runtime-compatible with the Image Feeds editor.
- Step 6 eighth slice: `credentialStatus.js` now has a local checked contract for the credential-save status algebra. Unknown acknowledgements remain inert, and the remote effect shell retains event-specific input clearing.
- Step 6 ninth slice: `poolLifecycleView.js` now has local checked contracts for schedule inputs, lifecycle policy projections, summaries, rows, and policy readers. Schedule fallback and row mapping remain pure, with persisted-policy reads and React rendering outside the boundary.
- Step 6 tenth slice: `googlePhotosPicker.js` now has local checked contracts for the external-source copy vocabulary and visible credential status. Copy/status projection remains pure, while OAuth initiation, transport, and React effects stay at the presentation shell.
- Step 6 eleventh slice: `actionPlans.js` now has local checked contracts for generic durable field patches and nested widget-visibility patches. Its partially applied builders remain runtime-compatible and free of transport or React effects.
- Step 6 twelfth slice: `mediaRecovery.js` now has local checked contracts for the retry/hold/skip decision and origin probe URL projection; fetch, timers, and socket effects remain in the Dashboard shell.
- Step 6 thirteenth slice: `imageFeedsPanels.js` now has local checked contracts for the closed panel state, unknown-safe persisted preferences, and injected storage adapters. Immutable state transitions and codecs remain pure, with browser effects outside the helper.
- Step 6 fourteenth slice: `requestPlans.js` now has local checked contracts for mutation results, legacy fallback envelopes, and generic plan specifications. REST and Socket.IO payload projections remain pure and partially applicable, with network execution outside the helper.
- Step 6 fifteenth slice: `jsonClient.js` now has local checked contracts for parsed API error payloads, request options, and generic JSON payload results. Media-type classification and fetch remain at the transport edge, with no runtime behavior change.
- Step 6 sixteenth slice: `swipeGesture.js` now has local checked contracts for touch-coordinate decoding and strict-threshold direction/status projection. `useSwipeGesture.js` retains action callbacks and reset timers as the effect shell.
- Step 6 seventeenth slice: `cropDrag.js` now has local checked contracts for pointer-coordinate decoding and bounded crop-position projection. `useCropDrag.js` retains DOM listeners, timeout coalescing, React state, and crop-action dispatch as the effect shell.
- Step 6 eighteenth slice: `server/utils/fn.js` now has checked contracts for currying, composition, data-last collection combinators, and closed declarative interpreters; the zero-dependency functional core remains runtime-compatible and null-safe.
- Step 6 nineteenth slice: `server/utils/validation.js` now has checked contracts for the curried numeric range validator and its specialized rating, percent, and crop validators; parser projection and null-on-invalid behavior remain runtime-compatible.
- Step 6 twentieth slice: `server/config/env.js` now has checked contracts for unknown-safe environment normalization and the pure replace-or-append content projection; filesystem and process-environment mutation remain in the effectful persistence shell.
- Step 6 twenty-first slice: `server/services/sentiment.js` now has checked contracts for the partially applied lexicon counters, declarative RSS headline extraction, score classification, and final sentiment result; empty-feed identity and existing labels remain runtime-compatible while refresh effects stay outside the pure projection.
- Step 6 twenty-second slice: `server/domain/poolRetention.js` now has checked contracts for normalized schedules/policies, immutable loved-photo capping, and data-last retention transforms; the existing prune-then-cap composition remains runtime-compatible and persistence stays outside the pure domain core.
- Step 6 twenty-third slice: `server/domain/photoTimestamps.js` now has an open checked `PhotoRecord` contract for timestamp normalization and immutable stamping; source-specific metadata remains extensible and malformed clocks preserve inert identities without moving persistence into the domain helper.
- Step 6 twenty-fourth slice: `server/domain/poolSchedule.js` now has checked contracts for untrusted schedule inputs, policy maps, resolved schedule records, and local-time projections; category appends, schedule activity, and priority selection remain pure while the interval runtime retains dispatch and boundary restoration effects.
- Step 6 twenty-fifth slice: `server/domain/snapshot.js` now has checked contracts for legacy-state decoding, domain/public snapshot projection, runtime overrides, and the compatibility mutation shell; immutable normalization and current-frame derivation remain pure while in-place legacy synchronization stays explicit.
- Step 6 twenty-sixth slice: `server/domain/environmentSettings.js` now has checked contracts for untrusted device inputs, canonical catalogs, runtime/legacy projections, immutable profile updates, and adapter validation; the settings algebra remains pure while config persistence and sensor-runtime updates stay in `app.js`.
- Step 6 twenty-seventh slice: `server/services/ecowitt.js` now has checked contracts for vendor payload decoding, canonical indoor readings, settings normalization, validation, and public environment responses; the protocol projection remains pure while polling, timeouts, logging, and network effects stay in the adapter shell.
- Step 6 twenty-eighth slice: `server/services/sensorHistory.js` now has checked contracts for sensor/weather inputs, normalized hourly records, query/statistics results, CSV projection, and the injected SQLite store interface; invalid-timestamp nulls and limit defaults remain unchanged while database operations stay in the store interpreter.
- Step 6 twenty-ninth slice: `server/services/sensorPlatform.js` now has checked contracts for adapter descriptor metadata, registration input, normalized adapter records, public summaries, settings results, and the platform interface; descriptor/summary metadata isolation, alias resolution, and effect delegation are covered without changing runtime behavior.
- Step 6 thirtieth slice: `server/services/weather.js` now has checked contracts for the WMO weather vocabulary, lookup table, and classifier result; every mapped code and the cloudy unknown-code fallback remain covered without changing runtime behavior.
- Step 6 thirty-first slice: `server/runtime/environmentRefresh.js` now has checked contracts for forecast snapshots and physical-weather projections; provider field selection, nested reference preservation, rounded temperature, and the absent-current no-op are covered without moving refresh effects into the pure boundary.
- Step 6 thirty-second slice: `server/runtime/activeFeed.js` now has checked contracts for legacy category parsing, available-category normalization, and balanced feed projection; tests preserve external-pool support, exclusion behavior, and source immutability while `photosList` assignment stays in the shell.
- Step 6 thirty-third slice: `server/runtime/idleDaemon.js` now has checked contracts for normalized host observations, daemon inputs, and screensaver transitions; tests preserve the inclusive inactivity threshold, audio/session blockers, closed action vocabulary, and immutable projections while polling and host effects stay in the runtime shell.
- Step 6 thirty-fourth slice: `server/runtime/kioskControl.js` now has a checked closed contract for its pure runtime-context projection; tests preserve the exact three-field output and input immutability while process, governor, retry-timer, and logging effects stay in the runtime shell.
- Step 6 thirty-fifth slice: `server/runtime/poolSchedule.js` now has a checked five-field status contract; tests preserve null/empty states and detached category arrays while polling, dispatch, and restoration remain in the runtime shell.
- Step 6 thirty-sixth slice: `server/utils/routeDecode.js` now has generic checked contracts for bare-value normalization, success/failure results, Functor mapping, fail-fast chaining, and ordered collection; tests preserve failure identity and the empty-success identity while HTTP response effects stay in routes.
- Step 6 thirty-seventh slice: `server/utils/keywordSpecs.js` now has checked unknown-safe contracts for normalization, timed-spec cloning, normalized equality, and ordered term collection; tests preserve phrase boundaries, ordering, and detached nested arrays.
- Step 6 thirty-eighth slice: `server/config/state.js` now has checked contracts for the pure keyword-to-feed-config projection; tests preserve ordered normalized terms, independent source arrays, and input immutability while mutable `screensaverState` stays at the module boundary.
- Persistence slice: `server/config/collectionsCodec.js` now applies first-occurrence URL deduplication to persisted pool feeds and cleans legacy duplicate rows at load while preserving other snapshot metadata; tests cover the pure immutable projection and disk migration.
- Step 6 thirty-ninth slice: `server/config/collectionsCodec.js` now documents open persisted-record inputs and stable normalized/serialized snapshot outputs; tests preserve input immutability, deterministic timestamps, URL ownership, and migration behavior while filesystem effects remain in the codec shell.
- Step 6 fortieth slice: `server/config/collectionPhotoProjections.js` now has checked curried photo-by-URL and photo-list contracts; tests preserve partial application, unmatched/null identity, immutable mapping, and source records while the collection mutation and persistence shell stays in `collections.js`.
- Step 6 forty-first slice: `server/config/localSettings.js` now documents checked config-section contracts for the pure partial merge; tests preserve Ecowitt unit merging, shallow sensor-history replacement, ignored unsupported patch keys, and input immutability while file writes stay in `saveLocalConfigPatch(...)`.
- Step 6 forty-second slice: `server/config/configLoaderProjections.js` now exposes checked contracts for pure defaults/overrides and deprecated-secret filtering; tests preserve section merge depth, extension keys, and input immutability while file reads and warnings stay in `configLoader.js`.
- Step 6 forty-third slice: `server/config/collectionPhotoUpdatePlan.js` now exposes a checked pure plan for collection, feed-list, and paired-frame updates; tests preserve immutable inputs, rating-1 pruning, and identity-preserving missing-photo behavior while `collections.js` applies state changes and persists.
- Step 6 forty-fourth slice: `server/config/collectionPhotoUpdaters.js` now exposes checked immutable rating, crop, pairing, and broken-photo projections; tests preserve native `parseInt` behavior, partial updates, truthiness coercion, and input immutability while `collections.js` retains mutation and persistence.
- Step 6 forty-fifth slice: `server/config/collections.js` and `server/config/configLoader.js` now document checked input and effect-shell contracts; focused tests pin photo updater inputs and the explicit mutation, persistence, file-read, and warning boundaries.
- Step 6 forty-eighth slice: `applyCachedMediaItemMetadataToState(...)` now documents its live snapshot input, return value, and mutation order; tests pin matched-row copies, unmatched-row identity, in-place active-frame updates, allowlisted metadata, and invalid/no-match behavior while snapshot ownership stays in `googlePhotos.js`.
- Step 6 forty-ninth slice: `updateCachedMediaItemMetadata(...)` now documents cache input, return, and conditional persistence; tests cover match/no-match results, unchanged patches, test-mode write suppression, and the production changed-only write while immutable metadata merging remains in `googlePhotosCache.js`.
- Step 6 fiftieth slice: `refreshCachedMediaItem(...)` now documents session fallback, nullable return, missing-item rejection, and cache-upsert behavior; focused contract assertions preserve its Picker request and persistence shell without changing runtime behavior.
- Step 6 fifty-first slice: `refreshMediaItemUrl(...)` now documents media-id and render-option inputs, mock and authenticated URL results, and logged rejection behavior; focused source-contract and mock-path tests preserve the authentication/network shell without changing runtime behavior.
- Step 6 fifty-second slice: `fetchMediaItemBytes(...)` now documents its media-id/render inputs and byte/content-type result; focused source-contract and zero-byte-cache fallback tests preserve the local-cache, Picker-refresh, authentication, network, and persistence shell without changing runtime behavior.
- Step 6 fifty-third slice: `cleanOrphanedMediaFiles(...)` documents the retained media-id input, missing-directory/test-mode no-ops, best-effort filesystem effects, and its use of the pure orphan projection; focused contract and projection tests preserve behavior without changing runtime code.
- Step 6 fifty-fourth slice: `downloadSyncMediaItems(...)` documents selected-media inputs, cache/test-mode skips, sequential completion, and the per-item versus batch error boundary; isolated service tests preserve immutable inputs, download/write ordering, and continuation after network, body-read, and write failures without changing runtime behavior.
- Step 6 fifty-fifth slice: `getCachedMediaItems()` documents normalized render rows, first-usable-id ordering, serialization-based changed-only persistence, and read/write failure boundaries; isolated service tests pin normalization, metadata retention, serialization idempotence, test-mode suppression, and missing/corrupt/non-array cache behavior without changing runtime code.
- Step 6 fifty-sixth slice: `buildGooglePhotoContentUrl(...)` documents its pure base-URL/render-option input and string result; isolated tests pin independent undefined-only defaults, width/height/crop ordering, empty-base identity, verbatim interpolation, deterministic repeated application, and frozen option preservation without changing runtime code or production exports. Its existing data-first interface remains the clearest expression; no new algebra is needed.
- Step 6 fifty-seventh slice: `isBaseUrlStale(...)` documents its cached-timestamp input and boolean result; isolated-clock tests pin absent/falsy short-circuiting, the inclusive 55-minute TTL, future timestamps, legacy subtraction coercion, frozen rows, one clock read per timestamped call, and clock failure propagation. The clock-dependent predicate remains in the service shell; no runtime changes, global clock patches, or new production exports are needed.
- Step 6 fifty-eighth slice: `getValidToken()` documents cached/refreshed token results and rejected authentication/refresh/clock failures, replacing the unsupported guaranteed-valid claim. Isolated service tests pin missing-token short-circuits, the strict five-minute boundary, mock tokens, delayed OAuth completion and reuse, legacy expiry coercion, missing response tokens, and network/HTTP/JSON failures on both refresh paths. Tests compose independent cases with `map`, `flatMap`, and `Promise.all`; no runtime changes or new production exports are needed.
- Step 6 fifty-ninth slice: `refreshAccessToken()` documents refreshed/synthetic results, token mutation ordering, and logged versus unlogged rejection boundaries. Seven focused tests use isolated service adapters and declarative case tables to pin encoded OAuth requests, awaited JSON completion, retained refresh tokens without persistence, mock clock ordering, legacy payload coercion, and partial updates on clock failure. The existing effect shell and production exports remain unchanged; wrapping it in a pure or curried abstraction would not simplify this contract-only seam.
- Step 6 sixtieth slice: `exchangeGoogleCode(...)` documents authorization inputs, its service-owned mutable token result, and rejection ordering. Seven focused tests use isolated service/persistence adapters and declarative case tables to pin mock credential fallback and clocks, encoded OAuth requests, awaited JSON, truthy refresh-token fallback, persistence normalization/skips, coercion, and failures before versus after state replacement. Returned-object aliasing and persistence-failure state are intentional compatibility observations, not purity or validity guarantees; runtime behavior and production exports remain unchanged.
- Step 6 sixty-first slice: `getGoogleAuthUrl(...)` documents callback inputs, URL results, and synchronous encoding failures. Six focused tests compose declarative cases over isolated service adapters to pin client-ID-only fallback, logged relative sandbox URLs, silent absolute OAuth URLs, the exact Picker-only parameter list, native coercion, branch-specific Unicode handling, repeatability for fixed credentials, and later credential replacements without token effects. Its small data-first construction remains readable; credential reads and logging belong in the service shell, with no new algebra, runtime changes, or production exports. Callback validation and OAuth state remain separate hardening work.
- Step 6 sixty-second slice: `saveGoogleCredentials(...)` documents string inputs, boolean results, and synchronous failure boundaries. Seven focused tests compose declarative cases over isolated adapters to pin trim completion before replacement, empty-string acceptance, native trim dispatch, unchanged credentials on invalid inputs, replacement before persistence, logging order, failure without rollback, retry behavior, nullish thrown-value handling, and repeated saves without token effects. Existing data-first inputs and the small effect shell remain unchanged; no new algebra or production exports are needed.
- Step 6 sixty-third slice: `isAuthenticated()` documents its synchronous boolean presence contract, replacing the unsupported authenticated-user claim. Five focused tests compose native-truthiness cases and expiry/refresh-token/credential combinations with `map` and `flatMap`, plus isolated token exchanges, to pin coercion-free projection, unchanged state, current-state reads after replacement, and absence of clock/network/cache/persistence/logging effects during the check. The existing zero-argument service-state reader remains the clearest boundary; it is deterministic for fixed state but not a pure function of explicit inputs. No runtime changes, curried wrapper, algebra, or production exports are needed.
- Step 6 sixty-fourth slice: `createPickerSession()` documents synthetic or unvalidated JSON results and branch-specific rejections, replacing the unsupported secure-session claim. Seven focused tests compose independent case tables with `map` and `Promise.all` over isolated effect adapters to pin the access-token guard, malformed-token failures, synthetic clock behavior, exact POST metadata, awaited refresh/JSON completion, retained refreshed state, and request-only logging. The explicit effect shell is clearer than a new pure, curried, or algebraic wrapper; runtime behavior and production exports remain unchanged.
- Step 6 sixty-fifth slice: `getPickerSession(sessionId)` documents its string input, synthetic or unvalidated JSON result, and rejection boundaries. Seven focused tests compose independent cases with `map`, `flatMap`, and `Promise.all` over isolated effect adapters to preserve native input dispatch, fresh synthetic records without authentication, verbatim GET metadata, raw JSON identity, refresh-token-only authentication, awaited JSON completion, retained token state, and request-only logging without HTTP body reads. The existing data-first effect shell remains clearer than a curried or algebraic wrapper; runtime behavior and production exports remain unchanged.
- Step 6 sixty-sixth slice: `listPickerMediaItems(sessionId)` documents its string input, accumulated raw-item result, sequential pagination, and rejection boundaries. Eight focused tests compose independent case tables with `map`, `flatMap`, and `Promise.all` over isolated adapters to preserve synthetic independence, encoded queries, refreshed-token reuse, awaited pages, 250-row accumulation, array-concatenation partition/empty identities, duplicate/reference retention, native payload/token handling, and logged versus unlogged failures without partial results. Array concatenation supplies the useful monoidal law without a new abstraction; the data-first sequential effect shell, runtime behavior, and production exports remain unchanged.
- Step 6 sixty-seventh slice: `deletePickerSession(sessionId)` documents its string input, asynchronous Fetch boolean result, and failure boundaries. Eight focused tests compose case tables with `map`, `flatMap`, and `Promise.all` over isolated adapters to preserve synthetic no-ops, exact verbatim DELETE metadata, absence of body reads, awaited refresh-only authentication and request completion, silent HTTP flags, handled request/property failures, nullish-handler rejections, refreshed-state retention, raw adapter flags, and repeated requests. The data-first effect shell remains clearer than a new curried or algebraic wrapper; runtime behavior and production exports remain unchanged.
- Step 6 sixty-eighth slice: `syncGoogleAlbum(...)` documents named adapter/options and incoming-row result contracts. Eight focused tests compose declarative adapter records and independent cases with `map` and `Promise.all` to preserve token guards, append/upsert, metadata, immutable inputs, duplicate incoming results versus capped union, empty-input policy work, awaited listing, background download failures, and partial effects without rollback. Existing pure union and data-last policy transforms remain separate from the data-first orchestration shell; no new algebra, runtime change, or production export is needed.
- Step 6 sixty-ninth slice: `findCachedMediaItem(...)` documents exact-id input and nullable normalized-row output. Seven focused tests compose immutable fixtures and declarative case tables with `map`/`forEach` over isolated adapters to preserve strict equality without coercion/decoding, first structurally usable rows, metadata, fresh reads and detached results, normalization persistence even on misses, test-mode suppression, null fallbacks, and propagated failures. The existing `find` expression is already the clearest projection; filesystem effects stay in the service shell without a new curried/algebraic wrapper, runtime change, or production export.
- Step 6 seventieth slice: `readCachedMediaItemsRaw()` documents its unknown JSON result and missing/read/parse fallbacks. Seven focused tests compose declarative JSON/failure cases over isolated adapters to preserve unvalidated shapes and metadata, fresh UTF-8 reads, detached results, empty-array fallbacks, warning details, and propagated existence-check/handler failures. Filesystem reads and logging remain explicit in the service shell; no pure/curried/algebraic wrapper, runtime change, or production export is needed.
- Step 6 seventy-first slice: `writeCachedMediaItems(...)` documents unknown input, native two-space JSON serialization, synchronous UTF-8 persistence, and void result. Eight focused tests compose declarative cases over isolated adapters to preserve exact bytes, frozen metadata/duplicates, native hooks, caller-owned guards, repeated writes, undefined-data rejection, and unchanged serialization/write failures without retry or rollback. The one-write data-first shell remains clearer than a new pure/curried/algebraic wrapper; pure row normalization, runtime behavior, and production exports remain unchanged.
- Step 6 seventy-second slice: `updateCachedMediaItem(...)` documents a generic input/result identity contract for normalized-cache whole-row upsert and unconditional persistence. Nine focused tests compose declarative cases over isolated adapters to preserve first-usable normalization, stable replacement/appended-key order, verbatim keys, frozen inputs, caller-owned metadata/policy, repeated writes in both modes, fallbacks, native hooks, and failures before versus after normalization persistence. Serialized-value idempotence does not imply effect idempotence. The concise data-first Map shell remains clearer than a new curried/algebraic wrapper; pure normalization, runtime behavior, and production exports remain unchanged.
- Step 6 seventy-third slice: `persistGoogleRefreshToken(...)` documents unknown-input normalization, empty/case-sensitive mock skips, synchronous single-field persistence, and void results. Seven focused tests compose declarative value/failure cases and frozen coercion fixtures over isolated adapters to preserve native hooks, repeated writes in both modes, ignored adapter results, token/credential isolation, and unchanged failures without retry or rollback. The concise data-first normalization/guard/effect shell remains clearer than a new curried/algebraic wrapper; runtime behavior and production exports remain unchanged.
- Step 6 seventy-fourth slice: `isGooglePhotoProxyUrl(...)` documents unknown inputs, boolean results, and delegated coercion/URI failures. Seven focused tests compose declarative vocabulary tables and generated URL/render-option combinations to preserve decoder composition, single decoding, query removal, non-empty unvalidated ids, frozen inputs, native hooks, repeatability, and absence of service effects. The existing data-first Boolean-after-decoder composition is clearer than a new curried or algebraic wrapper; runtime behavior and production exports remain unchanged.
- Step 6 seventy-fifth slice: `getLocalMediaFilePath(...)` documents unknown inputs, normalized platform-string results, and native coercion failures. Six focused tests use declarative cases and frozen hooks to preserve unconditional JPG suffixing before normalization, literal percent escapes, unvalidated dot segments/separators, hook order, repeatability, and absence of service effects in both modes. The existing data-first projection is clearer than currying or an algebraic wrapper; runtime behavior and production exports remain unchanged.
- Step 6 seventy-sixth slice: `difference(...)` documents generic read-only Set inputs and a fresh ordered Set result with native SameValueZero/reference membership. Six focused tests compose finite case tables and generated subsets to preserve left order, shallow reference identity, input immutability, empty/self subtraction, exclusion and repeated-subtraction laws, and successive exclusions through right-hand union. A non-associativity counterexample prevents a misleading Semigroup/Monoid interpretation; the existing concise data-first projection, runtime behavior, and production exports remain unchanged.
- Step 6 seventy-seventh slice: `getOrphanedFiles(...)` documents read-only array inputs and detached ordered results with exact platform-basename matching. Six focused tests compose declarative path cases and generated active-id subsets to preserve original paths, duplicate entries, fresh empty/no-exclusion identities, immutable inputs, concatenation, idempotence, active-id union, and unchanged native/hook failures. For fixed active ids, filtering preserves the array concatenation/empty identity laws without a new abstraction; the existing pure data-first Set projection, runtime behavior, and production exports remain unchanged. Filesystem reads and deletion stay in the cleanup shell.
- Step 6 seventy-eighth slice: `fetchMediaItemBytes(...)` refines its local-cache fast-path contract. Eight focused tests compose declarative cases with `map` and `Promise.all` over isolated adapters to preserve normalization before file access, original Buffer identity, MIME truthiness, repeated reads, authentication/render-option bypass, missing/empty/read/unlink fallback, partial effects, and pre-authentication or warning-handler rejection ordering. Existing pure cache/path projections remain separate from the data-first effect shell; currying or a new algebra would obscure the ordered effects. Runtime behavior and production exports remain unchanged.
- Step 6 seventy-ninth slice: `fetchMediaItemBytes(...)` refines candidate-URL preparation contracts. Eight focused tests compose declarative cases over isolated adapters to preserve awaited OAuth, missing/stale Picker refresh precedence at the inclusive TTL, original cached-base fallback after persistence, exact ordered URL deduplication, on-demand resolution only for empty candidates, synthetic dispatch, and clock/projection/warning/resolver failures. Existing pure cache and URL projections stay separate from the data-first ordered effect shell; no new curried or algebraic wrapper, executable production change, or export is needed.
- Step 6 eightieth slice: `fetchMediaItemBytes(...)` refines remote retrieval and final Picker retry contracts. Eight focused tests compose declarative cases over isolated adapters to preserve sequential HTTP fallback versus immediate thrown rejection, decoding, truthy MIME selection, byte-write/header ordering, empty-buffer differences, exact retry uniqueness, original token/hint retention despite refresh, and partial effects. Deferred responses verify sequencing. Existing pure cache/URL projections remain separate from the data-first effect shell; no new algebraic wrapper, executable production change, or export is needed.
- Step 6 eighty-first slice: `applyCachedMediaItemMetadataToState(...)` refines identifier decoding, pre-guard projection, truthy-id matching, alias identity, and partial-failure contracts. Eight focused tests compose declarative cases through `map`, `flatMap`, and `forEach` over detached snapshots; repeated equal-value patches preserve values but allocate new list rows, while active aliases retain identity. Pure id/patch projections stay separate from the data-first mutation shell. No curried or algebraic wrapper, executable production change, or export is needed.
- Step 6 eighty-second slice: `updateCachedMediaItemMetadata(...)` refines read-before-projection ordering, strict cached-id matching, copied results, !== change detection, changed-only full-cache writes, exact test-mode suppression, and partial failures. Eight focused tests compose declarative cases over isolated adapters; repeated persisted scalar patches are value-idempotent but return fresh copies. Pure merging remains separate from the data-first cache shell; no curried/algebraic wrapper, executable production change, or production export is needed.
- Step 6 eighty-third slice: `mergeCachedMediaItemMetadata(...)` refines read-only input, strict identifier, shallow-copy/alias, change-detection, and failure contracts. Eight focused tests compose declarative cases over frozen ordinary data; generated patch triples verify associativity/identity for projected right-biased patches and composition/idempotence on row values. All duplicate matches update, the last output row is returned by alias, sparse/falsy entries survive, and nested values remain shared. Result envelopes are not a patch-composition Monoid: changed flags can cancel and clone references differ. The existing pure data-first mapping needs no new abstraction; executable production code and exports are unchanged, and cache effects remain in the service shell.
- Step 6 eighty-fourth slice: `buildGooglePhotoMetadataPatch(...)` refines its read-only input, fixed eager allowlist reads, undefined-only omission, fresh plain output, shallow aliases, and exact property-access failures. Seven focused tests compose declarative field/value cases and generated frozen records to verify inherited/non-enumerable reads, native primitive/null behavior, output descriptors, stopped reads, and value-idempotent projection. Existing projected-patch composition laws remain covered: projection is not a homomorphism from raw spread containing undefined. The concise pure data-first entries/filter/fromEntries pipeline needs no curried or algebraic wrapper; executable production code and exports are unchanged, and validation/cache effects stay separate.
- Step 6 eighty-fifth slice: `getPickerItemMimeType(...)` refines read-only nested/legacy inputs, truthiness-before-trimming, native string coercion, repeated file/flat reads, and exact failure propagation. Seven focused tests compose declarative cases over frozen records and isolated hooks; they cover whitespace suppression of fallback, non-string/primitive values, inherited/non-enumerable fields, changed accessors, and normalization stability under flat/nested re-embedding. The existing pure data-first scalar projection is not a record endomorphism and needs no curried or algebraic wrapper. Executable production code and exports are unchanged; MIME validation and network/cache effects remain separate.
- Step 6 eighty-sixth slice: `getGooglePhotoMediaItemId(...)` refines unknown-input coercion, exact relative-prefix recognition, first-query splitting, one-pass decoding, and native failures. Seven focused tests compose declarative cases and generated well-formed string ids to verify the proxy codec's round-trip law across render options; this is not decoder idempotence. Frozen ordinary inputs stay unchanged, while caller coercion-hook effects survive failures. The existing pure data-first decoder needs no curried or algebraic wrapper; executable production code and exports are unchanged. Identifier validation and filesystem containment remain separate security work.
- Step 6 eighty-seventh slice: `buildGooglePhotoProxyUrl(...)` refines read-only render options, undefined-only independent defaults, eager named reads, ordered native coercion, id versus form-query encoding, truthy crop, and exact failure propagation. Seven focused tests compose declarative cases over frozen data and isolated hooks; they preserve query ordering, inherited/non-enumerable reads, primitive compatibility, distinct lone-surrogate behavior, and stopped reads/coercions after failure. Existing generated codec round-trips remain covered; builder idempotence is not claimed, and no currying or algebraic wrapper is needed. Executable production code and exports are unchanged; validation and cache/filesystem effects remain separate.
- Step 6 eighty-eighth slice: `getPickerItemDimensions(...)` refines read-only nested/legacy metadata selection, native base-10 parsing, independent positive-finite defaults, and exact failure propagation. Seven focused tests compose declarative cases through the existing cache-row builder; frozen records, inherited/hidden fields, repeated reads, and isolated hooks preserve whole-metadata precedence and width-before-height coercion. Generated safe-integer pairs verify re-embedding stability; a large-number counterexample prevents a false global idempotence claim. The existing pure data-first projection needs no currying or algebraic wrapper. Executable production code and exports are unchanged; cache-row clocks, I/O, and validation stay separate.
- Step 6 eighty-ninth slice: `getPickerItemBaseUrl(...)` refines read-only nested/legacy file selection, truthiness-before-trimming, native string coercion, and exact failures. Seven focused tests compose declarative cases through the existing cache-row builder; frozen records, inherited/hidden fields, repeated reads, and isolated hooks preserve selected-file-only base reads and stopped work after failures. Cached/legacy fallback belongs to the builder after trimming, not the pure helper's file selection. Generated flat/nested re-embedding cases verify scalar normalization stability, not a record endomorphism. The existing pure data-first projection needs no currying or algebraic wrapper. Executable production code and exports are unchanged; URL validation and cache-row clocks/I/O stay separate.
- Step 6 ninetieth slice: `extractLegacyBaseUrl(...)` refines unknown-input coercion, exact rejected prefixes, first-literal-equals splitting, and native failures. Seven focused tests compose declarative cases through existing cache projections; frozen data, inherited/hidden fields, and isolated hooks preserve fallback ordering, stopped work after failures, and the builder-versus-normalizer trimming distinction. Generated cases verify fixed points on normalized equals-free, non-rejected bases; a trailing-space counterexample rules out global idempotence. The existing pure data-first projection needs no currying or algebraic wrapper. Executable production code and exports are unchanged; URL validation and cache-row clocks/I/O stay separate.
- Step 6 ninety-first slice: `normalizeCachedMediaItem(...)` refines read-only persisted-row inputs, independent integer/default dimensions, cached/legacy base precedence, open shallow metadata, rating/loved semantics, and exact native failures. Eight focused tests compose declarative cases over frozen records and isolated hooks; inherited/hidden fields, repeated accessors, symbol metadata, proxy defaults, and stopped work remain compatible. Generated safe-dimension records verify value-idempotence, not reference identity or global idempotence; a large-number counterexample bounds that law. The existing pure data-first projection needs no currying or algebraic wrapper. Executable production code and exports are unchanged; eligibility, validation, clocks, and cache I/O stay separate.
- Step 6 ninety-second slice: `isUsableCachedMediaItem(...)` refines read-only structural eligibility, ordered guards, exact case-sensitive mock bypass, raw refreshability truthiness, and native failures. Seven focused tests compose declarative tables, frozen records, inherited/hidden fields, and isolated hooks; native method receivers, repeated id reads, and stopped work remain compatible. Ordinary-record filtering preserves concatenation, the empty identity, row references, and idempotence; the predicate itself is not an endomorphism or proof of retrieval success. The existing pure data-first predicate composes directly with filter without a curried or algebraic wrapper. Executable production code and exports are unchanged; validation, authentication, clocks, and retrieval effects stay separate.
- Step 6 ninety-third slice: `dedupeMediaItemsById(...)` refines read-only generic inputs, first-occurrence ordering, native truthiness/string coercion, sparse-array traversal, and exact failures. Seven focused tests compose declarative cases over frozen records, inherited/hidden ids, custom hooks, and generated union triples. Comparison keys do not rewrite retained rows or merge metadata; native filter dispatch and original aliases survive. Stable-record deduplication is value-idempotent, and first-biased deduplicated union forms a Monoid on canonical arrays, but is neither commutative nor plain-concatenation preserving. The pure data-first filter with a private scratch Set needs no curried/algebraic wrapper. Executable production code and exports are unchanged; validation, clocks, and cache I/O stay separate.
- Cached metadata hardening follow-up: choose normalization/write atomicity and metadata validation explicitly; normalization can persist before invalid inputs fail, !== treats NaN and equal-looking objects as changes, and returned unvalidated values may normalize differently on reread. Keep policy changes separate from contract work.
- Live metadata hardening backlog: decide identifier normalization and atomicity explicitly. Decoded input ids are not retrimmed while row ids are; truthy row ids bypass URL decoding. A map failure does not assign the new array, but later active-frame failures retain committed list updates and partial Object.assign fields; accessor effects can also survive. Preserve alias compatibility until a deliberate policy change is implemented and tested.
- Media retrieval hardening backlog: decide bounded recovery for thrown network/decoding failures, refreshed-token reuse, consistent empty-byte handling, MIME validation, and thrown-value normalization separately. Candidate failures currently reject immediately, while final retry failures replace the last error and falsy values select a generic fallback. Final retry retains the original token/hint even after refresh; cache/byte writes are not rolled back after later failures. Preserve these compatibility contracts until an explicit policy change is implemented and tested.
- Media-path security backlog: define accepted media ids and enforce containment before filesystem access in `fetchMediaItemBytes(...)` and background downloading. The current helper normalizes dot segments without confinement, and the media route forwards its id to the service; cache lookup does not guard the subsequent local read. Cover encoded separators, traversal, and local-cache reads with isolated regression tests; do not mistake this compatibility contract for validation or proof of a live exploit.
- Cache hardening backlog: decide an explicit recovery policy for valid non-array cache JSON, which currently throws at the normalized consumer boundary; retain the original file rather than treating malformed shapes as a cache to overwrite. The raw reader returns those shapes unchanged. Decide thrown-value normalization separately: nullish read failures escape while accessing `err.message`, and warning failures propagate rather than returning the fallback.
- Cache persistence hardening backlog: the writer directly overwrites the file without atomic replacement or rollback. Define a recoverable write strategy separately; callers currently own validation, equality checks, and test-mode suppression, and native serialization hooks can have effects. Do not silently change these contracts during type-readiness work.
- Cache upsert hardening backlog: define validation and transaction policy separately. Incoming rows bypass normalization and replace whole entries, so callers must prepare metadata; nullish inputs can fail after a normalization write. Upserts always persist, including in test mode, and reader fallback after corrupt JSON can lead to overwriting it with only the incoming row. Decide recovery without silently changing contract-only work.
- Timestamp hardening backlog: decide whether truthy nonnumeric cached timestamps should be stale instead of the current NaN comparison's fresh result; do not silently change this compatibility behavior during contract work.
- Token validation backlog: decide an explicit rejection/re-authentication policy for malformed expiry and OAuth token payloads. Missing/nonnumeric expiry can reuse a cached token, and a refresh response without `access_token` currently resolves undefined. Refresh updates are non-atomic when the expiry clock fails; decide whether validated atomic assignment is required. Code exchange returns mutable service-owned state and retains replaced tokens if persistence fails; decide whether detached results and rollback/recovery are required. Do not silently change these compatibility behaviors during contract work.
- Credential-save hardening backlog: decide whether persistence failure should roll back service credentials and any environment changes made by `persistEnvVars(...)` before its file write. The current false result retains replaced credentials, and nullish thrown values escape the error handler. Keep recovery and error normalization separate from contract-only work.
- Picker hardening backlog: choose response-shape validation and thrown-value normalization explicitly. Session creation and retrieval currently return raw JSON; creation, retrieval, listing, and deletion error handlers replace nullish rejections while reading `err.message`. Retrieval and deletion dispatch native `startsWith` before authentication and interpolate the supplied id verbatim into their URLs; decide an explicit id validation/encoding policy. Deletion returns `response.ok` without validation; HTTP failures are silent false results, and handled request failures retain refreshed tokens. Listing skips non-array lists, rejects nullish JSON, follows truthy page tokens without cycle/page limits, and reuses one token for all pages; define bounded pagination, cancellation, and long-session authentication policy separately. Keep validation/recovery changes separate from contract-only work.
- Picker sync hardening backlog: reconcile the default adapter's access-token-only guard with refresh-token-only authentication supported by listing. Define response/result semantics explicitly: returned incoming rows include duplicates and policy-dropped rows, not persisted pool size. Empty/non-array selections still run policy and effects; write/cleanup failures can leave partial effects, and nullish errors can escape sync/background handlers. Decide validation and recovery separately; injected cache/cleanup adapters must be synchronous and download adapters promise-returning.
- Step 6 ninety-fourth slice: `mergeSyncedItemWithExistingMetadata(...)` refines read-only inputs, ordered shallow spreads, five defined user-edit exceptions, aliases, and native failures. Seven focused tests compose declarative cases through the existing public union with an exact shared id; frozen records, symbol metadata, inherited/hidden fields, and isolated accessors preserve precedence and repeated reads. Ordinary own-enumerable records obey associativity, value-idempotence, and empty-metadata identity, not commutativity; inherited records and changing accessors are outside those laws. The existing pure data-first projection needs no curried/algebraic wrapper. Executable production code and exports are unchanged; cache I/O, policy, identity matching, and recovery remain with callers.
- Step 6 ninety-fifth slice: `mergeSyncedMediaItems(...)` refines read-only collections, stable cached/selected ordering, asymmetric duplicate precedence, raw cached-id matching, shallow clones versus incoming aliases, and native failures. Eight focused tests compose declarative tables, frozen/sparse inputs, isolated hooks, and generated union triples. On ordinary own-enumerable records with canonical unique string ids, chronological union forms an associative, value-idempotent, noncommutative Monoid with [] identity; duplicate/noncanonical ids and accessors are outside those laws. The existing pure data-first interface and private scratch collections need no wrapper. Executable production code and exports are unchanged; policy and cache I/O remain in callers.
- Picker identity hardening follow-up: choose canonical-id normalization and migration separately. Cached deduplication trims keys, while cached removal/upsert lookup uses raw ids; padded/numeric cached ids can coexist with equivalent selections, and earlier padded duplicates can hide exact matches. Preserve user metadata and ordering in any deliberate correction.
- Step 6 ninety-sixth slice: `buildCachedMediaItem(...)` refines read-only inputs, fixed-field output, distinct base/date/MIME/session fallback policies, timestamp/clock ordering, retained metadata aliases, and exact native failures. Eight focused tests compose declarative cases, frozen records, isolated clocks, ordered accessors, and exact thrown values. The existing data-first interface composes pure projections, but the builder itself reads the clock: no pure endomorphism or global idempotence law applies. Fixed-clock refresh stability requires complete stable Picker input and a retained acquisition date; absent dimensions reset cached dimensions. No curried/algebraic wrapper, dependency, executable production change, or export added. Validation and clock injection remain separate work; cache I/O stays with callers.
- Step 6 ninety-seventh slice: `getPickerMediaFile(...)` refines read-only inputs, whole nested/flat selection, original aliases versus fresh empty fallbacks, hidden/inherited fields, repeated accessor reads, and exact failures. Seven focused tests compose declarative cases and frozen records through test-only private capture, without widening production exports. Stable leaf selection is reference-idempotent; arbitrarily nested records and changing accessors are outside that law. Keep the pure data-first selector without a curried/algebraic wrapper, coercion, or validation. Executable production code remains unchanged; field fallbacks and cache effects remain with callers.
- Step 6 acceptance audit (2026-10-25): not ready for closeout; see the evidence matrix under Step 6. Corrected the missing `refresh-active-feed` Effect member without executable production changes. Four tests cover handler-vocabulary parity and pool-refresh dispatch success, absent adapters, and rejection. Keep the pure reducer and sequential effect interpreter; no extra functional wrapper is warranted.
- Step 6 execution-contract slice (2026-10-25): named `ReducerEnvironment` and public reducer/dispatcher results, preserving default clock/random reads, no-op identities, ordered effects, and pre-effect snapshots. Seven regressions cover replay, inputs, defaults, failures, and shell ordering without executable production changes.
- Step 6 selector-contract slice (2026-10-26): all 23 exported domain selectors now document shared domain shapes and local selection/update contracts. Ten regressions preserve pool balance, time eligibility, conditional randomness, undefined-only defaults, aliases, immutable projections, and exact failures without executable production changes.
- Step 6 payload-contract slice (2026-10-26): named all 25 command payload variants and nullable decoder results, ten discriminated effect variants, and dispatcher dependencies/public methods. Ten regressions preserve decoder pass-through fields, detached job arrays, metadata patches, aliases, optional adapters, and shell-specific completion/failure rules. Executable production code and exports are unchanged.
- Step 6 acceptance re-audit (2026-10-26): completed the audit, not Step 6. Corrected an unbalanced `SessionConfig.poolPolicies` declaration and added five compatibility regressions. Remaining gaps and a bounded compiler-first queue appear below; executable production code/exports remain unchanged.
- Step 6 compiler baseline (2026-10-27): pinned development-only TypeScript and Node declarations, a strict no-emit domain configuration, and positive/negative compile fixtures expose 541 core, two intentional fixture, 68 transitive, and zero global diagnostics. `npm run typecheck:domain -- --details` reports every diagnostic; the nonzero result is expected until the gaps are resolved.
- Step 6 object-narrowing slice (2026-10-29): the existing `isPlainObject` predicate now documents unknown inputs and a record type guard; all ten state-patch TS18046 diagnostics and the predicate's implicit-any diagnostic disappear, with no executable change. Compatibility tests preserve prototype acceptance, array/function rejection, repeated reads, and exact accessor failures. That checkpoint reported 530 core, two fixture, 68 transitive, zero global.
- Step 6 curried-patch slice (2026-10-29): `buildBooleanFieldPatch` now has a local direct/partial call contract, unknown-safe key/value inputs, and potentially absent indexed results. Runtime behavior is unchanged. Direct/partial equivalence, empty applications, extra arguments, native key coercion, and failures have regression coverage. The scoped result is 530 core, one fixture, 68 transitive, zero global.
- Step 6 handler-invoker slice (2026-10-29): `createTypedHandlerInvoker` retains the union of heterogeneous handler results plus undefined; its input remains deliberately uncorrelated with handler payloads. Runtime tests cover captured own enumerable handlers, silent fallbacks, identity, unawaited promises, and thrown failures. The scoped result is 530 core, zero fixture, 68 transitive, zero global; executable production code is unchanged.
- Step 6 preview-input slice (2026-10-30): `ActivePhotoPreview` describes the original object accepted by active-photo commands, rather than promising normalized `Photo` metadata. Runtime and compiler tests cover object/array aliases, URL accessor behavior, primitive rejection in the type, and unnormalized shallow feed staging. The scoped result remains 530 core, zero fixture, 68 transitive, zero global; executable production code is unchanged.
- Step 6 theme-compatibility slice (2026-10-30): `SessionConfig.theme`, legacy input, and public snapshots admit unknown values. Tests trace raw values and aliases through patching and snapshot rebuilding, undefined no-ops, and direct-command string coercion. Compile fixtures require narrowing; production execution and the 530/0/68/0 diagnostic counts are unchanged.
- Step 6 timing-compatibility slice (2026-10-30): `inactivityTimeout` and `slideshowInterval` are unknown in legacy, domain, and snapshot contracts. Patch and rebuild cases preserve raw values and aliases; omitted patches are no-ops, whereas direct interval commands use native numeric coercion and can yield NaN or throw. Compile fixtures require narrowing; executable behavior and the 530/0/68/0 diagnostic counts are unchanged.
- Step 6 scale-compatibility slice (2026-10-30): `scaleMode` is unknown in legacy, domain, and snapshot contracts. Patches and rebuilds preserve raw values and aliases; direct commands likewise preserve supplied values but skip undefined and persist changes. Compile fixtures require narrowing; executable behavior and the 530/0/68/0 diagnostic counts are unchanged.
- Step 6 split-crop compatibility slice (2026-10-30): `splitCropPercent` and derived secondary-frame crop values are unknown. Raw patches preserve aliases; legacy rebuild and frame projection use nullish defaults, photo crop takes precedence, and direct commands apply numeric coercion. Compile fixtures require narrowing; executable behavior and 530/0/68/0 counts are unchanged.
- Step 6 split-portrait compatibility slice (2026-10-30): `splitPortrait` is unknown in legacy input and domain/snapshot state. Patches preserve raw values and aliases; legacy rebuilds and direct commands coerce by truthiness, while frame eligibility also uses truthiness. Compile fixtures require narrowing; executable behavior and 530/0/68/0 counts are unchanged.
- Step 6 fallback-consent compatibility slice (2026-10-30): `allowOpenAiFallback` is unknown in legacy input and domain/snapshot state. Raw patches and the mutable legacy shell preserve aliases, but rebuilds and the legacy socket toggle use truthiness; the vision gate also uses truthiness. Compile fixtures require narrowing; executable behavior and 530/0/68/0 counts are unchanged. Explicit boolean consent enforcement is separate hardening work: even the string `"false"` currently enables the gate.
- Step 6 weather-alignment compatibility slice (2026-10-30): `alignWeather` is unknown in legacy input, domain/snapshot state and weather selector contracts. Raw patches and the legacy shell retain aliases; rebuilding, the socket toggle and preference filtering use truthiness. Tests cover falsy inputs, a truthy `"false"`, an object with a throwing coercion hook, no-op patches and selector identity; compile fixtures require narrowing. Executable behavior and 530/0/68/0 counts are unchanged.
- Step 6 time-alignment compatibility slice (2026-10-30): `alignTimeOfDay` is unknown in legacy input, domain/snapshot state and night selector contracts. Raw patches and the legacy shell retain aliases; rebuilding, the socket toggle and preference filtering use truthiness. Tests cover falsy inputs, truthy `"false"`, a throwing coercion hook, no-op patches, conditional draws and smart selection; compiler fixtures require narrowing. Executable behavior is unchanged.
- Step 6 night-percentage compatibility slice (2026-10-30): legacy input, domain/snapshot state and night selector contracts admit unknown values. Tests cover raw aliases, nullish defaults, socket validation, native coercion, conditional draws and exact failures; compiler fixtures require narrowing. Runtime code is unchanged; the native division now exposes one TS2362 diagnostic rather than asserting an unsafe numeric input.
- Step 6 feed-lookup slice (2026-10-30): `findPhotoInFeed` now preserves the generic input row type rather than asserting normalized `Photo` metadata, and accepts unknown lookup keys. Runtime and compiler fixtures cover first aliases, strict equality, nullish matches, failures and nullable results; executable behavior and 531/0/68/0 diagnostics are unchanged.
- Step 6 URL-deduplication slice (2026-10-30): `uniqByUrl` preserves generic raw row types and unknown URLs; its Set uses SameValueZero equality, after excluding falsy URLs. Tests cover ordered aliases, object identity, accessors, failures and compile-time narrowing. Executable behavior and 531/0/68/0 diagnostics are unchanged.
- Step 6 visibility-filter slice (2026-10-30): `filterVisiblePhotos` preserves generic raw rows and unknown visibility fields, with native keyword coercion and no normalization. Tests cover aliases, exact rating comparison, truthy broken flags, composition and failures. The generic filter exposes one TS2322 narrowing diagnostic; executable behavior is unchanged and counts are 532/0/68/0.
- Step 6 filter-narrowing slice (2026-10-30): the visibility and URL-deduplication filters use explicit generic type predicates. Visibility converts the existing condition to a boolean, preserving Array.filter truthiness and short-circuit behavior; deduplication already returned booleans. Tests cover accessor order, truthy object URLs, nullish rows, short circuits and propagated failures; fixtures retain nullable input row types. Both TS2322 diagnostics disappear, leaving 530/0/68/0.
- Step 6 feed-state slice (2026-10-30): `FeedPhoto` admits unknown known fields in domain, legacy and public snapshot feeds instead of asserting normalized `Photo` rows. Two regressions trace preview staging and legacy rebuilding through shallow snapshot copies and shared nested metadata; compiler fixtures require narrowing. Runtime code is unchanged. Five newly exposed core selector diagnostics bring the baseline to 535 core, zero fixture, 68 transitive and zero global.
- Step 6 sequential-selection slice (2026-10-30): `selectSequentialPhoto` returns an unvalidated `FeedPhoto | null` and retains its selected row alias. Two regressions cover staged previews, pool rotation, native cursor-key coercion, immutable inputs and hidden rows; compiler fixtures require narrowing and acknowledge empty results. The data-first pure selector needs no new wrapper or executable change. One mismatch is resolved; the nonzero baseline is 534 core, zero fixture, 68 transitive and zero global.
- Step 6 active-photo lookup slice (2026-10-30): `getActivePhoto` returns `FeedPhoto | null` and `inferOrientation` accepts raw fields. Two regressions cover staged aliases, feed/curated/external precedence, missing URLs, numeric-only dimensions and accessor failures; compiler fixtures require narrowing. No executable code changes. The honest result resolves the lookup and orientation input mismatches but exposes four raw primary/frame-field mismatches; the nonzero baseline is 536 core, zero fixture, 68 transitive and zero global.
- Step 6 current-frame slice (2026-10-30): `CurrentFrame` and public/legacy snapshot active photos admit unvalidated `FeedPhoto` aliases, and frame crop/category outputs admit raw values. Regressions preserve staged-preview pairing, detached category arrays, snapshot aliases, nullish defaults and malformed URL sorting failures; compiler fixtures require narrowing. Executable code is unchanged. Four frame errors and two private-helper implicit-any errors disappear, while raw URL sorting exposes one core error; the baseline is 531 core, zero fixture, 69 transitive and zero global.
- Step 6 smart-selection slice (2026-10-30): generic time/weather/night filters and feed/weighted selectors retain raw input row types and aliases; the state adapter returns `FeedPhoto | null`. Tests cover staged previews, Map-key identity, rating coercion and malformed schedules. No executable behavior changed. Honest contracts expose rating division and sequential cursor-key diagnostics alongside the existing night division and malformed pairing URL sort; the strict baseline is 526 core, zero fixture, 69 transitive and zero global.
- Step 6 numeric-coercion slice (2026-10-30): the private data-first `divideByNumber` boundary captures native division of unknown inputs by a number. A single local `any` assertion is limited to the operator because TypeScript cannot model coercive arithmetic on `unknown`; it is not input validation or a claim that operands are numbers. Successful results are numeric; Symbol, BigInt, user coercion and their errors remain observable. Two regressions cover both selectors, native error messages and RNG/coercion order; a fixture preserves raw rating metadata. No public exports change. The nonzero baseline is 524 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 cursor-key slice (2026-10-30): sequential selection uses one local dynamic assertion for its unknown category at native property access, not a conversion or validation. Symbol keys, string-hint coercion, optional-chain short-circuiting, proxy lookup and thrown failures remain observable; the selected category remains unknown in the public contract. Two regressions and a compiler fixture cover these boundaries; the executable production AST is unchanged. The strict baseline is 523 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 pairing-sort slice (2026-10-30): the raw left URL has a local dynamic assertion at its existing `localeCompare` call, not validation or a promise of numeric comparator results. The right URL, method receiver, accessor order, native result coercion, single-candidate behavior and failures remain unchanged. Two regressions and a raw-URL compiler fixture cover the boundary; the executable production AST is unchanged. The strict baseline is 522 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 screensaver-decoder slice (2026-10-30): local unknown-valued property assertions retain native reads without validation; the first read is checked as boolean, but the second remains unknown in the command contract. Regressions cover callable/inherited accessors, changing values, proxy failures and reducer truthiness; compiler fixtures require narrowing. Production syntax is unchanged. The strict baseline is 520 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 category-decoder slice (2026-10-30): local assertions preserve native eager destructuring, including callable/inherited properties and failures; an overridden array `join` can return any truthy value, so the command payload admits unknown. Two regressions and compile fixtures cover read order, precedence, aliases, custom joins and errors. Production syntax is unchanged. The strict baseline is 518 core, zero fixture, 69 transitive and zero global diagnostics.
- Next Step 6 checkpoint: document and narrow `readRequiredString` while preserving native trimming, truthiness, original results and failures. Step 6 remains incomplete.
- The latest Step 4 slice replaced the dispatcher effect loop with a named sequential interpreter built from `reduce` and promise chaining, preserving ordered side effects and effect-result order while keeping the imperative shell boundary unchanged.
- The latest Step 4 slice extracted that ordered promise-reduce boundary into `server/utils/asyncReduce.js`, so reducer effects and REST command batches now share one small partially applied sequential interpreter while route-specific accumulation and validation remain explicit.
- The latest Step 4 slice indexed declarative reducer-family entries once through a small pure interpreter builder, preserving explicit per-family environment adapters while keeping unsupported and inherited command keys as no-ops.
- Step 4 closeout audit (2026-08-21): all three acceptance criteria are met. Repeated reducer/result/effect patterns are expressed once, new command branches have low ceremony, and the reducer remains readable to a human learning from the code. No further named Step 4 work remains; mixed-version compatibility fallback and transport-specific telemetry remain intentional boundaries. Step 5 is now the active companion checkpoint.
- Functional quality audit (2026-08-21): Step 4 remains closed against its defined backend criteria, but the audit found that the overall example bar cannot be claimed until the client control surface receives the same treatment. The repeated `patchState -> normalize response -> apply snapshot` actions are now the first bounded Step 5 seam; this is also the preferred bridge toward typed client request contracts.
- Step 5 request-contract note (2026-08-21): `client/src/api/requestPlans.js` is the next TypeScript-ready seam. Its pure plan builder keeps endpoint paths, REST body projections, and temporary legacy payload projections explicit without forcing the effectful `fetch`/Socket.IO interpreter into the functional core.
- The latest Step 4 slice routes simple, photo, feed, pool, playback, and patch commands through one ordered reducer-family interpreter, with regression coverage for unsupported and inherited command keys.
- The latest Step 4 slice captures the dispatcher effect interpreter once before sequential promise reduction, with regression coverage for delayed handler ordering, aligned results, and unhandled effects.
- The latest Step 4 slice completed the route-decode collector's small algebraic boundary, replacing its mutable accumulation loop with a pure short-circuiting reduction and explicit empty-success identity coverage.
- The latest Step 4 slice extracted the keyed reducer-family lookup into a small reusable indexed interpreter, preserving last-entry-wins declarative semantics and explicit fallback handling for unsupported or inherited command keys.
- The latest Step 4 slice centralized reducer-builder option resolution, so feed and pool command families now share one pure `(payload, command, state) -> options` interpreter while their distinct mutation/finalization boundaries remain explicit.
- The latest Step 4 slice also closes dispatcher effect lookup through the shared indexed interpreter, preserving ordered promise reduction while making unknown and inherited effect keys explicit no-op boundaries.
- The latest Step 4 slice closes dispatcher event lookup through the same indexed interpreter, preserving event order while making unknown and inherited event keys explicit no-op boundaries.
- The latest Step 4 slice closes Socket.IO command-family lookup through the same handler-record interpreter, preserving each transport family’s explicit fallback shaping while making unknown and inherited family keys identity fallbacks.
- The latest Step 4 slice shares one higher-order `read payload -> unchanged or reduce` boundary across feed, pool, and playback reducer builders, preserving family-specific mutation and selection logic while removing repeated invalid-payload ceremony.
- The latest Step 4 slice shares a pure short-circuit reducer across route decoding and guarded route execution, with regression coverage for data-last partial application, identity values, non-mutation, and skipped post-failure steps.
- The latest Step 4 slice shares the pure post-change result builder between ordinary state and feed mutations, so event/effect resolution and persistence ordering are expressed once while feed finalization keeps its richer context explicit.
- The latest Step 4 slice routes patch-state result assembly through that same builder, so persistence ordering and optional weather-refresh effects are expressed once without hiding patch-specific recomputation.
- The latest Step 4 slice shares the pure `recompute -> ensure active photo` continuation between feed and patch mutations, so visibility changes use one active-photo recovery boundary while command-specific result policy remains explicit.
- The latest Step 4 slice extends the photo-library boundary with one pure payload-to-patch projection, so crop, pairing, loved, rating, broken, and metadata commands no longer duplicate their updater and persistence metadata shapes.

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

Why sixth:

- The refactor should leave boundaries ready for TypeScript, but the current goal is architectural clarity in JavaScript first.

Changes:

- Expand `@ts-check` and JSDoc around command contracts, environment objects, effect payloads, and selector inputs.
- Keep internal helper APIs stable and explicit so later `.ts` conversion is mostly mechanical.
- Avoid introducing dynamic or shape-shifting patterns that will become typing liabilities later.

Acceptance criteria:

- Core refactored modules expose stable, documented contracts.
- TypeScript migration can adopt the modules without redesigning their public shapes.

### Step 6 acceptance audit — 2026-10-25; re-audited 2026-10-26

Result: **incomplete**. Public command, execution, effect, and selector
signatures are now documented, but their state invariants and internal type
relationships are not closed. The re-audit found and corrected an unbalanced
nested-record declaration in `SessionConfig.poolPolicies`. Existing `@ts-check`
markers, source assertions, and lint do not establish successful compilation.
This audit follows the core domain flow, not unrelated helper polishing.

| Boundary | Evidence in the current code | Remaining gap |
| --- | --- | --- |
| Commands | `CommandPayloads` correlates 25 names; decoders document command-or-null results. Regressions confirm raw scalar patches, URL-only validation of active-photo metadata, and inherited/callable inputs. State patches use `isPlainObject`; screensaver lookup retains repeated reads; category decoding preserves native destructuring and raw custom-join results. | `readRequiredString` lacks an explicit unknown-input contract. `curry: AnyFunction -> AnyFunction` erases builder relationships. Any narrowing must preserve native lookup/coercion behavior, not silently reject callable/inherited inputs. |
| Environments | `ReducerEnvironment`, dispatcher dependencies/public methods, and results document defaults, fresh context, aliases, and completion ordering. Replay/order/failure tests remain. All ten raw scalar patch fields admit unknown compatibility values in state and snapshots. | Tests trace raw fields through reduction and public snapshots; optional direct payloads can produce NaN, and omitted scale mode is an identity no-op. Night division uses the local native-coercion boundary; invalid operands still throw. |
| Effects | Ten discriminated variants match the closed handler vocabulary. Sequential execution, optional adapters, opaque awaited results, synchronous emission/override, and partial failures are covered. `createTypedHandlerInvoker` retains the heterogeneous return union and undefined fallback. | The invoker does not establish payload/handler correlation; private handlers/interpreter and reducer-family builders rely on inference. Public effect variants do not prove `EffectResult[]` inference. Preserve ordering and existing compatibility fallbacks. |
| Selectors | All 23 exported signatures document domain inputs; tests cover pool balance, time/random defaults, aliases, immutable updates and unnormalized preview staging. Feed lookup, filters and feed-based smart selection preserve generic row types; state-backed selectors and frames admit raw fields. | Rating/night division, raw cursor-key indexing and pairing URL method calls use local dynamic assertions, not validation; malformed URLs and native sorting failures remain possible. Other selector contracts and malformed legacy inputs remain review targets. Browser contracts remain separate. |

Acceptance decisions:

1. **Stable documented contracts: partially met.** All four public boundaries
   have named contracts and behavioral coverage. The syntax correction is local,
   but compatibility values still contradict normalized state/photo claims;
   documentation coverage alone is not contract soundness.
2. **Adoption without public-shape redesign: not demonstrated.** The current
   callable APIs can remain; first distinguish untrusted compatibility data from
   normalized values and measure inference/narrowing with compile-time fixtures.
   No need for a new public API or runtime validation has been established.

Tooling evidence at the re-audit: no repository `tsconfig`/typecheck script, installed TypeScript
dependency (`npm ls typescript --all --offline`), or `tsc` on PATH was found.
No compiler was installed or run for this audit. The property delimiter test
is deliberately not a JSDoc parser/compiler. Diagnostic counts and a successful
strict migration were unmeasured, not inferred from the passing runtime suite.

Follow-up acceptance review (2026-10-30): the subsequently installed, pinned
strict compiler now reports 520 core, zero fixture, 69 transitive and zero
global diagnostics. The selector contracts above are more faithful, but both
acceptance decisions remain unchanged: malformed URL failures are preserved,
and command/effect inference gaps remain unresolved. Passing behavioral tests
do not establish a clean migration gate.

Compiler baseline (2026-10-27): TypeScript 5.9.3 and `@types/node` 25.9.1 are
exact development dependencies in the npm lockfile. `tsconfig.domain.json`
checks the five domain root files and compile-only fixtures with `strict`,
`allowJs`, and `noEmit`; imported checked modules remain visible. Run
`npm run typecheck:domain` for counts and append `-- --details` for every
diagnostic. The command exits nonzero for any diagnostic; it is not part of the
green runtime test gate and does not suppress transitive errors. Grouping is by
diagnostic file location, not ownership or import reachability.

Current results: **520 core, 0 fixture, 69 transitive, 0 global**. Native
rating/night division is isolated in an explicitly dynamic local operator;
unknown inputs and native failures remain part of the public contracts.
The curried
patch builder, heterogeneous invoker, and other positive/negative fixtures now
compile as expected. The invoker's result union does not prove payload/key
correlation, and its handler-map contract deliberately excludes non-functions
that the runtime silently ignores. The patch builder's local annotation describes the existing curry result, rather
than proving the shared `curry` implementation's generic type safety. The ten TS18046 unknown-input diagnostics
in `decodeStatePatchCommand` and the predicate's implicit-any diagnostic were
removed by the object-narrowing contract; other core counts include numerous implicit-any
diagnostics under strict mode. Transitive diagnostics include two malformed
JSDoc declarations in `collectionPhotoProjections.js`. These counts describe
this pinned configuration and are not a whole-repository migration estimate.
Three reporter/fixture tests verify partitioning, nonzero/zero status, and
that a deliberately weakened negative fixture produces TS2578; no fixture
diagnostic is otherwise permitted by that test.

First correction: add the already-emitted and already-handled
`refresh-active-feed` member to `Effect`. A source-contract regression compares
the entire declared vocabulary with the closed handler record. Runtime tests
cover curated-pool refresh payload/result identity, state-before-effects and
events-after-effects ordering, optional-adapter behavior, and exact rejection
without rollback of applied state. The existing Google Photos policy regression
continues to cover the external-pool path. Test-mode persistence stays isolated;
no live pool, credential, network, or daemon operation is introduced.

Bounded completion queue:

1. Completed: named the reducer `now`/`rng` environment and public
   reducer/dispatcher results, preserving defaults and no-op identity.
2. Completed: annotated all exported domain selector inputs/results using shared
   shapes; preserved random/clock injection and existing playback behavior.
3. Completed: documented command/effect payload variants, nullable decoder
   results, and dispatcher dependencies from actual decoder/reducer/shell shapes.
4. Completed: re-audited both criteria, corrected the malformed policy type,
   and recorded concrete state/photo counterexamples and inference gaps.
5. Completed: established the scoped strict no-emit baseline and compile-time
   fixtures, with transitive diagnostics separately reported and no blanket
   suppression. The command is intentionally nonzero; it is not a clean gate.
6. Completed: address the ten measured unknown-input diagnostics in
   `decodeStatePatchCommand`, preserving object/array and accessor behavior.
   Completed: address the `buildBooleanFieldPatch` curried-result inference
   fixture with a local call contract and preserved public call conventions.
   Completed: address the heterogeneous interpreter's result-inference fixture
   without asserting handler/payload correlation or changing runtime behavior.
7. **In progress:** model compatibility state/photo inputs versus normalized values
   explicitly. Active-photo command previews now have a separate input type;
   feed, snapshot, and selection fields now admit raw rows, but native coercion
   and key handling still need honest compiler treatment. Preserve raw patch
   values, optional direct payload behavior, metadata aliases, and reducer/selector
   default differences. Runtime validation is separate work.
8. Re-run the scoped compiler fixtures and runtime suite, then repeat both
   acceptance decisions. Close Step 6 only from that evidence, not signature count.

Functional decision: preserve the pure data-first domain core and existing
partially applied, sequential effect interpreter. Effects are descriptions,
not pure computations or atomic transactions; a new Monad/Fantasy Land wrapper
would not close the observed contract gaps.

Execution-contract follow-up: the reducer remains replayable with stable Date
and RNG inputs, but ambient defaults read the clock and randomness. `now` is a
value, not a callback; optional null/falsy fields retain `||` defaults without
new validation. No-op reducers still resolve inputs before closed command
lookup, while missing dispatcher commands resolve null before any such reads.
`DispatchResult.snapshot` is captured before effects, not a final detached copy
of the live shell; awaited effect values retain adapter aliases. Seven tests
cover these boundaries, immutable/replayed state, exact failures, and existing
sequential ordering. No runtime abstraction, dependency, compiler gate, or
production export is added; selector contracts are covered by the follow-up below.

Selector-contract follow-up (2026-10-26): preserved the existing data-first
projections and explicit Date/RNG injection. Feed construction copies and tags rows,
while lookup, filtering, selection, and frames retain photo aliases; frame
categories are detached. Updaters receive shallow copies and retain last-match
and shallow change semantics, not reference-idempotent no-ops. Visibility and
first-URL deduplication are value-idempotent on ordinary stable records; no
result-envelope Monoid or extra curried wrapper is needed. Smart playback rotates
time-eligible pools before within-pool preferences; sequential selection reads
but does not advance cursors. Ambient defaults remain effectful and apply only
to undefined, unlike reducer `||` defaults. Ten focused tests cover these contracts
using declarative cases, frozen inputs, and VM-local clocks/randomness. Executable
production AST/exports are unchanged; no compiler, client build, or runtime
restart is claimed. Payload/dependency contracts are covered by the follow-up below.

Payload-contract follow-up (2026-10-26): a mapped discriminated command family
shares field shapes without runtime wrappers; effect variants distinguish absent
payloads from metadata/category/environment records. Keep raw scalar patches,
exclusion entries, nonfinite numeric metadata, and omitted legacy payloads explicit
rather than claiming decoder validation. Jobs copy ordered category arrays without
deduplicating; metadata omits undefined fields. The existing curried decoders,
data-first reducer, and partially applied sequential interpreter remain unchanged.
Ten tests combine declarative cases, frozen inputs, and VM-local effect adapters;
no process-global mode/console patches or live persistence are introduced. Optional
callbacks return undefined when unavailable; manual override/emitter results are
not awaited, unlike effect adapter results. Weather Error failures are handled,
but nullish thrown values can escape its logging boundary. Preserve this behavior
until separately scoped hardening. Production AST/exports are unchanged; the next
step was the acceptance re-audit above, not a TypeScript compilation claim.

Re-audit regressions (2026-10-26): five tests cover the corrected property
delimiter, ten scalar patches reaching public snapshots, URL-only active-photo
metadata validation, native decoder lookup/failure semantics, and optional direct
payload behavior. Declarative tables and frozen inputs preserve the pure,
data-first reducer and explicit execution inputs. The first test expectation
incorrectly assumed omitted scale mode assigns undefined; `assignFields` skips
undefined, so the test now verifies the existing state identity. No production
logic, export, dependency, live state, or persistence policy changed. Existing
curried composition and the sequential shell remain appropriate; a new
Functor/Monad wrapper would neither narrow unknowns nor restore erased types.

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
