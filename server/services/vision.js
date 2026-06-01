const fs = require('fs');
const { screensaverState } = require('../config/state.js');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');
const cachePath = path.join(rootDir, 'analysis_cache.json');

// Global analysis cache
let analysisCache = {};

function initCache() {
  if (fs.existsSync(cachePath)) {
    try {
      analysisCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      console.log(`[Vision Service] Loaded ${Object.keys(analysisCache).length} cached image analyses.`);
    } catch (e) {
      console.warn('[Vision Service] Could not parse analysis_cache.json:', e.message);
      analysisCache = {};
    }
  } else {
    analysisCache = {};
  }
}

function saveCache() {
  try {
    fs.writeFileSync(cachePath, JSON.stringify(analysisCache, null, 2), 'utf8');
  } catch (e) {
    console.error('[Vision Service] Failed to write analysis_cache.json:', e.message);
  }
}

/**
 * 🖼️ fetchImageBase64
 * Downloads a remote image from URL and returns its base64 string.
 */
async function fetchImageBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  } catch (err) {
    console.error(`[Vision Service] Failed to fetch image ${imageUrl}:`, err.message);
    return null;
  }
}

/**
 * 👁️ analyzeImageContent
 * Uses configured primary vision API, with a fallback to configured secondary API.
 * Returns precise weather/time tags.
 */
async function analyzeImageContent(imageUrl, title = '') {
  initCache();

  // 1. Check cache first
  if (analysisCache[imageUrl]) {
    return analysisCache[imageUrl];
  }

  // Retrieve configuration from screensaverState
  const config = screensaverState.visionConfig || {};
  const primaryUrl = config.apiUrl ? config.apiUrl.trim() : '';
  const primaryModel = config.model ? config.model.trim() : '';
  const primaryKey = config.apiKey ? config.apiKey.trim() : '';

  if (!primaryUrl) {
    console.warn('[Vision Service] Vision API is not configured. Skipping background content analysis.');
    return null;
  }

  console.log(`[Vision Service] Analyzing content for: "${title || imageUrl}"...`);

  // 2. Fetch image base64
  const imgB64 = await fetchImageBase64(imageUrl);
  if (!imgB64) {
    return null;
  }

  const promptText = 'Analyze this image and determine which weather and time conditions apply. ' +
                     'Return ONLY a valid JSON object with the following boolean keys: "isSunny", "isCloudy", "isRain", "isSnowy", "isNight". ' +
                     'Ensure "isSunny" is true if it is bright, sunny, or clear daylight. ' +
                     '"isCloudy" is true if it features mist, fog, clouds, overcast, or twilight. ' +
                     '"isRain" is true if it is actively raining, stormy, or features wet streams/lakes/rain. ' +
                     '"isSnowy" is true if it has snow, ice, or winter alpine frost. ' +
                     '"isNight" is true if it is dark, sunset, starry space, twilight, or night. ' +
                     'Do not include any markdown block formatting, code backticks, or extra text.';

  // Determine active model to use
  let activeModel = primaryModel;
  if (!activeModel) {
    // Attempt dynamic discovery from /models endpoint
    try {
      console.log(`[Vision Service] Model ID unspecified. Querying ${primaryUrl}/models for discovery...`);
      const response = await fetch(`${primaryUrl}/models`, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const data = await response.json();
        const models = data.data || [];
        // Scan for common vision/VL model strings
        const match = models.find(m =>
          m.id &&
          (m.id.toLowerCase().includes('vl') || m.id.toLowerCase().includes('vision'))
        );
        if (match) {
          activeModel = match.id;
          console.log(`[Vision Service] Dynamically resolved vision model: "${activeModel}"`);
        }
      }
    } catch (err) {
      console.warn('[Vision Service] Failed to dynamically query models from primary API:', err.message);
    }
  }

  if (!activeModel) {
    activeModel = 'qwen-vl'; // Generic default fallback if still empty
  }

  const payload = {
    model: activeModel,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: promptText
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imgB64}` }
          }
        ]
      }
    ],
    max_tokens: 150
  };

  let analysisSuccess = false;
  let rawContent = '';

  // --- Step 4. Try primary API inference ---
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (primaryKey) {
      headers['Authorization'] = `Bearer ${primaryKey}`;
    }

    console.log(`[Vision Service] Attempting primary inference using model "${activeModel}" at "${primaryUrl}"...`);
    const response = await fetch(`${primaryUrl}/chat/completions`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000)
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData.choices && resData.choices[0] && resData.choices[0].message) {
        rawContent = resData.choices[0].message.content.trim();
        analysisSuccess = true;
        console.log('[Vision Service] Primary inference completed successfully.');
      }
    } else {
      console.warn(`[Vision Service] Primary inference failed with status: ${response.status}`);
    }
  } catch (err) {
    console.warn('[Vision Service] Primary inference connection error:', err.message);
  }

  // --- Step 5. Fallback to secondary/OpenAI if primary failed ---
  if (!analysisSuccess) {
    if (!screensaverState.allowOpenAiFallback) {
      console.warn('[Vision Service] Primary inference failed and OpenAI fallback is disabled. Skipping content analysis.');
      return null;
    }

    const fallbackUrl = config.fallbackUrl ? config.fallbackUrl.trim() : 'https://api.openai.com/v1';
    const fallbackModel = config.fallbackModel ? config.fallbackModel.trim() : 'gpt-4o';
    const fallbackKey = config.fallbackApiKey ? config.fallbackApiKey.trim() : '';

    if (!fallbackKey && fallbackUrl.includes('openai.com')) {
      console.warn('[Vision Service] Fallback API key is missing. Skipping content analysis fallback.');
      return null;
    }

    try {
      payload.model = fallbackModel;
      const headers = { 'Content-Type': 'application/json' };
      if (fallbackKey) {
        headers['Authorization'] = `Bearer ${fallbackKey}`;
      }

      console.log(`[Vision Service] Attempting fallback inference using model "${fallbackModel}" at "${fallbackUrl}"...`);
      const response = await fetch(`${fallbackUrl}/chat/completions`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Fallback API Error: ${response.status} - ${errText}`);
      }

      const resData = await response.json();
      rawContent = resData.choices[0].message.content.trim();
      analysisSuccess = true;
      console.log('[Vision Service] Fallback inference completed successfully.');
    } catch (err) {
      console.error(`[Vision Service] Fallback inference failed for "${title}":`, err.message);
      return null;
    }
  }

  // --- Step 6. Parse and validate JSON results ---
  try {
    const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);

    const validatedResult = {
      isSunny: !!result.isSunny,
      isCloudy: !!result.isCloudy,
      isRain: !!result.isRain,
      isSnowy: !!result.isSnowy,
      isNight: !!result.isNight,
      analyzedAt: Date.now()
    };

    console.log(`[Vision Service] Analysis success for "${title}":`, validatedResult);

    analysisCache[imageUrl] = validatedResult;
    saveCache();

    return validatedResult;
  } catch (err) {
    console.error(`[Vision Service] JSON parsing failed for "${title}" response: "${rawContent}"`, err.message);
    return null;
  }
}

module.exports = {
  analyzeImageContent
};
