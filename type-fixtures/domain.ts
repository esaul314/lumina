// Compile-only examples of the currently documented boundary contracts.
// Expected errors are assertions: an unused directive is itself a diagnostic.
import type { Command, Effect, ReducerEnvironment, DomainState, Photo } from '../server/domain/types';
import { buildBooleanFieldPatch, decodeStatePatchCommand } from '../server/domain/commands';
import { reduceDomainCommand } from '../server/domain/reducer';
import { createDomainDispatcher, createTypedHandlerInvoker } from '../server/domain/dispatch';
import { filterVisiblePhotos, selectSmartPhoto, uniqByUrl } from '../server/domain/selectors';

declare const state: DomainState;
declare const photos: Photo[];
declare const dispatcher: ReturnType<typeof createDomainDispatcher>;

const command: Command = { type: 'set-scale-mode', payload: { mode: 'cover' } };
const effect: Effect = { type: 'refresh-active-feed', payload: { categories: ['Google Photos'] } };
const environment: ReducerEnvironment = { now: new Date(0), rng: () => 0.5 };
const decoded: Command | null = decodeStatePatchCommand({ theme: 17 });
const result = reduceDomainCommand(state, command, environment);
const visible: Photo[] = filterVisiblePhotos(photos);
const selected: Photo | null = selectSmartPhoto({ state, rng: () => 0.5 });
const unique: Array<{ url: string; marker: number }> = uniqByUrl([{ url: 'a', marker: 1 }]);
const pending = dispatcher.dispatchCommand(command, environment);

// @ts-expect-error command type and payload must stay correlated
const wrongPayload: Command = { type: 'set-scale-mode', payload: { intervalMs: 1000 } };
// @ts-expect-error unrecognized commands are outside the closed vocabulary
const wrongCommand: Command = { type: 'not-a-command' };
// @ts-expect-error feed refresh requires category payload
const missingEffectPayload: Effect = { type: 'refresh-active-feed' };
// @ts-expect-error environment RNG must return a number
const wrongEnvironment: ReducerEnvironment = { rng: () => 'random' };
// @ts-expect-error selector direction is closed
selectSmartPhoto({ state, direction: 'sideways' });
// @ts-expect-error photo URL must be a string in the documented model
filterVisiblePhotos([{ url: 7 }]);
// @ts-expect-error output remains nullable
const alwaysPhoto: Photo = selected;
// @ts-expect-error decoded command may be null
const alwaysCommand: Command = decoded;

// Deliberately red readiness assertions: the current curry and interpreter
// signatures erase their results to any. Keep these errors visible until the
// local contracts preserve the relationships without changing runtime policy.
type IsAny<T> = 0 extends (1 & T) ? true : false;
type AssertFalse<T extends false> = T;
type CurriedPatchIsNotAny = AssertFalse<IsAny<ReturnType<typeof buildBooleanFieldPatch>>>;
type HandlerResultIsNotAny = AssertFalse<IsAny<ReturnType<ReturnType<typeof createTypedHandlerInvoker>>>>;

void [effect, result, visible, unique, pending, wrongPayload, wrongCommand,
  missingEffectPayload, wrongEnvironment, alwaysPhoto, alwaysCommand];
