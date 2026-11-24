# 📖 Lumina Developer Log & AI Learnings Journal

## 2026-11-24 — qualify a pinned native runtime and release

Official LTS/security Node26 is qualified against the actual service Node24,
not the shell's Node22. The one standard .nvmrc pin owns the intended version.
The existing installer refuses mismatches before modifying a native unit; its
ExecStart and PATH derive from the same selected executable. The manual fallback
now directly execs Node while keeping its duplicate-port/flock guard. Removed the
npm child wrapper; no new manager, dependency, daemon, runtime ledger or helper.

Both runtimes pass 917 runtime, 13 sensor, 3 compiler and 4 isolated launcher/unit
checks. Fake-systemctl/temp-HOME tests cannot touch the live service; mismatch
preserves the incumbent unit. A fixture expectation initially omitted the native
--user argument; corrected the expectation, retaining the supported user scope.
Fourteen headless slideshow/cursor cases pass. A disposable history fixture was
written/read across24→26→24, including a candidate write read by the old runtime;
no production database or migration was involved. Strict remains290core/68transitive.

Root release metadata is1.0.1; client metadata/locks/dependencies stay unchanged.
The client rebuild is byte-identical, not a new UI claim. Native Temporal, Map
upsert and Iterator.concat are available for future clear simplifications, not a
reason to rewrite working code. Browser syntax targets remain separate.
Independent review accepted source/qualification. Clean source provenance passed;
the native service was rebuilt/restarted once for release1.0.1 and verified on the
pinned runtime. Served assets match the build; real HTTP and Socket.IO snapshots
work. Config, credentials, active categories and collections are byte-unchanged,
and history integrity/counts are preserved. The unrelated command node stayed up.
Old runtime/unit/payload remain; no live rollback rehearsal is claimed.

Startup logs still report provider denials and unavailable vision analysis; the
OLD process journal confirms those failures predate this change. Existing secret
filtering also warns about deprecated JSON fields; the environment-owned values
and private files were not changed. These are explicit degraded-feature findings,
not new-runtime crashes or an all-features-healthy claim. Capture a bounded
provider resilience/capability follow-up in the existing product audit, not a
new monitor or incidental auth/model change.


## 2026-11-24 — extract client-state/control regressions

Moved the coherent mixed client-selector, REST/Socket.IO and Google Photos boundary
group into a root test module. The function body is byte-exact; root-relative paths,
cached service singleton identity and awaited order remain unchanged. Five shared
harness functions are supplied by the existing runner, which still owns counters,
reporting and exit. No second framework, helper fleet or application change.

Independent review accepted. The main runner is 13,393 lines, down 1,111; the new
module is 1,123 lines. All 930 runtime/sensor pass lines match baseline in order;
full suite 917/13/3 and lint pass on both qualified baseline/candidate runtimes.
A deliberate one-assertion mutation produced exactly one failure/exit1, then the
source was restored/hash-checked. An initial string verifier omitted a final
newline; corrected AST body comparison confirmed exact preservation, not a code
repair. This is a bounded seam extraction, not a claim the large suite is fully
modular. Runtime/release qualification is next; strict baseline remains non-green.


## 2026-11-24 — preserve keyed domain-family contracts

The private registry now binds each canonical command key to its own command,
resolved execution environment and domain result. Bare handlers still receive
undefined and adapted handlers their paired environment. The indexed functional
pipeline, last-callable precedence, selected-only adapter, no-op identity, native
failures, aliases and public export are unchanged; executable JS matches baseline.

Independent review rejected speculative generic inference twice: mixed-family
structural widening could hide reachable handlers, and union discriminators
escaped an Extract check. Instead of growing a type framework, narrowed this
private, sole-production-caller boundary to Lumina's ACTUAL domain contract.
Removed the inference helpers. Generic VM forwarding cases remain runtime probes,
not a promise of an arbitrary-registry TypeScript API. Compiler fixtures now
exercise real canonical positives/negatives and weakened-contract sensitivity.

Accepted after independent review: 917 runtime, 13 sensor and 3 compiler checks;
19 unsuppressed independent negatives diagnose correctly; lint/diff checks pass.
Strict domain remains intentionally non-green: 291 to 290 core, 68 transitive,
one old registry diagnostic removed and no new diagnostic identities. Next is
the coherent client-state test extraction, not a whole-domain cleanup.


## 2026-11-24 — optional weather-location label feedback

Enriched the existing Phase 1 location-label item rather than duplicating it.
For one current forecast location, the city/region display is usually redundant;
a persistent screensaver presentation option should hide it independently of
weather or location selection. Future multi-location forecasts may still benefit
from labels. This is a roadmap proposal, not implementation or a new active task.
Keep one presentation flag and preserve forecast behavior; no new location state
model or multi-location feature is commissioned by this feedback.


## 2026-11-23 — canonicalize roadmap status and history

Product direction and accepted feedback remain in ROADMAP; ordered engineering
criteria and ONE current checkpoint live in the functional companion. Historical
per-helper status/audits moved below, without copying paragraphs already present
in this journal. Original documents are hash-archived; every retired paragraph
and every product requirement/deferral is retained. No source behavior changed.
The next selected implementation is the tagged-family contract, not a repeated
readability pass or unrelated helper polish. Baseline tests pass the actual
service Node24 runtime; no Node upgrade has been applied yet.

## 2026-11-23 — consolidate the agent guide

The agent guide now keeps the full standing coding prompt, operational rules,
architecture map and essential contracts, with a link to the current checkpoint.
Repeated migration/integration narrative moved to the historical reference below;
paragraphs already present in this journal were not copied again. Original bytes
are hash-archived locally. This is documentation/context reduction, not capability
removal or an application behavior change. Runtime inspection also corrected a
prior assumption: the service used Node24, while the system shell used Node22;
commands must resolve the real application runtime before verification.

## 2026-11-23 — correlate effect reducer payload and result contracts

- **Outcome:** reused the existing curried effect-result builder, deriving payload
  types from the canonical Effect vocabulary rather than maintaining another
  catalog. Commands, callback inputs and custom results remain related; a falsy
  payload still returns the unchanged envelope. Local default assertions bridge
  compiler limits without widening the callable contract. No runtime abstraction,
  dependency, validation or public export was added.
- **Coverage:** four declarative runtime cases preserve undefined-only defaults,
  fresh descriptions, state/command/payload aliases, receiver/arity, falsy skips,
  custom results and ordered failures. Existing lexical compiler fixtures check
  literal/union correlation, command/result contracts and sensitivity to weakened
  annotations. Independent review accepted, with the registry gap below nonblocking.
- **Verification:** Node 22 suite 916/13/3, affected lint and diff checks pass.
  Strict diagnostics 298→291 core, 0 fixture / 68 transitive / 0 global: 8 removed / 1 exposed.
  Executable nodes/leaves and exports match after ignoring one added redundant
  grouping for the JSDoc assertion; raw comment-free source is not identical.
- **Next seam:** the family registry still asks each handler to accept the whole
  Command union instead of its keyed variant. Preserve this visible typing gap;
  do not weaken the newly checked builder or expand into unrelated helper polish.
- **Complexity/feedback:** the product roadmap now names bounded guide/checkpoint
  consolidation and a coherent client-state test extraction, not another test
  framework or supervisor. Alex's suggestion to evaluate a newer Node runtime
  was added to Phase 1's TypeScript/runtime bridge during this work, without
  changing the active task, runtime or deployment. Beads retained a real
  implementation → acceptance dependency; task translation and claim renewal
  remain explicit overhead. No productivity uplift or unattended safety claim.

## 2026-11-23 — bounded roadmap and task-tracker workflow

- Audited the live dependency graph: the first three tasks were a selected
  qualification → constructor implementation → independent acceptance sequence,
  not an automatic import of the product roadmap. The tracker is task memory,
  not the design authority, executor or source-complexity repair mechanism.
- Added the reusable feedback/discovery, WIP and complexity discipline to
  `CONVENTIONS.md`; roadmap and agent guidance link to it. Reduced our repeated
  constructor summaries instead of copying another detailed status ledger.
  Commit reporting now leads with subject, roadmap movement and remaining work.
- The current constructor slice remains accepted and Step 6 remains incomplete.
  Gauge flags include state-module/test-fixture paths and the large test runner;
  they require interpretation, not deletion of real product state. Larger
  documentation consolidation precedes further factory-tooling expansion.
- Documentation-only verification checks exact guarded replacements, preserved
  incumbent edits, policy links and unchanged code. No new runtime layer,
  dependency, source behavior, deployment or public push is introduced.

## 2026-11-23 — shared reducer result-constructor contracts

- Added generic state-preserving JSDoc to the five existing pure data-first result envelopes; canonical Event/Effect descriptions remain typed caller contracts, not runtime validation. No executable production syntax, exports or dependency changed. No Monoid/currying wrapper is justified for a direct envelope constructor.
- Added three declarative runtime regressions and private lexical compiler fixtures with an annotation-removal weakening probe. Aliases, fresh output defaults, event order and native failures are preserved. Independent review accepted the exact three-file diff.
- Verification: 912 runtime assertions, 13 sensor regressions and three compiler tests pass, including the existing Node 22 runtime; scoped lint/diff checks pass. Strict diagnostics 307→298 core, 68 transitive unchanged, zero fixture/global. Ten implicit-any errors removed; the newly exposed effect-builder payload relationship is the next bounded audit, not a suppressed error.
- The Fila-owned development-cycle pilot used one scoped dependency graph and native worker/result custody. Product direction remains in the living roadmap; no deployment or public push is part of this checkpoint. Existing unrelated documentation edits are preserved.

This document serves as a public-facing, generic history of technical developments, architectural decisions, and key technical lessons learned. Any developer or visiting AI agent should read this file to understand why certain features were built in a specific way and to avoid repeating past mistakes.

---

## 📅 Technical Changelog & Milestones

### 2026-11-21: Reconcile Shared Active-URL State and Public Results

- **Outcome**: `PlaybackState.activePhotoUrl` is unknown, matching raw URL
  values retained by feed selection and legacy rebuilding. Public reduction,
  snapshots and dispatch now agree; feed finalization reuses the shared state
  and result types, removing two temporary local shapes. Emitter inputs admit
  unvalidated feed rows. Existing data-first composition remains appropriate;
  no new wrapper, validation, coercion or executable production change is needed.
- **Coverage**: three runtime regressions and positive/negative compiler fixtures
  trace raw URL identity through reduction, snapshot application, legacy rebuild,
  emission, refresh and subsequent no-op reduction. They preserve shallow row
  copies, strict lookup, falsy-to-null projection, native getter failures and
  event/effect ordering. The legacy fixture uses its own input contract rather
  than assuming every public snapshot is assignable to it: optional pool policy
  fields differ, independently of this URL correction.
- **Verification**: 878 assertions, 13 sensor regressions, three compiler fixture
  tests, lint, syntax and diff checks pass. All four touched production modules
  have unchanged executable syntax. Optional endpoint smoke remains sandbox-
  blocked by `EPERM`. Strict checking remains nonzero at 307 core, zero fixture,
  68 transitive and zero global diagnostics (previously 309/0/69/0). No runtime
  restart was needed; the physical-TV cursor report remains unresolved. Next
  audit the shared result constructors and their state/output relationships.

### 2026-11-21: Check Reducer-Family Dispatch Contracts

- **Outcome**: checked the existing partially applied, declarative interpreter
  rather than adding another abstraction. Generic family descriptors relate
  commands, original/adapted environments and results. A local call assertion
  restores only the environment pairing lost during indexing, not normalized
  state. Results are passed through, not combined as a Monoid. Effect execution,
  public exports and executable production syntax remain unchanged.
- **Coverage**: four runtime regressions and private compiler fixtures cover
  eager own-entry capture, last-callable-key precedence, closed lookup, exact
  aliases, selected-only adaptation, fresh no-op outputs, native failures and
  raw URL identity through public dispatch. Frozen family lists remain accepted.
- **Verification**: 875 assertions, 13 sensor regressions, three compiler fixture
  tests, lint, syntax and diff checks pass. Optional endpoint smoke remains
  sandbox-blocked by `EPERM`. Strict checking is still nonzero: 309 core, zero
  fixture, 69 transitive and zero global diagnostics. Next audit the public
  reducer result and shared active-URL state contract through dispatcher/snapshot
  consumers; checked dispatch now exposes that mismatch. No restart was needed;
  the physical-TV cursor report remains unresolved.

### 2026-11-21: Propagate Feed Mutation and Command Results

- **Outcome**: carried the raw active-URL result contract through feed mutation
  and its command builder. Original-state no-ops fit the same envelope. The
  existing higher-order composition and production executable syntax remain
  unchanged; no extra abstraction, validation or effect was introduced.
- **Coverage**: three runtime regressions and private compiler fixtures cover
  real raw-URL selection, shared command/payload aliases, environment factory
  context and precedence, and null-payload/apply-no-op skip paths.
- **Verification**: 871 assertions, 13 sensor regressions, three compiler fixture
  tests, lint, syntax and diff checks pass. Optional endpoint smoke is skipped
  on sandbox `EPERM`. Strict checking remains nonzero at 326 core, zero fixture,
  69 transitive and zero global diagnostics. Next audit the reducer-family
  interpreter and descriptors: their unchecked result still hides the raw
  feed-state mismatch at the public reducer boundary. No restart was needed;
  the physical-TV cursor report remains unresolved.

### 2026-11-20: Audit Feed Finalization Results and Callbacks

- **Outcome**: corrected the finalization context and introduced a local result
  contract retaining unknown active URLs. The existing functional composition
  remains intact; no new abstraction or runtime validation was needed.
- **Coverage**: three runtime regressions and private compiler fixtures cover
  real raw-URL selection, shared context identity, effects-before-events order,
  default versus explicit falsy outputs and failure boundaries. Production
  executable syntax is unchanged.
- **Verification**: 868 assertions, 13 sensor regressions, three compiler fixture
  tests, lint, syntax checks and diff checks pass. Optional endpoint smoke is
  skipped on sandbox `EPERM`. Strict checking remains nonzero at 327 core, zero
  fixture, 69 transitive and zero global diagnostics. Next propagate this result
  through `reduceFeedMutation` and command-builder contracts. No restart was
  needed; the physical-TV cursor report remains unresolved.

### 2026-11-19: Audit Feed Recomputation

- **Outcome**: documented the existing pure feed-rebuild and active-photo
  continuation. Rebuilding uses shallow copies before selection and forwards
  execution inputs without normalizing them; the result retains raw active URLs.
  The local options assertion does not validate a nullable RNG.
- **Coverage**: four runtime regressions and private compiler fixtures cover
  aliases, ordering, retained and changed photos, conditional random draws and
  failures. Production executable syntax is unchanged.
- **Verification**: 865 assertions, 13 sensor regressions and three compiler
  fixtures pass; optional live endpoint smoke is skipped on sandbox `EPERM`.
  Strict checking remains nonzero at 329 core, zero fixture, 69 transitive and
  zero global diagnostics. Next audit feed-finalization result and callback
  contracts. The physical-TV cursor report remains unresolved.

### 2026-11-19: Audit Active-Photo Maintenance

- **Outcome**: documented the existing pure active-photo update and maintenance
  projections. State identity is retained on an unforced feed hit; replacement
  preserves raw URL values, shallow copies, strict change detection, seed
  addition and direction fallback. The local type exposes unknown URLs without
  pretending the compatibility feed has been normalized.
- **Coverage**: four runtime regressions and private compiler fixtures exercise
  unchanged and forced paths, aliases, lookup/selection order, native coercion,
  propagated failures and raw URLs. Production executable syntax is unchanged.
- **Verification**: 861 assertions, 13 sensor regressions and three compiler
  fixtures pass; optional live endpoint smoke is skipped on sandbox `EPERM`.
  Strict checking remains nonzero at 335 core, zero fixture, 69 transitive and
  zero global diagnostics. Next audit feed recomputation and its active-photo
  continuation. The physical-TV cursor report remains unresolved.

### 2026-11-14: Audit Smart-Selection Execution Inputs

- **Outcome**: documented the distinction between the reducer's truthy defaults
  and the selector's undefined-only defaults. Explicit null is forwarded to
  native clock or conditional random operations, not validated or normalized.
  Local type assertions leave executable production syntax unchanged.
- **Coverage**: three runtime regressions and compiler fixtures cover weather
  precedence, clock/draw ordering, no-candidate and zero-weight paths, sequence
  short-circuiting and propagated failures. The existing functional pipeline
  already expresses the behavior without an additional abstraction.
- **Verification**: 857 assertions, 13 sensor regressions and three compiler
  fixtures pass; the optional live endpoint smoke is skipped on sandbox
  `EPERM`. Strict checking remains nonzero at 337 core, zero fixture, 69
  transitive and zero global diagnostics. Next audit active-photo maintenance.
  The physical-TV cursor report remains unresolved.

### 2026-11-14: Audit Selectable Photo Lookup and Preview Staging

- **Outcome**: documented lookup precedence and raw row/fallback aliases, and
  preview staging's identity, shallow-copy and repeated-read behavior. The
  existing small pure projections remain unchanged; a local type assertion
  describes the partial copy without performing validation.
- **Coverage**: four runtime regressions and private compiler fixtures cover
  lookup precedence, eager pool reads, strict keys, copying, getters, malformed
  inputs and native failures. Executable production syntax is unchanged.
- **Verification**: 854 assertions, 13 sensor regressions and three compiler
  fixture tests pass; the optional live endpoint smoke is skipped on sandbox
  `EPERM`. Strict domain checking remains nonzero at 339 core, zero fixture,
  69 transitive and zero global diagnostics. Next audit nullable playback
  environment forwarding. The physical-TV cursor report remains unresolved.

### 2026-11-14: Audit Playback Command Composition

- **Outcome**: documented the existing generic playback selection and
  preparation pipeline. Null payloads and falsy selections retain their
  short-circuit behavior; direction resolves before cloning and callbacks
  receive the original aliases. No executable production syntax changed.
- **Coverage**: three runtime regressions and private compiler fixtures cover
  callback ordering and identities, environment forwarding, unchanged-photo
  events, defaults and native failures. No new abstraction was needed.
- **Verification**: 850 assertions, 13 sensor regressions and three compiler
  fixture tests pass; the optional live endpoint smoke is skipped on sandbox
  `EPERM`. Strict domain checking remains nonzero at 345 core, zero fixture,
  69 transitive and zero global diagnostics. Next audit selectable-photo lookup
  and preview staging. The physical-TV cursor report remains unresolved.

### 2026-11-14: Audit Pool Command and Mutation Composition

- **Outcome**: documented generic pool-command and guarded-mutation contracts.
  Resolvers run before the guard; guarded payloads are shallow copies whose
  non-name fields may be absent, while unguarded payloads retain identity.
  The existing partially applied composition stays intact without new ceremony.
- **Coverage**: five runtime regressions and private compiler fixtures cover
  existence checks, changing getters, guard-name precedence, method receivers,
  cloning, no-op identity, output ordering and propagated failures. A local
  type assertion preserves native optional-apply behavior without validation.
- **Verification**: 847 assertions, 13 sensor regressions and three compiler
  fixture tests pass; the optional live endpoint smoke is skipped on sandbox
  `EPERM`. Strict domain checking remains nonzero at 371 core, zero fixture,
  69 transitive and zero global diagnostics. Next audit playback-command
  selection and preparation. The physical-TV cursor report remains unresolved.

### 2026-11-14: Audit Feed-Command Payload and Option Composition

- **Outcome**: documented the existing partially applied payload continuation,
  option projection and feed-command builder without changing their behavior.
  A partial projected record reflects omitted non-enumerable and symbol keys;
  local assertions describe native evaluation, not runtime validation.
- **Coverage**: three regressions and private compiler fixtures preserve null-only
  rejection, aliases, eager option reads and callbacks, no-op and environment
  precedence, finalizer resolution, and native failures. No additional wrapper
  or algebra improves the existing composition.
- **Verification**: 842 assertions, 13 sensor regressions and three compiler
  fixture tests pass; the optional live endpoint smoke is skipped on sandbox
  `EPERM`. The strict domain baseline remains nonzero at 395 core, zero fixture,
  69 transitive and zero global diagnostics. Next audit the pool-command and
  pool-mutation adapters. The physical-TV cursor report remains unresolved.

### 2026-11-14: Audit Field Commands and Feed Finalization

- **Outcome**: documented the partially applied field-command contract and the
  adjacent feed mutation/finalization boundary. Runtime behavior remains intact;
  callback relationships remain explicit without adding functional ceremony.
- **Tests**: four runtime cases and private positive/negative compiler fixtures
  cover aliases, raw values and native keys, no-op identity, option ordering,
  context, defaults, persistence ordering and propagated failures.
- **Checkpoint**: strict type checking remains nonzero at 426 core, zero fixture,
  69 transitive and zero global diagnostics. Next audit payload/option adapters
  and the feed-command builder; the physical TV cursor report remains open.

### 2026-11-13: Investigate Reported TV Cursor Regression

- **Host evidence**: the service was active, `screensaverActive` was true,
  Chromium used `?mode=tv`, and served HTML matched the local built HTML.
  Selected pools were not changed; no service restart or live interaction was
  required. These observations do not establish what the physical pointer or
  the already loaded kiosk DOM was doing.
- **Coverage**: isolated built-client browser tests exercise the inactivity
  deadline, rearming, settings drawer, active-state transition, and admin preview
  page boundary. React owns timer and DOM effects; no new abstraction or
  production behavior change was warranted by this evidence.
- **Follow-up**: physically observe the TV and investigate live cursor and
  pointer-event behavior. The user report remains unresolved and no cause is
  asserted. Step 6's next field-reducer audit remains queued.

### 2026-11-13: Audit Entries-Command Reducer and Record Pointer Report

- **Outcome**: checked contracts preserve the partially applied entry reader's
  command, cloned-state and selected-target relationships and reuse the existing
  command options type. No executable production code changed.
- **Tests**: two regressions and private compiler fixtures cover constant and
  computed entries, ordering, aliases, no-ops, option reads and native failures.
- **Verification**: 835 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint and production AST checks pass. The optional live
  endpoint smoke is skipped on sandbox `EPERM`. Strict domain checking remains
  nonzero at 444 core, zero fixture, 69 transitive and zero global diagnostics.
- **Follow-up**: the reported TV pointer regression is on the roadmap for
  physical-kiosk investigation; its cause and resolution are not yet verified.
  Next audit the partially applied field-command reducer.

### 2026-11-12: Audit Command-Aware Mutations

- **Outcome**: the generic command-mutation contract relates the original
  command to apply and output callbacks while retaining the shared cloned state
  and the existing no-op identity. No executable production code changed.
- **Tests**: two runtime regressions and private compiler fixtures cover aliases,
  option reads, defaults and explicit falsy values, callback order, persistence,
  no-ops, typed command callbacks and propagated failures.
- **Verification**: 833 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint and production AST checks pass. The optional live
  endpoint smoke is skipped on sandbox `EPERM`. Strict domain checking remains
  nonzero at 453 core, zero fixture, 69 transitive and zero global diagnostics.
- **Next**: audit the partially applied entries-command reducer builder.

### 2026-11-12: Audit Cloned-State Mutations

- **Outcome**: the shared clone/apply boundary relates its clone to both
  callbacks and retains the continuation result alongside the unchanged result.
  State mutations describe their state-aware event/effect factories; no runtime
  validation or executable production changes were introduced.
- **Tests**: two regressions cover option and clone read ordering, original and
  clone identities, truthy and falsy callbacks, defaults, factory order,
  persistence and propagated failures. Private compiler fixtures check callback
  relationships, the no-op union and the closed event vocabulary.
- **Verification**: 831 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint and production AST checks pass. The optional live
  endpoint smoke is skipped on sandbox `EPERM`. Strict domain checking remains
  nonzero at 461 core, zero fixture, 69 transitive and zero global diagnostics.
- **Next**: audit command-aware mutation callback adaptation and defaults.

### 2026-11-12: Audit Mutation-Result Factories

- **Outcome**: generic contracts relate mutation event/effect factories to an
  explicit context or the undefined-only state fallback. Output resolution
  keeps aliases, and canonical types do not imply runtime validation. The
  implementation uses local type erasure for overloads and a callable-only
  assertion at the native factory dispatch; executable syntax is unchanged.
- **Tests**: three regressions cover getter and factory ordering, explicit
  null/falsy contexts, default/falsy output freshness, persistence, malformed
  pass-through, spread and exceptions. Private compiler fixtures check context
  and closed event/effect vocabularies.
- **Verification**: 829 assertions, 13 sensor regressions and three typecheck
  report tests pass. The optional live endpoint smoke is skipped on sandbox
  `EPERM`. Strict domain checking remains nonzero at 473 core, zero fixture,
  69 transitive and zero global diagnostics.
- **Next**: audit clone/apply/continuation contracts in `reduceClonedMutation`
  and `reduceStateMutation`.

### 2026-11-12: Audit State-Patch Reducer

- **Outcome**: the private patch reducer now describes its state, unknown patch,
  execution environment and result; the shared result builder accepts effect
  arrays and factories. Other builder inputs remain unchecked. Executable
  production syntax is unchanged.
- **Tests**: eager cloning before patch reads, fresh no-op arrays and original
  state identity, clone failures, conditional environment reads, ordering of
  environment access and persistence/refresh effects, and private type checks.
- **Verification**: 826 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint and production AST checks pass. The optional live
  endpoint smoke is skipped on sandbox `EPERM`. Strict domain checking remains
  nonzero at 475 core, zero fixture, 69 transitive and zero global diagnostics.
- **Next**: audit the shared mutation-result and output-resolution contracts,
  including generic context, event/effect factories, defaults and failures.

### 2026-11-11: Audit Widget Patch Merge

- **Outcome**: the widget reader remains a partial boolean record. A local
  assertion applies only to spreading its own boolean-valued entries; arbitrary
  key presence is not guaranteed. Executable production syntax is unchanged.
- **Tests**: absent and inherited keys, non-enumerable known keys, `__proto__`,
  immutable merge, no-op identity and private positive/negative type fixtures.
- **Verification**: 824 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax and production AST checks pass. The optional
  live endpoint smoke is skipped on sandbox `EPERM`. Strict domain checking
  remains nonzero at 485 core, zero fixture, 69 transitive and zero global.
- **Next**: audit `reduceStatePatchCommand` input and result composition.

### 2026-11-10: Document Shared Patch Interpretation

- **Outcome**: generic spec and context contracts retain reader/callback types;
  the heterogeneous spec list has one local type-erasure boundary. Native flag
  access, callback ordering and executable production syntax are unchanged.
- **Tests**: callback and flag aliases, fresh defaults, skip and no-op identity,
  write-before-flag order, flag short-circuiting, preserved extra fields,
  propagated failures and private positive/negative compile fixtures.
- **Verification**: 822 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax and production AST checks pass. The optional
  live endpoint smoke is skipped on sandbox `EPERM`. Strict domain checking
  remains nonzero at 486 core, zero fixture, 69 transitive and zero global.
- **Next**: audit the widget patch partial-record contract and immutable merge.

### 2026-11-10: Document Config Patch Specifications

- **Outcome**: separate default-reader and generic custom-reader contracts
  document callbacks and unvalidated flags. Native coercion and immutable
  projection behavior remain intact; executable production syntax is unchanged.
- **Tests**: immutable state/config writes, aliases, symbol keys, default flags,
  skip/no-op identity, callback order, flag truthiness, failures, and positive
  and negative private compile fixtures.
- **Verification**: 819 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax and production AST checks pass. The optional
  live endpoint smoke is skipped on sandbox `EPERM`. Strict domain checking
  remains nonzero at 497 core, zero fixture, 69 transitive and zero global.
- **Next**: audit the shared patch-spec construction and interpretation contracts.

### 2026-11-09: Document Reducer Object Guard

- **Outcome**: the existing predicate narrows unknown inputs to records of
  unknown properties, not validated plain objects. Prototype acceptance, native
  behavior and executable production syntax are unchanged.
- **Tests**: null/custom prototypes, opaque and revoked proxies, array/function
  exclusion, inherited vision/location fields, repeated reads, accessor failures
  and private positive/negative type fixtures.
- **Verification**: 817 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax and production AST checks pass. The optional
  live endpoint smoke is skipped on sandbox `EPERM`. Strict domain checking
  remains nonzero at 505 core, zero fixture, 69 transitive and zero global.
- **Next**: audit config patch spec options, callbacks and flags.

### 2026-11-09: Document Partially Applied Patch Reader

- **Outcome**: separate identity and generic callback overloads retain the
  skip sentinel, raw second read, original state and patch aliases. Local
  dynamic assertions model native property-key coercion, not validation; the
  existing declarative reader and executable production syntax are unchanged.
- **Tests**: missing versus undefined values, partially applied identity,
  symbol/custom keys, lookup and callback ordering, exact failures, and private
  compile-time fixtures for unknown values, skip and generic results.
- **Verification**: 815 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax, whitespace and production AST checks pass.
  The optional live endpoint smoke is skipped on sandbox `EPERM`. Strict domain
  typechecking remains nonzero at 508 core, zero fixture, 69 transitive and
  zero global diagnostics; vision/location guard narrowing remains unresolved.
- **Next**: audit the reducer's object guard and vision/location consumers.

### 2026-11-09: Audit Reducer Widget Patch Reader

- **Outcome**: documented the private data-first reader's unknown patch input,
  boolean record or skip sentinel, own-key filtering, native truthiness and
  failures. Existing composition and executable production syntax remain intact.
- **Tests**: invalid and missing values, inherited/hidden/symbol/unknown keys,
  fresh outputs, repeated reads, filter-before-value order, exact failures,
  and reducer state, event and persistence behavior.
- **Verification**: 812 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax, whitespace and production AST checks pass.
  The optional live endpoint smoke is skipped on sandbox `EPERM`. The strict
  domain baseline remains nonzero at 514 core, zero fixture, 69 transitive and
  zero global diagnostics; a callback mismatch remains in `readPatchField`.
- **Next**: document the shared patch-reader callback and result contracts.

### 2026-11-09: Document Widget Patch Inputs and Results

- **Outcome**: the pure data-first builder accepts unknown input and returns a
  nullable patch containing raw values and possibly symbol keys. Local type
  assertions retain native property access and key coercion without validation;
  no executable production syntax or export changed.
- **Tests**: inherited and callable inputs, nullish and primitive values, fresh
  patch containers, raw aliases, proxy lookup order, exact accessor failures,
  and compile-time narrowing join existing coercion and decoder tests.
- **Verification**: 809 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax, whitespace and production AST checks pass.
  The optional live endpoint smoke is skipped on sandbox `EPERM`. Strict domain
  typecheck remains nonzero at 515 core, zero fixture, 69 transitive and zero
  global diagnostics.
- **Next**: audit `readWidgetPatch` input/result contracts and normalization.

### 2026-11-09: Plan Image Comments, Display Controls, Trends, and Collections

- **Roadmap**: placed private-by-default admin image comments and a separate TV
  weather-location visibility control in Phase 1; placed temperature/humidity
  trends with the Phase 2 sensor platform; and added a Phase 1 feasibility
  investigation for Unsplash collection subscriptions.
- **Boundaries**: comments remain distinct from ratings and AI captions; hiding
  a label must not disable location-dependent behavior; trends need explicit
  comparison and missing-data semantics and non-color-only cues; Unsplash API,
  licensing, attribution, refresh, and identity constraints need investigation.
- **Scope**: documentation and planning only; no implementation, runtime
  changes, deployment, or tests.

### 2026-11-04: Preserve Widget Computed-Key Coercion

- **Outcome**: a local dynamic assertion permits native property-key coercion
  on an unknown trim result without validation or executable syntax changes.
  The widget patch remains a small data-first projection.
- **Tests**: decoder composition, symbol and special keys, native evaluation
  order, falsy short circuits, malformed key conversion and exact failures.
- **Verification**: 807 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax, whitespace and production AST checks pass.
  The optional live endpoint smoke is skipped on sandbox `EPERM`. Strict
  typecheck remains nonzero at 516 core, zero fixture, 69 transitive and zero
  global diagnostics.
- **Next**: document widget patch input and result compatibility.

### 2026-10-30: Document Trim String Projection

- **Outcome**: the pure data-first helper accepts unknown and preserves the
  native trim result as unknown; non-strings yield an empty string. No new
  abstraction, export or executable production change was needed.
- **Tests**: native-trim idempotence, decoder composition, uninspected inputs,
  isolated lookup and receiver, raw aliases and falsy results, exact failures.
- **Verification**: 805 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax, whitespace and production AST checks pass.
  The optional live endpoint smoke is skipped on sandbox `EPERM`. Strict
  typecheck remains nonzero at 517 core, zero fixture, 69 transitive and zero
  global diagnostics: one implicit-input error was replaced by a real unknown
  computed-key diagnostic in the widget patch.
- **Next**: model widget computed-key coercion without changing native behavior.

### 2026-10-30: Document Required String Projection

- **Outcome**: the pure data-first decoder accepts unknown inputs and returns
  the original primitive string or null. Native trim lookup, receiver,
  truthiness and failures remain observable; no new abstraction or export was
  needed, and executable production syntax is unchanged.
- **Tests**: primitive and whitespace cases, decoder composition, native-trim
  idempotence, isolated custom trim results and exact lookup/call failures.
- **Verification**: 803 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax, whitespace and production AST checks pass.
  The optional live endpoint smoke is skipped on sandbox `EPERM`. Strict
  typecheck remains nonzero at 517 core, zero fixture, 69 transitive and zero
  global diagnostics.
- **Next**: document `trimString` while preserving raw native trim results.

### 2026-10-30: Preserve HTTP Category Decoder Semantics

- **Outcome**: local assertions document native eager lookup without rejecting
  inherited, callable or boxed inputs. Category commands admit unknown results
  because an array's overridden `join` may return any truthy value.
- **Tests**: property order, priority, empty input, original aliases, custom
  join receiver/results, exact errors and compile-time narrowing. Production
  executable syntax and exports are unchanged.
- **Verification**: 801 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax, whitespace and production AST checks pass.
  The optional live endpoint smoke is skipped on sandbox `EPERM`. Strict
  typecheck remains nonzero at 518 core, zero fixture, 69 transitive and zero
  global diagnostics.
- **Next**: document `readRequiredString` without changing trimming or failures.

### 2026-10-30: Preserve Screensaver Decoder Lookup Semantics

- **Outcome**: the decoder uses local unknown-valued property assertions without
  runtime validation. A boolean first read permits a command, but the second
  read is unvalidated and its command payload is typed unknown. Callable,
  inherited and boxed property lookup and errors remain native.
- **Tests**: changing inherited callable getters, exact proxy failures,
  short-circuiting, reducer truthiness and compile-time narrowing; production
  executable syntax remains unchanged.
- **Verification**: runtime suite, lint, syntax, whitespace and production AST
  checks pass; the optional live endpoint smoke is skipped on sandbox `EPERM`.
  Strict typecheck remains nonzero at 520 core, zero fixture, 69 transitive and
  zero global diagnostics.
- **Next**: narrow `decodeCategorySelectionFromHttp` without changing native
  destructuring and property access behavior.

### 2026-10-30: Preserve Native Pairing URL Comparison

- **Outcome**: the pure pairing selector retains native dynamic method lookup
  and sort coercion through a local type assertion. URLs remain unvalidated;
  malformed values can still throw and executable production syntax is unchanged.
- **Tests**: method receiver, raw argument, accessor ordering, comparator-result
  coercion, single-candidate behavior, native failures and raw URL narrowing.
- **Verification**: 797 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax, whitespace and production AST checks pass.
  The optional live endpoint smoke was skipped because the sandbox denied
  listening. Strict typecheck remains nonzero at 522 core, zero fixture, 69
  transitive and zero global diagnostics.
- **Next**: address unknown-input narrowing in `decodeScreensaverActiveCommand`
  while preserving callable/inherited inputs, repeated reads and native failures.

### 2026-10-30: Preserve Native Sequential Cursor Keys

- **Outcome**: the existing pure sequential selector uses a local dynamic key
  assertion at property access, without converting or validating raw categories.
  The selected row and its category remain unnormalized; executable production
  syntax and playback behavior are unchanged.
- **Tests**: symbol keys, object-to-symbol coercion and its string hint, proxy
  lookup order, nullish cursor short-circuiting, exact thrown-error identity and
  compile-time raw-category narrowing.
- **Verification**: 795 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax, whitespace and production AST checks pass.
  The optional live endpoint smoke was skipped because the sandbox denied
  listening. Strict typecheck remains nonzero at 523 core, zero fixture, 69
  transitive and zero global diagnostics.
- **Next**: address malformed pairing URL sort contracts without hiding native
  failures, then continue the bounded acceptance queue.

### 2026-10-30: Isolate Native Numeric Coercion

- **Outcome**: rating and night selection share a private data-first division
  boundary with unknown input and a numeric successful result. Its single local
  dynamic assertion permits the native operator; it does not validate input or
  erase the possibility of coercion failures. Public selector shapes are intact.
- **Tests**: numeric primitives and objects, coercion hints and RNG order, exact
  native Symbol/BigInt errors, custom error identity and raw-rating compile-time
  narrowing. Existing short-circuit, nullish-default and alias tests remain.
- **Verification**: 793 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax and whitespace checks pass. The optional live
  endpoint smoke was skipped because the sandbox denied listening. Strict domain
  typecheck remains nonzero at 524 core, zero fixture, 69 transitive and zero
  global diagnostics.
- **Next**: address raw cursor key indexing and malformed pairing URL sorting
  without hiding native failures, then continue the bounded acceptance queue.

### 2026-10-30: Model Raw Smart-Selection Rows

- **Outcome**: the existing data-first smart and weighted selectors and their
  pure preference filters preserve generic raw row types; state-backed smart
  selection returns an unvalidated row or null. Pool grouping preserves Map key
  identity. No executable production code or playback policy changed.
- **Tests**: staged preview aliases, object category identity, rating coercion,
  malformed schedules, empty selections and compiler narrowing are covered.
- **Acceptance review**: Step 6 remains incomplete. Strict typecheck reports 526
  core, zero fixture, 69 transitive and zero global diagnostics; native rating
  and night division, cursor keys and malformed pairing URL sorting remain
  visible alongside command/effect inference work.
- **Verification**: 791 assertions, 13 sensor regressions and three typecheck
  report tests pass; lint, syntax, whitespace and production AST checks pass.
  The optional endpoint smoke was skipped because the sandbox denied listening.
- **Next**: address those exposed coercion and key contracts without silently
  changing native behavior, then continue the bounded acceptance queue.

### 2026-10-30: Model Raw Current-Frame Photos

- **Outcome**: the pure current-frame projection and legacy/public snapshot
  active-photo fields admit raw feed aliases; crop and category metadata remain
  unknown. Pairing, nullish defaults, and snapshot copies are unchanged, as is
  executable production code. Malformed candidate URLs may throw during sorting.
- **Tests**: staged-preview and paired aliases, detached categories, snapshot
  copies, falsy/nullish defaults, sort failures and compiler narrowing.
- **Verification**: strict no-emit typecheck remains nonzero at 531 core, zero
  fixture, 69 transitive and zero global diagnostics. Runtime suite and lint
  passed; the optional endpoint smoke was skipped due to sandbox `EPERM`.
- **Next**: model raw smart-selection outputs and native coercion, then re-audit
  the Step 6 acceptance criteria.

### 2026-10-30: Model Raw Active-Photo Lookup

- **Outcome**: the pure data-first active lookup returns `FeedPhoto | null`, and
  orientation accepts unvalidated metadata. Feed-first and curated/external
  fallback precedence, row aliases and numeric-only orientation remain intact;
  no executable production code changes.
- **Tests**: staged preview aliases, fallback/miss behavior, malformed dimensions,
  accessor failures and compile-time narrowing are covered.
- **Verification**: strict no-emit typecheck remains nonzero at 536 core, zero
  fixture, 68 transitive and zero global diagnostics. Four frame-field errors are
  now exposed, replacing two lookup/orientation mismatches. Runtime suite and
  lint passed; the optional endpoint smoke was skipped due to sandbox `EPERM`.
- **Next**: model current-frame and smart-selection outputs, then address honest
  coercion typing before the Step 6 acceptance re-audit.

### 2026-10-30: Model Raw Sequential Selection

- **Outcome**: the pure data-first sequential selector returns `FeedPhoto | null`
  rather than promising normalized metadata. Selected rows retain their original
  aliases; no executable production code changes.
- **Tests**: staged preview metadata, shared nested aliases, pool rotation,
  native cursor-key coercion, untouched inputs and hidden rows are covered.
  Compiler fixtures require narrowing and allow an empty selection.
- **Verification**: strict no-emit typecheck remains nonzero at 534 core, zero
  fixture, 68 transitive and zero global diagnostics, one fewer core error.
  Runtime suite and lint passed; the optional endpoint smoke was skipped because
  sandbox socket creation returned `EPERM`.
- **Next**: model raw smart-selection and current-frame outputs, then address
  honest coercion typing before the Step 6 acceptance re-audit.

### 2026-10-30: Model Unvalidated Feed State

- **Outcome**: `FeedPhoto` describes unknown known fields in domain, legacy and
  public snapshot feeds without weakening normalized collection `Photo` types.
  Preview staging, shallow snapshot copies and shared nested metadata retain
  their existing behavior; no executable production code changes.
- **Tests**: two regressions follow raw preview and legacy rows across state and
  snapshots, including array/row identities and nested aliases. Compiler fixtures
  require narrowing and accept raw legacy and preview metadata.
- **Verification**: strict no-emit typecheck remains nonzero at 535 core, zero
  fixture, 68 transitive and zero global diagnostics. Five newly exposed selector
  errors identify unresolved raw-feed consumers. Runtime suite, lint, syntax and
  whitespace checks passed; the optional endpoint smoke was skipped because
  sandbox socket creation returned `EPERM`.
- **Next**: model selection and current-frame results for unvalidated feed rows,
  then address honest coercion typing before the Step 6 acceptance re-audit.

### 2026-10-30: Narrow Generic Photo Filter Results

- **Outcome**: the visibility and URL-deduplication filters now express their
  existing retained-row guarantee as generic type predicates. Visibility uses
  boolean conversion of its existing short-circuit expression; deduplication
  already returned booleans. Neither validates or normalizes photo metadata.
- **Tests**: nullable rows, truthy object URLs, accessor order, short circuits,
  exceptions, aliases and compile-time preservation of raw rows are covered.
- **Verification**: strict no-emit typecheck remains nonzero at 530 core, zero
  fixture, 68 transitive and zero global diagnostics, two fewer core errors.
  Runtime suite, lint, syntax and whitespace checks passed; optional endpoint
  smoke was skipped because sandbox socket creation returned `EPERM`.
- **Next**: model remaining unnormalized feed, snapshot and selector contracts
  and honest coercion typing before the Step 6 acceptance re-audit.

### 2026-10-30: Preserve Compatibility Visibility Filter Types

- **Outcome**: the pure, data-first `filterVisiblePhotos` retains raw input row
  types and admits unknown visibility metadata. Filtering preserves aliases,
  truthiness, exact rating comparison and native keyword coercion; executable
  production behavior is unchanged.
- **Tests**: frozen rows cover unnormalized values, aliasing, idempotence,
  concatenation, getter failures and Symbol coercion. Compiler fixtures retain
  metadata and require normalization and possible-absence checks.
- **Verification**: strict no-emit typecheck remains nonzero at 532 core, zero
  fixture, 68 transitive and zero global diagnostics. One newly exposed TS2322
  reflects the compiler's inability to narrow nullish rows through the current
  filter. Runtime suite, lint, syntax and whitespace checks passed; optional
  endpoint smoke was skipped because sandbox socket creation returned `EPERM`.
- **Next**: model remaining feed, snapshot and selector contracts, then address
  generic filter narrowing and honest coercion typing before re-auditing Step 6.

### 2026-10-30: Preserve Compatibility URL Deduplication Types

- **Outcome**: the pure data-first `uniqByUrl` retains raw row types and accepts
  unknown URL values. First truthy URL ownership, Set equality, row aliases,
  repeated property reads and exceptions remain unchanged; no runtime wrapper
  or new abstraction is needed.
- **Tests**: frozen rows cover URL and metadata identity, duplicate and falsy
  URLs, ordered output, idempotence and getter behavior. Compile fixtures retain
  raw metadata and require normalization and possible absence checks.
- **Verification**: strict no-emit typecheck remains nonzero at 531 core, zero
  fixture, 68 transitive and zero global diagnostics. Runtime suite, lint, syntax
  and whitespace checks passed; optional endpoint smoke was skipped because
  sandbox socket creation returned `EPERM`.
- **Next**: model the remaining unnormalized feed state, snapshots and selector
  contracts, then address honest coercion typing and re-audit Step 6.

### 2026-10-30: Preserve Compatibility Feed Lookup Types

- **Outcome**: the pure, data-first `findPhotoInFeed` retains each input row's
  type instead of asserting normalized metadata and accepts unknown lookup keys.
  Its strict comparison, first alias, nullish matching and getter behavior remain
  unchanged. Generic typing adds no runtime wrapper or production code change.
- **Tests**: frozen raw rows cover object identity, strict matching, nullish
  entries and getter failures; compiler fixtures retain metadata and require
  null and normalization checks.
- **Verification**: strict no-emit typecheck remains nonzero at 531 core, zero
  fixture, 68 transitive and zero global diagnostics. Runtime suite, lint, syntax
  and whitespace checks passed; the optional endpoint smoke was skipped because
  sandbox socket creation returned `EPERM`.
- **Next**: model unnormalized feed state, snapshot and remaining selector
  contracts; then address honest coercion typing and re-audit Step 6.

### 2026-10-30: Model Compatibility Night Percentage

- **Outcome**: legacy input, domain state, snapshots and night selector inputs
  admit unknown values. Raw patches and the legacy shell retain aliases; rebuilds
  use a nullish default, socket input is validated separately, and selection
  retains native division. The existing data-first selector and injected RNG
  remain the appropriate small functional boundary; executable code is unchanged.
- **Tests**: cover falsy, nullish, string, object and NaN values; immutable inputs,
  no-op patches, socket parsing, selector identity, smart selection, conditional
  draws, coercion failures and compile-time narrowing.
- **Verification**: strict no-emit typecheck remains nonzero at 531 core, zero
  fixture, 68 transitive and zero global diagnostics. The added TS2362 exposes
  native division of an unknown operand; no cast or suppression hides it. Runtime
  suite, lint, syntax and whitespace checks passed; the optional endpoint smoke
  was skipped because sandbox socket creation returned `EPERM`.
- **Next**: model unnormalized photo/feed values, then resolve coercion typing
  honestly and re-audit Step 6 acceptance.

### 2026-10-30: Model Compatibility Time Alignment

- **Outcome**: legacy input, domain state, snapshots and night selector inputs
  admit unknown values. Patches and the legacy shell retain aliases; rebuilding,
  socket toggles and night preference use truthiness. The existing pure,
  data-first selector and its injected random source need no new abstraction;
  state mutation remains in the compatibility shell. Executable code is unchanged.
- **Tests**: cover raw/falsy values, aliasing, a throwing coercion hook, truthy
  `"false"`, no-op patches, disabled/daytime identity, conditional draws, smart
  selection and compile-time narrowing.
- **Verification**: strict no-emit typecheck remains nonzero at 530 core, zero
  fixture, 68 transitive and zero global diagnostics. Runtime suite, lint, syntax
  and whitespace checks passed; the optional endpoint smoke was skipped because
  sandbox socket creation returned `EPERM`.
- **Next**: model `nightPercentage` and unnormalized photo/feed values, including
  native numeric coercion and selector defaults; Step 6 remains open.

### 2026-10-30: Model Compatibility Weather Alignment

- **Outcome**: legacy input, domain state, snapshots and weather selector inputs
  admit unknown values. Raw patches and the legacy shell retain aliases; legacy
  rebuilding, the socket toggle and preference filtering use truthiness. The
  existing data-first pure selector needs no additional abstraction or runtime
  changes; state mutation remains in the compatibility shell.
- **Tests**: cover raw/falsy values, aliasing, a throwing coercion hook, truthy
  `"false"`, no-op patches, selector identity and compile-time narrowing.
- **Verification**: strict no-emit typecheck remains nonzero at 530 core, zero
  fixture, 68 transitive and zero global diagnostics. Runtime suite, lint, syntax
  and whitespace checks passed; the optional endpoint smoke was skipped because
  sandbox socket creation returned `EPERM`.
- **Next**: model `alignTimeOfDay`, `nightPercentage` and unnormalized photo/feed
  values; Step 6 remains open.

### 2026-10-30: Model Compatibility OpenAI Fallback Consent

- **Outcome**: legacy input, domain state and snapshots admit unknown fallback
  values. Pure patches preserve raw values and aliases into the mutable legacy
  shell; rebuilds and the legacy toggle separately apply truthiness. No runtime
  production behavior changed and no additional abstraction was needed.
- **Tests**: cover raw/falsy values, aliasing, omitted patches, legacy rebuilds,
  legacy-shell application, toggle coercion, and compile-time narrowing.
- **Consent follow-up**: the vision gate also uses truthiness, so a raw string
  `"false"` enables fallback. Explicit boolean validation and compatibility policy
  require a separate behavioral hardening change, not a type-only correction.
- **Verification**: strict no-emit typecheck remains nonzero at 530 core, zero
  fixture, 68 transitive and zero global diagnostics. Runtime suite, lint, syntax
  and whitespace checks passed; the optional endpoint smoke was skipped because
  sandbox socket creation returned `EPERM`.
- **Next**: model the other three raw state fields and unnormalized photo/feed
  values; Step 6 remains open.

### 2026-10-30: Model Compatibility Split Portrait Values

- **Outcome**: legacy input, domain state and public snapshots admit unknown
  `splitPortrait` values. Patches preserve raw values and aliases, while legacy
  rebuilding, direct commands and frame eligibility use truthiness. No executable
  production code changed.
- **Tests**: cover raw and falsy values, aliases, truthy strings and objects,
  frame layout, omitted patches, direct-command coercion and persistence. Compile
  fixtures require narrowing before treating state or snapshot values as booleans.
- **Verification**: strict no-emit typecheck remains nonzero at 530 core, zero
  fixture, 68 transitive and zero global diagnostics. Runtime suite, lint, syntax
  and whitespace checks passed; optional endpoint smoke was skipped because
  sandbox socket creation returned `EPERM`.
- **Next**: model the remaining four raw state fields and unnormalized photo/feed
  values; Step 6 remains open.

### 2026-10-30: Model Compatibility Split Crop Values

- **Outcome**: legacy, domain, snapshot and derived secondary-frame crop
  contracts admit unknown values. The pure projections preserve raw patch
  aliases, nullish fallback and photo-crop precedence; the direct command
  separately coerces numbers. No executable production code changed.
- **Tests**: cover falsy values, aliases, nullish defaults, photo precedence,
  omitted patches, direct coercion, persistence and coercion failures. Compile
  fixtures require narrowing for state, snapshots and frames.
- **Verification**: strict no-emit typecheck remains nonzero at 530 core, zero
  fixture, 68 transitive and zero global diagnostics. Runtime suite, lint,
  syntax and whitespace checks passed; the optional endpoint smoke was skipped
  because sandbox socket creation returned `EPERM`.
- **Next**: model the remaining five raw state fields and unnormalized
  photo/feed values; Step 6 remains open.

### 2026-10-30: Model Compatibility Scale Values

- **Outcome**: legacy, domain and public snapshot contracts describe
  `scaleMode` as unknown. Patches and legacy rebuilds preserve raw values and
  aliases; the direct command also preserves supplied values and skips undefined.
  No executable production code changed.
- **Tests**: runtime cases cover raw/falsy values, aliases, legacy rebuilds,
  undefined no-ops, and direct-command persistence. Compile fixtures require
  narrowing before treating a scale mode as `cover` or `contain`.
- **Verification**: strict no-emit typecheck remains nonzero at 530 core, zero
  fixture, 68 transitive and zero global diagnostics. Runtime suite, lint,
  syntax and whitespace checks passed; optional endpoint smoke was skipped
  because sandbox socket creation returned `EPERM`.
- **Next**: model the remaining six raw state fields and unnormalized photo/feed
  values; no Step 6 closeout is claimed.

### 2026-10-30: Model Compatibility Timing Values

- **Outcome**: legacy, domain and public snapshot contracts now describe
  `inactivityTimeout` and `slideshowInterval` as unknown. Raw patches and legacy
  rebuilds retain values and aliases; the direct interval command separately
  applies native numeric coercion. No executable production code changed.
- **Tests**: runtime cases cover raw/falsy values, aliases, undefined no-ops,
  legacy rebuilds, numeric coercion, omitted-payload NaN and thrown coercion.
  Compile fixtures require narrowing before numeric use.
- **Verification**: strict no-emit typecheck remains nonzero at 530 core, zero
  fixture, 68 transitive and zero global diagnostics. Runtime suite, lint,
  syntax and whitespace checks passed; optional endpoint smoke was skipped
  because sandbox socket creation returned `EPERM`.
- **Next**: model the remaining seven raw state fields and unnormalized
  photo/feed values; no Step 6 closeout is claimed.

### 2026-10-30: Model Compatibility Theme Values

- **Outcome**: the existing pure state and snapshot projections now document
  `theme` as unknown in legacy and domain contracts. Patches and snapshots can
  retain raw objects and aliases; direct `change-theme` separately applies its
  existing truthy fallback and string coercion. No executable code changed.
- **Tests**: runtime cases cover falsy values, shared references, legacy rebuilds,
  undefined patch no-ops, direct coercion and failures. Compile fixtures accept
  raw theme values but require narrowing before treating state or snapshot as a
  string.
- **Verification**: strict no-emit typecheck remains nonzero at 530 core, zero
  fixture, 68 transitive and zero global diagnostics. Runtime suite, lint, syntax
  and whitespace checks passed; optional endpoint smoke was skipped (`EPERM`).
- **Next**: model the other nine raw state fields and unnormalized photo/feed
  values; this single field does not make the whole compatibility state sound.

### 2026-10-30: Distinguish Active Photo Preview Inputs

- **Outcome**: `ActivePhotoPreview` models the object passed through an
  active-photo command separately from selector-facing `Photo`. URL validation
  applies to the captured command URL, not later reads or optional metadata.
  Objects, arrays, accessors and inherited values keep existing behavior; no
  executable code, export, runtime validation, or functional wrapper was added.
- **Tests**: runtime coverage checks aliases, native URL reads and failures,
  callable and string inputs, and shallow feed staging with unnormalized values
  and nested aliases. Positive and negative compile fixtures distinguish preview
  objects from normalized photos and reject primitive preview fields.
- **Verification**: `npm test` passed (763 executed, zero failures; 13/13 sensor
  and 3/3 reporter tests); the optional live endpoint smoke was skipped because
  the sandbox denied socket creation. Lint and whitespace checks passed. The
  strict no-emit typecheck remains nonzero at 530 core, zero fixture, 68
  transitive and zero global diagnostics.
- **Next**: model compatibility state and feed values honestly; the reducer can
  still stage unvalidated preview metadata, so this slice does not establish
  the selector-facing `Photo` invariant or complete Step 6.

### 2026-10-29: Type the Heterogeneous Handler Invoker

- **Outcome**: the existing data-last invoker now retains its handler-result
  union and undefined fallback in a local generic contract. It does not promise
  that an item payload matches the selected handler. Executable code and exports
  are unchanged; invocation and sequencing remain in the effect shell.
- **Evidence**: both inference fixtures now pass. The strict no-emit baseline is
  530 core, zero fixture, 68 transitive, zero global; the compiler still exits
  nonzero and Step 6 remains incomplete.
- **Tests**: regressions cover captured own enumerable entries, silent unknown,
  inherited, hidden, late-added and non-callable entries, original item/result
  identity, unawaited promises, and capture/invocation failures. Compile fixtures
  check heterogeneous return union, optional fallback, and invalid assumptions.
- **Verification**: `npm test` passed (761 executed, zero failures; 13/13 sensor
  and 3/3 reporter tests); the optional live endpoint smoke was skipped after
  sandbox socket creation returned `EPERM`. Lint, JavaScript syntax, whitespace,
  and comment-stripped executable-output comparison passed.
- **Next**: model compatibility state/photo inputs versus normalized values;
  preserve raw patches, optional payloads, metadata aliases, and selector defaults.

### 2026-10-29: Type the Curried Boolean Patch Boundary

- **Outcome**: gave the existing data-first builder a local call contract for
  direct and partial application, including empty calls, unknown values/keys,
  ignored extra arguments, and possibly absent property lookups. Native key
  coercion may invoke user code or throw. No executable code or exports changed;
  the shared `curry` remains broadly typed, so this local annotation does not
  establish its generic type safety.
- **Evidence**: the targeted `CurriedPatchIsNotAny` fixture now passes. The
  strict no-emit baseline is 530 core, one fixture, 68 transitive, zero global;
  the remaining fixture is the heterogeneous invoker. The compiler remains
  nonzero and Step 6 remains incomplete.
- **Tests**: runtime regressions cover direct/partial equivalence, truthiness,
  fresh patches, empty applications, extra arguments, symbols, coerced keys,
  and exact failures. Compile fixtures cover both invocation forms and reject
  treating potentially absent keys as guaranteed, non-boolean values, and
  incomplete results.
- **Verification**: `npm test` passed (759 executed, zero failures; 13/13 sensor
  and 3/3 reporter tests); the optional live endpoint smoke was skipped because
  sandbox socket creation returned `EPERM`. Lint, JavaScript syntax, whitespace,
  and comment-stripped executable-output comparison passed.
- **Next**: address the heterogeneous handler-invoker inference fixture, then
  continue compatibility-state modeling before re-auditing acceptance.

### 2026-10-29: Narrow the State-Patch Object Boundary

- **Outcome**: documented the existing non-null, non-array object predicate as
  an unknown-to-record type guard; it does not add runtime validation or change
  executable behavior. Objects with arbitrary prototypes and accessors remain
  accepted, while arrays, functions, and primitives retain their old handling.
- **Evidence**: strict no-emit diagnostics are now 530 core, two fixture, 68
  transitive, and zero global: all ten decoder TS18046 diagnostics and the
  predicate's implicit-any diagnostic disappeared from the 541-core baseline.
  The compiler command remains intentionally nonzero; Step 6 is not complete.
- **Tests**: two domain regressions cover inherited and hidden fields, unusual
  object prototypes, invalid inputs, repeated reads, changed getter results,
  exact thrown errors, and revoked proxies. The compiler regression checks the
  decoder for TS18046 and the fixture accepts an unknown transport value.
- **Verification**: `npm test` passed (757 executed, zero failures; 13/13
  sensor and 3/3 reporter tests); the optional live endpoint smoke was skipped
  because sandbox socket creation returned `EPERM`. Lint, touched JavaScript
  syntax, and whitespace checks passed.
- **Next**: address the curried `buildBooleanFieldPatch` inference fixture
  without changing its call conventions; keep the heterogeneous-invoker and
  compatibility-state gaps visible for later slices.

### 2026-10-27: Establish the Step 6 Compiler Baseline

- **Outcome**: added a pinned development-only TypeScript 5.9.3 and Node type
  dependency, strict no-emit domain config, compile-time fixtures, and a reporter
  that separates core, fixture, transitive, and global diagnostics by location.
  `npm run typecheck:domain -- --details` prints every diagnostic. The command
  intentionally exits nonzero while any remain; no runtime API changed.
- **Measured**: 541 core, two fixture, 68 transitive, zero global. The fixture
  errors demonstrate result-type erasure in the curried patch builder and the
  heterogeneous invoker; expected-invalid command/effect/environment/selector
  cases are checked with `@ts-expect-error`. Ten TS18046 errors occur in
  `decodeStatePatchCommand`; transitive errors include malformed JSDoc in the
  collection photo projections. Strict implicit-any diagnostics account for
  much of the core count. No blanket suppression or migration completion claim.
- **Functional boundary/tests**: the diagnostic classification is a pure,
  partially applied partition and the compiler invocation is the effect shell.
  Three tests cover grouping, status, no-emit configuration, fixture correctness,
  and detection of a deliberately weakened negative assertion. The two known
  inference assertions may become green without breaking the test. An initial
  subprocess-based test hit sandbox `EPERM`, so the test now invokes the compiler
  in-process and does not weaken the real diagnostic command.
- **Verification**: `npm test` passed (755 executed, zero failures; 13/13 sensor
  and 3/3 reporter tests); optional endpoint smoke was sandbox-skipped due to
  `listen EPERM`. Lint, touched JavaScript syntax, and whitespace checks passed.
  The real compiler command returned 1 with the diagnostic counts above.
- **Next**: narrow `decodeStatePatchCommand` unknown inputs without changing
  existing object/array/accessor behavior, then continue the compiler-guided
  inference and compatibility-state work. Step 6 remains incomplete.

### 2026-10-26: Re-audit Step 6 Acceptance and Bound Compiler Readiness Work

- **Outcome**: audited commands, environments, effects, and selectors against
  both acceptance criteria. Step 6 remains incomplete: documented signatures
  do not prove state invariants, retained type relationships, or compilation.
- **Evidence/correction**: repaired an unbalanced `SessionConfig.poolPolicies`
  declaration. Scalar patches can reach public snapshots outside the declared
  state types; active-photo decoding validates URL presence, not optional Photo
  metadata. Unknown property access and type-erasing curried/heterogeneous
  interpreters still need compiler-led work. Corrected the product roadmap's
  stale payload-contract next step to match the completed implementation.
- **Functional boundary/tests**: five declarative regressions preserve raw
  values, aliases, replay, immutable inputs, inherited/callable property lookup,
  exact getter failures, and optional direct payload behavior. Corrected a test
  assumption: the shared writer skips undefined scale mode, retaining state
  identity; omitted numeric payloads can still produce NaN. Kept the pure
  data-first core and existing sequential shell; no algebraic wrapper is needed.
- **Verification**: `npm test` passed: 755 executed, 754 passed assertions,
  zero failures, plus 13/13 sensor regressions. Optional endpoint smoke was
  sandbox-skipped (`listen EPERM`). Lint, touched JavaScript syntax, whitespace,
  and unchanged executable production AST/export checks passed. No compiler,
  dependency installation, client build, daemon restart, or runtime policy change.
- **Next**: establish a scoped no-emit TypeScript diagnostic baseline with
  compile-time fixtures and separately reported transitive errors; then address
  measured narrowing/inference and compatibility-state gaps. No installed
  TypeScript dependency, compiler on PATH, or repository typecheck gate was found.

### 2026-10-26: Document Command Payloads and Dispatcher Dependencies

- **Pressure**: closed command/effect names still shared broad payload records,
  leaving required variant fields and shell dependency expectations implicit.
- **Contracts**: named 25 command payload variants and nullable decoder results,
  ten discriminated effects, dispatcher dependencies, and public methods. Legacy
  payload omission, scalar patch/exclusion pass-through, and nonfinite numeric
  metadata remain explicit; documentation does not add runtime validation.
- **Functional boundary**: kept the curried decoders, pure data-first reducer,
  and partially applied sequential interpreter. Mapped/discriminated shapes
  describe the existing vocabulary without runtime wrappers or new exports.
  Context, persistence, mutation, callbacks, and emission remain shell effects.
- **Tests**: ten regressions cover vocabulary/signature coverage, pass-through
  aliases, detached job arrays, exact metadata/environment payloads, optional
  adapters, synchronous override/emission, awaited opaque results, and failures.
  VM-local effect adapters avoid live I/O and process-global patches. Corrected
  two test-harness assumptions: parsing defaulted dependencies and observing
  flag enumeration versus the later result-copy phase.
- **Verification**: `npm test` passed: 750 tests executed, 749 passed assertions,
  zero failures, and 13/13 sensor regressions. Optional endpoint smoke was
  sandbox-skipped (`listen EPERM`). Lint, touched JavaScript syntax, whitespace,
  and unchanged executable production AST/export checks passed.
- **Next**: re-audit the four core boundaries against both Step 6 acceptance
  criteria and identify remaining migration blockers. Step 6/Phase 1 remain
  incomplete; no compiler gate, client build, or daemon restart is claimed.

### 2026-10-26: Document Exported Domain Selector Contracts

- **Contracts**: annotated all 23 exported selector functions with shared domain
  shapes and local feed, smart/weighted/sequential selection, and update-result
  contracts. Documented ordering, null/identity behavior, shallow aliases,
  local time, conditional random draws, and native failure propagation.
- **Functional boundary**: kept existing data-first projections, generic array
  combinators, explicit Date/RNG injection, and the effect shell unchanged.
  Ordinary stable-record filters/deduplication are value-idempotent, not
  reference-idempotent; no wrapper or runtime validation was needed. Selector
  defaults are undefined-only, unlike the reducer's truthy defaults.
- **Tests**: ten regressions cover signature coverage, normalization and lookups,
  list composition, external-pool override and first-URL ownership, strict time/
  weather/night boundaries, equal-turn eligible-pool selection, read-only
  cursors, update aliases, frame projection, ambient defaults, and exact failures.
  Fixed a test fixture that incorrectly expected keyword matching on URLs;
  matching uses title/author/category. VM adapters avoid process-global patches.
- **Verification**: `npm test` passed: 740 tests executed, 739 passed assertions,
  zero failures, and 13/13 sensor regressions. Optional endpoint smoke was
  sandbox-skipped (`listen EPERM`). Lint, touched JavaScript syntax, whitespace,
  and unchanged production AST/export checks passed.
- **Next**: command/effect payload variants and dispatcher dependencies, then
  the acceptance audit. Step 6 and Phase 1 remain incomplete; no TypeScript
  compilation, client build, daemon restart, or runtime behavior change claimed.

### 2026-10-25: Document Reducer Execution and Dispatch Results

- **Contracts**: named shared `ReducerEnvironment` (`now` is a Date value,
  `rng` a callable) and documented public reducer results plus shell-owned
  `EffectResult`/`DispatchResult`. Optional null/falsy fields retain native
  truthy defaults; no validation, executable production change, or export added.
- **Functional boundary**: retained the data-first state projection and existing
  partially applied sequential interpreter. Stable execution inputs enable
  replay; ambient clock/random defaults are not pure. Result envelopes are not
  a combining Monoid or atomic transaction, so no algebraic wrapper was added.
- **Tests**: seven regressions cover time-sensitive replay, unchanged inputs,
  fresh no-op arrays/state identity, eager independent default reads, exact
  failures, missing-command short-circuiting, environment forwarding, and
  pre-effect snapshots with ordered awaited result aliases. VM-local clock/RNG
  adapters avoid patching process globals; dispatch fixtures stay isolated.
- **Verification**: `npm test` passed: 730 tests executed, 729 passed assertions,
  zero failures, and 13/13 sensor regressions. Optional endpoint smoke was
  sandbox-skipped (`listen EPERM`). Lint, touched JavaScript syntax, whitespace,
  and unchanged production AST/export checks passed.
- **Next**: annotate exported domain selector inputs/results, then command/effect
  payload variants and dispatcher dependencies; repeat the acceptance audit.
  Step 6 and product Phase 1 remain incomplete. No compiler gate, client build,
  or runtime restart is claimed for this contract-only slice.

### 2026-10-25: Audit Step 6 Core Contracts and Repair Effect Vocabulary

- **Audit**: checked command, environment, effect, and selector boundaries
  against the companion acceptance criteria. Step 6 is incomplete: sensor and
  browser contracts exist, but the reducer execution environment, exported
  domain selector signatures, command/effect payload variants, and dispatcher
  dependency/result shapes still need explicit contracts. The companion now
  records an evidence matrix and bounded completion queue.
- **Correction**: added the missing `refresh-active-feed` member to `Effect`;
  the reducer already emitted it and dispatch already handled it. Retained broad
  compatibility payloads for separately scoped contract work. Executable
  production AST and exports are unchanged.
- **Functional design**: preserved the pure data-first domain core and the
  existing partially applied sequential interpreter. No new wrapper, dependency,
  or runtime validation is needed for a vocabulary correction. State application,
  persistence, callbacks, and event emission remain explicit shell effects.
- **Tests**: four regressions compare the complete declared/handled effect
  vocabulary and cover curated-pool refresh alias/result identity, asynchronous
  ordering, absent adapters, and exact rejection after state application but
  before event emission. Existing Google Photos coverage remains in place;
  tests use isolated harnesses and test-mode persistence, not live pools.
- **Verification**: `npm test` passed: 723 tests executed, 722 passed assertions,
  zero failures, and 13/13 sensor regressions. The optional endpoint smoke was
  sandbox-skipped (`listen EPERM`). Lint, touched JavaScript syntax, whitespace,
  and unchanged production AST checks passed. No TypeScript compiler gate,
  client build, or daemon restart is claimed or required for this contract change.
- **Next**: document injected reducer `now`/`rng` and public reducer/dispatcher
  results, then selector signatures and command/effect payloads; re-audit before
  claiming Step 6 closeout. Phase 1 remains in progress.

### 2026-10-25: Bound Lumina Memory and Restore Active Feeds After OOM

- **Incident evidence**: the host-wide OOM killer selected a Chromium renderer
  in Lumina at about 07:25 EDT. The Lumina service cgroup had peaked near
  1.4 GiB on an 8 GiB host; the kernel OOM began while Firefox WebExtensions
  allocated shared memory. This does not establish a Node.js leak.
- **Safeguards**: the user service now reclaims above 1.5 GiB and has a 2 GiB
  hard cgroup ceiling. Manual feed selections persist atomically and restore
  after a service restart, filtered to pools that still exist. Scheduled pool
  activations remain transient.
- **Memory policy**: no periodic restart or forced garbage collection was
  added. Neither would reclaim Chromium/GPU or other host-process memory, and a
  timer-driven restart would interrupt the display. Use service cgroup metrics
  to measure future peaks before tightening the ceiling.
- **Coverage**: focused selection recovery tests cover aliases, removed pools,
  malformed/missing files, atomic writes, and detached stored values.

### 2026-10-23: Give Visible Primaries a Full Interval and Recover Once

- **Causes**: the TV's mount-relative interval could replace a newly displayed
  image just before its next tick. Primary-load failure also sent both
  `mark-photo-broken` and `next-photo`, although the server already selects a
  replacement when marking the active photo broken.
- **Correction**: derive the displayed primary URL from the bounded slide list
  and use that scalar identity in the rotation effect. Start after the first
  image mounts; reset for a different displayed primary or interval change.
  Metadata, crop, title, secondary, and layout changes retain the countdown.
  Loading and offline holds retain the previous slide's existing timer.
  Recovery now sends only the broken-image report.
- **Functional design**: retain pure data-first retry decisions and an inline
  pure displayed-image projection; timers, native loading, and transport remain
  explicit effects. A new curried or Fantasy Land wrapper would add no useful
  law or reuse here. Public events and server selection rules are unchanged.
- **Coverage**: `npm run test:slideshow` builds the actual client and tests it
  against local SVGs and an isolated server using production command decoders
  and dispatcher. A controlled clock covers display deadlines, slow loads,
  metadata/layout updates, interval changes, unmount cleanup, primary/secondary
  failure, stale-loader cancellation, offline holds, and single-image pools.
  Pure reducer tests verify one recovery transition, repeated-report no-ops,
  input immutability, and healthy-primary preservation.
- **Verification**: all 743 core assertions (including live endpoint smoke
  tests), 13 sensor regressions, and 11 browser scenarios pass. Lint, client
  build, applicable syntax checks, and whitespace checks pass. The served
  JavaScript matches the rebuilt bundle byte-for-byte. The kiosk had exited
  normally, so its next launch loads the new client; daemon runtime and the
  existing selected pools remain unchanged.

### 2026-10-22: Specify Picker File-Selection Contracts

- **Contract**: refined `getPickerMediaFile(...)` read-only inputs, whole
  nested/flat selection, selected aliases, fresh falsy-row fallbacks, native
  truthiness, hidden/inherited fields, and repeated accessor reads. A changing
  accessor's third value is returned verbatim; exact failures stop later reads
  without returning a result or rolling back prior caller-hook effects.
- **Functional design**: retained the pure data-first selector and direct field
  reader composition. Stable leaf selection is reference-idempotent, but nested
  records can select deeper files on reapplication. No wrapper, dependency,
  executable production change, or export added; per-field fallback policies
  and cache I/O remain with callers. Readonly is not a runtime freeze or clone.
- **Tests**: seven focused tests compose declarative tables, frozen inputs,
  reference checks, guarded accessors, and exact thrown values. Test-only private
  capture evaluates the real cache module without widening production exports
  or adding live cache, credential, network, or daemon access.
- **Verification**: `npm test` passed: 711 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, whitespace, and
  unchanged executable production AST checks passed. Optional socket smoke was
  sandbox-skipped (`listen EPERM`). No client build or service restart needed.
- **Next**: audit command, environment, effect, and selector contract coverage
  against Step 6 acceptance criteria; identify the first unmet boundary or record
  evidence for closeout before adding further slices.

### 2026-10-22: Specify Picker Cache-Row Construction Contracts

- **Contract**: refined `buildCachedMediaItem(...)` read-only inputs, fixed-field
  output, distinct base/date/MIME/session fallbacks, acquisition/base clock
  ordering, retained metadata aliases, repeated reads, and exact native failures.
  Truthy existing acquisition dates survive verbatim; missing Picker dimensions
  reset cached dimensions. These compatibility policies were not changed.
- **Functional design**: retained the data-first interface and pure helper
  composition. The builder reads the clock, so neither purity nor global
  idempotence applies. Fixed-clock refresh stability has explicit preconditions.
  No wrapper, dependency, executable production change, or export added;
  validation/clock injection remain separate work and cache I/O stays in callers.
- **Tests**: eight focused tests use declarative tables, frozen records, shallow
  alias checks, ordered accessors, and exact thrown values. A local VM clock
  evaluates the real cache module without patching global Date or adding live
  cache, credential, network, or daemon access. Failures stop later work without
  returning partial rows or rolling back prior caller-hook effects.
- **Verification**: `npm test` passed: 704 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, whitespace, and
  unchanged executable production AST checks passed. Optional socket smoke was
  sandbox-skipped (`listen EPERM`). No client build or service restart needed.
- **Next**: refine `getPickerMediaFile(...)` read-only inputs, nested/flat
  selection, aliases, repeated accessor reads, and native failure contracts
  without changing behavior or exports.

### 2026-10-21: Specify Pure Picker Union Contracts

- **Contract**: refined `mergeSyncedMediaItems(...)` read-only collections,
  stable ordering, cached-first/incoming-last duplicate precedence, raw cached-id
  matching, cloned cached/matched rows versus unmatched incoming aliases,
  sparse/native traversal, ordered phases, and exact native failures.
- **Functional design**: retained the pure data-first interface and private
  scratch collections. Canonical unique-id ordinary records form an associative,
  value-idempotent, noncommutative Monoid with [] identity. Duplicate/noncanonical
  ids, inherited fields, and changing accessors are outside that value law.
  No wrapper, dependency, executable production change, or export added; policy
  and cache I/O remain in callers.
- **Tests**: eight focused tests compose declarative cases, frozen/sparse inputs,
  isolated hooks, and generated triples. Failures stop later work without partial
  results or caller-hook rollback. No new live cache, credential, network, or
  daemon access.
- **Backlog**: cached trimmed deduplication and raw upsert matching differ.
  Padded/numeric cached ids can coexist with equivalent selections; earlier
  padded duplicates can hide exact matches. Choose canonical-id migration and
  metadata preservation separately, without silently changing compatibility.
- **Verification**: `npm test` passed: 696 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, whitespace, and
  unchanged executable production AST checks passed. Optional socket smoke was
  sandbox-skipped (`listen EPERM`). No client build or service restart needed.
- **Next**: refine `buildCachedMediaItem(...)` read-only inputs, fallback
  precedence, timestamp/clock ordering, retained metadata, and native failures
  without changing behavior or exports.

### 2026-10-21: Specify Pure Synced Metadata Merge Contracts

- **Contract**: refined `mergeSyncedItemWithExistingMetadata(...)` read-only
  inputs, existing-then-synced shallow spreads, and five defined user-edit
  exceptions. Other fields accept synced undefined values; inherited/hidden
  user edits, repeated reads, symbols, and nested aliases remain compatible.
- **Functional design**: retained the small pure data-first projection and
  private result construction. Ordinary own-enumerable records obey
  associativity, value-idempotence, and empty-metadata identity, but not
  commutativity; inherited records and changing accessors are outside those
  laws. No curried/algebraic wrapper, dependency, executable production change,
  or export added. Cache effects, policy, and identity matching remain separate.
- **Tests**: seven focused tests compose declarative cases through the existing
  public union using one exact id. Frozen inputs, shallow aliases, hidden and
  inherited fields, ordered accessors, generated triples, and exact thrown
  values are covered. Failures stop later work without partial results or
  caller-hook rollback. No new live cache, credential, network, or daemon access.
- **Verification**: `npm test` passed: 688 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, whitespace, and
  unchanged executable production AST checks passed. Optional socket smoke was
  sandbox-skipped (`listen EPERM`). No client build or service restart needed.
- **Next**: refine `mergeSyncedMediaItems(...)` read-only collections, stable
  union ordering, duplicate precedence, exact-id matching, aliases, and native
  failures without changing behavior or exports.

### 2026-10-21: Specify Pure Cache Deduplication Contracts

- **Contract**: refined `dedupeMediaItemsById(...)` read-only generic inputs,
  first-occurrence ordering, native truthiness/string coercion, sparse-array
  traversal, and exact failures. Trimmed comparison keys do not rewrite retained
  ids or merge metadata; original rows and shallow aliases survive.
- **Functional design**: retained the concise pure data-first filter with its
  private scratch Set. Stable-record deduplication is value-idempotent; on
  canonical arrays, first-biased deduplicated union forms an associative Monoid
  with [] as identity, but is neither commutative nor plain-concatenation
  preserving. No curried/algebraic wrapper, dependency, executable production
  change, or export added. Validation and cache effects remain separate.
- **Tests**: seven focused tests compose declarative cases, frozen rows,
  inherited/hidden ids, native filter dispatch/species, sparse traversal, and
  generated union triples. Exact failures stop later work without partial
  results or caller-hook rollback. No new live cache, credential, network,
  or daemon access.
- **Verification**: `npm test` passed: 681 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, whitespace, and
  unchanged executable production AST checks passed. Optional socket smoke was
  sandbox-skipped (`listen EPERM`). No client build or service restart needed.
- **Next**: refine `mergeSyncedItemWithExistingMetadata(...)` read-only inputs,
  spread precedence, user-edit allowlist, shallow aliases, and failures without
  changing behavior or exports.

### 2026-10-21: Specify Pure Cache Eligibility Contracts

- **Contract**: refined `isUsableCachedMediaItem(...)` read-only structural
  eligibility, ordered id/url guards, exact mock-prefix bypass, raw base/session
  truthiness, and native failures. Eligibility is not proof of successful media
  retrieval; expiry, authentication, validation, and broken/rating flags remain
  outside this predicate.
- **Functional design**: retained the concise pure data-first predicate, directly
  usable by filter. Ordinary-record filtering preserves concatenation, empty
  identity, row references, and idempotence; predicate idempotence does not apply.
  No currying, algebraic wrapper, dependency, executable production change, or
  export added. Retrieval and cache I/O stay in the service shell.
- **Tests**: seven focused tests compose declarative truthiness/prefix tables,
  frozen records, inherited/hidden fields, native method dispatch, and isolated
  access hooks. Exact failures stop later work without a fallback boolean or
  caller-hook rollback. No new live cache, credential, network, or daemon access.
- **Verification**: `npm test` passed: 674 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, whitespace, and
  unchanged executable production AST checks passed. Optional socket smoke was
  sandbox-skipped (`listen EPERM`). No client build or service restart needed.
- **Next**: refine `dedupeMediaItemsById(...)` read-only inputs, first-occurrence
  ordering, native id coercion, sparse-array behavior, and failures without
  changing behavior or exports.

### 2026-10-18: Specify Pure Cache Row Normalization Contracts

- **Contract**: refined `normalizeCachedMediaItem(...)` read-only persisted-row
  inputs, truthy-id guard, independent flat dimensions, cached/legacy base
  precedence, default proxy rendering, shallow metadata, and exact failures.
  Ratings default only on undefined; loved accepts only literal true.
- **Functional design**: retained the concise pure data-first projection.
  Generated ordinary records with own enumerable string ids and safe positive
  integer dimensions verify value-idempotence, not reference identity. A large
  numeric-dimension counterexample rules out global idempotence. No currying,
  algebraic wrapper, dependency, executable production change, or export added.
  Eligibility, validation, clocks, and cache I/O remain separate.
- **Tests**: eight focused tests compose declarative tables, frozen data,
  inherited/hidden fields, symbol metadata, and isolated access/coercion hooks.
  Failures stop later work without partial results or caller-hook rollback.
  No new live cache, credential, network, or daemon access added.
- **Verification**: `npm test` passed: 667 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, whitespace, and
  unchanged executable production AST checks passed. Optional socket smoke was
  sandbox-skipped (`listen EPERM`). No client build or service restart needed.
- **Next**: refine `isUsableCachedMediaItem(...)` structural guards, mock-id
  bypass, refreshability truthiness, and native failures without changing
  behavior or exports.

### 2026-10-18: Specify Pure Legacy Base URL Contracts

- **Contract**: refined `extractLegacyBaseUrl(...)` unknown-input coercion,
  exact rejected prefixes, first-literal-equals splitting, and native failures.
  Splitting is not URL-aware; the head is not retrimmed. The cache-row builder
  retains that head, while cache normalization trims it again.
- **Functional design**: retained the concise pure data-first projection.
  Generated cases verify fixed points on normalized equals-free, non-rejected
  bases; a trailing-space counterexample rules out global idempotence. No
  algebraic wrapper, currying, dependency, executable production change, or new
  export is needed. Validation and cache-row clocks/I/O remain separate.
- **Tests**: seven focused tests compose declarative tables, frozen data,
  inherited/hidden fields, and isolated hooks through existing cache projections.
  Preferred bases suppress extraction; native failures stop later work without
  rolling back caller-hook effects. No live cache, credentials, network services,
  or daemon state accessed.
- **Verification**: `npm test` passed: 659 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart needed for this contract-only slice.
- **Next**: refine `normalizeCachedMediaItem(...)` persisted-row inputs, render
  projection, fallback/metadata preservation, and failures without changing
  behavior or exports.

### 2026-10-18: Specify Pure Picker Base URL Contracts

- **Contract**: refined `getPickerItemBaseUrl(...)` read-only nested/legacy
  file selection, truthiness-before-trimming, native string coercion, repeated
  reads, and exact failures. A selected nested file never falls back to the
  flat base. The builder applies cached/legacy fallback after trimming, so a
  whitespace-only incoming base permits fallback. Values are not URL-validated.
- **Functional design**: retained the concise pure data-first scalar projection.
  Generated flat/nested re-embedding cases verify normalization stability,
  not a record endomorphism. No algebraic wrapper, currying, dependency,
  executable production change, or new export is needed. URL validation,
  cache-row clocks, and persistence remain separate.
- **Tests**: seven focused tests use declarative cases, frozen data, hidden and
  inherited fields, and isolated hooks through the existing cache-row builder.
  They preserve native coercion ordering and exact thrown values; failures stop
  subsequent reads without rolling back prior caller-hook effects. No live
  cache, credentials, network services, or daemon state accessed.
- **Verification**: `npm test` passed: 652 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart needed for this contract-only slice.
- **Next**: refine `extractLegacyBaseUrl(...)` legacy coercion, rejected prefixes,
  first-directive splitting, and failures through existing cache projections
  without changing behavior or exports.

### 2026-10-18: Specify Pure Picker Dimension Contracts

- **Contract**: refined `getPickerItemDimensions(...)` read-only nested/legacy
  metadata selection, native base-10 parsing, independent defaults, repeated
  reads, and exact access/coercion failures. Truthy metadata wins as a whole;
  top-level row dimensions and existing cache dimensions do not supply fallback.
- **Functional design**: retained the concise pure data-first projection.
  Generated safe-integer pairs verify flat/nested re-embedding stability;
  a large-number counterexample rules out global idempotence because native
  number stringification can introduce exponent notation. No algebraic wrapper,
  currying, dependency, executable production change, or new export is needed.
  Validation, cache-row clocks, and persistence remain separate.
- **Tests**: seven focused tests use declarative cases, frozen data, hidden and
  inherited fields, and isolated hooks through the existing cache-row builder.
  They preserve whole-metadata precedence, native numeric prefixes, independent
  defaults, width-before-height coercion, and unchanged thrown values. Failures
  stop subsequent reads without rolling back prior caller-hook effects.
  No live cache, credentials, network services, or daemon state accessed.
- **Verification**: `npm test` passed: 645 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart needed for this contract-only slice.
- **Next**: refine `getPickerItemBaseUrl(...)` file selection, truthiness before
  trimming, native string coercion, and failures through the existing cache-row
  builder without widening exports.

### 2026-10-17: Specify Pure Proxy URL Builder Contracts

- **Contract**: refined `buildGooglePhotoProxyUrl(...)` read-only render options,
  undefined-only independent defaults, eager option reads, dimension-before-id
  coercion, ordered query fields, truthy crop, and exact native failures.
  Ids use one-pass URI encoding without trimming; query dimensions use form
  encoding and replace lone surrogates, while malformed UTF-16 ids reject.
- **Functional design**: retained the concise pure data-first projection and
  existing generated codec round-trip coverage, not builder idempotence.
  No algebraic wrapper, currying, dependency, executable production change,
  or new export is needed. Validation and cache/filesystem effects stay separate.
- **Tests**: seven focused tests use declarative cases, frozen inputs,
  inherited/non-enumerable options, and isolated hooks. They verify encoding,
  exact access/coercion order, stopped reads, and unchanged thrown values;
  prior hook effects survive failures without a fallback URL.
  No live cache, credentials, network services, or daemon state accessed.
- **Verification**: `npm test` passed: 638 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart needed for this contract-only slice.
- **Next**: refine `getPickerItemDimensions(...)` nested/legacy metadata
  selection, native integer parsing, independent defaults, and failures through
  existing cache-row builders without widening exports.

### 2026-10-17: Specify Pure Proxy Media-ID Decoding Contracts

- **Contract**: refined `getGooglePhotoMediaItemId(...)` unknown-input coercion,
  outer trimming, exact relative prefix, first-query splitting, one-pass
  decoding, and native failures. Decoded whitespace, plus signs, fragments,
  and separators remain unvalidated; malformed encoded ids throw, but query
  text and unsupported prefixes are not decoded.
- **Functional design**: retained the concise pure data-first decoder.
  Generated well-formed ids obey the proxy codec's round-trip law across
  render options, not decoder idempotence. No algebraic wrapper, currying,
  dependency, executable production change, or new export is needed.
  Identifier validation and filesystem containment remain separate security work.
- **Tests**: seven focused tests use declarative cases, frozen inputs,
  generated codec pairs, and isolated coercion hooks. Native failures retain
  their thrown values and prior hook effects without fallback reads.
  No live cache, credentials, network services, or daemon state accessed.
- **Verification**: `npm test` passed: 631 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart needed for this contract-only slice.
- **Next**: refine `buildGooglePhotoProxyUrl(...)` render-option defaults,
  native coercion/encoding, and failure contracts; keep validation separate.

### 2026-10-17: Specify Pure Picker MIME Projection Contracts

- **Contract**: refined `getPickerItemMimeType(...)` read-only nested/legacy
  inputs, truthiness-before-trimming, native coercion, repeated property reads,
  and exact failures. Whitespace-only nested hints suppress flat fallback;
  case, parameters, and invalid MIME text are deliberately not validated.
- **Functional design**: retained the concise pure data-first projection.
  Trim-normalized results are stable under flat/nested re-embedding, not a
  record endomorphism. No currying, algebraic wrapper, dependency, executable
  production change, or new export is needed. Validation and effects stay separate.
- **Tests**: seven focused tests compose declarative cases over frozen records
  and isolated hooks. They cover fallback/shape selection, empty identities,
  coercion order, lazy reads, inherited/non-enumerable metadata, normalization
  stability, exact thrown values, and native changing-accessor failures.
  No live cache, credentials, network services, or daemon state accessed.
- **Verification**: `npm test` passed: 624 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart needed for this contract-only slice.
- **Next**: refine `getGooglePhotoMediaItemId(...)` unknown-input coercion,
  proxy-prefix/query decoding, and failures; keep identifier validation and
  filesystem containment separate.

### 2026-10-17: Specify Pure Metadata Allowlist Projection Contracts

- **Contract**: refined `buildGooglePhotoMetadataPatch(...)` read-only input,
  fixed eager read order, inherited/non-enumerable fields, undefined-only
  omission, fresh plain output, shallow aliases, and unchanged read failures.
  Null fails natively; other primitives follow native property access.
- **Functional design**: retained the pure data-first
  `entries -> filter -> fromEntries` pipeline. Projection is value-idempotent,
  not reference-idempotent. Projected patches compose by right-biased spread;
  raw spread with undefined fields does not commute with projection.
  No runtime change, production export, dependency, or algebraic wrapper needed.
- **Tests**: seven focused tests compose declarative field/value cases and
  generated frozen records. They cover output order/descriptors, reference
  retention, ignored keys, inherited fields, eager proxy reads, primitive/null
  behavior, stopped reads, exact thrown values, and projection closure/idempotence.
  No live cache, credentials, network services, or daemon state accessed.
- **Verification**: `npm test` passed: 617 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart needed for this contract-only slice.
- **Next**: refine `getPickerItemMimeType(...)` nested/legacy fallback,
  truthiness, native coercion, and failures; keep MIME validation and network
  effects separate.

### 2026-10-17: Specify Pure Cached Metadata Merge Laws and Aliases

- **Contract**: refined `mergeCachedMediaItemMetadata(...)` read-only inputs,
  decode-before-projection ordering, strict row ids, shallow cloning, last-match
  output aliases, !== change detection, and unchanged projection failures.
  No-ops still copy truthy rows; sparse/falsy entries and nested aliases survive.
- **Functional design**: retained the pure data-first map and explicit cache
  shell. Projected patches compose by right-biased spread, with value identity
  and associative composition. Tests use local partial application and generated
  patch triples; result envelopes are not a Monoid of patch composition because
  changed flags can cancel and references differ. No runtime rewrite, production
  export, dependency, or algebraic wrapper was needed.
- **Tests**: eight focused tests cover strict raw/proxy identifiers, duplicate
  matches, shallow aliases, sparse/no-op copies, NaN/signed-zero/reference
  comparisons, projected-patch laws, noncompositional flags, eager failures, and
  native mapping/accessor failures. Tests use detached inputs, not live cache,
  credentials, or network services.
- **Verification**: `npm test` passed: 610 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart was needed for this contract-only slice.
- **Next**: refine `buildGooglePhotoMetadataPatch(...)` allowlist, eager reads,
  undefined omission, alias, and projection laws. Validation and cache recovery
  remain separate policy work.

### 2026-10-17: Specify Cached Google Photos Metadata Update Contracts

- **Contract**: refined `updateCachedMediaItemMetadata(...)` read-before-input
  ordering, strict cached-id matching, copied results, !== change detection,
  full-cache changed-only writes, and exact test-mode suppression. Reader
  normalization can persist before no-match results or later failures; required
  writes complete before return, without updater recovery or rollback.
- **Functional design**: retained the pure immutable merge and data-first cache
  shell. Declarative case tables compose through `map` and `forEach` with
  isolated adapters; repeated persisted scalar patches are value-idempotent,
  not reference-idempotent. No curried/algebraic wrapper, executable production
  change, dependency, or production export was needed.
- **Tests**: eight focused tests cover eager input access, handled/unhandled
  reads, surviving normalization writes, raw/proxy versus strict row ids,
  undefined/falsy/NaN/object patches, exact test-mode behavior, first-usable-id
  persistence, copied results, serialization, and unchanged thrown values.
  No live credentials, cache files, or network services accessed by these tests.
- **Verification**: `npm test` passed: 602 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart was needed for this contract-only slice.
- **Follow-up**: recorded normalization/write atomicity and metadata validation
  separately. Next: refine the pure metadata merge's identifier, clone/alias,
  strict change-detection, and composition contracts with focused tests.

### 2026-10-17: Specify Live Google Photos Metadata Application Contracts

- **Contract**: refined `applyCachedMediaItemMetadataToState(...)` decoding and
  pre-guard projection, truthy row-id precedence, last-match results, copied
  list rows versus in-place active aliases, and unchanged thrown values. A
  failed map leaves its new array unassigned; later assignment failures retain
  committed list updates and partial active fields. Accessor effects can survive.
- **Functional design**: retained pure id/patch projections and the ordered
  data-first mutation shell. Declarative case tables compose with `map`,
  `flatMap`, and `forEach`; equal-value patches are value-idempotent, not
  reference-idempotent. An immutable/algebraic wrapper would misrepresent alias
  effects. No executable production code, dependencies, or exports changed.
- **Tests**: eight focused tests cover raw/proxy coercion and trim distinctions,
  eager access and failures, id precedence, application order, non-array lists,
  aliases, repeated values, and map/list-setter/active-field failures using
  detached snapshots. No live credentials, caches, or network services accessed.
- **Verification**: `npm test` passed: 594 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart was needed for this contract-only slice.
- **Follow-up**: recorded normalization and atomicity as separate hardening
  work. Next: refine cached metadata update read/projection ordering, copied
  result versus changed-only persistence, test-mode suppression, and failures
  using isolated adapters while retaining the pure merge and service shell.

### 2026-10-17: Specify Remote Media Retrieval and Final Picker Retry Contracts

- **Contract**: refined `fetchMediaItemBytes(...)` remote retrieval: HTTP errors
  advance sequentially without reading bodies; thrown fetch/decoding/write/header
  failures reject immediately. Successful responses decode, write non-empty
  real-item bytes, then select MIME by header/original-hint/default truthiness.
  Final Picker refresh retries only a new exact URL, retains the original token
  and MIME hint despite refreshed state, and writes even empty real-item bytes.
  Its catch preserves truthy failures and substitutes a fallback for falsy ones;
  prior cache/byte effects survive. Synthetic content skips auth and byte writes,
  not necessarily Picker authentication or metadata persistence.
- **Functional design**: retained pure cache/URL projections and the data-first
  effect shell. Declarative case tables compose through `map`, `flatMap`, and
  `Promise.all`; a deferred response checks sequential fallback. Currying or a
  new algebra would obscure effect order. No executable production code,
  dependencies, or exports changed.
- **Tests**: eight focused tests use isolated service adapters for MIME/Buffer
  results, HTTP sequencing, initial versus final failure boundaries, token/hint
  retention, synthetic retry, empty bytes, exact uniqueness, and retained writes.
  No live credentials, cache files, or network services are accessed.
- **Verification**: `npm test` passed: 586 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart was needed for this contract-only slice.
- **Follow-up**: recorded recovery, token reuse, empty-byte, MIME, and error
  normalization decisions as separate hardening work. Next: refine live metadata
  application contracts for identifier decoding, match precedence, alias identity,
  and partial failures; retain pure projections and the explicit mutation shell.

### 2026-10-16: Specify Media Candidate URL Preparation Contract

- **Contract**: refined `fetchMediaItemBytes(...)` candidate preparation:
  authentication completes first; missing/stale Picker bases refresh before
  the original cached base is appended. Truthy, exact-unique rendered URLs
  retain first-occurrence order. Only an empty candidate list resolves on
  demand, which can authenticate again. Preparation finishes before content
  requests; handled refresh/persistence/projection failures warn and fall back,
  while freshness, cached projection, warning, and resolver failures reject.
  Prior cache/token effects are not rolled back.
- **Functional design**: retained pure cache/URL projections and the existing
  data-first effect shell. Declarative tables composed with `map` and
  `Promise.all` cover independent cases; deferred OAuth makes sequencing
  explicit. A new curried or algebraic wrapper would obscure ordered effects.
  No executable production code, dependencies, or exports changed.
- **Tests**: eight focused tests use the existing isolated service fixture for
  authentication rejection/waiting, fresh versus inclusive-TTL refresh, missing
  bases/sessions, refresh precedence, original-base fallback, exact duplicate
  elimination, synthetic/on-demand resolution, and preparation failures. New
  tests do not access live credentials, cache files, or network services.
- **Verification**: `npm test` passed: 578 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart was needed for this contract-only slice.
- **Next seam**: remote retrieval and final Picker retry contracts covering
  HTTP versus thrown failures, decoding, MIME fallback, disk-write ordering,
  empty-buffer differences, and retry uniqueness. Media-path validation and
  confinement remain in the separate security backlog.

### 2026-10-16: Specify Local Media Byte Cache Contract

- **Contract**: refined `fetchMediaItemBytes(...)` local-cache semantics:
  metadata lookup and normalization writes precede file access; a missing row
  does not block local reads. Non-empty hits retain Buffer identity and native
  MIME truthiness, bypassing authentication, render options, and remote work.
  Repeated calls read anew. Empty/read/unlink fallbacks preserve warning and
  deletion order; cache/path/existence and catch-handler failures reject before
  authentication, without rollback. Path confinement remains separate work.
- **Functional design**: retained existing pure cache/path projections and the
  data-first effect shell. Declarative case tables composed with `map` and
  `Promise.all` make independent scenarios explicit; a new curried or algebraic
  wrapper would obscure these ordered effects. No executable production code
  or exports changed.
- **Tests**: eight focused tests use isolated filesystem, token, clock, logging,
  and network adapters, including normalized URL query parameters, MIME cases,
  repeated reads, authenticated fallback, partial effects, and native/handler
  rejection ordering. Extended the existing fixture with an injected unlink
  adapter and the already-exported byte fetcher; no live cache or credentials
  are used by the new tests.
- **Verification**: `npm test` passed: 570 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart was needed for this contract-only slice.
- **Next seam**: candidate-URL preparation contracts and isolated tests covering
  authentication order, Picker refresh precedence, cached-base fallback,
  deduplication, and on-demand URL resolution before retrieval.

### 2026-10-16: Document Orphaned File Projection Contract and Laws

- **Contract**: refined `getOrphanedFiles(...)` to accept read-only arrays and
  return a detached array of original entries in input order, including
  duplicates. Platform basename parsing removes directories and the final
  extension; active ids match without trimming, decoding, or case folding.
  Native container/path and caller-owned hook failures propagate unchanged.
- **Functional design**: retained the concise pure data-first Set projection.
  For fixed active ids, filtering preserves array concatenation and its empty
  identity; repeated filtering is idempotent, and successive active-id sets
  compose through union. These laws need no curried or algebraic wrapper.
  Filesystem reads and deletion remain in the cleanup shell; runtime behavior
  and production exports are unchanged.
- **Tests**: six focused tests use declarative path cases, frozen inputs, and
  generated active-id subsets to cover exact basename matching, duplicate/order
  preservation, detached results, empty identities, composition laws, and
  uncoerced invalid-entry/native hook failures. Moved helper-contract assertions
  out of the cleanup-shell test into the focused projection test.
- **Verification**: `npm test` passed: 562 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart was needed for this contract-only slice.
- **Next seam**: refine the `fetchMediaItemBytes(...)` local-cache fast-path
  contract with isolated tests for non-empty hits, empty/read-failure fallback,
  and failures before authentication. Media-path validation and confinement
  remain separate security work.

### 2026-10-16: Document Ordered Set Difference Contract and Laws

- **Contract**: documented `difference(...)` generic read-only Set inputs and
  fresh Set result. Native membership uses SameValueZero for primitives and
  reference identity for objects; left insertion order is preserved. Result
  membership is detached, but retained values are not cloned.
- **Functional design**: kept the existing data-first spread/filter projection
  unchanged. Successive exclusions compose through right-hand union, but set
  difference is not associative and therefore is not a Semigroup/Monoid
  operation. Currying or an algebraic wrapper would add ceremony here.
  Filesystem, cache, and cleanup effects remain outside this pure helper;
  custom iteration and membership hooks remain caller-owned effects.
- **Tests**: six focused tests cover the source contract, ordering, fresh
  results, native equality, shallow identity, empty/self subtraction, and
  generated finite-set exclusion, immutability, and composition laws, including
  a non-associativity counterexample. No runtime or export changes.
- **Test reliability**: the full suite exposed an unrelated fixed July fixture
  aging outside sensor statistics' 90-day window. Replaced only its timestamps
  and expectations with a single current-day reference and local-noon readings;
  hourly replacement, CSV contents, and statistics assertions remain intact.
- **Verification**: `npm test` passed: 556 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart required; production behavior is unchanged.
- **Next seam**: refine `getOrphanedFiles(...)` read-only input contracts and
  test basename matching, duplicate/order preservation, and immutable
  projection laws while keeping filesystem effects in the cleanup shell.

### 2026-10-16: Document Google Photos Local Media Path Contract

- **Contract**: documented `getLocalMediaFilePath(...)` unknown input, platform
  path result, and native coercion failures. JPG suffixing precedes path
  normalization; whitespace, existing extensions, and percent escapes retain
  their native meaning. Path construction performs no filesystem access and
  does not validate ids or guarantee containment in the media directory.
- **Functional design**: retained the concise data-first projection; currying
  and algebraic wrappers would add ceremony to a unary transformation. Native
  input hooks remain caller effects. Corrected the misleading effectful-section
  comment without changing runtime behavior or production exports.
- **Tests**: six focused tests use declarative cases, frozen inputs, and isolated
  adapters to cover scalar coercion, suffixing, normalization, traversal-shaped
  inputs, hook order/failures, repeatability, and service-effect isolation.
- **Security follow-up**: recorded media-id validation and path confinement
  before local reads/writes as separate hardening work. The route forwards ids
  to the service, and a cache miss does not prevent a subsequent local read;
  this is code-path evidence, not a claim of a demonstrated live exploit.
- **Verification**: `npm test` passed: 550 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart required for this contract-only slice.
- **Next seam**: document generic `difference(...)` contracts and test ordered,
  immutable set-difference laws without introducing an algebraic wrapper.

### 2026-10-16: Document Google Photos Proxy Recognition Contract

- **Contract**: documented `isGooglePhotoProxyUrl(...)` unknown input, boolean
  result, and unchanged coercion/URI failures. Recognition delegates exact
  relative-prefix matching, query removal, and one decoding pass to the shared
  decoder; non-empty decoded ids are accepted without validation or a second
  trim. Absolute URLs and empty ids remain false.
- **Functional design**: retained the concise data-first decoder-to-Boolean
  composition. Declarative tables and generated URL/render-option combinations
  test that composition directly; adding currying or an algebraic wrapper would
  not clarify this unary projection. Native input hooks remain caller effects.
- **Tests**: seven focused tests cover the source contract, exact vocabulary,
  generated round trips, single decoding, query handling, malformed encodings,
  coercion order/failures, frozen inputs, repeatability, and service-effect
  isolation. No production exports or runtime behavior changed.
- **Verification**: `npm test` passed: 544 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  No client build or service restart required for this contract-only slice.
- **Next seam**: document `getLocalMediaFilePath(...)` input/string-result and
  native coercion/path-normalization contract without implying containment
  validation. This remains a pure projection, not a filesystem operation.

### 2026-10-16: Document Google Photos Refresh-Token Persistence Contract

- **Contract**: documented `persistGoogleRefreshToken(...)` unknown inputs,
  native falsy/String/trim normalization, case-sensitive mock skips, synchronous
  single-field persistence, and void results. Adapter results are ignored;
  coercion and persistence failures propagate without logging, retry, or
  rollback. Service token/credential state remains caller-owned.
- **Functional design**: retained the small data-first normalization/guard/effect
  shell instead of adding a curried or algebraic wrapper. Declarative case
  tables and frozen coercion fixtures keep policy checks separate from injected
  persistence effects without widening production exports or using live secrets.
- **Tests**: seven focused tests cover source contracts, skip and normalization
  tables, native hook order, coercion failures, repeated writes in both modes,
  ignored adapter results, state/effect isolation, and partial persistence
  failures. Normalized-value idempotence does not imply write idempotence.
- **Verification**: `npm test` passed: 537 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  Runtime behavior is unchanged; no client build or service restart required.
- **Next seam**: document `isGooglePhotoProxyUrl(...)` unknown-input boolean
  projection and delegated decoding failures at the pure proxy boundary.

### 2026-10-16: Document Google Photos Cache Upsert Contract

- **Contract**: documented `updateCachedMediaItem(...)` generic input/result
  identity, freshly normalized existing rows, verbatim Map keys, stable replacement
  order, whole-row replacement, and unconditional synchronous persistence.
  Incoming normalization, metadata merging, retention, and caps remain caller
  responsibilities. Reader normalization may persist before input access; later
  failures propagate without retry or rollback, preserving earlier effects.
- **Functional design**: retained the concise data-first Map shell and separate
  pure normalization pipeline. Declarative case tables, frozen fixtures, and
  isolated adapters test value-idempotence versus repeated write effects without
  a new curried/algebraic wrapper, production export, or live cache access.
  Recorded input validation and corrupt-cache recovery as separate hardening.
- **Tests**: nine focused tests cover contracts, normalized ordering, whole-row
  replacement, exact keys, unvalidated inputs, repeated calls in both modes,
  identity, native hooks, read fallbacks, and reader/input/serialization/write
  failures before versus after normalization persistence.
- **Verification**: `npm test` passed: 530 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  Runtime behavior is unchanged; no client build or service restart required.
- **Next seam**: document `persistGoogleRefreshToken(...)` normalization,
  empty/mock skips, synchronous persistence/failures, and token-state ownership.

### 2026-10-16: Document Google Photos Cache Writer Contract

- **Contract**: documented `writeCachedMediaItems(...)` unknown input, native
  two-space JSON serialization, synchronous UTF-8 write, and void result.
  Normalization, validation, equality checks, and test-mode guards belong to
  callers. Native hooks run before writing; undefined serialization reaches the
  rejecting filesystem adapter. Failures propagate without retry or rollback.
- **Functional design**: retained the concise data-first persistence shell and
  separate pure row projections. Declarative case tables and isolated adapters
  test encoding and effects without a curried/algebraic wrapper, new production
  export, global patches, or live cache access. Recorded atomic/recoverable
  persistence as separate hardening work, not a silent behavior change.
- **Tests**: eight focused tests cover contracts, exact bytes and encoding,
  frozen metadata/duplicates, native scalar/array encoding and hooks, repeated
  writes in both modes, ignored adapter results, undefined data, and failures
  before versus during writing, including later calls after partial effects.
- **Verification**: `npm test` passed: 521 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  Runtime behavior is unchanged; no client build or service restart required.
- **Next seam**: document `updateCachedMediaItem(...)` normalized-cache upsert,
  unconditional persistence, returned-row identity, and ordered failure paths.

### 2026-10-16: Document Google Photos Raw Cache Reader Contract

- **Contract**: documented `readCachedMediaItemsRaw()` as returning unknown,
  unvalidated JSON, including non-array shapes. Each call checks existence and
  reads UTF-8 anew. Missing files and handled read/parse failures return fresh
  empty arrays without repairing or overwriting the file. Existence-check and
  warning-handler failures propagate, including nullish thrown-value failures.
- **Functional design**: retained the small explicit filesystem/logging shell;
  pure normalization remains at its existing boundary. Declarative case tables
  and isolated adapters test behavior without a new curried/algebraic wrapper,
  production export, live cache access, or global effect patches.
- **Tests**: seven focused tests cover the source contract, missing-file skips,
  valid JSON shapes, duplicate/metadata preservation, fresh detached results,
  UTF-8 effect order, fallback identities, warning details, and failure paths.
- **Verification**: `npm test` passed: 513 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  Runtime behavior is unchanged; no client build or service restart required.
- **Next seam**: document `writeCachedMediaItems(...)` serialization and
  synchronous persistence contract, keeping caller-owned guards explicit.

### 2026-10-14: Document Google Photos Exact-ID Cache Lookup Contract

- **Contract**: documented `findCachedMediaItem(...)` string input and nullable
  normalized row. Matching uses strict equality without trimming, coercion, or
  proxy decoding. Every call reads and normalizes before searching, even for
  invalid ids; structural eligibility does not apply playback/retention policy.
  Normalization can persist changes even on misses. Missing files and caught
  read/parse failures yield null; unhandled reader/write failures propagate.
- **Functional design**: retained the concise `find` projection and explicit
  service effect boundary. Immutable fixtures and declarative case tables
  exercise compatibility without introducing currying, a new algebra, or a
  production export. Pure normalization remains in `googlePhotosCache.js`.
- **Tests**: seven focused tests cover the source contract, strict matching,
  first-usable duplicate selection, metadata and input preservation, fresh
  detached results, changed-only writes, test-mode suppression, null fallbacks,
  and shape/normalization/existence/write failures, without live cache access.
- **Verification**: `npm test` passed: 506 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`).
  Runtime behavior is unchanged; no client build or service restart required.
- **Next seam**: document `readCachedMediaItemsRaw()` unknown JSON result and
  missing/read/parse fallbacks, keeping existence-check failures explicit.

### 2026-10-14: Document Google Photos Picker Sync Adapter Contract

- **Contract**: named `syncGoogleAlbum(...)` input/result and injected adapter
  contracts. Sync returns built incoming rows, including duplicate ids and
  policy-dropped rows, not the persisted pool. Writes apply retention/capping
  after append/upsert; cleanup and background download receive that same union.
  Listing is awaited; synchronous cache/cleanup returns and download completion
  are not. Earlier writes/cleanup are not rolled back on later failure.
- **Functional design**: retained existing pure union and data-last policy
  transforms, with the data-first effect shell explicit. Declarative adapter
  records, immutable fixtures, `map`, and `Promise.all` keep tests compositional
  without introducing an unnecessary curried or algebraic wrapper.
- **Tests**: eight focused tests pin options/token guards, injected bypass,
  falsy-session skips, metadata, immutable input preservation, duplicate results
  versus capped union, empty/non-array input policy work, effect ordering,
  delayed listing, background rejection, malformed payloads, nullish errors,
  synchronous failures, and repeated effects without live cache/network access.
- **Hardening boundary**: recorded refresh-token-only guard inconsistency,
  incoming-versus-pool result semantics, partial effects, adapter expectations,
  and error normalization separately. No runtime behavior or exports changed.
- **Verification**: `npm test` passed: 499 tests executed, zero failures, and
  13/13 sensor regressions. Lint, touched JavaScript syntax, and whitespace
  checks passed. Optional socket smoke was sandbox-skipped (`listen EPERM`);
  unchanged runtime behavior requires no client build or service restart.
- **Next seam**: document `findCachedMediaItem(...)` input and nullable cache-read
  result, preserving strict matching, normalized reads, and failure propagation.

### 2026-10-14: Document Google Photos Picker Session-Deletion Contract

- **Contract**: documented `deletePickerSession(sessionId)` string inputs,
  asynchronous Fetch boolean results, and failure boundaries. Native input
  dispatch precedes authentication; synthetic ids acknowledge without effects.
  Real ids resolve authentication outside the request catch, then issue one
  verbatim DELETE with only a Bearer header and no body reads. HTTP failures
  return false silently; request/property failures log and return false.
- **Functional design**: retained the concise data-first effect shell rather
  than introducing a pure, curried, or algebraic wrapper with no reusable
  transformation. Declarative case tables compose with `map`, `flatMap`, and
  `Promise.all` over independent injected adapters; no global patches, live
  credentials, network requests, cache writes, or production exports are added.
- **Tests**: eight focused tests pin the source contract, malformed-input
  short-circuits, repeated synthetic no-ops, exact DELETE metadata, body-read
  avoidance, awaited refresh and request completion, authentication rejections,
  handled failures, refreshed-token retention, raw adapter flags, and repeated
  real requests. Repeated deletion is not an idempotence guarantee.
- **Hardening boundary**: recorded raw response flags, verbatim ids, and
  nullish error-handler rejections in the existing Picker backlog. This slice
  documents compatibility behavior without changing validation or recovery.
- **Verification**: `npm test`, `npm run lint`, touched JavaScript syntax, and
  `git diff --check` passed: 491 tests executed, zero failed assertions, and
  13/13 sensor regressions passed. Optional socket smoke was sandbox-skipped
  with `listen EPERM`; unchanged runtime behavior needs no build or restart.
- **Next seam**: document `syncGoogleAlbum(...)` adapter/options and returned-item
  contracts, preserving append/upsert, post-union policy, and effect ordering.

### 2026-10-13: Document Google Photos Picker Media-Listing Contract

- **Contract**: documented `listPickerMediaItems(sessionId)` string inputs,
  fresh raw-item arrays, sequential pagination, and rejection boundaries.
  Synthetic sessions bypass authentication; real sessions resolve one token,
  encode query parameters, and await every JSON page before continuing.
  `pageSize=50` is not a total cap. Arrays concatenate in order without
  deduplication or validation; later failures reject without partial results.
- **Functional design**: retained the readable data-first sequential effect
  shell. Declarative cases compose with `map`, `flatMap`, and `Promise.all`
  over isolated adapters. Array concatenation provides the useful monoidal
  law directly: page partitioning and empty pages preserve the result.
  No curried wrapper, dependency, runtime change, or production export added.
- **Tests**: eight focused assertions cover source contracts, malformed ids,
  fresh synthetic rows, refresh-token-only authentication, exact encoded GET
  metadata, delayed JSON, token reuse, 250-row accumulation, concatenation
  identities, duplicate/reference retention, native payload/token handling,
  authentication versus request failures, HTTP text, and nullish errors.
- **Hardening boundary**: recorded missing pagination bounds, cancellation,
  response validation, and long-session authentication policy in the backlog.
  These are compatibility observations, not guarantees of safe pagination.
- **Verification**: `npm test`, `npm run lint`, touched JavaScript syntax, and
  `git diff --check` passed. Optional socket smoke tests were sandbox-skipped
  with `listen EPERM`; unchanged runtime behavior needs no build or restart.
- **Next seam**: document `deletePickerSession(sessionId)` input, asynchronous
  boolean result, and failure contract while preserving synthetic no-ops,
  authentication placement, DELETE metadata, and handled request failures.

### 2026-10-13: Document Google Photos Picker Session-Retrieval Contract

- **Contract**: documented `getPickerSession(sessionId)` string inputs,
  synthetic/unvalidated JSON results, and branch-specific rejections. Native
  input dispatch precedes authentication; synthetic ids return fresh records
  without token, clock, or network effects. Real ids await token resolution,
  including refresh-token-only state, then use verbatim GET URL interpolation.
  JSON is awaited unchanged; HTTP failures do not read response bodies.
- **Functional design**: retained the concise data-first effect shell.
  Pure functions, currying, partial application, composition, and Fantasy Land
  wrappers would not simplify this orchestration boundary. Declarative case
  tables compose with `map`, `flatMap`, and `Promise.all` over isolated adapters;
  no runtime changes, dependencies, or production exports were added.
- **Tests**: seven focused assertions pin the documented contract, malformed
  inputs before effects, fresh synthetic records, exact GET options, verbatim
  ids, raw JSON identity, authentication failures outside the session catch,
  refresh-before-request ordering, delayed JSON completion, retained tokens,
  request/HTTP/JSON failures, and nullish thrown-value replacement.
- **Hardening boundary**: expanded the Picker backlog to include explicit id
  validation/encoding and retrieval response/error normalization decisions.
- **Verification**: `npm test`, `npm run lint`, touched JavaScript syntax, and
  `git diff --check` passed. Optional socket smoke tests were sandbox-skipped
  with `listen EPERM`; unchanged runtime behavior needs no build or restart.
- **Next seam**: document `listPickerMediaItems(sessionId)` input, asynchronous
  result, pagination, and rejection contract while preserving ordered pages
  and the existing synthetic/authentication/request boundaries.

### 2026-10-12: Document Google Photos Picker Session-Creation Contract

- **Contract**: documented `createPickerSession()` synthetic/unvalidated JSON
  results and rejected failures. Refresh-token-only state still fails the access
  guard; mock tokens use one clock read without refresh or requests. Real sessions
  await token resolution and POST an empty JSON object. Pre-request failures stay
  outside the request catch; request/status-body/JSON failures are logged and
  rethrown, except nullish values that fail while reading `err.message`.
- **Functional design**: kept the small effect shell explicit. Pure projections,
  currying, partial application, and Fantasy Land-style wrappers would not
  simplify this no-argument orchestration boundary. Tests compose independent
  case tables with `map` and `Promise.all` and inject clock/network adapters;
  no runtime changes, dependencies, or production exports were added.
- **Tests**: seven focused assertions cover documented contracts, absent and
  malformed tokens, synthetic sessions, pre-request failures, exact POST metadata,
  raw JSON identity, delayed JSON completion, refresh-before-request ordering,
  retained refreshed state, and logged versus unlogged rejection paths.
- **Hardening boundary**: recorded response validation and thrown-value
  normalization as separate backlog decisions, not silent compatibility changes.
- **Verification**: `npm test`, `npm run lint`, touched JavaScript syntax, and
  `git diff --check` passed. Optional socket smoke tests were sandbox-skipped
  with `listen EPERM`; unchanged runtime behavior needs no build or restart.
- **Next seam**: document `getPickerSession(sessionId)` input, asynchronous result,
  and rejection contract, preserving the synthetic shortcut and GET/logging shell.

### 2026-10-12: Document Google Photos Authentication-Presence Contract

- **Contract**: documented `isAuthenticated()` as a synchronous boolean
  access-token presence check, not authentication validation. Expired, synthetic,
  and malformed truthy tokens return true; refresh-token-only state returns false.
  Expiry and credentials are not inspected, and the check has no mutation,
  clock, refresh, network, persistence, or logging effects.
- **Functional design**: retained the concise native boolean projection and
  zero-argument service-state reader. It is deterministic for fixed state, not
  pure over explicit inputs; a curried wrapper or Fantasy Land abstraction would
  add ceremony. Declarative case tables and `flatMap`/`map` combinations keep
  tests compositional without global patches or new production exports.
- **Regression coverage**: five focused tests pin the source contract, all
  native falsy token values, representative truthy/malformed values without
  coercion hooks, expiry/refresh-token/credential independence, repeatability,
  state/effect isolation, and later token replacement through isolated code
  exchange. Runtime behavior is unchanged.
- **Verification**: `npm test` passed (461 tests, 459 reported passed assertions,
  zero failures; sensor adapters 13/13). Lint, touched JavaScript syntax, and
  `git diff --check` passed. Optional Unix-socket smoke tests were sandbox-skipped
  with `listen EPERM`; unchanged runtime behavior needs no build or restart.
- **Next seam**: document `createPickerSession()` asynchronous result and
  rejection contract, preserving the access-token guard, synthetic-session
  branch, and authenticated request/logging boundaries.

### 2026-10-12: Document Google Photos Credential-Save Contract

- **Contract**: documented `saveGoogleCredentials(...)` string inputs, boolean
  results, and synchronous failures. Both trims complete before replacement and
  outside error handling; empty strings remain accepted. Persistence observes
  replaced credentials, success logs afterward, and handled failures return false
  without rollback. Nullish thrown values can escape the error handler.
- **Functional design**: preserved the small data-first effect shell. A curried
  wrapper or algebra would not simplify this mutation/persistence boundary.
  Tests use declarative `map`, `flatMap`, and case tables with isolated adapters;
  a detached fixture-only credential reader observes ordering without new
  production exports, global patches, or real credentials.
- **Regression coverage**: seven focused tests pin the source contract, Unicode
  trimming, internal whitespace, empty inputs, native trim dispatch, invalid and
  throwing inputs, replacement/persistence/logging ordering, persistence failure
  without rollback, retries, thrown-value handling, repeated saves, and token and
  unrelated-effect isolation. Runtime behavior is unchanged. Credential rollback
  and error normalization are recorded as separate hardening decisions.
- **Verification**: `npm test` passed (456 tests, 454 reported passed assertions,
  zero failures; sensor adapters 13/13). Lint, touched JavaScript syntax, and
  `git diff --check` passed. Optional Unix-socket smoke tests were sandbox-skipped
  with `listen EPERM`; unchanged runtime behavior needs no build or restart.
- **Next seam**: document `isAuthenticated()` boolean result contract, preserving
  access-token truthiness without implying token validity, expiry checks, or
  refresh-token authentication.

### 2026-10-11: Document Google Photos Authorization-URL Contract

- **Contract**: documented `getGoogleAuthUrl(...)` callback input, relative
  sandbox versus absolute OAuth result, client-ID-only fallback, Picker-only
  scope, query encoding, and synchronous encoding failures. Client secrets,
  callback validation, and OAuth state are not checked by this boundary;
  callback hardening remains separate roadmap work.
- **Functional design**: retained the small data-first construction and explicit
  credential/logging shell. A new curried or algebraic wrapper would not simplify
  this seam. Tests compose declarative case tables with `map`, `forEach`, and
  `every` using existing isolated adapters, without global patches, real
  credentials, or new production exports.
- **Regression coverage**: six focused tests pin the JSDoc contract, fallback
  logging, exact OAuth parameter list, encoding, native coercion, lone-surrogate
  and Symbol behavior, repeatability for fixed credentials, later credential
  replacements, and absence of token, clock, network, cache, or persistence
  effects during URL construction. Runtime code is unchanged.
- **Verification**: `npm test` passed (449 tests, 447 reported passed assertions,
  zero failures; sensor adapters 13/13). Lint, touched JavaScript syntax, and
  `git diff --check` passed. Optional Unix-socket smoke tests were sandbox-skipped
  with `listen EPERM`; unchanged runtime behavior needs no build or restart.
- **Next seam**: document `saveGoogleCredentials(...)` string inputs and boolean
  result contract, preserving trimming, credential replacement, persistence,
  and logged failure ordering in the service shell.

### 2026-10-11: Document Google Photos Code-Exchange Contract

- **Contract**: documented `exchangeGoogleCode(...)` authorization inputs,
  service-owned mutable token result, mock credential fallback, separate clock
  reads, encoded OAuth request, awaited JSON, truthy refresh-token fallback,
  and persistence normalization/skips. Failures before replacement preserve
  state; persistence failures reject after replacement without rollback.
- **Functional design**: retained the unchanged data-first effect shell rather
  than introducing a wrapper that cannot make requests, clocks, mutation, or
  persistence pure. Independent tests compose with `map`, spread, and
  `Promise.all`, reusing injected service adapters plus a local persistence
  observer. No global patches, real credentials, or new production exports.
- **Regression coverage**: seven focused tests pin the JSDoc contract, either
  missing credential, mock clocks and object replacement, returned-state aliasing,
  encoded inputs, delayed completion, frozen seed preservation, native coercion,
  refresh-token fallback and persistence, and network/HTTP/body/JSON/clock/write
  failures. Result ownership and persistence recovery are separate backlog policy
  decisions, not silent behavioral changes.
- **Verification**: `npm test` passed (443 tests, 441 reported passed assertions,
  zero failures; sensor adapters 13/13). Lint, touched JavaScript syntax, and
  `git diff --check` passed. Optional Unix-socket smoke tests were sandbox-skipped
  with `listen EPERM`; unchanged runtime behavior needs no build or restart.
- **Next seam**: document `getGoogleAuthUrl(...)` callback-URI input and
  authorization-URL result contract, preserving credential fallback, Picker-only
  scope, query encoding, and logging in the service shell.

### 2026-10-11: Document Google Photos Token-Refresh Contract

- **Contract**: documented `refreshAccessToken()` refreshed/synthetic result,
  missing-token rejection, separate mock clock reads, encoded OAuth request,
  awaited JSON completion, and logged failure boundary. Refresh retains the
  stored refresh token without persistence and preserves unvalidated response
  fields and numeric expiry coercion.
- **Functional design**: retained the unchanged, small effect shell. Requests,
  logging, clock reads, and token mutation cannot become pure through a wrapper;
  no extra currying or algebra is needed. Independent test cases compose through
  `map` and `Promise.all`, using injected adapters and detached token snapshots
  rather than global patches, real credentials, or production exports.
- **Regression coverage**: seven focused tests pin the JSDoc contract, inert
  missing-token rejection, mock clock ordering, encoded request fields, delayed
  completion, frozen seed preservation, refresh-token retention, response/expiry
  coercion, network/HTTP/JSON/null-payload failures, and partial token updates
  on clock failure. Atomic-update policy is recorded separately in the backlog.
- **Verification**: `npm test` passed (436 tests, 434 reported passed assertions,
  zero failures; sensor adapters 13/13). Lint, touched JavaScript syntax, and
  `git diff --check` passed. Optional Unix-socket smoke tests were sandbox-skipped
  with `listen EPERM`; unchanged runtime behavior needs no build or restart.
- **Next seam**: document `exchangeGoogleCode(...)` input, token-state result,
  and rejection contract, preserving mock handling, OAuth request shaping,
  refresh-token fallback/persistence, and logged failures in the service shell.

### 2026-10-11: Document Google Photos Token-Resolution Contract

- **Contract**: documented `getValidToken()` cached/refreshed token result and
  rejected authentication, refresh, and clock failures. Missing access tokens
  delegate or reject before the resolver reads the clock; existing tokens
  refresh only with fewer than five minutes remaining, not at exact equality.
  Replaced the unsupported guaranteed-unexpired claim with explicit mock-token,
  expiry-coercion, and unvalidated OAuth-response behavior.
- **Functional design**: retained the small authentication effect shell and
  unchanged runtime implementation. A pure selector, curry wrapper, or algebra
  would not simplify this contract-only seam. Test cases compose through `map`,
  `flatMap`, and `Promise.all`, with independently injected clock, token,
  environment, fetch, and log adapters; no global patches or live credentials.
- **Regression coverage**: seven focused tests pin the JSDoc contract,
  authentication short-circuits, exact refresh boundaries, frozen seed inputs,
  delayed OAuth completion and token reuse, mock results, missing refresh tokens,
  clock errors, network/HTTP/JSON failures on both paths, and missing response
  tokens. Production exports remain unchanged. Token validation policy is
  recorded separately in the implementation backlog.
- **Verification**: `npm test` passed (429 tests, 427 reported passed assertions,
  zero failures; sensor adapters 13/13). Lint, touched JavaScript syntax, and
  `git diff --check` passed. Optional Unix-socket smoke tests were sandbox-skipped
  with `listen EPERM`; unchanged runtime behavior needs no build or restart.
- **Next seam**: document `refreshAccessToken()` result and rejection contract,
  preserving mock handling, OAuth request shaping, token-state mutation, and
  logged failures in the service shell.

### 2026-10-11: Document Google Photos Base-URL Staleness Contract

- **Contract**: documented `isBaseUrlStale(...)` cached epoch-millisecond input
  and boolean result. Absent/falsy timestamps are stale without a clock read;
  timestamped rows read the clock once and expire at the inclusive 55-minute
  TTL. Future timestamps remain fresh. Native subtraction accepts numeric
  strings; truthy nonnumeric strings yield NaN and currently classify as fresh.
- **Functional design**: retained the small data-first predicate in the service
  shell because `Date.now()` is an effect. There is no repeated policy to justify
  a curried wrapper or a Fantasy Land abstraction here; runtime behavior and
  production exports are unchanged. Malformed-timestamp hardening is recorded
  as a separate policy decision rather than silently changing compatibility.
- **Regression coverage**: four focused tests pin the JSDoc contract, falsy
  short-circuiting, exact TTL boundaries, future/coerced timestamps, frozen
  inputs, clock-read counts, advancing-clock results, and propagated clock
  failures. The existing VM fixture now captures both internal helpers and
  injects a local clock without patching globals or touching live cache files.
- **Verification**: `npm test` passed (422 tests, 420 reported passed assertions,
  zero failures; sensor adapters 13/13). Lint, touched JavaScript syntax, and
  `git diff --check` passed. Optional Unix-socket smoke tests were sandbox-skipped
  with `listen EPERM`; unchanged runtime behavior needs no build or restart.
- **Next seam**: document `getValidToken()` token-result and rejection contract,
  preserving the strict five-minute refresh boundary and explicit effects.

### 2026-10-10: Document Google Photos Pure Content-URL Contract

- **Contract**: documented `buildGooglePhotoContentUrl(...)` base URL, shared
  render options, and string result. Empty/absent bases yield an empty string;
  dimensions default independently only when undefined. Supplied values and
  existing base directives are interpolated verbatim, without validation,
  clamping, encoding, or rewriting; crop follows width and height.
- **Functional design**: retained the small pure data-first function and its
  existing interface. Partial application at the call site composes naturally
  with `map`; an Applicative, Monad, or new curry wrapper adds no useful law or
  reuse here. No runtime behavior changed.
- **Regression coverage**: four focused tests cover JSDoc contracts, default
  and explicit dimensions, crop ordering, empty/verbatim bases, determinism,
  frozen option preservation, and absence of service effects. The existing
  isolated VM fixture captures the internal helper without widening production
  exports or touching live cache files, credentials, or global adapters.
- **Verification**: `npm test` passed (418 tests, 416 reported passed assertions,
  zero failures; sensor adapters 13/13). Lint, touched JavaScript syntax, and
  `git diff --check` passed. Optional Unix-socket smoke tests were skipped due
  to sandbox `listen EPERM`; no frontend build or daemon restart is needed.
- **Next seam**: document `isBaseUrlStale(...)` cached-timestamp/boolean contract
  while preserving the inclusive TTL boundary and explicit clock read.

### 2026-10-10: Document Google Photos Normalized Cache-Read Contract

- **Contract**: documented `getCachedMediaItems()` render-row result, open
  metadata retention, first-usable-id ordering, and serialization-based
  changed-only writes outside test mode. Eligibility is structural, not proof
  of downloadable bytes; rating, broken status, age, and caps are not enforced
  by this reader.
- **Functional boundary**: the existing pure map/filter/dedupe composition is
  already the clearest expression. Read/write/warning effects stay in the
  service shell; no extra algebra or runtime abstraction is needed.
- **Regression coverage**: extended the isolated service fixture with cache
  adapters, without touching global effects, credentials, or live cache files.
  Tests pin proxy/default projection, metadata retention, filtering before
  deduplication, serialization idempotence, detached repeated reads, test-mode
  write suppression, empty read fallbacks, and propagated effect failures.
- **Existing limitation**: valid non-array JSON is not decoded defensively and
  still throws. The contract and tests make this distinct from caught read or
  JSON-syntax failures; any recovery policy needs a separate hardening slice.
  Runtime behavior is unchanged.
- **Verification**: `npm test` passed (414 tests, 412 reported passed assertions,
  zero failures; sensor adapters 13/13). Lint, touched JavaScript syntax, and
  `git diff --check` passed. Optional Unix-socket smoke tests were skipped due
  to sandbox `listen EPERM`; no frontend build or daemon restart is needed.
- **Next seam**: document `buildGooglePhotoContentUrl(...)` input/result
  contract while preserving default dimensions and optional crop directives.

### 2026-10-10: Document Google Photos Sequential Pre-Download Contract

- **Contract**: documented `downloadSyncMediaItems(...)` selected-media input
  and `Promise<void>` completion, including test-mode no-op, existing-file
  skips, missing-URL/non-OK skips, and per-item versus batch failures.
- **Functional boundary**: URL construction remains pure. The sequential loop
  expresses ordered network/body/write effects directly; an additional algebra
  or download framework would add ceremony to this contract-only slice.
- **Regression coverage**: evaluate the real service with isolated network,
  filesystem, environment, and credential adapters. Tests cover immutable input,
  cache skips, a deferred body proving sequential writes, network/body/write
  failure continuation, and rejection from an existence check outside the catch.
  No runtime behavior changed.
- **Verification**: `npm test` passed (409 tests, 407 reported passed assertions,
  zero failures; sensor adapters 13/13); lint, touched JavaScript syntax checks,
  and `git diff --check` passed. New asynchronous checks are explicitly awaited
  before the report. The optional Unix-socket smoke was skipped due to sandbox
  `listen EPERM`.
- **Next seam**: document `getCachedMediaItems()` normalized result and
  changed-only persistence contract while preserving cache read/write effects.

### 2026-10-09: Document Google Photos Orphan Cleanup Contract

- **Contract**: documented the pure orphan projection's basename matching and
  stable result order, plus `cleanOrphanedMediaFiles(...)` active-item input,
  no-op conditions, and best-effort result.
- **Effect boundary**: directory listing, synchronous unlinking, and warning
  logging remain in the Google Photos service shell; runtime behavior did not
  change.
- **Regression coverage**: source-contract assertions pin the test/missing-dir
  guards and cleanup effects. Pure projection coverage verifies extension-
  agnostic matching, input order, and input immutability.
- **Verification**: `npm test` passed (405 tests, 403 assertions, zero failures;
  sensor adapters 13/13); `npm run lint`, JavaScript syntax checks, and
  `git diff --check` passed. The optional Unix-socket smoke was skipped because
  this environment denies `listen` with `EPERM`.
- **Next seam**: document `downloadSyncMediaItems(...)` inputs, test-mode
  no-op, and best-effort sequential download/cache effects in the service shell.

### 2026-10-09: Document Google Photos Media Byte Fetch Contract

- **Contract**: documented `fetchMediaItemBytes(...)` inputs and its
  `{ buffer, contentType }` result, including local-cache hits, zero-byte
  recovery, response/cached MIME fallback, and final fetch failure behavior.
- **Effect boundary**: Picker refresh, authentication, network requests, local
  file reads/writes, and logging remain in the Google Photos service shell; no
  runtime behavior changed.
- **Regression coverage**: added source-contract assertions for its result
  shape, empty-cache cleanup, candidate de-duplication, retry, and rejection
  boundary; existing local-cache and network-download tests continue to cover
  the byte result and disk-cache behavior.
- **Verification**: `npm test` passed with 404 tests executed, 402 assertions,
  zero failures, and 13/13 sensor-adapter regressions. `npm run lint`, touched
  JavaScript syntax checks, and `git diff --check` passed. The optional
  Unix-socket smoke was skipped because this environment denies `listen` with
  `EPERM`.
- **Next seam**: document `cleanOrphanedMediaFiles(...)` inputs, no-op
  conditions, and file-cleanup effects in the Google Photos service shell.

### 2026-10-09: Document Google Photos Media URL Refresh

- **Contract**: documented the stable media-id and optional width/height/crop
  inputs, mock fixture URL, authenticated content-URL projection, and rejected
  error behavior of `refreshMediaItemUrl(...)`.
- **Effect boundary**: token acquisition, media-item fetch, logging, and error
  propagation remain in the service shell; content-URL composition remains in
  the existing helper. No runtime behavior changed.
- **Regression coverage**: source-contract assertions pin the render options,
  authenticated request, response checks, URL composition, and rethrow path;
  an asynchronous test exercises the synthetic URL path without network access.
- **Verification**: `npm test` passed with 403 tests executed, 401 assertions,
  zero failures, and 13/13 sensor-adapter regressions. `npm run lint` and
  touched-file syntax checks passed. The optional Unix-socket smoke was skipped
  because this environment denies `listen` with `EPERM`.
- **Next seam**: document `fetchMediaItemBytes(...)` inputs and result while
  preserving its local-file, Picker-refresh, network, and persistence effects.

### 2026-10-09: Document Google Photos Picker Cache Refresh

- **Contract**: documented the media id and optional session override, cached
  session fallback, nullable no-session result, and exact-session-item requirement
  of `refreshCachedMediaItem(...)`.
- **Effect boundary**: Picker listing and cache upsert/persistence remain in the
  Google Photos service shell; refreshed rows continue to retain existing
  metadata, and request or missing-item failures continue to reject.
- **Regression coverage**: source-contract assertions pin the documented
  fallback, request, exact match, error, rebuild, and upsert path without
  exporting or reshaping the internal asynchronous helper.
- **Verification**: `npm test` passed with 401 tests executed, 399 assertions,
  zero failures, and 13/13 sensor-adapter regressions. `npm run lint`, syntax
  checks for the touched JavaScript, and `git diff --check` passed. The optional
  Unix-socket smoke was skipped because this environment denies `listen` with
  `EPERM`.
- **Next seam**: document `refreshMediaItemUrl(...)` inputs and result while
  preserving its authentication and network effects in `googlePhotos.js`.

### 2026-10-09: Document Google Photos Cache Metadata Persistence

- **Contract**: documented the cache updater's media-id/proxy-URL and metadata
  inputs, matched-row-or-null return, and normalized-cache read behavior.
- **Persistence boundary**: the pure immutable merge remains in
  `googlePhotosCache.js`; `googlePhotos.js` writes only when an allowed value
  actually changes and the process is outside test mode. Matched unchanged rows
  are still returned without a write.
- **Regression coverage**: verified returned projections and disk state across
  test mode, missing rows, unchanged metadata, and changed metadata.
- **Next seam**: document the input and return contract of
  `refreshCachedMediaItem(...)`, retaining Picker-session and network effects
  in the service shell.

### 2026-10-09: Document Google Photos Live Snapshot Mutation

- **Contract**: documented the accepted snapshot fields, Google media-id or
  proxy-URL identifier, allowlisted metadata input, returned photo, and exact
  mutation order of `applyCachedMediaItemMetadataToState(...)`.
- **Boundary preserved**: metadata filtering remains in the checked pure cache
  projection; this service shell still replaces the photo-list array, copies
  matching rows, preserves unmatched row identity, and updates active frame
  objects in place.
- **Regression coverage**: tests pin matched-row copying, active-frame identity,
  proxy-URL matching, falsy metadata, ignored fields, early no-ops, and the
  existing valid-patch/no-match list-remap behavior.
- **Next seam**: document the conditional cache-write contract of
  `updateCachedMediaItemMetadata(...)` without moving cache I/O out of the
  Google Photos service shell.

### 2026-10-09: Type Google Photos Cached-Metadata Projections

- **Functional boundary**: moved the allowlisted metadata patch and immutable
  cached-row merge into `server/services/googlePhotosCache.js`. The service
  continues to own live snapshot updates and cache-file writes, and its public
  exports remain compatible.
- **Behavior pinned**: undefined metadata is omitted; explicit `false`, `0`,
  and `null` remain valid values; unsupported fields are ignored; missing IDs
  and empty patches remain no-op results; source rows are not mutated.
- **Verification**: focused contract and behavior tests cover the projection,
  service re-exports, and the retained write boundary.
- **Next seam**: document the input, return, and mutation contract of
  `applyCachedMediaItemMetadataToState(...)` without moving live snapshot
  ownership out of the Google Photos service shell.

### 2026-10-09: Isolate and Type Google Photos Cache Projections

- **Functional boundary**: moved Picker-row construction, persisted-cache
  normalization, usability checks, stable-ID deduplication, and session upsert
  into the pure checked `server/services/googlePhotosCache.js` module. The
  existing `googlePhotos.js` exports remain compatible; auth/session handling,
  pool-policy application, cache persistence, file cleanup, and downloads stay
  in the service shell.
- **Behavior pinned**: latest synced records win while existing user metadata
  remains authoritative; cached rows retain stable order, malformed dimensions
  use the existing defaults, and pool retention/capping still runs after the
  accumulated union.
- **Next seam**: document checked contracts for the remaining pure cached-photo
  metadata patch/merge projections without moving live-state or file effects.

### 2026-10-09: Document Config Effect-Shell Contracts

- **Contracts**: added local `@ts-check` JSDoc to `server/config/collections.js`
  and `server/config/configLoader.js`, describing open photo/config records and
  the exported update and persistence boundaries.
- **Behavior preserved**: photo update plans still project first, then the
  collection shell applies live-state changes and persists; config loading
  still reads defaults and overrides, filters deprecated secrets through the
  pure projection, and warns at the existing boundary.
- **Regression coverage**: source-contract tests pin these input shapes and
  effect boundaries; existing photo/config projection tests continue to cover
  the runtime semantics.
- **Next seam**: add checked contracts around Google Photos cache normalization
  and accumulation projections while keeping auth, session, file, and network
  effects in the service shell.

### 2026-10-08: Project Curated Photo Updaters

- **Functional boundary**: added checked pure rating, crop, pairing, and broken-
  photo updaters in `server/config/collectionPhotoUpdaters.js`; `collections.js`
  continues to own orchestration, live-state mutation, logging, and persistence.
- **Behavior pinned**: tests retain native `parseInt(..., 10)` behavior,
  undefined-only crop omission, JavaScript truthiness coercion, rating-1 feed
  pruning, and immutable photo updates.
- **Verification**: `npm test` passed with 390 core tests and 388 assertions;
  sensor adapter regressions passed 13/13. `npm run lint` and touched-file
  syntax checks passed. The optional Unix-socket smoke was skipped because the
  sandbox denies `listen` with `EPERM`.
- **Next seam**: review local JSDoc contracts at the remaining config effect
  shells (`collections.js` and `configLoader.js`), keeping filesystem and
  live-state effects in place.

### 2026-10-07: Project Curated Photo Field Updates

- **Functional boundary**: extracted `projectPhotoFieldUpdate(...)` into
  `server/config/collectionPhotoUpdatePlan.js`. The checked pure projection
  derives collection, feed-list, and active-frame updates; `collections.js`
  retains in-place application and persistence.
- **Behavior pinned**: tests preserve paired-frame synchronization, immediate
  removal of rating-1 photos from the live feed, input immutability, and the
  missing-URL identity/no-state-update path.
- **Verification**: `npm test` passed with 385 tests and 383 assertions;
  sensor adapter regressions passed 13/13. `npm run lint` and `node --check`
  passed. The optional Unix-socket smoke was skipped because the sandbox denies
  `listen` with `EPERM`.
- **Completed next seam**: field-specific photo updater behavior now has
  checked pure contracts in `server/config/collectionPhotoUpdaters.js`.

### 2026-10-05: Type the Config Loader Projection

- **Functional boundary**: extracted defaults/overrides composition and
  deprecated-secret filtering into `server/config/configLoaderProjections.js`.
  The projection is pure and checked; config file access and warning output
  remain in `configLoader.js`.
- **Behavior pinned**: location and Ecowitt-unit values merge at their existing
  nested levels, sensor-history remains a shallow section merge, extension keys
  survive, deprecated secret keys are omitted in stable order, and inputs are
  unchanged.
- **Completed next seam**: the photo-field update plan is now a checked pure
  projection in `server/config/collectionPhotoUpdatePlan.js`; collection/state
  mutation and persistence remain in `collections.js`.

### 2026-10-04: Type the Local Config Merge Projection

- **Functional boundary**: documented `mergeLocalConfig(...)` with local checked
  section contracts. It remains a pure immutable partial merge; filesystem
  reads and atomic writes remain in `saveLocalConfigPatch(...)`.
- **Behavior pinned**: Ecowitt units merge one level deep, sensor-history values
  merge shallowly, unsupported top-level patch properties stay ignored, and
  missing Ecowitt units preserve the current units (or default to an empty map).
- **Verification**: `npm test` passed (380 tests, 378 assertions, 0 failures;
  sensor adapters 13/13); `npm run lint`, `node --check`, and `git diff --check`
  passed. The optional Unix-socket smoke was skipped because the sandbox denies
  `listen` with `EPERM`.
- **Next seam**: isolate and type the pure defaults/overrides and deprecated-
  secret filtering projection in `server/config/configLoader.js`; keep
  environment loading, file reads, and warnings at its module boundary.

### 2026-10-04: Type Curried Collection Photo Projections

- **Functional boundary**: extracted URL-matched photo and photo-list mapping
  into checked pure projections. Their curried, data-last interfaces retain
  unmatched identity and an empty-list fallback; collection/state mutation and
  persistence remain in `server/config/collections.js`.
- **Regression coverage**: tested staged application, null-safe identity,
  immutable list mapping, retained unmatched references, and source immutability.
  A source assertion pins the local checked contracts.
- **Verification**: `npm test` passed (377 tests, 375 assertions, 0 failures;
  sensor adapters 13/13); `npm run lint`, syntax checks, and `git diff --check`
  passed. The optional Unix-socket smoke was skipped because the sandbox denies
  `listen` with `EPERM`; a TypeScript compiler is not installed in this checkout.
- **Next seam**: add a checked contract to the pure local-config merge in
  `server/config/localSettings.js`; keep filesystem writes in
  `saveLocalConfigPatch(...)`.

### 2026-10-04: Type Collection Persistence Projections

- **Functional boundary**: documented the open persisted JSON input and stable
  normalized/serialized snapshot contracts in `server/config/collectionsCodec.js`.
  Collection cloning, fallback selection, ordered URL deduplication, and state
  projection remain pure; file access and migration recovery remain in the shell.
- **Regression coverage**: verified deterministic serialization, detached
  normalized collection rows, input immutability, existing URL ownership and
  fallback semantics, plus a source assertion for the checked contracts.
- **Verification**: `npm test` passed with 375 tests executed, 373 assertions,
  0 failures, and 13/13 sensor-adapter regressions. `npm run lint`, syntax, and
  `git diff --check` passed. The Unix-socket smoke was skipped because the
  environment denies `listen` with `EPERM`; a TypeScript compiler is not
  installed in this checkout.
- **Next seam**: type the curried photo-by-URL and photo-list projections in
  `server/config/collections.js`, leaving collection/state mutation and
  persistence in the existing effect shell.

### 2026-10-04: Type the Keyword-to-Feed Configuration Projection

- **Functional boundary**: added local checked contracts to the pure
  `buildFeedConfigsFromKeywords(...)` projection and its source/category
  configuration shapes. It continues to compose `collectKeywordTerms(...)`
  with the declarative built-in override map; mutable `screensaverState`
  remains an explicit module-level shell.
- **Regression coverage**: verified normalized phrase and timed-keyword order,
  malformed-value filtering, input immutability, built-in overrides, and
  independent keyword arrays for each generated source. Added a source-level
  assertion for the checked contract.
- **Verification**: `npm test` passed with 373 tests executed, 371 assertions,
  0 failures, and 13/13 sensor-adapter regressions. `npm run lint`, syntax, and
  `git diff --check` passed. The Unix-socket smoke was skipped because the
  environment denies `listen` with `EPERM`; a TypeScript compiler is not
  installed in this checkout.
- **Next seam**: add explicit contracts to the pure collection snapshot
  projections in `server/config/collectionsCodec.js`, leaving filesystem and
  migration effects in its existing shell.

### 2026-10-04: Show Google Photos Capture Dates on TV Slides

- **Functional boundary**: Picker `createTime` now survives cache normalization
  and refreshes that omit the timestamp. A pure client presentation helper
  formats valid creation timestamps as browser-localized dates and projects
  both sides of split-slide titles; Picker synchronization and Dashboard
  rendering remain effectful shells.
- **Regression coverage**: verified cache creation and normalization, retention
  of an existing timestamp through a later Picker refresh without `createTime`,
  valid and invalid date formatting, existing-title fallbacks, and unchanged
  non-Google titles including split slides.
- **Verification**: `npm test` passed with 370 tests executed, 368 assertions,
  0 failures, and 13/13 sensor-adapter regressions. `npm run lint`, the client
  production build, `node --check` for the touched JavaScript modules, and
  `git diff --check` passed. The Unix-socket smoke was skipped because the
  environment denies `listen` with `EPERM`.
- **Roadmap**: implementation companion Step 6 remains active; its next
  documented seam remains the keyword-to-feed-config projection in
  `server/config/state.js`.

### 2026-10-07: Show Google Photos Dates in Single-Slide Mode

- **Presentation correction**: The first capture-date slice projected the date
  into slide metadata, but the Dashboard rendered title labels only for split
  slides. Single Google Photos slides now show the localized date (or the
  existing title fallback); non-Google single slides keep their current
  presentation.
- **Runtime diagnosis**: The service was restarted to load Picker timestamp
  persistence, and the previously active category selection was restored. The
  existing Google Photos cache contained no `createTime` values. The most
  populated and newest saved Picker sessions both returned `403` because their
  access had expired. Those rows need to be selected again through Picker before
  the cache can acquire their dates.
- **Verification**: `npm test` passed with 382 tests executed, 380 assertions,
  0 failures, and 13/13 sensor-adapter regressions. `npm run lint`, the client
  production build, syntax checks for the changed JavaScript modules, and
  `git diff --check` passed. The active service serves the new client assets
  (`index-DUzq1c3V.js` and `index-DgnrgKOQ.css`). The Unix-socket smoke was
  skipped because the environment denies `listen` with `EPERM`.

### 2026-10-04: Type Keyword Specification Projections

- **Functional boundary**: added local checked contracts to the pure
  `server/utils/keywordSpecs.js` helpers for unknown-safe term normalization,
  timed specs, equality, and ordered term collection. Configuration and
  persistence effects remain outside the helper.
- **Regression coverage**: verified malformed-input identities, normalized
  equality, phrase-boundary and delimiter behavior, stable ordering, and
  detached nested arrays.
- **Verification**: `npm test` passed with 368 tests executed, 366 assertions,
  0 failures, and 13/13 sensor-adapter regressions. `npm run lint`, syntax, and
  `git diff --check` passed. The Unix-socket smoke was skipped because the
  environment denies `listen` with `EPERM`.
- **Next seam**: type the pure keyword-to-feed-config projection in
  `server/config/state.js`, leaving mutable `screensaverState` ownership
  explicit at the module boundary.

### 2026-10-04: Record Cross-Cutting Design Audit Findings

- **Audit**: compared roadmap claims and backlog entries with current pool,
  retention, geolocation, RSS, OAuth, and kiosk code paths.
- **Corrections**: marked age retention as implemented; removed unsupported
  total-memory and CPU claims; documented the actual Canada-configured RSS feed;
  retired backlog entries for already implemented geolocation and Google Photos
  OAuth flows.
- **Backlog**: recorded asset identity versus pool membership, lifecycle-cap
  semantics, OAuth callback hardening, news-region alignment, measured resource
  budgets, and IP geolocation transport/timeout work in `ROADMAP.md`.
- **Scope**: documentation and planning only. No implementation or runtime
  behavior changed; no tests were run.

### 2026-10-04: Type Pool Schedule Runtime Status Projection

- **Functional boundary**: extracted `projectPoolScheduleStatus(...)` as a pure,
  checked five-field snapshot while leaving schedule transitions, polling, and
  command dispatch in `createPoolScheduleRuntime(...)`.
- **Regression coverage**: verified null and empty status, exact projection
  shape, input preservation, and detached arrays through both the helper and
  runtime API.
- **Verification**: `npm test` passed with 360 tests executed, 358 assertions,
  0 failures, and 13/13 sensor-adapter regressions. `npm run lint` passed with
  0 errors or warnings; syntax and `git diff --check` passed. Temporary Unix
  socket smoke was skipped because the environment denies `listen` with
  `EPERM`.
- **Next seam**: type the pure route-decode success/failure and composition
  contracts in `server/utils/routeDecode.js`; keep HTTP response effects in
  route handlers.

### 2026-10-04: Type Route Decode Composition Contracts

- **Functional boundary**: added generic JSDoc contracts for route failures,
  successful values, normalization, mapping, fail-fast chaining, and ordered
  collection in `server/utils/routeDecode.js`. The route helper remains a pure
  Result-like algebra; HTTP response effects remain in route handlers.
- **Regression coverage**: verified wrapped-result identity, legacy bare-value
  normalization, map identity/composition and failure preservation, skipped
  chain continuations after failure, ordered collection, and the empty-success
  identity.
- **Verification**: `npm test` passed with 363 tests executed, 361 assertions,
  0 failures, and 13/13 sensor-adapter regressions. `npm run lint`, syntax, and
  `git diff --check` passed. Temporary Unix-socket smoke was skipped because
  the environment denies `listen` with `EPERM`.
- **Next seam**: type the unknown-safe normalization, equality, and term
  collection contracts in `server/utils/keywordSpecs.js`.

### 2026-10-04: Persist Shared Pool Images Once

- **Finding**: startup normalized duplicate image URLs out of the in-memory collections, but snapshot writes could persist the same URL again under another pool. Legacy duplicates also remained in the JSON file after startup normalization.
- **Correction**: the persisted snapshot projection now keeps the first URL occurrence across pools, and startup cleans duplicate rows from existing feed data while preserving unrelated top-level snapshot metadata. Normalization runs the same deduplication after fallback restoration so defaults cannot reintroduce a duplicate.
- **Regression coverage**: added pure snapshot assertions for first-pool ownership and input immutability, plus a temporary-file migration check for disk cleanup and sibling metadata preservation.
- **Functional boundary**: ordered URL deduplication stays a deterministic codec projection; only the existing collection-load/save shell performs filesystem reads and writes.
- **Verification**: `npm test` passed with 359 tests executed, 357 assertions, 0 failures, and 13/13 sensor-adapter regressions; the temporary Unix-socket smoke was skipped because this environment denies `listen` with `EPERM`. `npm run lint` passed with 0 errors or warnings after the small unused-binding cleanup; the client production build passed. `node --check` and `git diff --check` passed.

### 2026-10-04: Reconcile Pending Pool Playback Work

- **Finding**: pool-balancing code, tests, and partial notes were already present as uncommitted work; the product roadmap still described the earlier playback policy, and the companion checkpoint did not mention the behavior.
- **Correction**: verified the pending smart/sequence pool rotation against the current suite and aligned both roadmap checkpoints. The selector/reducer boundary owns pool rotation; the collection codec independently owns persistent URL uniqueness.
- **Maintenance**: removed three pre-existing unused-variable lint warnings. Timestamp normalization still returns a spread clone without `addedAt`; the other two changes remove unused imports only.
- **Workflow backlog**: `.agents/skills` contains the diagnostics workflow but not the roadmap or publish procedures available in the host memory skills; the portability fix is recorded in `AGENTS.md`.
- **Verification**: `npm test` passed with 359 tests executed, 357 assertions, 0 failures, and 13/13 sensor-adapter regressions; `npm run lint` passed with 0 warnings; the client production build passed. The temporary Unix-socket smoke was skipped because this environment denies `listen` with `EPERM`.

### 2026-10-03: Type the Kiosk Runtime-Context Projection

- **Finding**: `createKioskControlRuntime(...)` already exposed a small read-only context to the idle daemon, but its exact field vocabulary was implicit beside process and timer orchestration.
- **Correction**: added `projectKioskRuntimeContext(...)` as a pure closed projection for the three observable flags and documented its input/output contract with local JSDoc; the kiosk runtime still owns all mutable state and host effects.
- **Regression coverage**: verified the projection returns only the three public fields without mutating its input, and checked that the runtime reflects deferred-manual and running kiosk states accurately.
- **Functional boundary**: kept process launch/kill, CPU-governor changes, retry timers, crash-loop policy, and logging in `createKioskControlRuntime(...)`.
- **Verification**: `npm test` passed with 356 executed tests, 354 assertions, 0 failures, and 13/13 sensor-adapter regressions; the temporary Unix-socket smoke was skipped because this environment denies `listen` with `EPERM`. `npm run lint` passed with 0 errors and 3 existing warnings; `node --check` and `git diff --check` passed.

### 2026-09-28: Balance Playback Frequency Across Active Pools

- **Finding**: the visible feed was interleaved, but automatic selection weighted every photo together. Larger pools and higher average ratings therefore received a larger share, and global weather filtering could remove an unmatched pool from most selections.
- **Correction**: smart playback now rotates among pools with time-eligible photos, then applies weather, night, and rating preferences within the chosen pool. Sequence playback also rotates pool categories and keeps per-pool cursors so smaller pools repeat without duplicating rows in the visible feed.
- **Regression coverage**: added unequal-size and unequal-rating pool distribution checks, a weather mismatch case, and multi-pool playback sequences that cycle a one-photo Google Photos pool beside a three-photo curated pool.
- **Verification**: `npm test` passed with 346 assertions and 0 failures plus 13/13 sensor-adapter regressions; the temporary Unix-socket smoke was skipped because this environment denies `listen` with `EPERM`. `npm run lint` passed with 0 errors and 3 existing warnings.
- **Learning**: a round-robin feed layout alone does not guarantee balanced playback when selection later weights or filters individual photos; pool choice needs its own explicit policy.

### 2026-09-28: Type the Environment Refresh Weather Projections

- **Finding**: the extracted refresh runtime already had two deterministic weather snapshot projections, but their provider inputs, cache output, and classifier result shapes were implicit beside the asynchronous refresh shell.
- **Correction**: added local `@ts-check` JSDoc contracts for the open location/current-weather inputs, forecast/cache snapshots, classification callback, and compact physical-weather result without changing exports or runtime behavior.
- **Functional boundary**: provider-field selection and physical-weather projection remain pure; fetches, cache writes, state assignment, logging, and broadcasts remain explicit in `createEnvironmentRefreshRuntime(...)`.
- **Regression coverage**: added direct assertions for selected fields, nested reference preservation, temperature rounding, classifier input, and absent-current no-op, plus checked-source assertions. `npm test` passed with 344 tests / 342 assertions and 13/13 sensor-adapter regressions; the temporary Unix-socket smoke was skipped because this environment denies `listen` with `EPERM`.
- **Verification**: `npm run lint` passed with 0 errors and 3 existing warnings; `node --check` and `git diff --check` passed.
- **Learning**: the cache snapshot intentionally forwards provider-owned nested values unchanged, so documenting those references and projecting only the public top-level fields is clearer than cloning, validating, or wrapping the forecast payload.

### 2026-09-28: Type the WMO Weather Classification Boundary

- **Finding**: weather-code classification already used a deterministic constant-time lookup with a cloudy fallback, but its accepted WMO vocabulary and projected result shape were implicit.
- **Correction**: added local `@ts-check` JSDoc contracts for weather-match labels, physical-condition labels, the classification record, the mapping table, and `classifyWeatherCode(...)` without changing runtime behavior or exports.
- **Functional boundary**: weather classification remains a pure lookup projection; IP geolocation and Open-Meteo fetching remain explicit asynchronous service effects.
- **Regression coverage**: verified all 27 mapped weather codes, all four classification records, three unknown-code fallbacks, and the checked source contract. `npm test` passed with 342 tests / 340 assertions and 13/13 sensor-adapter regressions; the temporary Unix-socket smoke was skipped because this environment denies `listen` with `EPERM`.
- **Verification**: `npm run lint` passed with 0 errors and 3 existing warnings; JavaScript syntax checks and `git diff --check` passed.
- **Learning**: a result vocabulary is enough to make an existing classifier migration-ready; no extra classifier framework or effect injection is needed for a deterministic table.

### 2026-09-28: Type the Sensor Platform Boundary

- **Finding**: the adapter registry already separated descriptor resolution and public capability summaries from read, lifecycle, and settings callbacks, but its protocol metadata and platform interface shapes were implicit.
- **Correction**: added local `@ts-check` JSDoc contracts for descriptor overrides, registration inputs, normalized adapters, public summaries, settings results, and the composed platform API without changing runtime behavior.
- **Functional boundary**: canonical IDs, alias indexing, and summary construction remain deterministic projections; sensor reads, lifecycle hooks, and settings operations remain injected effects. Recursive metadata cloning and freezing keep registry state independent of both adapter-owned descriptors and caller-edited summaries.
- **Regression coverage**: added canonical/legacy alias, descriptor override, deduplication, deep metadata isolation, lifecycle/read delegation, missing-adapter, and checked-source assertions. `npm test` passed with 341 tests / 339 assertions and 13/13 sensor-adapter regressions; temporary Unix-socket smoke was skipped because the environment denies `listen` with `EPERM`.
- **Verification**: `npm run lint` passed with 0 errors and 3 existing warnings; `node --check` and `git diff --check` passed.
- **Learning**: metadata needs a trustworthy ownership boundary, but that does not require a runtime schema abstraction. Explicit callback and descriptor contracts preserve the existing small adapter interface while making the data/effect split clearer.

### 2026-09-28: Type the Sensor History Boundary

- **Finding**: `server/services/sensorHistory.js` already separated deterministic timestamp/metric normalization and CSV rendering from an injected SQLite store, but the persisted record, query, aggregation, and store API shapes were implicit.
- **Correction**: added local `@ts-check` JSDoc contracts for sensor/weather inputs, canonical hourly records, SQL row values, history/statistics results, query options, and the store interface without changing exports or runtime behavior.
- **Functional boundary**: snapshot normalization and CSV rendering remain pure data projections; record/query/statistics operations remain grouped behind the injected database interpreter, whose `close()` only owns internally created connections.
- **Regression coverage**: added input-preservation, malformed-clock, numeric fallback/clamping, CSV escaping, and checked-source assertions. `npm test` passed with 338 tests / 336 assertions and 13/13 sensor-adapter regressions; the temporary Unix-socket smoke was skipped because this environment denies `listen` with `EPERM`.
- **Verification**: `npm run lint` passed with 0 errors and 3 existing warnings; `git diff --check` passed; the client production build completed successfully.
- **Learning**: the existing data-first normalizer and row-to-CSV pipeline already form the useful functional core; explicit contracts prepare the storage boundary for migration without wrapping SQLite operations in a new abstraction.

### 2026-09-28: Type the Ecowitt Protocol Boundary

- **Finding**: the Ecowitt adapter already separated pure vendor decoding, unit/settings normalization, validation, and public-response construction from polling and timeout orchestration, but the accepted payload and canonical response shapes were implicit.
- **Correction**: added local checked JSDoc contracts for vendor payloads, canonical indoor readings, adapter settings, validation results, units, and public environment responses without changing exports or wire shapes.
- **Functional boundary**: metric identifiers, Fahrenheit/inHg conversion, settings normalization, validation, and response projection remain deterministic and input-preserving; fetch, timers, abort signals, availability logging, and last-good state remain in the imperative adapter shell.
- **Regression coverage**: added an input-preservation and canonical-output regression plus checked-source assertions; the focused suite executed 336 tests with 0 failures and 334 passing assertions, while the temporary Unix-socket smoke remains skipped because the sandbox denies `listen` with `EPERM`. Sensor-adapter regressions passed 13/13.
- **Learning**: the protocol boundary already had useful pure functions and a data-first response builder, so naming their contracts was clearer and safer than introducing a runtime schema library or moving network effects into the functional core.

### 2026-09-27: Type the Environment Settings Boundary

- **Finding**: sensor settings already formed a pure catalog algebra across legacy migration, profile normalization, active-device selection, runtime projection, compatibility projection, and adapter validation, but those inputs and outputs were implicit.
- **Correction**: added local checked JSDoc contracts for untrusted device/settings inputs, canonical profiles, runtime and legacy projections, immutable profile operations, and validation options/results without changing exports or wire shapes.
- **Functional boundary**: normalization, legacy decoding, profile updates, and runtime/public projections remain deterministic and input-preserving; config persistence and sensor-runtime updates remain explicit in `app.js`.
- **Regression coverage**: added a pure projection/immutability regression and checked-source assertions; the focused suite executed 335 tests with 0 failures and 333 passing assertions, while sensor-adapter regressions passed 12/12. The temporary Unix-socket smoke remains skipped because the sandbox denies `listen` with `EPERM`.
- **Learning**: the existing catalog and compatibility projections were already the right abstractions, so naming their contracts was clearer and safer than introducing a runtime validation wrapper or moving adapter effects into the domain module.

### 2026-09-27: Type the Snapshot Compatibility Boundary

- **Finding**: snapshot rebuilding already separated legacy-state decoding, canonical domain-state construction, public snapshot projection, and in-place compatibility synchronization, but those shapes were implicit at the domain boundary.
- **Correction**: added local checked JSDoc contracts for the open legacy state, runtime overrides, public snapshot, and each projection/shell function without changing exports, response envelopes, or state synchronization behavior.
- **Functional boundary**: legacy decoding and current-frame projection remain deterministic and input-preserving; `replaceCollections(...)`, `applyDomainState(...)`, and `syncLegacySnapshot(...)` remain the explicit imperative shell that updates the existing runtime object.
- **Regression coverage**: added immutability, alias normalization, active-frame, legacy-application, and checked-source assertions; the focused suite executed 334 tests with 0 failures and 332 passing assertions. The temporary Unix-socket smoke remains skipped because the sandbox denies `listen` with `EPERM`.
- **Learning**: the snapshot module already had the right functional-core/compatibility-shell split, so naming those contracts was clearer and safer than wrapping the mutable runtime object or introducing a new snapshot abstraction.

### 2026-09-27: Type the Pool Schedule Boundary

- **Finding**: scheduled-pool selection already formed a pure local-time and priority projection, but its accepted schedule inputs, policy map, and resolved-entry shapes were implicit at the domain boundary.
- **Correction**: added local checked JSDoc contracts for schedule input/normalization, policy records, resolved schedule entries, and option defaults without changing exports, tie-breaking, overnight behavior, or category-selection semantics.
- **Functional boundary**: local-time formatting, schedule activity, stable identity, priority selection, and immutable category append remain deterministic projections; interval polling, command dispatch, manual-override tracking, and baseline restoration remain in the runtime shell.
- **Regression coverage**: added boundary, identity, immutability, and checked-source assertions; the focused suite executed 332 tests with 0 failures and 330 passing assertions. The temporary Unix-socket smoke remains skipped because the sandbox denies `listen` with `EPERM`.
- **Learning**: schedule evaluation already had the right small functional algebra, so naming its open input and closed output contracts was clearer than introducing a new scheduler abstraction or moving runtime state into the domain module.

### 2026-09-27: Type the Photo Timestamp Boundary

- **Finding**: photo acquisition timestamps already had a pure normalization and curried immutable-stamping boundary, but the persisted photo record was still described with broad `any` metadata.
- **Correction**: added an open `PhotoRecord` JSDoc contract and explicit nullable normalization output without changing timestamp parsing, legacy-date behavior, exports, or runtime shapes.
- **Functional boundary**: timestamp normalization and stamp-new-photo composition remain deterministic and input-preserving; source-specific metadata stays extensible, while persistence codecs and crawler orchestration remain in their effectful shells.
- **Regression coverage**: added malformed-clock identity assertions and checked-source coverage; the focused suite executed 330 tests with 0 failures and 328 passing assertions.
- **Learning**: an open record is the right abstraction for persisted multi-source photos here: it types the owned field without pretending the timestamp helper owns every provider-specific property.

### 2026-09-27: Type the Pool Retention Boundary

- **Finding**: pool lifecycle policy logic already formed a pure normalization and retention pipeline, but its schedule, policy, photo, and curried transform shapes were implicit at the domain boundary.
- **Correction**: added local `@ts-check` JSDoc contracts for normalized schedules and policies, the retained-photo record, immutable cap projection, and data-last pruning/application transforms without changing policy defaults or exports.
- **Functional boundary**: policy normalization, loved-photo preservation, expiry pruning, and prune-then-cap composition remain pure and input-preserving; persistence, crawler refresh, and Google Photos cache orchestration stay in their imperative service shells.
- **Regression coverage**: added composition and immutability assertions plus checked-source coverage; the full suite executed 328 tests with 0 failures and 326 passing assertions.
- **Learning**: this boundary did not need a new abstraction: the existing curried `applyPoolPolicy(now, policy)(photos)` is the useful partial application, while explicit JSDoc names the algebra without adding runtime ceremony.

### 2026-09-27: Type the Sentiment Projection Boundary

- **Finding**: the news sentiment service already composed partially applied lexicon counters, declarative RSS extraction, and pure score classification, but its accepted words, classification vocabulary, and result shape were implicit.
- **Correction**: added local `@ts-check` JSDoc contracts for the word-match counter, headline parser, score classification, and final sentiment result without changing exports, thresholds, parsing, or score rounding.
- **Functional boundary**: lexicon matching, feed-title exclusion, empty-feed identity, and sentiment projection remain deterministic pure functions; RSS/network refresh orchestration remains outside this service boundary.
- **Regression coverage**: added positive classification, Google News feed-title exclusion, empty-input identity, deterministic repeated projection, and checked-source assertions; the focused suite executed 326 tests with 0 failures.
- **Learning**: the existing curried counter and declarative reduction already expressed the right functional abstraction, so naming its input/output algebra was clearer than adding a Result wrapper or a new sentiment framework.

### 2026-09-27: Type the Environment Content Boundary

- **Finding**: environment secret persistence already separated a deterministic content projection from filesystem and process-environment effects, but the normalization, entry map, and string transformation shapes were implicit.
- **Correction**: added local `@ts-check` JSDoc contracts for unknown-safe value normalization, environment entries, and `upsertEnvVarInContent(...)` without changing exports, quoting, or replacement behavior.
- **Functional boundary**: replace-or-append content projection remains pure, deterministic, input-preserving, and idempotent; `persistEnvVars(...)` retains file reads, writes, and `process.env` updates as the imperative shell.
- **Regression coverage**: added regex-safe key, trimming, immutability, idempotence, and checked-source assertions; the full suite executed 324 tests with 0 failures.
- **Learning**: not every boundary benefits from currying: a complete content transform is clearer as one data-first call, while the effectful persistence adapter can consume its stable result directly.

### 2026-09-27: Type the Numeric Validation Boundary

- **Finding**: the shared numeric validators already formed a pure curried range algebra, but their parser, input, output, and specialized-validator shapes remained implicit beside the newly checked functional primitive boundary.
- **Correction**: added local `@ts-check` JSDoc contracts for the parser, nullable numeric result, range inputs, and rating/percent/crop validator aliases without changing implementation or exports.
- **Functional boundary**: partial application, parser projection, inclusive range filtering, and null-safe invalid identities remain pure; command decoding and transport effects stay outside the validator module.
- **Regression coverage**: added direct partial-application, boundary, null/undefined, and checked-source assertions; the focused suite executed 322 tests with 0 failures.
- **Learning**: a small validator factory does not need a runtime Result wrapper to become TypeScript-ready; naming its input/output algebra preserves the existing lawful partial function while keeping invalid data inert.

### 2026-09-27: Type the Functional Primitive Boundary

- **Finding**: the shared `server/utils/fn.js` module already supplied Lumina's currying, composition, collection, and closed-interpreter vocabulary, but its public shapes were implicit while neighboring domain modules had entered the checked-contract migration.
- **Correction**: added local `@ts-check` JSDoc contracts for curried primitives, data-last collection combinators, string projections, and declarative interpreter inputs/outputs without changing implementation or exports.
- **Functional boundary**: partial application, `pipe`, null-safe collection identities, and closed-key interpreter behavior remain pure; consumers still choose their effectful shells explicitly.
- **Regression coverage**: added composition, currying, null-safe identity, closed-vocabulary, and checked-source assertions to the existing regression suite.
- **Learning**: the smallest useful TypeScript-readiness step for a functional core is naming its laws-of-use at the module boundary; a runtime wrapper would only obscure the existing abstractions.

### 2026-09-26: Type the Crop-Drag Boundary

- **Finding**: the crop hook mixed deterministic pointer decoding and crop-position math with DOM listeners, React state, timeout coalescing, and photo actions, leaving the preview policy implicit inside an effectful hook.
- **Correction**: extracted `client/src/state/cropDrag.js` as a pure checked projection for touch/mouse coordinates, the existing 180px fallback height, 0.8 sensitivity, rounding, and `[0, 100]` clamp; the hook now delegates only the deterministic calculation while retaining its effect shell.
- **Functional boundary**: malformed coordinates produce a null projection, valid drag input composes through a bounded scalar, and the effect shell remains responsible for event registration, delayed persistence, and transient React state.
- **Regression coverage**: added coordinate-decoder, fallback-height, formula, clamp, malformed-input, and source-contract assertions without changing the crop hook's public return shape or timing behavior.
- **Learning**: a data-first scalar projection is enough to make gesture-driven preview math mechanically type-ready; currying would add ceremony here because the hook supplies one complete drag record per move.

### 2026-09-26: Type the Swipe Gesture Boundary

- **Finding**: the swipe hook mixed deterministic touch-coordinate and threshold classification with action dispatch, status updates, and reset timers, leaving the gesture policy implicit and difficult to check without rendering React.
- **Correction**: extracted `client/src/state/swipeGesture.js` as a pure checked projection for touch coordinates, the strict 50px threshold, direction, and status text; the hook now delegates only the deterministic decision while retaining its effect shell.
- **Functional boundary**: malformed touch inputs produce a null decision, while valid movement composes through a closed direction/status record. Action callbacks and timeout scheduling remain outside the pure module.
- **Regression coverage**: added exact-threshold, next/previous, malformed-coordinate, status, and source-contract assertions without changing the hook's public handlers or status strings.
- **Learning**: a small event decoder plus decision algebra can make gesture behavior mechanically type-ready without introducing a gesture framework or moving browser effects into the functional core.

### 2026-09-26: Type the Shared JSON Transport Boundary

- **Finding**: the shared JSON client already isolated fetch and response interpretation, but its request options, parsed error payload, and generic result were still expressed through inline or misleading `Response` annotations.
- **Correction**: named the `JsonRequestOptions` and `ApiErrorPayload` contracts and changed the generic result vocabulary to `Payload`, preserving request serialization, media-type checks, error projection, and all runtime output.
- **Functional boundary**: payload/error interpretation remains a deterministic contract at the transport edge; browser location, fetch, response parsing, and view-specific state application remain outside pure client state helpers.
- **Regression coverage**: retained media-type and shared read/post transport assertions and added checked-source coverage for the option, error-payload, and payload-result contracts.
- **Learning**: naming the parsed payload rather than calling it a response keeps the API boundary honest and makes a future typed transport conversion mechanical without adding runtime ceremony.

### 2026-09-26: Type the REST-First Mutation-Plan Boundary

- **Finding**: the REST-first request-plan builder was already a pure partial application, but its legacy envelope and input specification remained inline beside the result contract.
- **Correction**: named the `LegacyMutation` and generic `MutationPlanSpec` contracts while preserving the unary plan builder, default identity projections, and runtime output.
- **Functional boundary**: REST body and Socket.IO fallback payloads remain pure projections; fetch, 404 fallback interpretation, and socket emission stay in `luminaClient.js`.
- **Regression coverage**: retained declarative category/screensaver plan assertions and added checked-source coverage for the result, legacy envelope, and generic specification contracts.
- **Learning**: when a request plan is already a lawful partial function from input to a closed result record, naming the input/output algebra is clearer and more TypeScript-ready than wrapping it in another abstraction.

### 2026-09-26: Type the Image Feeds Panel-State Boundary

- **Finding**: the four-panel workspace helper already formed a closed pure state algebra, but its open-map, persisted-preference, and browser-storage shapes were still partly inline and underspecified for the incremental TypeScript pass.
- **Correction**: named the open-state and injected storage reader/writer contracts, while leaving decoded preference ordering unknown-safe and preserving every existing transition, codec, and storage fallback.
- **Functional boundary**: collapse/expand, focus entry/exit, ordering, and JSON preference projection remain immutable pure transformations; React retains document Escape listeners, focus restoration, and browser-storage effects.
- **Regression coverage**: retained panel transition and malformed-storage behavior and added checked-source assertions for the state, preference, and storage contracts.
- **Learning**: a persistence-backed UI algebra can remain compositional when its effect adapter is typed as an injected capability rather than pulled into the pure state model.

### 2026-09-26: Type the Client Action-Plan Boundary

- **Finding**: the partially applied field and widget patch builders were already pure and shared by the action hook, but their result shapes were implicit beside the checked request-plan and snapshot boundaries.
- **Correction**: added client-owned JSDoc aliases for generic durable state patches and nested widget-visibility patches without changing the builders, their data-first composition, or runtime output.
- **Functional boundary**: patch construction remains a pure partial application; API execution, fallback handling, React state application, and Socket.IO compatibility remain in the action shell.
- **Regression coverage**: retained direct patch-shape and undefined-value assertions and added checked-source coverage for both result contracts and builder return types.
- **Learning**: when a pure helper already has the right abstraction, the best TypeScript-readiness step can be naming its output algebra rather than introducing another wrapper or runtime validator.

### 2026-09-26: Type the Google Photos Picker Presentation Boundary

- **Finding**: the Google Photos Picker helper was already a pure visible-status projection, but its copy vocabulary and result shape still used a broad `Object` typedef, leaving the external-source presentation boundary underspecified.
- **Correction**: added client-owned JSDoc contracts for the immutable Picker copy record and credential status result without changing copy, fallback selection, or runtime behavior.
- **Functional boundary**: copy and status projection remain pure data transformations; OAuth initiation, transport, credential persistence, and React effects remain outside the helper.
- **Regression coverage**: retained the setup/ready behavior assertions and added checked-source coverage for both structural contracts and the readonly copy boundary.
- **Learning**: even static UI copy benefits from a named structural contract when it is shared across a pure status projection; the type annotation documents the boundary without introducing runtime validation or ceremony.

### 2026-09-26: Type the Pool Lifecycle View Boundary

- **Finding**: the pool lifecycle presenter was already pure, but its schedule and policy contracts were broad `Object` shapes, leaving the next TypeScript migration seam underspecified.
- **Correction**: added client-owned JSDoc types for schedule inputs, lifecycle policies, summaries, rows, and policy readers without changing the data-first view-model functions or runtime fallbacks.
- **Functional boundary**: schedule formatting and row projection remain pure; persisted policy access, React state, and browser rendering remain outside the helper.
- **Regression coverage**: retained schedule-default and row-shape assertions and added source-contract checks for the checked types and policy-reader boundary.
- **Learning**: a useful checked contract can make an existing functional boundary explicit without introducing runtime validation or a new abstraction layer.

### 2026-09-25: Accumulate Google Photos Picker Sessions

- **Finding**: Picker synchronization treated each completed session as a replaceable working set, so ordinary rows from earlier selections disappeared unless they had been marked loved. This made repeated selection sessions unable to grow the persistent Google Photos pool.
- **Correction**: changed the source-local merge to append/upsert all existing usable cache rows, deduplicate by stable media ID, and let the latest synced representation win for duplicates. Existing rating, crop, pairing, and loved metadata remains authoritative. The shared retention and maximum-photo policy now runs over the accumulated union, while empty or failed sessions preserve the last successful cache.
- **Functional boundary**: `mergeSyncedMediaItems(...)` remains a pure union projection; `syncGoogleAlbum(...)` keeps Picker pagination, persistence, orphan cleanup, and background downloads in the effect shell. Sync telemetry now reports incoming, existing, merged, retained, and policy-dropped counts. No recurring Google Photos fetch was introduced.
- **Regression coverage**: added sequential-session accumulation, duplicate precedence, metadata preservation, retention/loved behavior, post-union 5,000-photo capping, empty/failed sync safety, Google Photos pool-count and active-feed projection, and equal mixed-category interleave assertions.
- **Learning**: lifecycle policy should govern the complete accumulated source collection after ingestion, not define whether an ingestion session replaces that collection. Keeping the union pure makes the durable effect and its failure boundary easy to verify.

### 2026-09-24: Add a Checked Contract to TV Preview Geometry

- **Finding**: the Rating Deck preview fitter was already a pure responsive geometry projection, but its dimension fallback and aspect-ratio result shape were not documented for the TypeScript readiness pass.
- **Correction**: added local `@ts-check` dimension aliases and JSDoc without changing the default frame, invalid-dimension fallback, or contain-style fitting behavior.
- **Functional boundary**: measured dimensions and aspect ratio enter as data; DOM measurement and style application remain in the React shell.
- **Regression coverage**: extended the focused-preview test with fallback identities, invalid viewport handling, and checked-source assertions.
- **Learning**: responsive geometry is a useful typed seam when the browser supplies measurements but the fit calculation itself remains a deterministic pure function.

### 2026-09-24: Add a Checked Contract to Clock Parts

- **Finding**: the clock formatter was already a pure locale-aware projection, but its closed `{ time, period }` result and caller-supplied formatter options were not documented for the TypeScript readiness pass.
- **Correction**: added local `@ts-check` and a named result alias without changing the data-first signature, locale defaults, or period separation.
- **Functional boundary**: `Intl.DateTimeFormat` configuration and value projection remain pure; React rendering and timer effects stay outside the helper.
- **Regression coverage**: added checked-source assertions and a 24-hour options case confirming caller formatter options continue to compose with the helper defaults.
- **Learning**: a small result alias is enough to make a locale-sensitive presentation projection mechanically portable when option composition remains explicit.

### 2026-09-24: Add a Checked Contract to CSS Image Projection

- **Finding**: the shared CSS image helper was already a pure boundary used by TV and remote views, but its unknown-input fallback and string output were not documented for the TypeScript readiness pass.
- **Correction**: added local `@ts-check` and an unknown-safe JSDoc contract without changing CSS quoting, URL encoding, or the empty-input `none` identity.
- **Functional boundary**: value normalization remains pure; React style application and browser rendering stay outside the helper.
- **Regression coverage**: added checked-source assertions plus null and blank-input identity checks alongside the existing encoding cases.
- **Learning**: tiny presentation codecs are useful migration seams when their fallback identity and escaping policy are explicit without introducing runtime validation ceremony.

### 2026-09-24: Add a Checked Contract to Credential Save Status

- **Finding**: the remote credential acknowledgement projection was already a small pure boundary, but its success/error result shape was the remaining unchecked seam beside the normalized job and snapshot projections.
- **Correction**: added local `@ts-check` and a named status alias, keeping unknown acknowledgements inert while preserving the existing boolean success semantics.
- **Functional boundary**: response interpretation remains pure; Socket.IO event names, React target selection, and successful-input clearing remain in the imperative effect shell.
- **Regression coverage**: added unknown-value and checked-source assertions alongside the existing success/error projection tests.
- **Learning**: a closed status result alias documents a tiny acknowledgement algebra without moving transport policy or runtime validation into the functional core.

### 2026-09-06: Deduplicate Google Photos Cache Rows by Media ID

- **Finding**: repeated Google Photos selections normally reused an existing row, but duplicate IDs in one Picker response or legacy cache could still be written more than once.
- **Correction**: added a source-local first-occurrence deduplication boundary keyed by the stable Google media item ID before cache persistence and while merging Picker selections with loved rows.
- **Regression coverage**: verified first-row metadata preservation and duplicate removal across both incoming selections and existing cached rows.

### 2026-09-06: Add Google Photos Pool Lifecycle Controls

- **Finding**: Google Photos was intentionally filtered out of the Pool Lifecycle rows, and its external cache was not accepted by the pool-policy route or constrained by the saved policy.
- **Correction**: included Google Photos in the lifecycle editor, allowed its policy-only pool patch, and applied retention plus maximum-photo projection to the external cache and active feed.
- **Functional boundary**: shared policy projection preserves loved photos and undated legacy rows; newly synced Google items receive an acquisition timestamp so retention days have deterministic semantics.
- **Regression coverage**: covered the Google lifecycle row, REST policy route, policy cap/retention behavior, and updated Picker copy contracts.

### 2026-09-05: Add a Checked Contract to Keyword Input Parsing

- **Finding**: the Image Feeds keyword parser was already a pure compatibility boundary, but its pasted-input and timed-parameter output shapes were undocumented for the TypeScript readiness pass.
- **Correction**: added local `@ts-check` aliases and JSDoc for unknown-safe phrase splitting and timed-or-untimed feed parameters without changing the data-first parser signatures or exact keyword text.
- **Functional boundary**: separator splitting, regex matching, trimming, and empty-list fallbacks remain pure; browser input events, validation policy, and persistence stay outside the module.
- **Regression coverage**: added malformed-input identity checks and checked-source assertions alongside the existing multiline/comma/semicolon compatibility cases.
- **Learning**: a small union output contract makes a form parser mechanically portable while preserving the useful distinction between timed records and untimed phrases.

### 2026-09-05: Add a Checked Contract to Pool Policy Drafts

- **Finding**: the Image Feeds lifecycle editor already used pure policy defaults and a partially applied draft merge, but its normalized policy shape and form-string inputs were undocumented at the TypeScript migration boundary.
- **Correction**: added local `@ts-check` structural aliases and JSDoc for policy defaults, nested schedules, draft readers, and immutable field merges; the existing data-first signatures remain compatible.
- **Functional boundary**: policy completion and draft projection remain pure and non-mutating, with one captured reader per merge factory; HTML input coercion and save effects remain in the React shell.
- **Regression coverage**: added nested-default, form-string, curried-reuse, immutability, and checked-source assertions; the standard project gates follow this entry.
- **Learning**: a small typed vocabulary can describe a form-backed state algebra without forcing validation or coercion into the functional core; preserving the no-mutation law keeps draft edits predictable.

### 2026-09-02: Add a Checked Contract to Screensaver Activity

- **Finding**: the Dashboard's Escape and activity classifier was already a pure safety boundary, but its browser-facing event shape and active-state gating were undocumented at the TypeScript migration boundary.
- **Correction**: added local `@ts-check` structural aliases and JSDoc for keyboard activity and dismissal input without changing the event vocabulary, Escape semantics, or inactive-screen behavior.
- **Functional boundary**: event records are projected to a boolean decision through a pure predicate; browser listeners, REST dismissal requests, and lifecycle effects remain outside the module.
- **Regression coverage**: added active/inactive, null, unknown-event, and source-contract assertions in `run-tests.js`.
- **Learning**: safety-sensitive client predicates are strong migration anchors when the accepted event shape and no-op law are explicit without introducing runtime event-class validation.

### 2026-08-30: Add a Checked Contract to Photo-Crop Scalars

- **Finding**: the shared photo-crop helper was already a pure boundary used by the remote, direct-control, and image-feed views, but its display-mode and numeric contracts were undocumented.
- **Correction**: added local `@ts-check` aliases and JSDoc for the contain/cover baseline and crop-blend helpers without changing their data-first signatures, formulas, or absent-mode cover fallback.
- **Functional boundary**: crop defaults and interpolation remain pure scalar projections; React preview geometry and input effects stay outside the module.
- **Regression coverage**: added direct baseline/blend assertions, malformed-scale fallback checks, and checked-source assertions in `run-tests.js`.
- **Learning**: the most useful TypeScript migration seams can be very small: explicit scalar contracts make shared presentation math mechanically portable without adding runtime validation or a generic abstraction.

### 2026-08-30: Hold Wallpaper Changes During Network Media Failures

- **Finding**: transient DNS/network failures caused the detached preload and the rendered split-slide image handlers to report the same visible URL as broken. The server then advanced the active photo repeatedly, making wallpapers appear to change every second or so even though the configured slideshow interval was two minutes.
- **Correction**: made the native-image preload the sole media validation path, removed the duplicate hidden image requests, and added a deterministic 1s/2s/4s/8s retry schedule. After retries, the client probes the image origin: an unreachable host holds the current slide, while a reachable host permits one confirmed-broken skip.
- **Functional boundary**: `client/src/state/mediaRecovery.js` contains the pure retry/hold/skip decision and origin projection. The Dashboard retains only browser effects—fetch, abort timeout, timer waiting, logging, and Socket.IO reporting—at the imperative edge.
- **Regression coverage**: added direct policy and URL-projection tests plus a Dashboard source contract asserting the origin probe and absence of the former hidden-image error path. The full suite and lint gates pass with the existing warnings only.
- **Learning**: when a browser requests the same media through multiple validation paths, an ordinary network outage can be misclassified as a bad URL. One authoritative loader plus host-aware bounded recovery preserves the visible frame and avoids destructive state changes during infrastructure failure.

### 2026-08-29: Add a Checked Contract to Environment Presentation

- **Finding**: TV and remote views shared pure environment metric, conversion, timestamp, and status helpers, but their accepted values and returned status vocabulary were undocumented at the TypeScript migration boundary.
- **Correction**: added local `@ts-check` contracts for the structural environment status snapshot, scalar conversion inputs, formatted values, and shared status result without changing settings or transport behavior.
- **Functional boundary**: scalar conversions and status projection remain pure; malformed readings produce safe display fallbacks, while adapter-specific payloads and React effects stay outside the module.
- **Regression coverage**: added conversion, invalid-reading, timestamp-fallback, and checked-source assertions; the standard project gates follow this entry.
- **Learning**: shared presentation helpers are useful migration anchors when their input vocabulary is explicit but their adapter payload remains intentionally opaque.

### 2026-08-29: Add a Checked Contract to Feed Mutations

- **Finding**: the pure category and feed-source snapshot projections already preserved immutable canonical and legacy aliases, but their snapshot and edit inputs were undocumented at the TypeScript migration boundary.
- **Correction**: added local `@ts-check` structural aliases and unknown-safe contracts to `applyCategorySelection(...)` and `applyFeedSourceConfigPatch(...)`; the existing data-first signatures and normalization behavior remain unchanged.
- **Functional boundary**: the helpers project values through pure immutable transforms, while malformed edit inputs return the original snapshot by identity. React state application and API effects remain outside the module.
- **Regression coverage**: added checked-source assertions, source immutability checks, and invalid-input identity checks; the standard project gates follow this entry.
- **Learning**: TypeScript readiness is clearest when the functional core names both its accepted compatibility shape and its no-op identity law without introducing runtime ceremony.

### 2026-08-29: Add a Checked Contract to Job Status Projections

- **Finding**: the shared job-status algebra already unified recrawl and vision-analysis acknowledgements, but its server envelopes and legacy completion shape were undocumented and unchecked.
- **Correction**: added local `@ts-check` structural aliases for supported job types, status updates, modern job events, and legacy recrawl completions. The existing projection functions and event names remain unchanged.
- **Functional boundary**: payloads enter as unknown at the pure event boundary, compatibility is projected into one status algebra, and React target selection plus reset effects remain outside the module.
- **Regression coverage**: added checked-source assertions plus queued fallback and null-envelope behavior assertions; the full suite remains the compatibility gate.
- **Learning**: a closed event vocabulary can be made TypeScript-ready without forcing transport validation or UI policy into the pure projection layer.

### 2026-08-29: Add a Checked Contract to Category Selection

- **Finding**: the pure category-selection module was shared by frame normalization, feed mutations, and both operator views, but its snapshot fallback and toggle inputs were undocumented and unchecked.
- **Correction**: added local `@ts-check` structural aliases plus unknown-safe JSDoc contracts for canonical alias normalization, composed selection serialization, snapshot fallback lookup, membership checks, and immutable toggles.
- **Functional boundary**: the existing category-first/data-second interface and `pipe(splitCategories, compactStrings, unique)` normalization remain unchanged; annotations describe the pure algebra without adding runtime validation or cross-layer imports.
- **Regression coverage**: added checked-source assertions and direct alias/immutability assertions; the full suite passed with no failures.
- **Learning**: a stable type boundary can grow from the smallest shared vocabulary outward, preserving compatibility while making later TypeScript conversion mechanical.

### 2026-08-29: Add a Checked Contract to the Client Frame Boundary

- **Finding**: the pure snapshot/frame selector module was already the stable client boundary for REST responses, live sync, paired photos, and crop presentation, but it had no explicit JSDoc contract or `@ts-check` coverage.
- **Correction**: added local structural types for client photos, current frames, snapshots, photo-event envelopes, and crop selectors. The types remain browser-owned instead of importing server domain modules, keeping a future TypeScript conversion layer-independent.
- **Functional boundary**: normalization, event projection, and selector functions remain pure; the new annotations describe their existing data-in/data-out contract without adding runtime validation or transport behavior.
- **Regression coverage**: added a source contract asserting the checked module and its snapshot/event aliases; the full test suite and lint passed.
- **Learning**: TypeScript readiness starts with stable shapes at effect boundaries. A small local contract is more useful than a cross-layer type dependency when a client shape intentionally accepts legacy aliases.

### 2026-08-29: Close the Step 5 Live-Sync Audit

- **Finding**: after the paired photo-event boundary was normalized, all remaining client Socket.IO listeners had distinct policies: connection lifecycle, canonical snapshots, telemetry, credential acknowledgements, or job status.
- **Decision**: close implementation companion Step 5 and carry the roadmap to Step 6, with no generic live-sync framework added for the remaining policy-specific effects.
- **Functional boundary**: repeated event vocabularies use pure projections and declarative subscriptions; transport effects and view-specific state application remain explicit at the edge.
- **Verification**: the full regression suite, lint, client build, served-bundle check, and diff validation passed during the completed Step 5 slices.
- **Learning**: a functional refactor is complete when the remaining imperative code expresses distinct policy clearly, not when every effect has been forced through one abstraction.

### 2026-08-29: Normalize Paired Photo Acknowledgements

- **Finding**: `App.jsx` registered primary and secondary photo-update events with duplicated listener logic whose only difference was the target frame side.
- **Correction**: extracted pure `projectPhotoEvent(...)` and registered both wire events through one declarative subscription table before applying the existing immutable snapshot transform.
- **Functional boundary**: event-to-side compatibility remains pure; React state application, Socket.IO registration, and cleanup remain the effect shell.
- **Regression coverage**: added direct projection assertions and a source contract proving the paired events use one handler table.
- **Learning**: a small event vocabulary can remove transport ceremony while leaving the actual multi-frame state policy visible at the application boundary.

### 2026-08-29: Normalize Modern and Legacy Job Acknowledgements

- **Finding**: `RemoteControl.jsx` applied the same recrawl status policy separately for modern `job-status` events and legacy `recrawl-complete` acknowledgements.
- **Correction**: extracted pure `projectJobEvent(...)` to adapt both envelopes to the existing `projectJobStatus(...)` algebra, then registered both event names through one declarative listener table and application path.
- **Functional boundary**: event-envelope compatibility and status derivation remain pure; React target selection, state setters, Socket.IO registration, and transient reset timers remain the imperative shell.
- **Regression coverage**: added direct assertions for modern running events, legacy successful and failed completions, and unknown event identity.
- **Learning**: compatibility events can share a functional status algebra without flattening the distinct view targets or transport effects that still belong at the edge.

### 2026-08-29: Share Remote Credential Acknowledgement Projection

- **Finding**: `RemoteControl.jsx` had two credential-save Socket.IO handlers with identical success/error status policy and transient reset timing.
- **Correction**: extracted pure `projectCredentialSaveStatus(...)` and applied it through one declarative subscription table. Credential event names and input setters remain explicit because they are transport and view-specific.
- **Functional boundary**: the projection returns only the status algebra and whether the corresponding input should clear; React setters, Socket.IO registration, and timeout scheduling remain the imperative shell.
- **Regression coverage**: added direct pure-function assertions for success, failure, malformed, and null acknowledgements; the full suite passed with no failures.
- **Learning**: small live-status acknowledgements benefit from the same functional-core boundary as snapshots, while source-specific UI effects should stay visible at the edge.

### 2026-08-28: Keep Dashboard Live Sync on the Canonical State Path

- **Finding**: `Dashboard.jsx` subscribed directly to raw `state-sync` only to mirror `screensaverActive`, duplicating the normalized subscription already owned by `App.jsx`.
- **Correction**: removed the view-level Socket.IO listener and derived particle lifecycle from the canonical `state.screensaverActive` prop. The local dismissal-pending ref remains because it represents an in-flight UI effect, not synchronized domain state.
- **Functional boundary**: `App.jsx` is the live snapshot effect shell; `frameSelectors.js` remains the pure compatibility projection; Dashboard keeps only presentation effects and its local transient request guard.
- **Regression coverage**: added a source contract asserting that Dashboard has no raw `state-sync` subscription and that its particle effect depends on canonical screensaver state.
- **Learning**: once a parent owns transport normalization, child views should consume the projected state rather than re-subscribing to the wire; local optimistic guards are appropriate only for transient effect coordination.

### 2026-08-28: Align the Initial Snapshot Read with the JSON Boundary

- **Finding**: `getStateSnapshot()` was the remaining client read that called the permissive `requestJson(...)` primitive directly, while dashboard and environment reads used strict `readJson(...)` media-type validation.
- **Correction**: routed the initial `/api/state` read through `readJson(...)`, preserving the transport shell while making non-JSON fallback responses fail before they can be applied as client state.
- **Functional boundary**: no new framework was needed; the API wrapper selects the existing strict read effect, and snapshot normalization remains a pure state projection.
- **Regression coverage**: added a client test proving an HTML response is rejected for the initial state read with the shared `JSON API unavailable` contract.
- **Learning**: a shared transport abstraction is only a real boundary when every entry point uses its strict contract; a single permissive outlier can still reintroduce the failure mode the abstraction was meant to remove.

### 2026-08-28: Share the Client Snapshot Response Boundary

- **Review finding**: `useLuminaActions` separately normalized direct REST reads and unwrapped mutation responses, while `App.jsx` normalized live `state-sync` payloads at a different call site. The compatibility rule was small but repeated at the client transport/state boundary.
- **Correction**: added pure `normalizeSnapshotResponse(...)` beside the existing snapshot normalization. It accepts either a direct snapshot or the durable mutation `{ state: snapshot }` envelope, then projects both through the same canonical frame/category normalization.
- **Functional boundary**: `frameSelectors.js` owns compatibility shaping; `useLuminaActions` and the app-level Socket.IO listener remain explicit effect shells that only apply the normalized value. No generic response framework or view-specific presentation was introduced.
- **Regression coverage**: direct and enveloped snapshots are asserted to produce the same normalized value, source snapshots remain unchanged, and null/undefined inputs retain their identity behavior.
- **Learning**: when several transports carry one domain snapshot with a transitional envelope, a small pure projection is a better compatibility seam than repeating `state || response` at every effect boundary.

### 2026-08-26: Give Image Feed Panel Ordering Controls Their Own Responsive Lane

- **Review finding**: at tablet-sized desktop widths, the two-column workspace compressed Scenic Feed Source Manager to roughly one narrow source-card column. Its labeled Move earlier/later controls then sat too close to the title-row Expand and Focus actions, making the panel feel crowded even when the boxes did not geometrically intersect.
- **Correction**: the workspace now switches to one column through 959px, giving the Source Manager and its two-column source grid enough room before the mobile breakpoint. The order toolbar also has its own top border and vertical rhythm instead of being pulled toward the header with a negative margin.
- **Functional boundary**: no panel state or event changes were needed. CSS remains the declarative interpreter of responsive geometry; the pure order transitions and accessible button contract are unchanged.
- **Regression coverage**: source-level CSS assertions pin the dedicated order-toolbar separation and the 959px single-column contract. Served Playwright checks should continue to cover desktop, tablet, and 390px mobile widths for no overlap and no horizontal overflow.
- **Learning**: responsive breakpoints should be chosen from the minimum comfortable control/content width, not only from the point where a layout technically overflows. A distinct visual lane also makes related but different actions easier to scan.

### 2026-08-26: Make Rating Deck Focus Mode Fill the Preview Surface

- **Review finding**: Focus mode enlarged the panel shell but left the Rating Deck preview constrained to its original 334×180 frame, creating empty space around the primary image-review task.
- **Correction**: the preview slot now uses the active TV aspect ratio as a responsive surface. Normal mode caps the surface at 320px high; focused mode grows it up to `min(58vh, 560px)`, so the pure `fitTvPreviewFrame(...)` projection receives the expanded bounds and enlarges the actual frame.
- **Responsive contract**: the slot remeasures after focus transitions and remains width-constrained on narrow screens. The mobile rating scale uses a five-by-two grid with 44px minimum button dimensions rather than forcing a desktop-width minimum-content row.
- **Learning**: a focus state is only meaningful when the primary content—not merely its containing card—gets the visual emphasis. Review the measured child geometry in every presentation mode, then let the pure frame-fit helper derive the final media dimensions.
- **Regression coverage**: added pure focused-versus-normal frame-fit assertions, source/CSS contracts for the responsive preview slot, and live Playwright measurements at desktop and 390px widths.

### 2026-08-26: Contain Rating Deck Geometry After Focus Exit

- **Bug**: leaving Rating Deck Focus mode could leave one render with the focused frame width. That stale child width enlarged the normal preview slot and let the image extend into the neighboring panel.
- **Correction**: the Rating Deck content wrapper now has an explicit `width: 100%`, `min-width: 0`, and `max-width: 100%` contract. The preview frame independently clamps to its slot with `max-width` and `max-height: 100%`, allowing the existing focus-triggered remeasurement to converge to the normal 414×233 frame.
- **Functional boundary**: no new runtime state or imperative resize correction was added. CSS expresses containment; the existing pure `fitTvPreviewFrame(...)` projection continues to derive frame geometry from measured bounds.
- **Regression coverage**: source assertions cover both containment layers, and served Playwright verification covers focused 928×522 to normal 414×233 return geometry, panel containment, and zero horizontal overflow.
- **Learning**: responsive focus layouts need bounded ancestors as well as bounded media. Otherwise stale inline geometry can become the next measurement’s input and create a self-reinforcing layout drift.

### 2026-08-26: Make Image Feeds a Four-Panel Accessible Workspace

- **Goal**: Treat the four operator areas as first-class workspace panels while keeping Pool Lifecycle as a separate nested progressive-disclosure layer.
- **Implementation**:
  - Expanded `imageFeedsPanels.js` to a closed vocabulary of Curated Scenic Categories, Independent Rating Deck, Scenic Feed Source Manager, and Google Photos Picker.
  - Added pure immutable collapse/expand, transient focus, Escape exit, invalid-identifier no-ops, normalized ordering, and earlier/later transitions.
  - Added a pure preference codec and injected browser-storage adapter. Open preferences and order persist; focused mode never does.
  - Reused one panel shell with status summaries, accessible disclosure/focus/order labels, `aria-expanded`, `aria-controls`, `aria-pressed`, visible focus styling, and an always-visible Show all panels action while focused.
  - Added document-level Escape handling only in focus mode and restored focus to the initiating control.
  - Made Categories span the desktop workspace, kept Rating Deck and Source Manager in the primary two-column area, placed Google Photos below, and collapsed all controls to a single narrow-screen column with 44px touch targets.
- **Functional boundary**: Panel transitions, order normalization, and storage interpretation remain pure. React owns only browser effects and focus restoration; CSS owns layout. Pool Lifecycle stays native `<details>/<summary>` inside Categories rather than adding a competing accordion layer.
- **Accessibility and interaction decision**: Keyboard order controls satisfy the initial accessible reordering contract. Pointer drag handles remain deferred because the Rating Deck's crop gesture needs an isolated, non-conflicting pointer surface; the Carbon, GOV.UK, and Material expansion-panel guidance informed the concise-summary and progressive-disclosure treatment: [GOV.UK Accordion guidance](https://design-system.service.gov.uk/components/accordion/), [Carbon Accordion guidance](https://carbondesignsystem.com/components/accordion/usage/), [Material expansion-panel guidance](https://m1.material.io/components/expansion-panels.html).
- **Regression coverage**: Pure tests cover all four IDs, immutable transitions, focus invariants, invalid IDs, ordering boundaries, malformed/partial/legacy storage values, and the no-focus persistence invariant. Source assertions cover accessible controls and document Escape wiring. Playwright verified all four focus/restore cycles, Escape focus restoration, collapse/expand, keyboard ordering, and 390px no-overflow/44px controls.
- **Verification**: `npm test` passes with 275 assertions; client production build succeeds; lint remains at the three pre-existing warnings; live service served the new bundle. Diagnostics report Chromium/Wayland/PulseAudio available, no active kiosk, and Mutter DBus unavailable in the non-GNOME/restricted session.

### 2026-08-26: Rubber-Duck the Image Feeds Workspace for Visual Hierarchy

- **Review finding**: the first four-panel pass still let the long Source Manager stretch the Rating Deck to the same grid-row height, leaving a large dead area. Its title row also carried too many controls, and category tiles used a faux button containing a real delete button.
- **Correction**: aligned the workspace grid to the start, moved labeled panel-order actions into their own toolbar, kept only disclosure/focus icons in the title row, raised panel metadata legibility, and gave category selection a real button sibling to deletion. Pool creation labels, removable keyword controls, rating pressed states, and mobile rating touch targets now have explicit accessible contracts.
- **Learning**: a visually consistent shell is not enough when grid stretch, control density, and nested interactive semantics undermine the primary task. Review the rendered proportions and keyboard surface together; the Rating Deck should size to its work, while the Source Manager is allowed to be long.
- **Verification**: served Playwright checks report Rating Deck 588px versus Source Manager 957px, all four panel focus/Escape cycles restore correctly, category rows contain no nested buttons, and the 390px viewport has no overflow with 44px rating and panel controls. `npm test` remains at 275 assertions with 11/11 sensor tests; build and lint pass with the three pre-existing warnings.

### 2026-08-26: Extend Default Day Hours to 9 AM – 6 PM for Environment Stats

- **Goal**: Update the day and night hour designations for environmental stats queries and Grafana panels to 9am till 6pm.
- **Implementation**:
  - Updated `server/services/sensorHistory.js` to default `dayStart = 9` (09:00) and `dayEnd = 18` (18:00) with matching integer clamping fallbacks.
  - Day hours are designated as `[09:00, 18:00)` (hours 9–17) and Night hours as `[18:00, 09:00)` (hours 18–8).
  - Updated `run-tests.js` test assertions to verify default and invalid-option fallback behavior for `day_start: 9` and `day_end: 18`.
- **Learning**: Explicit default parameters in SQLite aggregation helpers ensure that both parameterized Grafana queries and raw API consumers stay synchronized.
- **Verification**: `npm test` passed with 306/306 assertions and 11/11 sensor adapter tests. `lumina.service` restarted cleanly and live queries via the loopback relay confirmed `day_start: 9` and `day_end: 18`.

### 2026-08-21: Make Socket Command Selection Explicit

- **Goal**: Continue implementation-companion Step 4 by removing command-runner selection from the Socket.IO listener's async shell.
- **Implementation**:
  - Added a pure `createCommandRunner(...)` factory that gives shared domain dispatch precedence over the mixed-version legacy fallback.
  - Preserved fallback `(command, payload)` forwarding and the silent no-handler identity.
  - Added focused coverage for all three runner states.
- **Learning**: A small higher-order runner makes the command pipeline read as `decode -> intercept -> run -> afterDispatch` while keeping transport-specific fallback policy outside the domain command itself.
- **Verification**: Targeted `node run-tests.js` passed with 268 tests, 266 assertions, and zero failures; the known sandbox-only temporary Unix-socket smoke test skipped on `listen EPERM`.

### 2026-08-19: Make TV screensaver dismissal an explicit safety path

- **Incident**: The kiosk page received mouse and keyboard events but only
  cleared an unused browser-local inactivity timer. It had no Escape handler
  and did not request the daemon to dismiss the kiosk, so a stale or unavailable
  Mutter idle reading could leave the computer visually hijacked.
- **Implementation**:
  - Added a TV-side activity boundary that dismisses through
    `POST /api/state/screensaver` for Escape, keyboard, mouse, scroll, and touch
    activity, with the legacy Socket.IO fallback retained for mixed-version
    clients.
  - Added an idle-daemon activity latch so a dismissal cannot be immediately
    undone by the same stale idle reading; normal relaunch resumes only after
    the host reports a non-idle reading.
  - Kept the dismissal request single-flight and restore the local state if the
    server request fails.
- **Learning**: A screensaver must have an explicit client-to-daemon wake path;
  OS idle polling is useful for automatic launch but is not a sufficient safety
  boundary for user-controlled dismissal.
- **Verification**: Added regression coverage for Escape/input activity and
  stale-idle relaunch suppression. `npm test` passed with 258 assertions and
  11/11 sensor checks; lint and the client build passed; the live REST off-path
  dismissed Chromium normally, and the final served bundle contains the Escape
  and screensaver-off code. The live service remains active with zero restarts.

### 2026-08-18: Share the Socket Async Error Boundary

- **Goal**: Continue implementation-companion Step 4 by removing duplicate
  async error-boundary ceremony from Socket.IO command and transport listeners.
- **Implementation**:
  - Added `runWithErrorBoundary(...)` as the shared imperative-shell runner.
  - Kept command decoding outside the boundary, preserving invalid-command
    no-ops and the command-specific `(error, command, payload)` context.
  - Preserved telemetry and Google Photos refresh acknowledgement behavior,
    with regression coverage for refresh failures.
- **Learning**: A small effect-shell abstraction is useful when the error
  policy is identical but each adapter still owns its own context projection.
- **Verification**: `npm test` passed with 256 tests, 254 assertions, and
  11/11 sensor checks. The known sandbox-only live Unix-socket smoke test
  skipped on `listen EPERM`.

### 2026-08-18: Share the Google Photos OAuth Async Boundary

- **Goal**: Continue implementation-companion Step 4 by removing duplicate
  hand-written async error handling from the production and sandbox OAuth
  callback routes.
- **Implementation**:
  - Added a small higher-order `createGoogleAuthRoute(...)` adapter that
    centralizes callback error logging, status, and text projection.
  - Kept authorization-code validation, picker-session polling, sandbox sync,
    redirect targets, and route-specific failure messages explicit.
  - Added regression coverage for sandbox success, callback failure, and the
    production callback's missing-code response.
- **Learning**: A shared async boundary is valuable when it removes identical
  error interpretation while leaving materially different success workflows
  visible at the route edge.
- **Verification**: `npm test` passed with 255 tests, 253 assertions, and
  11/11 sensor checks. The known sandbox-only live Unix-socket smoke test
  skipped on `listen EPERM`.

### 2026-08-18: Share the Google Photos Media Async Boundary

- **Goal**: Continue implementation-companion Step 4 by removing the remaining
  hand-written async error shell from the Google Photos binary media proxy.
- **Implementation**:
  - Reused `createAsyncRoute(...)` for the media proxy while keeping content
    headers, dimension normalization, cropping, and binary response projection
    explicit at the route boundary.
  - Preserved the existing 502 public error contract for media fetch failures.
  - Added regression coverage for normalized media options, binary response
    bytes, and the shared failure projection.
- **Learning**: The shared async boundary remains useful beyond JSON routes when
  the route's response representation is explicit and only error interpretation
  is genuinely repeated.
- **Verification**: `npm test` passed with 254 tests, 252 assertions, and
  11/11 sensor checks. The known sandbox-only live Unix-socket smoke test
  skipped on `listen EPERM`.

### 2026-08-18: Share the Environment Settings Async Boundary

- **Goal**: Continue implementation-companion Step 4 by removing the remaining
  hand-written async error shell from environment-settings persistence.
- **Implementation**:
  - Added a pure validation hook to `createAsyncJsonRoute(...)`, keeping the
    route flow readable as `resolve -> validate -> project`.
  - Routed `POST /api/environment/settings` through the shared boundary while
    preserving its 400 invalid-settings and 500 service-failure contracts.
  - Added regression coverage for valid, invalid, and thrown update-service
    outcomes.
- **Learning**: A validation hook is a useful extension when it preserves the
  route's local policy as data; it avoids duplicating `try/catch` without
  turning endpoint-specific validation into a generic framework.
- **Verification**: `npm test` passed with 251 tests, 249 assertions, and
  11/11 sensor checks. The known sandbox-only live Unix-socket smoke test
  skipped on `listen EPERM`.

### 2026-08-18: Share the Weather Read Route Boundary

- **Goal**: Continue implementation-companion Step 4 by removing the remaining
  inline async JSON/error handling from the weather read route.
- **Implementation**:
  - Reused `createAsyncJsonRoute(...)` for `GET /api/weather`, preserving its
    cached-read short circuit and persistence of freshly resolved weather.
  - Added injected location/forecast adapters so route behavior is deterministic
    in tests without making the functional core depend on network calls.
  - Extracted pure `buildWeatherResponse(...)` projection and kept the response
    contract limited to location, current conditions, and daily forecast.
- **Verification**: `npm test` passed with 250 tests, 248 assertions, and 11/11
  sensor checks. `npm run lint` passed with three pre-existing warnings, and
  `git diff --check` passed; the known sandbox-only live Unix-socket smoke test
  skipped on `listen EPERM`.
- **Learning**: A shared async boundary is useful when the route-specific cache
  and persistence policy can remain in a small resolver while response shaping
  stays a pure, independently testable projection.

### 2026-08-18: Share the Environment Read Route Boundary

- **Goal**: Continue implementation-companion Step 4 by removing repeated
  async JSON/error handling from the environment read routes.
- **Implementation**:
  - Extended the existing async route shell with an injectable error presenter.
  - Added `createAsyncJsonRoute(...)`, a small higher-order adapter that keeps
    response projection and failure policy at each route registration.
  - Reused it for current environment, history, and history-statistics reads
    without changing their response shapes or 503 contracts.
  - Added direct route-handler coverage for all three endpoint-specific errors.
- **Learning**: The useful abstraction was the shared effect boundary around
  async JSON responses; endpoint-specific data shaping remains visible and
  composable instead of being hidden behind a generic environment framework.
- **Verification**: `npm test` passed with 247 tests, 245 assertions, and 11/11
  sensor checks. `npm run lint` passed with three pre-existing warnings, and
  `git diff --check` passed; the known sandbox-only live Unix-socket smoke test
  skipped on `listen EPERM`.

### 2026-08-18: Make Patch-State Spec Application Pure

- **Goal**: Continue implementation-companion Step 4 by removing mutation from
  the declarative `patch-state` spec interpreter itself.
- **Implementation**:
  - Changed patch writers to return immutable next-state values instead of
    mutating the cloned state in place.
  - Changed patch flag accumulation to return a new context, preserving the
    existing short-circuit/no-op identity and recompute/weather-refresh policy.
  - Added a regression proving composed theme, widget, and location patches do
    not mutate the source snapshot or reuse nested config references.
- **Learning**: A declarative spec table becomes easier to reason about when
  both its value writers and its context accumulator are pure; the reducer can
  still keep its explicit clone boundary without making each row imperative.
- **Verification**: `npm test` passed with 246 tests, 244 assertions, and 11/11
  sensor checks. `npm run lint` passed with three pre-existing warnings, and
  `git diff --check` passed; the known sandbox-only live Unix-socket smoke test
  skipped on `listen EPERM`.

### 2026-08-18: Scheduled Pool Activation

- **Goal**: Let a pool such as “Night Mood” become the active display feed
  automatically during a recurring daily time window.
- **Implementation**:
  - Extended normalized `poolPolicies` with an optional disabled-by-default
    schedule containing `enabled`, `start`, `end`, and `priority`.
  - Added the pure `poolSchedule` evaluator for host-local daily windows,
    overnight ranges, deterministic priority resolution, and a small runtime
    that applies activation through the existing `select-categories` command.
  - Added manual-override handling that leaves a user-selected category alone
    until the next schedule boundary, then restores the prior baseline.
  - Added Image Feeds controls for enablement, start/end times, and priority;
    schedule settings persist through the existing pool REST policy path.
- **Verification**: `npm test` passed 245 assertions plus 11/11 sensor-adapter
  checks. The live-server smoke portion still reports the known sandbox
  `listen EPERM` restriction; it is not a product failure.
- **Learning**: Scheduling belongs beside pool policy persistence, while the
  actual activation should remain an ordinary category command so REST,
  Socket.IO, manual controls, and scheduled changes share one state boundary.

### 2026-08-16: Share Feed Recompute and Active-Photo Recovery

- **Goal**: Continue the selective Phase 1 companion Step 4 cleanup by removing the duplicated `recompute feed -> ensure active photo` continuation from feed mutations and `patch-state`.
- **Implementation**: Added the pure `recomputeAndEnsureActivePhoto(...)` boundary and reused it from both mutation paths. Patch-specific recompute flags, weather-refresh effects, direction, and result assembly remain explicit at their callers.
- **Verification**: Added a domain regression proving feed exclusion updates and equivalent state patches recover the same active photo and emit the same photo-update/state-sync event contract. `npm test` passed 240 assertions plus 11/11 sensor-adapter checks; `npm run lint` passed with three pre-existing warnings; `git diff --check` passed.
- **Learning**: A shared continuation is useful when two mutation families perform the same pure selector pipeline but still need different policy around whether that pipeline runs and which effects follow it.

### 2026-08-08: Isolated Clock AM/PM Tracking From Large Digits

- **Goal**: Fix the `m` in the AM/PM period appearing partially cut off on the TV clock despite the existing glass-container padding fix.
- **Implementation**:
  - Added the pure `formatClockParts` helper, which uses `Intl.DateTimeFormat.formatToParts` to keep numeric time and the day period separate across locale punctuation and whitespace.
  - Added a dedicated `.clock-period` layout contract that resets inherited negative digit tracking, keeps the period as a non-shrinking inline box, and adds a small right-side glyph buffer.
- **Verification**: Added deterministic AM/PM regression assertions; browser reproduction confirmed the inherited `-3.84px` tracking was the clipping source.

### 2026-08-07: Normalize Montreal Pool Keyword Entries

- **Goal**: Restore the Montreal pool's one-phrase-per-query configuration after its keyword list had been persisted as one concatenated entry.
- **Implementation**: Repaired the live pool through the REST patch path, updating both `searchKeywords` and the existing keyword-based `feedConfigs` sources while preserving source enablement.
- **Verification**: Confirmed all 25 supplied phrases are separate entries in the persisted snapshot and in `unsplash`, `wallhaven`, `metmuseum`, and `artic` source configurations.
- **Learning**: Pool keyword repairs must update both configuration layers because an existing `feedConfigs` map takes precedence over rebuilding source queries from `searchKeywords`.

### 2026-08-02: Reuse the Pool Presence Guard on the Photo Read Route

- **Goal**: Finish the current Step 4 route-guard seam by removing the last inline pool-existence failure branch.
- **Implementation**: Routed `GET /api/pools/:name/photos` through the existing pure `createPresenceGuard` boundary; successful responses still return the collection unchanged.
- **Verification**: Added regressions for existing and missing pools so the shared 404 contract is explicit.
- **Learning**: A small guard algebra pays off when it spans both command and read routes, provided response shaping remains local to each route.

### 2026-08-02: Share Short-Circuit Route Reduction

- **Goal**: Continue the selective Phase 1 companion Step 4 cleanup by removing duplicated early-exit reduction ceremony at the route-decode and route-guard boundaries.
- **Implementation**: Added a curried, data-last `reduceUntil` helper. Route-decode collection uses it to preserve the empty-success identity and first decode failure; route guards use the same boundary while retaining their pool/photo-specific predicates and failure policies.
- **Verification**: Added coverage for partial application, first-match short-circuiting, input non-mutation, and empty/null identities. The full regression and lint gates remain the completion checks for this slice.
- **Learning**: A tiny lawful-looking reduction boundary is worthwhile when the stopping condition is explicit and two callers share the same accumulation contract; it is not worthwhile to hide the domain-specific step functions behind a generic route framework.

### 2026-08-01: Share Reducer Payload Boundaries

- **Goal**: Continue the selective Phase 1 companion Step 4 readability pass by removing repeated invalid-command handling from the feed, pool, and playback reducer builders.
- **Implementation**: Added one partially applied `withCommandPayload` boundary that decodes a command payload once, returns the existing identity no-op for invalid payloads, and delegates valid payloads to each family’s explicit reducer logic.
- **Verification**: Added regression coverage across feed deletion, pool keyword updates, and active-photo selection. The full regression suite passed 261 assertions, and the sensor-adapter suite passed 11/11.
- **Learning**: A small higher-order boundary is useful when several reducer builders share the same validation/no-op contract but still need to expose their domain-specific mutation and selection policies directly.

### 2026-07-31: Close Socket Command-Family Interpretation

- **Goal**: Continue the selective Phase 1 companion Step 4 readability pass
  without hiding socket-owned behavior behind a broad framework.
- **Implementation**: Replaced the Socket.IO command-family `switch` with the
  existing closed, Map-backed handler-record interpreter. State-patch,
  durable-command, async-job, and secret-save specializations remain explicit;
  unknown and inherited family keys preserve the former identity fallback.
- **Verification**: Added a direct regression test for family specialization,
  unknown/inherited keys, and async fallback emission. `npm test` passed 226
  assertions plus 11/11 sensor-adapter regressions; `npm run lint` passed with
  three pre-existing warnings.
- **Learning**: A closed interpreter is valuable when it replaces an existing
  finite dispatch branch without obscuring the distinct payload shaping each
  case owns.

### 2026-07-31: Scrubbed Local Paths From Tracked Documentation

- **Goal**: Keep public documentation portable and prevent local file URLs or
  home-directory paths from leaking into the repository.
- **Implementation**: Replaced tracked absolute local links with repo-relative
  links and generalized the mount-specific deployment warning in
  `CONVENTIONS.md`.
- **Verification**: A tracked-files privacy scan found no remaining local file
  URLs or local home-directory paths.

### 2026-07-31: Documented Agent Memory Authority and Git-Escalation Handoff

- **Goal**: Prevent future agents from treating an ordinary sandbox Git-metadata
  failure as a final commit blocker.
- **Implementation**: Added `docs/AGENT_MEMORY_HANDOFF.md`, documenting the
  duplicated memory sources, missing precedence rules, the canonical escalation
  decision, and a portable next-agent checklist.
- **Learning**: Historical evidence and current operating policy need separate
  authority levels. One canonical action rule is more reliable than many
  duplicated reminders.

### 2026-07-30: Harden Kiosk Recovery and Persisted Unsplash Filtering

- **Goal**: Stop Chromium restart storms and prevent premium Unsplash preview rows from surviving into the active feed.
- **Implementation**:
  - Replaced shell-based Chromium launch commands with tracked child processes and explicit Wayland/X11 environments.
  - Classified expected kiosk dismissal separately from unexpected exits and fail-closed automatic relaunch after repeated failures.
  - Applied the Unsplash premium/plus policy during crawling and persisted snapshot normalization.
  - Added regression coverage for the shared Unsplash policy and removed the old assumption that launch kills all Chromium processes.
- **Learning**: A cooldown alone is not a recovery policy when the idle reducer keeps requesting launch; the blocked state must be part of the daemon decision so the system becomes quiet and recoverable.

### 2026-07-29: Filter Out Watermarked Unsplash+ Preview Images

- **Goal**: Automatically skip Unsplash images containing bleak repeating watermarks.
- **Implementation**:
  - Identified `item.premium`, `item.plus`, and `plus.unsplash.com` URL domains in the Unsplash NAPI response representing watermarked iStock/Getty preview images.
  - Added filter check in `server/services/crawler.js` to skip watermarked Unsplash+ preview photos.
  - Pruned existing watermarked `plus.unsplash.com` entries from `curated_collections.json`.
- **Learning**: Unsplash NAPI explicit flags (`premium: true`, `plus: true`, `urls.raw` containing `plus.unsplash.com`) provide a reliable mechanism for excluding watermarked preview assets.
- **Mandatory Agent Rule**: Always commit changes with conventional commit syntax and push to remote (`git push origin main`) at the end of every task execution.

### 2026-07-23: Separate Daily Crawl Timing From Snapshot Writes

- **Goal**: Restore the daemon's intended daily feed crawl cadence.
- **Implementation**:
  - Added a dedicated `lastFeedUpdated` persistence field for completed crawler passes.
  - Kept `lastUpdated` as the general snapshot-write timestamp used by ratings, crops, and vision metadata.
  - Legacy snapshots without `lastFeedUpdated` now receive one migration crawl instead of being suppressed by unrelated recent writes.
- **Learning**: A file's modification timestamp or general persistence timestamp is not a valid freshness signal when several independent workflows write the same snapshot.

### 2026-07-20: Capture the Dispatcher Effect Interpreter Once

- **Goal**: Continue the active Phase 1 Step 4 cleanup by making the ordered effect pipeline’s partial application explicit.
- **Implementation**:
  - Capture the effect handler interpreter once when creating the sequential reducer, rather than rebuilding that partially applied function for every effect.
  - Preserve ordered asynchronous execution, result ordering, and silent handling of unregistered effect types.
  - Added direct regression coverage for delayed effect sequencing, result order, and unhandled effects.
- **Learning**: A small closure can make partial application visible at the boundary while keeping the promise-reduce interpreter straightforward and allocation-free per effect.
- **Verification**: `npm test` and `npm run lint` are required before completion.

### 2026-07-20: Route Reducer Commands Through One Family Interpreter

- **Goal**: Continue the active Phase 1 Step 4 functional-core cleanup by removing repeated command-family lookup branches from the domain reducer.
- **Implementation**:
  - Added one ordered reducer-family specification table for simple, photo, feed, pool, playback, and `patch-state` commands.
  - Kept family-specific `now` and `rng` requirements explicit through small pure environment adapters, while simple and pool reducers receive no unnecessary context.
  - Hardened family lookup against inherited object keys and preserved unsupported-command and null-command no-op semantics.
  - Added regression coverage for unsupported command names, inherited keys such as `toString`, and null commands.
- **Learning**: Once command families already have stable declarative boundaries, the dispatch boundary can be expressed as data plus a tiny interpreter. The explicit environment adapter keeps composition useful without hiding which reducers depend on time or randomness.
- **Verification**: `npm run lint` passed with two pre-existing warnings; `npm test` passed 210 assertions and the sensor-adapter suite passed 11/11. The live socket smoke test remains skipped under the sandbox's known `listen EPERM` limitation.

### 2026-07-20: Isolated Google Photos Cache Regression Fixtures
- **Goal**: Prevent `npm test` from replacing the live daemon's gitignored Google Photos cache.
- **Implementation**:
  - Added `LUMINA_GOOGLE_PHOTOS_CACHE_PATH` as a source-local cache-path override.
  - Routed regression fixtures to a temporary test cache instead of `server/config/google_photos_cache.json`.
  - Recovered the live cache and verified the daemon accepts Google Photos loved PATCHes with `200` responses.
- **Learning**: Runtime cache files must be treated as an injected effect boundary in tests; otherwise a passing fixture can still corrupt a concurrently running daemon.

### 2026-07-20: Reconciled Permanent Collection Toggle With Confirmed Google Photos Metadata
- **Goal**: Fix the Independent Rating Deck toggle appearing stuck when changing a Google Photos item.
- **Implementation**:
  - Reconciled the initiating client snapshot from the canonical `photo` returned by `PATCH /api/photos`, including the proxy-backed Google Photos URL and confirmed `loved` value.
  - Changed the deck's Permanent Collection control from a clickable `div` to an accessible button with `aria-pressed` state and an explicit action label.
  - Added pure client-state regression coverage for confirmed source-local photo patches and the optimistic fallback path.
- **Learning**: Source-local metadata updates need a small response-confirmation boundary in the client; optimistic updates remain immediate, while the server response resolves identity and final metadata without adding another transport-specific branch.

### 2026-07-20: Prevented Black Images in Split Portrait Mode & Fixed Stuffed Pool Keyword Arrays
- **Goal**: Prevent black image boxes in split portrait mode for Google Photos (or any feed) and fix single-string keyword query stuffing across core photography pools.
- **Implementation**:
  - **Keyword Array De-stuffing**: Refactored `defaultKeywords` in `server/config/state.js`, `searchQueries` in `server/services/crawler.js`, and `searchKeywords`/`feedConfigs` in `curated_collections.json` from single concatenated strings (e.g. `["abstract art painting minimalist geometric"]`) into clean, distinct keyword arrays (e.g. `["abstract art", "abstract painting", "minimalist art", "geometric abstract"]`).
  - **Zero-Byte Media Proxy Hardening**: Updated `fetchMediaItemBytes` in `server/services/googlePhotos.js` to validate `buffer.length > 0` on cache reads and writes. Any empty or corrupted disk cache files are automatically purged and re-fetched from Google Photos.
  - **Live Image Preloading & DOM Error Auto-Recovery**:
    - Added an 8-second timeout guard and zero-dimension check to `loadImageMeta` in `Dashboard.jsx`.
    - Removed early cache returns in `getImageMeta` so every secondary image URL is empirically verified before mounting.
    - Added DOM-level `onError` listeners inside `.slide-half`. If a mounted secondary split image fails to render in the browser, the error handler automatically reports the broken photo and collapses the active slide into single-frame mode (`isSplit: false`), guaranteeing a black box never stays on screen.
  - **Google Photos Pairing Metadata Coverage**: Added a domain reducer regression test in `server/domain/tests.js` verifying `set-photo-prevent-pairing` updates on external Google Photos collections.
- **Learning**: CSS `background-image` fails silently without firing DOM error events on container elements. Adding hidden `<img>` tags with `onError` handlers alongside CSS background styling provides a deterministic DOM error recovery hook to collapse broken multi-panel layouts into single-frame mode automatically.
- **Verification**: `npm test` passed 236/236 assertions cleanly; client production build succeeded in 3.75s.

### 2026-07-20: Composed Ordered Effect Interpretation
- **Goal**: Continue the Step 4 functional-core cleanup by removing the remaining mutable loop from dispatcher effect interpretation without changing effect semantics.
- **Implementation**:
  - Replaced the dispatcher’s effect loop with a named `interpretEffect` step composed through promise chaining and `reduce`.
  - Preserved strict effect order and the existing `{ effect, value }` result contract, including asynchronous effect handlers.
  - Added regression coverage proving ordered interpretation and result ordering for a state patch that emits persistence and weather-refresh effects.
- **Learning**: Sequential effects are inherently ordered, so a promise-reduce pipeline makes that sequencing visible while keeping the domain reducer pure and the runtime effects explicit.
- **Verification**:
  - `npm test` passed.

### 2026-07-19: Preserve Loved Google Photos Across Picker Resyncs
- **Goal**: Keep Google Photos consistent with the other feeds’ permanent-collection behavior while retaining offline playback during authentication or Picker outages.
- **Implementation**:
  - Kept the Picker response as the replaceable working pool, but merge previously cached `loved` items into the next source-local cache snapshot.
  - Include preserved loved items in local-file cleanup and background download bookkeeping so their downloaded bytes are not treated as orphaned.
  - Leave the existing failure boundary intact: a failed Picker/auth sync throws before cache replacement or cleanup, so the last good cache and local files remain available.
  - Added regression coverage for preserving a loved item that is absent from a later Picker selection.
- **Learning**: External feed refreshes need the same distinction as crawler refreshes: ordinary items may be replaced, while explicit permanent-collection metadata must outlive a working-set update.

### 2026-07-19: Synchronized Comprehensive Project Documentation
- **Goal**: Update `README.md`, `AGENTS.md`, and project guides to fully accurately reflect all recently implemented major features, architecture shifts, and REST API expansions.
- **Implementation**:
  - Updated `README.md` features and architecture sections with adaptive sensor device management, pasteable JSON payload support, protocol-first adapter discovery (`GET /api/environment/adapters`), continuous TV kiosk presentation (with 3-second cursor auto-hiding), and full list of REST API endpoints (async jobs for recrawl and vision-analysis, pool mutations, state patches).
  - Updated `AGENTS.md` to remove obsolete references to the legacy pitch-black stealth clock dimmer, replacing it with the continuous smart display presentation model, and expanded the REST API reference guide.
  - Aligned system documentation across `README.md`, `AGENTS.md`, `ROADMAP.md`, and `DEVELOPER_LOG.md`.
- **Learning**: Maintaining clear, synchronized documentation across user-facing `README.md`, developer `AGENTS.md`, and product `ROADMAP.md` prevents context drift and ensures future AI agents and human contributors have an exact, accurate picture of the system state.

### 2026-07-19: Added Adaptive Sensor Device Management
- **Goal**: Make compatible local sensor setup a visible admin task instead of requiring users to reinterpret one flat GW1200 configuration.
- **Implementation**:
  - Added a pure saved-device catalog with automatic migration from existing flat `config.ecowitt` settings, registered-adapter validation, and a backwards-compatible active-device projection.
  - Kept several named profiles while retaining one active poller, so changing sources does not introduce concurrent timers, data fusion, or history migrations.
  - Rebuilt System → Environment around current conditions, a contained device list, an explicit **Add device** action, and a persistent editor that renders beside the list on expanded windows and below it on compact windows.
  - Replaced the ambiguous polling switch with **Use device** / **Stop polling** actions. The only switch on the page is the semantic, keyboard-operable **Show indoor readings on TV** presentation preference.
  - Hardened active-device changes so they clear the previous source's last-good reading, abort outstanding reads, and reject late completions before they can update the cache or history.
  - Preserved cached and in-flight readings for non-source edits such as polling timing or display units, refreshing cached presentation-unit metadata without treating those edits as a device switch.
  - Removed the device editor's misleading close icon. The editor is intentionally persistent in the list–detail layout, so a dismiss action had no coherent state to represent.
  - Recorded the research, trade-offs, target model, rubber-duck transcript, and acceptance criteria in `SENSOR_DEVICE_MANAGEMENT_PLAN.md`.
- **Learning**: A protocol adapter, a saved physical-device profile, and a running poller are three different concepts. Making those distinctions explicit simplified both the runtime and the interface; multiple profiles do not require multiple simultaneous ingestion pipelines. Cached and in-flight observations also belong to the active-source generation, not to the adapter runtime globally.
- **Verification**: Focused server and client-state regressions were added. Source parsing, ESLint, CSS parsing, and public-diff checks passed in the contribution workspace; the repository-mandated `npm test`, client build, and live responsive checks remain to be run on Playwright before the draft PR is marked ready.

### 2026-07-19: Documented Ecowitt Compatibility API
- **Goal**: Make hardware compatibility discoverable before setup.
- **Implementation**: Documented the exact local API contract, `GET /get_livedata_info`, in the admin panel, README, and agent guide with a link to Ecowitt’s published protocol.

### 2026-07-19: Added Pasteable Adapter JSON to Environment Setup
- **Goal**: Let a fresh GitHub user configure a device from a copied setup payload without manually editing local files.
- **Implementation**:
  - Added an Advanced JSON editor to Gateway Configuration with a safe parse-and-apply step before the existing validated save path.
  - Added pure JSON parsing coverage, preserving the rule that pasted data is configuration only and never executable code.
- **Learning**: Field controls are approachable for common setup, while a portable JSON representation is essential for repeatable onboarding and future adapter-specific settings.

### 2026-07-19: Introduced the General Sensor Adapter Platform Boundary
- **Goal**: Prevent the local sensor platform from becoming an Ecowitt-only subsystem as additional device protocols are introduced.
- **Implementation**:
  - Added `server/services/sensorPlatform.js` with one capability-aware adapter contract for read, lifecycle, and settings operations.
  - Registered the Ecowitt GW1200 as the first adapter and routed environment reads, startup, shutdown, and configuration updates through the platform.
  - Added `GET /api/environment/adapters` so the admin/API layer can discover registered device capabilities rather than assuming one vendor forever.
  - Kept Ecowitt HTTP parsing inside its adapter boundary; storage and normalized consumers remain source-agnostic.
- **Learning**: There is no single universal local sensor wire protocol. The stable abstraction is a normalized platform envelope plus thin protocol adapters, not a universal vendor-shaped data object.
- **Verification**: Added capability-aware platform composition coverage and retained the full existing regression gate.

### 2026-07-19: Added Admin Controls for Local Ecowitt Configuration
- **Goal**: Make a fresh Lumina installation self-configurable for an IoT-ready Ecowitt gateway instead of requiring direct editing of `config.json`.
- **Implementation**:
  - Added validated `GET/POST /api/environment/settings` endpoints for gateway URL, enablement, polling interval, timeout, and presentation units.
  - Added the Gateway Configuration form under Remote Control → System → Environment. Saving writes only local non-secret settings to gitignored `config.json` and applies them to the running adapter immediately.
  - Kept URL and unit validation in the backend boundary, with the existing placeholder-only public example retained.
- **Learning**: Configuration belongs at the REST/admin boundary, while the adapter remains a small runtime interpreter. This keeps deployment-specific device details out of the public source and avoids requiring a restart for ordinary setup changes.
- **Verification**: Live port-5000 settings and environment endpoints returned the configured gateway, units, and current GW1200 reading; regression suite passed.

### 2026-07-19: Made Ecowitt Units Configurable and Preserved Full Gateway Telemetry
- **Goal**: Remove implicit local assumptions from the public adapter and ensure the history contract does not discard GW1200 sensor families that are not needed by the first widget.
- **Implementation**:
  - Documented `config.json` as the local source of the Ecowitt gateway URL and presentation units; the tracked example uses placeholders and no household IP or location.
  - Kept database values canonical in Celsius, hPa, and other metric units, then converted the TV/remote presentation according to `ecowitt.units`.
  - Added a backwards-compatible SQLite migration and persisted the complete `get_livedata_info` JSON payload as `gateway_metrics_json`, exposed as parsed `gateway_metrics` in JSON history and included in CSV export.
  - The live GW1200 currently reports `common_list`, `wh25`, and `debug`; future paired blocks such as rain, wind, lightning, air quality, soil, leaf, leak, distance, and multichannel sensors now flow through without a schema change.
- **Learning**: A fixed column set is appropriate for canonical widgets, but it is not an adequate representation of a vendor gateway with optional sensor families. Preserve the source payload at the storage boundary and derive stable fields only where Lumina has a semantic consumer.
- **Verification**: Live port-5000 API returned current GW1200 data and history with `gateway_metrics`; client build and lint passed, and the full regression suite passed.

### 2026-07-18: Added a Discoverable Environment Admin Surface
- **Goal**: Make the new IoT-ready sensor capabilities visible without adding another top-level navigation tab or turning the remote into a telemetry dashboard.
- **Implementation**:
  - Split the System panel into lightweight `General` and `Environment` subtabs.
  - Added a Local Sensor Bay card for Ecowitt GW1200 status, indoor readings, stale-state visibility, and the existing TV visibility toggle.
  - Added 24-hour history refresh, latest stored snapshot context, and a direct CSV export action for Grafana or archival use.
  - Kept the device presentation adapter-agnostic in naming and data shaping; the current GW1200 is shown as the first local adapter, not as a UI-wide special case.
- **Learning**: The right information architecture was a sub-navigation within System: environment telemetry is operational context, while direct photo/display controls remain separate top-level workflows.
- **Verification**: Client helper tests, `npm test` (199 passing assertions, zero failures), production client build, and lint completed successfully.

### 2026-07-18: Persisted Hourly GW1200 Sensor Snapshots
- **Goal**: Complete the Phase 2 local sensor-platform storage slice without introducing a database server or coupling UI widgets to Ecowitt.
- **Implementation**:
  - Added `server/services/sensorHistory.js`, separating pure sensor normalization and CSV projection from a small injected `node:sqlite` storage adapter.
  - Successful GW1200 reads now upsert one row per UTC hour, retaining the newest reading in that hour and combining indoor gateway metrics with the latest outdoor Open-Meteo snapshot.
  - Added `GET /api/environment/history`, `GET /api/environment/history/export?format=csv`, and the short `/api/environment/export` alias. The default database path is the local ignored `sensor_history.db`; tests use an in-memory database.
  - Added configuration defaults, route tests, normalization tests, hourly deduplication tests, and CSV export coverage.
- **Learning**: The useful abstraction is a pure normalized record plus a narrow persistence port. The hourly key is a domain projection, so idempotent upsert behavior stays deterministic and independent of SQLite details.
- **Verification**: `npm test` passed 198/198 assertions.

### 2026-07-18: Extended Clock Widget Glass Container Right Padding
- **Goal**: Prevent the top-right rounded corner of the blurry glass container behind the clock from clipping the letter "m" in "am" / "pm".
- **Implementation**:
  - Added `padding-right: 36px` to `.clock-widget` in `client/src/index.css` (up from default `24px`), extending the backdrop-blur glass container rightward so top-right corner radius curves clear the AM/PM text.
- **Verification**: `npm test` passed 225/225 diagnostic assertions.

### 2026-07-18: Removed Pitch-Black Dimmer Overlay to Keep TV View Desktop Visible
- **Goal**: Prevent the TV View from flashing for a moment on page load/mount and then fading to a pitch-black screen.
- **Implementation**:
  - Removed `.screensaver-dimmer` pitch-black overlay and `.stealth-dim-clock` elements from `client/src/components/Dashboard.jsx` and `client/src/index.css`.
  - Updated `Dashboard.jsx` to render the TV dashboard UI (clock, weather, widgets, wallpaper slideshow, particle effects, weather overlay animations) directly without dimming to black.
  - Simplified mouse interaction in `Dashboard.jsx` so mouse movement manages smooth 3-second cursor auto-hiding without dismissing or fading the TV View to pitch black.
- **Learning**: Gating ambient smart display rendering behind an active/inactive idle state can create unintended black-screen states when viewing the dashboard from web browsers or remote controllers. Keeping the TV dashboard elements rendered directly while managing cursor visibility provides a seamless ambient display experience.
- **Verification**: `npm run build --prefix client` and `npm test` passed 225/225 diagnostic test assertions cleanly.

### 2026-07-18: Added SQLite Sensor Data Recording & REST Export API to Phase 2 Roadmap
- **Goal**: Define the storage and API export strategy for hourly IoT sensor readings (Ecowitt GW1200 + outdoor weather) as part of Phase 2's Local Sensor Platform.
- **Implementation**:
  - Evaluated storage and telemetry architectures (SQLite + REST export API vs. Prometheus `/metrics` endpoint).
  - Selected **Option A (SQLite DB + REST Export API)** for minimal complexity, zero external server dependencies, full offline self-containment, and adherence to Lumina's strict hardware memory (<80MB RAM) and CPU footprint constraints.
  - Updated `ROADMAP.md` Phase 2 (Local sensor platform) and Phase 2 Acceptance Plan to specify hourly sensor recording to a local SQLite database (`sensor_history.db`) exposed via `GET /api/environment/history` and `/export` REST endpoints for Grafana (Infinity/SQLite plugin) and direct JSON/CSV downloads.
- **Learning**: Self-contained SQLite persistence using Node.js built-in `node:sqlite` or lightweight SQLite allows Lumina to act as a zero-dependency telemetry source that integrates cleanly into Grafana without forcing the user to host a separate Prometheus server stack.
- **Verification**: Updated `ROADMAP.md` and `DEVELOPER_LOG.md`, verified formatting and repository standards.

### 2026-07-18: Add the First Ecowitt GW1200 Indoor Environment Slice
- **Goal**: Introduce local indoor observations without turning Lumina's picture-gallery view into a dashboard or coupling indoor telemetry to outdoor weather selection.
- **Implementation**:
  - Added `server/services/ecowitt.js` with pure payload parsing and metric normalization for the verified GW1200 `wh25[0]` response, including Fahrenheit-to-Celsius and inHg-to-hPa conversion.
  - Added a resilient in-memory runtime and read-only `GET /api/environment` contract with last-known-good stale fallback and availability-transition logging.
  - Added ignored local Ecowitt configuration, a quiet subordinate indoor line inside the existing weather card, and an independent remote visibility toggle.
  - Kept Open-Meteo as the outdoor weather and forecast source; the GW1200 endpoint currently provides no outdoor observation.
  - Added parser, normalization, disabled-mode, stale-fallback, and API-shape regression coverage, plus the captured payload as an anonymized test fixture.
- **Learning**: The useful functional boundary is a pure vendor-to-domain normalization pipeline followed by a small imperative polling shell. A generalized sensor framework or Fantasy Land wrapper would add ceremony without improving this first adapter.
- **Verification**: `npm test` passed 195/195 assertions, `npm run lint` passed, and the client production build completed successfully.

### 2026-07-18: Made QR Code & IP Address Widget Optional to Display
- **Goal**: Allow users to toggle the QR code and IP address rectangle on the TV view, so it doesn't block image titles in paired mode or clutter the screen when unneeded.
- **Implementation**:
  - Added `qrcode: true` to the default `widgets` object state in `server/config/state.js`.
  - Updated `client/src/components/Dashboard.jsx` to conditionally render the bottom-left `connection-widget` based on `state.widgets.qrcode` and added "QR & IP Badge" to the Desktop settings toggle list.
  - Updated `client/src/components/remote/SystemSettingsTab.jsx` with a new `QrCode` switch item under the TV Widgets Switchboard so users can toggle the QR & IP Badge from the mobile remote.
  - Updated `AGENTS.md` documentation to list `qrcode` as an official widget key in `widgets`.
  - Added test assertions in `server/domain/tests.js` for `qrcode` widget state patching and updated client build bundle.
- **Learning**: Because the domain reducer and socket compatibility adapters evaluate `widgets` patches dynamically against the keys on `state.widgets`, adding a new widget key to `state.js` automatically enables seamless validation and dispatch without requiring extra transport boilerplate.
- **Verification**: `npm test` passed 218/218 tests cleanly, and `npm run build --prefix client` built the production React bundle without issues.

### 2026-07-18: Continued Step 4 with a Shared Field-Entry Reducer Shell for Simple Setters
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining ad hoc simple config/runtime setter branches in `server/domain/reducer.js` without hiding the explicit kiosk side effects or widening the reducer into another framework.
- **Implementation**:
  - Added one small field-entry reducer helper in `server/domain/reducer.js`, then rewired the remaining simple setters to specialize that same shell instead of mixing one-off `assignIfChanged(...)` and multi-field runtime updates inline.
  - Moved `set-split-portrait`, `set-split-crop`, `set-scale-mode`, `change-theme`, `change-interval`, and `set-screensaver-active` onto the shared `read entries -> assign changed fields -> maybe persist/effect` boundary while keeping the `launch-kiosk` / `kill-kiosk` effect choice explicit in the command table.
  - Expanded `server/domain/tests.js` so the reducer regression suite now covers the deactivation path too, proving the shared shell flips `screensaverActive`, `manualOverride`, and `browserRunning` together while still emitting `kill-kiosk`.
  - Expanded `run-tests.js` so the REST route suite now covers both screensaver activation and deactivation through `POST /api/state/screensaver`, pinning the shared setter shell at the transport boundary as well as in the pure reducer.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repository records this July 18, 2026 Step 4 slice directly for the next agent.
- **Learning**: The useful abstraction here was another tiny reducer-local interpreter, not a generalized command framework. Once the remaining setter branches became field-entry readers plus one shared shell, the only code left in each branch was the actual policy: which fields change, whether they persist, and whether a kiosk effect should fire.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-18: Continued Step 4 with One Shared Patch-Transport Builder for Photo and Pool Mutations
- **Goal**: Keep the active Step 4 readability pass moving by removing the last duplicated route/socket transport-shaping helpers in `server/domain/commands.js` without flattening the intentional route-only and socket-only exceptions in those families.
- **Implementation**:
  - Refactored `server/domain/commands.js` around one small patch-transport builder plus shared route/socket interpreters, then rewired both the photo and pool mutation families to specialize that same boundary instead of carrying parallel `createPhoto*` and `createPool*` shaping helpers.
  - Kept transport-owned differences explicit by preserving route-only loved-photo patches, socket-only metadata reporting, and dynamic pool feed-config route expansion as plain spec data flowing through the shared builder instead of hiding them behind imperative branching.
  - Expanded `server/domain/tests.js` with direct regression coverage that asserts the shared builder still expands the expected photo and pool route keys while keeping the intentional route-only/socket-only cases explicit.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the July 18, 2026 checkpoint names this Step 4 slice directly for the next agent.
- **Learning**: The useful abstraction here was one tiny transport-family interpreter, not separate photo and pool helper clusters. Once the route/socket shaping shell became shared, the only remaining differences were the real policy facts, which now stay visible as data instead of duplicated helper code.
- **Verification**: `npm test`, `npm run lint`, `npm --prefix client run build`, and `git diff --check` are the verification gate for this slice.

### 2026-07-16: Continued Step 4 with Shared Pool-Mutation Transport Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining duplicated pool-mutation command inventory across REST patch decoding and durable socket listeners without widening the pool transport boundary into a framework.
- **Implementation**:
  - Refactored `server/domain/commands.js` around one shared declarative pool-transport family for keyword and feed-config mutations, then derived both the `PATCH /api/pools/:name` decode specs and the durable `update-keywords` / `update-feed-config` socket specs from that same source.
  - Kept transport-owned differences explicit by leaving pool-scoped recrawl submission and pool create/delete routes outside the new shared family, since those commands do not actually share the same patch-style transport shape.
  - Expanded `server/domain/tests.js` to assert direct REST/Socket.IO parity for pool keyword and feed-config decoding, and expanded `run-tests.js` so the live socket harness now proves `update-feed-config` dispatches the shared `merge-pool-feed-config` command path.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repository records this Step 4 slice and names the current pool-transport checkpoint explicitly for the next agent.
- **Learning**: The useful abstraction here was another small cross-transport family, not a generalized pool DSL. Once the overlapping pool mutation facts became shared data, the route/socket differences that still matter became clearer because only the intentional transport-specific cases stayed outside the family.
- **Verification**: `npm test`, `npm run lint`, `npm --prefix client run build`, and `git diff --check` are the verification gate for this slice.

### 2026-07-16: Continued Step 4 with a Shared Socket Listener-Family Table
- **Goal**: Keep the active Step 4 readability pass moving by removing the last repeated socket command-listener registration ceremony in `server/sockets.js` without widening the transport layer or hiding the intentionally imperative telemetry and signed-URL handlers.
- **Implementation**:
  - Added `SOCKET_COMMAND_LISTENER_SPECS` in `server/domain/commands.js`, deriving one declarative listener-family table from the existing state-patch, durable-command, async-job, and secret-save socket metadata instead of leaving `server/sockets.js` to loop those families separately.
  - Refactored `server/sockets.js` around one small interpreter that specializes each listener family into the existing `createCommandListener(...)` shell, preserving explicit fallback resolution, async-job unavailable acknowledgements, and secret-save success/failure acknowledgements as transport-owned behavior.
  - Expanded `server/domain/tests.js` to assert that the unified listener-family table stays aligned with the underlying socket spec families, and expanded `run-tests.js` to prove every shared listener spec still registers a live socket handler through the integration harness.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repository records this Step 4 slice and makes the current socket-readability checkpoint explicit for the next agent.
- **Learning**: The useful abstraction here was one tiny listener-family table, not another socket framework. Once the remaining registration ceremony became shared data plus one interpreter, `server/sockets.js` got shorter while the real transport-owned policies stayed explicit at the edge.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` are the verification gate for this slice.

### 2026-07-16: Fixed Side Designation Labels in Remote Direct Control Tab when Single Photo Layout is Active
- **Goal**: Ensure "Permanent Collection", "Allow Side-by-Side Pairing", and "Image Display Weight" labels in the Remote Control interface omit "(Left Photo)" / "(Right Photo)" suffixes when only a single photo is displayed on screen.
- **Implementation**:
  - Updated `client/src/components/remote/DirectControlTab.jsx` to check `isSplitLayoutActive` before appending side indicators (`(Left Photo)` / `(Right Photo)` / `(Left)` / `(Right)`).
  - Preserved side indicators when `isSplitLayoutActive` is `true` so side-by-side split screen view still clearly indicates which photo side is being modified.
- **Verification**: Verified via `npm test` (214 passing tests) and built client production bundle cleanly via `npm run build --prefix client`.

### 2026-07-16: Continued Step 4 with Shared Route-Local Specs for Remaining REST Single-Command Registrations
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining repeated `createCommandRoute(...)` registration ceremony in `server/routes.js` without exporting route-only presentation policy into the shared domain layer.
- **Implementation**:
  - Refactored `server/routes.js` around one small mixed-method route-spec registrar, then moved the remaining standalone REST single-command endpoints onto one local declarative table while keeping the existing `decode -> guard -> dispatch -> present` shell, custom senders, and route-specific guard/presentation behavior intact.
  - Left intentionally unique handlers such as Google auth/media routes, pool batch patches, async submissions, and live preview/photo batch flows explicit, so the new abstraction stops at the real repetition seam instead of becoming another route framework.
  - Expanded `run-tests.js` with direct regression coverage for the newly spec-driven `POST /api/photos/rate`, `POST /api/state/categories`, and `POST /api/state/screensaver` routes, so the refactor is verified through route invocation rather than only through broader live smoke coverage.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repository records this Step 4 slice and tightens the forward guidance to continue only where shared helpers are genuinely smaller and clearer than the explicit code they replace.
- **Learning**: The useful abstraction here was route-local metadata, not another command-module export. These handlers still own route presentation and guard behavior, so keeping the spec table inside `server/routes.js` preserves the imperative shell boundary while still removing the repeated registration ceremony.
- **Verification**: `npm test`, `npm run lint`, and `git diff --check` are the verification gate for this slice.

### 2026-07-14: Continued Step 4 with Shared Photo-Mutation Transport Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the last overlapping photo-mutation command inventory across the REST photo patch route and the durable socket photo listener table without hiding the intentional transport differences.
- **Implementation**:
  - Refactored `server/domain/commands.js` around one shared declarative photo-transport family, then derived the REST photo patch specs and the durable socket photo command specs from that same source instead of restating the decoder/fallback inventory in parallel.
  - Kept transport-owned behavior explicit by preserving route-only response shaping for rating, crop, pairing, broken, and loved patches, while leaving metadata reporting socket-only and loved-photo updates REST-only where those boundaries are intentional.
  - Expanded `server/domain/tests.js` with direct parity coverage proving that the overlapping REST and Socket.IO photo commands still decode to the same shared command shapes, while the route-only loved patch and socket-only metadata report remain explicit exceptions.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repository records this as the latest Step 4 slice and names the next likely seam explicitly.
- **Learning**: The useful abstraction here was one small cross-transport photo family, not another route or socket framework. Once the overlapping photo command facts became shared data, the transport differences that actually matter became easier to see because the accidental duplication disappeared.
- **Verification**: `npm test`, `npm run lint`, and `git diff --check` are the verification gate for this slice.

### 2026-07-14: Added Permanent Collection Loved Photos Through the Shared Photo Mutation Path
- **Goal**: Implement the permanent-collection idea without inventing another transport or persistence branch, so loved photos can survive crawler pruning while the active Step 4 shared-command architecture stays intact.
- **Implementation**:
  - Extended `server/domain/commands.js` and `server/domain/reducer.js` with a new `set-photo-loved` mutation that rides the same shared photo patch spec/reducer path already used for ratings, crop, pairing, and metadata.
  - Updated `server/services/crawler.js` so `capCollectionLimit(...)` now partitions originals, loved dynamic photos, and standard dynamic photos, preserving loved items while still keeping the rotating standard pool capped relative to the original curated seed set.
  - Wired `client/src/hooks/useLuminaActions.js`, `DirectControlTab.jsx`, and `ImageFeedsTab.jsx` to expose a REST-first "Permanent Collection" toggle with immediate optimistic snapshot patching in the initiating client.
  - Extended Google Photos metadata persistence helpers so loved flags survive the source-local external metadata path too, even though crawler pruning primarily matters for curated crawled feeds.
  - Added regression coverage in `server/domain/tests.js` and `run-tests.js` for loved command decoding, reducer persistence behavior, Google Photos metadata persistence, shared photo patch route decoding, live photo patch responses, and crawler-cap loved-photo preservation.
- **Learning**: The right abstraction was another tiny photo metadata command, not a separate “favorites” subsystem. Once loved became just one more shared photo patch plus one pure crawler partition rule, the feature fit the existing reducer/route/action composition cleanly and stayed easy to test.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` are the verification gate for this slice.

### 2026-07-14: Continued Step 4 with Shared REST Patch Command Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining inline photo/pool REST patch command facts from `server/routes.js` without widening the route shell or changing wire behavior.
- **Implementation**:
  - Refactored `server/domain/commands.js` so photo patch mutations, pool patch mutations, and pool-scoped recrawl command decoding now live in shared pure spec data and helpers instead of route-local arrays.
  - Rewired `server/routes.js` to consume those exported spec rows through the existing `decode -> guard -> dispatch -> present` shell, leaving the route module focused on transport orchestration rather than command metadata inventory.
  - Expanded `server/domain/tests.js` with direct regression coverage for the shared photo patch specs, pool patch spec builder, and scoped recrawl decoder.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repository records this as the latest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was another small spec boundary, not a broader HTTP DSL. Once the remaining REST patch command facts became shared data, the route layer kept its explicit failure/guard/presentation behavior while dropping another pocket of transport-local command inventory.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-13: Continued Step 4 with Shared Cross-Transport Command Family Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining duplicated command-family metadata across REST and Socket.IO without widening the shared dispatch shell or changing wire behavior.
- **Implementation**:
  - Refactored `server/domain/commands.js` so the admin-secret, async-job, and next/prev-photo families now derive their REST and Socket.IO transport specs from one shared declarative source instead of parallel per-transport tables.
  - Kept transport-owned behavior explicit by preserving route-only response shaping, socket-only fallback metadata, and the existing shared decoders while collapsing the repeated family facts into small spec builders.
  - Expanded `server/domain/tests.js` to assert cross-transport parity directly, proving the shared family metadata yields the same admin-secret and async-job command shapes across REST and Socket.IO while keeping socket playback advance on `smart` strategy and REST advance routes on `sequence`.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repository records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was one transport-family source of truth, not another layer around the adapters. Once the family facts became shared data, the remaining REST and Socket.IO spec tables stayed explicit about transport-owned behavior while losing the parallel metadata drift risk.
- **Verification**: `npm test` passed, with the usual live smoke skip under sandbox `listen EPERM`. `npm run lint` passed.

### 2026-07-12: Continued Step 4 with Shared REST Route Specs for Repeated Command Families
- **Goal**: Keep the active Step 4 readability pass moving by removing the last repeated REST command-registration ceremony without widening the shared dispatch shell or changing route behavior.
- **Implementation**:
  - Added declarative shared REST route specs in `server/domain/commands.js` for the admin-secret, async-job, and sequence-advance photo POST families.
  - Refactored `server/routes.js` to register those route families through small shared helpers, so the transport layer now specializes route metadata through the existing `createCommandRoute(...)` and `createEffectSubmissionRoute(...)` shells instead of repeating inline `app.post(...)` command setup.
  - Expanded `server/domain/tests.js` with direct assertions against the new REST route specs, covering both admin-secret endpoints, both async job families, and both advance-photo directions through the shared command shape.
  - Expanded `run-tests.js` with route regressions for `POST /api/admin/secrets/tumblr-api-key` and `POST /api/photos/prev`, proving the spec-driven registration still dispatches the expected shared commands and response shapes.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repository records this as the latest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was a tiny route-spec table, not another HTTP framework. Once the repeated POST families became plain metadata plus one registration helper, `server/routes.js` got shorter without hiding the existing decode/guard/dispatch/present boundary that still matters operationally.
- **Verification**: `npm test` passed with 176 assertions. `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-12: Continued Step 4 with Declarative `patch-state` Reducer Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining hand-built `patch-state` reducer handler chain without widening the shared state contract or transport boundary.
- **Implementation**:
  - Refactored `server/domain/reducer.js` so `patch-state` now runs through declarative spec rows for scalar config fields, excluded keywords, widgets, `visionConfig`, `autoLocation`, and manual location.
  - Added a small pure `read -> compare -> apply -> flag` interpreter in the reducer, preserving the existing recompute-photos and refresh-weather semantics while making the durable patch surface read as data instead of bespoke branching.
  - Expanded `server/domain/tests.js` with regression coverage that proves the spec-driven reducer ignores unknown widget keys while still composing recompute and weather-refresh follow-up flags correctly.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repository records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was a reducer-local patch spec table, not another general command framework. Once `patch-state` became one tiny interpreter over shared spec rows, the durable config surface became easier to extend because new fields now fit the same explicit `read -> compare -> apply -> flag` shape.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-12: Continued Step 4 with a Shared `patch-state` Contract Module
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining duplicated `patch-state` contract inventory and normalization logic without broadening the reducer or transport surface.
- **Implementation**:
  - Added `server/domain/statePatch.js` as one pure boundary for the shared scalar `patch-state` field list plus the canonical `visionConfig` and manual-location normalization helpers.
  - Refactored `server/domain/commands.js` to build `patch-state` commands through that shared contract instead of carrying its own scalar field reducer and duplicate normalizers.
  - Refactored `server/domain/reducer.js` to apply scalar `patch-state` updates through the same shared field inventory, removing the last parallel scalar list from the reducer boundary.
  - Expanded `server/domain/tests.js` with regression coverage that proves the shared scalar `patch-state` fields decode and apply consistently through the command and reducer path.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repo records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was one small contract module, not another reducer framework. Once `patch-state` stopped carrying parallel field inventories and normalizers in separate modules, the decode and reducer stages became easier to trust because their shared durable surface is now explicit in one place.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-12: Continued Step 4 with Shared Durable Socket Command Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining durable socket command-registration tables from `server/sockets.js` without hiding the transport-only fallback and acknowledgement behavior.
### 2026-07-17: Dynamic Fit-Content Sizing for Clock Widget Glass Backdrop
- **Goal**: Prevent the glassmorphic blurry background container beneath the clock widget from occupying an oversized 450px rectangular area when time digits take little horizontal space (e.g. 1:11 vs 12:58).
- **Implementation**:
  - Replaced fixed `min-width: 450px` on `.clock-widget` in `client/src/index.css` with `width: fit-content`, allowing the glass container to shrink-wrap snugly around the clock time and date with standard padding.
  - Added `font-variant-numeric: tabular-nums` and `white-space: nowrap` on `.clock-time` and `white-space: nowrap` on `.clock-date` to keep clock digits steady and clean across layout changes.
- **Learning**: Fixed minimum width rules on glass container cards create awkward empty translucent space when content dynamically varies in size. Shrink-wrapping with `width: fit-content` preserves aesthetics across all digit variations.
- **Verification**: `npm test` passed 217 diagnostic assertions. `npm --prefix client run build` built successfully.

### 2026-07-12: Continued Step 4 with Shared Socket Command Specs
  - Refactored `server/sockets.js` to register those specs through small shared decode/fallback helpers, leaving the socket layer with only transport-owned compatibility resolution, unavailable-job acknowledgements, secret-save acknowledgements, telemetry, and Google Photos URL refresh behavior.
  - Expanded `server/domain/tests.js` to assert the shared durable socket command, async-job, and secret-save specs directly, so the regression coverage now targets the actual event/decode metadata instead of another local registration copy.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repo records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was another small spec table, not a broader socket framework. Once the remaining durable socket handlers became shared event/decode metadata, `server/sockets.js` could stay explicit about transport-only responsibilities while dropping the repeated registration inventory.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-12: Continued Step 4 with Shared Durable Socket State-Patch Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the last repeated socket state-patch decoder assembly without changing the existing Socket.IO event contracts.
- **Implementation**:
  - Moved the durable socket state-patch event specs into `server/domain/commands.js`, so the shared command module now owns the declarative `event -> patch builder -> patch-state command` mapping instead of rebuilding the decoders in `server/sockets.js`.
  - Refactored `server/sockets.js` to register those shared specs directly, leaving the transport layer with only wiring and fallback policy instead of another pocket of patch-decoder assembly.
  - Reused the shared `STATE_PATCH_FIELDS` list in `server/socketLegacyCompatibility.js`, so the compatibility fallback and the shared command decoder stop carrying parallel scalar field inventories.
  - Expanded `server/domain/tests.js` to assert against the exported shared socket state-patch specs directly, which keeps the regression coverage on the actual transport command boundary instead of on locally rebuilt test helpers.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repo records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was not another listener factory, but one small shared spec table. Once the durable socket settings boundary became plain spec data owned by the command module, both the transport adapter and the fallback/test seams got smaller without losing readability.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-12: Continued Step 4 with Shared Reducer Specs for Playback Selection Commands
- **Goal**: Keep the active Step 4 readability pass moving by removing the last repeated playback-selection reducer ceremony without hiding preview-feed staging or navigation policy.
- **Implementation**:
  - Refactored `server/domain/reducer.js` around one narrow playback-command reducer-spec helper, so `set-active-photo` and `advance-photo` now express only their payload readers, photo-selection policy, direction policy, and optional feed-staging behavior while sharing the repeated `select -> activate -> emit photo update` shell.
  - Preserved the existing behavior: preview photos still get staged into the visible feed when needed, sequence and smart navigation still choose photos through the same selectors, and unresolved target URLs still stay silent as no-ops.
  - Expanded `server/domain/tests.js` with direct regression coverage for preview-photo staging and missing-photo no-op semantics through the new shared playback reducer boundary.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repo records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was another tiny reducer-spec interpreter, not a generalized playback DSL. Once the shared shell owned only `select -> maybe stage -> activate`, the interesting behavior stayed explicit because each spec still owns the only domain-specific choices: where the photo comes from and whether the visible feed needs patching first.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-12: Continued Step 4 with Shared Reducer Specs for Remaining Pool Commands
- **Goal**: Keep the active Step 4 readability pass moving by removing the last repeated reducer ceremony across pool creation and pool-config mutations without flattening their distinct persistence and crawler behaviors.
- **Implementation**:
  - Refactored `server/domain/reducer.js` around one narrow pool-command reducer-spec helper, so `add-pool`, `set-pool-keywords`, and `merge-pool-feed-config` now express only their payload readers, mutation policy, and optional side effects while sharing the repeated persistence/no-op shell.
  - Kept `delete-pool` on the separate feed-mutation path, preserving the existing `recompute -> ensure active photo -> emit` flow while limiting the new helper strictly to the pool commands that still shared the simpler `read -> apply -> persist/effect` pattern.
  - Expanded `server/domain/tests.js` with direct no-op coverage for duplicate pool creation and invalid feed-config payloads through the new shared reducer boundary.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was another tiny reducer-spec interpreter, not a generalized pool DSL. Once pool creation and pool-config commands became payload readers plus one explicit shell, the interesting behavior stayed visible because the only things left in each spec were the actual policy choices: create, persist, crawl, or silently no-op.
- **Verification**: `npm test` passed with 165 assertions. `npm run lint` is the remaining verification gate for this slice.

### 2026-07-12: Continued Step 4 with Shared Reducer Specs for Feed Mutations
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining repeated reducer ceremony across feed-mutating commands without flattening their distinct reselection and persistence policies.
- **Implementation**:
  - Refactored `server/domain/reducer.js` around one narrow feed-command reducer-spec helper, so `select-categories`, `update-excluded-keywords`, and `delete-pool` now express only their payload normalization and mutation policy while sharing the repeated `apply -> recompute -> finalize playback` interpreter.
  - Preserved the existing command semantics: category selection still forces photo reselection and emits `photo-update`, excluded-keyword clears still persist and recompute, and invalid pool deletions still short-circuit as no-ops.
  - Expanded `server/domain/tests.js` with direct regression coverage for forced reselection, exclusion clearing, and invalid delete no-op behavior through the new shared reducer boundary.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was another tiny reducer-spec interpreter, not a generic mutation framework. Once the feed-affecting branches became payload readers plus one shared finalization boundary, the remaining command-specific behavior stayed obvious because the only things left in each spec were the actual policy choices.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-12: Continued Step 4 with Shared Route Decoder-Spec Pipelines for Photo and Pool Patches
- **Goal**: Keep the active Step 4 readability pass moving by removing the last hand-built optional-command decode ceremony from the shared REST photo/pool patch routes without changing their wire contracts.
- **Implementation**:
  - Refactored [server/routes.js](./server/routes.js) around one tiny optional-command spec interpreter, so photo and pool patch decoders now express their mutation fields as declarative spec data instead of repeating `decodeOptionalCommandPart(...)` wrapper calls inline.
  - Rewrote the `PATCH /api/photos` and `PATCH /api/pools/:name` decode paths to build their command batches through those shared spec pipelines while keeping the existing validation messages, command order, and response shaping intact.
  - Expanded [run-tests.js](./run-tests.js) with a batch pool-patch regression that proves keywords plus multi-source feed-config updates still dispatch in deterministic order through the new decoder boundary.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was another small lawful interpreter, not a new HTTP DSL. Once optional route mutations became plain spec rows plus one collector, the route layer stayed readable because each mutation still owns the only interesting part: its payload policy and validation message.
- **Verification**: `npm test` passed with 162 assertions. `npm run lint` passed.

### 2026-07-12: Continued Step 4 with Shared Transport Command-Decoder Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining repeated transport decode ceremony in `server/domain/commands.js` without changing the existing REST or Socket.IO wire contracts.
- **Implementation**:
  - Added small pure decoder helpers in `server/domain/commands.js` for shared command construction, required-value validation, optional field normalization, and photo/pool decoder specialization.
  - Rewrote the repeated photo and pool decoders to specialize those helpers as data, so the transport layer now reads as `require value -> normalize payload -> build command` instead of repeating the same guard shell for each mutation.
  - Expanded `server/domain/tests.js` with direct assertions for active-photo preview decoding and partial photo-crop decoding so the new shared decoder boundary is covered explicitly.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo records this as the latest Step 4 slice while keeping the broader checkpoint active.
- **Learning**: The right abstraction here was another tiny spec boundary, not a full parser DSL. Once the required-value guard and payload normalization steps became shared helpers, the decoder layer stayed readable because each command still owns the only interesting part: how its payload is shaped.
- **Verification**: `npm test` passed with 162 assertions. `npm run lint` passed after removing two unused Google Photos test imports from `run-tests.js`.

### 2026-07-12: Implemented Local Offline Caching for Google Photos
- **Goal**: Resolve the 7-day session expiration and 60-minute URL expiration limitations of Google's public APIs by caching selected photo files locally.
- **Implementation**:
  - Defined a local cache directory `server/config/google_photos_media/` to store image files.
  - Implemented pure functional helpers `difference` and `getOrphanedFiles` in [googlePhotos.js](./server/services/googlePhotos.js) to compute orphaned files when syncing new items.
  - Added background downloader `downloadSyncMediaItems` and file cleanup `cleanOrphanedMediaFiles` in [googlePhotos.js](./server/services/googlePhotos.js) to run on album sync.
  - Modified `fetchMediaItemBytes` to serve files from local disk when available, and lazy-download and write to disk on success (self-healing cache).
  - Added full unit and integration tests to [run-tests.js](./run-tests.js) verifying local serving, lazy caching, set difference, and cleanup.
- **Learning**: The 7-day Picker session limit is a hard security feature of Google's public APIs. Instead of attempting fragile API hacks, downloading only the user's selected photos locally on-demand provides permanent, offline-capable screensaver playback with minimal disk footprint.
- **Verification**: `npm test` passed successfully with 189 assertions.

### 2026-07-11: Extended Per-Image Crop Zoom Beyond Cover
- **Goal**: Let operators zoom past the old cover ceiling for framed or matted images without loosening unrelated percentage fields like vertical crop position or split-balance controls.
- **Implementation**:
  - Added a dedicated server-side `cropPercent` validator so per-photo zoom now accepts `0..200` while `cropPositionY` and other true percentages remain `0..100`.
  - Raised the Direct Control and Image Feeds rating-deck crop sliders to the new per-photo max and clarified the UI copy so `100%` is understood as the cover point rather than the maximum zoom.
  - Centralized the client-side photo-crop defaults/blend math in `client/src/state/photoCrop.js` so the remote preview surfaces keep the same contain/cover baseline while allowing extra zoom headroom.
  - Expanded regression coverage so route decoding now rejects only values above the new max and live photo patch tests explicitly verify crop values greater than `100`.
- **Learning**: The old limit was not in the render math; it was the contract. The slideshow and preview code already extrapolated cleanly past cover, so the real fix was to widen the persisted `cropPercent` range without broadening every other percentage validator in the system.
- **Verification**: `npm test` and `npm --prefix client run build` passed.

### 2026-07-11: Continued Step 4 with Shared Reducer Specs for Photo Library Commands
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining inline reducer ceremony across the shared photo-library command branches without hiding their distinct playback rules.
- **Implementation**:
  - Refactored `server/domain/reducer.js` so `rate-photo`, `mark-photo-broken`, `set-photo-crop`, `set-photo-prevent-pairing`, and `report-photo-metadata` now register through one small photo-command reducer-spec table.
  - Kept the command-specific behavior as data: each spec still owns its updater, persisted metadata patch, and playback finalizer (`recompute`, `preserve`, or `keep`) while the shared helper owns only the repeated `url -> update -> persist -> emit` ceremony.
  - Added regression coverage in `server/domain/tests.js` for equality-aware no-op behavior across the shared photo reducer specs, alongside the existing crop, pairing, ban, and Google Photos metadata assertions.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the active Step 4 checkpoint records this reducer-focused slice while remaining intentionally selective.
- **Learning**: The useful abstraction here was another tiny reducer-spec boundary, not a broader photo DSL. Once the photo commands became plain data plus one interpreter, the reducer kept the interesting playback semantics visible while the copy-pasted metadata plumbing disappeared.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed.

### 2026-07-11: Continued Step 4 with Shared Reducer Specs for Simple Setter and Effect Commands
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining repeated reducer ceremony for the simplest setter and effect-bearing commands without turning the reducer into a framework.
- **Implementation**:
  - Refactored `server/domain/reducer.js` around a few narrow helpers for command-local state mutation, field assignment, and effect-result construction, then moved the simple setter/effect branches onto one shared reducer-spec table.
  - Standardized the branches for split layout, crop split percentage, scale mode, theme, slideshow interval, screensaver activation, admin-secret persistence, and async job triggers so they now reuse shared field/effect builders instead of repeating small state-update and payload-shaping blocks.
  - Added regression coverage in `server/domain/tests.js` for the positive and no-op behavior of the shared setter reducers plus the silent invalid admin-secret payload case.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the current Step 4 checkpoint records this reducer-focused slice while staying intentionally open only for clearly repetitive future seams.
- **Learning**: The useful abstraction here was a tiny reducer-spec algebra, not a command framework. Once the simplest branches became data plus a couple of local interpreters, the reducer kept its explicit switch for the complex cases while the repetitive field/effect ceremony disappeared.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-11: Continued Step 4 with Declarative Socket Listener Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the last repeated socket command-registration ceremony without hiding the intentionally imperative telemetry and signed-URL refresh handlers.
- **Implementation**:
  - Refactored `server/sockets.js` around small listener-spec helpers, so durable socket state-patch, photo, pool, async-job, and admin-secret commands now register through declarative spec data instead of a long repeated `listenForCommand(...)` sequence.
  - Kept the socket-only shell behaviors explicit: viewport/media-failure telemetry, second-photo sync, disconnect lifecycle, and on-demand Google Photos URL refresh still sit outside the shared command-registration boundary.
  - Added regression coverage in `run-tests.js` for declarative state-patch dispatch, explicit async-job fallback acknowledgements when no dispatcher is available, and secret-save failure acknowledgements through the shared listener-spec path.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the active Step 4 checkpoint records this slice while remaining open for only clearly repetitive future seams.
- **Learning**: The right abstraction here was a small registration algebra, not another transport framework. Once socket command listeners became plain data plus a single interpreter, the durable mutation section read compositionally while the truly imperative socket tail remained obvious.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-11: Continued Step 4 with Shared Route-Decode Composition
- **Goal**: Keep the active Step 4 readability pass moving by removing the last hand-rolled REST mutation decode batching and follow-up validation seams without disturbing the shared dispatch-route shell.
- **Implementation**:
  - Added `server/utils/routeDecode.js` as a tiny pure success/failure algebra with `collect`, `map`, and `chain` helpers so route decoding can short-circuit predictably without scattering nullable command checks.
  - Refactored `server/routes.js` so the photo patch, pool patch, keyword, and preview decoders now compose as explicit `decode -> collect -> map/chain` pipelines, with field-specific failures such as invalid crop bounds or bad source-config payloads returned before dispatch.
  - Added regression coverage in `run-tests.js` for the new route-decode helper layer and for shared route-shell short-circuiting on invalid pool feed-config and photo crop decode failures.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo records the new route-decode slice while keeping the broader Step 4 checkpoint active.
- **Learning**: The useful abstraction here was a tiny lawful decode result, not a broader transport DSL. Once route decode success/failure became composable data, the remaining REST mutation decoders collapsed into small pipelines and the dispatch shell stayed unchanged.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-11: Continued Step 4 with Dispatcher-Local Effect Sequencing Helpers
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining repeated command/effect ceremony in `server/domain/dispatch.js` without turning the dispatcher into a framework.
- **Implementation**:
  - Refactored `server/domain/dispatch.js` around a few small shell helpers: sequential effect interpretation, event emission, manual-override effect runners, env/runtime payload normalization, and fail-safe weather-refresh handling.
  - Kept the dispatch flow explicit as `reduce -> apply snapshot -> interpret effects -> emit events`, while moving the repeated payload-shape and `typeof handler === 'function'` plumbing behind narrow helpers instead of duplicating it across effect cases.
  - Tightened `server/domain/types.js` so the shared JSDoc contract now includes `patch-state` commands and `refresh-weather` effects, matching the live reducer/effect surface.
  - Added regression coverage in `run-tests.js` for the shared kiosk-kill helper path and for the rule that a failed `refresh-weather` effect logs once but does not abort the enclosing state update or broadcast.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the current Step 4 checkpoint records this dispatcher-focused slice while staying open for future clearly repetitive seams only.
- **Learning**: The useful abstraction here was a tiny interpreter boundary, not a generic dispatcher DSL. Once effect sequencing, payload normalization, and fail-safe shell behaviors each had one named helper, the dispatcher became easier to extend without hiding the actual order of work.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-11: Continued Step 4 with One Shared REST Dispatch-Route Shell
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining duplicate route-shell ceremony across command, batch-command, and async effect-submission handlers without hiding route-specific validation or response shaping.
- **Implementation**:
  - Refactored `server/routes.js` around one shared `createDispatchRoute(...)` boundary, so the higher-level route helpers now specialize the same `decode -> guard -> preflight -> dispatch -> present` flow instead of re-implementing overlapping error and dispatcher logic.
  - Preserved the route-specific behavior as data: command routes still own no-op semantics and custom response senders, batch routes still reject empty mutation sets before dispatch, and async job routes still validate extracted effect submissions before returning `202 Accepted`.
  - Added regression coverage in `run-tests.js` for the restored photo-batch preflight rejection and for the `PATCH /api/state` no-op path that must keep its raw state response shape even when the shared command route produces no reducer events or effects.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the active Step 4 checkpoint now records the new shared dispatch-route shell while leaving the broader readability pass open.
- **Learning**: The right abstraction here was a tiny route-plan algebra, not a larger HTTP DSL. Once each route kind could describe its own guards, preflight checks, dispatch step, and post-dispatch validation as data, the shell stopped repeating itself without becoming opaque.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-11: Continued Step 4 with Shared Keyword-Spec Normalization and Route Unification
- **Goal**: Keep the active Step 4 readability pass moving by removing the last direct keyword-config mutation route and expressing timed keyword specs through one pure normalization/equality boundary.
- **Implementation**:
  - Added `server/utils/keywordSpecs.js` so keyword entries now share small pure helpers for trimming, timed-spec normalization, deep equality, cloning, and feed-config term projection.
  - Refactored `server/domain/commands.js`, `server/domain/reducer.js`, `server/domain/snapshot.js`, `server/config/collectionsCodec.js`, and `server/config/state.js` to reuse that same helper layer, preserving time-scoped keyword objects through decode, reducer updates, snapshot cloning, and persisted config loading.
  - Rewired `POST /api/config/keywords` in `server/routes.js` onto the shared guarded command shell by decoding straight to `set-pool-keywords` instead of mutating `state.searchKeywords` and persisting inline.
  - Added regression coverage in `server/domain/tests.js` and `run-tests.js` for timed keyword-spec decoding, equality-aware no-op reducer behavior, and the keyword route's shared-command dispatch path.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo records this latest Step 4 slice while keeping the broader readability pass active.
- **Learning**: The useful abstraction here was not a new keyword subsystem; it was one small lawful normalization boundary. Once timed keyword specs had one canonical shape plus one equality rule, the old route-local mutation logic collapsed naturally into the same command path as the rest of the pool state.
- **Verification**: `npm test` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-10: Continued Step 4 with Decode-Aware Photo Mutation Route Composition
- **Goal**: Keep the active Step 4 readability pass moving by removing the last ad hoc photo mutation and preview wrappers from the REST shell without losing the route-specific photo lookup behavior.
- **Implementation**:
  - Extended `server/routes.js` with small decode-result helpers so shared command, batch-command, and async-submission route factories can surface custom decode-phase failures instead of forcing transport-local wrapper handlers.
  - Rewired `PATCH /api/photos` onto the shared batch-command route directly, adding a pre-dispatch photo-existence guard so missing photo mutations now fail at the shell boundary instead of silently dispatching no-op command batches.
  - Rewired `POST /api/photos/preview` onto the shared command route while preserving the payload-photo preview fallback for items that are not already in the active feed snapshot.
  - Added regression coverage in `run-tests.js` for photo batch decode failures, missing-photo guard failures, and the preview route's shared-command dispatch path.
- **Learning**: The useful next Step 4 abstraction was not another special-case photo helper, but a small decode-result algebra for the route shell. Once route factories could express custom decode failures, the remaining photo wrappers collapsed into the same declarative transport pipeline as the pool routes.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-10: Continued Step 4 with Guarded REST Mutation Route Composition
- **Goal**: Keep the active Step 4 readability pass moving by collapsing the remaining repeated REST mutation-route ceremony without hiding route-specific validation or response shaping.
- **Implementation**:
  - Refactored `server/routes.js` so single-command, batch-command, and async effect-submission handlers now share one guard-aware boundary for `decode -> guard -> dispatch -> present`, with dynamic not-found and missing-submission messages still owned by each route.
  - Rewired the pool mutation routes (`POST /api/pools`, `DELETE /api/pools/:name`, `PATCH /api/pools/:name`, `PATCH /api/pools/:name/feed-sources/:source`, and `POST /api/pools/:name/crawl`) onto that shared shell, replacing bespoke dispatcher/existence checks with small pool guard helpers.
  - Added regression coverage in `run-tests.js` for duplicate-pool rejection, missing-pool guard failures on batch and async-job routes, and the existing-pool feed-source patch success path through the new shared route boundary.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo records this latest Step 4 slice while keeping the broader readability pass open.
- **Learning**: The useful abstraction here was a tiny validation semigroup at the shell edge, not a full route DSL. Once guards became explicit data passed into the shared route factories, the pool routes read as declarative transport code again without losing their concrete HTTP behavior.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-10: Continued Step 4 with Shared Feed-Mutation Finalization Helpers
- **Goal**: Keep the active Step 4 readability pass moving by collapsing the remaining repeated reducer ceremony around feed recomputation, active-photo finalization, and persistence-bearing library mutations without changing the high-signal command branches.
- **Implementation**:
  - Refactored `server/domain/reducer.js` so category selection, excluded-keyword updates, and pool deletion now share one selective `reduceFeedMutation(...)` boundary that composes `apply -> recomputeFeed -> ensureActivePhoto -> emit/persist` instead of open-coding that pipeline in each branch.
  - Added an equality-aware `assignExcludedKeywords(...)` helper so `update-excluded-keywords` now stays fully silent when the trimmed effective keyword list is already active, matching the no-op discipline already established for patch-state and pool/config mutations.
  - Added regression coverage in `server/domain/tests.js` and `run-tests.js` for normalized excluded-keyword no-ops, preserving the rule that reducer and dispatcher layers should not emit events or persistence effects when nothing durable changes.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the active Step 4 checkpoint records the new shared feed-finalization slice while keeping the broader readability pass open.
- **Learning**: The useful abstraction here was a tiny composition boundary for feed-affecting mutations, not a generic reducer framework. Once the shared `recompute -> ensure -> emit` tail existed in one place, the command branches became easier to read precisely because they now only describe their actual state mutation.
- **Verification**: `npm test` and `npm run lint` are the intended verification gate for this slice.

### 2026-07-10: Continued Step 4 with Shared Async Effect Submission Helpers
- **Goal**: Keep Step 4 moving by removing the repeated async `dispatch -> effect extraction -> 202 response` ceremony from the shell boundary without hiding route-specific validation or presentation.
- **Implementation**:
  - Refactored `server/domain/dispatch.js` so payload-driven optional effects (`persist-external-photo-metadata`, `run-crawler`, `start-recrawl-job`, `start-vision-analysis-job`) now share small effect-runner helpers instead of repeating the same `typeof handler === 'function'` payload plumbing.
  - Added `createEffectSubmissionRoute(...)` in `server/routes.js`, then rewired `POST /api/jobs/recrawl`, `POST /api/jobs/vision-analysis`, and `POST /api/pools/:name/crawl` to share one explicit `decode -> dispatch -> extract submission -> present` path with the same 503 handling when no job snapshot is produced.
  - Added regression coverage in `run-tests.js` for shared vision-analysis effect interpretation in the dispatcher and for the recrawl route's missing-submission failure path, while preserving the existing accepted-job route assertions.
  - Updated `FUNCTIONAL_REFACTOR_ROADMAP.md` to record this Step 4 slice while keeping the overall checkpoint active.
- **Learning**: The useful abstraction here was not a generic route DSL; it was one tiny async submission boundary that treats reducer effects as a first-class contract. That keeps the shell composable while leaving per-route validation and response shape obvious.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-10: Continued Step 4 with Pool/Feed-Config Reducer Combinators and No-Op Guardrails
- **Goal**: Keep the implementation-companion Step 4 readability pass moving by collapsing the remaining repeated pool/config reducer ceremony without hiding the more complex playback-recompute branches.
- **Implementation**:
  - Refactored `server/domain/reducer.js` so pool lifecycle/config branches now share small reducer-local helpers for pool-name normalization, equality-aware keyword replacement, source-config merging, and pool removal setup instead of repeating clone/validate/persist scaffolding inline.
  - Added content-aware equality for small config objects so array-backed source settings like `subreddits` and `keywords` no longer trigger persistence or broadcasts when the normalized effective config is unchanged.
  - Kept the delete-pool playback recompute path explicit while reusing the new removal helper, preserving readability by standardizing only the truly repetitive parts of the command/effect pipeline.
  - Added regression coverage in `server/domain/tests.js` and `run-tests.js` for no-op pool keyword updates, no-op feed-config merges, and dispatcher silence when those commands do not change durable state.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo still points to Step 4 as the active checkpoint while recording that the pool/config slice is now complete.
- **Learning**: The right Step 4 abstraction here was a small semigroup-like merge boundary for pool config plus explicit no-op detection, not a generic mutation framework. Repeated ceremony disappeared, but the delete/recompute branch still reads plainly because it stayed concrete.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-10: Continued Step 4 with Declarative Config Mutation Helpers and Dispatcher Handler Tables
- **Goal**: Carry the active implementation-companion Step 4 checkpoint forward by cleaning up the remaining ad hoc command/effect seams after the earlier photo-mutation and result-shape standardization.
- **Implementation**:
  - Refactored `server/domain/reducer.js` so simple config/runtime setter commands now share a small `reduceStateMutation(...)` helper with proper no-op semantics instead of each branch cloning state and emitting events manually.
  - Reworked the `patch-state` reducer branch into a declarative sequence of focused patch appliers for scalar config fields, excluded keywords, widgets, vision config, and location settings, with equality-aware checks that avoid redundant persistence or weather refreshes when the incoming payload is already normalized.
  - Refactored `server/domain/dispatch.js` to use explicit effect and event handler tables, so the shell now reads as `reduce -> apply snapshot -> interpret effects -> emit events` rather than a long conditional ladder.
  - Added regression coverage in `server/domain/tests.js` for identical `visionConfig` / `manualLocation` no-op patches and unchanged setter commands, plus `run-tests.js` coverage for dispatcher event ordering, kiosk launch effects, effect-only recrawl dispatch, and shared external-photo persistence interpretation.
  - Updated `FUNCTIONAL_REFACTOR_ROADMAP.md` to record this as the next completed Step 4 slice while keeping the broader readability pass active.
- **Learning**: The next useful abstraction layer was not a deeper algebra of commands, but a pair of very small tables: one for reducer-local state updates and one for shell-level effect/event interpretation. That keeps the pipeline composable without obscuring what each command actually changes.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-10: Started Step 4 by Standardizing Reducer Result Shapes and Photo-Mutation Composition
- **Goal**: Begin the implementation-companion Step 4 readability pass by removing repeated reducer ceremony around unchanged returns, state-sync/photo-update result shapes, and persistence-bearing photo metadata updates.
- **Implementation**:
  - Refactored `server/domain/reducer.js` to use small shared result helpers for unchanged results, state-sync results, photo-update results, effect-only results, conditional photo/state-sync event selection, and persistence-effect bundling.
  - Added a composable `reducePhotoLibraryCommand(...)` helper so rating, broken-photo, crop, pairing, and metadata-report commands now share the same pure `update -> optional playback finalization -> persistence effect -> event` pipeline instead of reimplementing that flow in each branch.
  - Kept the abstractions selective: simple branches like interval/theme changes still read directly, while repeated photo-library mutations now express only their specific updater and post-update policy.
  - Added domain regression coverage for standardized no-op behavior on `patch-state` and missing-photo metadata commands, protecting the new result-shape boundary.
  - Updated `FUNCTIONAL_REFACTOR_ROADMAP.md` to record this as the first completed Step 4 slice while keeping the overall Step 4 checkpoint active.
- **Learning**: The cleanest Step 4 abstractions were not deep pipelines or clever point-free wrappers, but a small algebra of result builders plus one shared photo-mutation combinator. That keeps the reducer teachable: the repeated mechanics are centralized once, while each command branch still shows its domain-specific intent plainly.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-10: Completed the `server/app.js` Step 3 Shell Refactor with Kiosk and Idle-Daemon Runtimes
- **Goal**: Finish the remaining `server/app.js` Step 3 shell-composition seam by extracting the kiosk/browser lifecycle and the 2-second idle-daemon orchestration loop out of the bootstrap file.
- **Implementation**:
  - Added `server/runtime/kioskControl.js` as a dedicated browser lifecycle shell that owns manual override state, deferred launch retries, CPU-governor transitions, kiosk relaunch sequencing, and unexpected-exit recovery behind one object-shaped runtime API.
  - Added `server/runtime/idleDaemon.js` as the explicit Mutter/audio/inhibition polling shell, keeping the pure `getNextScreensaverState(...)` reducer local to that runtime and exposing a small `tick()` / `start()` boundary for the app bootstrap.
  - Rewired `server/app.js` to assemble those runtimes and inject their methods into the shared dispatcher and socket layers, leaving the app file focused on state/bootstrap assembly instead of long-lived host orchestration.
  - Added regression coverage in `run-tests.js` for deferred kiosk launches, manual-override reset after unexpected Chromium exits, idle-daemon launch after three idle ticks, and the rule that GNOME session inhibition is ignored once Lumina's own kiosk is already running.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repo now records Step 3 as complete and moves the active implementation-companion checkpoint to Step 4.
- **Learning**: This refactor worked best when the shell was split by host responsibility, not by arbitrary helper grouping. `server/app.js` became meaningfully easier to read only once browser lifecycle state and daemon polling cadence each had a named runtime boundary with injected effects and a tiny public surface.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when a real socket bind is attempted.

### 2026-07-10: Extracted the Environment Refresh Runtime as the Next `server/app.js` Step 3 Slice
- **Goal**: Continue the `server/app.js` shell-composition refactor by removing the weather, news-sentiment, and daily-feed refresh orchestration cluster from the app bootstrap file.
- **Implementation**:
  - Added `server/runtime/environmentRefresh.js` as an explicit shell module that owns the weather refresh pipeline, news-sentiment refresh pipeline, and daily feed-update policy using injected effects and small pure helpers (`shouldSkipDailyFeedUpdate`, weather snapshot builders, and collection merge projection).
  - Rewired `server/app.js` to assemble that runtime and keep only scheduling plus host wiring locally, matching the same object-shaped factory style already used by `server/runtime/activeFeed.js` and the async job services.
  - Added regression coverage in `run-tests.js` for refresh-interval skipping, successful news-sentiment refresh, successful weather-cache refresh, and the daily feed-update side-effect bundle (persist -> refresh active feed -> broadcast -> schedule analysis).
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and local memory logs so the Step 3 checkpoint now explicitly records that the active-feed and environment-refresh slices are complete and that kiosk/browser plus idle-daemon composition is the next seam.
- **Learning**: `server/app.js` gets smaller fastest when whole orchestration clusters move behind named runtimes rather than when individual helper functions are merely relocated. Once weather, sentiment, and daily refresh shared the same injected shell boundary, the remaining app-level work became much easier to see as "scheduling and host runtime" instead of a vague tangle of mixed concerns.
- **Verification**: `npm test` and `npm run lint` passed. No client build was needed because this slice only changed server/runtime code and tracked docs.

### 2026-07-10: Closed the Step 2 Socket Audit and Started Step 3 by Extracting Active-Feed Runtime Composition
- **Goal**: Confirm whether any durable socket behavior still required new domain commands/effects, then begin the next `server/app.js` shell-composition slice instead of leaving the checkpoint implicit.
- **Implementation**:
  - Audited the remaining `server/sockets.js` handlers and confirmed the only non-dispatch tail is intentionally ephemeral or source-local (`report-tv-viewport`, media-failure alerts, second-photo sync, disconnect lifecycle, and the signed-URL refresh helper), so no further Step 2 command/effect expansion was needed.
  - Added `server/runtime/activeFeed.js` as a small runtime boundary for active-category normalization, balanced-feed rebuilding, fallback-feed selection, and scoped refresh checks.
  - Rewired `server/app.js` to consume that runtime module for active-feed refreshes after daily crawls and vision-analysis persistence, and to share one `getActiveCategories` function across recrawl and vision-analysis job wiring instead of re-splitting `currentCategory` inline.
  - Added regression coverage in `run-tests.js` for alias-aware active-category normalization, scoped refresh no-ops, direct active-feed refreshes, and the Scenic Nature fallback path when a selected feed becomes empty after filtering.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repo now states explicitly that the implementation-companion audit step is complete and Step 3 is the active checkpoint.
- **Learning**: The right way to close an audit checkpoint is to codify its conclusion. Once the socket audit showed no missing durable commands, leaving that fact undocumented would have created artificial ambiguity. Extracting a small runtime shell immediately afterward makes the roadmap transition concrete in both code and docs.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. The known sandbox-only live smoke skip still reports `listen EPERM` when a real bind is attempted.

### 2026-07-10: Completed the `server/sockets.js` Transport-Adapter Step by Isolating Legacy Compatibility
- **Goal**: Finish Step 1 of the functional refactor companion by removing the last inline legacy mutation branches from `server/sockets.js` without dropping mixed-version compatibility behavior.
- **Implementation**:
  - Added `server/socketLegacyCompatibility.js` as a dedicated compatibility adapter that owns the old no-dispatch fallback mutation paths for state patches, category/photo updates, pool/admin changes, excluded-keyword edits, screensaver toggles, and Google Photos cache-backed photo mutations.
  - Simplified `server/sockets.js` so it now focuses on shared `decode -> dispatch` listener registration plus explicit async/telemetry handlers, creating the legacy compatibility adapter only when a shared dispatcher is unavailable.
  - Kept the intentionally socket-owned tail explicit in `server/sockets.js`: connection lifecycle, viewport/media-failure telemetry, second-photo preview sync, and on-demand Google Photos signed-URL refreshes.
  - Updated roadmap and agent-facing docs so Step 1 is marked complete and the next companion checkpoint is explicit.
- **Learning**: The cleanest way to finish a transport-adapter refactor is often not to delete every old branch immediately, but to move compatibility behavior behind a named boundary so the live adapter reads as transport code again. Once the fallback path became a separate adapter, the remaining socket module structure matched the functional-core/imperative-shell split much more honestly.
- **Verification**: `npm test` and `npm run lint` passed. The sandbox live smoke bind still skipped with the known `listen EPERM` Unix-socket limitation.

### 2026-07-10: Excluded-Keyword Socket Commands and Ephemeral Socket Tail Now Use Explicit Listener Boundaries
- **Goal**: Continue the Phase 1 `server/sockets.js` thinning work by removing the last durable socket outlier and making the remaining socket-only handlers explicit, injectable, and testable.
- **Implementation**:
  - Moved `update-excluded-keywords` onto the shared `createCommandListener(...)` path, so the socket adapter now decodes and dispatches that durable mutation the same way it already handles category, pool, photo, and admin compatibility events.
  - Added small `createAsyncListener(...)` and `createTelemetryListener(...)` factories plus a declarative listener-registration helper, then used them to isolate `report-tv-viewport`, `report-media-failure`, `set-active-second-photo`, `get-active-google-photo`, and disconnect wiring from the durable command section.
  - Extended the socket environment with injected host-IO dependencies for media-failure alerts, TV display-info reads, and Google Photos signed-URL refreshes, keeping those effects at the shell boundary instead of hard-wiring them into the middle of transport logic.
  - Expanded `run-tests.js` to cover shared dispatch of excluded-keyword socket commands, the legacy excluded-keyword fallback path, viewport telemetry state updates, and the dedicated Google Photos refresh response handler.
- **Learning**: The right endgame for a transport adapter is not “remove every non-command event,” but “make the non-command events obviously non-command events.” Once the durable mutation outlier moved onto the shared listener and the remaining host-IO handlers were wrapped behind explicit factories, `server/sockets.js` read much more like a shell than a second business-rules module.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. The known sandbox-only live smoke skip still reported `listen EPERM` as expected.

### 2026-07-10: Google Photos Photo Mutations Now Share the Reducer/Dispatcher Path
- **Goal**: Continue the Phase 1 `server/sockets.js` thinning work by removing the last Google Photos photo-metadata interceptors from the REST and Socket.IO adapters.
- **Implementation**:
  - Generalized the shared reducer photo-update path so `rate-photo`, `mark-photo-broken`, `set-photo-crop`, `set-photo-prevent-pairing`, and `report-photo-metadata` can update either curated collections or `externalCollections` while keeping `photosList` and playback state coherent.
  - Added a new explicit `persist-external-photo-metadata` effect interpreted by the dispatcher shell, with `server/app.js` wiring that effect to the Google Photos cache writer instead of letting routes or sockets mutate the cache inline.
  - Removed the Google Photos `PATCH /api/photos` special case and the socket interceptors for photo metadata/rating/crop/pairing/broken updates, leaving those transports to decode commands and dispatch them through the shared path by default.
  - Kept a small isolated socket fallback shim for dispatcher-less compatibility, so legacy mixed-version Google Photos control events still patch the cache-backed state without restoring ad hoc transport-owned business logic.
  - Expanded regression coverage in `server/domain/tests.js` and `run-tests.js` for external-photo reducer effects, Google Photos REST photo patch batching, shared socket dispatch of Google proxy photo commands, and the legacy no-dispatch fallback shim.
- **Learning**: The right abstraction boundary was not “special-case Google Photos in every transport,” but “teach the reducer about external collections, then express source-specific persistence as an explicit shell effect.” Once that boundary existed, both REST and Socket.IO could collapse back to ordinary command adapters.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. The known sandbox-only live smoke section still skipped the Unix-socket bind with `listen EPERM` as expected.

### 2026-07-10: Pool/Admin Socket Tail Now Shares the Command Path and Admin Secret Saves Are REST-First
- **Goal**: Continue the Phase 1 `server/sockets.js` thinning work by removing the remaining pool/admin compatibility logic from ad hoc transport branches and moving remote admin secret writes onto a REST-first boundary.
- **Implementation**:
  - Added shared admin-secret decoders in `server/domain/commands.js` plus a `save-env-secret -> persist-env-vars` command/effect pair in the reducer/dispatcher, so admin `.env` writes now flow through the same explicit intent/effect language as the rest of the migration.
  - Added REST admin-secret routes and client helpers for UseAPI and Tumblr credentials, then updated the remote settings UI to save those secrets through REST by default with socket fallback reserved for mixed-version daemons.
  - Refactored `server/sockets.js` so pool keyword updates, feed-config merges, add/delete pool compatibility events, and legacy admin secret-save events all use the shared command-listener factory instead of hand-rolled dispatch branches.
  - Expanded regression coverage in `server/domain/tests.js` and `run-tests.js` for admin-secret command decoding, reducer effect purity, REST admin-secret routing, REST client fallback, and socket compatibility dispatch/ack behavior.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the next explicit socket-tail checkpoint is now the remaining source-local Google Photos exceptions plus intentionally ephemeral telemetry handlers.
- **Learning**: A good transport-thinning slice often needs one more domain effect, not one more socket helper. Once secret persistence became an explicit effect, both REST and Socket.IO could share the same intent without pretending that `.env` writes were just another inline socket side effect.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. The known sandbox-only live smoke section still skipped the Unix-socket bind with `listen EPERM` as expected.

### 2026-07-10: Socket Category and Curated-Photo Compatibility Handlers Now Share the Domain Command Path
- **Goal**: Continue the Phase 1 `server/sockets.js` thinning work by removing the remaining ad hoc category/photo transport logic that already had reducer support elsewhere in the codebase.
- **Implementation**:
  - Added shared photo command decoders in `server/domain/commands.js` for broken-photo and prevent-pairing mutations so REST and Socket.IO stop hand-building those command objects independently.
  - Refactored `server/sockets.js` around a slightly richer command-listener factory with optional interceptors, then moved category selection, active-photo preview, smart next/prev navigation, rating, crop, prevent-pairing, broken-photo marking, and photo-metadata reporting onto shared decode-and-dispatch flows.
  - Isolated the unavoidable Google Photos divergence behind a small source-local metadata interceptor, keeping the transport shell aware only of the cache-backed exception rather than re-encoding the whole mutation path inline.
  - Added regression coverage in `server/domain/tests.js` for the new decoders and in `run-tests.js` for the socket transport path, proving that category/photo compatibility events dispatch the same domain commands when the shared dispatcher is present while the legacy smart-photo fallback still works when it is not.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the next explicit tail is now pool/admin compatibility shims plus source-local Google Photos exceptions.
- **Learning**: A transport adapter gets meaningfully thinner once the remaining “special cases” are split into two buckets: generic command-shaped work that should always decode through the domain layer, and genuinely source-local exceptions that deserve a small, named interceptor instead of another inline branch cascade.
- **Verification**: `npm test` and `npm run lint` passed. The known sandbox-only live smoke skip still reported `listen EPERM` as expected.

### 2026-07-10: ES6+ Cleanup Pass on the Shared Socket Patch Decoder Slice
- **Goal**: Revisit the new socket transport refactor and remove avoidable noise so the code teaches modern JavaScript style more clearly without changing behavior.
- **Implementation**:
  - Refined `server/domain/commands.js` with shared field constants, destructured input handling, and declarative patch construction for `decodeStatePatchCommand(...)`.
  - Tightened `server/sockets.js` with shared category helpers, optional chaining, nullish coalescing, logical assignment (`??=`), destructured patch handling, and small reusable arrow-function utilities for repeated active-photo sync and category parsing paths.
  - Kept the work scoped to readability and intent clarity on the already-refactored transport boundary rather than broadening the migration surface again.
- **Learning**: Once the functional boundary is correct, a second pass for ES6+ clarity is worthwhile. The best cleanup is usually replacing hand-rolled branching and initialization with a few small shared transforms, not adding new abstraction layers.
- **Verification**: `npm run lint` and `npm test` passed. The known sandbox-only live smoke skip still reported `listen EPERM` as expected.

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
  - Updated [ROADMAP.md](./ROADMAP.md) to define a dedicated "TypeScript Migration (Transition Bridge)" stage.
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
  - **Lazy Cache Init**: Modified [vision.js](./server/services/vision.js#L8-L15) to use a `cacheInitialized` boolean flag, ensuring `analysis_cache.json` is read and parsed from disk exactly once per process lifetime instead of on every image evaluation (which previously caused 336 synchronous disk reads).
  - **Circuit Breaker**: Added a failure-counter circuit breaker in `triggerImageAnalysisBackground` inside [app.js](./server/app.js#L320-L330). If 3 consecutive Vision API inference failures are encountered on cache misses, the background analyzer immediately aborts the loop, preventing 336 high-bandwidth image downloads and inference requests.
  - **Test Isolation Bypass**: Updated [system.js](./server/services/system.js#L102-L272) to check `process.env.NODE_ENV === 'test'` and bypass real hardware CPU governor modifications, browser GUI spawns, and global process kills (which were executing `killall` and terminating the production TV screensaver browser).
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

### 2026-07-10 (Phase 20): Collapsed TV Mood Aesthetics Panel
- **Goal**: Minimize the "TV Mood Aesthetics" panel on the Remote Control interface since the user doesn't change it frequently.
- **Changes**:
  - Wrapped the TV Mood Aesthetics section in a native HTML `<details>` element with a `<summary>` header showing the currently selected theme.
  - Added custom CSS to `client/src/index.css` to remove the default browser details marker and style the summary tag inline.
- **Learning**:
  - Using native HTML `<details>` and `<summary>` elements allows clean, state-free collapsible layout adjustments without introducing extra React state variables.

### 2026-07-14 (Phase 21): Resolved Stuck Permanent Collection Toggle
- **Goal**: Resolve the issue where the "Permanent Collection" loved photo toggle on the Remote Control remained stuck in the off position.
- **Changes**:
  - Identified that the backend daemon running in the background was executing an outdated process from July 12th, prior to the loved-photo feature implementation.
  - Restarted the system-wide systemd user daemon using `systemctl --user restart lumina` to pick up the latest code.
  - Verified that PATCH requests to `/api/photos` for `loved: true` and `loved: false` succeed and are written correctly to `curated_collections.json` on disk.
- **Learning**:
  - Always remember to restart background daemons and system-wide services when deploying new backend code or REST endpoints to ensure runtime compatibility.

### 2026-07-18 (Phase 22): Overhauled Repository Documentation for Major Features
- **Goal**: Update `README.md`, `AGENTS.md`, and workspace documentation to comprehensively reflect major features implemented across recent phases.
- **Changes**:
  - **Ecowitt Indoor Sensor Suite**: Documented Ecowitt GW1200 gateway integration, quiet indoor telemetry line on TV View, persistent SQLite snapshot logging (`sensor_history.db`), Grafana Infinity CSV export (`GET /api/environment/history/export?format=csv`), and Remote Control gateway/unit configuration.
  - **Permanent Collection**: Documented loved photo support (`loved: true`) and eviction-proof rotating pool behavior.
  - **QR Code Widget**: Added QR badge toggle documentation across TV View, Remote Control, and state schema.
  - **REST API Endpoints**: Documented expanded REST control surface (`/api/environment`, `/api/environment/history`, `/api/environment/history/export`, `/api/environment/settings`, `/api/photos`, `/api/state/screensaver`).
  - **Architecture & System Diagrams**: Updated Mermaid data flow diagram in `AGENTS.md` and project structure tree to include modular `server/` hierarchy, `sensor_history.db`, and local gateway polling.
- **Verification**:
  - Ran `node run-tests.js` to ensure all unit, domain, and integration tests pass without regression.

---

### 2026-07-20: Clarified Google Photos Picker as an External Source
* **Goal**: Remove the implication that Google Photos is configured inside whichever scenic pool appears nearby in the Image Feeds tab.
* **Changes**:
  * Moved the Google Photos controls to the top of Image Feeds in a separately labelled External Photo Source section.
  * Replaced the obsolete album-link wording with an accurate explanation of the user-initiated Google Photos Picker flow.
  * Added a small pure copy/status module and regression coverage so the Picker wording continues to distinguish external selections from scenic pools.
* **Learning**: When two controls share a page but operate on different data lifecycles, visual grouping and explicit ownership language are part of the functional contract, not cosmetic detail.

### 2026-07-20: Folded Google Photos Picker Out of the Primary Image Feeds View
* **Goal**: Keep the rarely used Google Photos Picker from occupying the first visible section of Image Feeds.
* **Changes**:
  * Moved the Picker section below the scenic feed controls.
  * Wrapped it in a native, collapsed-by-default `<details>` disclosure with an explicit “Optional” affordance.
  * Added regression coverage for its placement and default collapsed state.
* **Learning**: Native disclosure controls provide the smallest state model for infrequent configuration without sacrificing keyboard accessibility.

### 2026-07-20: Indexed Reducer Command Families
* **Goal**: Continue the functional refactor Step 4 readability pass by removing repeated command-family lookup work without hiding reducer behavior.
* **Changes**:
  * Added a pure reducer-family interpreter builder that indexes declarative command entries once in a `Map`.
  * Preserved explicit per-family `now`/`rng` environment adapters and no-op behavior for unsupported, inherited, and null command keys.
  * Added regression coverage for the indexed boundary and deterministic smart playback selection.
  * Updated both roadmap documents with the new Step 4 checkpoint.
* **Verification**:
  * `npm test`: 213 tests executed, 212 assertions passed, 0 failed; the existing sandbox-only live Unix-socket smoke test was skipped with `listen EPERM`.
  * `npm run lint`: 0 errors; the two existing unused-variable warnings remain.
  * `.agents/skills/lumina-diagnostics/scripts/diagnose.sh`: completed successfully; port 5000 and the daemon were inactive, and Mutter DBus was unavailable in the non-GNOME session.

### 2026-07-22: Mention Photo Pool in Independent Rating Deck
* **Goal**: Show the pool name that each photo belongs to in the Independent Rating Deck, making it clear to the user which category/pool the photo comes from.
* **Changes**:
  * Updated `client/src/components/remote/ImageFeedsTab.jsx`'s photo details overlay to include `• Pool: {photo.category || 'Default'}` right next to the author information.
  * Updated the pagination footer at the bottom of the Independent Rating Deck card to display `Card {galleryIndex + 1} of {state.photosList.length} (Pool: {photo.category || 'Default'})` instead of the generic `in active pool` text.
* **Learning**: Rendering the pool/category in the footer ensures it remains visible even when the photo fails to load or is in the preloading state.

### 2026-07-22: Fixed Crawler Blocking & Randomization
* **Goal**: Fix issues preventing the crawler from successfully fetching new photos for the "AI Creations" and other categories (which led to the user seeing the same small number of images for weeks).
* **Changes**:
  * Replaced the hardcoded, blocked Chrome 120 User-Agent in all scrapers (`unsplash`, `reddit`, `tumblr`, `artic`) with a unified, clean custom User-Agent `LuminaScreensaver/1.0.0`. This successfully bypasses the HTTP 403 blocks on Reddit and 307 redirects on Unsplash.
  * Added random search paging offset (`page`) to Unsplash NAPI queries so crawls don't always fetch identical page 1 images.
  * Randomized Wallhaven API search sorting (`sorting`) across `relevance`, `random`, `date_added`, `views`, and `toplist` to retrieve unique photo URLs on each daily run.
  * Augmented the keyless AI Creations crawler fallback by querying Wallhaven with multiple search terms (`cyberpunk landscape surreal` and `surreal digital art dreamscape`) to compensate for the dead Lexica Art API.
* **Learning**: Cloud/sandbox environments often trigger automated IP-based and User-Agent-based scraper blocks. Descriptive, unified User-Agents and query randomization (paging, sorting) are critical to ensure daily updates remain dynamic and resilient against duplicate filtration.

### 2026-07-22: Shared Sequential Async Reduction Boundary
- **Goal**: Continue implementation-companion Step 4 by removing the remaining mutable-loop ceremony from ordered REST command batches while preserving strict dispatch order.
- **Changes**:
  * Added the curried `reduceAsyncSequentially(step, initial)(values)` helper as a small promise-accumulator boundary.
  * Reused it for dispatcher effect interpretation and REST batch command dispatch, preserving effect/result order and route-specific changed-state aggregation.
  * Added regression coverage for partial application, sequential execution, and ordered accumulation.
- **Learning**: Ordered asynchronous work is clearer when its `Chain`-like promise accumulator is named once and reused at both shell boundaries; the domain-specific step functions remain visible and no generic route framework is needed.

## 🧪 Verification & Diagnostics

To run the regression suite, run:
```bash
node run-tests.js
```

A local diagnostic utility script is available at `.agents/skills/lumina-diagnostics/scripts/diagnose.sh` to check port status, daemon status, Mutter DBus connection, and PulseAudio streams.

### 2026-07-22: Made Route Decode Collection Pure and Lawful
- **Goal**: Continue the Step 4 route-decode algebra pass with the smallest remaining imperative boundary.
- **Implementation**:
  - Replaced `collectRouteDecodeResults`' mutable loop with a pure left-to-right reduction.
  - Preserved short-circuit failure semantics while making successful values explicit in the collected result.
  - Added regression coverage for plain and wrapped successful decodes plus the empty-success identity.
- **Learning**: A route decoder collection behaves like a small applicative-style accumulation with a failure short-circuit; making the identity and accumulation visible improves both composability and testability without adding a library.
- **Verification**: `npm test` passed with 213 assertions and 0 failures; lint passed with two pre-existing warnings, and the client production build passed.

### 2026-07-22: Extracted the Indexed Interpreter Boundary
- **Goal**: Continue Step 4 by making the reducer-family lookup boundary reusable without hiding family-specific reducer behavior.
- **Implementation**:
  - Added `createIndexedInterpreter(entries, interpret, fallback)` to the functional utility module.
  - Routed reducer-family command lookup through the helper while preserving explicit environment adapters, last-entry-wins Map semantics, and no-op fallback behavior.
  - Added regression coverage for duplicate-key resolution and inherited-looking unknown keys.
- **Learning**: A declarative command table needs a closed lookup boundary; a small Map-backed interpreter captures that law more directly than repeating object-key dispatch while keeping the domain reducer visible.

### 2026-07-22: Shared Reducer Option Resolution
* **Goal**: Continue Step 4 with a small compositional cleanup after indexing reducer command families.
* **Implementation**:
  * Added one pure reducer-local interpreter for resolving declarative feed/pool options against the same `(payload, command, state)` context.
  * Removed duplicated option-resolution ceremony while preserving default event, effect, persistence, and pool-guard behavior.
  * Added regression coverage across category selection and pool keyword mutation.
* **Learning**: Shared option interpretation is useful when it removes identical context plumbing without merging the distinct state-transition boundaries that make each command family understandable.

### 2026-07-23: Minimal Mode Feasibility Plan
* **Goal**: Investigate replacing the Chromium TV display shell with a lower-resource native/raster presentation mode.
* **Decision**:
  * Keep Lumina's state, selectors, weather, sensor, image-cache, and persistence layers shared.
  * Validate a persistent fullscreen presenter separately from the image compositor; generating a raster frame is not sufficient to replace Chromium.
  * Start the feasibility spike with the host's already-installed ImageMagick delegates, while treating `node-canvas` and any native presenter as optional follow-on dependencies.
  * Preserve Chromium as the default and recovery path until screenshot parity, resource reduction, and presenter recovery are measured on the real GNOME/Wayland host.
* **Learning**: Static raster composition can reproduce a fixed-resolution frame closely, but browser-only effects such as backdrop blur, SVG/font rasterization, CSS animation, and responsive layout need explicit contracts before “exactly the same” can be claimed.
* **Follow-up**: A temporary `canvas@3.2.3` install succeeded and generated a PNG on the host, so native dependency installation is an experiment input rather than a reason to reject `node-canvas`.

### 2026-07-24: Presenter Investigation
* **Goal**: Identify a non-Chromium fullscreen presenter for minimal mode.
* **Findings**:
  * GTK4/GDK, PyGObject, GdkPixbuf, Cairo/Pango, SDL2 runtime libraries, and the Wayland client runtime are already present on the host.
  * No convenient image-presenter executable such as mpv, imv, feh, or swayimg is installed; ImageMagick `display` is available but is an X11 utility and could not open the current SSH display.
  * GTK4/PyGObject is the recommended first presenter spike because it supports the GNOME Wayland/X11 session through one toolkit and needs only to display locally composed frames.
  * SDL2 is the lower-level fallback if GTK's memory or fullscreen behavior is not acceptable. Direct Wayland protocol work is deferred because it expands the display lifecycle surface unnecessarily.
* **Learning**: The presenter should be a small, restartable process separate from frame composition. That keeps `node-canvas` focused on pixels and lets the runtime measure or replace the windowing layer independently.

## 2026-07-31 — Add per-photo acquisition timestamps

- Added pure `addedAt` normalization and immutable stamping in
  `server/domain/photoTimestamps.js`.
- Newly accepted crawler results receive one canonical ISO timestamp through
  an injected clock, making future age-based retention deterministic and
  testable.
- The persistence codec preserves valid timestamps and removes malformed ones,
  but intentionally does not invent dates for legacy photos.
- Kept snapshot-level `lastUpdated` and `lastFeedUpdated` separate from
  per-photo acquisition time; they answer different freshness questions.
- Full regression verification passed: 220 assertions and 11 sensor checks.

## 2026-07-31 — Add pool lifecycle controls

- Added pure per-pool retention policy normalization and a curried pruning
  function. Only dated, non-loved photos can expire; legacy photos without
  `addedAt` remain exempt by design.
- Persisted `poolPolicies` in the curated snapshot and routed updates through
  the shared `PATCH /api/pools/:name` command/spec/reducer path.
- Added Image Feeds controls for retention days and maximum pool size, with a
  short explanation of the protected loved and legacy entries.
- Added domain regressions for policy bounds, pruning semantics, command
  decoding, reducer persistence, and transport route metadata.
- Verification: `npm test` passed with 222 assertions and 11 sensor checks;
  client production build is the remaining final check for this slice.

## 2026-07-31 — Persist lifecycle edits on field exit

- Pool Lifecycle inputs now submit their normalized policy when focus leaves
  either numeric field, in addition to the existing explicit Save button.
- This prevents a changed Max photos draft from looking saved until the user
  leaves and later reopens Image Feeds, where it previously reverted to the
  2,000 fallback.
- Added codec coverage that verifies a saved pool policy survives the curated
  collections persistence round trip.
- Verification: `npm test` passed with 225 assertions and 11 sensor checks;
  `npm run build` in `client/` passed, and the local server serves that rebuilt
  bundle.

## 2026-07-31 — Keep Pool Lifecycle drafts current during save

- Fixed the Pool Lifecycle form so its pure draft merge reads the state updater's
  current draft, rather than a potentially stale render closure.
- A synchronized local draft reference now supplies blur and Save submissions,
  so React event batching cannot send the old 2,000 fallback after a Max photos edit.
- Added client draft and REST refresh regressions covering custom maximum retention.

### 2026-07-31: Close the Dispatcher Effect Vocabulary

- **Goal**: Continue the Step 4 command/effect readability pass by aligning effect lookup with the reducer's closed declarative interpreter.
- **Implementation**:
  - Reused `createIndexedInterpreter` for dispatcher effect handlers before the existing ordered promise-reduce pipeline.
  - Preserved effect order, handler results, and silent unknown-effect behavior.
  - Added regression coverage proving inherited keys such as `toString` and `__proto__` cannot escape the supported effect vocabulary.
- **Learning**: A plain handler object is an accidental prototype-based API. Indexing the declared entries once makes the accepted effect language explicit and keeps the interpreter safely composable.
- **Verification**: `npm test` passed with 223 assertions and 11 sensor checks; `npm run lint` completed with three pre-existing warnings and no errors; `git diff --check` passed.

### 2026-07-31: Close the Dispatcher Event Vocabulary

- **Goal**: Continue the Step 4 command/effect readability pass by applying the closed interpreter boundary to dispatcher events as well as effects.
- **Implementation**:
  - Reused the indexed interpreter for event-handler lookup before invoking the existing ordered event list.
  - Preserved event order and silent handling of unknown event types.
  - Added regression coverage proving inherited keys such as `toString` and `__proto__` are outside the supported event vocabulary.
- **Learning**: Event emission is another small interpreter boundary; keeping the accepted keys closed prevents prototype properties from becoming accidental transport behavior without hiding the straightforward event order.
- **Verification**: `npm test` passed with 224 assertions and 11 sensor checks; `npm run lint` completed with three pre-existing warnings and no errors; `git diff --check` passed.

### 2026-07-31: Share the Closed Dispatcher Interpreter

- **Goal**: Continue Step 4 by removing the duplicated handler-record lookup setup left after closing the effect and event vocabularies.
- **Implementation**:
  - Added the small `createClosedInterpreter` adapter over the existing indexed `Map` interpreter.
  - Reused it for dispatcher effects and events while keeping ordered promise reduction and event emission explicit.
  - Added regression coverage for record adaptation and prototype-key isolation.
- **Learning**: A useful FP abstraction here is a boundary adapter, not a generalized dispatcher: partial application fixes the declared handler record once, while the existing interpreter still defines the closed-key semantics.
### 2026-07-31: Share the Route Presence Guard Algebra

- **Goal**: Continue the Step 4 readability pass by removing the last repeated resource-presence guard ceremony in `server/routes.js` without hiding route-specific status or message policy.
- **Implementation**:
  - Added one pure `createPresenceGuard` factory that maps a presence predicate and failure policy to the existing `null`/route-failure guard contract.
  - Reused it for pool existence, known-pool, missing-pool, and known-photo checks while keeping each route's domain predicate and message visible as data.
  - Verified the existing guarded route regressions for success, missing-resource, duplicate-resource, and invalid-photo paths against the shared factory.
- **Learning**: The useful abstraction was a small algebra over the existing guard result, not a general validation framework; route policy remains explicit and the shared shell only owns the repeated result shape.

### 2026-08-01: Normalize Dispatcher Runtime Flags Before Applying Them

- **Goal**: Continue the selective Step 4 command/effect readability pass at the environment-secret effect boundary.
- **Implementation**:
  - Added `normalizeRuntimeFlags(...)`, a pure record projection that coerces declared runtime flags to booleans without modifying its input.
  - Kept state mutation in the dispatcher shell as one explicit `Object.assign(...)` after environment persistence, replacing the local imperative assignment loop.
  - Added a direct regression for boolean coercion, invalid non-record inputs, and input immutability.
- **Learning**: This is a useful small Functor-like map over record entries: the data transformation stays testable and lawful, while the one necessary state application remains visible at the effect boundary.
- **Verification**: `npm test` passed with 260 assertions and 11 sensor checks; `npm run lint` passed with three pre-existing warnings; `git diff --check` passed.
# Keyword entry accepts pasted phrase lists

- **Implementation**: Keyword fields now accept one phrase per line, commas, or semicolons. Source keyword configuration uses a multiline field, while the shared client and server parsers keep time-scoped keyword entries intact.
- **Learning**: Keyword entry parsing must stay consistent across new-pool creation, feed-source editing, and command decoding so pasted lists do not collapse into one crawler query.

### 2026-08-16: Share the Reducer Clone-and-Continue Boundary

- **Goal**: Continue implementation-companion Step 4 by removing the repeated
  clone/apply/no-op ceremony shared by ordinary state and feed mutations.
- **Implementation**:
  - Added the small higher-order `reduceClonedMutation(state, apply, onChanged)`
    boundary in `server/domain/reducer.js`.
  - Kept ordinary result shaping and feed recomputation/finalization in their
    existing continuations, so the abstraction owns only the truly shared
    boundary.
  - Added a domain regression covering strict no-op identity, changed-state
    cloning, and input immutability across both mutation families.
- **Learning**: A useful functional refactor can be a narrow continuation
  boundary: sharing the clone/apply decision is valuable because it preserves
  no-op identity while keeping domain-specific post-change behavior readable.
- **Verification**: `npm test` executed 239 tests with 237 assertions passed and
  0 failures, plus 11 sensor checks;
  the existing sandbox-only live Unix-socket smoke test was skipped with
  `listen EPERM`.

### 2026-08-16: Add Environment History Statistics

- **Goal**: Expose compact rolling day/night aggregates without requiring
  clients or Grafana queries to materialize the full sensor history.
- **Implementation**:
  - Added SQLite-backed summary and daily aggregation through
    `GET /api/environment/history/stats`.
  - Bounded the rolling window to 1–90 days and normalized day-window hours
    to safe integer values with deterministic fallbacks.
  - Added value-level regressions for averages, empty periods, daily output,
    and malformed query options, plus endpoint wiring coverage.
- **Learning**: Aggregation boundaries should validate query inputs before they
  reach SQL and test computed values, not only response shape; otherwise
  malformed hours can silently produce empty or misleading period buckets.

### 2026-08-16: Share Reducer Result Assembly After Mutation

- **Goal**: Continue implementation-companion Step 4 by removing the remaining
  duplicate event/effect/persistence result assembly between ordinary state and
  feed mutations.
- **Implementation**:
  - Added the pure `buildMutationResult(...)` boundary in
    `server/domain/reducer.js` for resolving dynamic events and effects,
    preserving persistence ordering, and creating the reducer result.
  - Reused it from both state mutation and feed finalization paths while
    preserving feed finalization's richer `{ state, photoChanged }` callback
    context.
  - Added a domain regression proving both mutation families preserve their
    state-sync events and persistence effect ordering.
- **Learning**: The useful abstraction was a context-aware result builder, not
  a generalized reducer framework: shared output algebra can be centralized
  while domain-specific state transitions remain visible at the call site.
- **Verification**: `npm test` passed with 240 tests, 238 assertions, and 11
  sensor checks; the known sandbox-only live Unix-socket smoke test skipped on
  `listen EPERM`.

### 2026-08-16: Reuse the Reducer Result Builder for State Patches

- **Goal**: Continue implementation-companion Step 4 by removing the last
  duplicate durable result assembly in the patch-state reducer.
- **Implementation**:
  - Routed `reduceStatePatchCommand(...)` through the pure
    `buildMutationResult(...)` helper.
  - Preserved patch-local feed recomputation and active-photo selection while
    keeping `state-sync` selection and `persist` before optional
    `refresh-weather` effects in one shared output boundary.
  - Added a focused domain regression for the state-sync event and effect
    ordering contract.
- **Learning**: Result builders are useful at the boundary where reducers have
  already made their domain-specific state decisions; sharing output assembly
  does not require abstracting the patch interpreter itself.
- **Verification**: `npm test` passed with 241 tests, 239 assertions, and 11
  sensor checks; `npm run lint` passed with three pre-existing warnings and no
  errors; `git diff --check` passed. The known sandbox-only live Unix-socket
  smoke test skipped with `listen EPERM`.

### 2026-08-16: Share Photo Mutation Result Assembly

- **Goal**: Continue implementation-companion Step 4 by removing the last
  duplicate reducer result construction in the photo-library mutation path.
- **Implementation**:
  - Routed `reducePhotoLibraryCommand(...)` through the pure
    `buildMutationResult(...)` helper already used by ordinary state, feed, and
    patch mutations.
  - Preserved photo-specific dynamic event selection and the separate
    collection versus external-photo persistence effects.
  - Strengthened regressions for active-photo banning and external metadata so
    their event and effect ordering remains explicit.
- **Learning**: Result assembly is now one shared boundary across all durable
  mutation families, while photo update/finalization and source-local
  persistence policy remain visible as domain-specific continuations.
- **Verification**: `npm test` passed with 240 assertions and 11 sensor checks;
  `npm run lint` passed with three pre-existing warnings and no errors;
  `git diff --check` passed. The known sandbox-only live Unix-socket smoke test
  skipped with `listen EPERM`.

### 2026-08-16: Add the Code Spotlight Gallery

- Added `CODE_SPOTLIGHT.md` as a small reviewable gallery for code that best
  expresses Lumina's functional and aesthetic philosophy.
- Recorded the shared reducer mutation boundary as the current favourite and
  `collectRouteDecodeResults(...)` as an honourable mention.
- The gallery is intentionally append-and-review oriented so future agents can
  compare candidates without erasing the project's evolving design history.

### 2026-08-16: Share Active-Photo Recovery Across Photo Mutations

- **Goal**: Continue implementation-companion Step 4 by removing the remaining
  duplicate recompute-and-recover helper from photo-library mutations.
- **Implementation**:
  - Removed the photo-local `recomputeUpdatedPhotoState(...)` wrapper.
  - Routed active-photo rating and broken-photo finalization through the shared
    `recomputeAndEnsureActivePhoto(...)` continuation used by feed and patch
    mutations.
  - Added a regression proving broken active photos advance once, disappear
    from the visible feed, preserve the input state, and retain event/effect
    ordering.
- **Learning**: A continuation is worth sharing when its state and contract are
  identical across mutation families; keeping each updater and persistence rule
  local preserves the domain distinctions that matter.
- **Verification**: `npm test` passed with 243 tests, 241 assertions, 11/11
  sensor checks, and 0 failures. `npm run lint` passed with three pre-existing
  warnings, and `git diff --check` passed; the known sandbox-only Unix-socket
  smoke test skipped on `listen EPERM`.

### 2026-08-18: Derive Photo Updates and Persistence from One Patch

- **Goal**: Continue implementation-companion Step 4 by removing duplicated
  photo updater and source-local metadata projections.
- **Implementation**:
  - Changed `buildPhotoCommandReducer(...)` to accept one pure
    `buildPatch(payload)` projection.
  - Derived both the immutable `photo -> nextPhoto` update and the
    `persist-external-photo-metadata` payload from that same patch.
  - Kept rating/broken recovery, pairing-preservation, event selection, and
    curated-versus-external persistence policy at their existing call sites.
  - Added a regression covering a partial crop patch across live external photo
    state and persisted metadata, including omission of an undefined field.
- **Learning**: A patch-first boundary is a useful small Applicative-like shape
  here: one normalized value is interpreted by two consumers without coupling
  their effects or hiding the domain-specific finalizers.
- **Verification**: `npm test` passed with 252 executed tests, 250 assertions,
  11/11 sensor checks, and 0 failures. The known sandbox-only Unix-socket smoke
  test skipped on `listen EPERM`; lint and final diff checks remain part of the
  completion gate.

### 2026-08-18: Share the Environment Export Async Shell

- **Goal**: Continue implementation-companion Step 4 by removing the remaining
  environment-history export copy of the route-level async error boundary.
- **Implementation**:
  - Routed both JSON and CSV environment-history exports through the existing
    `createAsyncRoute(...)` higher-order adapter.
  - Kept format detection, CSV content negotiation, and JSON projection local
    to the response handler.
  - Added a regression covering independent JSON and CSV storage failures and
    their shared 503 error contract.
- **Learning**: A response-format branch does not need a second effect shell;
  one async boundary can interpret the request while each pure presentation
  branch remains visible at the transport edge.
- **Verification**: `npm test` passed with 253 executed tests, 251 assertions,
  11/11 sensor checks, and 0 failures. The known sandbox-only Unix-socket smoke
  test skipped with `listen EPERM`.

### 2026-08-19: Share the Client REST Fallback Adapter

- **Goal**: Continue implementation-companion Step 4 at the REST-first client
  transport boundary without duplicating mixed-version compatibility policy.
- **Implementation**:
  - Added the small higher-order `withLegacySocketFallback(...)` adapter in
    `client/src/api/luminaClient.js`.
  - Routed category, screensaver, recrawl, vision-analysis, and admin-secret
    requests through it, keeping each REST request and legacy event payload
    explicit as data.
  - Preserved the compatibility contract: only a missing REST route (`404`)
    emits the legacy Socket.IO event; all other failures remain rejected.
  - Added regression coverage for every fallback family and for non-404 error
    propagation.
- **Learning**: The useful client abstraction is a partial transport policy,
  not a generic action runner: the request remains a factory and the
  imperative socket fallback stays at one narrow compatibility boundary.
- **Verification**: `npm test` passed with 260 tests, 258 assertions, 11/11
  sensor checks, and 0 failures. The known sandbox-only Unix-socket smoke test
  skipped with `listen EPERM`; lint, build, and final diff checks remain part
  of the completion gate.

### 2026-08-19: Share Client Photo-Event Projection

- **Goal**: Continue implementation-companion Step 4 at the client snapshot
  boundary by removing duplicated primary/secondary Socket.IO update logic.
- **Implementation**:
  - Added pure `applyPhotoEvent(snapshot, side, photo)` projection metadata to
    keep legacy active-photo fields and canonical frame fields synchronized.
  - Routed both `photo-update` and `second-photo-update` listeners through the
    same immutable helper while keeping event names and side selection explicit
    at the Socket.IO shell.
  - Added regressions for both frame sides, non-mutation, and identity behavior
    for missing snapshots or unsupported sides.
- **Learning**: A small side-to-field mapping is clearer than two nearly
  identical state-updater closures; the pure projection keeps the event shell
  imperative and the snapshot algebra independently testable.
- **Verification**: `npm test` passed with 262 tests, 260 assertions, 11/11
  sensor checks, and 0 failures. The known sandbox-only Unix-socket smoke test
  skipped with `listen EPERM`; lint, build, runtime, and final diff checks remain
  part of the completion gate.

### 2026-08-19: Share Client Job Status Projection

- **Goal**: Continue implementation-companion Step 4 at the remote UI event
  boundary by removing duplicate recrawl and vision-analysis status machines.
- **Implementation**:
  - Added pure `projectJobStatus(...)` data projection for queued/running,
    succeeded, failed, unsupported, and unknown job states.
  - Routed both job types through one `job-status` Socket.IO listener and an
    explicit job-type-to-React-target table, preserving messages, counts, and
    transient reset timing.
  - Added focused regression coverage for both job families, fallback text,
    counts, failures, and ignored job/status values.
- **Learning**: A shared status algebra makes the event contract reusable while
  leaving setters and timers in the imperative shell; a general event framework
  would obscure the two intentional UI targets.
- **Verification**: `npm test` passed with 263 tests, 261 assertions, 11/11
  sensor checks, and 0 failures. The client build passed; lint passed with the
  three pre-existing warnings; the live service is active with zero restarts
  and serves the rebuilt `index-Bbp4btFi.js` bundle.

### 2026-08-19: Share Async Job Lifecycle

- **Goal**: Continue implementation-companion Step 4 by removing the duplicated
  queued/running/terminal state machine from recrawl and vision-analysis jobs.
- **Implementation**:
  - Added `server/jobs/jobService.js` with a small higher-order
    `createAsyncJobService(...)` interpreter for immutable job snapshots,
    progress merging, active-run reuse, scope normalization, timestamps, and
    terminal error projection.
  - Kept crawler-specific collection updates, analyzer-specific payloads, and
    the recrawl-only legacy completion event in their original job modules.
  - Added a focused regression proving category alias normalization and
    fallback selection remain pure while both existing job-service suites now
    exercise the shared lifecycle.
- **Learning**: The reusable boundary is the job lifecycle algebra; execution
  policy belongs in the injected callback and compatibility behavior belongs
  in the recrawl adapter. This keeps the shared function compositional without
  turning job-specific work into configuration ceremony.
- **Verification**: `npm test` passed with 264 tests, 262 assertions, 11/11
  sensor checks, and 0 failures. The known sandbox-only Unix-socket smoke test
  skipped with `listen EPERM`; lint passed with the three pre-existing
  warnings. This is a server-only change, so no client rebuild is required.

### 2026-08-21: Share Legacy Pool Mutation Shell

- **Goal**: Continue implementation-companion Step 4 by removing repeated
  persistence and broadcast ceremony from the mixed-version Socket.IO pool
  compatibility fallback.
- **Implementation**:
  - Added the higher-order `createPoolMutationFallback(...)` shell to share
    pool existence checks, collection persistence, and state broadcasts.
  - Kept keyword replacement, feed-source merging, and policy assignment as
    explicit injected updates so the compatibility adapter does not hide their
    distinct domain rules.
  - Added regression coverage for canonical policy normalization, all three
    pool mutation families, and missing-pool no-op behavior.
- **Learning**: A compatibility boundary can benefit from a small imperative
  interpreter when its side-effect envelope is identical; the injected update
  remains the functional seam and prevents a generic legacy command framework.
- **Verification**: `npm test` passed with 265 tests, 263 assertions, 11/11
  sensor checks, and 0 failures. The known sandbox-only Unix-socket smoke test
  skipped with `listen EPERM`; lint and final diff checks remain part of the
  completion gate.

### 2026-08-21: Share Legacy Photo Broadcast Shell

- **Goal**: Continue implementation-companion Step 4 by removing repeated
  broadcast ceremony from the mixed-version Socket.IO photo compatibility
  fallback without merging its distinct source and recovery policies.
- **Implementation**:
  - Added one higher-order curated-mutation shell that interprets an explicit
    handled/no-op result before broadcasting.
  - Kept Google Photos metadata updates on their source-local cache/state path,
    and kept active-photo recovery inside rating and broken-photo handlers.
  - Added regression coverage for rating, crop, pairing, and silent missing
    broken-photo reports.
- **Learning**: A boolean handled signal is a smaller lawful boundary than a
  generic mutation framework here: it centralizes the shared effect envelope
  while preserving each fallback's domain-specific update policy.
- **Verification**: `npm test` passed with 266 tests, 264 assertions, 11/11
  sensor checks, and 0 failures. The known sandbox-only Unix-socket smoke test
  skipped with `listen EPERM`; lint, runtime, and final diff checks remain part
  of the completion gate.

### 2026-08-21: Share Dispatcher Typed Handler Invocation

- **Goal**: Continue implementation-companion Step 4 by removing duplicate
  closed type-handler lookup ceremony from dispatcher effects and events.
- **Implementation**:
  - Added the small `createTypedHandlerInvoker(...)` boundary, which resolves
    only declared item types and invokes their handlers without opening
    inherited object keys.
  - Reused it from both effect interpretation and event emission while keeping
    ordered effect results and synchronous event emission as separate shells.
  - Added focused coverage for handled, unknown, and inherited item types.
- **Learning**: Sharing the type lookup is useful here because it is identical;
  the surrounding effect and event algebras remain intentionally separate.

### 2026-08-21: Keep Socket Command Registration Data-Driven

- **Goal**: Continue implementation-companion Step 4 by removing positional
  argument reshaping at the Socket.IO command registration boundary.
- **Implementation**:
  - Changed the command registrar to forward each declarative listener record
    directly to its registration callback.
  - Kept the side-effecting `socket.on` operation in the listener shell while
    preserving dispatch precedence, legacy fallback payloads, interception,
    post-dispatch hooks, and error handling.
  - Added focused regression coverage proving command records remain intact as
    they pass through the higher-order registrar.
- **Learning**: The useful functional boundary here is the data-last registrar;
  it removes an adapter-shaped positional interface without hiding the one
  intentional imperative registration effect.
- **Verification**: Targeted `node run-tests.js` passed with 269 tests, 267
  assertions, and 0 failures. Full lint, runtime, and Git closure remain part
  of the completion gate.

### 2026-08-21: Close Implementation Companion Step 4

- **Goal**: Complete the bounded command/effect readability pass after the
  final acceptance audit, instead of allowing selective cleanup to become an
  indefinite milestone.
- **Audit**:
  - Confirmed standardized reducer result builders, immutable patch specs,
    shared reducer-family interpretation, ordered effect interpretation,
    route-decode composition, guarded REST shells, and declarative Socket.IO
    listener families are covered by the existing regression suite.
  - Confirmed the remaining direct stateful code is either the functional core
    reducer/dispatcher shell or the intentional mixed-version compatibility
    and transport-specific telemetry boundaries.
  - Found no additional Step 4 seam whose abstraction would be clearer than
    the existing explicit code.
- **Decision**: Mark Step 4 complete against its three acceptance criteria and
  advance the implementation companion to Step 5, the client control-surface
  alignment track.
- **Learning**: A selective functional refactor needs an explicit stopping
  rule; once repetition is removed and the shells stay legible, further
  abstraction is maintenance rather than roadmap progress.
- **Verification**: Existing Step 4 regression coverage remains green; the
  closeout gate includes the full test suite, lint, runtime service proof, and
  synchronized Git publication.

### 2026-08-21: Audit the Functional Bar Before Step 5

- **Goal**: Re-evaluate the Step 4 closeout against Lumina's broader standard
  of functional clarity and the planned TypeScript migration before expanding
  the roadmap.
- **Audit**:
  - Confirmed the backend Step 4 criteria still hold: reducer/result/effect
    repetition is consolidated, command families have low ceremony, and the
    reducer shell remains readable.
  - Found a repeated client boundary in `useLuminaActions`: durable state
    actions independently rebuilt the same `patchState -> normalize response ->
    apply snapshot` effect shell.
  - Confirmed the seam can be split cleanly into pure patch projections and an
    imperative React/REST interpreter, which is a better TypeScript transition
    boundary than typing the hook's duplicated closures first.
- **Implementation**:
  - Added `client/src/state/actionPlans.js` with JSDoc-covered, partially
    applicable field and widget patch builders.
  - Reused those builders from the durable state action family in
    `useLuminaActions` while preserving the existing REST endpoints and
    response normalization behavior.
  - Added direct regression coverage for the pure patch vocabulary.
- **Roadmap decision**: Keep Step 4 closed against its explicit backend
  acceptance criteria, but record that the overall functional-programming bar
  is not complete until the active Step 5 client alignment work is finished.
  Strengthened Step 5 acceptance criteria to require pure request projections
  and TypeScript-ready JSDoc contracts.
- **Learning**: A narrow milestone can be honestly complete while a broader
  architectural value still needs a later boundary; the roadmap should make
  that distinction visible instead of reopening a finished step indefinitely.

### 2026-08-21: Make the Functional-Excellence Ledger Continuous

- **Decision**: Treat the improvement record as a standing roadmap operating
  rule rather than a courtesy added only at the end of a refactor slice.
- **Rule**: Every substantive change and every deliberate no-change audit now
  records the design pressure found, the pure/compositional boundary selected,
  the imperative shell intentionally retained, and the supporting evidence.
  Roadmap status must move with any changed direction, acceptance criterion, or
  next seam.
- **Product principle**: Functional clarity, explicit effects, deterministic
  transformations, and teachable composition are application requirements.
  Runtime performance is the proof that those choices are effective, not a
  replacement for them.
- **Learning**: A reference-quality codebase needs a continuously maintained
  explanation of why its abstractions exist and where abstraction should stop;
  otherwise future work can preserve tests while silently losing the design
  standard.

### 2026-08-21: Make Client Mutation Contracts Declarative

- **Goal**: Continue implementation-companion Step 5 by aligning the
  REST-first client request boundary with the server's command vocabulary and
  the planned TypeScript migration.
- **Implementation**:
  - Added `client/src/api/requestPlans.js` with a pure, JSDoc-covered
    `buildMutationPlan` projection for REST path/method/body and temporary
    legacy Socket.IO event/payload contracts.
  - Reused one explicit mutation-plan interpreter from `luminaClient.js` for
    category, screensaver, recrawl, vision-analysis, and admin-secret actions.
  - Preserved intentional shape differences: screensaver uses `{ active }` in
    REST and a boolean in the legacy event; category uses `{ categories }` in
    REST and the serialized selection in the legacy event; secrets use
    `{ token }` in both transports.
  - Added direct pure-plan assertions alongside the existing fallback tests.
- **Functional boundary**: request shape projection is pure and partially
  applicable; `fetch`, error interpretation, and socket emission remain the
  named imperative shell.
- **Learning**: transport compatibility is easier to teach and type when
  endpoint facts are data, but a single generic payload shape would erase real
  protocol differences and weaken the migration seam.
- **Verification**: `node run-tests.js` passed with 271 tests, 269 assertions,
  and 0 failures; the temporary Unix-socket smoke was skipped because the
  sandbox denies `listen` with `EPERM`.

### 2026-08-21: Consolidate Client JSON Transport Contracts

- **Goal**: Continue Step 5 by removing repeated direct JSON `fetch` handling
  from the dashboard, environment administration, and Google credential views.
- **Implementation**:
  - Added `client/src/api/jsonClient.js` with `@ts-check`, reusable JSON
    request/read/post functions, media-type classification, and structured
    request errors.
  - Reused the transport from `luminaClient.js` and migrated the three client
    view boundaries without moving view-specific state, cancellation, or
    presentation policy into the API module.
  - Preserved the environment panel's protection against an HTML/Vite error
    response by making `readJson` enforce the JSON media-type contract.
  - Added focused tests for pure media-type/error projections, read/post
    request shapes, and HTML-response rejection.
- **Functional boundary**: request construction and response interpretation
  are one explicit effectful interpreter; media-type classification and error
  construction are pure values that remain straightforward TypeScript seams.
  React effects still own scheduling, cancellation, state updates, and user
  messaging.
- **Learning**: a shared transport boundary is useful when it removes wire
  ceremony without erasing the caller's policy; the API module should not
  decide how a dashboard, settings editor, or auth form presents a response.
- **Roadmap**: the next Step 5 seam is snapshot normalization and live-sync
  projection, beginning with `useLuminaActions` response application and the
  app-level `state-sync` path.

### 2026-08-21: Reflow the Image Feeds Administration Workspace

- **Goal**: fix the Pool Lifecycle time controls overflowing the narrow remote
  card and reduce the vertical density of the growing Image Feeds tab on both
  desktop and mobile.
- **Research**: [Material responsive UI guidance](https://m1.material.io/layout/responsive-ui.html)
  recommends breakpoint-aware layouts and [bounded fluid text fields](https://m2.material.io/design/components/text-fields.html);
  [PatternFly form guidance](https://www.patternfly.org/components/forms/form/design-guidelines/)
  favors titled field groups for complex forms; and [Carbon's time-picker guidance](https://carbondesignsystem.com/components/date-picker/usage/)
  treats time input as a constrained field group whose parts must not
  horizontally scroll. These patterns support a compact card/grid treatment
  rather than forcing the existing five-column row into a 480px surface.
- **Implementation**:
  - Added `client/src/state/poolLifecycleView.js`, a JSDoc-covered pure
    projection for lifecycle rows and schedule summaries.
  - Reworked the Image Feeds page into a bounded desktop workspace with
    compact lifecycle cards, an explicit automatic-activation fieldset, and
    a two-column source manager that becomes one column on narrow screens.
  - Constrained number/time inputs with `min-width: 0`, `max-width: 100%`, and
    flexible grid tracks so native browser time controls stay inside their
    card.
- **Functional boundary**: lifecycle row selection and schedule labeling are
  deterministic data projections; React retains the imperative draft/save
  shell, and CSS remains the declarative responsive interpreter. No generic
  form abstraction or UI dependency was introduced because it would add
  ceremony without improving this focused TypeScript migration seam.
- **Verification**: focused view-model and source-structure assertions pass as
  part of `npm test` (275 tests, 273 assertions); the client production build
  succeeds. The temporary Unix-socket smoke remains skipped under sandbox
  `listen EPERM`.
- **Roadmap**: Step 5 remains active. The next seam is still client snapshot
  normalization and live-sync projection, beginning with `useLuminaActions`
  response application and the app-level `state-sync` path.

### 2026-08-21: Add Progressive Disclosure to Pool Lifecycle Editing

- **Goal**: reduce the intimidation and visual noise of showing retention,
  maximum-photo, and schedule controls for every pool at the same time.
- **Research**: [Material expansion panels](https://m1.material.io/components/expansion-panels.html)
  recommend collapsed panels that expose summary information before opening a
  lightweight editor. [Carbon accordion guidance](https://carbondesignsystem.com/components/accordion/usage/)
  supports progressive disclosure for long settings surfaces but warns that
  hidden content must remain discoverable. [GOV.UK Details guidance](https://design-system.service.gov.uk/components/details/)
  recommends short descriptive disclosure labels and highlights assistive
  technology considerations. The resulting pattern is a native disclosure
  panel, not a modal or a second settings page.
- **Implementation**:
  - Pool cards are closed by default and expose the current retention, maximum,
    and schedule state as readable summary pills.
  - `Configure` is a clear, keyboard-focusable native summary action with a
    rotating chevron; the expanded panel keeps the existing field-level save
    behavior and adds an explicit `Save changes` action.
  - Summary formatting remains in the pure
    `formatPoolLifecycleSummary(...)` projection; no React expansion state or
    imperative accordion controller was added.
- **Functional boundary**: the policy-to-summary mapping is deterministic and
  tested; `<details>` owns disclosure state as a browser primitive; React
  retains only draft updates and persistence effects.
- **Verification**: the complete test suite remains green at 275 tests and
  273 assertions; client build and lint pass with the three existing warnings.
- **Roadmap**: Step 5 remains active, with snapshot normalization and live
  `state-sync` projection still the next engineering seam after this UI
  refinement.

### 2026-08-21: Preserve Unrelated Pools During Scheduled Activation

- **Incident**: scheduled activation dispatched a singleton
  `select-categories` payload, replacing the user's complete active selection
  with the scheduled pool and silently deactivating every other pool.
- **Correction**: added the pure `appendUniqueCategory(...)` domain helper and
  changed the scheduler to derive `baseline + scheduled pool` immutably. The
  runtime remembers the exact activation selection for manual-override
  detection, then restores the original baseline at the next schedule
  boundary.
- **Functional boundary**: category-set projection and deduplication remain
  pure; the scheduler retains only time evaluation, manual-override state, and
  the explicit dispatch effect.
- **Regression coverage**: the runtime test now starts with Scenic Nature and
  Liminal Spaces active, verifies Night Mood is appended, and verifies both
  baseline preservation and boundary restoration. Domain tests also verify
  helper immutability and duplicate handling.
- **Verification**: `npm test` passes with 275 tests, 273 assertions, and 0
  failures; the temporary Unix-socket smoke remains skipped because the
  sandbox denies `listen` with `EPERM`.

### 2026-08-21: Focusable Image Feeds Workspace Panels

- **Goal**: make the two largest Image Feeds work areas approachable when the
  page contains many controls, while preserving the existing responsive
  desktop/mobile layout.
- **Implementation**: added pure `imageFeedsPanels` state transitions for
  immutable collapse/expand and maximize/restore behavior. The Rating Deck
  and Source Manager now expose labeled buttons with `aria-expanded`,
  `aria-controls`, and `aria-pressed`; focused mode gives one panel the full
  workspace and temporarily hides the other.
- **Functional boundary**: panel identifiers and transitions are pure and
  JSDoc-typed; React interprets them through one small panel component, while
  CSS remains the declarative responsive/focused-layout interpreter.
- **Design decision**: drag-reordering is deferred. A useful implementation
  needs persisted order semantics plus keyboard and touch behavior that does
  not interfere with the Rating Deck crop gesture. Collapse and focused
  editing address the immediate density problem with less interaction risk.
- **Regression coverage**: pure panel-state tests cover immutability,
  independent collapse, automatic reopening on maximize, and restore; source
  assertions cover the accessible controls. Headless Chromium also verified
  maximize/restore, panel-scoped collapse, and the stacked 390px header.
- **Verification**: `npm test` passes with 276 tests and 274 assertions; the
  client production build succeeds; lint passes with the three existing
  warnings; the live service is active with zero restarts and serves the new
  bundle.

### 2026-08-24: Resolve Vision Routes Through the Live Capability Catalog

- **Problem**: persisted vision configuration could name a model that the
  single-card Luminatus router no longer served, causing Lumina image requests
  to target a stale model and receive a 404.
- **Implementation**: normalize the configured API base, query the live
  OpenAI-compatible `/models` catalog, honor the configured model only when it
  is live and vision-capable, and otherwise select a live vision/multimodal
  model. If discovery cannot find one, the request fails closed without
  inventing a model id.
- **Regression coverage**: added a deterministic routing test covering live
  preference, stale preference discovery, and the no-live-VLM case.
- **Verification**: remote `node run-tests.js` passes with 306 assertions;
  targeted vision routing tests pass.

### 2026-10-03: Type the Active Feed Runtime Projections

- **Goal**: continue Step 6 by documenting the category and feed-selection contracts at the extracted active-feed boundary.
- **Implementation**: added local checked contracts for legacy category input, local/external collection maps, active-feed state, and runtime operations. Category normalization and feed assembly remain pure; only the runtime shell assigns `state.photosList`.
- **Regression coverage**: tested comma-separated input normalization, external category availability, hidden-keyword exclusion, category attachment without source mutation, and the checked contract/effect-shell boundary.
- **Next seam**: type the pure input and screensaver-state projections in `server/runtime/idleDaemon.js`, leaving polling and browser/timer/broadcast effects in the runtime shell.

### 2026-10-03: Type the Idle Daemon Projections

- **Goal**: continue Step 6 by making the daemon's host-observation and state-transition boundary explicit before extending contracts across the runtime shell.
- **Implementation**: added local JSDoc contracts for host observations, normalized daemon inputs, current state, transition output, and the closed launch/kill/no-op action vocabulary. Polling, activity suppression, browser operations, interval management, and broadcasts remain in `createIdleDaemonRuntime`.
- **Regression coverage**: tested the inclusive inactivity threshold, combined audio/session blocking, manual and launch-block flags, immutable inputs/state, and the JSDoc boundary.
- **Next seam**: type the pure runtime-context projection in `server/runtime/kioskControl.js`, keeping process, CPU-governor, retry-timer, and logging effects in its runtime shell.
### 2026-10-25: Keep Admin TV Previews From Dismissing the Kiosk

- **Problem**: switching the desktop admin interface into TV View mounts the same dashboard input handlers as the kiosk. Mouse activity in that preview could send a global screensaver deactivation and stop the TV display.
- **Implementation**: `App` identifies the explicitly launched `?mode=tv` kiosk session and passes a dismissal capability to `Dashboard`. The Dashboard defaults to no dismissal capability, so toggled/embedded previews remain visual-only while the kiosk retains input dismissal.
- **Regression coverage**: tested preview activity as inert, and verified the explicit kiosk-mode capability wiring and safe Dashboard default.
- **Verification**: `npm test` passes 717 assertions and all 13 sensor regressions; lint and the client production build pass. The optional Unix-socket smoke check was skipped because the sandbox denies socket creation.

### 2026-10-25: Hide the Pointer Throughout the Active TV Screensaver

- **Problem**: the cursor timeout was scoped to the Dashboard element and was not re-armed when screensaver state changed, leaving the pointer visible in parts of the TV viewport or over an open settings panel.
- **Implementation**: re-arm the three-second timeout on screensaver state changes and apply the cursor-hiding class to the page body for an active TV kiosk. Admin previews do not change page-wide cursor state.
- **Regression coverage**: assert the timeout duration and state dependencies, kiosk-only page-wide class, and CSS cursor suppression.
- **Verification**: `npm test` passes 718 assertions and all 13 sensor regressions; lint and the client production build pass. Host diagnostics found the service and kiosk inactive, so the live TV presentation could not be confirmed in this session.


## Historical agent-guide reference — 2026-11-23

This is preserved reference/history, not a current checkpoint or execution queue.
Its source-specific descriptions reflect the pre-consolidation guide. Current
source, tests, roadmap decisions and verified runtime outrank historical wording.

Current migration checkpoint:
- Accepted Step 6 slice: **fix(types): correlate effect reducer payload and result contracts** (2026-11-23). See the [current engineering checkpoint](./FUNCTIONAL_REFACTOR_ROADMAP.md#step-6-prepare-the-codebase-for-typescript-without-a-premature-rewrite) and [verification/lessons](./DEVELOPER_LOG.md). Step 6 and Phase 1 remain incomplete.
- Next engineering code candidate: preserve key-to-command relationships in the reducer-family registry; see the [companion checkpoint](./FUNCTIONAL_REFACTOR_ROADMAP.md#step-6-prepare-the-codebase-for-typescript-without-a-premature-rewrite). Documentation consolidation precedes commissioning a broader batch.
- Earlier checkpoint entries below retain historical counts and findings; the November 23 constructor slice above is current.
- The preceding Step 6 checkpoint made shared playback active URLs unknown across public reduction, snapshots, legacy rebuilding and dispatch; feed finalization now reuses `DomainState`/`ReducerResult`, and emitter inputs admit raw feed rows. Three runtime regressions and compiler fixtures preserve strict equality, aliases, falsy-to-null projection and native failures. Production executable syntax is unchanged; no restart was needed. The nonzero strict baseline is 307 core, zero fixture, 68 transitive and zero global. That constructor audit is now complete as recorded above. Step 6 remains incomplete.
- The reported TV pointer regression remains open despite isolated built-client cursor tests passing. The actual kiosk was launched with `?mode=tv` and active; physical cursor and live DOM still require verification. `node test_slideshow.js` exercises cursor timeout, rearming, settings and admin-preview boundaries without touching the live daemon.
- Slideshow rotation starts after the first primary image mounts and restarts only when a different primary URL is displayed or the configured interval changes. Metadata, crop, title, secondary-only, and layout updates retain the countdown; loading/retries keep the previous slide's timer until replacement. Report a confirmed broken image once: the server owns recovery selection, so never append a client `next-photo` command. Run `npm run test:slideshow` for deterministic built-client timing/recovery coverage with isolated local images and production command handling. `LUMINA_CHROMIUM_PATH` can override the host Chromium executable.
- Phase 1 Step 1 complete: remote photo-control mutations are REST-first by default.
- Phase 1 Step 2 complete: remote durable state/settings mutations are REST-first by default.
- Phase 1 Step 3 complete: category selection, pool lifecycle, and feed-configuration mutations now use REST by default in operator UIs, with Socket.IO retained as the live sync/event transport.
- Phase 1 Step 4 complete: manual recrawl flows now start through REST-first async jobs, with Socket.IO reduced to live progress/status transport.
- Phase 1 Step 5 complete: manual vision-analysis runs now start through REST-first async jobs, with Socket.IO reduced to live progress/status transport.
- Implementation companion Step 4 complete: the backend command/effect readability pass meets its acceptance criteria. A quality audit found the broader client boundary still needed the same standard; Step 5 is complete with pure state-patch builders, declarative REST-first mutation request plans, a shared JSON transport boundary, and normalized live-sync projections. Step 6 is active for stable JSDoc contracts and TypeScript readiness.
- Step 6 has a strict, no-emit domain baseline: `npm run typecheck:domain` reports 473 core, zero fixture, 69 transitive, and zero global diagnostics with pinned TypeScript 5.9.3; add `-- --details` for all errors. It exits nonzero and is not a clean gate. Domain, legacy and public snapshot feeds, sequential/smart selection, active-photo lookup and current-frame photos use unvalidated `FeedPhoto` fields; generic feed selectors preserve input row types and aliases. Native division, sequential cursor indexing and pairing URL comparison use local dynamic assertions, not validation; coercion and failures remain. Screensaver command lookup checks the first read but preserves the unknown second read and native failures. HTTP category decoding preserves eager native property reads and unknown custom array-join results. `readRequiredString` preserves primitive inputs and original values through native trim truthiness and failures. `trimString` returns unknown native results; `buildWidgetPatch` accepts unknown inputs and retains raw visible values, native key coercion, lookup order and failures. The reducer's `readWidgetPatch` keeps repeated reads, known own enumerable string keys, boolean coercion and skip/failure behavior. `readPatchField` exposes partial identity and generic normalizer contracts while retaining native lookup, repeated reads, callback aliases and the skip sentinel. The reducer's object guard narrows unknown values without checking prototypes or properties; vision/location retain inherited reads and native failures. Config patch specs distinguish raw default reads from generic custom readers and preserve unvalidated flags and immutable writes. The shared patch interpreter keeps generic callbacks, skip/no-op identity, flag truthiness and native failures; its heterogeneous list uses local type erasure. The widget partial-record merge uses a local spread-only assertion; the state-patch reducer has checked input and result contracts, and the shared result builder relates event/effect factories to explicit or default context. Next audit clone/apply mutation helpers. State and snapshot `theme`, `scaleMode`, `splitPortrait`, `splitCropPercent`, `inactivityTimeout`, `slideshowInterval`, `allowOpenAiFallback`, `alignWeather`, `alignTimeOfDay`, and `nightPercentage` are unknown because patches preserve raw values. Legacy rebuilds, weather/night selection and relevant socket toggles use truthiness; night percentage instead uses native division and can throw. The vision fallback gate treats even `"false"` as enabled; explicit boolean consent enforcement is separate hardening work.
- The widget reader returns a partial boolean record; its local spread-only assertion describes its own boolean-valued entries, not arbitrary key presence. `reduceStatePatchCommand` documents domain state, unknown patch, environment and result; eager cloning, conditional environment reads, no-op identity and persistence-before-refresh remain. `buildMutationResult` and `resolveMutationOutput` relate event/effect factories to explicit context or the undefined-only state fallback; preserve unvalidated truthy values, resolution ordering and native failures. Next audit `reduceClonedMutation` and `reduceStateMutation`. The strict baseline is now 473 core, zero fixture, 69 transitive and zero global diagnostics.
- `filterVisiblePhotos` preserves generic raw row types and unknown visibility fields; it returns original aliases after truthy filtering, exact rating comparison and native keyword coercion. Its boolean type predicate and the `uniqByUrl` predicate narrow nullish rows while preserving evaluation order and failures.
- `uniqByUrl` preserves generic unvalidated row types, first truthy URL ownership and native Set equality; keep row aliases and repeated accessor reads unchanged while modeling remaining feed and snapshot contracts.
- `findPhotoInFeed` preserves the input row type and alias, accepts unknown lookup keys, and uses strict equality without validating metadata. Nullish rows can terminate an undefined-key lookup. Active lookup preserves feed-first, curated-then-external precedence; frame, snapshot and smart-selection photos retain raw aliases. Feed-based smart selectors retain their generic input row types.
- `client/src/api/requestPlans.js` keeps REST-first mutation bodies and temporary legacy Socket.IO payloads as pure, JSDoc-covered projections; `luminaClient.js` owns only their fetch/fallback interpretation.
- `client/src/api/jsonClient.js` owns the shared JSON request effect and response/error/media-type contract; dashboard, environment, and credential views keep their state transitions and presentation policies explicit.
- `getStateSnapshot()` uses the strict `readJson(...)` boundary like other client reads, so non-JSON fallback responses cannot enter snapshot state as a parsed empty object.
- `client/src/state/frameSelectors.js` owns the pure `normalizeSnapshotResponse(...)` compatibility projection; direct REST snapshots, `{ state: snapshot }` mutation responses, and Socket.IO `state-sync` payloads share that boundary before React applies state.
- `client/src/state/frameSelectors.js` carries local `@ts-check` contracts for the client snapshot, current frame, photo-event envelope, and crop selectors; keep these shapes client-owned so TypeScript migration does not couple browser code to server-only modules.
- `client/src/state/categorySelection.js` carries the pure category-selection contract and canonical legacy aliases; keep selection inputs unknown-safe and snapshot shapes browser-owned as the checked boundary expands.
- `client/src/state/jobStatus.js` carries the checked pure job-status and legacy-event projection contract; keep job types closed, payload compatibility at the boundary, and React target selection in the effect shell.
- `client/src/state/feedMutations.js` carries checked client-owned contracts for immutable category and feed-source snapshot projections; keep unknown edit inputs at the pure boundary and preserve identity on invalid no-ops.
- `client/src/state/environmentHistory.js` carries checked contracts for pure metric conversion, timestamp formatting, and environment-status presentation; keep adapter-specific readings opaque and presentation fallbacks deterministic.
- `client/src/state/photoCrop.js` carries a checked scalar contract for contain/cover crop baselines and interpolation; preserve its pure numeric formulas and absent-mode cover fallback when extending preview controls.
- `client/src/state/screensaverActivity.js` carries a checked pure event contract for Escape and active-screensaver dismissal classification; only an explicitly launched `?mode=tv` kiosk may dismiss shared screensaver state from input, while admin TV previews remain presentation-only.
- `client/src/state/poolPolicyDrafts.js` carries checked client-owned contracts for normalized policy defaults and immutable, partially applied draft updates; preserve form-string values and nested schedule defaults at this pure boundary.
- `client/src/state/keywordInput.js` carries a checked pure parser contract for pasted keyword phrases and timed feed parameters; preserve exact phrase text and keep malformed input inert at this browser boundary.
- `client/src/state/credentialStatus.js` carries a checked pure acknowledgement contract for credential saves; preserve its success/error projection and keep transport event names and input clearing in the effect shell.
- `client/src/state/cssImage.js` carries a checked pure presentation contract for deterministic CSS image values; preserve its empty-input identity and URL escaping without moving browser style effects into the helper.
- `client/src/state/clock.js` carries a checked pure clock-parts contract; preserve locale/options composition and the separate `{ time, period }` projection without moving formatter or rendering effects into the helper.
- `client/src/components/remote/tvPreview.js` carries a checked pure preview-geometry contract; preserve measured-dimension fallbacks and aspect-ratio fitting without moving DOM measurement or style effects into the helper.
- `client/src/state/poolLifecycleView.js` carries checked client-owned contracts for schedule inputs, lifecycle policy summaries, rows, and policy readers; preserve schedule fallback presentation and keep persistence/React effects outside the pure helper.
- `client/src/components/remote/googlePhotosPicker.js` carries checked client-owned contracts for Picker copy and credential status; preserve the pure visible projection and keep OAuth/transport/React effects outside the helper.
- `client/src/state/actionPlans.js` carries checked client-owned contracts for partially applied durable field and widget patches; preserve pure patch construction and keep API execution/React state effects outside the helper.
- `client/src/state/imageFeedsPanels.js` carries checked client-owned contracts for immutable panel transitions, unknown-safe preference codecs, and injected storage adapters; preserve transient focus semantics and keep browser storage/document effects outside the helper.
- `client/src/api/requestPlans.js` carries checked client-owned contracts for pure REST-first mutation plans and their temporary legacy Socket.IO envelopes; preserve partial plan application and keep fetch/fallback execution in `luminaClient.js`.
- `client/src/api/jsonClient.js` carries checked client-owned contracts for parsed API error payloads, request options, and generic JSON results; preserve media-type/error interpretation at the shared transport edge and keep view-specific state outside it.
- `client/src/state/swipeGesture.js` carries checked pure contracts for touch-coordinate decoding and strict-threshold direction/status projection; preserve its null-safe malformed-input fallback and keep action callbacks/timers in `useSwipeGesture.js`.
- `client/src/state/cropDrag.js` carries checked pure contracts for pointer-coordinate decoding and bounded crop-position projection; preserve its null-safe malformed-input fallback and keep DOM listeners, timeout coalescing, React state, and crop actions in `useCropDrag.js`.
- `server/domain/selectors.js` keeps the visible feed unique while automatic playback rotates eligible pools evenly; rating, weather, and night preferences apply within the chosen pool, and sequence playback round-robins pools with per-pool cursors.
- `App.jsx` is the sole client owner of normalized `state-sync` application; Dashboard effects should derive from its `state` prop rather than registering duplicate raw snapshot listeners. Keep only genuinely local transient guards in the view.
- RemoteControl live acknowledgements should use pure status/event projections plus declarative subscription records when event branches share policy; credential-specific input clearing and job-specific React targets remain in the view effect shell.
- App photo acknowledgements should use the pure side-aware event projection and declarative subscription records; `state-sync`, connection lifecycle, and transport-specific telemetry remain explicit because their policies differ.
- `client/src/state/poolLifecycleView.js` owns the pure lifecycle-row and schedule-summary projection; `ImageFeedsTab.jsx` keeps draft mutation and save effects explicit, while its page-specific CSS supplies the bounded desktop workspace and narrow-screen field reflow.
- Pool lifecycle controls are intentionally collapsed by default with native `<details>/<summary>` panels; keep the summary scannable and descriptive when extending the editor, and do not hide the current policy values behind a generic label.
- Scheduled pool activation is additive: preserve the existing `playback.selectedCategories`, append the scheduled pool only when absent, and restore the pre-schedule baseline when the window ends. Never dispatch a singleton scheduled category as a replacement selection.
- Latest Step 4 slice: the mixed-version Socket.IO compatibility adapter now shares curated photo mutation broadcast ceremony through one higher-order shell while preserving Google Photos source-local updates and silent missing-photo broken reports.
- Latest Step 4 slice: dispatcher effects and events now share one closed typed-handler invoker while keeping their distinct sequencing and emission behavior explicit.
- Latest Step 4 slice: Socket.IO command listeners now select shared dispatch, legacy fallback, or no-handler behavior through one pure command runner, preserving dispatch precedence and legacy payload forwarding.
- Latest Step 4 slice: Socket.IO command listener registration now passes declarative records directly into the listener shell, removing positional reshaping while preserving dispatch, fallback, interception, and error behavior.
- Latest Step 4 slice: the mixed-version Socket.IO compatibility adapter now shares pool existence, persistence, and broadcast ceremony through one higher-order fallback shell while its keyword, feed-config, and policy update functions remain domain-specific.
- Latest Google Photos Picker accumulation correction: completed Picker sessions append/upsert into the persistent source-local pool, preserving ordinary usable rows as well as loved rows. Stable media IDs deduplicate with the latest synced representation winning, existing user metadata retained, and the shared retention/maximum-photo policy applied after the accumulated union. Picker remains the only ingestion path; no daily Google Photos revalidation job is required.
- Google Photos Picker rows retain the API `createTime`; the TV slide title projection formats it as a localized date in the browser's locale and time zone in single and split slides, with the cached title retained when the date is absent or invalid. Single-slide title overlays are limited to Google Photos so other sources keep their existing presentation. Older rows without timestamps need to be selected again through Picker after their Picker session expires.
- Latest Step 6 slice: `server/utils/fn.js` now exposes checked contracts for curried primitives, data-last collection combinators, and closed declarative interpreters; runtime behavior and null-safe identities remain unchanged.
- Latest Step 6 slice: `server/utils/validation.js` now exposes checked contracts for the curried numeric range validator and specialized rating, percent, and crop validators; preserve null-safe identities and inclusive bounds while keeping command decoding outside the pure helper.
- Latest Step 6 slice: `server/config/env.js` now exposes checked contracts for environment-value normalization and the pure replace-or-append content projection; preserve normalized quoting and idempotence while keeping filesystem/process mutation in `persistEnvVars`.
- Latest Step 6 slice: `server/services/sentiment.js` now exposes checked contracts for the curried lexicon counters, declarative RSS headline parser, score classification, and sentiment result; preserve deterministic empty-feed identity while keeping network refresh orchestration outside the pure service.
- Latest Step 6 slice: `server/domain/poolRetention.js` now exposes checked contracts for policy normalization, immutable loved-photo capping, and partially applied retention transforms; preserve prune-then-cap composition while keeping persistence and crawler orchestration outside the pure domain core.
- Latest Step 6 slice: `server/domain/photoTimestamps.js` now exposes an open checked `PhotoRecord` contract for timestamp normalization and immutable stamping; preserve source-specific metadata, malformed-clock no-ops, and the pure boundary while keeping persistence outside the domain helper.
- Latest Step 6 slice: `server/domain/poolSchedule.js` now exposes checked contracts for schedule inputs, policy maps, resolved entries, and local-time evaluation; preserve immutable category appends and deterministic priority selection while keeping interval polling, command dispatch, and restoration in the runtime shell.
- Latest Step 6 slice: `server/domain/snapshot.js` now exposes checked contracts for legacy-state decoding, domain/public snapshot projection, runtime overrides, and the compatibility mutation shell; preserve immutable normalization and current-frame derivation while keeping in-place legacy synchronization explicit.
- Latest Step 6 slice: `server/domain/environmentSettings.js` now exposes checked contracts for device inputs, canonical catalogs, runtime/legacy projections, immutable profile updates, and adapter validation; preserve pure settings projections while keeping config persistence and sensor-runtime updates in `app.js`.
- Latest Step 6 slice: `server/services/ecowitt.js` now exposes checked contracts for vendor payload decoding, canonical indoor readings, settings normalization, validation, and public environment responses; preserve the pure protocol projection while keeping polling, timeouts, logging, and network effects in the adapter shell.
- Latest Step 6 slice: `server/services/sensorHistory.js` now exposes checked contracts for sensor/weather inputs, hourly records, query/statistics results, CSV projection, and the injected SQLite store; preserve invalid-timestamp nulls and limit defaults while keeping database operations in the store interpreter.
- Latest Step 6 slice: `server/services/sensorPlatform.js` now exposes checked contracts for adapter descriptors, registered adapters, public summaries, settings results, and platform methods; preserve alias canonicalization, metadata isolation, and explicit lifecycle/read effects.
- Latest Step 6 slice: `server/services/weather.js` now exposes checked WMO classification contracts; preserve the constant-time mapping and cloudy fallback while keeping geolocation and forecast fetching in the effectful shell.
- Latest Step 6 slice: `server/runtime/environmentRefresh.js` now exposes checked contracts for weather snapshot projections; preserve provider-field projection and absent-current behavior while keeping refresh effects in the runtime shell.
- Latest Step 6 slice: `server/runtime/activeFeed.js` now exposes checked contracts for category parsing, normalization, and balanced feed projections; preserve source collections and keep `photosList` mutation in the runtime shell.
- Active feed choices persist in the gitignored `active_categories.json` across daemon restarts; saved names are filtered against current pools at startup. Keep schedule-only category changes out of this manual selection store.
- Latest Step 6 slice: `server/runtime/idleDaemon.js` now exposes checked contracts for host observations, daemon inputs, and screensaver transitions; preserve the closed action vocabulary and keep polling/browser/timer/broadcast effects in the shell.
- Latest Step 6 slice: `server/runtime/kioskControl.js` now exposes a checked closed contract for its pure runtime-context projection; preserve the exact three-field output and keep process/governor/retry-timer/logging effects in the shell.
- Latest Step 6 slice: `server/runtime/poolSchedule.js` now exposes a checked five-field status projection with detached category arrays; preserve runtime-owned scheduling state and keep polling/dispatch effects in the shell.
- Latest Step 6 slice: `server/utils/routeDecode.js` now exposes generic checked success/failure, map, chain, and collection contracts; preserve legacy bare-value normalization, fail-fast collection, and empty-success identity while keeping HTTP responses in routes.
- Latest persistence slice: `server/config/collectionsCodec.js` keeps exact image URLs unique across persisted pools with a pure first-occurrence projection; startup removes legacy duplicate feed rows while preserving sibling snapshot metadata.
- Latest Step 6 slice: `server/utils/keywordSpecs.js` now exposes checked unknown-safe contracts for normalization, timed specs, equality, and ordered term collection; preserve phrase boundaries and detached nested arrays while keeping configuration effects outside the helper.
- Latest Step 6 slice: `server/config/state.js` now exposes checked contracts for the pure keyword-to-feed-config projection; preserve ordered normalized terms and independent source arrays while keeping mutable `screensaverState` lifecycle explicit at the module boundary.
- Latest Step 6 slice: `server/config/collectionsCodec.js` now exposes open persisted-record inputs and stable normalized/serialized snapshot contracts; keep filesystem reads, writes, and migration recovery in the codec's effectful shell.
- Latest Step 6 slice: `server/config/collectionPhotoProjections.js` now exposes checked curried photo-by-URL and photo-list contracts; preserve unmatched-value identity and immutable mapping while keeping collection/state mutation and persistence in `collections.js`.
- Latest Step 6 slice: `server/config/localSettings.js` now exposes checked local-config and section contracts; tests preserve partial updates, nested Ecowitt units, shallow sensor-history semantics, ignored unsupported patch fields, and input immutability while filesystem writes remain in `saveLocalConfigPatch(...)`.
- Latest Step 6 slice: `server/config/configLoaderProjections.js` now exposes a checked pure defaults/overrides projection and deprecated-secret list; preserve section merge depths and input immutability while file reads and warnings remain in `configLoader.js`.
- Latest Step 6 slice: `server/config/collectionPhotoUpdaters.js` now exposes checked immutable rating, crop, pairing, and broken-photo projections; preserve `parseInt`, partial crop, truthiness, and input immutability while state mutation and persistence remain in `collections.js`.
- Latest Step 6 slice: `server/config/collections.js` and `server/config/configLoader.js` now document checked input and effect-shell contracts; preserve the existing photo mutation, persistence, config-file, logging, and warning behavior.
- Latest Step 6 slice: `updateCachedMediaItemMetadata(...)` documents its cache input, return, and conditional persistence; preserve matched-row return semantics, no-write no-ops, and the test-mode write guard while cache reads and file effects stay in `googlePhotos.js`.
- Latest Step 6 slice: `refreshCachedMediaItem(...)` documents its session fallback, nullable result, missing-item rejection, and cache upsert; preserve Picker requests, cache persistence, and metadata retention in the Google Photos service shell.
- Latest Step 6 slice: `refreshMediaItemUrl(...)` documents media-id and render-option inputs, mock and authenticated URL results, and logged rejection behavior; preserve authentication and network effects in the Google Photos service shell.
- Latest Step 6 slice: `cleanOrphanedMediaFiles(...)` documents active media-id inputs, missing-directory/test-mode no-ops, best-effort cleanup, and reuse of the pure orphan projection; preserve directory reads, unlinking, and warning logs in the Google Photos service shell.
- Latest Step 6 slice: `downloadSyncMediaItems(...)` documents selected-media inputs, cache/test-mode skips, sequential completion, and per-item versus batch failures; preserve pure URL construction and the sequential network/filesystem shell, with isolated effect adapters in tests.
- Latest Step 6 slice: `getCachedMediaItems()` documents normalized render rows, first-usable-id ordering, serialization-based changed-only persistence, and read/write failure boundaries; preserve pure normalization and keep cache reads, conditional writes, and warnings in the service shell.
- Latest Step 6 slice: `buildGooglePhotoContentUrl(...)` documents its pure base-URL/render-option input and string result; preserve independent defaults, ordered crop directives, verbatim base interpolation, empty-base identity, and immutable options without widening production exports.
- Latest Step 6 slice: `isBaseUrlStale(...)` documents its cached-timestamp input and boolean result; preserve absent/falsy short-circuiting, the inclusive 55-minute TTL, future timestamps, and legacy coercion while keeping the clock-dependent predicate in the service shell.
- Latest Step 6 slice: `getValidToken()` documents cached/refreshed token results and rejected authentication/refresh/clock failures; preserve the strict five-minute boundary, legacy expiry coercion, and unvalidated refresh results while keeping token-state mutation, logging, and network effects in the service shell.
- Latest Step 6 slice: `refreshAccessToken()` documents refreshed/synthetic results and rejection effects; preserve encoded OAuth requests, separate mock clock reads, retained refresh tokens, unvalidated payloads, and non-atomic clock-failure updates while keeping token mutation and logging in the service shell.
- Latest Step 6 slice: `exchangeGoogleCode(...)` documents authorization inputs, service-owned mutable token results, and rejection ordering; preserve mock clocks, encoded OAuth requests, truthy refresh-token fallback, persistence normalization/skips, and replaced state after persistence failure while keeping all effects in the service shell.
- Latest Step 6 slice: `getGoogleAuthUrl(...)` documents callback inputs, authorization URL results, and synchronous encoding failures; preserve client-ID-only sandbox fallback, Picker-only scope, native coercion, and branch-specific Unicode handling while keeping credential reads and logging in the service shell. OAuth state and callback validation remain separate hardening work.
- Latest Step 6 slice: `saveGoogleCredentials(...)` documents string inputs, boolean results, and synchronous failures; preserve trim completion before replacement, replacement before persistence, logged failure without rollback, and token isolation while keeping all effects in the service shell.
- Latest Step 6 slice: `isAuthenticated()` documents its synchronous boolean presence contract; preserve native access-token truthiness, ignored expiry/refresh-token/credential fields, and current service-state reads without implying token validity or moving refresh effects into the predicate.
- Latest Step 6 slice: `createPickerSession()` documents synthetic/unvalidated JSON results and branch-specific rejections; preserve the access-token guard, mock clock, awaited token resolution, exact POST metadata, and request-only error logging while keeping all effects in the service shell.
- Latest Step 6 slice: `getPickerSession(sessionId)` documents its string input, synthetic or unvalidated JSON result, and rejection boundaries; preserve native input dispatch, synthetic-session independence, verbatim GET metadata, refresh-token-only authentication, awaited JSON, and request-only logging without HTTP body reads in the service shell.
- Latest Step 6 slice: `listPickerMediaItems(sessionId)` documents its string input, accumulated raw-item result, sequential pagination, and rejection boundaries; preserve encoded queries, one resolved token, ordered array concatenation without deduplication, truthy-token continuation, and rejection without partial results while keeping authentication/network/logging in the service shell.
- Latest Step 6 slice: `deletePickerSession(sessionId)` documents its input, asynchronous Fetch boolean result, and failure boundaries; preserve synthetic no-ops, verbatim DELETE metadata without body reads, authentication outside the request catch, silent HTTP flags, handled request failures, and refreshed-token retention in the service shell.
- Latest Step 6 slice: `syncGoogleAlbum(...)` documents named adapters/options, incoming rows versus the retained union, and ordered effects; preserve append/upsert, metadata, post-union policy, and background downloading while keeping pure union/policy projections outside the orchestration shell.
- Latest Step 6 slice: `findCachedMediaItem(...)` documents exact-id inputs and nullable normalized rows; preserve strict equality, structural filtering, fresh reads, normalization persistence even on misses, and propagated failures while keeping filesystem effects in the service shell.
- Latest Step 6 slice: `readCachedMediaItemsRaw()` documents its unknown JSON result and missing/read/parse fallbacks; preserve fresh UTF-8 reads, unvalidated shapes, detached results, and propagated existence-check/warning-handler failures while keeping filesystem/logging effects in the service shell.
- Latest Step 6 slice: `writeCachedMediaItems(...)` documents native JSON serialization, synchronous UTF-8 writes, and its void result; preserve caller-owned guards, hook ordering, repeated writes, undefined-data rejection, and failures without retry/rollback while keeping persistence in the service shell.
- Latest Step 6 slice: `updateCachedMediaItem(...)` documents normalized-cache whole-row upsert, unconditional persistence, and exact returned-row identity; preserve verbatim Map keys, ordered normalization/input/write effects, caller-owned row policy, and failures without rollback while keeping persistence in the service shell.
- Latest Step 6 slice: `persistGoogleRefreshToken(...)` documents unknown-input normalization, case-sensitive mock skips, synchronous persistence, and void results; preserve native coercion, repeated writes, ignored adapter results, and unchanged failures while keeping token-state assignment with callers and persistence in the service shell.
- Latest Step 6 slice: `isGooglePhotoProxyUrl(...)` documents unknown-input boolean projection and delegated coercion/decoding failures; preserve exact relative vocabulary, one-pass decoding, and non-empty-id truthiness without adding validation or service effects to the pure composition.
- Latest Step 6 slice: `getLocalMediaFilePath(...)` documents unknown-input/string-result and native coercion/path-normalization contracts; preserve suffix-before-normalization and propagated failures without implying containment validation or moving filesystem effects into the pure projection. Media-id validation and path confinement remain separate security hardening work.
- Latest Step 6 slice: `difference(...)` documents generic read-only Set inputs and fresh ordered results; preserve native membership, shallow identity, immutable inputs, and subtraction/union-composition laws without changing the concise data-first projection. Difference is not associative and is not a Semigroup/Monoid operation.
- Latest Step 6 slice: `buildEntriesCommandReducer(...)` relates partially applied target selectors and entry readers to command and clone types. Preserve option spreading, ordered assignment, original-state no-op identity and native failures; the strict baseline remains nonzero at 444 core, zero fixture, 69 transitive and zero global diagnostics. Next audit `buildFieldCommandReducer(...)`.
- Latest Step 6 slice: `getOrphanedFiles(...)` documents read-only array inputs and fresh ordered results; preserve platform basename matching, exact active ids, original paths, duplicates, immutable inputs, concatenation/idempotence/union laws, and propagated native failures while keeping filesystem effects in the cleanup shell.
- Latest Step 6 slice: `fetchMediaItemBytes(...)` refines its local-cache fast-path contract; preserve normalization before file access, Buffer identity, MIME truthiness, repeated reads, authentication bypass, file-failure fallthrough, and pre-authentication/warning-handler rejections while keeping all effects in the service shell.
- Latest Step 6 slice: `fetchMediaItemBytes(...)` documents candidate-URL preparation; preserve awaited authentication, missing/stale Picker refresh precedence, original cached-base fallback, exact ordered deduplication, on-demand resolution only for empty candidates, and preparation failure boundaries in the effect shell.
- Latest Step 6 slice: `fetchMediaItemBytes(...)` documents remote retrieval and final Picker retry; preserve HTTP-only candidate fallback, immediate thrown rejection, decoding and MIME truthiness, original token/hint retention, exact retry uniqueness, empty-buffer differences, and write-before-header partial effects in the service shell. Recovery and validation policies remain separate hardening work.
- Latest Step 6 slice: `applyCachedMediaItemMetadataToState(...)` refines decoding, eager projection, truthy-id precedence, last-match results, aliases, and partial-failure contracts; preserve copied list rows versus in-place active frames and keep pure id/patch projections separate from live mutation. Repeated equal-value patches are value-idempotent, not reference-idempotent; normalization and atomicity remain separate hardening work.
- Latest Step 6 slice: `updateCachedMediaItemMetadata(...)` refines read-before-projection ordering, strict cached-id matching, copied results, changed-only full-cache writes, exact test-mode suppression, and partial failures; preserve the pure merge and keep reader normalization, warnings, and persistence in the service shell. Normalization writes can survive a later invalid input; validation and atomicity remain separate hardening work.
- Latest Step 6 slice: `mergeCachedMediaItemMetadata(...)` refines read-only inputs, strict id matching, shallow copies and last-match aliases, !== change detection, and failures; preserve sparse/falsy entries and all duplicate matches. Projected patches compose right-biased on row values, but changed flags and reference identities do not form a result-envelope Monoid. Keep the pure data-first helper separate from cache I/O; runtime behavior and exports are unchanged.
- Latest Step 6 slice: `buildGooglePhotoMetadataPatch(...)` refines read-only inputs, fixed eager reads, inherited/non-enumerable fields, undefined-only omission, shallow aliases, and exact failures. Preserve fresh plain output and value-idempotence, not reference identity; projected patches compose right-biased, but raw spread with undefined is not preserved by projection. Keep the pure data-first pipeline separate from validation and cache I/O; runtime behavior and exports are unchanged.
- Latest Step 6 slice: `getPickerItemMimeType(...)` refines read-only nested/legacy inputs, truthiness-before-trimming, native coercion, repeated reads, and exact failures. Preserve whitespace suppression of fallback, case/parameters, and normalization stability under flat/nested re-embedding; accessor/coercion effects can survive failures. Keep this pure data-first scalar projection separate from MIME validation and network/cache effects; runtime behavior and exports are unchanged.
- Latest Step 6 slice: `getGooglePhotoMediaItemId(...)` refines unknown inputs, exact relative-prefix/query handling, one-pass decoding, and native failures. Preserve the pure data-first decoder and generated proxy-codec round-trip law, not decoder idempotence; runtime behavior and exports are unchanged. Identifier validation and filesystem containment remain separate security work.
- Latest Step 6 slice: `buildGooglePhotoProxyUrl(...)` refines read-only render options, undefined-only defaults, eager named reads, ordered native coercion, id versus query encoding, crop truthiness, and native failures. Preserve immutable ordinary inputs and the existing codec round-trip law, not builder idempotence; keep this pure data-first projection separate from validation and cache/filesystem effects. Runtime behavior and exports are unchanged.
- Latest Step 6 slice: `getPickerItemDimensions(...)` refines read-only nested/legacy metadata selection, native integer parsing, independent defaults, and failures. Preserve whole-metadata precedence, immutable ordinary inputs, and width-before-height coercion. Safe-integer metadata re-embedding is stable, but large numeric results can change on another pass; do not claim global idempotence. Keep the pure data-first projection separate from validation and cache-row clocks/I/O; runtime behavior and exports are unchanged.
- Latest Step 6 slice: `getPickerItemBaseUrl(...)` refines read-only nested/legacy file selection, truthiness-before-trimming, native string coercion, and failures. Preserve selected-file-only base reads and the builder's cached/legacy fallback after trimming; generated flat/nested re-embedding cases verify scalar stability, not a record endomorphism. Keep the pure data-first projection separate from URL validation and cache-row clocks/I/O; runtime behavior and exports are unchanged.
- Latest Step 6 slice: `extractLegacyBaseUrl(...)` refines unknown-input coercion, exact rejected prefixes, first-equals splitting, and native failures. Preserve fallback ordering and the builder's verbatim head versus the normalizer's extra trimming. Normalized equals-free, non-rejected bases are fixed points, but trailing whitespace before '=' rules out global idempotence. Keep this pure data-first projection separate from validation and cache-row clocks/I/O; runtime behavior and exports are unchanged.
- Latest Step 6 slice: `normalizeCachedMediaItem(...)` refines read-only persisted rows, dimension/base defaults, shallow metadata preservation, proxy defaults, and exact native failures. Preserve truthy-id guards, undefined-only rating defaults, literal-true loved flags, inherited/accessor reads, and immutable ordinary data. Safe-dimension records with own enumerable string ids are value-idempotent, not reference-identical or globally idempotent. Keep this pure data-first projection separate from eligibility, validation, clocks, and cache I/O; executable production code and exports are unchanged.
- Latest Step 6 slice: `isUsableCachedMediaItem(...)` refines read-only structural eligibility, ordered guards, exact mock-prefix bypass, raw refreshability truthiness, and native failures. Preserve inherited/accessor reads, native method dispatch, and immutable ordinary inputs. Direct filtering is idempotent and preserves concatenation and row references; this is neither predicate idempotence nor proof of successful retrieval. Keep the pure data-first predicate separate from validation, authentication, clocks, and retrieval effects; executable production code and exports are unchanged.
- Latest Step 6 slice: `dedupeMediaItemsById(...)` refines read-only generic inputs, first-occurrence ordering, native id coercion, sparse-array traversal, and exact failures. Preserve original row aliases and metadata: trimmed comparison keys do not rewrite ids. Stable-record deduplication is value-idempotent; first-biased deduplicated union obeys Monoid laws, not commutativity or plain-concatenation preservation. Keep the pure data-first filter and private scratch Set separate from validation/cache effects; executable production code and exports are unchanged.
- Latest Step 6 slice: `mergeSyncedItemWithExistingMetadata(...)` refines read-only inputs, latest synced spread precedence, five defined user-edit exceptions, shallow aliases, and native failures. Preserve inherited/hidden user edits, ordered repeated reads, and immutable ordinary inputs. Ordinary own-enumerable records obey associativity, value-idempotence, and empty-metadata identity, not commutativity; inherited records and changing accessors are outside those laws. Keep the pure data-first projection separate from cache I/O, policy, identity matching, and recovery; executable production code and exports are unchanged.
- Latest Step 6 slice: `mergeSyncedMediaItems(...)` refines read-only collections, stable ordering, cached-first/incoming-last duplicates, raw cached-id matching, aliases, and native failures. Preserve shallow cached/matched clones versus unmatched incoming aliases, sparse/native traversal, and ordered phases. Canonical unique-id records obey associative/idempotent Monoid laws with [] identity, not commutativity; duplicate/noncanonical ids are outside those laws. Keep the pure data-first projection separate from policy/cache effects; executable production code and exports are unchanged. Canonical-id hardening is separate backlog work.
- Latest Step 6 slice: `buildCachedMediaItem(...)` refines read-only inputs, fixed-field output, fallback precedence, separate acquisition/base clocks, retained metadata aliases, and exact native failures. Preserve immutable ordinary inputs, truthy existing acquisition dates, repeated id/rating reads, and cached-dimension reset behavior. Keep the data-first helper composition without claiming purity or global idempotence for a clock-dependent builder; executable production code and exports are unchanged.
- Latest Step 6 slice: `getPickerMediaFile(...)` refines read-only inputs, whole nested/flat selection, original aliases versus fresh empty fallbacks, repeated accessor reads, and exact failures. Preserve native truthiness, hidden/inherited fields, and immutable ordinary inputs. Keep the pure data-first selector: stable leaf selection is reference-idempotent, not globally idempotent on arbitrarily nested records. Test-only private capture keeps executable production code and exports unchanged; field fallbacks and cache effects remain with callers.
- Step 6 acceptance audit (2026-10-25): not complete. `types.js` now includes the existing `refresh-active-feed` Effect member; vocabulary-parity and dispatch tests preserve payload/result aliases, ordered completion, optional-adapter no-ops, and failure after state application without pending event emission. No executable production change or export added. Command/effect payload variants and dispatcher dependencies remain after the execution/selector follow-ups below; see the companion audit.
- Latest Step 6 execution-contract slice: shared `ReducerEnvironment` describes Date-valued `now` and callable `rng`; reducer and dispatcher reuse it with explicit `ReducerResult`, `EffectResult`, and `DispatchResult` outputs. Preserve eager truthy defaults even on reducer no-ops, dispatcher missing-command short-circuiting, sequential effects, and pre-effect snapshot semantics. Seven regressions cover replay, immutable inputs, identities, failures, and ordering; executable production code and exports are unchanged.
- Latest Step 6 selector-contract slice: all 23 exported `server/domain/selectors.js` functions document shared domain inputs/results and local selection/update shapes. Ten regressions preserve undefined-only Date/RNG defaults (unlike reducer truthy defaults), equal-turn eligible-pool selection, conditional draws, value-idempotent filters, immutable projections, row aliases, and exact failures. No executable production change or export added; keep the data-first core without an algebraic wrapper.
- Latest Step 6 payload-contract slice: `types.js` now correlates all 25 command names with payload fields and discriminates ten effects; exported decoders document `Command | null`. `dispatch.js` documents mutable dependencies and public methods. Ten regressions preserve pass-through patch/exclusion values, metadata and job payloads, aliases, optional adapters, synchronous override/emission, awaited effect results, and partial failure. Executable production code/exports are unchanged; retain the pure data-first core and existing sequential interpreter.
- Step 6 acceptance re-audit (2026-10-26): incomplete. Fixed the unbalanced `SessionConfig.poolPolicies` declaration; five regressions expose scalar/direct-command state-shape gaps, unvalidated optional photo metadata, and inherited/callable decoder compatibility. Public signatures exist, but `unknown` narrowing, curried/handler type erasure, and compatibility-versus-normalized state remain migration work. No executable production change or compilation claim.
- Next Step 6 checkpoint: establish a scoped no-emit TypeScript diagnostic baseline and compile-time fixtures for command, environment, effect, and selector boundaries; report transitive errors separately. Resolve measured narrowing/inference gaps and model compatibility state explicitly without new runtime validation or blanket `any` suppression. Preserve clock/random injection, balanced playback, and the sequential shell; do not resume unrelated helper polishing.
- `FUNCTIONAL_REFACTOR_ROADMAP.md` is the supporting Phase 1 implementation track for this work, not a separate product roadmap; its step numbers are local to that engineering cleanup sequence.

## ⚙️ Detailed Backend Architecture (`server.js`)

The Node.js backend handles state synchronization, API data proxying, local network discovery, dynamic Unsplash feed crawlers, and the core system daemon loops.

### 1. Core State Management
The server manages a centralized `screensaverState` object, which is broadcasted to all connected clients (TV and Remote controls) on change:
* `activePhoto`: `{ url, title, author }` (Current background image)
* `currentCategory`: `"Scenic Nature" | "Cosmic Space" | "Abstract Art" | "Liminal Spaces" | "AI Creations"`
* `theme`: `"Zen Retreat" | "Cosmic Night" | "Art Museum" | "Cyberpunk Rain"`
* `widgets`: `{ clock, weather, qrcode, particles, auraglow, animations }` (Booleans)
* `photosList`: Array of photo objects within the current category.
* `inactivityTimeout`: Time in milliseconds before screensaver launches (default `600000` / 10 minutes).
* `screensaverActive`: Boolean showing if screensaver mode is engaged.
* `slideshowInterval`: Time in milliseconds between photo rotations (default `120000` / 2 minutes).

### 2. GNOME / Mutter System Screensaver Daemon
Every 2 seconds, the server runs a DBus polling command. To handle different developer names and machine setups, the system **dynamically queries runtime environment properties** (via Node's `os.userInfo()`) to retrieve the correct `uid` (default `1000`) and user `homedir` (default `/home/username`), instead of using hardcoded paths:
```bash
DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/${uid}/bus" busctl --user call org.gnome.Mutter.IdleMonitor /org/gnome/Mutter/IdleMonitor/Core org.gnome.Mutter.IdleMonitor GetIdletime
```
If the system idle time exceeds `inactivityTimeout`, the screensaver is triggered, **unless** audio is actively playing:
* **Audio Playback Guard**: The server runs `pactl list sink-inputs`. If an active stream has `corked: no` or `pulse.corked = "false"`, sound is playing (e.g., a movie or music). The screensaver **will not** trigger to avoid interrupting the user's entertainment.
* **CPU Power Governor Orchestration**:
  - When the screensaver starts, the CPU scaling governor is toggled to `performance` to guarantee liquid-smooth transitions (30/60fps Ken Burns panning and particle effects):
    `echo "performance" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor`
  - When the screensaver is dismissed (via mouse movement, keyboard event, or manual remote command), the scaling governor is restored to the energy-saving `schedutil` profile to run cool and silent:
    `echo "schedutil" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor`

### 3. Chromium Fullscreen Kiosk Launcher & Custom CLI Optimizations
When screensaver activation is triggered, the server spawns Chromium in fullscreen kiosk mode pointing to `http://localhost:5000/?mode=tv`. To ensure it never hangs the PC and has a tiny RAM footprint, it uses highly optimized Chromium CLI flags. It dynamically resolves wayland displays and authorities using the active `uid` and `homedir` to achieve robust startup:
* `--js-flags="--max-old-space-size=256"`: Strictly limits the V8 JS heap memory footprint to 256MB.
* The user service reclaims above 1.5 GiB and caps combined daemon and kiosk memory at 2 GiB. This bounds Lumina's host impact; decoded-image and GPU memory remain part of the cgroup total.
* `--disable-dev-shm-usage`: Avoids exhausting shared memory partitions.
* `--disk-cache-size=52428800 --media-cache-size=20971520`: Restricts disk and media cache to tiny allocations.
* `--disable-gpu-shader-disk-cache`: Eliminates heavy disk write activities.
* `--ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --enable-native-gpu-memory-buffers --use-gl=egl`: Offloads all rendering and compositing straight onto the hardware GPU.
* The launcher runs native Wayland first using the discovered `uid` (`WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/${uid}`), with a dynamic fallback method searching for Xwayland auth files (`.mutter-Xwaylandauth.*`) or using the user's `.Xauthority` file in their `homedir` for X11 fallback.

### 4. Multi-Source Daily Crawler & Keyword Auto-Tagging
* **Wider Selection of Photo Sources**:
  - Lumina maintains a keyless, multi-source wallpaper aggregator pulling from **Reddit subreddits** (`/r/EarthPorn`, `/r/spaceporn`, `/r/astrophotography`, `/r/AbstractArt`, `/r/Generative`, `/r/LiminalSpace`), **Lorem Picsum** random HD photography, the **Bing Image of the Day API** (providing high-quality curated daily wallpapers), and the **Unsplash search API** (NAPI).
  - **AI Creations Feed fallback**: If no paid `USEAPI_TOKEN` is set, the crawler falls back gracefully to a high-quality keyless dual pipeline fetching from **Lexica.art** (with queries like `midjourney landscape surreal dreamscape`) and **Wallhaven.cc** (using custom search query `cyberpunk landscape surreal` filtered for AI-generated landscapes).
  - Feeds are automatically limited to `2000` photos maximum per category and stored in `curated_collections.json` to enable offline resilience.
* **API Bot Gateways & Scraper Protection Rules**:
  - **Unified Custom User-Agent Required**: All keyless crawler requests (Reddit, Unsplash, etc.) must use a clean, descriptive custom `User-Agent` (e.g. `LuminaScreensaver/1.0.0`) instead of hardcoded browser headers. Browser-like User-Agents without complete browser header sets trigger scraping detection gateways (like Anubis or Reddit's bot shields) and fail with redirects or 403 blocks even on residential IPs.
  - **Query Randomization**: Always randomize search sorting (Wallhaven `sorting`) or search paging offset (Unsplash NAPI `page`) on each crawl. Because the backend filters out duplicate URLs globally, static query results will be discarded on subsequent runs, freezing the pool size.
  - **Dead API / Scraper Fallbacks**: Lexica.art is currently deprecated and returns HTTP 500. Multi-query fallback queries to Wallhaven AI search should be used to compensate and maintain AI Creations pool size.
* **Robust Unsplash CDN Parsing (Avoiding 404s)**:
  - To prevent HTTP 404 broken links that occurred under legacy template patterns (e.g. `photo-${photoId}` templates), the Unsplash crawler pulls the direct raw CDN path (`item.urls.raw`) directly from the Unsplash API JSON payload.
* **Automated Keyword Tagging**:
  - During crawler execution and startup initialization, all images are dynamically scanned for keyword tags to support environmental matching.
  - Keywords are matched to classify photos across five atmospheric states:
    - `isNight`: Matches sunset, midnight, night, stars, dark, space, moon, etc.
    - `isRain`: Matches rain, storm, wet, stream, dewy, drizzle, puddle, etc.
    - `isSunny`: Matches sun, clear, bright, golden, morning, summer, daylight, warm, etc.
    - `isCloudy`: Matches mist, fog, cloud, misty, hazy, overcast, moody, eerie, shadow, silent, empty, etc.
    - `isSnowy`: Matches snow, winter, ice, frozen, cold, alpine, etc.
* **Fused Weather & News Sentiment Smart Alignment**:
  - Toggled via the **Atmospheric & News Sentiment Alignment** panel on the Remote Control.
  - The system merges **live meteorological conditions** (retrieved from Open-Meteo) with today's **Canada-configured Google News RSS sentiment** (`en-CA` / `CA`):
    - **News Sentiment Analyzer**: Scrapes today's latest top headlines in real-time, matching words against heuristic positive and negative lexicons to calculate a net emotional score.
    - **Correlation Mapping**:
      - Highly negative sentiment (score $\le -0.1$) maps to **Stormy/Rainy** wallpapers (reflecting a turbulent, dark day).
      - Highly positive sentiment (score $\ge 0.1$) maps to **Sunny/Golden** wallpapers (reflecting a bright, optimistic day).
      - Neutral sentiment maps to **Cloudy/Moody** wallpapers.
    - **Atmospheric Fusion Rule**:
      - If physical weather reports active snowfall, **Snowy** photos are prioritized.
      - If physical weather reports active rainfall, **Rainy** photos are prioritized.
      - Otherwise, the room's mood is set by the configured Canadian news sentiment (prioritizing Sunny, Cloudy, or Rainy/Moody wallpapers accordingly).
    - Photos matching these atmospheric filters are served with an **80% preference weight** to preserve surprise while aligning the living space with the emotional and physical state of the world outside. Under night hours, this integrates with the user's evening/night photo ratio slider.

### 5. Local Environment & Sensor Telemetry Platform
* **Gateway Adapter (`server/services/ecowitt.js`)**:
  - Polls gateways and consoles exposing Ecowitt's generic local HTTP API at configurable intervals (default 60s) for indoor temperature, humidity, and barometric pressure. GW1200 is the first verified device.
  - Normalizes metric units (`temperatureC`, `humidityPercent`, `pressureAbsoluteHpa`, `pressureRelativeHpa`) while handling missing fields or stale network states defensively without interrupting Open-Meteo outdoor weather calculations.
* **Saved Device Profiles (`server/domain/environmentSettings.js`)**:
  - Retains named sources with a registered adapter, address, polling interval, and timeout while running exactly one active source. Existing flat `config.ecowitt` settings migrate automatically and remain available as a compatibility projection.
* **Persistent SQLite Sensor Storage (`sensor_history.db`)**:
  - Stores hourly environmental snapshots in SQLite, persisting full raw `gateway_metrics` payloads to retain optional multichannel, air quality (PM2.5), rain, wind, and leaf sensor blocks without requiring schema migrations.
* **Grafana & CSV Export API**:
  - `GET /api/environment/history/export?format=csv` projects sensor history directly into CSV format for Grafana Infinity plugin integration, spreadsheet analysis, and archival downloads.
* **Display Units & Remote Controls**:
  - Presentation display units are configurable from Remote Control → System → Environment. The adaptive admin uses a list–detail manager on expanded windows and a stacked phone layout. Polling is represented by the mutually exclusive active source; the separate semantic switch only controls whether indoor readings appear on the TV.

### 6. API Endpoints
* `GET /api/environment`: Resolves current normalized indoor environment readings, observation timestamp, and gateway availability status.
* `GET /api/environment/history`: Returns historical hourly environment snapshots (supports `from`, `to`, and `limit` query parameters).
* `GET /api/environment/history/stats`: Returns rolling day/night temperature and humidity aggregates (supports `days`, `dayStart`, and `dayEnd`).
* `GET /api/environment/history/export`: Exports environment history as CSV (`?format=csv`) or JSON for Grafana Infinity plugin and direct downloads.
* `GET /api/environment/settings` / `POST /api/environment/settings`: Reads or updates saved device profiles, the active source, connection timing, and display unit preferences. Legacy flat Ecowitt payloads remain accepted.
* `GET /api/environment/adapters`: Lists registered sensor adapters and capabilities. Ecowitt is the first adapter; new protocols should implement the shared sensor-platform contract instead of changing storage or widget consumers.

Ecowitt compatibility uses the vendor’s published local HTTP API endpoint `GET /get_livedata_info`; refer users to the [official Ecowitt HTTP API protocol](https://oss.ecowitt.net/uploads/20260109/HTTP%20API%20interface%20Protocol%20%28Generic%29-%28V1.0.5-2025-10-08%29.pdf) when evaluating gateway or sensor compatibility.
* `GET /api/weather`: Resolves location weather from the Open-Meteo API.
  > [!NOTE]
  > The server uses the location configured in the local gitignored `config.json`, with optional automatic IP geolocation when enabled.
* `GET /api/photos?category=...`: Returns current photos list for the category, updating active photo selection if needed.
* `PATCH /api/photos`: REST mutation endpoint to update photo ratings, loved status, crops, and side-by-side pairing preferences.
* `POST /api/photos/next` / `POST /api/photos/prev`: Advance or rewind photo selection through the balanced visible feed order.
* `POST /api/jobs/recrawl`: Queue a background recrawl job with Socket.IO status reporting.
* `POST /api/jobs/vision-analysis`: Queue a background vision-analysis job with Socket.IO status reporting.
* `POST /api/pools` / `DELETE /api/pools/:name` / `PATCH /api/pools/:name`: Create, delete, or update pool configurations and feed sources.
* `GET /api/state` / `PATCH /api/state`: Read or patch system state and widget settings.
* `POST /api/state/categories`: Switch active photo category.
* `POST /api/state/screensaver`: Kiosk screensaver activation toggle (`active: true|false`).
* `GET /api/config`: Exposes local IP addresses and ports to allow QR coupling of mobile screens.

### 7. Safe Read-Merge-Write Persistence & Ratings Engine
Lumina implements a highly robust database persistence and rating system located under `server/config/collections.js` to manage wallpapers without losing user preferences:
* **Safe Read-Merge-Write Persistence (`saveCuratedCollections`)**:
  - To prevent background daily crawls or crawler actions from wiping out existing metadata (like manually selected location settings, auto-location toggles, or keyword settings), the system performs a read-merge-write sequence before persisting to `curated_collections.json`.
  - It parses the current JSON file, merges the new feeds, search keywords, and location configurations together, and then writes the result atomically back to disk.
* **Instant Skip & Prune on Banned Photos (Rating 1)**:
  - If a photo's rating is set to `"1"` (Banned or Broken):
    - The photo is instantly pruned from `state.photosList` in memory.
    - If the banned photo is currently active on the TV view (`state.activePhoto`), both the POST handler and the socket ratings handler trigger an **immediate, real-time transition** to the next available smart photo in the feed, pushing a socket `'photo-update'` event to keep the TV screen responsive.
* **Test-Mode Database Write Protection**:
  - To prevent unit testing workflows or automated tests from corrupting the production database, all fs writes are guarded by checking `process.env.NODE_ENV !== 'test'`.

## 🎨 Detailed Frontend Architecture (`client/`)

The client is built using React (Vite) and styled with raw vanilla CSS to enable premium responsive interfaces.

### 1. Dual-Device Presentation Modes (`App.jsx`)
* The frontend automatically detects its running environment.
* If a touch-based viewport or mobile user-agent is found, or if `?mode=remote` is in the URL, it loads **Remote Control Mode** (`RemoteControl.jsx`).
* Otherwise, it loads the **TV Dashboard View** (`Dashboard.jsx`). A floating switcher button is available to toggle views manually.

### 2. TV Dashboard UI & Environmental Animations (`Dashboard.jsx`)
* **Double-Buffer Slideshow (DOM Bound)**: The frontend keeps at most two slide elements mounted (one fading out and one active). It preloads the incoming image through a detached native `Image()` element before mounting it. This bounds the slide DOM; total process memory also depends on decoded images, browser processes, and GPU allocations and has not yet been measured against a resource budget.
* **Connectivity-Aware Media Recovery**: The detached native-image preload is the single authoritative load path; rendered slides do not issue a second hidden-image request. Transient failures retry through a deterministic 1s/2s/4s/8s backoff, probing the image origin first and holding the current slide while that host is unreachable. A URL is marked broken and skipped only after the host is reachable and all bounded retries fail.
* **Bokeh Canvas Particle Engine**: An HTML5 canvas renders ambient dust motes at a backing resolution downscaled to 0.25x and scales it back up through CSS. CPU impact depends on display resolution and host hardware.
* **Weather Overlay animations**: Custom CSS animations trigger based on active weather codes (Drifting clouds, falling rain drops, and organic drifting snow flakes).
* **Continuous Ambient Display & Auto-Hiding Cursor**: Renders TV Dashboard elements directly (clock, weather, widgets, wallpaper slideshow, bokeh particles) without pitch-black dimming overlays. The active TV kiosk hides the pointer across the page after three seconds without mouse movement, including when a settings panel is open.

### 3. Mobile Remote Control (`RemoteControl.jsx`)
* **Direct Gesture Control**: Features an interactive swipe pad. Swiping left or right fires Socket.io pagination events. The pad background displays a darkened real-time preview of the active TV photo.
* **Mood Aesthetics Panel**: Toggles the overall theme profile of the screensaver.
* **System Switchboard**: Enables remote control of individual TV widgets (clock, particles, weather, aura backlights, Ken Burns pan-and-zoom) and transitions.
* **Google Photos Connector Layout**: A configuration interface ready to receive Google OAuth client credentials for direct private album casting.
* **Image Feeds workspace**: Curated Scenic Categories, Independent Rating Deck, Scenic Feed Source Manager, and Google Photos Picker are first-class panels in one ordered workspace. Immutable panel state remembers open/collapsed preferences and keyboard-accessible order changes in browser storage, while focus mode is transient and Escape restores the initiating control. Pool Lifecycle remains a nested native disclosure inside Categories; pointer drag-reordering remains deferred because the rating deck already uses pointer gestures for crop positioning.

## 🛰️ Real-Time Socket.IO API Contracts

Socket.IO remains the real-time synchronization channel, but durable control and settings work should continue migrating toward REST mutations backed by the shared domain command path.

| Event Name | Direction | Payload Schema | Action / Purpose |
| :--- | :--- | :--- | :--- |
| **`state-sync`** | Server ➔ Client | Full `screensaverState` object | Broadcasts full unified state to keep remote and TV dashboard completely in sync. |
| **`photo-update`** | Server ➔ Client | `{ url, title, author }` | Directs clients to transition to a specific image. |
| **`ip-info`** | Server ➔ Client | `{ localIps: String[], port: Number }` | Sent on connection to help build the QR coupling links. |
| **`toggle-widget`**| Client ➔ Server | `{ widgetName: String, visible: Boolean }` | Show/hide widgets (e.g. `clock`, `weather`, `particles`). |
| **`change-category`**| Client ➔ Server | `String` (Category Name) | Switches active wallpaper feed and picks a random starting photo. |
| **`change-interval`**| Client ➔ Server | `Number` (Interval in milliseconds) | Sets slide rotation cycle duration (15s, 1m, 2m, 5m). |
| **`set-active-photo`**| Client ➔ Server| `{ url, title, author }` | Forces a specific wallpaper selection. |
| **`next-photo`** | Client ➔ Server | *None* | Iterates to the next photo in the active category array. |
| **`prev-photo`** | Client ➔ Server | *None* | Iterates to the previous photo in the active category array. |
| **`change-theme`** | Client ➔ Server | `String` (Theme Name) | Switches color scheme and glow filters across all interfaces. |
| **`set-screensaver-active`**| Client ➔ Server| `Boolean` (Active state) | Toggles manual override. `true` forces Kiosk launch, `false` forces Kiosk dismissal. |
| **`toggle-align-time`**| Client ➔ Server| `Boolean` (Enabled) | Toggles evening/night image alignment during night hours. |
| **`toggle-align-weather`**| Client ➔ Server| `Boolean` (Enabled) | Toggles rainy image alignment when active precipitation is detected. |
| **`change-night-percentage`**| Client ➔ Server| `Number` (0-100) | Adjusts the percentage slider of evening/night photos displayed. |

## 🌈 CSS Mood Theme Systems

Styles are managed under `client/src/index.css` via custom theme profiles defined by classes:

1. **`theme-zen-retreat`** (`🌿`)
   * Accent: Soft Sage Green (`#86efac`)
   * Ambient Glow: Pale organic green gradients.
   * Atmosphere: Calming, naturalistic lighting.
2. **`theme-cosmic-night`** (`🪐`)
   * Accent: Deep Space Violet (`#a855f7`)
   * Ambient Glow: Cosmic purple and stellar dust nebula shaders.
   * Atmosphere: Mystic, late-night deep-space aesthetic.
3. **`theme-art-museum`** (`🏛️`)
   * Accent: Warm Gallery Gold (`#f59e0b`)
   * Ambient Glow: Soft gold-sepia warm spotlight vignette filters.
   * Atmosphere: Sophisticated, quiet gallery ambience.
4. **`theme-cyberpunk-rain`** (`🌧️`)
   * Accent: Neo-Tokyo Magenta (`#ec4899`)
   * Ambient Glow: High-contrast neon blue and pink overlays.
   * Atmosphere: Vibrant, wet futuristic urban environment.


## Historical roadmap checkpoints — 2026-11-23

Preserved history/reference only; current intent and implementation status belong
to ROADMAP and its companion checkpoint. Earlier compiler/runtime statements are
not current runtime evidence.

## Execution Status

Phase 1 is in progress. The current checkpoint is:

- Playback correction (2026-10-23): rotation restarts when a different primary image mounts, giving it the full configured interval. Metadata, crops, secondary images, and layout updates keep the countdown. Broken-image recovery sends one report and lets the server select the replacement; deterministic fixture-browser regressions cover timing and recovery without using live pools.
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
- Latest Step 6 slice (97): `getPickerMediaFile(...)` refines read-only inputs, whole nested/flat selection, original aliases versus fresh empty fallbacks, repeated accessor reads, and exact failures. Seven focused tests use declarative cases, frozen records, and test-only private capture. Preserve the pure data-first selector: stable leaf selection is reference-idempotent, but arbitrarily nested records are not. Executable production code and exports remain unchanged.
- Step 6 acceptance audit (2026-10-25): corrected the missing `refresh-active-feed` Effect member, with vocabulary-parity and ordered dispatch regressions. Execution, selector, and payload/dependency contracts subsequently landed; the re-audit below supersedes the original remaining-work list.
- Done: Step 6 execution contracts name `ReducerEnvironment`, `ReducerResult`, `EffectResult`, and `DispatchResult` at the reducer/dispatcher boundary. Seven regressions preserve replay, truthy defaults, no-op identities, failure propagation, and pre-effect snapshot/result ordering. Executable production code and exports are unchanged.
- Done: Step 6 selector contracts cover all 23 exported functions using shared domain shapes and named selection/update inputs/results. Ten regressions preserve balanced playback, conditional randomness, undefined-only defaults, immutable projections, aliases, and exact failures. Executable production code and exports are unchanged.
- Done: Step 6 contracts name 25 command payloads, ten effects, nullable decoder results, and dispatcher dependencies/public methods; ten regressions preserve compatibility and ordered shell effects.
- Step 6 acceptance re-audit (2026-10-26): still incomplete. Corrected an unbalanced `SessionConfig.poolPolicies` declaration and added five regressions. Public signatures are documented, but scalar patches/optional direct payloads can exceed declared state shapes, optional photo metadata is unvalidated, decoder `unknown` narrowing is incomplete, and curried/heterogeneous interpreters erase type relationships. See the companion evidence matrix; runtime code/exports are unchanged.
- Step 6 compiler baseline (2026-10-27): `npm run typecheck:domain` runs pinned TypeScript 5.9.3 in strict, no-emit mode and reports core, fixture, transitive, and global diagnostics separately. The baseline is intentionally red: 541 core, two fixture inference assertions, 68 transitive, and zero global diagnostics. Runtime behavior is unchanged.
- Step 6 narrowing slice (2026-10-29): a checked object predicate removes the ten measured `decodeStatePatchCommand` unknown-input diagnostics and its own implicit-any diagnostic without changing executable behavior. That checkpoint reported 530 core, two fixture, 68 transitive, and zero global diagnostics.
- Step 6 curried-patch slice (2026-10-29): the local boolean patch builder now documents direct, partial, and empty applications with unknown-safe keys/values and potentially absent lookup results. Runtime coercion and call conventions are unchanged. That checkpoint reported 530 core, one fixture, 68 transitive, and zero global diagnostics.
- Step 6 handler-invoker slice (2026-10-29): a local generic contract retains the heterogeneous result union and undefined fallback without claiming payload/key correlation. Capture, identity, unawaited results, and failure behavior are unchanged. The scoped count is 530 core, zero fixture, 68 transitive, and zero global diagnostics; the compiler remains nonzero.
- Step 6 preview-input slice (2026-10-30): active-photo commands now distinguish unvalidated preview objects from selector-facing `Photo` values. Tests preserve object aliases, native URL reads, arrays, callable input behavior, and shallow feed copies. Runtime behavior and the 530/0/68/0 diagnostic counts are unchanged.
- Step 6 theme-compatibility slice (2026-10-30): legacy, domain, and public snapshot contracts now expose `theme` as unknown, matching raw patch and snapshot behavior. Tests cover aliases, falsy values, undefined no-ops, and the distinct direct-command coercion. Runtime behavior and the 530/0/68/0 diagnostic counts are unchanged.
- Step 6 timing-compatibility slice (2026-10-30): legacy, domain, and snapshot timing values are unknown because patches and rebuilds preserve raw inputs. Tests cover aliases, falsy values, undefined and the direct interval command's numeric coercion. Runtime behavior and the 530/0/68/0 diagnostic counts are unchanged.
- Step 6 scale-compatibility slice (2026-10-30): legacy, domain, and snapshot `scaleMode` values are unknown because raw patches and rebuilds preserve them. Tests cover aliases, falsy values, undefined, and the direct command's no-op and persistence behavior. Runtime behavior and the 530/0/68/0 diagnostic counts are unchanged.
- Step 6 split-crop compatibility slice (2026-10-30): legacy, domain, snapshot, and derived secondary-frame crop values admit unknown inputs. Tests distinguish raw patches, nullish defaults, photo crop precedence, and direct numeric coercion. Runtime behavior and the 530/0/68/0 diagnostic counts are unchanged.
- Step 6 split-portrait compatibility slice (2026-10-30): legacy input and domain/snapshot state admit unknown values. Raw patches retain aliases; legacy rebuilds, direct commands, and frame eligibility use truthiness. Tests cover falsy values, truthy objects and strings, omitted patches, and persistence. Runtime behavior and the 530/0/68/0 diagnostic counts are unchanged.
- Step 6 fallback-consent compatibility slice (2026-10-30): legacy input and domain/snapshot state admit unknown values. Tests cover raw patches, aliases, legacy rebuilds and socket-toggle truthiness; the vision fallback gate also checks truthiness. Runtime behavior and the 530/0/68/0 diagnostic counts are unchanged.
- Step 6 weather-alignment compatibility slice (2026-10-30): legacy input, domain/snapshot state and weather selector inputs admit unknown values. Patches retain aliases; rebuilding, the socket toggle and selection use truthiness. Regression and compile fixtures preserve these distinctions without executable changes; the 530/0/68/0 baseline remains nonzero.
- Step 6 time-alignment compatibility slice (2026-10-30): legacy input, domain/snapshot state and night selector inputs admit unknown values. Raw patches retain aliases; rebuilding, the socket toggle and night preference use truthiness. Tests preserve disabled/daytime identity, conditional random draws and smart selection without executable changes.
- Step 6 night-percentage compatibility slice (2026-10-30): state, snapshots and selector inputs admit unknown values. Raw patches preserve aliases, legacy rebuilds default only nullish inputs, and the socket path validates separately. The selector preserves native numeric coercion and failures; tests and compiler fixtures cover these distinctions. Executable behavior is unchanged; the honest operand type exposes one additional TS2362 diagnostic.
- Consent hardening follow-up: a raw `allowOpenAiFallback: "false"` patch is truthy at the vision fallback gate. Decide and enforce an explicit boolean consent contract across REST, sockets, and legacy state separately, with compatibility and fallback-request tests; this contract slice does not change that behavior.
- Step 6 feed-lookup slice (2026-10-30): `findPhotoInFeed` now preserves generic row metadata and admits unknown lookup values without implying normalization. Tests cover strict equality, first-match aliases, missing/nullish rows and getter failures; executable behavior and 531/0/68/0 counts are unchanged.
- Step 6 URL-deduplication slice (2026-10-30): `uniqByUrl` preserves generic unvalidated row types and unknown URL values. Tests cover ordered aliases, native Set equality, falsy URLs and repeated accessor reads; executable behavior and the 531/0/68/0 diagnostic counts are unchanged.
- Step 6 visibility-filter slice (2026-10-30): `filterVisiblePhotos` retains generic raw rows and unknown inspected fields; keyword matching uses native coercion. Tests preserve aliases, exact rating comparison, truthiness, composition and failures. One exposed filter-narrowing diagnostic raises the baseline to 532 core; runtime execution is unchanged.
- Step 6 filter-narrowing slice (2026-10-30): visibility and URL-deduplication predicates explicitly narrow retained generic rows. Visibility converts the existing predicate to a boolean without changing filter results or property access; deduplication retains its existing boolean predicate. Tests cover nullish inputs, short circuits, access order and failures. The baseline is now 530 core, zero fixture, 68 transitive and zero global diagnostics.
- Step 6 feed-state slice (2026-10-30): domain, legacy and public snapshot feeds now describe unvalidated known photo fields separately from normalized `Photo`. Preview staging and legacy rebuilding preserve raw metadata through shallow copies; nested aliases and snapshot library identity remain unchanged. Two regressions and compiler fixtures cover the boundary. The nonzero baseline is 535 core, zero fixture, 68 transitive and zero global: five newly exposed selector incompatibilities still need honest contracts.
- Step 6 sequential-selection slice (2026-10-30): the pure selector returns `FeedPhoto | null`, preserving unvalidated metadata and the selected feed-row alias. Regression tests cover staged previews, pool rotation, native cursor-key coercion, unchanged inputs and empty visible feeds; compiler fixtures require narrowing. No executable production code changed. The nonzero baseline is 534 core, zero fixture, 68 transitive and zero global.
- Step 6 active-photo lookup slice (2026-10-30): `getActivePhoto` returns an unvalidated `FeedPhoto | null`, while `inferOrientation` accepts raw metadata without coercion. Tests cover preview aliases, feed/curated/external precedence, misses, malformed dimensions and accessor failures; compiler fixtures require narrowing. No executable production code changed. The nonzero baseline is 536 core, zero fixture, 68 transitive and zero global: downstream frame-field incompatibilities are now visible.
- Step 6 current-frame slice (2026-10-30): frame and snapshot active photos retain unvalidated feed-row types, and frame crop/category values admit raw metadata. Tests cover staged previews, split aliases, nullish defaults and malformed URL sorting; runtime behavior is unchanged. The nonzero baseline is 531 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 smart-selection slice (2026-10-30): generic feed selectors and preference filters retain raw row types and aliases, while the state adapter returns an unvalidated row or null. Staged previews, Map category identity, native rating coercion and malformed schedules are tested; executable behavior is unchanged. The nonzero baseline is 526 core, zero fixture, 69 transitive and zero global diagnostics. Re-audit confirms Step 6 remains incomplete.
- Step 6 numeric-coercion slice (2026-10-30): a private, data-first native-division boundary accepts unknown operands and returns a number on success. Its one local dynamic assertion models JavaScript arithmetic, not validation; Symbol, BigInt and custom coercion failures still propagate. Rating and night selection retain their order and behavior. The strict baseline is 524 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 cursor-key slice (2026-10-30): sequential selection retains native property-key coercion, including symbols, short-circuiting and failures, with a local dynamic key assertion rather than normalization. Tests and compiler fixtures preserve raw category types. Production syntax is unchanged; the nonzero baseline is 523 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 pairing-sort slice (2026-10-30): a local dynamic assertion preserves the native `localeCompare` call on unknown URLs without validation. Tests cover method receiver, raw arguments, result coercion, single-candidate short-circuiting and failures; the executable AST is unchanged. The nonzero baseline is 522 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 screensaver-decoder slice (2026-10-30): local property assertions preserve native lookup without validation, and the command's second-read `active` value is unknown. Tests cover callable/inherited accessors, changing values, proxy failures and reducer truthiness; production syntax is unchanged. The strict baseline is 520 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 category-decoder slice (2026-10-30): local assertions preserve eager native property reads and unvalidated custom array-join results. Tests cover callable/inherited inputs, precedence, aliases, ordering and failures; production syntax is unchanged. The nonzero baseline is 518 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 required-string slice (2026-10-30): `readRequiredString` accepts unknown and returns the original primitive string or null; native trim lookup, truthiness and failures remain unchanged. Tests cover both photo and pool decoders and an isolated trim override; production syntax is unchanged. The nonzero baseline is 517 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 trim-string slice (2026-10-30): `trimString` accepts unknown and returns an unknown native trim result, or an empty string for non-strings. Tests cover normal idempotence, decoder composition, isolated method lookup, raw results and failures; production syntax is unchanged. One implicit-input error disappears and an unknown computed-property diagnostic appears, leaving 517 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 widget-key slice (2026-11-04): a local dynamic assertion preserves native computed-key coercion on unknown trim results, not validation. Tests cover decoder composition, symbol and special keys, conversion/visible-read order, short circuits and failures; the production AST is unchanged. The nonzero baseline is 516 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 widget-patch contract (2026-11-09): `buildWidgetPatch` accepts unknown and returns a nullable patch with raw visibility values and potentially symbol keys. Tests preserve native property access, aliases, fresh results and failures; executable syntax is unchanged. The nonzero baseline is 515 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 widget-reader audit (2026-11-09): `readWidgetPatch` documents unknown patch inputs, a skip sentinel or boolean values for known own enumerable string keys. Three regressions preserve repeated reads, filtering order, native truthiness, skipped keys, failure propagation and reducer effects; executable syntax is unchanged. The strict baseline is 514 core, zero fixture, 69 transitive and zero global diagnostics. The shared reader's inferred one-argument normalizer now exposes a callback mismatch.
- Step 6 patch-reader contract (2026-11-09): the partially applied `readPatchField` documents raw identity and generic normalized results separately, with its original state/patch callback arguments and skip sentinel. Three regressions and private compile-time checks preserve repeated native lookup, key coercion, aliases and failures; production syntax is unchanged. The strict baseline is 508 core, zero fixture, 69 transitive and zero global diagnostics; raw unknown inputs now expose vision/location normalizer narrowing gaps.
- Step 6 reducer object-guard slice (2026-11-09): the existing `isPlainObject` now narrows unknown values to records with unknown properties, without checking prototypes or property values. Tests preserve custom prototypes, array/function rejection, inherited vision/location values, repeated patch reads and native failures; production syntax is unchanged. The strict baseline is 505 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 config patch-spec slice (2026-11-10): `createConfigPatchSpec` distinguishes unknown default reads from generic custom readers and documents callbacks and unvalidated flags. Two regressions and private compile fixtures preserve skip/no-op identity, aliases, flag truthiness, immutable writes, native keys and failures; executable syntax is unchanged. The strict baseline is 497 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 shared patch-interpreter slice (2026-11-10): generic specification and context contracts preserve reader/callback relationships, skip/no-op identity, write-before-flags ordering and truthy flag accumulation. Three regressions and private compile fixtures cover aliases, short-circuiting and failures; a local heterogeneous-list type erasure preserves mixed spec types. Executable syntax is unchanged. The strict baseline is 486 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 widget-merge audit (2026-11-11): the reader remains a partial boolean record; a local spread-only assertion describes its own boolean entries without promising arbitrary keys exist. Two regressions and private type fixtures preserve absence, special keys, immutable merging and no-op identity. Production syntax is unchanged; the strict baseline is 485 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 state-patch reducer audit (2026-11-12): the private reducer now documents its unknown patch, domain state, environment and result. The shared result builder accepts typed effect descriptions or factories; other legacy builder inputs remain unchecked. Tests preserve eager cloning, no-op identity, conditional environment reads and persistence-before-refresh ordering. Production syntax is unchanged; the strict baseline is 475 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 mutation-result audit (2026-11-12): generic contracts distinguish explicit context from the undefined state fallback, preserve event/effect factory relationships and document unvalidated legacy values. Three regressions and private compiler fixtures cover aliases, resolution order, defaults, persistence and native failures. Production syntax is unchanged; the strict baseline is 473 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 cloned-mutation audit (2026-11-12): contracts connect the clone to the apply callback, changed continuation and result factories; the continuation keeps its own result type alongside the no-op reducer result. Two regressions and private type fixtures cover eager option reads and cloning, truthiness, identity, defaults, ordering and native failures. Production syntax is unchanged; the strict baseline is 461 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 command-mutation audit (2026-11-12): generic contracts preserve the command type across apply and result factories. Two regressions and private type fixtures cover clone/command aliases, option-read order, defaults, no-ops, output ordering and failures. Production syntax is unchanged; the strict baseline is 453 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 entries-reducer audit (2026-11-13): generic contracts preserve partial application and command/target callback relationships. Two regressions and private type fixtures cover aliases, ordered writes, constant and computed entries, no-ops, options and failures. Production syntax is unchanged; the strict baseline is 444 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 reducer checkpoint (2026-11-14): checked field-command and feed-finalization contracts preserve partial application, callback context, no-op identity, environment precedence, effect/event ordering, and native failures. Four runtime regressions and private compiler fixtures cover these boundaries; executable production behavior is unchanged. The strict baseline is 426 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 payload/option audit (2026-11-14): generic contracts preserve null-only payload rejection, command and state aliases, eager option reads and resolution, no-op identity, and post-mutation environment precedence. Three runtime regressions and private compiler fixtures cover callback order and failures. Production behavior is unchanged; the strict baseline is 395 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 pool-command audit (2026-11-14): generic contracts document guarded and unguarded pool mutations, partial shallow payload copies, option resolution and native failure ordering. Five runtime regressions and compiler fixtures cover aliases, getters, no-op identity and failure paths. Production behavior is unchanged; the strict baseline is 371 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 playback-command audit (2026-11-14): generic contracts preserve selection and preparation aliases, null-payload and falsy-selection no-ops, direction-before-clone ordering, environment forwarding and unchanged-photo events. Three runtime regressions and compiler fixtures cover these boundaries and native failures. Production syntax is unchanged; the strict baseline is 345 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 selectable-photo audit (2026-11-14): lookup preserves feed/curated/external/fallback precedence and raw aliases; preview staging retains no-op identity, shallow copies and repeated URL reads. Four runtime regressions and compiler fixtures cover those boundaries and malformed inputs. Production syntax is unchanged; the strict baseline is 339 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 selection-environment audit (2026-11-14): the public reducer replaces falsy execution inputs, while smart selection defaults only undefined and forwards null to native operations. Three runtime regressions and compiler fixtures preserve clock/weather ordering, conditional RNG draws, sequence short-circuiting and failures. Production syntax is unchanged; the strict baseline is 337 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 active-photo maintenance audit (2026-11-19): active-photo updates preserve raw URL identity, copy playback even when unchanged, and increment the seed only on strict URL change; maintenance retains the original state unless selection is needed or forced. Four runtime regressions and private compiler fixtures cover lookup ordering, defaults, native coercion and failures. Production syntax is unchanged; the strict baseline is 335 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 feed-recomputation audit (2026-11-19): feed replacement precedes active-photo lookup, forwards execution inputs and retains raw URLs. Four regressions and private compiler fixtures cover shallow copies, aliases, conditional RNG calls, selection and failures. Executable syntax is unchanged; the strict baseline is 329 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 feed-finalization audit (2026-11-20): finalization context and result now expose the unvalidated active URL to both output factories and callers. Three runtime regressions and private compiler fixtures preserve context identity, effects-before-events ordering, falsy/default outputs and failures. Executable syntax is unchanged; the strict baseline is 327 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 feed-command propagation (2026-11-21): feed mutation and command-builder results now retain the raw active-URL contract on changed paths while admitting original-state no-ops. Three runtime regressions and private compiler fixtures preserve command/payload aliases, environment factory context, option precedence and skipped work. Executable syntax is unchanged; the strict baseline is 326 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 family-interpreter audit (2026-11-21): generic descriptors relate original commands/environments, adapted environments and unchanged reducer results. Closed indexing retains own enumerable string entries, last-callable-key precedence, eager capture, no-op identity and native failures. Four runtime regressions and private compiler fixtures cover these contracts, including raw URLs through public dispatch. A local call assertion restores only the descriptor's environment pairing; executable syntax is unchanged. The strict baseline is 309 core, zero fixture, 69 transitive and zero global diagnostics; the public reducer result mismatch is now exposed rather than hidden by unchecked dispatch.
- Step 6 shared active-URL contract (2026-11-21): playback now admits unknown active URLs across public reduction, snapshots, legacy rebuilding and dispatch. Feed finalization reuses `DomainState`/`ReducerResult` instead of duplicate local shapes; emitter inputs admit raw feed rows. Three runtime regressions and compiler fixtures preserve strict equality, aliases, falsy-to-null projection, native failures and effect/event behavior. Production executable syntax is unchanged. Verification passes with 878 assertions, 13 sensor regressions and three compiler fixture tests; optional endpoint smoke remains sandbox-blocked. The nonzero strict baseline is 307 core, zero fixture, 68 transitive and zero global diagnostics.
- Next engineering code candidate: preserve key-to-command relationships in the reducer-family registry; see the [companion checkpoint](./FUNCTIONAL_REFACTOR_ROADMAP.md#step-6-prepare-the-codebase-for-typescript-without-a-premature-rewrite). Documentation consolidation precedes commissioning a broader batch.
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
- Latest screensaver interaction correction: only an explicitly launched `?mode=tv` kiosk can dismiss the shared screensaver from input; toggled admin TV previews remain presentation-only.
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
- Latest Step 6 slice: `client/src/state/imageFeedsPanels.js` now exposes named contracts for immutable open-state transitions, unknown-safe persisted preferences, and injected storage readers/writers; browser storage and focus effects remain in the React shell.
- Latest Step 6 slice: `client/src/api/requestPlans.js` now names the pure mutation-plan result and legacy transport contracts, keeping REST body and Socket.IO fallback projections partially applicable while fetch execution remains in `luminaClient.js`.
- Latest Step 6 slice: `client/src/api/jsonClient.js` now names the parsed error-payload and request-option contracts and uses a payload-oriented generic result, keeping media-type classification and fetch execution at the shared transport edge.
- Latest Step 6 slice: `client/src/state/swipeGesture.js` now owns the checked pure touch-coordinate decoder and strict-threshold direction/status projection; `useSwipeGesture.js` keeps action dispatch and reset timers in the React effect shell.
- Latest Step 6 slice: `client/src/state/cropDrag.js` now owns the checked pure pointer-coordinate decoder and bounded crop-position projection; `useCropDrag.js` keeps DOM listeners, timeout coalescing, React state, and crop-action dispatch in the effect shell.
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
- Latest Google Photos presentation slice: Picker `createTime` is retained through cache refresh and projected as a localized date title in single and split TV slides; missing or invalid dates preserve existing titles, and non-Google single-slide presentation remains unchanged.
- Latest Step 6 slice: `server/utils/fn.js` now exposes checked contracts for curried primitives, data-last collection combinators, and closed declarative interpreters; runtime behavior and null-safe identities remain unchanged.
- Latest Step 6 slice: `server/utils/validation.js` now exposes checked contracts for the curried numeric validator factory and its range-specific validators; null-safe identities, parser projection, and inclusive bounds remain unchanged.
- Latest Step 6 slice: `server/config/env.js` now exposes checked contracts for environment-value normalization and the pure replace-or-append content projection; file reads, process updates, and persistence remain in the imperative shell.
- Latest Step 6 slice: `server/services/sentiment.js` now exposes checked contracts for the curried lexicon counters, declarative headline parser, score classification, and sentiment result; RSS input remains a pure projection while network refresh orchestration stays in the runtime shell.
- Latest Step 6 slice: `server/domain/poolRetention.js` now exposes checked contracts for policy normalization, immutable loved-photo capping, and partially applied retention transforms; pruning and cap composition remain pure while persistence and crawler orchestration stay outside the domain boundary.
- Latest Step 6 slice: `server/domain/photoTimestamps.js` now exposes an open checked photo-metadata contract for timestamp normalization and immutable stamping; source-specific metadata remains extensible while persistence codecs and crawler effects stay outside the pure boundary.
- Latest Step 6 slice: `server/domain/poolSchedule.js` now exposes checked contracts for schedule inputs, policy maps, resolved schedule entries, local-time evaluation, and immutable category appends; schedule selection remains pure while interval polling, dispatch, and restoration stay in the runtime shell.
- Latest Step 6 slice: `server/domain/snapshot.js` now exposes checked contracts for legacy-state decoding, domain/public snapshot projection, runtime overrides, and the explicit compatibility mutation shell; normalization and frame derivation remain pure while legacy synchronization stays at the imperative boundary.
- Latest Step 6 slice: `server/domain/environmentSettings.js` now exposes checked contracts for device inputs, canonical catalogs, runtime/legacy projections, immutable profile updates, and adapter validation; preserve pure settings projections while keeping config persistence and sensor-runtime updates in `app.js`.
- Latest Step 6 slice: `server/services/ecowitt.js` now exposes checked contracts for vendor payload decoding, canonical indoor readings, settings normalization, validation, and public environment responses; preserve the pure protocol projection while keeping polling, timeouts, logging, and network effects in the runtime shell.
- Latest Step 6 slice: `server/services/sensorHistory.js` now exposes checked contracts for sensor/weather inputs, hourly records, query/statistics results, CSV projection, and the injected SQLite store; preserve invalid-timestamp nulls and limit defaults while keeping database operations in the store interpreter.
- Latest Step 6 slice: `server/services/sensorPlatform.js` now exposes checked adapter-descriptor, registration, summary, settings-result, and platform-interface contracts; lifecycle/read callbacks remain explicit effects while frozen registry metadata and fresh descriptions stay isolated.
- Latest Step 6 slice: `server/services/weather.js` now exposes checked WMO code and classification contracts; the constant-time classifier and cloudy fallback remain pure and unchanged while geolocation and forecast fetching stay effectful.
- Latest Step 6 slice: `server/runtime/environmentRefresh.js` now exposes checked contracts for weather snapshot projections; provider values and the absent-current no-op remain unchanged while fetching, persistence, logging, and broadcasts stay in the runtime shell.
- Latest Step 6 slice: `server/runtime/activeFeed.js` now exposes checked contracts for category parsing/normalization and balanced feed projections; source collections remain unchanged while `photosList` assignment stays in the runtime shell.
- Latest Step 6 slice: `server/runtime/idleDaemon.js` now exposes checked contracts for normalized host observations, daemon inputs, and screensaver transitions; preserve the closed action vocabulary and keep polling, browser actions, timers, and broadcasts in the runtime shell.
- Latest Step 6 slice: `server/runtime/kioskControl.js` now exposes a checked closed contract for its pure runtime-context projection; process, governor, retry-timer, and logging effects remain in the runtime shell.
- Latest Step 6 slice: `server/runtime/poolSchedule.js` now exposes a checked five-field status projection with detached category arrays; schedule polling, command dispatch, and restoration remain in the runtime shell.
- Latest Step 6 slice: `server/utils/routeDecode.js` now exposes generic checked success/failure, map, chain, and collection contracts; fail-fast decoding and the empty-success identity remain unchanged while HTTP responses stay in routes.
- Latest Step 6 slice: `server/utils/keywordSpecs.js` now exposes checked unknown-safe contracts for phrase normalization, timed specs, normalized equality, and ordered term collection; nested specs remain detached and configuration effects stay outside the pure helper.
- Latest Step 6 slice: `server/config/state.js` now exposes checked contracts for the pure keyword-to-feed-config projection; ordered normalized terms and independent source arrays remain unchanged while mutable `screensaverState` stays at the module boundary.
- Latest Step 6 slice: `server/config/collectionsCodec.js` now documents the open persisted-record input and stable normalization/serialization outputs; immutable collection and state projections remain separate from filesystem reads, writes, and migration recovery.
- Latest Step 6 slice: `server/config/collectionPhotoProjections.js` now exposes checked curried photo-by-URL and photo-list contracts; unmatched entries retain identity and list updates remain immutable, while collection/state mutation and persistence stay in `collections.js`.
- Latest Step 6 slice: `server/config/localSettings.js` now documents the pure partial-merge contract; Ecowitt units merge one level deep, sensor-history patches remain shallow, unsupported top-level patch fields stay ignored, and both inputs remain unchanged while file writes stay in `saveLocalConfigPatch(...)`.
- Latest Step 6 slice: `server/config/configLoaderProjections.js` now exposes a checked pure defaults/overrides projection with deprecated-secret filtering; location and Ecowitt units retain their nested merge semantics, sensor history remains shallow, and file/warning effects stay in `configLoader.js`.
- Latest playback behavior: smart selection rotates among time-eligible pools before applying weather, night, and rating preferences; sequence playback keeps per-pool cursors while the visible feed remains URL-unique.
- Latest persistence slice: collection snapshots keep exact image URLs globally unique across pools; the pure snapshot projection preserves first-pool ownership, and startup cleans legacy duplicate feed rows while preserving sibling metadata.
- Completed Step 6 seam: `server/config/collectionPhotoUpdatePlan.js` exposes the typed pure photo-field update plan; live-state mutation and persistence remain in `collections.js`.
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

Current checkpoint:

- Cursor investigation: isolated built-client browser tests exercise the
  existing React timer and page-wide CSS without changing production behavior.
  The reported physical-TV issue remains open; inspect the live kiosk and
  pointer events before inferring a cause. The next Step 6 seam is unchanged.
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
- Step 6 required-string slice (2026-10-30): the pure `readRequiredString` projection now documents unknown input and original-string-or-null output. Regressions cover primitive-only acceptance, whitespace, idempotence under native trim, downstream photo/pool behavior, isolated trim lookup/receiver, truthy and falsy overrides, and exact failures. Production syntax and exports are unchanged. The strict baseline is 517 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 trim-string slice (2026-10-30): `trimString` accepts unknown and returns the native trim result as unknown, or an empty string for non-strings. Regressions cover native-trim idempotence, decoder composition, uninspected inputs, isolated lookup/receiver, raw results and exact failures. Production syntax and exports are unchanged. Removing the implicit-input error exposes an unknown computed-property key in the widget patch; the strict baseline remains 517 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 widget-key slice (2026-11-04): one local dynamic assertion at the computed property retains native `ToPropertyKey` on unknown trim results without validation. Two regressions cover decoder composition, symbol and special keys, lookup/coercion/visible-read order, falsy short circuits, malformed conversion and exact thrown failures. Production syntax and exports are unchanged. The strict baseline is 516 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 widget-patch contract (2026-11-09): `buildWidgetPatch` accepts unknown and returns a nullable patch with raw visibility values and potentially symbol keys. Local assertions preserve native optional property access; tests cover inherited/callable inputs, identity, proxy lookup and failures, with fixture narrowing and unchanged production syntax. The strict baseline is 515 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 widget-reader audit (2026-11-09): the private `readWidgetPatch` contract describes unknown patch input and a fresh boolean record or skip sentinel; known own enumerable string keys are filtered before values are read. Three regressions preserve native truthiness, repeated reads, skip cases, failure propagation and reducer effects. Production syntax and exports remain unchanged. The strict baseline is 514 core, zero fixture, 69 transitive and zero global diagnostics: two implicit callback parameters disappear, exposing one mismatch with the shared reader's inferred one-argument callback.
- Step 6 patch-reader contract (2026-11-09): `readPatchField` has separate raw-identity and generic normalizer overloads; it passes the second raw read, original state and original patch, or returns the skip sentinel. Three runtime regressions and private compile-time checks preserve aliases, optional lookups, repeated native key coercion and failures. Production syntax and exports are unchanged. The strict baseline is 508 core, zero fixture, 69 transitive and zero global diagnostics; unknown values expose vision/location guard narrowing gaps.
- Step 6 reducer object-guard slice (2026-11-09): `isPlainObject` narrows unknown input to a record of unknown properties without inspecting prototypes or values. Two regressions and private compile fixtures preserve accepted prototypes, array/function rejection, inherited vision/location fields, repeated patch reads and native failures. Production syntax and exports remain unchanged; the strict baseline is 505 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 config patch-spec slice (2026-11-10): `createConfigPatchSpec` distinguishes unknown default reads from generic custom readers, and documents callback/flag contracts without runtime validation. Two regressions and private compile fixtures preserve aliases, defaults, skip/no-op identity, flag truthiness, native keys, immutable writes and failures. Production syntax and exports remain unchanged; the strict baseline is 497 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 shared patch-interpreter slice (2026-11-10): generic spec and context contracts retain reader/callback relationships; a local heterogeneous-list erasure bridges different reader result types. Three regressions and private compile fixtures preserve callback aliases, skip/no-op identity, write-before-flags ordering, flag short-circuiting, and failures. Production syntax and exports remain unchanged; the strict baseline is 486 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 widget-merge audit (2026-11-11): the reader retains its partial record contract, while a local spread-only assertion reflects its own boolean-valued entries without asserting key presence. Two behavioral regressions and private type fixtures cover absence, special keys, immutable merge and no-op identity. Production syntax is unchanged; the strict baseline is 485 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 state-patch reducer audit (2026-11-12): the private reducer documents domain state, unknown patch, execution environment and result. The shared result builder now accepts typed effect arrays or factories; its other legacy inputs remain unchecked. Two runtime regressions and private type fixtures preserve eager clone, no-op identity, conditional environment access, effect vocabulary and ordering. Production syntax is unchanged; the strict baseline is 475 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 mutation-result audit (2026-11-12): generic contracts distinguish explicit context from the undefined state fallback and relate event/effect factories to that context. Three regressions and private compiler fixtures preserve input aliases, resolution ordering, default/falsy behavior, persistence and native failures; malformed truthy values remain unvalidated. Production syntax is unchanged; the strict baseline is 473 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 cloned-mutation audit (2026-11-12): checked contracts relate the clone to the apply callback, changed continuation and result factories, with a generic continuation result unioned with the no-op result. Two regressions and private type fixtures preserve eager option reads and cloning, truthiness, identity, defaults, ordering and native failures. Production syntax is unchanged; the strict baseline is 461 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 command-mutation audit (2026-11-12): a generic command contract relates apply and output factories to their original command and shared cloned state. Two regressions and private compiler fixtures cover option reads, default versus explicit falsy outputs, aliases, no-op behavior, effect/event order, persistence and failures. Production syntax is unchanged; the strict baseline is 453 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 entries-reducer audit (2026-11-13): generic contracts preserve partial application, command-aware reader and selected-target relationships, while shared options reuse the command-mutation contract. Two regressions and private type fixtures cover constant/computed entries, aliases, ordered writes, no-ops, option-spread timing and native failures. Production syntax is unchanged; the strict baseline is 444 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 reducer checkpoint (2026-11-14): generic field-command and feed-finalization contracts connect command readers and finalized context to output factories while retaining no-op identity, environment precedence and effect/event ordering. Four focused runtime regressions and private compiler fixtures exercise the boundaries and native failures. No production executable syntax changes; the strict baseline is 426 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 payload/option audit (2026-11-14): generic payload and feed-command contracts retain original command, state and payload aliases; only null skips the continuation. Option projection reads all own enumerable string entries before resolving function-valued entries, and returns a partial projected record because property presence is not validated. Function-valued `eventsFor` is a resolver which may return a finalizer. Three runtime regressions and private compiler fixtures cover no-op ordering, environment precedence and failures. Local assertions preserve native calls and projection without validation; production behavior is unchanged. The strict baseline is 395 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 pool-command audit (2026-11-14): the pool builder and guarded mutation now document generic callback relationships, pre-guard option resolution, no-op identity and native failures. Guarded payloads are shallow own-enumerable copies with the earlier guarded name; other properties are partial because inherited and non-enumerable values need not survive. Unguarded payloads retain identity. Five runtime regressions and private compiler fixtures cover changing getters, method receivers, cloning and failure ordering. A local assertion retains native optional-apply behavior without validation; production behavior is unchanged. The strict baseline is 371 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 playback-command audit (2026-11-14): generic callback contracts preserve original command, payload, selected row and environment aliases. Only null payloads skip selection; falsy selections retain state identity. Direction resolves before cloning, preparation receives the clone, and even an unchanged photo emits update events. Three runtime regressions and private compiler fixtures cover these boundaries and propagated failures; executable syntax is unchanged. The strict baseline is 345 core, zero fixture, 69 transitive and zero global diagnostics. The previously implicit `findSelectablePhoto` fallback and nullable selector environment now surface as type mismatches.
- Step 6 selectable-photo audit (2026-11-14): `findSelectablePhoto` preserves feed/curated/external/fallback precedence and raw aliases, with strict unknown-key lookup and eager pool-map reads. `prependVisiblePhoto` keeps no-op identity and otherwise prepends a partial shallow own-enumerable copy, retaining nested and unmatched-row aliases and repeated URL reads. Four runtime regressions and private compiler fixtures cover precedence, malformed values, getter order and failures; a local spread assertion does not validate or modify data. Executable syntax is unchanged. The strict baseline is 339 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 selection-environment audit (2026-11-14): `selectSmartPhoto` documents nullable clock/RNG forwarding alongside the reducer's distinct truthy fallbacks. Null is never normalized at the selector: clock access fails, while an RNG fails only when drawn. Three runtime regressions and compiler fixtures cover weather precedence, callback ordering, zero-weight/no-candidate paths, sequence short-circuiting and failures. Local assertions preserve native operations without validation; executable syntax is unchanged. The strict baseline is 337 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 active-photo maintenance audit (2026-11-19): `updateActivePhotoUrl` preserves raw URL values, shallow playback copies, strict change detection, native seed addition and direction fallback. `ensureActivePhoto` reads current/feed state before the force check and retains state identity only on the unforced hit; otherwise it selects and applies the update. Its local result type exposes the unvalidated active URL instead of promising a string. Four runtime regressions and private compiler fixtures cover aliases, no-op and forced paths, ordering, native failures and raw URLs. Executable syntax is unchanged. The strict baseline is 335 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 feed-recomputation audit (2026-11-19): `recomputeFeed` replaces the feed in shallow state/library copies and forwards inputs unchanged; `recomputeAndEnsureActivePhoto` performs that replacement before lookup and selection. Four regressions and private compiler fixtures cover aliasing, selection ordering, raw URLs, conditional RNG calls and failures. A local options assertion does not validate nullable RNGs; executable syntax is unchanged. The strict baseline is 329 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 feed-finalization audit (2026-11-20): `FeedFinalization` and the local `FeedMutationResult` expose unknown active URLs instead of promising normalized strings. Output factories share that context; effects resolve before events, explicit falsy outputs suppress defaults, and failures propagate. Three runtime regressions and private compiler fixtures cover those semantics, including real raw-URL selection. Executable syntax is unchanged. The strict baseline is 327 core, zero fixture, 69 transitive and zero global diagnostics; `reduceFeedMutation` now exposes the remaining downstream result mismatch.
- Step 6 feed-command propagation (2026-11-21): `reduceFeedMutation` and `buildFeedCommandReducer` return `FeedMutationResult`, preserving unvalidated active URLs rather than claiming normalized state. Original-state no-ops fit the same envelope. Three runtime regressions and private compiler fixtures cover real raw-URL selection, callback aliases, environment override/context and skip paths. Executable syntax is unchanged. The strict baseline is 326 core, zero fixture, 69 transitive and zero global diagnostics.
- Step 6 family-interpreter audit (2026-11-21): generic descriptors relate original commands/environments, adapted environments and unchanged reducer results. Closed indexing retains own enumerable string entries, last-callable-key precedence, eager capture, no-op identity and native failures. Four runtime regressions and private compiler fixtures cover these contracts, including raw URLs through public dispatch. A local call assertion restores only the descriptor's environment pairing; executable syntax is unchanged. The strict baseline is 309 core, zero fixture, 69 transitive and zero global diagnostics; the public reducer result mismatch is now exposed rather than hidden by unchecked dispatch.
- Step 6 shared active-URL contract (2026-11-21): playback now admits unknown active URLs across public reduction, snapshots, legacy rebuilding and dispatch. Feed finalization reuses `DomainState`/`ReducerResult` instead of duplicate local shapes; emitter inputs admit raw feed rows. Three runtime regressions and compiler fixtures preserve strict equality, aliases, falsy-to-null projection, native failures and effect/event behavior. Production executable syntax is unchanged. Verification passes with 878 assertions, 13 sensor regressions and three compiler fixture tests; optional endpoint smoke remains sandbox-blocked. The nonzero strict baseline is 307 core, zero fixture, 68 transitive and zero global diagnostics.
- Step 6 shared result-constructor contracts (2026-11-23): all five private constructors retain generic state identity and checked canonical event/effect descriptions. Three runtime regressions and private compiler fixtures preserve uninspected aliases, fresh independent outputs, undefined-only defaults, ordered events and native failures; deliberate annotation removal proves fixture sensitivity. The pure data-first envelope remains unchanged, with no algebraic wrapper or public test export. Verification passes with 912 runtime assertions, 13 sensor regressions and three compiler tests, including the existing Node 22 runtime. Full reducer executable syntax/exports are unchanged. Strict diagnostics are 298 core, zero fixture, 68 transitive and zero global: ten implicit-any gaps removed and one honest downstream payload gap exposed. This is an accepted bounded development cycle, not completion of Step 6 or Phase 1.
- The effect-result builder audit is now accepted; use the [current Step 6 checkpoint](#step-6-prepare-the-codebase-for-typescript-without-a-premature-rewrite) for its result and next contract seam. The earlier constructor result above is history, not a competing next-action list.
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

### Step 6 acceptance audit — 2026-10-25; re-audited 2026-10-26

Result: **incomplete**. Public command, execution, effect, and selector
signatures are now documented, but their state invariants and internal type
relationships are not closed. The re-audit found and corrected an unbalanced
nested-record declaration in `SessionConfig.poolPolicies`. Existing `@ts-check`
markers, source assertions, and lint do not establish successful compilation.
This audit follows the core domain flow, not unrelated helper polishing.

| Boundary | Evidence in the current code | Remaining gap |
| --- | --- | --- |
| Commands | `CommandPayloads` correlates 25 names; decoders document command-or-null results. Regressions confirm raw scalar patches, URL-only validation of active-photo metadata, and inherited/callable inputs. State patches use `isPlainObject`; screensaver lookup retains repeated reads; category decoding preserves native destructuring and raw custom-join results. `buildWidgetPatch` accepts unknown, retaining raw values and native optional lookup/key coercion. The widget reader filters known own enumerable keys and retains partial-record absence; its merge uses a local assertion for boolean-valued own entries. The partially applied patch reader preserves its callback result, state/patch aliases and skip sentinel. The reducer object guard narrows vision/location inputs without validating properties or prototypes. Generic config and shared patch-spec contracts preserve callbacks and unvalidated flags; the mixed-spec list uses local type erasure. The patch reducer documents its input and result; its result builder relates event/effect factories to explicit or default context. Cloned, state, command, entries, field, feed, pool and payload-adapter contracts preserve callback relationships and no-op identity. Pool copy contracts model potentially omitted fields; option projections retain eager resolver invocation. | Playback-command selection and preparation still need a callback and clone-timing audit. Command payloads and other consumers need compatibility review. `curry: AnyFunction -> AnyFunction` erases builder relationships. Any narrowing must preserve native lookup/coercion behavior, not silently reject callable/inherited inputs. |
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

## Historical REST-first contract observations — retired November24,2026

These per-helper observations are history, not a current checkpoint or task queue.

  - Latest Step 6 slice: `server/runtime/environmentRefresh.js` now documents the weather snapshot and physical-weather projection contracts, with tests for provider-field projection, reference preservation, temperature rounding, classification, and absent observations.
  - Latest Step 6 slice: `server/runtime/activeFeed.js` now documents category parsing, normalization, and balanced feed contracts, with tests for external pools, exclusions, and source immutability.
  - Latest Step 6 slice: `server/runtime/idleDaemon.js` now documents normalized observation, daemon-input, and transition contracts, with tests for the inclusive inactivity threshold, blockers, closed actions, and immutable projections.
  - Latest Step 6 slice: `server/runtime/kioskControl.js` now documents its closed runtime-context projection while retaining process and timer effects in the runtime shell.
  - Latest persistence slice: collection snapshot writes and legacy-file cleanup now share first-occurrence URL deduplication across pools, with tests for immutable projection and metadata-preserving migration.
  - Latest Step 6 slice: `server/runtime/poolSchedule.js` now exposes the tested status snapshot contract; callers receive detached arrays, and scheduling state/effects remain in the runtime shell.
  - Latest Step 6 slices: keyword specs and feed-config projections, persisted collection snapshots, and curried photo-list projections now have checked contracts; their configuration, filesystem, state-mutation, and persistence effects remain in their shells.
  - Latest Step 6 slice: `server/config/localSettings.js` now documents the pure partial-merge contract and its distinct Ecowitt-unit versus sensor-history merge depth; filesystem writes remain in `saveLocalConfigPatch(...)`.
  - Latest Step 6 slice: `server/config/configLoaderProjections.js` now exposes a checked defaults/overrides projection with secret filtering; file access and warnings remain in the loader shell.
  - Latest Step 6 slice: `collections.js` and `configLoader.js` now document checked input and effect-shell contracts; persistence, file access, logging, and live-state mutation remain explicit.
  - Latest Step 6 slice (97): `server/services/googlePhotosCache.js` refines read-only nested/flat file-selection contracts. Seven focused tests preserve selected aliases, fresh falsy-row fallbacks, native truthiness, hidden/inherited fields, repeated reads, and exact failures. Keep the pure data-first selector without an algebraic wrapper; leaf reference-idempotence is not global idempotence. Executable production code and exports remain unchanged.


## Historical five-step acceptance checkpoint — 2026-11-24

Current checkpoint (2026-11-24): guide/checkpoint consolidation and the keyed
family contract are accepted. **fix(types): preserve Lumina command keys in
reducer families** keeps the private boundary specific to the actual canonical
Command, resolved environment and domain envelope. Speculative arbitrary-registry
inference was removed after review exposed structural-widening hazards; no runtime
JavaScript or exports changed. Runtime 917 / sensor 13 / compiler 3 pass on the
actual Node 24.18 baseline. Strict diagnostics: 290 core / 0 fixture / 68 transitive /
0 global, one registry diagnostic removed and no new diagnostic identities.
Step 6 / Phase 1 remain incomplete; no whole-project compiler-green claim.

**Test-runner hotspot accepted:** **refactor(tests): extract client state and
control regressions** moves the group byte-for-byte into one root test module.
The existing runner owns shared reporting and execution; its size fell by 1,111
lines. All 930 runtime/sensor pass lines retain their order; a deliberate failed
assertion produced exactly one failure/exit1. No framework or production change.

**Runtime/release source qualified:** **build(runtime): pin Node LTS and align
existing launch paths** and **chore(release): qualify the Node LTS baseline for
Lumina 1.0.1** retain one `.nvmrc` authority, existing native service ownership
and direct-exec fallback. Both runtimes pass 917 runtime / 13 sensor / 3 compiler /
4 isolated runtime checks; 14 headless checks and the client build pass.
**Five-step sequence accepted:** clean provenance passed; native live promotion
to release1.0.1 completed with matching served assets, HTTP/Socket.IO, private-file
and history preservation. Old runtime/unit/payload retained; rollback compatibility
is fixture-tested, not a claimed live rollback rehearsal. Fila owns orchestration;
Beads owns selected prerequisites/claims, not product priority or process liveness.

**Runtime:** official LTS 26.13.1 is active through the existing native service. Published
integrity is verified, and disposable history reads/writes remain compatible
24→26→24. Shell defaults and the OpenClaw node runtime stay independent. Client
assets rebuild identically; no UI feature or browser-language upgrade is implied.

**Next selection boundary:** Step6/Phase1 remain incomplete. Select a new bounded
outcome from the existing diagnostic/product priorities only when commissioned;
do not schedule another batch implicitly. Existing provider denials/vision failure
are recorded in the product audit, not hidden by this rollout's acceptance. The
optional weather-location display remains a proposal, not an implemented control.

## Weather-label presentation persistence — 2026-11-24

Repeated pressure: live widget state was not part of the saved collection
configuration, so a visual toggle alone would not survive restart. Reuse the
existing widgets/patch/snapshot/codec boundaries, persisting only the newly
requested weatherLocation boolean. This deliberately leaves other widget reload
semantics unchanged; do not grow a second location model. The pure codec restores
known runtime defaults plus an explicit boolean, rejecting malformed saved values.
The existing effect shell still owns persistence and state-sync delivery.

Validation:919 runtime assertions,13 sensor,3 compiler and4 launcher tests; lint
and independent read-only ACCEPT. Tests prove hide/show roundtrips and unchanged
weather/location/photo/runtime state. Payload JSDoc uses the existing declared
snapshot type, reducing transitive strict diagnostics68→59; core remains290.
An initial regression wrongly placed the sync EVENT among effects; corrected the
expectation to the existing persist-effect/state-sync-event contract. No runtime
change was needed. Client control and live release remain the next boundaries.

## Optional weather location controls — 2026-11-24

The saved preference now drives a direct presentation guard; weather fetches,
location selection, forecasts and photo selection do not depend on it. Remote
General settings and TV widget settings use accessible native switches; absent
legacy preferences remain visible. The TV switchboard now uses the existing REST
mutation boundary instead of adding another legacy transport branch. Canonical
snapshots still own live state; no duplicated draft setting or location model.

Reused the existing slideshow/browser fixture with same-origin synthetic weather,
REST command dispatch and an optional test-only candidate-dist path. Full suite
919/13/3/4, lint and candidate build pass;16 browser cases include two new weather
cases. Independent ACCEPT also exercises all7 TV switches, Enter/Space and HTTP503
without optimistic-state divergence. Browser reload is tested; persistence uses
the separately accepted codec path, not a claim of a live daemon-restart rehearsal.
Assets remain unpromoted until final release, and physical-TV/AT review is distinct.

## Bounded rejected-provider work — 2026-11-24

Repeated account-wide rejections used to fan out over query variants and pools.
The observed Unsplash/Reddit paths now share pure status classification and a
run-local failure Map in the explicit request shell. Auth/policy/rate/service and
transport/decoding/deadline failures stop that source for this pass, while404 stays
query-local and the next crawl can recover. Saved metadata and unrelated sources
retain existing lifecycle semantics. Native abort deadlines cover headers/body;
no persistent circuit breaker, retry daemon, credentials or source policy change.

Nested query traversal became a pure input projection plus the existing ordered
async reducer. Spread preserves legacy iterables before flatMap; Set/string/
generator ordering and timed metadata were independently checked. Source fetchers
receive an injected request effect, avoiding global-fetch tests or another module.

Independent review initially REVISE: rejected-body cancellation could replace503
with transport and discard earlier query photos. Teardown is now best-effort and
the exact native errored-body regression passes, preserving original HTTP facts
and accepted partial photos. Revised ACCEPT includes12 offline cases and extra
native503/body/iterable probes. Full919runtime/13sensor/3compiler plus4launcher/
12crawler, lint and unchanged strict290core/59transitive pass their stated gates.
No whole-provider health claim: current access denials and vision remain separate;
pre-existing JSON/transport exceptions may still drop fresh results inside an
unfinished Unsplash query. Existing cache survives. Next consume failures through
both modern and legacy job/status boundaries, not another health state store.

## Truthful degraded crawl status — 2026-11-24

The next boundary exposed dual completion delivery: modern job-status was followed
by legacy recrawl-complete, whose projection could overwrite a provider warning
with clean success. Pure completion formatting now derives meaning from the
existing result; the generic job shell accepts a literal or result callback.
The legacy envelope preserves optional warning text, validated as a string at
the client boundary. No new lifecycle state, health ledger, status service or
duplicate UI state is necessary. Completed-with-warnings still means the pass
finished, not that denied providers recovered. Thrown failures remain failed.

Daily refresh returns/logs failures even without new photos, with no extra save.
Existing24h/manual scheduling and retention stay authoritative; no retry timer.
Independent ACCEPT exercised real crawler→job/client/daily flows and exact event
order, partial/no-change results, recovery, decoding/transport, malformed legacy
messages and thrown failures.924runtime/13sensor/3compiler/4launcher/12crawler,
lint/build and16browser checks pass; strict290core/59transitive remains nonzero.
The coherent envelope fix spans6files but only106added/8removed lines; splitting
it to meet a file-count preference would hide the end-to-end dependency.
Next: qualify the clean versioned release, publish built assets through the native
service owner and verify live boundaries; no physical-TV/provider health claim.
