const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = 'file:///' + path.resolve(__dirname, '..', 'dist', 'index.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, 'shots', 'site');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    defaultViewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });

  await page.evaluate(() => {
    window.__log = [];
    const fig = document.querySelector('.buddy-fig');
    const t0 = performance.now();
    setInterval(() => window.__log.push({ t: Math.round(performance.now() - t0), pose: fig.dataset.pose || 'init', scroll: Math.round(window.scrollY) }), 30);
  });

  await sleep(2800); // preloader + hero

  // sanity in live DOM
  const dom = await page.evaluate(() => ({
    leftoverTokens: (document.body.innerHTML.match(/\{\{/g) || []).length,
    books: document.querySelectorAll('.book-card').length,
    cols: document.querySelectorAll('.book-col').length,
    timeline: document.querySelectorAll('.t-item').length,
    polaroids: document.querySelectorAll('.polaroid').length,
    marquee: !!document.querySelector('.marquee-track'),
    buddyShown: document.querySelector('.buddy').classList.contains('show'),
  }));

  const sections = ['hero', 'about', 'experience', 'github', 'work', 'books', 'games', 'gallery', 'contact'];
  await page.mouse.move(640, 400);
  for (const id of sections) {
    for (let i = 0; i < 80; i++) {
      const top = await page.evaluate(s => { const e = document.getElementById(s); return e ? e.getBoundingClientRect().top : 99999; }, id);
      if (top < 100) break;
      await page.mouse.wheel({ deltaY: 240 });
      await sleep(60);
    }
    await sleep(900);
    await page.screenshot({ path: path.join(OUT, id + '.png') });
  }

  const log = await page.evaluate(() => window.__log);
  const poses = [];
  let prev = null;
  for (const s of log) if (!prev || s.pose !== prev.pose) { poses.push(s.pose); prev = s; }

  console.log('=== DOM SANITY ===');
  console.log(JSON.stringify(dom, null, 1));
  console.log('\n=== BUDDY POSE SEQUENCE ===');
  console.log('  ' + poses.join(' → '));
  console.log('\n=== CONSOLE ERRORS ===');
  console.log(errs.length ? errs.join('\n') : '  (none)');

  await browser.close();
})();
