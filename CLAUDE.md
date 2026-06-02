# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page personal portfolio for Sidharth Parihar. It runs as an Express app for local development/editing, then compiles to a fully static site for free hosting on GitHub Pages. There is no framework and no client-side build step — the frontend is plain HTML/CSS/JS with libraries pulled from CDNs.

## Commands

```bash
npm install        # install dependencies
npm start          # node server.js — dev server at http://localhost:8000 (+ /admin)
npm run build      # node build.js — compiles config.json + index.html into dist/
npm run deploy     # predeploy runs build, then `gh-pages -d dist` pushes dist/ to the gh-pages branch

node scripts/fetch-covers.js        # resolve working book covers into config.json
node scripts/fetch-covers.js --dry  # preview cover changes without writing
```

There are no tests and no linter configured.

Deploy publishes to the `gh-pages` branch, served at `https://pariharsidharth0.github.io/mysite/`. Source code lives on `main` and must be committed separately — deploying does not commit source.

**Deploy on Windows:** `npm run deploy` fails with `error: cannot spawn sh.exe` (a Git config issue with the `gh-pages` package). Deploy manually instead.

The `gh-pages` branch already exists on the remote and holds a snapshot of the **whole repo tree** with the *built* `index.html` at the root — but GitHub Pages only actually serves four artifacts from the root: `index.html`, `script.js`, `style.css`, and `assets/`. So a correct deploy just overwrites those four with a fresh `dist/` build. Run from `main` with a clean working tree (commit source first):

```powershell
# 1. Build, then back dist/ up OUTSIDE the repo (insurance — see gotchas).
npm run build
$tmp = "$env:TEMP\mysite-deploy"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
Copy-Item "dist" $tmp -Recurse

# 2. Switch to gh-pages and sync it to the remote.
git checkout gh-pages
git reset --hard origin/gh-pages

# 3. Overwrite ONLY the served artifacts from the backup, then stage ONLY those.
Copy-Item "$tmp\index.html","$tmp\script.js","$tmp\style.css" "." -Force
Copy-Item "$tmp\assets\*" ".\assets\" -Recurse -Force
git add index.html script.js style.css assets    # NOT `git add -A` — see gotchas

# 4. Commit, push, return to source.
git commit -m "Deploy: <what changed>"
git push origin gh-pages
git checkout main
Remove-Item $tmp -Recurse -Force
```

GitHub Pages rebuilds in ~1–2 min (it lags — poll the live URL for the change rather than trusting an immediate reload). Confirm before declaring success.

**Gotchas that the old `git checkout --orphan gh-pages` + `git rm -rf .` recipe got wrong:**
- `git rm -rf .` deletes `dist/` itself before you can copy from it — hence the step-1 backup to `$env:TEMP` outside the repo.
- `git rm -rf .` also removes `.gitignore`, so a subsequent `git add -A` happily stages `node_modules/` (and chokes on the embedded git repos under `node_modules/.cache/gh-pages/`). Staging only the four served paths avoids this entirely.
- `--orphan` is for *creating* a branch; `gh-pages` already exists, so check it out and `reset --hard origin/gh-pages` instead.

## Architecture

**`config.json` is the single source of truth.** All site content — hero text, about/manifesto copy, experience, skills, GitHub projects, Steam games, gallery, books, contact links — lives here. `index.html` is a template containing `{{PLACEHOLDER}}` tokens; the content is injected at render time.

**Two renderers produce the same HTML and MUST stay in sync:**
- `server.js` → `renderIndex()` renders on the fly for local dev.
- `build.js` → `build()` renders once into `dist/` for deployment.

These two functions contain **duplicated, hand-copied template logic**. Any change to how a section renders (new placeholder, restructured book/slide/card markup, new config field) must be made in **both** files, or local and deployed output will diverge. This is the most important constraint in the repo. `build.js` additionally copies `style.css`, `script.js`, and `assets/` into `dist/` verbatim — so CSS/JS-only changes need editing only the source files (not `build.js`), then a rebuild.

**Token replacement uses single `String.replace()` calls**, so each `{{PLACEHOLDER}}` may appear exactly once in `index.html`. Loop-rendered sections (experience, skills, books, steam, gallery, work slides) are built as concatenated HTML strings and injected into one placeholder each.

**Books rendering has logic worth knowing** (identical in `server.js` and `build.js`): the renderers emit **all** books as a flat list of `.book-card` `<a>` elements into the single `{{BOOKS_ITEMS}}` placeholder, in `config.books` order, each tagged with `data-rating`; index ≥ 20 gets a `hidden-book` class. `highlight: true` adds a `highlight-book` class (renders a "TOP RATED" badge). Each card links to the book's `goodreads_url`, or falls back to a Google search URL when that field is empty.

Everything else about the books grid happens **client-side in `script.js`**, against that flat list (see the Frontend section for the scroll animation):
- A `DOMContentLoaded` IIFE (runs under the preloader, before `initAnimations()`) reorders the cards to preview **6 top-rated + 14 random = 20 visible**, re-applying `hidden-book` to index ≥ 20, then **distributes every card into `.book-col` column wrappers** (4 / 3 / 2 columns by viewport width) so each column can be parallaxed at its own scroll speed. Because distribution is round-robin over the ordered list, hidden books trail the bottom of each column, so "SHOW ALL BOOKS" just reveals them in place.
- So `.books-grid` is **not** a CSS grid — it's a flexbox row of `.book-col` flex-columns, populated by JS. Before JS runs (or with JS disabled) the cards would be unstyled; this is hidden behind the preloader, matching the existing pattern.

**Games / Steam rendering is a pinned horizontal shelf.** The renderers emit large poster `.steam-card`s (cover + `.steam-index` ordinal + title + `.steam-hours`) into `{{STEAM_GAMES}}`, which `index.html` places inside `.steam-pin > .steam-track`. On desktop `script.js` pins `.steam-pin` and pans `.steam-track` sideways on scroll, with a neon `.steam-progress` bar + `.steam-count`. Card markup (now including the loop index and `hours`) lives in **both** `server.js` and `build.js` — keep them in sync. On touch (`max-width: 768px`) the pin is skipped and `.steam-pin` becomes a native horizontal scroll-snap strip (CSS only).

### Book cover resolution

Each book's `cover_image` in `config.json` is a pre-resolved, known-good URL. **`scripts/fetch-covers.js` is the tool that produces those URLs** — run `node scripts/fetch-covers.js` whenever you add or edit books, then rebuild. It rewrites `config.json` in place (use `--dry` to preview).

The non-obvious trap it exists to solve: `covers.openlibrary.org/b/isbn/{isbn}-L.jpg` returns a **blank placeholder image with HTTP 200** when OpenLibrary has no cover for that ISBN — so a tile renders empty and a naive "does the URL resolve?" check passes anyway. The script's per-book resolution order works around this:
1. Direct ISBN cover, validated with `?default=false` (OpenLibrary then 404s instead of serving a blank).
2. OpenLibrary **Search API** by ISBN → `cover_i` → `/b/id/{id}-L.jpg` (finds a cover from *any* edition of the work, so it succeeds even when the exact ISBN has none).
3. OpenLibrary Search by title + author.
4. Google Books (best-effort; its anonymous API frequently returns `429`, so it is only a last resort — do not make it the primary source).

It only overwrites a `cover_image` when it finds something better, and leaves the existing value untouched when all sources miss. A few cover IDs are hand-pinned in `config.json` (the search picked a "cover to be revealed" / wrong-edition image) — prefer pinning a specific `/b/id/{cover_i}-L.jpg` over re-running the script for those.

As a runtime safety net, `script.js` probes each rendered cover and adds a `.cover-missing` class on load failure; `style.css` then shows a styled "NO COVER" tile instead of an empty box. Covers are baked in at build time, so this rarely triggers.

### Goodreads sync

`lib/goodreads.js` scrapes Goodreads' public RSS feeds (`read`, `currently-reading`, `to-read` shelves) for a hardcoded user ID and regex-parses ratings/dates/covers out of the feed description. `server.js` calls `syncGoodreads()` on startup and hourly (1h `CACHE_TTL`).

Sync is **gated by `config.books_sync_source`**: it only runs when that field equals `"goodreads"`. It is currently `"manual"`, so the books list is hand-managed and the sync is effectively disabled. When active, a successful sync **overwrites `config.books` wholesale** and rewrites `config.json`.

### Admin UI

`server.js` exposes a local-only editing API consumed by `admin.html` at `/admin`:
- `GET /api/config` / `POST /api/config` — read/overwrite `config.json`.
- `POST /api/upload` — `multer` image upload into `assets/` (filename prefixed with a timestamp), returns `/assets/<file>`.

These routes exist only in the dev server; the deployed static site has no backend.

### Frontend

`index.html` loads Lenis (smooth scroll), GSAP + ScrollTrigger, and Three.js from CDNs, then `script.js`. `script.js` runs a preloader counter, then `initAnimations()` wires every scroll-triggered reveal, a custom cursor (`cursor: none` globally + a blend-mode dot), a magnetic contact button, the pinned `.center-focus-section` slide sequence, and a Three.js particle-network background.

**Scroll choreography for books & games (in `initAnimations()`):**
- **Books** — each visible cover does a scrubbed 3D entrance (`rotateX`+`y`, tied to scroll), the `.book-col` columns drift at different `yPercent` speeds (parallax depth), and the whole `.books-grid` is skewed by Lenis scroll *velocity* and settles when scrolling stops (wide screens only — disabled under 900px). Because GSAP owns each card's inline `transform`, the book hover is a border/glow, **not** a transform-lift (a transform hover would be overridden).
- **Games** — `.steam-pin` is pinned and `.steam-track` panned horizontally (see Games rendering above).

**Pin-ordering gotcha (important).** There are two pinned ScrollTriggers, and the **work-slides pin is above the games pin on the page but is created *later* in `initAnimations()`**. ScrollTrigger measures pins in *creation* order by default, so without intervention the games pin gets measured before the slides pin has reserved its scroll space — making the games shelf engage far too early and bleed over the books section. The fix is `refreshPriority`: the topmost pin (work slides) gets `refreshPriority: 1`, the games pin `refreshPriority: 0`, so higher-on-page refreshes first. The games pin also uses `anticipatePin: 1`, and `initAnimations()` ends with `ScrollTrigger.refresh()` plus re-refreshes on `window load` and `document.fonts.ready`. **If you add another pinned section, give it a `refreshPriority` consistent with its vertical page order (higher = nearer the top).**

`style.css` is a single stylesheet driven by CSS variables in `:root`. The theme is **dark with a neon-green accent** — `--bg-color` (near-black), `--text-main` (off-white), `--neon-green`, plus `--bg-elevated`, `--border-soft`, and `--neon-glow`. Changing the palette is almost entirely a matter of editing those variables; most components reference them rather than hardcoding colors.

**Client-side-only enhancements (deliberately not templated):** some UI is built/adjusted in `script.js` against the already-rendered DOM so it needs no `{{token}}` and therefore no `server.js`/`build.js` changes:
- The skills marquee — `#skills-marquee` is an empty placeholder in `index.html`; `script.js` fills it by reading the rendered `.skill-pill` text (so it stays in sync with `config.skills` for free).
- The "DOWNLOAD CV" button is hidden by `script.js` when `cv_url` is `"#"` or empty.
- The books "Show all" toggle is wired near the top of the `DOMContentLoaded` handler (outside `initAnimations()`) so it works even when animations are skipped.

When adding similar surface-level UI, prefer this DOM-side approach over introducing a new placeholder, to keep the two renderers in sync effortlessly.

**Accessibility / performance:** `script.js` reads `prefers-reduced-motion` once (`prefersReduced`); when set, `initAnimations()` reveals content immediately instead of animating and the particle background renders a single static frame. `style.css` mirrors this with `@media (prefers-reduced-motion: reduce)` and a `@media (hover: none)` block that restores the native cursor on touch devices. The Three.js loop pre-allocates its line buffer (no per-frame geometry churn), caps particle count on small screens, and pauses on `visibilitychange` when the tab is hidden.
