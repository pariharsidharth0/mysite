const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = 'file:///' + path.resolve(__dirname, '..', 'prototype-sketchbook.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, 'shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 }
  });
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.goto(FILE, { waitUntil: 'networkidle0' });
  await sleep(2600);
  await page.mouse.move(640, 400);

  // get to books and pause so the kid arrives + settles into 'read'
  for (let i = 0; i < 60; i++) {
    const top = await page.evaluate(() => document.getElementById('books').getBoundingClientRect().top);
    if (top < 120) break;
    await page.mouse.wheel({ deltaY: 200 });
    await sleep(70);
  }
  await sleep(1500);

  const info = await page.evaluate(() => {
    const b = document.querySelector('.buddy');
    const r = b.getBoundingClientRect();
    const ink = getComputedStyle(b).getPropertyValue('--buddy-ink').trim();
    const fig = b.querySelector('.buddy-fig');
    return { r: { x: r.x, y: r.y, w: r.width, h: r.height }, ink, pose: fig.dataset.pose };
  });
  console.log('buddy --buddy-ink =', info.ink || '(unset)', '| pose =', info.pose);

  // full-section shot
  await page.screenshot({ path: path.join(OUT, 'books-color-full.png') });
  // zoomed clip around the buddy
  const pad = 60;
  await page.screenshot({
    path: path.join(OUT, 'books-color-zoom.png'),
    clip: {
      x: Math.max(0, info.r.x - pad), y: Math.max(0, info.r.y - pad),
      width: info.r.w + pad * 2, height: info.r.h + pad * 2
    }
  });
  console.log('wrote books-color-full.png + books-color-zoom.png');
  await browser.close();
})();
