/**
 * 🖼️ Dynamic Image Crawler Service
 * Extracts HD wallpapers from Reddit subreddits, Lorem Picsum, Lexica, and Unsplash.
 * Automatically classifies environmental keywords for sunny, night, rainy, snowy, or cloudy conditions.
 */

// Search queries mapping for Unsplash keyless napi search
const searchQueries = {
  'Scenic Nature': 'scenic nature landscape mountains forest',
  'Cosmic Space': 'cosmic space nebula galaxy stars',
  'Abstract Art': 'abstract art painting minimalist geometric',
  'Liminal Spaces': 'liminal spaces empty corridor backrooms',
  'AI Creations': 'surreal digital art generative midjourney cyberpunk futuristic'
};

// Subreddits list for categories
const categorySubreddits = {
  'Scenic Nature': ['EarthPorn', 'LandscapePhotography'],
  'Cosmic Space': ['spaceporn', 'astrophotography'],
  'Abstract Art': ['AbstractArt', 'Generative'],
  'Liminal Spaces': ['LiminalSpace'],
  'AI Creations': ['aiArt', 'Midjourney', 'StableDiffusion']
};

/**
 * 🤖 fetchRedditImages
 * Scrapes /r/ subreddits for hot landscape photographs.
 */
async function fetchRedditImages(subreddit, category, count = 25) {
  try {
    console.log(`Reddit Crawler: Fetching /r/${subreddit} for category "${category}"...`);
    const res = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=${count}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (!res.ok) {
      console.warn(`Reddit crawler failed for /r/${subreddit} (status ${res.status})`);
      return [];
    }

    const data = await res.json();
    if (!data || !data.data || !data.data.children) {
      return [];
    }

    const photos = [];
    for (const post of data.data.children) {
      const pData = post.data;
      if (pData.over_18 || pData.is_self) continue; // Skip NSFW/text

      let imageUrl = '';
      if (pData.url && (pData.url.endsWith('.jpg') || pData.url.endsWith('.jpeg') || pData.url.endsWith('.png'))) {
        imageUrl = pData.url;
      } else if (pData.preview && pData.preview.images && pData.preview.images[0]) {
        imageUrl = pData.preview.images[0].source.url.replace(/&amp;/g, '&');
      }

      if (!imageUrl) continue;

      const title = pData.title.length > 55 ? pData.title.substring(0, 52) + '...' : pData.title;
      const author = `u/${pData.author}`;
      const titleLower = pData.title.toLowerCase();

      // Keyword tagging for weather/time alignment
      const isNight = titleLower.includes('night') || titleLower.includes('dark') || 
                      titleLower.includes('twilight') || titleLower.includes('midnight') || 
                      titleLower.includes('stars') || titleLower.includes('moon') || 
                      titleLower.includes('sunset') || titleLower.includes('evening') || 
                      titleLower.includes('3 am') || titleLower.includes('eclipse') ||
                      titleLower.includes('space') || titleLower.includes('nebula') ||
                      titleLower.includes('stardust') ||
                      category === 'Cosmic Space';

      const isRain = titleLower.includes('rain') || titleLower.includes('rainy') || 
                     titleLower.includes('wet') || titleLower.includes('storm') || 
                     titleLower.includes('water') || titleLower.includes('dewy') ||
                     titleLower.includes('jungle') || titleLower.includes('stream') ||
                     titleLower.includes('lake') || titleLower.includes('puddle') ||
                     titleLower.includes('drizzle') || titleLower.includes('shower');

      const isSunny = titleLower.includes('sun') || titleLower.includes('sunny') ||
                      titleLower.includes('clear') || titleLower.includes('bright') ||
                      titleLower.includes('golden') || titleLower.includes('morning') ||
                      titleLower.includes('summer') || titleLower.includes('daylight') ||
                      titleLower.includes('drenched') || titleLower.includes('warm');

      const isCloudy = titleLower.includes('mist') || titleLower.includes('cloud') ||
                       titleLower.includes('cloudy') || titleLower.includes('fog') ||
                       titleLower.includes('foggy') || titleLower.includes('mist-veiled') ||
                       titleLower.includes('misty') || titleLower.includes('hazy') ||
                       titleLower.includes('overcast') || titleLower.includes('moody') ||
                       titleLower.includes('shadow') || titleLower.includes('pale') ||
                       titleLower.includes('eerie') || titleLower.includes('familiar') ||
                       titleLower.includes('empty') || titleLower.includes('silent') ||
                       titleLower.includes('deserted') || titleLower.includes('abandoned') ||
                       titleLower.includes('quiet');

      const isSnowy = titleLower.includes('snow') || titleLower.includes('snowy') ||
                      titleLower.includes('winter') || titleLower.includes('ice') ||
                      titleLower.includes('frozen') || titleLower.includes('cold') ||
                      titleLower.includes('alpine');

      photos.push({
        url: imageUrl,
        title: title,
        author: author,
        source: 'reddit',
        isNight: isNight,
        isRain: isRain,
        isSunny: isSunny,
        isCloudy: isCloudy,
        isSnowy: isSnowy
      });
    }
    
    console.log(`Reddit Crawler: Successfully retrieved ${photos.length} photos from /r/${subreddit}.`);
    return photos;
  } catch (err) {
    console.error(`Reddit crawler failed for /r/${subreddit}:`, err.message);
    return [];
  }
}

/**
 * 🖼️ fetchPicsumImages
 * Fetches a list of random landscape frames from Picsum.
 */
async function fetchPicsumImages(count = 30) {
  try {
    console.log(`Picsum Crawler: Fetching ${count} photos...`);
    const res = await fetch(`https://picsum.photos/v2/list?limit=${count}`);
    if (!res.ok) return [];

    const data = await res.json();
    const photos = data.map(item => {
      const baseUrl = item.download_url.split('/id/')[0];
      const photoId = item.id;
      const url = `${baseUrl}/id/${photoId}/2560/1440`;
      
      return {
        url: url,
        title: `Picsum Scenic Frame #${photoId}`,
        author: item.author,
        source: 'picsum',
        isNight: false,
        isRain: false,
        isSunny: true,
        isCloudy: false,
        isSnowy: false
      };
    });

    console.log(`Picsum Crawler: Loaded ${photos.length} photos.`);
    return photos;
  } catch (err) {
    console.error('Picsum crawler failed:', err.message);
    return [];
  }
}

/**
 * 🎨 fetchLexicaImages
 * Scrapes Lexica Art Search API for high quality AI landscape creations.
 */
async function fetchLexicaImages(query, count = 25) {
  try {
    console.log(`Lexica Crawler: Fetching query "${query}"...`);
    const res = await fetch(`https://lexica.art/api/v1/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      console.warn(`Lexica Crawler: Failed to fetch, status=${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!data || !data.images) return [];

    const photos = [];
    for (const img of data.images) {
      if (!img.src || photos.length >= count) continue;
      if (img.width && img.height && img.width < img.height) continue; // Landscape only

      let title = img.prompt || 'AI Generative Creation';
      title = title.replace(/[\r\n\t]+/g, ' ').trim();
      if (title.length > 55) {
        title = title.substring(0, 52) + '...';
      }
      title = title.charAt(0).toUpperCase() + title.slice(1);

      photos.push({
        url: img.src,
        title: title,
        author: 'Lexica AI Art',
        source: 'lexica',
        isNight: query.includes('night') || query.includes('cyberpunk'),
        isRain: query.includes('wet') || query.includes('rain'),
        isSunny: query.includes('sunny') || query.includes('clear'),
        isCloudy: query.includes('abstract') || query.includes('generative'),
        isSnowy: query.includes('snow') || query.includes('wintry')
      });
    }

    console.log(`Lexica Crawler: Loaded ${photos.length} AI photos.`);
    return photos;
  } catch (err) {
    console.error('Lexica crawler failed:', err.message);
    return [];
  }
}

/**
 * 🪐 fetchWallhavenImages
 * Queries the public Wallhaven API for high-resolution landscape images.
 * Uses keyless, SFW-only filters.
 */
async function fetchWallhavenImages(query, category, count = 15) {
  try {
    console.log(`Wallhaven Crawler: Querying "${query}" for category "${category}"...`);
    // SFW only (purity=100), landscape ratio (ratios=16x9,16x10)
    const url = `https://wallhaven.cc/api/v1/search?q=${encodeURIComponent(query)}&purity=100&ratios=16x9,16x10&sorting=relevance`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Wallhaven Crawler: Failed to query, status=${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!data || !data.data || !Array.isArray(data.data)) return [];

    const photos = [];
    for (const item of data.data) {
      if (photos.length >= count) break;
      if (!item.path) continue;

      const title = `${category} Frame #${item.id || 'Scenic'}`;
      const author = item.uploader?.username || 'Wallhaven Contributor';

      const queryLower = query.toLowerCase();

      // Simple keywords classification
      const isNight = queryLower.includes('night') || queryLower.includes('dark') || 
                      queryLower.includes('stars') || queryLower.includes('space') || 
                      category === 'Cosmic Space';
      const isRain = queryLower.includes('rain') || queryLower.includes('wet') || queryLower.includes('storm');
      const isSunny = queryLower.includes('sun') || queryLower.includes('clear') || queryLower.includes('summer');
      const isCloudy = queryLower.includes('mist') || queryLower.includes('cloud') || queryLower.includes('fog') || queryLower.includes('moody');
      const isSnowy = queryLower.includes('snow') || queryLower.includes('winter') || queryLower.includes('frozen');

      photos.push({
        url: item.path,
        title: title,
        author: author,
        source: 'wallhaven',
        isNight: isNight,
        isRain: isRain,
        isSunny: isSunny,
        isCloudy: isCloudy,
        isSnowy: isSnowy
      });
    }

    console.log(`Wallhaven Crawler: Successfully loaded ${photos.length} photos.`);
    return photos;
  } catch (err) {
    console.error('Wallhaven crawler failed:', err.message);
    return [];
  }
}

/**
 * 🛰️ fetchNasaApod
 * Fetches NASA APOD (Astronomy Picture of the Day) cosmic landscape frames.
 */
async function fetchNasaApod(count = 10) {
  try {
    console.log(`NASA APOD Crawler: Fetching ${count} cosmic photos...`);
    const apiKey = process.env.NASA_API_KEY || 'DEMO_KEY';
    const url = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}&count=${count}`;
    
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`NASA APOD Crawler: Failed to query, status=${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!data || !Array.isArray(data)) return [];

    const photos = [];
    for (const item of data) {
      if (item.media_type !== 'image' || !item.url) continue;

      let title = item.title || 'Cosmic Deep Space Frame';
      if (title.length > 55) {
        title = title.substring(0, 52) + '...';
      }
      title = title.charAt(0).toUpperCase() + title.slice(1);

      const author = item.copyright ? item.copyright.trim().replace(/[\r\n\t]+/g, ' ') : 'NASA / APOD';

      photos.push({
        url: item.hdurl || item.url, // Prefer hdurl if present
        title: title,
        author: author,
        source: 'nasa_apod',
        isNight: true, // APODs are deep space cosmic photos -> always night-aligned!
        isRain: false,
        isSunny: false,
        isCloudy: true, // Cosmic dust nebulas are beautiful clouds of gas!
        isSnowy: false
      });
    }

    console.log(`NASA APOD Crawler: Successfully loaded ${photos.length} APOD cosmic photos.`);
    return photos;
  } catch (err) {
    console.error('NASA APOD crawler failed:', err.message);
    return [];
  }
}

/**
 * 🎨 fetchMidjourneyImages
 * Fetches Midjourney generative images via UseAPI.net.
 * Supports token authorization, filters out portraits, extracts prompts, and handles self-healing fallback.
 */
async function fetchMidjourneyImages(count = 15) {
  const token = process.env.USEAPI_TOKEN;
  if (!token) {
    console.log('UseAPI.net: No USEAPI_TOKEN configured. Using free keyless AI aggregators (Lexica Art + Wallhaven AI)...');
    try {
      const lexicaPromise = fetchLexicaImages('midjourney landscape surreal dreamscape', count);
      const wallhavenPromise = fetchWallhavenImages('id:111195', 'AI Creations', count);
      
      const [lexicaPhotos, wallhavenPhotos] = await Promise.all([lexicaPromise, wallhavenPromise]);
      
      // Combine them alternately (round-robin style)
      const combined = [];
      const maxLen = Math.max(lexicaPhotos.length, wallhavenPhotos.length);
      for (let i = 0; i < maxLen; i++) {
        if (lexicaPhotos[i]) combined.push(lexicaPhotos[i]);
        if (wallhavenPhotos[i]) combined.push(wallhavenPhotos[i]);
      }
      
      console.log(`Free AI Aggregators: Loaded ${combined.length} stunning keyless AI photos successfully.`);
      return combined;
    } catch (err) {
      console.error('Free AI aggregators crawl failed:', err.message);
      return [];
    }
  }

  try {
    console.log('UseAPI.net: Fetching Midjourney jobs...');
    const apiUrl = 'https://api.useapi.net/v2/jobs';
    const res = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      console.warn(`UseAPI.net: Failed to fetch jobs, status=${res.status}`);
      return [];
    }

    const jobs = await res.json();
    if (!jobs || !Array.isArray(jobs)) {
      console.warn('UseAPI.net: Expected an array of jobs, got:', jobs);
      return [];
    }

    const photos = [];
    for (const job of jobs) {
      if (photos.length >= count) break;
      
      let imageUrl = job.url;
      if (!imageUrl && job.attachments && job.attachments[0]) {
        imageUrl = job.attachments[0].url;
      }
      
      if (!imageUrl) continue;

      let title = job.prompt || job.content || 'AI Creations Frame';
      title = title.replace(/--ar\s+\d+:\d+/g, '').replace(/--v\s+\d+/g, '').replace(/[\r\n\t]+/g, ' ').trim();
      if (title.length > 55) {
        title = title.substring(0, 52) + '...';
      }
      title = title.charAt(0).toUpperCase() + title.slice(1);

      let isLandscape = true;
      let width = job.width;
      let height = job.height;
      if (!width && job.attachments && job.attachments[0]) {
        width = job.attachments[0].width;
        height = job.attachments[0].height;
      }

      if (width && height && width < height) {
        isLandscape = false;
      }

      if (!isLandscape) continue;

      const author = job.user || job.username || 'Midjourney AI';

      photos.push({
        url: imageUrl,
        title: title,
        author: author,
        source: 'midjourney_useapi',
        isNight: title.toLowerCase().includes('night') || title.toLowerCase().includes('dark') || title.toLowerCase().includes('cyberpunk'),
        isRain: title.toLowerCase().includes('rain') || title.toLowerCase().includes('wet') || title.toLowerCase().includes('storm'),
        isSunny: !title.toLowerCase().includes('night') && !title.toLowerCase().includes('rain'),
        isCloudy: true,
        isSnowy: false
      });
    }

    console.log(`UseAPI.net: Successfully loaded ${photos.length} Midjourney photos.`);
    return photos;
  } catch (err) {
    console.error('UseAPI.net: Failed to fetch Midjourney images:', err.message);
    return [];
  }
}

/**
 * 🏔️ crawlAllCollections
 * Modular orchestrator that runs all crawls (Reddit, Picsum, Unsplash, Lexica, Midjourney),
 * filters out portraits, filters negative words, tags keywords, and limits to 2000 per category.
 */
async function crawlAllCollections(currentCollections, searchKeywords = null) {
  console.log('Initiating dynamic multi-source feed updates for all categories...');
  const updatedCollections = { ...currentCollections };
  let updatedAny = false;

  // 1. Crawl Reddit Images
  for (const [category, subreddits] of Object.entries(categorySubreddits)) {
    let categoryList = [...(updatedCollections[category] || [])];
    const initialLength = categoryList.length;
    const existingUrls = new Set(categoryList.map(item => item.url));

    for (const sub of subreddits) {
      const redditPhotos = await fetchRedditImages(sub, category, 25);
      for (const p of redditPhotos) {
        if (!existingUrls.has(p.url)) {
          categoryList.push(p);
          existingUrls.add(p.url);
        }
      }
    }

    updatedCollections[category] = categoryList;
    if (categoryList.length > initialLength) {
      console.log(`Reddit: Added ${categoryList.length - initialLength} new photos to "${category}"`);
      updatedAny = true;
    }
  }

  // 2. Crawl Lorem Picsum
  try {
    const picsumPhotos = await fetchPicsumImages(20);
    let scenicList = [...(updatedCollections['Scenic Nature'] || [])];
    const initialScenicLength = scenicList.length;
    const existingScenicUrls = new Set(scenicList.map(item => item.url));

    for (const p of picsumPhotos) {
      if (!existingScenicUrls.has(p.url)) {
        scenicList.push(p);
        existingScenicUrls.add(p.url);
      }
    }
    updatedCollections['Scenic Nature'] = scenicList;
    if (scenicList.length > initialScenicLength) {
      console.log(`Picsum: Added ${scenicList.length - initialScenicLength} photos to "Scenic Nature"`);
      updatedAny = true;
    }
  } catch (err) {
    console.error('Picsum daily crawl failed:', err.message);
  }

  // 3. Crawl Unsplash NAPI
  for (const [category, baseQuery] of Object.entries(searchQueries)) {
    let categoryList = [...(updatedCollections[category] || [])];
    const initialLength = categoryList.length;
    const existingUrls = new Set(categoryList.map(item => item.url));

    const customQueries = (searchKeywords && searchKeywords[category]) || [baseQuery];
    const chosenQuery = customQueries[Math.floor(Math.random() * customQueries.length)];

    const queriesToCrawl = [
      { q: chosenQuery, isNight: category === 'Cosmic Space', isRain: false },
      { q: `${chosenQuery} night dark stars`, isNight: true, isRain: false },
      { q: `${chosenQuery} rain wet stormy`, isNight: false, isRain: true }
    ];

    for (const qSpec of queriesToCrawl) {
      try {
        console.log(`Unsplash Crawler: Fetching category "${category}" query "${qSpec.q}"...`);
        const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(qSpec.q)}&per_page=12`;
        const res = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        if (!data || !data.results) continue;

        for (const item of data.results) {
          if (item.premium || item.plus) continue;

          const photoId = item.id;
          const photoUrl = `https://images.unsplash.com/photo-${photoId}?q=80&w=2560&auto=format&fit=crop`;

          if (existingUrls.has(photoUrl)) continue;

          // Clean out portraits & generic keywords
          const negativeKeywords = ['person', 'man', 'woman', 'people', 'face', 'portrait', 'selfie', 'dog', 'cat', 'animal', 'pet', 'food', 'plate', 'kitchen', 'wedding', 'ufo', 'alien', 'text', 'logo', 'signage'];
          const textToSearch = `${item.description || ''} ${item.alt_description || ''} ${item.slug || ''}`.toLowerCase();
          const containsNegative = negativeKeywords.some(keyword => textToSearch.includes(keyword));
          if (containsNegative) continue;

          let rawTitle = item.description || item.alt_description || `${category} Ambient Frame`;
          let cleanedTitle = rawTitle.trim().replace(/-/g, ' ');
          if (cleanedTitle.length > 55) {
            cleanedTitle = cleanedTitle.substring(0, 52) + '...';
          }
          cleanedTitle = cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1);

          categoryList.push({
            url: photoUrl,
            title: cleanedTitle,
            author: item.user.name || item.user.username || 'Unsplash Contributor',
            source: 'unsplash',
            isNight: qSpec.isNight,
            isRain: qSpec.isRain,
            isSunny: !qSpec.isNight && !qSpec.isRain,
            isCloudy: !qSpec.isNight && qSpec.isRain,
            isSnowy: false
          });
          existingUrls.add(photoUrl);
        }
      } catch (err) {
        console.error(`Unsplash crawl failed for query "${qSpec.q}":`, err.message);
      }
    }

    if (categoryList.length > 2000) {
      const originalCuratedCount = Math.min(12, categoryList.length);
      const originals = categoryList.slice(0, originalCuratedCount);
      const dynamicAdded = categoryList.slice(originalCuratedCount);
      const allowedDynamic = 2000 - originalCuratedCount;
      categoryList = originals.concat(dynamicAdded.slice(-allowedDynamic));
    }

    updatedCollections[category] = categoryList;
    if (categoryList.length > initialLength) {
      console.log(`Unsplash: Added ${categoryList.length - initialLength} new photos to "${category}" (Total: ${categoryList.length})`);
      updatedAny = true;
    }
  }

  // 3.5. Crawl Wallhaven SFW
  for (const category of ['Scenic Nature', 'Cosmic Space', 'Abstract Art', 'Liminal Spaces']) {
    try {
      let categoryList = [...(updatedCollections[category] || [])];
      const initialLength = categoryList.length;
      const existingUrls = new Set(categoryList.map(item => item.url));

      const baseQuery = searchQueries[category] || 'landscape';
      const customQueries = (searchKeywords && searchKeywords[category]) || [baseQuery];
      const chosenQuery = customQueries[Math.floor(Math.random() * customQueries.length)];

      const wallhavenPhotos = await fetchWallhavenImages(chosenQuery, category, 10);
      for (const p of wallhavenPhotos) {
        if (!existingUrls.has(p.url)) {
          categoryList.push(p);
          existingUrls.add(p.url);
        }
      }

      if (categoryList.length > 2000) {
        const originalCuratedCount = Math.min(12, categoryList.length);
        const originals = categoryList.slice(0, originalCuratedCount);
        const dynamicAdded = categoryList.slice(originalCuratedCount);
        const allowedDynamic = 2000 - originalCuratedCount;
        categoryList = originals.concat(dynamicAdded.slice(-allowedDynamic));
      }

      updatedCollections[category] = categoryList;
      if (categoryList.length > initialLength) {
        console.log(`Wallhaven: Added ${categoryList.length - initialLength} new photos to "${category}" (Total: ${categoryList.length})`);
        updatedAny = true;
      }
    } catch (err) {
      console.error(`Wallhaven daily crawl failed for category "${category}":`, err.message);
    }
  }

  // 3.6. Crawl NASA APOD
  try {
    let cosmicList = [...(updatedCollections['Cosmic Space'] || [])];
    const initialCosmicLength = cosmicList.length;
    const existingCosmicUrls = new Set(cosmicList.map(item => item.url));

    const apodPhotos = await fetchNasaApod(8);
    for (const p of apodPhotos) {
      if (!existingCosmicUrls.has(p.url)) {
        cosmicList.push(p);
        existingCosmicUrls.add(p.url);
      }
    }

    if (cosmicList.length > 2000) {
      const originalCuratedCount = Math.min(12, cosmicList.length);
      const originals = cosmicList.slice(0, originalCuratedCount);
      const dynamicAdded = cosmicList.slice(originalCuratedCount);
      const allowedDynamic = 2000 - originalCuratedCount;
      cosmicList = originals.concat(dynamicAdded.slice(-allowedDynamic));
    }

    updatedCollections['Cosmic Space'] = cosmicList;
    if (cosmicList.length > initialCosmicLength) {
      console.log(`NASA APOD: Added ${cosmicList.length - initialCosmicLength} photos to "Cosmic Space" (Total: ${cosmicList.length})`);
      updatedAny = true;
    }
  } catch (err) {
    console.error('NASA APOD daily crawl failed:', err.message);
  }

  // 3.7. Crawl Midjourney (UseAPI.net)
  try {
    let aiList = [...(updatedCollections['AI Creations'] || [])];
    const initialAiLength = aiList.length;
    const existingAiUrls = new Set(aiList.map(item => item.url));

    const mjPhotos = await fetchMidjourneyImages(15);
    for (const p of mjPhotos) {
      if (!existingAiUrls.has(p.url)) {
        aiList.push(p);
        existingAiUrls.add(p.url);
      }
    }

    if (aiList.length > 2000) {
      const originalCuratedCount = Math.min(12, aiList.length);
      const originals = aiList.slice(0, originalCuratedCount);
      const dynamicAdded = aiList.slice(originalCuratedCount);
      const allowedDynamic = 2000 - originalCuratedCount;
      aiList = originals.concat(dynamicAdded.slice(-allowedDynamic));
    }

    updatedCollections['AI Creations'] = aiList;
    if (aiList.length > initialAiLength) {
      console.log(`Midjourney AI: Added ${aiList.length - initialAiLength} photos to "AI Creations" (Total: ${aiList.length})`);
      updatedAny = true;
    }
  } catch (err) {
    console.error('Midjourney daily crawl failed:', err.message);
  }

  // 4. Crawl Lexica Art
  try {
    let aiList = [...(updatedCollections['AI Creations'] || [])];
    const initialAiLength = aiList.length;
    const existingAiUrls = new Set(aiList.map(item => item.url));

    const lexicaQueries = [
      'surreal digital art dreamscape',
      'cyberpunk neon city street',
      'futuristic sci-fi landscape spacescape',
      'abstract generative fractal geometry'
    ];

    for (const query of lexicaQueries) {
      const lexicaPhotos = await fetchLexicaImages(query, 15);
      for (const p of lexicaPhotos) {
        if (!existingAiUrls.has(p.url)) {
          aiList.push(p);
          existingAiUrls.add(p.url);
        }
      }
    }

    if (aiList.length > 2000) {
      const originalCuratedCount = Math.min(12, aiList.length);
      const originals = aiList.slice(0, originalCuratedCount);
      const dynamicAdded = aiList.slice(originalCuratedCount);
      const allowedDynamic = 2000 - originalCuratedCount;
      aiList = originals.concat(dynamicAdded.slice(-allowedDynamic));
    }

    updatedCollections['AI Creations'] = aiList;
    if (aiList.length > initialAiLength) {
      console.log(`Lexica AI: Added ${aiList.length - initialAiLength} photos to "AI Creations" (Total: ${aiList.length})`);
      updatedAny = true;
    }
  } catch (err) {
    console.error('Lexica daily crawl failed:', err.message);
  }

  return { updatedCollections, updatedAny };
}

module.exports = {
  fetchRedditImages,
  fetchPicsumImages,
  fetchLexicaImages,
  fetchWallhavenImages,
  fetchNasaApod,
  fetchMidjourneyImages,
  crawlAllCollections
};
