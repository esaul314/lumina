const fs = require('fs');
const path = require('path');
const { readEnvVar, persistEnvVars } = require('../config/env.js');

const CACHE_PATH = path.join(__dirname, '..', 'config', 'google_photos_cache.json');

// Ensure parent directories exist
const configDir = path.dirname(CACHE_PATH);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

let credentials = {
  clientId: readEnvVar('GOOGLE_CLIENT_ID'),
  clientSecret: readEnvVar('GOOGLE_CLIENT_SECRET')
};
let tokens = { accessToken: '', refreshToken: '', expiry: 0 };

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
      'https://www.googleapis.com/auth/photoslibrary.readonly',
      'https://www.googleapis.com/auth/photoslibrary.sharing'
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
 * Memory-safe paginated synchronization of Google Photos metadata.
 * Limits RAM footprint to <=80MB by only keeping local filesystem JSON indexes.
 */
async function syncGoogleAlbum() {
  try {
    if (!tokens.accessToken) {
      throw new Error('Google Photos Service: No active token session.');
    }

    if (tokens.accessToken.startsWith('MOCK_')) {
      console.log('Google Photos Service: Generating mock Google Photos feed for sandbox developer mode...');
      const mockItems = [];
      const picsumBase = 'https://picsum.photos/id';
      const mockIds = [10, 15, 29, 37, 43, 48, 54, 57, 62, 76, 85, 93, 104, 116, 122];
      
      mockIds.forEach((id, idx) => {
        mockItems.push({
          id: `MOCK_MEDIA_ITEM_${id}`,
          title: `Google Cast Landscape Photo #${idx + 1}`,
          author: 'Synced Google User',
          source: 'google_photos',
          url: `${picsumBase}/${id}/2560/1440`, // Temporary dynamic signed url representation
          width: 2560,
          height: 1440,
          rating: 10
        });
      });

      fs.writeFileSync(CACHE_PATH, JSON.stringify(mockItems, null, 2), 'utf8');
      return mockItems;
    }

    const token = await getValidToken();
    console.log('Google Photos Service: Initiating secure Google library sync...');
    
    const mediaItems = [];
    let pageToken = '';
    let fetchedPages = 0;
    
    do {
      // Limit to max 5 pages of 50 items to strictly prevent client memory bloating
      if (fetchedPages >= 5) break; 
      
      let url = 'https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=50';
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
        throw new Error(`Google API media list failed, status=${res.status}`);
      }

      const data = await res.json();
      if (data.mediaItems && Array.isArray(data.mediaItems)) {
        for (const item of data.mediaItems) {
          // 1. Only include photo images (exclude video/gif)
          if (item.mimeType && !item.mimeType.startsWith('image')) continue;
          
          // 2. Landscape orientation aspect ratio filter
          const metadata = item.mediaMetadata;
          if (metadata && metadata.width && metadata.height) {
            const w = parseInt(metadata.width, 10);
            const h = parseInt(metadata.height, 10);
            if (w < h) continue; // Skip portrait orientation
          }

          mediaItems.push({
            id: item.id,
            title: item.description || 'Google Photos Ambient Cast',
            author: 'Lumina Google Cast',
            source: 'google_photos',
            url: `${item.baseUrl}=w2560-h1440-c`, // Formats image to HD landscape format
            width: parseInt(metadata?.width || 2560, 10),
            height: parseInt(metadata?.height || 1440, 10),
            rating: 10
          });
        }
      }

      pageToken = data.nextPageToken;
      fetchedPages++;
    } while (pageToken);

    fs.writeFileSync(CACHE_PATH, JSON.stringify(mediaItems, null, 2), 'utf8');
    console.log(`Google Photos Service: Synced and cached ${mediaItems.length} landscape items successfully.`);
    return mediaItems;
  } catch (err) {
    console.error('Google Photos Service: Album synchronization failed:', err.message);
    throw err;
  }
}

/**
 * ⚡ refreshMediaItemUrl
 * Dynamically resolves and refreshes expired Google photo URLs on demand.
 */
async function refreshMediaItemUrl(mediaItemId) {
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

    return `${item.baseUrl}=w2560-h1440-c`;
  } catch (err) {
    console.error(`Google Photos Service: Failed to refresh URL for item ${mediaItemId}:`, err.message);
    throw err;
  }
}

/**
 * 📂 getCachedMediaItems
 * Reads the safe filesystem caching database.
 */
function getCachedMediaItems() {
  if (fs.existsSync(CACHE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    } catch (err) {
      console.warn('Google Photos Service: Failed to read media cache JSON:', err.message);
    }
  }
  return [];
}

/**
 * 🔒 hasTokens
 * Returns true if the user is authenticated.
 */
function isAuthenticated() {
  return !!tokens.accessToken;
}

module.exports = {
  saveGoogleCredentials,
  getGoogleAuthUrl,
  exchangeGoogleCode,
  syncGoogleAlbum,
  refreshMediaItemUrl,
  getCachedMediaItems,
  isAuthenticated
};
