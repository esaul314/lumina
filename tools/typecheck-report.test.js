'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { categoryFor, summarize, statusFor } = require('./typecheck-report.js');

const root = path.resolve(__dirname, '..');
const diagnostic = (fileName, code) => ({ file: fileName && { fileName: path.join(root, fileName) }, code });

test('diagnostic grouping partitions roots, fixtures, transitives, and missing locations', () => {
  const inputs = [diagnostic('server/domain/commands.js', 1), diagnostic('type-fixtures/domain.ts', 2),
    diagnostic('server/domain/snapshot.js', 3), diagnostic(null, 4)];
  const groups = summarize(root)(inputs);
  assert.deepEqual(Object.values(groups).map((items) => items.length), [1, 1, 1, 1]);
  assert.deepEqual(Object.values(groups).flat().map(({ code }) => code).sort(), [1, 2, 3, 4]);
  assert.equal(categoryFor(root)(diagnostic('server/domain/commands.js.extra', 5)), 'transitive modules');
  assert.deepEqual(Object.values(summarize(root)([])).map((items) => items.length), [0, 0, 0, 0]);
});

test('the diagnostic command fails on any reported diagnostic and can become green', () => {
  assert.equal(statusFor([]), 0);
  assert.equal(statusFor([diagnostic('type-fixtures/domain.ts', 2578)]), 1);
  assert.equal(statusFor([diagnostic(null, 1)]), 1);
});

test('compile-time fixtures check positive cases and detect a weakened negative assertion', () => {
  const configPath = path.join(root, 'tsconfig.domain.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configPath);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.options.noEmit, true);
  const fixturePath = path.join(root, 'type-fixtures/domain.ts');
  const original = fs.readFileSync(fixturePath, 'utf8');
  const mutated = original.replace("type: 'not-a-command'", "type: 'set-scale-mode'");
  assert.notEqual(mutated, original);
  const reducerPath = path.join(root, 'server/domain/reducer.js');
  const reducerSource = fs.readFileSync(reducerPath, 'utf8');
  // Check the private factory in its own lexical scope without adding exports.
  const readerFixture = `
    /** @type {DomainState} */ const fixtureState = /** @type {DomainState} */ ({});
    const fixtureFamilies = createReducerFamilyInterpreter([{
      buildEnv: (/** @type {{seed: number}} */ env) => ({ factor: env.seed }),
      reducers: {
        inspect: (/** @type {DomainState} */ state, /** @type {{type: 'inspect', value: number}} */ command, /** @type {{factor: number}} */ env) => command.value * env.factor
      }
    }]);
    /** @type {number | ReducerResult} */ const fixtureFamilyResult = fixtureFamilies(fixtureState, { type: 'inspect', value: 2 }, { seed: 3 });
    // @ts-expect-error dispatch retains the reducer's numeric result, not any
    /** @type {string | ReducerResult} */ const fixtureWrongFamilyResult = fixtureFamilies(fixtureState, null, { seed: 3 });
    // @ts-expect-error dispatch can miss and return an unchanged-state envelope
    /** @type {number} */ const fixtureFamilyNumberOnly = fixtureFamilyResult;
    // @ts-expect-error the original command type remains checked through dispatch
    fixtureFamilies(fixtureState, { type: 'inspect', value: 'wrong' }, { seed: 3 });
    // @ts-expect-error the environment adapter retains its original input type
    fixtureFamilies(fixtureState, null, { seed: 'wrong' });
    const fixtureBareFamilies = createReducerFamilyInterpreter(Object.freeze([{
      reducers: { bare: (/** @type {DomainState} */ state, /** @type {{type: 'bare'}} */ command, /** @type {undefined} */ env) => command.type }
    }]));
    /** @type {'bare' | ReducerResult} */ const fixtureBareResult = fixtureBareFamilies(fixtureState, { type: 'bare' }, undefined);
    /** @type {ReducerFamily<{type: 'inspect'}, {seed: number}, {factor: number}, number>} */
    const fixtureInvalidFamily = {
      buildEnv: env => ({ factor: env.seed }),
      // @ts-expect-error adapted reducers must accept their adapter's output
      reducers: { inspect: (state, command, /** @type {{factor: string}} */ env) => env.factor.length }
    };
    /** @type {ReducerFamily<{type: 'bare'}, {}, {factor: number}, number>} */
    // @ts-expect-error without an adapter, reducers must accept undefined
    const fixtureMissingAdapter = { reducers: { bare: (state, command, /** @type {{factor: number}} */ env) => env.factor } };
    const fixtureProductionFamilyResult = interpretCommandFamilies(fixtureState, null, { now: new Date(), rng: () => 0 });
    /** @type {unknown} */ const fixtureFamilyRawUrl = fixtureProductionFamilyResult.nextState.playback.activePhotoUrl;
    // @ts-expect-error family results retain the unvalidated active URL
    /** @type {string | null} */ const fixtureFamilyNormalizedUrl = fixtureProductionFamilyResult.nextState.playback.activePhotoUrl;
    const fixtureReader = readPatchField('x', (value, state, patch) => {
      /** @type {unknown} */ const raw = value;
      /** @type {DomainState} */ const sameState = state;
      /** @type {unknown} */ const samePatch = patch;
      return 7;
    });
    /** @type {number | typeof PATCH_SKIP} */ const fixtureResult = fixtureReader({}, fixtureState);
    const fixtureIdentity = readPatchField('x');
    /** @type {unknown} */ const fixtureRaw = fixtureIdentity({}, fixtureState);
    /** @type {number} */
    // @ts-expect-error an omitted normalizer does not guarantee a number
    const fixtureUnsafeIdentity = fixtureIdentity({}, fixtureState);
    /** @type {number} */
    // @ts-expect-error missing fields may return the skip sentinel
    const fixtureUnsafeResult = fixtureReader({}, fixtureState);
    // @ts-expect-error a normalizer must accept an unknown raw value
    readPatchField('x', (/** @type {string} */ value) => value);
    /** @type {unknown} */ const fixtureCandidate = {};
    // @ts-expect-error unchecked candidates cannot be indexed
    fixtureCandidate.field;
    if (isPlainObject(fixtureCandidate)) {
      /** @type {unknown} */ const fixtureField = fixtureCandidate.field;
      // @ts-expect-error property values remain unknown
      /** @type {string} */ const fixtureString = fixtureCandidate.field;
    }
    const fixtureSpec = createConfigPatchSpec('theme', {
      readValue: () => 42,
      hasChanged: (state, value) => value > 0,
      applyValue: (state, value) => ({ ...state, config: { ...state.config, theme: value } }),
      flags: { refreshWeather: 'truthy' }
    });
    /** @type {number | typeof PATCH_SKIP} */ const fixtureSpecRead = fixtureSpec.readValue({}, fixtureState);
    // @ts-expect-error custom readers do not accept string values in their callbacks
    fixtureSpec.hasChanged(fixtureState, 'wrong');
    const fixtureDefaultSpec = createConfigPatchSpec('theme');
    // @ts-expect-error the default reader retains unknown values
    /** @type {number} */ const fixtureDefaultRead = fixtureDefaultSpec.readValue({}, fixtureState);
    // @ts-expect-error a custom comparator without a reader must accept unknown values
    createConfigPatchSpec('theme', { hasChanged: (state, /** @type {number} */ value) => value > 0 });
    /** @type {PatchContext} */ const fixtureContext = {
      patch: {}, nextState: fixtureState, changed: false, recomputePhotos: false, refreshWeather: false
    };
    const fixtureSharedSpec = createPatchSpec({
      readValue: () => 'value',
      hasChanged: (state, value) => value.length > 0,
      applyValue: (state, value) => ({ ...state, config: { ...state.config, theme: value } })
    });
    /** @type {PatchContext} */ const fixtureApplied = applyPatchSpec(fixtureContext, fixtureSharedSpec);
    // @ts-expect-error callbacks retain their shared string result type
    fixtureSharedSpec.applyValue(fixtureState, 2);
    // @ts-expect-error a spec requires a writer
    createPatchSpec({ readValue: () => 1, hasChanged: () => true });
    const fixtureWidgets = readWidgetPatch({}, fixtureState);
    if (fixtureWidgets !== PATCH_SKIP) {
      /** @type {boolean | undefined} */ const maybeWidget = fixtureWidgets.missing;
      // @ts-expect-error arbitrary widget keys can be absent
      /** @type {boolean} */ const presentWidget = fixtureWidgets.missing;
      // @ts-expect-error normalized values cannot be strings
      fixtureWidgets.clock = 'visible';
    }
    /** @type {ReducerResult} */ const fixturePatchResult = reduceStatePatchCommand(fixtureState, null, {});
    /** @type {Effect[]} */ const fixtureEffects = fixturePatchResult.effects;
    reduceStatePatchCommand(fixtureState, { theme: 7 }, { now: new Date(), rng: () => 0.5 });
    // @ts-expect-error state must be a domain state
    reduceStatePatchCommand({}, {}, {});
    // @ts-expect-error an execution environment is required
    reduceStatePatchCommand(fixtureState, {});
    // @ts-expect-error the random source must be callable
    reduceStatePatchCommand(fixtureState, {}, { rng: 3 });
    buildMutationResult(fixtureState, { effects: [{ type: 'refresh-weather' }] });
    // @ts-expect-error effects use the closed effect vocabulary
    buildMutationResult(fixtureState, { effects: [{ type: 'not-an-effect' }] });
    const fixtureOutput = [{ type: 'photo-update' }];
    /** @type {typeof fixtureOutput} */ const resolvedDirect = resolveMutationOutput(fixtureOutput, fixtureState);
    /** @type {number} */ const resolvedFactory = resolveMutationOutput((/** @type {string} */ value) => value.length, 'context');
    // @ts-expect-error a factory must accept its supplied context
    resolveMutationOutput((/** @type {string} */ value) => value.length, 5);
    const fixtureBuilt = buildMutationResult(fixtureState, {
      events: (state) => state === fixtureState ? [{ type: 'state-sync' }] : null,
      effects: (state) => state === fixtureState ? [{ type: 'refresh-weather' }] : false
    });
    /** @type {DomainState} */ const fixtureBuiltState = fixtureBuilt.nextState;
    /** @type {Event[]} */ const fixtureBuiltEvents = fixtureBuilt.events;
    const fixtureCustom = buildMutationResult(fixtureState, {
      context: { count: 1 },
      events: (context) => context.count ? [{ type: 'photo-update' }] : [],
      effects: (context) => context.count ? [{ type: 'refresh-weather' }] : []
    });
    /** @type {DomainState} */ const fixtureCustomState = fixtureCustom.nextState;
    buildMutationResult(fixtureState, { context: null, events: (context) => context === null ? [] : [] });
    buildMutationResult(fixtureState, { context: undefined, events: (state) => state.config ? [] : [] });
    // @ts-expect-error event types use the closed event vocabulary
    buildMutationResult(fixtureState, { events: [{ type: 'not-an-event' }] });
    // @ts-expect-error explicit context must match the factory argument
    buildMutationResult(fixtureState, { context: { count: 1 }, events: (/** @type {string} */ value) => [] });
    // @ts-expect-error undefined context defaults to state, not undefined
    buildMutationResult(fixtureState, { context: undefined, events: (/** @type {undefined} */ value) => [] });
    const fixtureCloneResult = reduceClonedMutation(fixtureState, (state) => state.config, (state) => state.playback);
    /** @type {DomainState['playback'] | ReducerResult} */ const fixtureCloneUnion = fixtureCloneResult;
    // @ts-expect-error no-op returns a reducer result, not always playback
    /** @type {DomainState['playback']} */ const fixtureAlwaysChanged = fixtureCloneResult;
    // @ts-expect-error apply receives a domain state
    reduceClonedMutation(fixtureState, (/** @type {string} */ state) => true, () => 1);
    // @ts-expect-error continuation receives a domain state
    reduceClonedMutation(fixtureState, () => true, (/** @type {number} */ state) => state);
    /** @type {ReducerResult} */ const fixtureMutation = reduceStateMutation(fixtureState, {
      apply: (state) => state.config,
      events: (state) => state.playback ? [{ type: 'state-sync' }] : [],
      effects: (state) => state.config ? [{ type: 'refresh-weather' }] : null
    });
    // @ts-expect-error an apply callback is required
    reduceStateMutation(fixtureState, {});
    // @ts-expect-error factories receive state, not a string
    reduceStateMutation(fixtureState, { apply: () => true, effects: (/** @type {string} */ value) => [] });
    // @ts-expect-error events retain their closed vocabulary
    reduceStateMutation(fixtureState, { apply: () => true, events: [{ type: 'invalid' }] });
    const fixtureCommand = { name: 'selected', count: 1 };
    /** @type {ReducerResult} */ const fixtureCommandResult = reduceCommandMutation(fixtureState, fixtureCommand, {
      apply: (state, command) => state.config && command.count,
      events: (state, command) => command.name ? [{ type: 'state-sync' }] : null,
      effects: (state, command) => command.count ? [{ type: 'refresh-weather' }] : false
    });
    reduceCommandMutation(fixtureState, fixtureCommand, { apply: () => true, events: [], effects: null });
    // @ts-expect-error an apply callback is required
    reduceCommandMutation(fixtureState, fixtureCommand, {});
    // @ts-expect-error callback command must accept the actual command
    reduceCommandMutation(fixtureState, fixtureCommand, { apply: (state, /** @type {number} */ command) => true });
    // @ts-expect-error output factories receive the actual command
    reduceCommandMutation(fixtureState, fixtureCommand, { apply: () => true, events: (state, /** @type {number} */ command) => [] });
    // @ts-expect-error effects retain their closed vocabulary
    reduceCommandMutation(fixtureState, fixtureCommand, { apply: () => true, effects: [{ type: 'invalid' }] });
    const fixtureEntriesReducer = buildEntriesCommandReducer(
      (state) => state.config,
      (/** @type {{name: string}} */ command, state, target) => {
        /** @type {DomainState['config']} */ const selected = target;
        return [['theme', command.name]];
      },
      { events: (state, command) => command.name ? [{ type: 'state-sync' }] : [] }
    );
    /** @type {ReducerResult} */ const fixtureEntriesResult = fixtureEntriesReducer(fixtureState, { name: 'x' });
    // @ts-expect-error the partially applied reducer retains its command type
    fixtureEntriesReducer(fixtureState, { name: 7 });
    // @ts-expect-error the selector receives a domain state
    buildEntriesCommandReducer((/** @type {string} */ state) => state, []);
    // @ts-expect-error events retain their closed vocabulary
    buildEntriesCommandReducer((state) => state.config, [], { events: [{ type: 'invalid' }] });
    const fixtureFieldReducer = buildFieldCommandReducer(
      (state) => state.config, 'theme',
      (/** @type {{name: string}} */ command, state) => state.config ? command.name : '',
      { effects: (state, command) => command.name ? [{ type: 'refresh-weather' }] : [] }
    );
    /** @type {ReducerResult} */ const fixtureFieldResult = fixtureFieldReducer(fixtureState, { name: 'x' });
    // @ts-expect-error the partially applied field reader retains its command type
    fixtureFieldReducer(fixtureState, { name: 7 });
    // @ts-expect-error field names are property keys
    buildFieldCommandReducer((state) => state.config, {}, () => 'x');
    buildFieldCommandReducer((state) => state.config, 'theme', (/** @type {string} */ command) => command,
      // @ts-expect-error output factories receive the same command as the reader
      { effects: (state, /** @type {number} */ command) => [] });
    /** @type {ReducerResult} */ const fixtureFinalized = finalizeFeedMutation(fixtureState, {
      direction: 'prev', eventsFor: (result) => result.photoChanged ? [{ type: 'photo-update' }] : [],
      effects: (result) => {
        /** @type {unknown} */ const rawUrl = result.state.playback.activePhotoUrl;
        // @ts-expect-error callbacks cannot assume a normalized active URL
        /** @type {string | null} */ const normalizedUrl = result.state.playback.activePhotoUrl;
        return result.state.config ? [{ type: 'refresh-weather' }] : [];
      }
    });
    /** @type {DomainState} */ const fixtureSharedFinalization = fixtureFinalized.nextState;
    /** @type {ReducerResult} */ const fixtureFeedMutation = reduceFeedMutation(fixtureState, {
      apply: (state) => state.config, persist: true
    }, { rng: () => 0.5 });
    /** @type {DomainState} */ const fixtureSharedFeedMutation = fixtureFeedMutation.nextState;
    // @ts-expect-error finalization context is not a string
    finalizeFeedMutation(fixtureState, { eventsFor: (/** @type {string} */ value) => [] });
    // @ts-expect-error events retain their closed vocabulary
    finalizeFeedMutation(fixtureState, { eventsFor: [{ type: 'invalid' }] });
    // @ts-expect-error feed mutations require an apply callback
    reduceFeedMutation(fixtureState, {}, {});
    const fixturePayloadReducer = withCommandPayload(
      (/** @type {{value: number | null}} */ command) => command.value,
      (state, command, payload, env) => ({ payload, command, state, env })
    );
    const fixturePayloadResult = fixturePayloadReducer(fixtureState, { value: 3 });
    if ('payload' in fixturePayloadResult) {
      /** @type {number} */ const payloadValue = fixturePayloadResult.payload;
      // @ts-expect-error null payloads do not reach the continuation
      /** @type {null} */ const nullPayload = fixturePayloadResult.payload;
    }
    // @ts-expect-error the reader preserves its command type
    fixturePayloadReducer(fixtureState, { value: 'wrong' });
    const fixtureOptionSymbol = Symbol('not an enumerable string key');
    const fixtureResolvedOptions = resolveReducerOptions({
      count: (/** @type {number} */ payload) => payload + 1,
      unchanged: 'constant', [fixtureOptionSymbol]: 2
    }, 3, fixtureCommand, fixtureState);
    /** @type {number | undefined} */ const maybeCount = fixtureResolvedOptions.count;
    // @ts-expect-error enumerable membership is not guaranteed
    /** @type {number} */ const definiteCount = fixtureResolvedOptions.count;
    // @ts-expect-error symbols are not projected by Object.entries
    fixtureResolvedOptions[fixtureOptionSymbol];
    const fixtureFeedReducer = buildFeedCommandReducer({
      readPayload: (/** @type {{value: number}} */ command) => command.value > 0 ? command.value : null,
      apply: (next, payload, command, original) => next !== original && payload === command.value,
      direction: (payload, command, state) => payload === command.value && state.config ? 'next' : 'prev',
      eventsFor: (payload) => (finalized) => payload && finalized.photoChanged ? [{ type: 'photo-update' }] : [],
      persist: (payload) => payload > 0
    });
    /** @type {ReducerResult} */ const fixtureFeedResult = fixtureFeedReducer(fixtureState, { value: 1 });
    // @ts-expect-error a command-builder result does not guarantee normalized URLs
    /** @type {string | null} */ const fixtureNormalizedFeedCommandUrl = fixtureFeedResult.nextState.playback.activePhotoUrl;
    fixtureFeedReducer(fixtureState, { value: 1 }, {
      effects: finalized => {
        /** @type {unknown} */ const url = finalized.state.playback.activePhotoUrl;
        // @ts-expect-error environment factories also receive raw finalization state
        /** @type {string | null} */ const normalized = finalized.state.playback.activePhotoUrl;
        return [];
      }
    });
    // @ts-expect-error the feed reducer retains its command type
    fixtureFeedReducer(fixtureState, { value: 'wrong' });
    buildFeedCommandReducer({
      readPayload: (/** @type {{value: number}} */ command) => command.value,
      apply: (next, payload) => payload > 0,
      // @ts-expect-error a direction resolver must return a supported direction
      direction: () => 'sideways'
    });
    /** @type {ReducerResult} */ const fixturePoolMutation = reducePoolMutation(fixtureState, 'garden', {
      poolExists: (state, name) => state.config && name === 'garden',
      apply: (next, name) => next.config && name.length > 0,
      effects: [{ type: 'refresh-weather' }]
    });
    // Omitted options are supported until a matching pool requires apply.
    reducePoolMutation(fixtureState, 'missing');
    // @ts-expect-error the guard must accept the supplied numeric name
    reducePoolMutation(fixtureState, 4, {
      poolExists: (state, /** @type {string} */ name) => name.length
    });
    const fixturePoolReducer = buildPoolCommandReducer({
      readPayload: (/** @type {{name: string, count: number}} */ command) => command.name ? command : null,
      apply: (next, payload, command, original) => {
        /** @type {string} */ const poolName = payload.name;
        /** @type {number | undefined} */ const copiedCount = payload.count;
        // @ts-expect-error payload copies can omit non-enumerable or inherited fields
        /** @type {number} */ const requiredCount = payload.count;
        return next !== original && command.name === poolName && copiedCount !== undefined;
      },
      effects: (payload, command) => payload.count === command.count ? [{ type: 'refresh-weather' }] : [],
      poolExists: (state, name) => state.config && name.length,
      persist: (payload) => payload.count > 0
    });
    /** @type {ReducerResult} */ const fixturePoolResult = fixturePoolReducer(fixtureState, { name: 'garden', count: 2 });
    // @ts-expect-error the pool reducer retains its command type
    fixturePoolReducer(fixtureState, { name: 'garden', count: 'wrong' });
    buildPoolCommandReducer({
      readPayload: (/** @type {{name: string}} */ command) => command,
      apply: () => true,
      // @ts-expect-error persistence resolvers must return booleans
      persist: () => 'yes'
    });
    const fixturePlayback = buildPlaybackCommandReducer({
      readPayload: (/** @type {{photo: {url: string, marker: number}}} */ command) => command.photo,
      selectPhoto: (state, payload, env) => payload,
      resolveDirection: (payload, command, state, env) => payload.marker ? 'next' : 'prev',
      prepareState: (next, payload, photo, command, original, env) => {
        /** @type {number} */ const marker = photo.marker;
        /** @type {string} */ const url = command.photo.url;
        return next;
      }
    });
    /** @type {ReducerResult} */ const fixturePlaybackResult = fixturePlayback(fixtureState, { photo: { url: 'x', marker: 1 } });
    // @ts-expect-error the command preserves its selected row type
    fixturePlayback(fixtureState, { photo: { url: 'x', marker: 'wrong' } });
    applyPlaybackSelection(fixtureState, { url: 'x', marker: 1 }, {
      direction: 'next', prepareState: (next, photo) => photo.marker ? next : fixtureState
    });
    applyPlaybackSelection(fixtureState, { url: 'x' }, {
      // @ts-expect-error directions are limited to the playback vocabulary
      direction: 'sideways'
    });
    buildPlaybackCommandReducer({
      readPayload: (/** @type {{url: string}} */ command) => command,
      selectPhoto: (state, payload) => payload,
      // @ts-expect-error direction resolvers must return a supported direction
      resolveDirection: () => 'sideways'
    });
    const fixtureActiveUpdate = updateActivePhotoUrl(fixtureState, { url: { raw: true } }, 'next');
    /** @type {unknown} */ const fixtureRawActiveUrl = fixtureActiveUpdate.state.playback.activePhotoUrl;
    // @ts-expect-error active URLs preserve arbitrary raw feed values
    /** @type {string | null} */ const fixtureNormalizedActiveUrl = fixtureActiveUpdate.state.playback.activePhotoUrl;
    /** @type {boolean} */ const fixturePhotoChanged = ensureActivePhoto(fixtureState, { now: null, rng: null }).photoChanged;
    const fixtureRecomputed = recomputeFeed(fixtureState, null);
    /** @type {Photo[]} */ const fixtureBuiltFeed = fixtureRecomputed.library.photosList;
    const fixtureRecomputeResult = recomputeAndEnsureActivePhoto(fixtureState, { now: null, rng: null });
    /** @type {unknown} */ const fixtureFinalizedUrl = fixtureRecomputeResult.state.playback.activePhotoUrl;
    // @ts-expect-error recomputation can select a row with an unvalidated URL
    /** @type {string | null} */ const fixtureFinalizedStringUrl = fixtureRecomputeResult.state.playback.activePhotoUrl;
    // @ts-expect-error execution inputs retain the RNG callback contract
    recomputeFeed(fixtureState, 42);
    // @ts-expect-error unsupported directions are outside the typed contract
    recomputeAndEnsureActivePhoto(fixtureState, { direction: 'sideways' });
    // @ts-expect-error unsupported directions do not belong to the typed contract
    ensureActivePhoto(fixtureState, { direction: 'sideways' });
    // @ts-expect-error photo inputs are feed rows, not primitive numbers
    updateActivePhotoUrl(fixtureState, 3, 'next');
    const fixtureLookup = findSelectablePhoto(fixtureState, { key: 'raw' }, { marker: 7 });
    /** @type {FeedPhoto | {marker: number} | null} */ const fixtureLookupResult = fixtureLookup;
    // @ts-expect-error a fallback is not guaranteed to be selected
    /** @type {{marker: number}} */ const fixtureFallbackOnly = fixtureLookup;
    const fixtureStaged = prependVisiblePhoto([{ url: 'x', existing: true }], { url: 'y', count: 2 });
    /** @type {boolean | undefined} */ const fixtureExisting = 'existing' in fixtureStaged[0] ? fixtureStaged[0].existing : undefined;
    if ('count' in fixtureStaged[0]) {
      // @ts-expect-error a copied property may have been inherited or non-enumerable
      /** @type {number} */ const fixtureRequiredCount = fixtureStaged[0].count;
    }
    // @ts-expect-error feed entries must be URL-bearing row shapes
    prependVisiblePhoto([42], { url: 'x' });
  `;
  const host = ts.createCompilerHost(parsed.options);
  const readFile = host.readFile.bind(host);
  host.readFile = (fileName) => {
    const resolved = path.resolve(fileName);
    if (resolved === fixturePath) return mutated;
    if (resolved === reducerPath) return reducerSource + readerFixture;
    return readFile(fileName);
  };
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const commandsPath = path.join(root, 'server/domain/commands.js');
  const commands = program.getSourceFile(commandsPath);
  const decoder = commands.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'decodeStatePatchCommand');
  assert.ok(decoder);
  assert.deepEqual(diagnostics.filter((item) => item.file === commands && item.code === 18046 &&
    item.start >= decoder.getStart(commands) && item.start < decoder.end), []);
  const readerDiagnostics = diagnostics.filter((item) => item.file &&
    path.resolve(item.file.fileName) === reducerPath && item.start >= reducerSource.length);
  assert.deepEqual(readerDiagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')), []);
  const fixtureDiagnostics = diagnostics
    .filter((item) => item.file && path.resolve(item.file.fileName) === fixturePath);
  // Only the intentionally weakened check may fail.
  const lines = mutated.split('\n');
  const located = fixtureDiagnostics.map((item) => ({
    code: item.code,
    line: lines[item.file.getLineAndCharacterOfPosition(item.start).line]
  }));
  assert.equal(located.filter(({ code }) => code === 2578).length, 1);
  assert.ok(located.every(({ code, line }) => (
    code === 2578 && line.includes('@ts-expect-error unrecognized commands')
  )));
});
