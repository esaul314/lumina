# Pool Rotation & Retention Admin Plan

Status: proposal updated 2026-07-31; timestamp foundation shipped, pool policy
and admin UI remain unimplemented.

## Outcome

Add a polished, discoverable admin surface for controlling image playback and
pool retention without making the operator reason about crawler internals.
The UI should distinguish:

- **Display duration**: how long the current image remains on the TV before the
  next image is selected. Lumina already models this as the global
  `slideshowInterval` setting.
- **Rotating pool size**: how many ordinary, replaceable images a pool keeps as
  new crawl results arrive. This is a collection policy, not a playback timer.
- **Loved-item retention**: loved images remain durable and are not removed by
  the rotating-pool cap. This existing safety rule must remain visible in the
  UI rather than becoming an accidental surprise.

The timestamp foundation now exists as `photo.addedAt`. Newly accepted crawler
photos receive a canonical ISO timestamp, while legacy photos without one are
left undated. An age-based retention setting is therefore now viable for new
and timestamped items, but must remain explicit about how undated legacy items
are treated until a deliberate backfill policy exists.

## Proposed first slice

### Backend contract

Persist a normalized per-pool policy alongside the existing collection/feed
configuration:

```js
poolPolicies: {
  "Scenic Nature": {
    rotatingLimit: 2000
  }
}
```

The policy should be optional and default-compatible. Missing policies resolve
to the current cap, preserving existing installations and snapshots. The
normalization boundary should enforce a finite integer range and reject
unknown fields rather than allowing arbitrary crawler configuration into the
state model.

The policy flow should be:

```text
HTTP/socket payload
  -> pure pool-policy decoder
  -> shared command
  -> pure reducer update
  -> explicit persistence effect
  -> crawler receives resolved policy
  -> pure cap/prune function
```

The crawler should accept a resolved policy as an injected value. The cap
function should remain pure and data-last, for example:

```js
capCollectionLimit(policy)(initialLength)(photos)
```

The implementation should preserve the current ordering semantics, curated
seed entries, loved entries, and banned/broken filtering. A lower limit should
take effect on the next policy application or recrawl; the plan does not assume
that saving a limit immediately deletes photos unless that behavior is
explicitly chosen and tested.

### Admin experience

Add a compact **Rotation & Pool Policy** card near the existing pool selector
in `ImageFeedsTab`, with a clear summary for the selected pool:

- current visible count
- rotating limit
- loved count and an explicit “loved items are always retained” note
- a small preview of the effect of lowering the limit
- save/apply feedback and a recrawl affordance only when needed

Keep the global display-duration control in the System settings area, but give
it a more precise label such as “Time per image” and show the resulting human
readable duration. If product direction later requires per-pool display
duration, add it as a separate policy field and playback selector rather than
overloading `rotatingLimit`.

Use a list-detail shape on wide screens and a stacked card on phones, matching
the existing Environment admin pattern. Low-frequency policy controls should
remain below the high-frequency feed enable/disable controls.

### API and transport

Prefer extending the existing pool patch route with a narrow `policy` patch,
so REST remains the primary control surface:

```http
PATCH /api/pools/:name
{
  "policy": { "rotatingLimit": 500 }
}
```

The decoder, reducer command, REST response, and durable socket compatibility
spec should share one command/transport specification. Socket.IO should remain
a compatibility/live-sync adapter; it should not gain policy business logic.

The pool response should include normalized policy and derived counts. Counts
must be derived from the current collection snapshot rather than persisted as
independent mutable values.

## Functional design principles

- `normalizePoolPolicy`: pure normalization and validation.
- `resolvePoolPolicy`: pure defaulting against the current compatibility cap.
- `selectPoolPolicy`: pure state selector.
- `countPoolItems`: pure derived-count selector.
- `capCollectionLimit`: pure policy application, parameterized rather than
  hard-coded.
- `decode -> dispatch -> present`: one durable mutation path for REST and
  Socket.IO.
- Effects are limited to persistence, feed refresh/recrawl, and state-sync.
- No new state manager, database, or third-party UI library is justified.

Fantasy Land-style abstractions should be considered only if the existing
decode-result algebra can express this cleanly. A new `Maybe`/`Either` library
would add dependency and cognitive weight for a single bounded numeric field;
the current local result helpers are the better fit.

## Test plan

### Pure domain tests

- missing policy defaults to the legacy limit;
- valid limits normalize consistently from JSON number/string input if the
  existing decoder convention permits strings;
- zero, negative, fractional, NaN, infinity, and excessively large values are
  rejected or clamped according to one documented rule;
- unknown policy fields do not leak into state;
- a policy update preserves unrelated pool config and is silent when effective
  values are unchanged;
- REST and Socket.IO decoders produce the same command;
- pool responses expose derived counts without mutating state.

### Crawler tests

- the configured limit replaces the hard-coded 2,000 default;
- original curated entries retain their current treatment;
- loved dynamic entries survive the cap;
- ordinary dynamic entries are pruned in the existing order;
- a limit below the curated seed count has a documented, deterministic result;
- different pools receive independent policies;
- no policy input preserves current behavior exactly.

### UI/API tests

- the policy card is visible from the existing scenic-pool admin surface;
- changing the selected pool changes both values and counts;
- save feedback distinguishes success, validation failure, and recrawl status;
- the display-duration control remains separate and still patches
  `slideshowInterval`;
- lowering the cap does not silently remove loved photos;
- mobile layout remains usable.

Run the repository regression suite plus focused domain/crawler tests before
implementation is considered complete.

## Critical evaluation

### Strengths

- It solves the user-facing problem with one coherent admin card while
  respecting existing REST-first and functional-core boundaries.
- It makes the current loved-item guarantee explicit and protects it with
  tests.
- It keeps the initial data model small and backwards-compatible.
- It avoids pretending that age retention is supported when timestamps are not
  reliable enough yet.
- It makes the crawler cap configurable without moving crawler side effects
  into reducers or UI code.

### Risks and mitigations

1. **“Kept in rotation” may mean dwell time, retention age, or pool size.**
   Use explicit labels and separate controls. Do not ship a single ambiguous
   slider.
2. **A lower limit can surprise the operator.** Apply it on recrawl, show the
   projected effect, and never prune loved items. If immediate pruning is
   later requested, add an explicit confirmation and a reversible/archive
   policy.
3. **The current crawler treats the first 12 entries as curated seeds.** A
   user-configured low limit may expose this implementation detail. Document
   the minimum and define the result with a pure test before exposing values.
4. **Per-pool policy can drift from the active feed snapshot.** Return derived
   counts from the same collections used by playback and broadcast the updated
   state after persistence.
5. **Crawler fetch volume is not the same as retained pool size.** The first
   slice controls retained results only. Fetch quotas and source-specific page
   sizes should remain separate follow-up work.
6. **A large UI refactor could obscure a small feature.** Reuse the existing
   pool selector and Environment list-detail layout; avoid introducing a new
   component framework or state library.

## Sequencing and acceptance criteria

1. Add pure policy codec/selector tests and agree on bounds/defaults.
2. Parameterize the crawler cap and add focused retention tests.
3. Add the shared command/reducer/persistence path with transport-parity tests.
4. Add pool response counts and the admin card.
5. Add focused UI/API coverage, update public docs and the developer log, run
   `npm test`, and verify the served runtime state on Playwright.

Acceptance requires that an existing installation with no `poolPolicies`
behaves exactly as it does today, that loved items remain retained, that
undated legacy photos are not silently age-pruned, and that the admin UI makes
the distinction between display duration and pool retention obvious without
requiring documentation lookup.
