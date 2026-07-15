const fs = require('fs');
const path = require('path');
const { readEnvVar, persistEnvVars } = require('../config/env.js');

const CACHE_PATH = path.join(__dirname, '..', 'config', 'google_photos_cache.json');
const DEFAULT_RENDER_WIDTH = 2560;
const DEFAULT_RENDER_HEIGHT = 1440;
const BASE_URL_TTL_MS = 55 * 60 * 1000;
const GOOGLE_PHOTO_PROXY_PREFIX = '/api/google-photos/media/';

// Ensure parent directories exist
const configDir = path.dirname(CACHE_PATH);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

const MEDIA_DIR = path.join(configDir, 'google_photos_media');
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

let credentials = {
  clientId: readEnvVar('GOOGLE_CLIENT_ID'),
  clientSecret: readEnvVar('GOOGLE_CLIENT_SECRET')
};
let tokens = { accessToken: '', refreshToken: readEnvVar('GOOGLE_REFRESH_TOKEN'), expiry: 0 };

function persistGoogleRefreshToken(refreshToken) {
  const normalized = String(refreshToken || '').trim();
  if (!normalized || normalized.startsWith('MOCK_')) {
    return;
  }

  persistEnvVars({
    GOOGLE_REFRESH_TOKEN: normalized
  });
}

function buildGooglePhotoProxyUrl(mediaItemId, { width = DEFAULT_RENDER_WIDTH, height = DEFAULT_RENDER_HEIGHT, crop = false } = {}) {
  const params = new URLSearchParams({
    w: String(width),
    h: String(height)
  });

  if (crop) {
    params.set('c', '1');
  }

  return `/api/google-photos/media/${encodeURIComponent(mediaItemId)}?${params.toString()}`;
}

function getGooglePhotoMediaItemId(value) {
  const text = String(value || '').trim();
  if (!text.startsWith(GOOGLE_PHOTO_PROXY_PREFIX)) {
    return '';
  }

  const [encodedId] = text.slice(GOOGLE_PHOTO_PROXY_PREFIX.length).split('?');
  return encodedId ? decodeURIComponent(encodedId) : '';
}

function isGooglePhotoProxyUrl(value) {
  return Boolean(getGooglePhotoMediaItemId(value));
}

function buildGooglePhotoContentUrl(baseUrl, { width = DEFAULT_RENDER_WIDTH, height = DEFAULT_RENDER_HEIGHT, crop = false } = {}) {
  if (!baseUrl) {
    return '';
  }

  const directives = [`w${width}`, `h${height}`];
  if (crop) {
    directives.push('c');
  }
  return `${baseUrl}=${directives.join('-')}`;
}

function getPickerMediaFile(item) {
  return item?.mediaFile && typeof item.mediaFile === 'object' ? item.mediaFile : item;
}

function getPickerItemBaseUrl(item) {
  return String(getPickerMediaFile(item)?.baseUrl || '').trim();
}

function getPickerItemMimeType(item) {
  return String(getPickerMediaFile(item)?.mimeType || item?.mimeType || '').trim();
}

function getPickerItemDimensions(item) {
  const metadata = getPickerMediaFile(item)?.mediaFileMetadata || item?.mediaFileMetadata || {};
  const width = Number.parseInt(metadata.width, 10);
  const height = Number.parseInt(metadata.height, 10);

  return {
    width: Number.isFinite(width) && width > 0 ? width : DEFAULT_RENDER_WIDTH,
    height: Number.isFinite(height) && height > 0 ? height : DEFAULT_RENDER_HEIGHT
  };
}

function extractLegacyBaseUrl(url) {
  const value = String(url || '').trim();
  if (!value || value.startsWith('/api/google-photos/media/') || value.startsWith('undefined=')) {
    return '';
  }

  const [baseUrl] = value.split('=');
  return baseUrl || '';
}

function buildCachedMediaItem(item, sessionId, existing = {}) {
  const { width, height } = getPickerItemDimensions(item);
  const googleBaseUrl = getPickerItemBaseUrl(item) || existing.googleBaseUrl || extractLegacyBaseUrl(existing.url);

  return {
    id: item.id,
    title: 'Google Photos Picker Cast',
    author: 'Lumina Google Cast',
    source: 'google_photos',
    url: buildGooglePhotoProxyUrl(item.id),
    googleBaseUrl,
    googlePickerSessionId: sessionId || existing.googlePickerSessionId,
    googleBaseUrlFetchedAt: googleBaseUrl ? Date.now() : existing.googleBaseUrlFetchedAt,
    mimeType: getPickerItemMimeType(item) || existing.mimeType || 'image/jpeg',
    width,
    height,
    rating: existing.rating !== undefined ? existing.rating : 10,
    cropPercent: existing.cropPercent,
    cropPositionY: existing.cropPositionY,
    preventPairing: existing.preventPairing,
    loved: existing.loved
  };
}

function normalizeCachedMediaItem(item) {
  if (!item?.id) {
    return null;
  }

  const width = Number.parseInt(item.width, 10);
  const height = Number.parseInt(item.height, 10);
  const safeWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_RENDER_WIDTH;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : DEFAULT_RENDER_HEIGHT;
  const googleBaseUrl = String(item.googleBaseUrl || extractLegacyBaseUrl(item.url) || '').trim();

  return {
    ...item,
    source: 'google_photos',
    url: buildGooglePhotoProxyUrl(item.id),
    googleBaseUrl: googleBaseUrl || undefined,
    width: safeWidth,
    height: safeHeight,
    rating: item.rating !== undefined ? item.rating : 10,
    loved: item.loved === true
  };
}

function isUsableCachedMediaItem(item) {
  if (!item?.id || !item?.url) {
    return false;
  }

  if (item.id.startsWith('MOCK_')) {
    return true;
  }

  return Boolean(item.googleBaseUrl || item.googlePickerSessionId);
}

function readCachedMediaItemsRaw() {
  if (!fs.existsSync(CACHE_PATH)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch (err) {
    console.warn('Google Photos Service: Failed to read media cache JSON:', err.message);
    return [];
  }
}

function writeCachedMediaItems(items) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(items, null, 2), 'utf8');
}

function updateCachedMediaItem(item) {
  const itemsMap = new Map(getCachedMediaItems().map((entry) => [entry.id, entry]));
  itemsMap.set(item.id, item);
  const mergedItems = Array.from(itemsMap.values());
  writeCachedMediaItems(mergedItems);
  return item;
}

function buildGooglePhotoMetadataPatch(metadata = {}) {
  return Object.fromEntries(
    Object.entries({
      rating: metadata.rating,
      isBroken: metadata.isBroken,
      cropPercent: metadata.cropPercent,
      cropPositionY: metadata.cropPositionY,
      preventPairing: metadata.preventPairing,
      loved: metadata.loved,
      orientation: metadata.orientation,
      width: metadata.width,
      height: metadata.height
    }).filter(([, value]) => value !== undefined)
  );
}

function mergeCachedMediaItemMetadata(items, mediaIdentifier, metadata = {}) {
  const mediaItemId = getGooglePhotoMediaItemId(mediaIdentifier) || String(mediaIdentifier || '').trim();
  const metadataPatch = buildGooglePhotoMetadataPatch(metadata);

  if (!mediaItemId || Object.keys(metadataPatch).length === 0) {
    return {
      items: (items || []).map((item) => (item ? { ...item } : item)),
      updatedItem: null,
      changed: false
    };
  }

  let updatedItem = null;
  let changed = false;

  const nextItems = (items || []).map((item) => {
    if (!item || item.id !== mediaItemId) {
      return item ? { ...item } : item;
    }

    const nextItem = { ...item, ...metadataPatch };
    updatedItem = nextItem;
    changed = Object.keys(metadataPatch).some((key) => item[key] !== nextItem[key]) || changed;
    return nextItem;
  });

  return {
    items: nextItems,
    updatedItem,
    changed
  };
}

function updateCachedMediaItemMetadata(mediaIdentifier, metadata = {}) {
  const currentItems = getCachedMediaItems();
  const merged = mergeCachedMediaItemMetadata(currentItems, mediaIdentifier, metadata);

  if (!merged.updatedItem) {
    return null;
  }

  if (merged.changed && process.env.NODE_ENV !== 'test') {
    writeCachedMediaItems(merged.items);
  }

  return merged.updatedItem;
}

function applyCachedMediaItemMetadataToState(state, mediaIdentifier, metadata = {}) {
  const mediaItemId = getGooglePhotoMediaItemId(mediaIdentifier) || String(mediaIdentifier || '').trim();
  const metadataPatch = buildGooglePhotoMetadataPatch(metadata);

  if (!state || !mediaItemId || Object.keys(metadataPatch).length === 0) {
    return null;
  }

  let updatedPhoto = null;
  const matchesMediaItem = (photo) => {
    if (!photo) {
      return false;
    }

    const photoId = String(photo.id || getGooglePhotoMediaItemId(photo.url) || '').trim();
    return photoId === mediaItemId;
  };

  if (Array.isArray(state.photosList)) {
    state.photosList = state.photosList.map((photo) => {
      if (!matchesMediaItem(photo)) {
        return photo;
      }

      const nextPhoto = { ...photo, ...metadataPatch };
      updatedPhoto = nextPhoto;
      return nextPhoto;
    });
  }

  ['activePhoto', 'activeSecondPhoto'].forEach((key) => {
    if (matchesMediaItem(state[key])) {
      Object.assign(state[key], metadataPatch);
      updatedPhoto = state[key];
    }
  });

  return updatedPhoto;
}

function findCachedMediaItem(mediaItemId) {
  return getCachedMediaItems().find((item) => item.id === mediaItemId) || null;
}

async function refreshCachedMediaItem(mediaItemId, sessionIdOverride) {
  const existing = findCachedMediaItem(mediaItemId);
  const sessionId = sessionIdOverride || existing?.googlePickerSessionId;

  if (!sessionId) {
    return existing;
  }

  const { mediaItems } = await listPickerMediaItems(sessionId);
  const match = (mediaItems || []).find((item) => item.id === mediaItemId);

  if (!match) {
    throw new Error(`Google Photos Service: Media item ${mediaItemId} is no longer present in picker session ${sessionId}.`);
  }

  const refreshed = buildCachedMediaItem(match, sessionId, existing || {});
  return updateCachedMediaItem(refreshed);
}

function isBaseUrlStale(item) {
  if (!item?.googleBaseUrlFetchedAt) {
    return true;
  }

  return (Date.now() - item.googleBaseUrlFetchedAt) >= BASE_URL_TTL_MS;
}

/**
 * 🔒 saveGoogleCredentials
 * Persists Google Photos API Client Credentials to the shared .env store.
 */
function saveGoogleCredentials(clientId, clientSecret) {
  credentials = { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
  try {
    persistEnvVars({
      GOOGLE_CLIENT_ID: credentials.clientId,
      GOOGLE_CLIENT_SECRET: credentials.clientSecret
    });
    console.log('Google Photos Service: Credentials saved successfully to .env.');
    return true;
  } catch (err) {
    console.error('Google Photos Service: Failed to save credentials:', err.message);
    return false;
  }
}

/**
 * 📡 getGoogleAuthUrl
 * Generates the live Google OAuth2 Authorization URL.
 * Falls back to sandbox auth if credentials are not configured.
 */
function getGoogleAuthUrl(redirectUri) {
  if (!credentials.clientId) {
    console.log('Google Photos Service: Client ID not configured. Generating developmental sandbox auth URL.');
    return `/api/auth/google/sandbox-callback?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: redirectUri,
    client_id: credentials.clientId,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
    ].join(' ')
  };

  const qs = new URLSearchParams(options);
  return `${rootUrl}?${qs.toString()}`;
}

/**
 * 🔑 exchangeGoogleCode
 * Exchanges temporary OAuth code for Access and Refresh Tokens.
 */
async function exchangeGoogleCode(code, redirectUri) {
  if (!credentials.clientId || !credentials.clientSecret) {
    console.log('Google Photos Service: Exchanging developmental sandbox token.');
    tokens = {
      accessToken: 'MOCK_ACCESS_TOKEN_XYZ_' + Date.now(),
      refreshToken: 'MOCK_REFRESH_TOKEN_ABC',
      expiry: Date.now() + 3600 * 1000
    };
    return tokens;
  }

  try {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const body = {
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    };

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Token API responded with status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken, // Google sometimes omits refresh_token on refresh
      expiry: Date.now() + (data.expires_in * 1000)
    };
    persistGoogleRefreshToken(tokens.refreshToken);

    return tokens;
  } catch (err) {
    console.error('Google Photos Service: Token exchange failed:', err.message);
    throw err;
  }
}

/**
 * 🔄 refreshAccessToken
 * Automatically fetches a fresh access_token using the refresh_token.
 */
async function refreshAccessToken() {
  if (!tokens.refreshToken) {
    throw new Error('Google Photos Service: No refresh token available. User must re-authenticate.');
  }

  if (tokens.refreshToken.startsWith('MOCK_')) {
    tokens.accessToken = 'MOCK_ACCESS_TOKEN_XYZ_' + Date.now();
    tokens.expiry = Date.now() + 3600 * 1000;
    return tokens.accessToken;
  }

  try {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const body = {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token'
    };

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString()
    });

    if (!res.ok) {
      throw new Error(`Failed to refresh access token, status=${res.status}`);
    }

    const data = await res.json();
    tokens.accessToken = data.access_token;
    tokens.expiry = Date.now() + (data.expires_in * 1000);
    
    return tokens.accessToken;
  } catch (err) {
    console.error('Google Photos Service: Access token refresh failed:', err.message);
    throw err;
  }
}

/**
 * 🔏 getValidToken
 * Self-healing helper that returns a guaranteed unexpired access token.
 */
async function getValidToken() {
  if (!tokens.accessToken) {
    if (tokens.refreshToken) {
      return refreshAccessToken();
    }
    throw new Error('Google Photos Service: Not authenticated.');
  }
  // Refresh access token if it expires in less than 5 minutes
  if (Date.now() + 300 * 1000 > tokens.expiry) {
    console.log('Google Photos Service: Access token expired or near expiry, refreshing...');
    return await refreshAccessToken();
  }
  return tokens.accessToken;
}

/**
 * 💾 syncGoogleAlbum
 * Retrieves selected items from the Google Photos Picker session and caches them.
 */
async function syncGoogleAlbum(sessionId) {
  try {
    if (!tokens.accessToken) {
      throw new Error('Google Photos Service: No active token session.');
    }

    if (!sessionId) {
      console.log('Google Photos Service: No sessionId provided, skipping sync.');
      return [];
    }

    console.log(`Google Photos Service: Syncing selected items from session ${sessionId}...`);
    const { mediaItems } = await listPickerMediaItems(sessionId);

    const existingById = new Map(getCachedMediaItems().map((item) => [item.id, item]));

    const syncedItems = [];
    if (mediaItems && Array.isArray(mediaItems)) {
      for (const item of mediaItems) {
        const mimeType = getPickerItemMimeType(item);
        if (mimeType && !mimeType.startsWith('image')) continue;

        const existing = existingById.get(item.id) || {};
        const nextItem = buildCachedMediaItem(item, sessionId, existing);
        syncedItems.push(nextItem);
      }
    }

    writeCachedMediaItems(syncedItems);
    console.log(`Google Photos Service: Synced and cached ${syncedItems.length} selected items successfully for session ${sessionId}.`);

    // Clean orphaned files and kick off background download of new files
    cleanOrphanedMediaFiles(syncedItems);
    downloadSyncMediaItems(syncedItems).catch((err) => {
      console.error('Google Photos Service: Error in background downloader:', err.message);
    });

    return syncedItems;
  } catch (err) {
    console.error('Google Photos Service: Picker session sync failed:', err.message);
    throw err;
  }
}

/**
 * 🛠️ createPickerSession
 * Creates a secure photo picking session.
 */
async function createPickerSession() {
  if (!tokens.accessToken) {
    throw new Error('Google Photos Service: No active token session.');
  }

  if (tokens.accessToken.startsWith('MOCK_')) {
    return {
      id: 'MOCK_SESSION_ID_' + Date.now(),
      pickerUri: '/api/auth/google/sandbox-callback',
      mediaItemsSet: false
    };
  }

  const token = await getValidToken();
  try {
    const res = await fetch('https://photospicker.googleapis.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Picker Session API failed (${res.status}): ${errText}`);
    }

    return await res.json();
  } catch (err) {
    console.error('Google Photos Service: Failed to create picker session:', err.message);
    throw err;
  }
}

/**
 * 🔍 getPickerSession
 * Retrieves picking session details (used to check if user has selected items).
 */
async function getPickerSession(sessionId) {
  if (sessionId.startsWith('MOCK_')) {
    return {
      id: sessionId,
      pickerUri: '/api/auth/google/sandbox-callback',
      mediaItemsSet: true
    };
  }

  const token = await getValidToken();
  try {
    const res = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Google Picker GET session failed (${res.status})`);
    }

    return await res.json();
  } catch (err) {
    console.error(`Google Photos Service: Failed to get session ${sessionId}:`, err.message);
    throw err;
  }
}

/**
 * 📸 listPickerMediaItems
 * Lists selected media items in the picking session.
 */
async function listPickerMediaItems(sessionId) {
  if (sessionId.startsWith('MOCK_')) {
    const mockItems = [];
    const picsumBase = 'https://picsum.photos/id';
    const mockIds = [10, 15, 29, 37, 43, 48, 54, 57, 62, 76, 85, 93, 104, 116, 122];
    mockIds.forEach((id) => {
      mockItems.push({
        id: `MOCK_MEDIA_ITEM_${id}`,
        baseUrl: `${picsumBase}/${id}/2560/1440`,
        mimeType: 'image/jpeg'
      });
    });
    return { mediaItems: mockItems };
  }

  const token = await getValidToken();
  const mediaItems = [];
  let pageToken = '';
  
  try {
    do {
      let url = `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${encodeURIComponent(sessionId)}&pageSize=50`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google Picker MediaItems failed (${res.status}): ${errText}`);
      }

      const data = await res.json();
      if (data.mediaItems && Array.isArray(data.mediaItems)) {
        mediaItems.push(...data.mediaItems);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return { mediaItems };
  } catch (err) {
    console.error('Google Photos Service: Failed to list picker media items:', err.message);
    throw err;
  }
}

/**
 * 🗑️ deletePickerSession
 * Cleans up the picking session.
 */
async function deletePickerSession(sessionId) {
  if (sessionId.startsWith('MOCK_')) return true;

  const token = await getValidToken();
  try {
    const res = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.ok;
  } catch (err) {
    console.error(`Google Photos Service: Failed to delete session ${sessionId}:`, err.message);
    return false;
  }
}

/**
 * ⚡ refreshMediaItemUrl
 * Dynamically resolves and refreshes expired Google photo URLs on demand.
 */
async function refreshMediaItemUrl(mediaItemId, renderOptions = {}) {
  if (mediaItemId.startsWith('MOCK_')) {
    const idNum = mediaItemId.replace('MOCK_MEDIA_ITEM_', '');
    return `https://picsum.photos/id/${idNum}/2560/1440`;
  }

  try {
    const token = await getValidToken();
    const url = `https://photoslibrary.googleapis.com/v1/mediaItems/${mediaItemId}`;
    
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to retrieve media item, status=${res.status}`);
    }

    const item = await res.json();
    if (!item.baseUrl) {
      throw new Error('Google Photos Service: API returned media item without baseUrl');
    }

    return buildGooglePhotoContentUrl(item.baseUrl, renderOptions);
  } catch (err) {
    console.error(`Google Photos Service: Failed to refresh URL for item ${mediaItemId}:`, err.message);
    throw err;
  }
}

async function fetchMediaItemBytes(mediaItemId, renderOptions = {}) {
  const cachedItem = findCachedMediaItem(mediaItemId);
  const localFilePath = getLocalMediaFilePath(mediaItemId);
  if (fs.existsSync(localFilePath)) {
    try {
      return {
        buffer: fs.readFileSync(localFilePath),
        contentType: cachedItem?.mimeType || 'image/jpeg'
      };
    } catch (err) {
      console.warn(`Google Photos Service: Failed to read local cached file for item ${mediaItemId}, falling back to fetch:`, err.message);
    }
  }

  const contentTypeHint = cachedItem?.mimeType || 'image/jpeg';
  const requiresAuth = !mediaItemId.startsWith('MOCK_');
  const token = requiresAuth ? await getValidToken() : null;

  const candidates = [];
  const seenCandidates = new Set();
  const appendCandidate = (url) => {
    if (url && !seenCandidates.has(url)) {
      seenCandidates.add(url);
      candidates.push(url);
    }
  };

  if (cachedItem?.googlePickerSessionId && (!cachedItem.googleBaseUrl || isBaseUrlStale(cachedItem))) {
    try {
      const refreshedItem = await refreshCachedMediaItem(mediaItemId, cachedItem.googlePickerSessionId);
      if (refreshedItem?.googleBaseUrl) {
        appendCandidate(buildGooglePhotoContentUrl(refreshedItem.googleBaseUrl, renderOptions));
      }
    } catch (err) {
      console.warn(`Google Photos Service: Failed to refresh cached picker item ${mediaItemId}:`, err.message);
    }
  }

  if (cachedItem?.googleBaseUrl) {
    appendCandidate(buildGooglePhotoContentUrl(cachedItem.googleBaseUrl, renderOptions));
  }

  if (candidates.length === 0) {
    appendCandidate(await refreshMediaItemUrl(mediaItemId, renderOptions));
  }

  let lastError = null;

  for (const candidateUrl of candidates) {
    const res = await fetch(candidateUrl, {
      headers: requiresAuth ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!mediaItemId.startsWith('MOCK_')) {
        fs.writeFileSync(localFilePath, buffer);
      }
      return {
        buffer,
        contentType: res.headers.get('content-type') || contentTypeHint
      };
    }

    lastError = new Error(`Google Photos media fetch failed (${res.status})`);
  }

  if (cachedItem?.googlePickerSessionId) {
    try {
      const refreshedItem = await refreshCachedMediaItem(mediaItemId, cachedItem.googlePickerSessionId);
      const refreshedUrl = buildGooglePhotoContentUrl(refreshedItem?.googleBaseUrl, renderOptions);

      if (refreshedUrl && !seenCandidates.has(refreshedUrl)) {
        const retryRes = await fetch(refreshedUrl, {
          headers: requiresAuth ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (retryRes.ok) {
          const buffer = Buffer.from(await retryRes.arrayBuffer());
          if (!mediaItemId.startsWith('MOCK_')) {
            fs.writeFileSync(localFilePath, buffer);
          }
          return {
            buffer,
            contentType: retryRes.headers.get('content-type') || contentTypeHint
          };
        }

        lastError = new Error(`Google Photos media fetch failed after picker refresh (${retryRes.status})`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`Google Photos Service: Failed to fetch media bytes for item ${mediaItemId}.`);
}

// Pure functional helpers for set difference and orphaned file mapping
const difference = (setA, setB) => new Set([...setA].filter(x => !setB.has(x)));

const getOrphanedFiles = (allFiles, activeIds) => {
  const activeSet = new Set(activeIds);
  const fileIds = new Set(allFiles.map(file => path.parse(file).name));
  const orphans = difference(fileIds, activeSet);
  return allFiles.filter(file => orphans.has(path.parse(file).name));
};

// File system effectful operations
const getLocalMediaFilePath = (mediaItemId) => path.join(MEDIA_DIR, `${mediaItemId}.jpg`);

const cleanOrphanedMediaFiles = (newItems) => {
  if (!fs.existsSync(MEDIA_DIR) || process.env.NODE_ENV === 'test') {
    return;
  }
  try {
    const files = fs.readdirSync(MEDIA_DIR);
    const activeIds = newItems.map(item => item.id);
    const orphans = getOrphanedFiles(files, activeIds);
    orphans.forEach(file => {
      fs.unlinkSync(path.join(MEDIA_DIR, file));
      console.log(`Google Photos Service: Deleted orphaned local file: ${file}`);
    });
  } catch (err) {
    console.warn('Google Photos Service: Failed to clean up orphaned media files:', err.message);
  }
};

const downloadSyncMediaItems = async (items) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  console.log(`Google Photos Service: Starting background download of ${items.length} media items...`);
  for (const item of items) {
    const filePath = getLocalMediaFilePath(item.id);
    if (!fs.existsSync(filePath)) {
      try {
        const url = buildGooglePhotoContentUrl(item.googleBaseUrl);
        if (url) {
          const res = await fetch(url);
          if (res.ok) {
            fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
            console.log(`Google Photos Service: Successfully pre-downloaded item: ${item.id}`);
          }
        }
      } catch (err) {
        console.warn(`Google Photos Service: Failed to pre-download media for item ${item.id}:`, err.message);
      }
    }
  }
};

/**
 * 📂 getCachedMediaItems
 * Reads the safe filesystem caching database.
 */
function getCachedMediaItems() {
  const rawItems = readCachedMediaItemsRaw();
  const normalizedItems = rawItems
    .map(normalizeCachedMediaItem)
    .filter(Boolean)
    .filter(isUsableCachedMediaItem);

  if (JSON.stringify(rawItems) !== JSON.stringify(normalizedItems) && process.env.NODE_ENV !== 'test') {
    writeCachedMediaItems(normalizedItems);
  }

  return normalizedItems;
}

/**
 * 🔒 hasTokens
 * Returns true if the user is authenticated.
 */
function isAuthenticated() {
  return !!tokens.accessToken;
}

module.exports = {
  applyCachedMediaItemMetadataToState,
  buildGooglePhotoMetadataPatch,
  saveGoogleCredentials,
  getGoogleAuthUrl,
  exchangeGoogleCode,
  syncGoogleAlbum,
  createPickerSession,
  getPickerSession,
  listPickerMediaItems,
  deletePickerSession,
  refreshMediaItemUrl,
  fetchMediaItemBytes,
  getCachedMediaItems,
  getGooglePhotoMediaItemId,
  isAuthenticated,
  isGooglePhotoProxyUrl,
  buildGooglePhotoProxyUrl,
  buildCachedMediaItem,
  mergeCachedMediaItemMetadata,
  normalizeCachedMediaItem,
  isUsableCachedMediaItem,
  updateCachedMediaItemMetadata,
  difference,
  getOrphanedFiles,
  getLocalMediaFilePath,
  cleanOrphanedMediaFiles,
  downloadSyncMediaItems
};
