const config = require('../config/configLoader.js');

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

/**
 * 🎨 fetchTumblrImages
 * Fetches photo posts from a public Tumblr blog keylessly.
 */
async function fetchTumblrImages(blogName, count = 20) {
  try {
    console.log(`Tumblr Crawler: Fetching posts for blog "${blogName}"...`);
    const res = await fetch(`https://${blogName}.tumblr.com/api/read/json?type=photo&num=${count}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      console.warn(`Tumblr Crawler: Failed for blog "${blogName}" (status ${res.status})`);
      return [];
    }

    const text = await res.text();
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1) {
      console.warn(`Tumblr Crawler: Invalid JSONP wrapper returned for blog "${blogName}"`);
      return [];
    }

    const data = JSON.parse(text.substring(startIdx, endIdx + 1));
    const posts = data.posts || [];
    const photos = [];

    for (const post of posts) {
      if (post.type !== 'photo') continue;

      const postPhotos = post.photos || [];
      const caption = post['photo-caption'] || post.slug || 'Tumblr Scenic Photo';
      // Clean HTML tags from caption
      let title = caption.replace(/<[^>]*>/g, '').trim().replace(/[\r\n\t]+/g, ' ');
      if (title.length > 55) {
        title = title.substring(0, 52) + '...';
      }
      title = title.charAt(0).toUpperCase() + title.slice(1);

      const author = data.tumblelog ? data.tumblelog.title : 'Tumblr Contributor';

      if (postPhotos.length > 0) {
        for (const p of postPhotos) {
          const url = p['photo-url-1280'] || p['photo-url-500'] || p['photo-url-250'];
          if (url) {
            photos.push({
              url,
              title: title || 'Tumblr Scenic Photo',
              author: author,
              source: 'tumblr',
              isNight: false,
              isRain: false,
              isSunny: true,
              isCloudy: false,
              isSnowy: false
            });
          }
        }
      } else {
        const url = post['photo-url-1280'] || post['photo-url-500'] || post['photo-url-250'];
        if (url) {
          photos.push({
            url,
            title: title || 'Tumblr Scenic Photo',
            author: author,
            source: 'tumblr',
            isNight: false,
            isRain: false,
            isSunny: true,
            isCloudy: false,
            isSnowy: false
          });
        }
      }
    }

    console.log(`Tumblr Crawler: Successfully loaded ${photos.length} photos from "${blogName}".`);
    return photos;
  } catch (err) {
    console.error(`Tumblr crawler failed for blog "${blogName}":`, err.message);
    return [];
  }
}

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
    const apiKey = config.nasaApiKey || 'DEMO_KEY';
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
 * 🌅 fetchBingImageOfTheDay
 * Fetches the daily wallpapers from Bing's HPImageArchive endpoint.
 */
async function fetchBingImageOfTheDay(count = 8) {
  try {
    console.log(`Bing Crawler: Fetching ${count} daily wallpapers...`);
    const res = await fetch(`https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=${count}&mkt=en-US`);
    if (!res.ok) {
      console.warn(`Bing Crawler: Failed to fetch, status=${res.status}`);
      return [];
    }
    const data = await res.json();
    if (!data || !data.images || !Array.isArray(data.images)) return [];

    const photos = data.images.map(img => {
      const url = img.url.startsWith('http') ? img.url : `https://www.bing.com${img.url}`;
      const copyrightMatch = img.copyright ? img.copyright.match(/^(.*?)\s*\(©\s*(.*?)\)$/) : null;
      const title = img.title || (copyrightMatch ? copyrightMatch[1] : 'Bing Daily Photo');
      const author = copyrightMatch ? copyrightMatch[2] : (img.copyright || 'Bing Photography');

      return {
        url: url,
        title: title.length > 55 ? title.substring(0, 52) + '...' : title,
        author: author.length > 40 ? author.substring(0, 37) + '...' : author,
        source: 'bing',
        isNight: false,
        isRain: false,
        isSunny: true,
        isCloudy: true,
        isSnowy: false
      };
    });
    console.log(`Bing Crawler: Successfully loaded ${photos.length} Bing daily wallpapers.`);
    return photos;
  } catch (err) {
    console.error('Bing crawler failed:', err.message);
    return [];
  }
}

/**
 * 📸 fetchUnsplashImages
 * Fetches high-definition wallpapers from Unsplash NAPI.
 */
async function fetchUnsplashImages(query, count = 20) {
  try {
    const queriesToCrawl = [
      `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=20&xp=feedback-loop:control`,
      `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query + ' wallpaper')}&per_page=20&xp=feedback-loop:control`,
      `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query + ' 4k')}&per_page=20&xp=feedback-loop:control`
    ];

    const photos = [];
    const existingUrls = new Set();

    for (const url of queriesToCrawl) {
      console.log(`Unsplash Crawler: Fetching "${query}" wallpapers from ${url}...`);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!res.ok) {
        console.warn(`Unsplash Crawler: Failed to fetch for query "${query}" (status ${res.status})`);
        continue;
      }

      const data = await res.json();
      const results = data.results || [];

      for (const item of results) {
        const width = item.width;
        const height = item.height;
        const isLandscape = width && height ? width > height : true;
        if (!isLandscape) continue;

        const photoUrl = item.urls ? (item.urls.raw || item.urls.full || item.urls.regular) : null;
        if (!photoUrl) continue;

        const finalUrl = photoUrl.includes('?') ? `${photoUrl.split('?')[0]}?q=80&w=2560&auto=format&fit=crop` : photoUrl;

        if (!existingUrls.has(finalUrl)) {
          const cleanTitle = item.description || item.alt_description || `${query} Scenic Landscape`;
          let title = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
          if (title.length > 55) {
            title = title.substring(0, 52) + '...';
          }
          const author = item.user ? (item.user.name || item.user.username) : 'Unsplash Photographer';

          photos.push({
            url: finalUrl,
            title: title,
            author: author,
            source: 'unsplash',
            isNight: false,
            isRain: false,
            isSunny: true,
            isCloudy: false,
            isSnowy: false
          });
          existingUrls.add(finalUrl);
        }
      }
    }
    
    console.log(`Unsplash Crawler: Successfully loaded ${photos.length} photos.`);
    return photos.slice(0, count);
  } catch (err) {
    console.error(`Unsplash crawler failed for keyword "${query}":`, err.message);
    return [];
  }
}

/**
 * 🎨 fetchMidjourneyImages
 * Fetches Midjourney generative images via UseAPI.net.
 * Supports token authorization, filters out portraits, extracts prompts, and handles self-healing fallback.
 */
async function fetchMidjourneyImages(count = 15) {
  const token = config.useapiToken;
  if (!token) {
    console.log('UseAPI.net: No USEAPI_TOKEN configured. Using free keyless AI aggregators (Lexica Art + Wallhaven AI)...');
    try {
      const lexicaPromise = fetchLexicaImages('midjourney landscape surreal dreamscape', count);
      const wallhavenPromise = fetchWallhavenImages('cyberpunk landscape surreal', 'AI Creations', count);
      
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
 * 🏛️ fetchMetMuseumImages
 * Fetches public domain images from the Metropolitan Museum of Art.
 */
async function fetchMetMuseumImages(query, count = 10) {
  try {
    console.log(`MetMuseum Crawler: Searching for "${query}"...`);
    const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl);
    if (!res.ok) {
      console.warn(`MetMuseum Crawler: Failed to search for query "${query}" (status ${res.status})`);
      return [];
    }
    const data = await res.json();
    if (!data.objectIDs || data.objectIDs.length === 0) {
      console.log(`MetMuseum Crawler: No objects found for query "${query}".`);
      return [];
    }

    // Fetch details for object IDs
    const idsToFetch = data.objectIDs.slice(0, count * 2);
    const photos = [];

    for (const id of idsToFetch) {
      if (photos.length >= count) break;
      try {
        const detailRes = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
        if (!detailRes.ok) continue;
        const detail = await detailRes.json();
        
        const imageUrl = detail.primaryImage || detail.primaryImageSmall;
        if (!imageUrl) continue;

        const title = detail.title || `${query} Artpiece`;
        const author = detail.artistDisplayName || 'Unknown Artist';

        photos.push({
          url: imageUrl,
          title: title.length > 55 ? title.substring(0, 52) + '...' : title,
          author: author,
          source: 'metmuseum',
          isNight: false,
          isRain: false,
          isSunny: true,
          isCloudy: false,
          isSnowy: false
        });
      } catch (err) {
        // Silently ignore detail fetch errors
      }
    }
    
    console.log(`MetMuseum Crawler: Successfully loaded ${photos.length} art pieces.`);
    return photos;
  } catch (err) {
    console.error(`MetMuseum crawler failed for query "${query}":`, err.message);
    return [];
  }
}

/**
 * 🎨 fetchAicImages
 * Fetches artworks from the Art Institute of Chicago IIIF API.
 */
async function fetchAicImages(query, count = 10) {
  try {
    console.log(`AIC Crawler: Searching for "${query}"...`);
    const searchUrl = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(query)}&limit=${count}&fields=id,title,image_id,artist_title`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) {
      console.warn(`AIC Crawler: Failed to search for query "${query}" (status ${res.status})`);
      return [];
    }
    const data = await res.json();
    const artworks = data.data || [];
    const iiifBase = data.config && data.config.iiif_url ? data.config.iiif_url : 'https://www.artic.edu/iiif/2';

    const photos = [];
    for (const artwork of artworks) {
      if (!artwork.image_id) continue;
      const imageUrl = `${iiifBase}/${artwork.image_id}/full/843,/0/default.jpg`;
      const title = artwork.title || `${query} Artwork`;
      const author = artwork.artist_title || 'Unknown Artist';

      photos.push({
        url: imageUrl,
        title: title.length > 55 ? title.substring(0, 52) + '...' : title,
        author: author,
        source: 'artic',
        isNight: false,
        isRain: false,
        isSunny: true,
        isCloudy: false,
        isSnowy: false
      });
    }

    console.log(`AIC Crawler: Successfully loaded ${photos.length} artworks.`);
    return photos;
  } catch (err) {
    console.error(`AIC crawler failed for query "${query}":`, err.message);
    return [];
  }
}

/**
 * 🔍 extractKeywords
 * Declarative flatMap extractor resolving nested keyword configurations.
 */
const extractKeywords = (kws) => {
  if (Array.isArray(kws)) {
    return kws.flatMap(item => {
      if (typeof item === 'string') return [item];
      if (item && typeof item === 'object') {
        const itemKws = Array.isArray(item.keywords) ? item.keywords : [item.keywords];
        return itemKws.filter(kw => typeof kw === 'string');
      }
      return [];
    });
  }
  return typeof kws === 'string' ? [kws] : [];
};

/**
 * ⚙️ getCategoryDefaults
 * Pure registry mapping categories to their default service configurations.
 */
const getCategoryDefaults = (category) => {
  const defaults = {
    'Scenic Nature': {
      reddit: { enabled: true, subreddits: ['EarthPorn', 'landscapephotography'] },
      tumblr: { enabled: true, blogs: ['scenic-nature-lands', 'earthlandscape', 'nature-scenery'] },
      picsum: { enabled: true },
      bing: { enabled: true }
    },
    'Cosmic Space': {
      reddit: { enabled: true, subreddits: ['spaceporn', 'Astrophotography'] },
      tumblr: { enabled: true, blogs: ['nasaimages', 'cosmic-space-explorer'] },
      nasaApod: { enabled: true }
    },
    'Abstract Art': {
      tumblr: { enabled: true, blogs: ['abstractartgallery', 'generative-art'] }
    },
    'Liminal Spaces': {
      tumblr: { enabled: true, blogs: ['liminal-spaces', 'emptycorridors'] }
    },
    'AI Creations': {
      tumblr: { enabled: true, blogs: ['aiartgenerator', 'midjourneycreations'] },
      midjourney: { enabled: true }
    }
  };
  return defaults[category] || {};
};

/**
 * 🛠️ buildFeedConfigsFromKeywords
 * Declarative configuration builder. Translates custom keyword maps into structured crawler targets.
 */
function buildFeedConfigsFromKeywords(keywordsMap) {
  return Object.entries(keywordsMap).reduce((configs, [category, kws]) => {
    const keywords = extractKeywords(kws);
    configs[category] = {
      unsplash: { enabled: true, keywords: [...keywords] },
      wallhaven: { enabled: true, keywords: [...keywords] },
      ...getCategoryDefaults(category)
    };
    return configs;
  }, {});
}

/**
 * 🔒 capCollectionLimit
 * Helper function to cap category collections to a maximum size (default 2000),
 * keeping up to 12 of the original curated items and pruning older dynamic entries.
 */
function capCollectionLimit(list, initialLength, limit = 2000) {
  if (list.length <= limit) return list;
  const originalCuratedCount = Math.min(12, list.length);
  const originals = list.slice(0, originalCuratedCount);
  const dynamicAdded = list.slice(initialLength);
  const allowedDynamic = limit - originalCuratedCount;
  return originals.concat(dynamicAdded.slice(-allowedDynamic));
}

/**
 * 🏔️ crawlAllCollections
 * Declarative orchestrator that runs all crawls based on per-source feed configurations.
 */
async function crawlAllCollections(currentCollections, feedConfigs = null, searchKeywords = null, excludedKeywords = null) {
  console.log('Initiating dynamic multi-source feed updates for all categories...');
  const updatedCollections = { ...currentCollections };
  let updatedAny = false;

  const matchesExclusion = (excludedList, item) => {
    if (!item || !item.title) return false;
    if (!Array.isArray(excludedList) || excludedList.length === 0) return false;
    const titleText = item.title.toLowerCase();
    return excludedList.some(kw => titleText.includes(kw.toLowerCase()));
  };

  const configs = feedConfigs || buildFeedConfigsFromKeywords(searchKeywords || searchQueries);

  // Initialize global Set of all existing image URLs across all categories for global deduplication
  const globalExistingUrls = new Set();
  for (const catList of Object.values(currentCollections)) {
    if (Array.isArray(catList)) {
      for (const item of catList) {
        if (item && item.url) {
          globalExistingUrls.add(item.url);
        }
      }
    }
  }

  // Declarative scraper definitions
  const scrapers = [
    {
      key: 'reddit',
      param: 'subreddits',
      fetcher: async (sub, category) => fetchRedditImages(sub, category, 25)
    },
    {
      key: 'picsum',
      fetcher: async () => fetchPicsumImages(20)
    },
    {
      key: 'bing',
      fetcher: async () => fetchBingImageOfTheDay(8)
    },
    {
      key: 'unsplash',
      param: 'keywords',
      fetcher: async (kw) => fetchUnsplashImages(kw, 20)
    },
    {
      key: 'wallhaven',
      param: 'keywords',
      fetcher: async (kw, category) => fetchWallhavenImages(kw, category, 10)
    },
    {
      key: 'tumblr',
      param: 'blogs',
      fetcher: async (blog) => fetchTumblrImages(blog, 10)
    },
    {
      key: 'metmuseum',
      param: 'keywords',
      fetcher: async (kw) => fetchMetMuseumImages(kw, 10)
    },
    {
      key: 'artic',
      param: 'keywords',
      fetcher: async (kw) => fetchAicImages(kw, 10)
    },
    {
      key: 'nasaApod',
      fetcher: async () => fetchNasaApod(8)
    },
    {
      key: 'midjourney',
      fetcher: async () => fetchMidjourneyImages(15)
    }
  ];

  // Run all active configured scrapers in a declarative loop
  for (const scraper of scrapers) {
    for (const [category, config] of Object.entries(configs)) {
      const sourceConfig = config[scraper.key];
      if (!sourceConfig || !sourceConfig.enabled) continue;

      try {
        let categoryList = [...(updatedCollections[category] || [])];
        const initialLength = categoryList.length;

        // Fetch new items
        let newItems = [];
        if (scraper.param) {
          const params = sourceConfig[scraper.param] || [];
          for (const param of params) {
            if (typeof param === 'string') {
              const items = await scraper.fetcher(param, category);
              const itemsWithMeta = items.map(item => ({ ...item, queryKeyword: param }));
              newItems = newItems.concat(itemsWithMeta);
            } else if (param && typeof param === 'object') {
              const kws = Array.isArray(param.keywords) ? param.keywords : [param.keywords];
              for (const kw of kws) {
                if (typeof kw === 'string') {
                  const items = await scraper.fetcher(kw, category);
                  const itemsWithMeta = items.map(item => ({
                    ...item,
                    queryKeyword: kw,
                    timeRanges: [{ start: param.timeStart, end: param.timeEnd }]
                  }));
                  newItems = newItems.concat(itemsWithMeta);
                }
              }
            }
          }
        } else {
          newItems = await scraper.fetcher(category);
        }

        // Add unique items
        for (const item of newItems) {
          if (!globalExistingUrls.has(item.url) && !matchesExclusion(excludedKeywords, item)) {
            // Special rules for Tumblr cosmic night alignment
            if (scraper.key === 'tumblr') {
              item.isNight = category === 'Cosmic Space';
              item.isSunny = !item.isNight;
            }
            categoryList.push(item);
            globalExistingUrls.add(item.url);
          }
        }

        // Cap limit
        categoryList = capCollectionLimit(categoryList, initialLength, 2000);

        if (categoryList.length > initialLength) {
          console.log(`${scraper.key.toUpperCase()}: Added ${categoryList.length - initialLength} new photos to "${category}" (Total: ${categoryList.length})`);
          updatedCollections[category] = categoryList;
          updatedAny = true;
        }
      } catch (err) {
        console.error(`${scraper.key.toUpperCase()} daily crawl failed for category "${category}":`, err.message);
      }
    }
  }

  // 4. Crawl Lexica Art (Fallback if Midjourney is disabled for AI Creations category)
  for (const [category, config] of Object.entries(configs)) {
    if (category === 'AI Creations' && (!config.midjourney || !config.midjourney.enabled)) {
      try {
        let aiList = [...(updatedCollections[category] || [])];
        const initialAiLength = aiList.length;

        const lexicaQueries = [
          'surreal digital art dreamscape',
          'cyberpunk neon city street',
          'futuristic sci-fi landscape spacescape',
          'abstract generative fractal geometry'
        ];

        for (const query of lexicaQueries) {
          const lexicaPhotos = await fetchLexicaImages(query, 15);
          for (const p of lexicaPhotos) {
            if (!globalExistingUrls.has(p.url) && !matchesExclusion(excludedKeywords, p)) {
              aiList.push(p);
              globalExistingUrls.add(p.url);
            }
          }
        }

        aiList = capCollectionLimit(aiList, initialAiLength, 2000);

        updatedCollections[category] = aiList;
        if (aiList.length > initialAiLength) {
          console.log(`Lexica AI: Added ${aiList.length - initialAiLength} photos to "${category}" (Total: ${aiList.length})`);
          updatedAny = true;
        }
      } catch (err) {
        console.error(`Lexica daily crawl failed for category "${category}":`, err.message);
      }
    }
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
  fetchBingImageOfTheDay,
  fetchMetMuseumImages,
  fetchAicImages,
  fetchUnsplashImages,
  crawlAllCollections
};
