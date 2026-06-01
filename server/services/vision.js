const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
 * 🔑 getOpenAiKey
 * Resolves the OpenAI API Key from local environment,
 * falling back to retrieving the key from Poochy via SSH.
 */
function getOpenAiKey() {
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  try {
    console.log('[Vision Service] Querying poochy for OpenAI credentials...');
    // We run the ssh command under user 'alex' since alex has passwordless SSH access to poochy
    const output = execSync(
      'ssh -o StrictHostKeyChecking=accept-new alex@192.168.0.117 "cat /home/alex/work/AI/Luminatus/config/openai.env"',
      { encoding: 'utf8', timeout: 10000 }
    );

    const match = output.match(/OPENAI_API_KEY=([^\s]+)/);
    if (match && match[1]) {
      console.log('[Vision Service] Successfully retrieved key from poochy.');
      process.env.OPENAI_API_KEY = match[1].trim();
      return process.env.OPENAI_API_KEY;
    }
  } catch (err) {
    console.error('[Vision Service] Failed to fetch key from poochy via SSH:', err.message);
  }
  return null;
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
 * 🛰️ resolveVisionModels
 * Fetches available models from Poochy router and resolves local & remote vision model IDs dynamically.
 */
async function resolveVisionModels() {
  let localModel = null;
  let remoteModel = null;

  try {
    const response = await fetch('http://192.168.0.117:8100/v1/models', { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const data = await response.json();
      const models = data.data || [];
      
      // 1. Find local vision model (contains 'vl' or 'vision', and either contains 'local' or owned_by 'luminatus')
      const localMatch = models.find(m => 
        m.id && 
        (m.id.toLowerCase().includes('vl') || m.id.toLowerCase().includes('vision')) &&
        (m.id.toLowerCase().includes('local') || m.owned_by === 'luminatus')
      );
      if (localMatch) {
        localModel = localMatch.id;
        console.log(`[Vision Service] Dynamically resolved local vision model: "${localModel}"`);
      }

      // 2. Find remote/OpenAI vision model
      const remoteMatch = models.find(m => 
        m.id && 
        (m.id.toLowerCase().includes('gpt-4o') || m.id.toLowerCase().includes('gpt-4-') || m.id.toLowerCase().includes('gpt-5-')) &&
        m.owned_by === 'openai'
      );
      if (remoteMatch) {
        remoteModel = remoteMatch.id;
        console.log(`[Vision Service] Dynamically resolved remote vision model: "${remoteModel}"`);
      }
    }
  } catch (err) {
    console.warn('[Vision Service] Failed to dynamically query models from Poochy router:', err.message);
  }

  // Fallbacks if discovery fails
  return {
    localModel: localModel || 'qwen3-vl-8b-local',
    remoteModel: remoteModel || 'gpt-4o'
  };
}

/**
 * 👁️ analyzeImageContent
 * Uses local vision model on Poochy via Luminatus, with a fallback to OpenAI.
 * Returns precise weather/time tags.
 */
async function analyzeImageContent(imageUrl, title = '') {
  initCache();

  // 1. Check cache first
  if (analysisCache[imageUrl]) {
    return analysisCache[imageUrl];
  }

  console.log(`[Vision Service] Analyzing content for: "${title || imageUrl}"...`);

  // 2. Fetch image base64
  const imgB64 = await fetchImageBase64(imageUrl);
  if (!imgB64) {
    return null;
  }

  // 3. Resolve models dynamically
  const { localModel, remoteModel } = await resolveVisionModels();

  const promptText = 'Analyze this image and determine which weather and time conditions apply. ' +
                     'Return ONLY a valid JSON object with the following boolean keys: "isSunny", "isCloudy", "isRain", "isSnowy", "isNight". ' +
                     'Ensure "isSunny" is true if it is bright, sunny, or clear daylight. ' +
                     '"isCloudy" is true if it features mist, fog, clouds, overcast, or twilight. ' +
                     '"isRain" is true if it is actively raining, stormy, or features wet streams/lakes/rain. ' +
                     '"isSnowy" is true if it has snow, ice, or winter alpine frost. ' +
                     '"isNight" is true if it is dark, sunset, starry space, twilight, or night. ' +
                     'Do not include any markdown block formatting, code backticks, or extra text.';

  const payload = {
    model: localModel,
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

  // --- Step 4. Try local Poochy inference first ---
  try {
    console.log(`[Vision Service] Attempting local inference via Poochy router using model "${localModel}"...`);
    const response = await fetch('http://192.168.0.117:8100/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000)
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData.choices && resData.choices[0] && resData.choices[0].message) {
        rawContent = resData.choices[0].message.content.trim();
        analysisSuccess = true;
        console.log('[Vision Service] Local inference completed successfully.');
      }
    } else {
      console.warn(`[Vision Service] Local Poochy inference failed with status: ${response.status}`);
    }
  } catch (err) {
    console.warn('[Vision Service] Local Poochy inference connection error:', err.message);
  }

  // --- Step 5. Fallback to hosted OpenAI if local failed ---
  if (!analysisSuccess) {
    console.log('[Vision Service] Falling back to hosted OpenAI API...');
    const apiKey = getOpenAiKey();
    if (!apiKey) {
      console.warn('[Vision Service] Missing API key. Skipping content analysis fallback.');
      return null;
    }

    try {
      // Modify payload to use resolved remote model
      payload.model = remoteModel;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API Error: ${response.status} - ${errText}`);
      }

      const resData = await response.json();
      rawContent = resData.choices[0].message.content.trim();
      analysisSuccess = true;
      console.log('[Vision Service] Hosted OpenAI fallback completed successfully.');
    } catch (err) {
      console.error(`[Vision Service] OpenAI fallback failed for "${title}":`, err.message);
      return null;
    }
  }

  // --- Step 6. Parse and validate JSON results ---
  try {
    // Clean potential markdown codeblock formatting if returned
    const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);

    // Validate object keys
    const validatedResult = {
      isSunny: !!result.isSunny,
      isCloudy: !!result.isCloudy,
      isRain: !!result.isRain,
      isSnowy: !!result.isSnowy,
      isNight: !!result.isNight,
      analyzedAt: Date.now()
    };

    console.log(`[Vision Service] Analysis success for "${title}":`, validatedResult);

    // Save to cache
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
