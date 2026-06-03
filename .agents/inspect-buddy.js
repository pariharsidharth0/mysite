const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = 'file:///' + path.resolve(__dirname, '..', 'prototype-sketchbook.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, 'shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    defaultViewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.goto(FILE, { waitUntil: 'networkidle0' });

  await page.evaluate(() => {
    window.__log = [];
    const fig = document.querySelector('.buddy-fig');
    const say = document.querySelector('.buddy-say');
    const buddy = document.querySelector('.buddy');
    const t0 = performance.now();
    window.__t0 = t0;
    setInterval(() => {
      window.__log.push({
        t: Math.round(performance.now() - t0),
        pose: fig.dataset.pose || 'init',
        cls: fig.className,
        say: say.style.display === 'none' ? '' : say.textContent,
        top: Math.round(parseFloat(buddy.style.top) || 0),
        scroll: Math.round(window.scrollY)
      });
    }, 25);
  });

  await sleep(2600);
  await page.screenshot({ path: path.join(OUT, '0-hero.png') });

  await page.mouse.move(640, 400);

  // scroll to each section like a reader: a few wheel nudges, then PAUSE so the
  // buddy can arrive + land, capturing a burst to catch the landing crouch.
  const sections = ['work', 'books', 'games', 'contact'];
  for (const id of sections) {
    // nudge until this section's top is near the top of the viewport
    for (let i = 0; i < 60; i++) {
      const top = await page.evaluate(s => {
        const e = document.getElementById(s);
        return e ? e.getBoundingClientRect().top : 99999;
      }, id);
      if (top < 120) break;
      await page.mouse.wheel({ deltaY: 200 });
      await sleep(70);
    }
    // PAUSE — let the buddy travel in and land
    const burst = [];
    for (let f = 0; f < 12; f++) {
      await sleep(150);
      await page.screenshot({ path: path.join(OUT, `${id}-${String(f).padStart(2, '0')}.png`) });
      const st = await page.evaluate(() => {
        const fig = document.querySelector('.buddy-fig');
        return { pose: fig.dataset.pose, cls: fig.className };
      });
      burst.push(st.pose);
    }
    console.log(`[${id}] pose sequence while settling: ${burst.join(' → ')}`);
  }

  const log = await page.evaluate(() => window.__log);
  const events = [];
  let prev = null;
  for (const s of log) {
    if (!prev || s.pose !== prev.pose) { events.push(s); prev = s; }
  }
  const landFrames = log.filter(s => s.pose === 'land').length;

  console.log('\n=== FULL POSE TIMELINE ===');
  events.forEach(e => console.log(`  t=${e.t}ms  pose=${e.pose}  say="${e.say}"  scrollY=${e.scroll}`));
  console.log('\n=== EVIDENCE ===');
  console.log(`  samples: ${log.length}, distinct pose changes: ${events.length}`);
  console.log(`  frames showing 'land' crouch: ${landFrames} (~${Math.round(landFrames * 25)}ms total airtime-landings)`);
  console.log('\n=== CONSOLE ERRORS ===');
  console.log(errs.length ? errs.join('\n') : '  (none)');

  await browser.close();
})();
