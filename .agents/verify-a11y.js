const puppeteer = require('puppeteer-core');
const path = require('path');
const OUT = path.resolve(__dirname, 'shots', 'site');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = 'file:///' + path.resolve(__dirname, '..', 'dist', 'index.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });

  // 1) reduced motion
  const rm = await browser.newPage();
  const rmErr = [];
  rm.on('pageerror', e => rmErr.push(e.message));
  await rm.setViewport({ width: 1280, height: 800 });
  await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await rm.goto(FILE, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const rmState = await rm.evaluate(() => ({
    preloaderDone: document.querySelector('.preloader').classList.contains('done'),
    buddyDisplay: getComputedStyle(document.querySelector('.buddy')).display,
    heroVisible: getComputedStyle(document.querySelector('.hero h1 .reveal')).clipPath,
    books: document.querySelectorAll('.book-card').length,
  }));
  await rm.screenshot({ path: path.join(OUT, 'reduced-motion.png') });

  // 2) mobile 390px
  const mb = await browser.newPage();
  const mbErr = [];
  mb.on('pageerror', e => mbErr.push(e.message));
  await mb.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await mb.goto(FILE, { waitUntil: 'domcontentloaded' });
  await sleep(2600);
  const mbState = await mb.evaluate(() => ({ buddyDisplay: getComputedStyle(document.querySelector('.buddy')).display }));
  await mb.screenshot({ path: path.join(OUT, 'mobile-hero.png') });
  // scroll into books on mobile
  await mb.evaluate(() => document.getElementById('books').scrollIntoView());
  await sleep(1200);
  await mb.screenshot({ path: path.join(OUT, 'mobile-books.png') });

  console.log('=== REDUCED MOTION ===');
  console.log(JSON.stringify(rmState, null, 1));
  console.log('  pageerrors:', rmErr.length ? rmErr.join('; ') : '(none)');
  console.log('=== MOBILE 390px ===');
  console.log(JSON.stringify(mbState, null, 1));
  console.log('  pageerrors:', mbErr.length ? mbErr.join('; ') : '(none)');

  await browser.close();
})();
