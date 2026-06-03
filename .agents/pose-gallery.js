const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = 'file:///' + path.resolve(__dirname, '..', 'prototype-sketchbook.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, 'shots', 'poses.png');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    defaultViewport: { width: 900, height: 620, deviceScaleFactor: 2 }
  });
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); // freeze anims for a clean still
  await page.goto(FILE, { waitUntil: 'networkidle0' });

  // build a labelled grid of every pose using the page's own POSES table
  await page.evaluate(() => {
    const P = window.__POSES;
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#f4efe2;display:flex;flex-wrap:wrap;gap:8px;padding:16px;font-family:sans-serif';
    Object.keys(P).forEach(k => {
      const cell = document.createElement('div');
      cell.style.cssText = 'width:150px;height:180px;border:1px dashed #c9bfa6;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;position:relative';
      const fig = document.createElement('div');
      fig.style.cssText = 'width:96px;flex:1;display:flex;align-items:center;';
      fig.innerHTML = P[k];
      const svg = fig.querySelector('svg');
      svg.style.cssText = 'width:100%;height:auto;overflow:visible';
      svg.querySelectorAll('path,circle').forEach(e => {
        if (!e.classList.contains('fc') && !e.classList.contains('fc2'))
          e.style.cssText = 'fill:none;stroke:#23201b;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round';
        if (e.classList.contains('fc')) e.style.cssText = 'fill:#23201b;stroke:none';
        if (e.classList.contains('spark') || e.classList.contains('page') || e.classList.contains('ctrl'))
          e.style.stroke = '#e4572e';
      });
      const lbl = document.createElement('div');
      lbl.textContent = k;
      lbl.style.cssText = 'font:600 13px sans-serif;color:#23201b;padding:4px';
      cell.appendChild(fig); cell.appendChild(lbl);
      document.body.appendChild(cell);
    });
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: OUT, fullPage: true });
  console.log('wrote ' + OUT);
  await browser.close();
})();
