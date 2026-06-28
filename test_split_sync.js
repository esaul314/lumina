process.env.NODE_ENV = 'test';
const { server } = require('./server/app.js');
const { chromium } = require('@playwright/test');

(async () => {
  console.log('Starting Playwright split-portrait sync test on playwright host...');
  
  console.log('Starting temporary test server on an ephemeral localhost port...');
  const testServer = await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => {
      if (err) return reject(err);
      resolve(server);
    });
  });
  const actualPort = testServer.address().port;
  const baseUrl = `http://localhost:${actualPort}`;
  console.log(`Temporary test server bound to ${baseUrl}`);

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: '/usr/bin/chromium-browser',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const tvPage = await browser.newPage();
    const remotePage = await browser.newPage();

    // Set up console handlers for debugging
    tvPage.on('console', msg => console.log(`[TV CONSOLE] ${msg.text()}`));
    tvPage.on('pageerror', err => console.error(`[TV ERROR] ${err.message}`));
    remotePage.on('console', msg => console.log(`[REMOTE CONSOLE] ${msg.text()}`));
    remotePage.on('pageerror', err => console.error(`[REMOTE ERROR] ${err.message}`));

    console.log('Navigating TV view...');
    await tvPage.goto(`${baseUrl}/?mode=tv`, { waitUntil: 'networkidle' });

    console.log('Navigating Remote view...');
    await remotePage.goto(`${baseUrl}/?mode=remote`, { waitUntil: 'networkidle' });

    console.log('Pages loaded. Waiting 2 seconds for connection...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Triggering splitPortrait = true and a portrait active photo...');
    await remotePage.evaluate(() => {
      window.__socket.emit('toggle-split-portrait', true);
      window.__socket.emit('set-active-photo', {
        url: 'https://picsum.photos/id/1025/1200/1800',
        title: 'Portrait Dog',
        author: 'Picsum',
        source: 'picsum',
        rating: 8,
        isBroken: false,
        isNight: false,
        isRain: false,
        isSunny: false,
        isCloudy: false,
        isSnowy: false,
        category: 'Scenic Nature'
      });
    });

    console.log('Waiting 5 seconds for TV client to load photo, resolve orientation, select second photo, and emit to server...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Inspect state on TV
    const tvState = await tvPage.evaluate(() => window.__state);
    // Inspect state on Remote
    const remoteState = await remotePage.evaluate(() => window.__state);

    console.log('TV active photo:', tvState?.activePhoto?.title);
    console.log('TV activeSecondPhoto:', tvState?.activeSecondPhoto?.title, `(${tvState?.activeSecondPhoto?.url})`);
    console.log('Remote activeSecondPhoto:', remoteState?.activeSecondPhoto?.title, `(${remoteState?.activeSecondPhoto?.url})`);

    // Verify in DOM as well
    const tvDomImages = await tvPage.evaluate(() => {
      const el1 = document.querySelector('.slide.active .split-slide-container div:nth-child(1) .slide-half-image');
      const el2 = document.querySelector('.slide.active .split-slide-container div:nth-child(2) .slide-half-image');
      return {
        img1: el1 ? window.getComputedStyle(el1).backgroundImage : null,
        img2: el2 ? window.getComputedStyle(el2).backgroundImage : null
      };
    });

    console.log('TV DOM Background Images:', tvDomImages);

    if (!tvState.activeSecondPhoto) {
      throw new Error('Test Failed: TV client did not select a second photo!');
    }

    if (tvState.activeSecondPhoto.url !== remoteState.activeSecondPhoto.url) {
      throw new Error('Test Failed: TV active second photo URL does not match Remote active second photo URL!');
    }

    console.log('--- Testing Zoom/Crop Synchronization ---');
    // Get initial background size of active photo on TV
    const initialSize = await tvPage.evaluate(() => {
      const el = document.querySelector('.slide.active .split-slide-container div:nth-child(1) .slide-half-image');
      return el ? window.getComputedStyle(el).backgroundSize : null;
    });
    console.log('Initial TV backgroundSize:', initialSize);

    // Change crop via the actual Direct Control slider UI
    console.log('Changing Direct Control slider to 80 from remote UI...');
    await remotePage.evaluate(() => {
      const slider = document.querySelector('.split-crop-slider');
      if (!slider) {
        throw new Error('Direct Control slider was not found.');
      }
      slider.value = '80';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get new background size
    const newSize = await tvPage.evaluate(() => {
      const el = document.querySelector('.slide.active .split-slide-container div:nth-child(1) .slide-half-image');
      return el ? window.getComputedStyle(el).backgroundSize : null;
    });
    console.log('New TV backgroundSize after zoom:', newSize);

    if (initialSize === newSize) {
      throw new Error('Test Failed: TV backgroundSize did not change after setting cropPercent!');
    }
    console.log('✅ Zoom synchronization verified successfully!');

    console.log('--- Testing Single Landscape Zoom Through The Same Slider ---');
    await remotePage.evaluate(() => {
      window.__socket.emit('set-active-photo', {
        url: 'https://picsum.photos/id/1043/1800/1200',
        title: 'Landscape Mountain',
        author: 'Picsum',
        source: 'picsum',
        rating: 8,
        isBroken: false,
        isNight: false,
        isRain: false,
        isSunny: false,
        isCloudy: false,
        isSnowy: false,
        category: 'Scenic Nature'
      });
    });

    await new Promise(resolve => setTimeout(resolve, 4000));

    const landscapeInitialSize = await tvPage.evaluate(() => {
      const el = document.querySelector('.slide.active .single-slide-image');
      return el ? window.getComputedStyle(el).backgroundSize : null;
    });
    console.log('Initial landscape TV backgroundSize:', landscapeInitialSize);

    await remotePage.evaluate(() => {
      const slider = document.querySelector('.split-crop-slider');
      if (!slider) {
        throw new Error('Direct Control slider was not found for single landscape mode.');
      }
      slider.value = '15';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const landscapeNewSize = await tvPage.evaluate(() => {
      const el = document.querySelector('.slide.active .single-slide-image');
      return el ? window.getComputedStyle(el).backgroundSize : null;
    });
    console.log('New landscape TV backgroundSize after zoom:', landscapeNewSize);

    if (landscapeInitialSize === landscapeNewSize) {
      throw new Error('Test Failed: TV backgroundSize did not change for single landscape mode after moving the Direct Control slider!');
    }
    console.log('✅ Single landscape zoom synchronization verified successfully!');

    console.log('✅ TEST PASSED: Second photo and zoom successfully synchronized between TV and Remote!');

    await browser.close();
    await new Promise(resolve => testServer.close(resolve));
    console.log('Test server closed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    if (browser) {
      await browser.close();
    }
    if (typeof testServer !== 'undefined' && testServer.close) {
      await new Promise(resolve => testServer.close(resolve));
      console.log('Test server closed on error.');
    }
    process.exit(1);
  }
})();
