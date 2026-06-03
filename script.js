/* ============================================================
   SKETCHBOOK — paper canvas + roaming doodle-buddy.
   Full design reference + extension guide: ANIMATIONS.md
   ============================================================ */
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---- set --len on every .draw path so the dasharray self-draw works ---- */
document.querySelectorAll('.draw').forEach(p => {
  try { p.style.setProperty('--len', p.getTotalLength()); }
  catch (e) { p.style.setProperty('--len', 1000); }
});

/* ---- skills marquee: built from the rendered .skill-pill text ---- */
(function buildMarquee() {
  const host = document.getElementById('skills-marquee');
  if (!host) return;
  const skills = [...document.querySelectorAll('.skill-pill')].map(p => p.textContent.trim()).filter(Boolean);
  if (!skills.length) return;
  const track = document.createElement('div');
  track.className = 'marquee-track';
  const run = () => skills.map(s => `<span>${s}</span>`).join('');
  track.innerHTML = run() + run();           // duplicate for a seamless -50% loop
  host.appendChild(track);
})();

/* ---- hide the CV button when there's no real CV link ---- */
(function hideCv() {
  const cv = document.querySelector('.cv-btn');
  if (!cv) return;
  const href = cv.getAttribute('href');
  if (!href || href === '#' || href.trim() === '') cv.style.display = 'none';
})();

/* ---- BOOKS: reorder to 6 top-rated + 14 random (20 visible), then
        distribute round-robin into parallax columns ---- */
(function reorderBooks() {
  const grid = document.querySelector('.books-grid');
  if (!grid) return;
  let cards = [...grid.querySelectorAll('.book-card')];
  if (!cards.length) return;
  cards.sort((a, b) => (parseFloat(b.dataset.rating) || 0) - (parseFloat(a.dataset.rating) || 0));
  const top = cards.slice(0, 6);
  const rest = cards.slice(6);
  for (let i = rest.length - 1; i > 0; i--) {           // shuffle the rest
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const ordered = [...top, ...rest.slice(0, 14), ...rest.slice(14)];
  ordered.forEach((c, i) => { c.classList.toggle('hidden-book', i >= 20); c.classList.remove('show-book'); });
  const n = window.innerWidth < 700 ? 2 : (window.innerWidth < 1000 ? 3 : 4);
  grid.innerHTML = '';
  const cols = Array.from({ length: n }, () => { const d = document.createElement('div'); d.className = 'book-col'; grid.appendChild(d); return d; });
  ordered.forEach((c, i) => cols[i % n].appendChild(c));
})();

/* ---- BOOKS "show all" toggle (works even when animations are skipped) ---- */
(function booksToggle() {
  const btn = document.getElementById('books-toggle-btn');
  if (!btn) return;
  let shown = false;
  btn.addEventListener('click', () => {
    shown = !shown;
    document.querySelectorAll('.book-card.hidden-book').forEach(b => b.classList.toggle('show-book', shown));
    const label = btn.querySelector('.btn-text');
    if (label) label.textContent = shown ? 'show less ✎' : 'show all books ✎';
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });
})();

/* ---- cover-missing safety net: styled "NO COVER" tile on load failure ---- */
document.querySelectorAll('.book-image').forEach(el => {
  const m = (el.style.backgroundImage || '').match(/url\(["']?(.*?)["']?\)/);
  if (!m || !m[1]) return;
  const img = new Image();
  img.onerror = () => { const card = el.closest('.book-card'); if (card) card.classList.add('cover-missing'); };
  img.src = m[1];
});

/* ============================================================
   DOODLE BUDDY — scroll companion that reacts per section.
   ---- TO ADD A NEW SECTION: add ONE line to SCENES below. ----
   See ANIMATIONS.md for the full architecture.
   ============================================================ */
const _H = `<path d="M50 6 Q53 1 56 5"/><circle cx="50" cy="22" r="15"/><circle class="fc" cx="45" cy="20" r="1.7"/><circle class="fc" cx="55" cy="20" r="1.7"/><path d="M45 27 Q50 31 55 27"/>`;
const _B = `<path d="M50 37 V72"/>`;
const _L = `<g class="legL"><path d="M50 72 L41 100"/><path d="M41 100 l-6 1"/></g><g class="legR"><path d="M50 72 L59 100"/><path d="M59 100 l6 1"/></g>`;
const _SIT = `<g class="sitLower"><path d="M50 62 Q33 77 27 87 Q44 85 50 82 Q56 85 73 87 Q67 77 50 62 Z"/></g>`;
const POSES = {
  draw: `<svg viewBox="0 0 100 110">${_H}${_B}${_L}<path d="M50 46 L34 60"/><g class="scribble"><path d="M50 46 L72 56"/><path d="M72 56 L83 62"/></g><path class="spark" d="M82 66 q6 0 4 6"/></svg>`,
  build: `<svg viewBox="0 0 100 110">${_H}${_B}<path d="M50 72 L42 96"/><path d="M50 72 L58 96"/><path class="fc2" d="M28 99 H72"/><path d="M36 97 H64 L68 85 H32 Z"/><path d="M35 85 V73 H65 V85"/><path class="fc2" d="M40 78 H60 M40 81 H53"/><g class="type"><path d="M50 46 L41 84"/><path d="M50 46 L59 84"/></g></svg>`,
  read: `<svg viewBox="0 0 100 110"><path d="M50 6 Q53 1 56 5"/><g class="nod"><circle cx="50" cy="22" r="14"/><circle class="fc" cx="45" cy="22" r="1.7"/><circle class="fc" cx="55" cy="22" r="1.7"/><path d="M45 28 Q50 31 55 28"/></g><path d="M50 36 V62"/>${_SIT}<g><path d="M35 54 L50 50 L65 54 L65 70 L50 66 L35 70 Z"/><path d="M50 50 V66"/><path class="page" d="M50 52 L62 55 L62 64 L50 62 Z"/></g><path d="M50 44 L37 56"/><path d="M50 44 L63 56"/></svg>`,
  sit: `<svg viewBox="0 0 100 110">${_H}<path d="M50 37 V62"/>${_SIT}<path d="M50 46 L38 58"/><path d="M50 46 L62 58"/></svg>`,
  land: `<svg viewBox="0 0 100 110">${_H}<path d="M50 37 V56"/><path d="M50 56 L37 68 L40 88"/><path d="M40 88 l-6 2"/><path d="M50 56 L63 68 L60 88"/><path d="M60 88 l6 2"/><path d="M50 43 L33 49"/><path d="M50 43 L67 49"/><path class="spark" d="M28 92 l-7 4 M72 92 l7 4 M50 97 l0 7"/></svg>`,
  play: `<svg viewBox="0 0 100 110">${_H}${_B}${_L}<path class="ctrl" d="M37 59 q13 -5 26 0 q5 7 -1 11 q-7 -2 -12 -2 q-5 0 -12 2 q-6 -4 -1 -11 Z"/><circle class="fc" cx="45" cy="64" r="1.4"/><circle class="fc" cx="55" cy="64" r="1.4"/><g class="mash"><path d="M50 46 L42 60"/><path d="M50 46 L58 60"/></g></svg>`,
  wait: `<svg viewBox="0 0 100 110">${_H}${_B}<path d="M50 72 L41 100"/><path d="M41 100 l-6 1"/><g class="tap"><path d="M50 72 L59 98"/><path d="M59 98 l6 1"/></g><path d="M50 46 L36 58"/><g class="wave"><path d="M50 46 L66 32"/></g><path class="fc2" d="M70 26 l4 -3 M71 30 l4 0"/></svg>`,
  walk: `<svg viewBox="0 0 100 110">${_H}${_B}<g class="legA"><path d="M50 72 L44 100"/><path d="M44 100 l-6 1"/></g><g class="legB"><path d="M50 72 L56 100"/><path d="M56 100 l6 1"/></g><g class="armA"><path d="M50 46 L41 64"/></g><g class="armB"><path d="M50 46 L59 64"/></g></svg>`,
  climb: `<svg viewBox="0 0 100 120"><path class="rope" d="M52 -34 V42"/>${_H}<path d="M50 37 V72"/><g class="reachA"><path d="M50 45 L53 22"/></g><g class="reachB"><path d="M50 47 L52 34"/></g><path d="M50 72 L43 94 l-5 -5"/><path d="M50 72 L57 93 l5 -5"/></svg>`,
  para: `<svg viewBox="0 0 120 152"><g class="sway"><path d="M16 42 Q60 -18 104 42 Z"/><path d="M16 42 Q60 30 104 42"/><path d="M30 42 L52 80 M50 42 L57 80 M70 42 L63 80 M90 42 L68 80"/><g transform="translate(10,58)">${_H}${_B}<path d="M50 72 L42 98"/><path d="M50 72 L58 98"/><path d="M42 98 l-5 1"/><path d="M58 98 l5 1"/><path d="M50 46 L40 60"/><path d="M50 46 L60 60"/></g></g></svg>`,
};
window.__POSES = POSES;  // debug hook

/* INTERACTION HOOK: a scene's drive(bw,bh) returns the exact screen point to hold.
   Work rides the leading tip of the timeline spine so the kid "draws" it. */
function driveSpine(bw, bh) {
  const path = document.querySelector('.spine path'); if (!path) return null;
  const total = path.getTotalLength();
  const off = parseFloat(getComputedStyle(path).strokeDashoffset) || 0;
  const drawn = clamp(total - off, 0, total);
  const pt = path.getPointAtLength(drawn);
  const m = path.getScreenCTM(); if (!m) return null;
  return { x: pt.x * m.a + pt.y * m.c + m.e - bw * 0.17, y: pt.x * m.b + pt.y * m.d + m.f - bh * 0.56, face: -1 };
}

/* One line per section. sel=activating section, target=element to travel to (or
   drive fn), anchor=right|left|sit-top|below, face, pose, line, attached, travel, color. */
const SCENES = [
  { sel: '#hero',       target: '.name-underline',     anchor: 'right',   face: 'left',  pose: 'draw',  line: 'lemme sign that ✎' },
  { sel: '#about',      target: '#about .section-tag', anchor: 'right',   face: 'left',  pose: 'sit',   line: 'a bit about me…' },
  { sel: '#experience', target: '.exp-row',            anchor: 'left',    face: 'right', pose: 'build', line: 'the path so far' },
  { sel: '#github',     target: '.github-grid',        anchor: 'left',    face: 'right', pose: 'build', line: 'open source ↓' },
  { sel: '#manifesto',  target: '.manifesto-quote',    anchor: 'right',   face: 'left',  pose: 'sit',   line: 'words to code by' },
  { sel: '#work',       drive: driveSpine, attached: true,                face: 'left',  pose: 'draw',  line: 'drawing it in…' },
  { sel: '#books',      target: '.books-grid',         anchor: 'sit-top', face: 'right', pose: 'read',  line: 'one more chapter…', travel: 'para', color: '#e4572e' },
  { sel: '#games',      target: '.corkboard',          anchor: 'left',    face: 'right', pose: 'play',  line: 'GG! 🎮' },
  { sel: '#gallery',    target: '.gallery-grid',       anchor: 'right',   face: 'left',  pose: 'wait',  line: 'snapshots 📸' },
  { sel: '#contact',    target: '.foot-big',           anchor: 'right',   face: 'left',  pose: 'wait',  line: 'say hello 👋' },
];

const buddyEl = document.querySelector('.buddy');
const buddyFlip = buddyEl.querySelector('.buddy-flip');
const buddyFig = buddyEl.querySelector('.buddy-fig');
const buddySay = buddyEl.querySelector('.buddy-say');
const TRAVEL = new Set(['walk', 'climb', 'para']);
let curPose = '';
function setPose(p, line) {
  if (p !== curPose) {
    const fromTravel = TRAVEL.has(curPose) && !TRAVEL.has(p);
    curPose = p; buddyFig.dataset.pose = p;
    buddyFig.innerHTML = POSES[p] || '';
    buddyFig.classList.remove('pop', 'land');
    void buddyFig.offsetWidth;
    buddyFig.classList.add(fromTravel ? 'land' : 'pop');  // instant swap; squash is the transition
  }
  buddySay.textContent = line || '';
  buddySay.style.display = line ? 'block' : 'none';
}
const active = { el: null, drive: null, anchor: 'right', face: 1, pose: 'draw', line: '', attached: false, travel: null, traveling: false, mode: null, landUntil: 0 };
function setScene(s) {
  active.el = s.target ? document.querySelector(s.target) : document.querySelector(s.sel);
  active.drive = s.drive || null;
  active.anchor = s.anchor || 'right';
  active.face = (s.face === 'left') ? -1 : 1;
  active.pose = s.pose; active.line = s.line; active.attached = !!s.attached;
  active.travel = s.travel || null;
  active.traveling = !active.attached;
  active.mode = null;
  active.landUntil = 0;
  if (s.color) buddyEl.style.setProperty('--buddy-ink', s.color);
  else buddyEl.style.removeProperty('--buddy-ink');
  buddyFlip.style.transform = `scaleX(${active.face})`;
  setPose(s.pose, s.line);
}
function anchorPos(name, r, bw, bh) {
  const cx = r.left + r.width / 2;
  switch (name) {
    case 'sit-top': return { x: cx - bw / 2,     y: r.top - bh * 0.78 };
    case 'left':    return { x: r.left - bw - 8, y: r.top + r.height / 2 - bh / 2 };
    case 'below':   return { x: cx - bw / 2,     y: r.bottom - bh * 0.2 };
    case 'right':
    default:        return { x: r.right + 8,     y: r.top + r.height / 2 - bh / 2 };
  }
}
setScene(SCENES[0]);

if (prefersReduced) {
  /* reveal everything, skip animations + buddy */
  document.querySelectorAll('.anno').forEach(a => a.style.opacity = 1);
  const pre = document.querySelector('.preloader'); if (pre) pre.classList.add('done');
} else {
  /* ---- Lenis smooth scroll ---- */
  const lenis = new Lenis({ lerp: .09 });
  function raf(t) { lenis.raf(t); requestAnimationFrame(raf); } requestAnimationFrame(raf);
  gsap.registerPlugin(ScrollTrigger);
  lenis.on('scroll', ScrollTrigger.update);

  /* ---- animated background parallax ---- */
  const bgItems = [...document.querySelectorAll('.bg-item')];
  const paperLines = document.querySelector('.paper-lines');
  lenis.on('scroll', ({ scroll }) => {
    bgItems.forEach(el => { el.style.transform = `translateY(${scroll * parseFloat(el.dataset.spd)}px)`; });
    if (paperLines) paperLines.style.transform = `translateY(${(scroll * 0.06) % 34}px)`;
  });

  /* ---- pen-nib cursor + ink trail ---- */
  const nib = document.querySelector('.nib'), dot = document.querySelector('.ink-dot');
  let mx = innerWidth / 2, my = innerHeight / 2, tx = mx, ty = my;
  addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; nib.style.transform = `translate(${mx - 3}px,${my - 2}px) rotate(-35deg)`; });
  (function trail() { tx += (mx - tx) * .18; ty += (my - ty) * .18; dot.style.left = tx + 'px'; dot.style.top = ty + 'px'; requestAnimationFrame(trail); })();

  /* ---- preloader: draw squiggle + count ---- */
  const pre = document.querySelector('.preloader'), num = document.querySelector('.preloader-num');
  const squig = pre.querySelector('.squig');
  gsap.to(squig, { strokeDashoffset: 0, duration: 1.4, ease: 'power1.inOut' });
  let c = { v: 0 };
  gsap.to(c, {
    v: 100, duration: 1.4, ease: 'power1.inOut',
    onUpdate: () => num.textContent = Math.round(c.v) + '%',
    onComplete: () => { pre.classList.add('done'); startHero(); }
  });

  /* ---- HERO reveal ---- */
  function startHero() {
    buddyEl.classList.add('show');
    const tl = gsap.timeline();
    tl.to('.hero h1 .reveal', { clipPath: 'inset(0 0% 0 0)', duration: .7, stagger: .18, ease: 'power3.out' })
      .to('.name-underline path', { strokeDashoffset: 0, duration: .7, ease: 'power2.out' }, '-=.2')
      .to('.anno', { opacity: 1, duration: .5, stagger: .15 }, '-=.3')
      .to('.anno .arrow path', { strokeDashoffset: 0, duration: .6, stagger: .15 }, '<');
  }

  /* ---- generic fade-up reveals ---- */
  gsap.utils.toArray('.r-up').forEach(el => gsap.from(el, { y: 40, opacity: 0, duration: .7, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 85%' } }));
  gsap.utils.toArray('.exp-row').forEach(el => gsap.from(el, { x: -30, opacity: 0, duration: .5, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));
  gsap.utils.toArray('.skill-pill').forEach((el, i) => gsap.from(el, { scale: 0, opacity: 0, duration: .4, ease: 'back.out(2)', scrollTrigger: { trigger: '.skills-cloud', start: 'top 85%' }, delay: i * .04 }));
  gsap.utils.toArray('.github-card').forEach(el => gsap.from(el, { y: 40, opacity: 0, duration: .6, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));
  gsap.utils.toArray('.gallery-item').forEach(el => gsap.from(el, { y: 50, opacity: 0, scale: .92, duration: .6, ease: 'back.out(1.4)', scrollTrigger: { trigger: el, start: 'top 88%' } }));

  /* ---- WORK timeline: spine + nodes + cards draw/rise on scroll ---- */
  gsap.to('.spine path', { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.timeline', start: 'top 70%', end: 'bottom 80%', scrub: .6 } });
  gsap.utils.toArray('.t-node circle').forEach(c => gsap.to(c, { strokeDashoffset: 0, duration: .5, scrollTrigger: { trigger: c, start: 'top 85%' } }));
  gsap.utils.toArray('.card').forEach(card => gsap.from(card, { y: 40, opacity: 0, duration: .6, ease: 'power2.out', scrollTrigger: { trigger: card, start: 'top 88%' } }));

  /* ---- BOOKS: parallax columns + velocity skew + per-card 3D entrance ---- */
  if (window.innerWidth > 900) {
    gsap.utils.toArray('.book-col').forEach((col, i) => {
      const dir = i % 2 === 0 ? -1 : 1;
      gsap.to(col, { yPercent: dir * (8 + i * 4), ease: 'none', scrollTrigger: { trigger: '.books', start: 'top bottom', end: 'bottom top', scrub: 1 } });
    });
    const grid = document.querySelector('.books-grid');
    lenis.on('scroll', ({ velocity }) => {
      gsap.to(grid, { skewY: gsap.utils.clamp(-8, 8, velocity * .4), duration: .3, overwrite: true });
    });
  }
  gsap.utils.toArray('.book-card:not(.hidden-book)').forEach(b => gsap.from(b, { rotateX: 35, y: 50, opacity: 0, transformPerspective: 600, ease: 'power2.out', scrollTrigger: { trigger: b, start: 'top 95%', end: 'top 60%', scrub: .8 } }));

  /* ---- GAMES: polaroids settle in with a pin-drop ---- */
  gsap.utils.toArray('.polaroid').forEach((p, i) => {
    const rot = gsap.getProperty(p, 'rotation') || 0;
    gsap.from(p, { y: -60, opacity: 0, rotation: rot + (i % 2 ? 12 : -12), duration: .7, ease: 'back.out(1.6)', scrollTrigger: { trigger: '.corkboard', start: 'top 75%' }, delay: i * .12 });
  });

  /* ---- PARALLAX visual ---- */
  gsap.to('.parallax-image', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.visual-section', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ---- scattered doodles: self-draw when scrolled into view ---- */
  gsap.utils.toArray('.doodle').forEach(d => {
    const paths = d.querySelectorAll('.draw'), fills = d.querySelectorAll('.fill');
    gsap.set(d, { opacity: 0 });
    ScrollTrigger.create({
      trigger: d, start: 'top 94%', once: true, onEnter: () => {
        gsap.to(d, { opacity: .9, duration: .3 });
        gsap.to(paths, { strokeDashoffset: 0, duration: .7, ease: 'power1.inOut', stagger: .08 });
        gsap.from(fills, { scale: 0, transformOrigin: 'center', duration: .3, delay: .5, stagger: .05 });
      }
    });
  });

  /* ---- magnetic buttons ---- */
  document.querySelectorAll('.magnetic-btn').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      gsap.to(btn, { x: (e.clientX - r.left - r.width / 2) * .4, y: (e.clientY - r.top - r.height / 2) * .4, duration: .3 });
    });
    btn.addEventListener('mouseleave', () => gsap.to(btn, { x: 0, y: 0, duration: .5, ease: 'elastic.out(1,.3)' }));
  });

  /* ---- buddy roams: glide toward target, picking how it travels ---- */
  let bx = window.innerWidth * 0.5, by = window.innerHeight * 0.5;
  (function follow() {
    const bw = buddyEl.offsetWidth || 118, bh = buddyEl.offsetHeight || 118;
    let x, y, face = active.face;
    if (active.drive) { const p = active.drive(bw, bh); if (p) { x = p.x; y = p.y; if (p.face !== undefined) face = p.face; } }
    if (x === undefined && active.el) { const r = active.el.getBoundingClientRect(); ({ x, y } = anchorPos(active.anchor, r, bw, bh)); }
    if (x !== undefined) {
      x = clamp(x, 6, window.innerWidth - bw - 6);
      y = clamp(y, 66, window.innerHeight - bh - 10);
      const dx = x - bx, dy = y - by, dist = Math.hypot(dx, dy);
      bx += dx * 0.09; by += dy * 0.09;
      buddyEl.style.left = bx + 'px'; buddyEl.style.top = by + 'px'; buddyEl.style.bottom = 'auto';

      if (active.attached) {
        setPose(active.pose, active.line);
        buddyFlip.style.transform = `scaleX(${face})`;
      } else if (active.traveling) {
        if (dist < 40) {
          active.traveling = false;
          active.landUntil = (active.mode === 'para' || active.mode === 'climb') ? performance.now() + 520 : 0;
        } else {
          if (!active.mode) {
            active.mode = (active.travel && dy > 30) ? active.travel
              : (dy > 150 ? 'para' : (dy < -50 ? 'climb' : 'walk'));
          }
          setPose(active.mode, '');
          buddyFlip.style.transform = (active.mode === 'walk') ? `scaleX(${dx < 0 ? -1 : 1})` : 'scaleX(1)';
        }
      } else if (performance.now() < active.landUntil) {
        setPose('land', '');
        buddyFlip.style.transform = `scaleX(${active.face})`;
      } else {
        setPose(active.pose, active.line);
        buddyFlip.style.transform = `scaleX(${active.face})`;
      }
    }
    requestAnimationFrame(follow);
  })();

  /* ---- buddy reacts to each section (driven by SCENES) ---- */
  SCENES.forEach(s => {
    const el = document.querySelector(s.sel);
    if (!el) return;
    ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 45%', onEnter: () => setScene(s), onEnterBack: () => setScene(s) });
  });

  ScrollTrigger.refresh();
  addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
}
