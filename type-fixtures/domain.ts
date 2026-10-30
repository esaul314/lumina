// Compile-only examples of the currently documented boundary contracts.
// Expected errors are assertions: an unused directive is itself a diagnostic.
import type { ActivePhotoPreview, Command, Effect, ReducerEnvironment, DomainState, FeedPhoto, Photo } from '../server/domain/types';
import { buildBooleanFieldPatch, decodeScreensaverActiveCommand, decodeStatePatchCommand } from '../server/domain/commands';
import { reduceDomainCommand } from '../server/domain/reducer';
import { buildDomainState, buildSnapshot } from '../server/domain/snapshot';
import { createDomainDispatcher, createTypedHandlerInvoker } from '../server/domain/dispatch';
import { deriveCurrentFrame, filterPhotosForNight, filterPhotosForTime, filterPhotosForWeather, filterVisiblePhotos, findPhotoInFeed, getActivePhoto, inferOrientation, selectSequentialPhoto, selectSmartPhoto, selectSmartPhotoFromFeed, selectWeightedRandomPhoto, uniqByUrl } from '../server/domain/selectors';

declare const state: DomainState;
declare const photos: Photo[];
declare const dispatcher: ReturnType<typeof createDomainDispatcher>;
const compatibilityTheme: unknown = state.config.theme;
const snapshotTheme: unknown = buildSnapshot(state).theme;
const configWithRawTheme: DomainState['config'] = { ...state.config, theme: { legacy: true } };
// @ts-expect-error theme must be narrowed before use as a string
const normalizedTheme: string = state.config.theme;
// @ts-expect-error public snapshots preserve the same unvalidated theme
const normalizedSnapshotTheme: string = buildSnapshot(state).theme;
const configWithRawTiming: DomainState['config'] = {
  ...state.config, inactivityTimeout: { legacy: true }, slideshowInterval: 'later'
};
const compatibilityTimeout: unknown = state.config.inactivityTimeout;
const snapshotInterval: unknown = buildSnapshot(state).slideshowInterval;
// @ts-expect-error timeout must be narrowed before numeric use
const normalizedTimeout: number = state.config.inactivityTimeout;
// @ts-expect-error snapshots preserve unvalidated interval values
const normalizedSnapshotInterval: number = buildSnapshot(state).slideshowInterval;
const configWithRawScale: DomainState['config'] = { ...state.config, scaleMode: { legacy: true } };
const compatibilityScale: unknown = state.config.scaleMode;
const snapshotScale: unknown = buildSnapshot(state).scaleMode;
// @ts-expect-error scale mode must be narrowed before use as a supported mode
const normalizedScale: 'cover' | 'contain' = state.config.scaleMode;
// @ts-expect-error snapshots preserve the same unvalidated scale mode
const normalizedSnapshotScale: 'cover' | 'contain' = buildSnapshot(state).scaleMode;
const configWithRawCrop: DomainState['config'] = { ...state.config, splitCropPercent: { legacy: true } };
const compatibilityCrop: unknown = state.config.splitCropPercent;
const snapshotCrop: unknown = buildSnapshot(state).splitCropPercent;
const frameCrop: unknown = buildSnapshot(state).currentFrame.crop.secondaryPercent;
// @ts-expect-error crop must be narrowed before numeric use
const normalizedCrop: number = state.config.splitCropPercent;
// @ts-expect-error snapshots preserve unvalidated crop values
const normalizedSnapshotCrop: number = buildSnapshot(state).splitCropPercent;
// @ts-expect-error the secondary frame may inherit an unvalidated crop value
const normalizedFrameCrop: number = buildSnapshot(state).currentFrame.crop.secondaryPercent;
const configWithRawSplit: DomainState['config'] = { ...state.config, splitPortrait: { legacy: true } };
const compatibilitySplit: unknown = state.config.splitPortrait;
const snapshotSplit: unknown = buildSnapshot(state).splitPortrait;
// @ts-expect-error raw patches do not guarantee a boolean split setting
const normalizedSplit: boolean = state.config.splitPortrait;
// @ts-expect-error snapshots preserve the same unvalidated split setting
const normalizedSnapshotSplit: boolean = buildSnapshot(state).splitPortrait;
const configWithRawFallback: DomainState['config'] = { ...state.config, allowOpenAiFallback: { legacy: true } };
const compatibilityFallback: unknown = state.config.allowOpenAiFallback;
const snapshotFallback: unknown = buildSnapshot(state).allowOpenAiFallback;
// @ts-expect-error raw patches do not guarantee boolean fallback consent
const normalizedFallback: boolean = state.config.allowOpenAiFallback;
// @ts-expect-error snapshots preserve the same unvalidated fallback value
const normalizedSnapshotFallback: boolean = buildSnapshot(state).allowOpenAiFallback;
const configWithRawWeather: DomainState['config'] = { ...state.config, alignWeather: { legacy: true } };
const compatibilityWeather: unknown = state.config.alignWeather;
const snapshotWeather: unknown = buildSnapshot(state).alignWeather;
// @ts-expect-error raw patches do not guarantee a boolean weather setting
const normalizedWeather: boolean = state.config.alignWeather;
// @ts-expect-error public snapshots preserve the unvalidated weather value
const normalizedSnapshotWeather: boolean = buildSnapshot(state).alignWeather;
filterPhotosForWeather(photos, compatibilityWeather, 'Snowy', 'Cloudy');
selectSmartPhotoFromFeed({ photos, alignWeather: compatibilityWeather });
const configWithRawTime: DomainState['config'] = { ...state.config, alignTimeOfDay: { legacy: true } };
const compatibilityTime: unknown = state.config.alignTimeOfDay;
const snapshotTime: unknown = buildSnapshot(state).alignTimeOfDay;
// @ts-expect-error raw patches do not guarantee a boolean time setting
const normalizedTime: boolean = state.config.alignTimeOfDay;
// @ts-expect-error public snapshots preserve the unvalidated time value
const normalizedSnapshotTime: boolean = buildSnapshot(state).alignTimeOfDay;
filterPhotosForNight(photos, compatibilityTime, true, 100);
selectSmartPhotoFromFeed({ photos, alignTimeOfDay: compatibilityTime });
const configWithRawNightPercentage: DomainState['config'] = { ...state.config, nightPercentage: { legacy: true } };
const compatibilityNightPercentage: unknown = state.config.nightPercentage;
const snapshotNightPercentage: unknown = buildSnapshot(state).nightPercentage;
// @ts-expect-error raw patches do not guarantee a numeric night percentage
const normalizedNightPercentage: number = state.config.nightPercentage;
// @ts-expect-error public snapshots preserve the unvalidated percentage
const normalizedSnapshotNightPercentage: number = buildSnapshot(state).nightPercentage;
filterPhotosForNight(photos, true, true, compatibilityNightPercentage);
selectSmartPhotoFromFeed({ photos, nightPercentage: compatibilityNightPercentage });

const command: Command = { type: 'set-scale-mode', payload: { mode: 'cover' } };
const preview = { url: 'preview', title: 9, width: 'wide', orientation: 'sideways' };
const rawFeedState: DomainState = { ...state, library: { ...state.library, photosList: [preview] } };
declare const legacyState: Parameters<typeof buildDomainState>[0];
const rawLegacyState: Parameters<typeof buildDomainState>[0] = { ...legacyState, photosList: [preview] };
const rebuiltRawFeed: FeedPhoto[] = buildDomainState(rawLegacyState, state.library.collections).library.photosList;
const rawFeed: FeedPhoto[] = rawFeedState.library.photosList;
const rawSnapshotFeed: FeedPhoto[] = buildSnapshot(rawFeedState).photosList;
const rawSequential: FeedPhoto | null = selectSequentialPhoto({ state: rawFeedState });
const rawSequentialCategory: unknown = rawSequential?.category;
// @ts-expect-error cursor lookup does not normalize the selected category
const normalizedSequentialCategory: string | undefined = rawSequential?.category;
const rawSmart: FeedPhoto | null = selectSmartPhoto({ state: rawFeedState });
const rawSmartFeed: typeof preview | null = selectSmartPhotoFromFeed({ photos: [preview], previousCategory: { legacy: true } });
const rawWeighted: typeof preview | null = selectWeightedRandomPhoto({ photos: [preview], currentPhotoUrl: { legacy: true } });
const rawRatingRows = [{ url: 'rated', rating: { legacy: true } }];
const rawRatingSelection: typeof rawRatingRows[number] | null = selectWeightedRandomPhoto({ photos: rawRatingRows });
// @ts-expect-error successful selection does not validate or normalize rating metadata
const numericRating: number | undefined = rawRatingSelection?.rating;
const rawTimed: typeof preview[] = filterPhotosForTime([preview], new Date());
const rawWeather: ReadonlyArray<typeof preview> = filterPhotosForWeather([preview], true, 'Snowy', 'Cloudy');
const rawNight: ReadonlyArray<typeof preview> = filterPhotosForNight([preview], true, true, 50);
// @ts-expect-error state-backed smart selection does not normalize preview metadata
const normalizedSmart: Photo | null = selectSmartPhoto({ state: rawFeedState });
// @ts-expect-error generic smart selection preserves raw row metadata
const normalizedSmartFeed: Photo | null = selectSmartPhotoFromFeed({ photos: [preview] });
// @ts-expect-error smart selection may have no eligible rows
const guaranteedSmart: FeedPhoto = selectSmartPhoto({ state: rawFeedState });
const rawActive: FeedPhoto | null = getActivePhoto(rawFeedState);
const activeOrientation = inferOrientation(rawActive);
const rawFrame = deriveCurrentFrame(rawFeedState);
const rawFramePrimary: FeedPhoto | null = rawFrame.primary;
const rawFrameSecondary: FeedPhoto | null = buildSnapshot(rawFeedState).activeSecondPhoto;
const rawPairedUrl: unknown = rawFrame.secondary?.url;
// @ts-expect-error pairing does not validate or normalize candidate URLs
const normalizedPairedUrl: string | undefined = rawFrame.secondary?.url;
const rawFrameCategory: unknown = rawFrame.context.category;
const rawFramePosition: unknown = rawFrame.crop.secondaryPositionY;
// @ts-expect-error frame photos may retain unvalidated preview metadata
const normalizedFramePrimary: Photo | null = rawFrame.primary;
// @ts-expect-error the snapshot secondary photo is also unvalidated
const normalizedSnapshotSecondary: Photo | null = buildSnapshot(rawFeedState).activeSecondPhoto;
// @ts-expect-error category can be arbitrary preview metadata
const normalizedFrameCategory: string | null = rawFrame.context.category;
// @ts-expect-error crop metadata requires narrowing before numeric use
const normalizedFramePosition: number | null = rawFrame.crop.secondaryPositionY;
// @ts-expect-error primary crop metadata is not normalized either
const normalizedPrimaryCrop: number | null = buildSnapshot(rawFeedState).currentFrame.crop.primaryPercent;
// @ts-expect-error active feed lookup does not normalize metadata
const normalizedActive: Photo | null = getActivePhoto(rawFeedState);
// @ts-expect-error lookup may miss even with a nonempty feed
const guaranteedActive: FeedPhoto = getActivePhoto(rawFeedState);
// @ts-expect-error active metadata must be narrowed before string use
const activeTitle: string = rawActive?.title;
const sequentialTitle: unknown = rawSequential?.title;
// @ts-expect-error sequential selection does not normalize feed metadata
const normalizedSequential: Photo | null = selectSequentialPhoto({ state: rawFeedState });
// @ts-expect-error selection may find no visible row
const guaranteedSequential: FeedPhoto = selectSequentialPhoto({ state: rawFeedState });
// @ts-expect-error state feed metadata is not guaranteed to be normalized
const normalizedFeed: Photo[] = rawFeedState.library.photosList;
// @ts-expect-error snapshots preserve raw metadata rather than normalizing it
const normalizedSnapshotFeed: Photo[] = buildSnapshot(rawFeedState).photosList;
// @ts-expect-error preview titles require narrowing before string use
const rawFeedTitle: string = rawFeedState.library.photosList[0].title;
const previewCommand: Command = { type: 'set-active-photo', payload: { url: preview.url, photo: preview } };
const arrayPreview: ActivePhotoPreview = Object.assign([], { url: 'array-preview' });
const arrayPreviewCommand: Command = { type: 'set-active-photo', payload: { url: 'array-preview', photo: arrayPreview } };
// @ts-expect-error unvalidated metadata cannot be assumed to be a normalized photo
const normalizedPreview: Photo = previewCommand.payload!.photo!;
// @ts-expect-error preview objects are not primitive strings
const primitivePreview: ActivePhotoPreview = 'preview';
const rawRows = [{ url: 42 as unknown, title: 9, nested: { marker: true } }];
const rawLookup: typeof rawRows[number] | null = findPhotoInFeed(rawRows, 42);
const rawTitle: number | undefined = rawLookup?.title;
const unknownUrl: unknown = rawLookup?.url;
// @ts-expect-error lookup preserves raw metadata, not a normalized photo
const normalizedLookup: Photo | null = findPhotoInFeed(rawRows, 42);
// @ts-expect-error lookup can miss even when its input array is nonempty
const guaranteedLookup: typeof rawRows[number] = findPhotoInFeed(rawRows, 42);
const rawUnique: typeof rawRows[number][] = uniqByUrl(rawRows);
const nullableUnique: typeof rawRows[number][] = uniqByUrl([null, ...rawRows, undefined]);
const rawUniqueTitle: number = rawUnique[0].title;
const rawUniqueUrl: unknown = rawUnique[0].url;
// @ts-expect-error deduplication does not normalize row metadata or URL values
const normalizedUnique: Photo[] = uniqByUrl(rawRows);
// @ts-expect-error a missing URL can be filtered out
const alwaysUniqueRow: typeof rawRows[number] = uniqByUrl(rawRows).find(() => true);
const rawVisible: typeof rawRows[number][] = filterVisiblePhotos([null, ...rawRows, undefined]);
const rawVisibleTitle: number = rawVisible[0].title;
const rawVisibleUrl: unknown = rawVisible[0].url;
// @ts-expect-error visibility filtering does not normalize metadata or URLs
const normalizedVisible: Photo[] = filterVisiblePhotos(rawRows);
// @ts-expect-error a row may be filtered out even when the input is nonempty
const alwaysVisibleRow: typeof rawRows[number] = filterVisiblePhotos(rawRows).find(() => true);
const effect: Effect = { type: 'refresh-active-feed', payload: { categories: ['Google Photos'] } };
const environment: ReducerEnvironment = { now: new Date(0), rng: () => 0.5 };
const decoded: Command | null = decodeStatePatchCommand({ theme: 17 });
declare const untrustedPatch: unknown;
const decodedUnknown: Command | null = decodeStatePatchCommand(untrustedPatch);
const screensaverCommand = decodeScreensaverActiveCommand(untrustedPatch);
const rawScreensaverActive: unknown = screensaverCommand?.payload.active;
const rawScreensaverInput: Command = { type: 'set-screensaver-active', payload: { active: { legacy: true } } };
// @ts-expect-error the second property read is not guaranteed to remain boolean
const normalizedScreensaverActive: boolean | undefined = screensaverCommand?.payload.active;
const result = reduceDomainCommand(state, command, environment);
const visible: Photo[] = filterVisiblePhotos(photos);
const selected: FeedPhoto | null = selectSmartPhoto({ state, rng: () => 0.5 });
const normalizedFeedSelection: Photo | null = selectSmartPhotoFromFeed({ photos, rng: () => 0.5 });
const unique: Array<{ url: string; marker: number }> = uniqByUrl([{ url: 'a', marker: 1 }]);
const pending = dispatcher.dispatchCommand(command, environment);
const directBooleanPatch: boolean | undefined = buildBooleanFieldPatch('enabled', 1).enabled;
const partialBooleanPatch: boolean | undefined = buildBooleanFieldPatch()('enabled')()(false).enabled;
const symbolBooleanPatch: boolean | undefined = buildBooleanFieldPatch(Symbol('field'), null)[Symbol('other')];
const coercedBooleanPatch = buildBooleanFieldPatch({ toString: () => 'enabled' }, true, 'ignored');
const invoke = createTypedHandlerInvoker({
  count: (item: { type: 'count'; count: number }) => item.count,
  label: (item: { type: 'label'; label: string }) => item.label,
  later: () => Promise.resolve(true)
});
const handlerResult: number | string | Promise<boolean> | undefined = invoke({ type: 'count' });
const unknownHandlerResult: number | string | Promise<boolean> | undefined = invoke(null);
// @ts-expect-error unknown keys and heterogeneous results prevent a guaranteed number
const certainHandlerResult: number = invoke({ type: 'count' });
// @ts-expect-error handler table entries must be callable in the documented contract
createTypedHandlerInvoker({ count: 1 });
// @ts-expect-error arbitrary keys may be absent
const guaranteedBoolean: boolean = buildBooleanFieldPatch('enabled', true).missing;
// @ts-expect-error patch values are booleans, not strings
const stringBoolean: string | undefined = buildBooleanFieldPatch('enabled')(true).enabled;
// @ts-expect-error incomplete application returns a function, not a patch
const incompleteBoolean: boolean | undefined = buildBooleanFieldPatch('enabled').enabled;

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
// @ts-expect-error output remains nullable
const alwaysPhoto: Photo = selected;
// @ts-expect-error decoded command may be null
const alwaysCommand: Command = decoded;

// Both higher-order boundaries must retain a non-any result.
type IsAny<T> = 0 extends (1 & T) ? true : false;
type AssertFalse<T extends false> = T;
type CurriedPatchIsNotAny = AssertFalse<IsAny<ReturnType<typeof buildBooleanFieldPatch>>>;
type HandlerResultIsNotAny = AssertFalse<IsAny<ReturnType<ReturnType<typeof createTypedHandlerInvoker>>>>;

void [effect, result, visible, unique, pending, decodedUnknown, wrongPayload, wrongCommand,
  screensaverCommand, rawScreensaverActive, rawScreensaverInput, normalizedScreensaverActive,
  missingEffectPayload, wrongEnvironment, alwaysPhoto, alwaysCommand, directBooleanPatch,
  partialBooleanPatch, symbolBooleanPatch, coercedBooleanPatch, guaranteedBoolean, stringBoolean, incompleteBoolean,
  handlerResult, unknownHandlerResult, certainHandlerResult, arrayPreviewCommand, normalizedPreview, primitivePreview,
  compatibilityTheme, snapshotTheme, configWithRawTheme, normalizedTheme, normalizedSnapshotTheme,
  configWithRawCrop, compatibilityCrop, snapshotCrop, frameCrop, normalizedCrop, normalizedSnapshotCrop, normalizedFrameCrop];
