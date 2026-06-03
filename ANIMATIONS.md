# ANIMATIONS.md — Doodle-buddy animation & transition system

The single source of truth for the hand-drawn **doodle-buddy** (the scroll-companion "kid")
and how it animates, travels, transitions, and reacts per section. Read this before adding or
changing any buddy animation.

## Status & location

- **PORTED into production.** The buddy + sketchbook design now live in the real site:
  `index.html` (buddy node + scaffolding), `style.css`, and `script.js`. Content is wired to
  `config.json` through the usual `{{TOKENS}}`; the Work (`{{WORK_SLIDES}}` → timeline) and Games
  (`{{STEAM_GAMES}}` → corkboard) loop templates were updated in **both `server.js` and `build.js`**.
- **`prototype-sketchbook.html` is kept as the design reference / scratchpad** — it is standalone and
  not part of the build. Prefer prototyping buddy changes there first, then porting.
- Reminder (CLAUDE.md constraint): any change to a loop-rendered section's markup must be mirrored in
  **both `server.js` (`renderIndex()`) and `build.js` (`build()`)**; CSS/JS-only changes need editing
  just `style.css` / `script.js` (both renderers copy them verbatim).

## Mental model

The buddy is a fixed-position SVG character that follows the scroll. As each section becomes active it:
1. **travels** there (walks for short hops, rope-**climbs** when going up, **parachutes** for long drops),
2. plays a brief **landing** crouch when it touches down from the air/rope, then
3. settles into that section's **pose** (drawing, reading, gaming, waving…),
4. or — for sections with a `drive()` hook — stays **attached** and *authors* the section's own animation
   (e.g. it rides the leading tip of the Work timeline so it looks like the kid is drawing the line).

## DOM structure — four nested wrappers (do NOT collapse them)

```html
<div class="buddy">                <!-- position: fixed; moved via inline left/top -->
  <div class="buddy-say">…</div>   <!-- speech bubble — OUTSIDE buddy-flip on purpose -->
  <div class="buddy-flip">         <!-- facing direction: transform: scaleX(±1) -->
    <div class="buddy-bob">        <!-- idle vertical bob -->
      <div class="buddy-fig"></div><!-- holds the pose SVG; gets .pop / .land squash -->
    </div>
  </div>
</div>
```

Each layer owns exactly one transform so they don't fight:
- **`.buddy`** — screen position (`left`/`top`, set every frame by the follow loop).
- **`.buddy-flip`** — horizontal facing (`scaleX`). **Facing MUST live here and nowhere else** — putting
  `scaleX` higher up would mirror the speech-bubble text; putting it on `.buddy-fig` would be overridden
  by the pop/land animation.
- **`.buddy-bob`** — the gentle idle bob.
- **`.buddy-fig`** — the pose itself; `.pop`/`.land` entrance animations run here (`transform-origin: 50% 100%`).

## POSES — the character art

`POSES` is an object of **inline-SVG strings keyed by name**. Bodies are assembled from shared fragments
so poses stay consistent:
- `_H` head (+ cowlick + eyes `.fc` + smile), `_B` straight body, `_L` standing legs (idle weight-shift),
  `_SIT` folded sitting legs.

Current poses: `draw` (signing), `build` (laptop), `read` (sitting + open book), `sit`, `land`
(landing crouch), `play` (controller), `wait` (waving), `walk`, `climb` (rope), `para` (parachute).

Within a pose, **moving parts are animated by CSS classes** using the
`transform-box: fill-box; transform-origin: …` convention. Action classes: `.scribble`, `.type`, `.nod`,
`.mash`, `.wave`, `.tap`, `.page`, `.legL/.legR` (idle legs), `.sitLower`, `.legA/.legB/.armA/.armB`
(walk stride/swing), `.reachA/.reachB` (climb), `.sway` (parachute), `.rope`.
Accent strokes use classes `.spark`, `.page`, `.ctrl` (marker red); `.fc` = filled eyes, `.fc2` = faded.

**To add a pose:** add one `POSES` entry. Reuse `_H`/`_B`/`_L`/`_SIT` and wrap any moving limb in a `<g>`
with an existing action class (or add a new class + `@keyframes`). **Any new animation class MUST also be
added to the `@media (prefers-reduced-motion: reduce)` `animation: none` rule.**

## SCENES — one line per section (the extensibility contract)

`SCENES` is an array with **one entry per page section**. Adding a section = adding one line.

| field       | meaning |
|-------------|---------|
| `sel`       | section selector whose scroll range activates this scene (ScrollTrigger `top 55% / bottom 45%`). |
| `target`    | element the buddy travels to / perches on. |
| `drive`     | OR a function `drive(bw,bh) → {x,y,face}` that returns the exact screen point each frame (see below). `attached:true` goes with this. |
| `anchor`    | where it perches relative to `target`: `right` (default), `left`, `sit-top`, `below`. |
| `face`      | `'left'` or `'right'` resting facing. |
| `pose`      | a key in `POSES`. |
| `line`      | speech-bubble text (`''`/omitted = no bubble). |
| `attached`  | `true` = skip travel, stay in `pose` and ride the live `drive`/`target`. |
| `travel`    | force a travel mode toward this section (e.g. `'para'` for Books) when moving *down* into it. |
| `color`     | optional `--buddy-ink` override for sections where the default ink blends in (Books uses `#e4572e`). |

## The follow loop — state machine

A single `requestAnimationFrame` loop:
1. Resolves a target point: `active.drive(bw,bh)` if present, else `anchorPos(anchor, targetRect, …)`.
2. Clamps it on-screen and **lerps** the buddy toward it (`bx/by += d*0.09`).
3. Picks behaviour by state:

```
attached            → hold pose, ride the target (drive owns position + facing)
traveling           → walk / climb / para until arrival (dist < 40 px)
landing (timed)     → hold the crouch ~520 ms after an airborne arrival
settled             → hold the section pose
```

`anchorPos` modes: `sit-top` (above target — used for reading on the shelf), `left`, `below`,
`right` (default).

### Invariants — the rules that keep it from breaking (and the bug each prevents)

- **Latch the travel mode once per trip** (`active.mode`, reset in `setScene`). *Recomputing the mode every
  frame let `dy` jitter across the para/climb/walk thresholds as the target moved → the pose flipped every
  frame → the CSS animation restarted every frame → it looked frozen. This was the original "animations
  don't work" bug.*
- **Hold timed states on wall-clock, never frame counts** (`active.landUntil = performance.now() + 520`).
  *rAF is uncapped in headless and runs at 120 fps on some monitors, so a "30-frame" hold collapses to ~125 ms.
  Use `performance.now()`, not a frame counter.*
- **`setPose` swaps `innerHTML` instantly; the `.pop`/`.land` squash IS the transition.** *An earlier attempt
  faded the figure to opacity 0, swapped, then faded back — a fade-to-blank reads as a flicker, not a
  transition, and it ate short-held poses (the landing crouch). No blank frames.*
- **Arrival threshold is `dist < 40`.** Below it, `traveling` latches off and (if the mode was `para`/`climb`)
  the landing crouch is queued.
- **Per-scene recolor via `--buddy-ink`** (set/cleared in `setScene` from `scene.color`); the buddy SVG strokes
  and `.fc` fills read `var(--buddy-ink, var(--ink))`. A faint **paper-colored `drop-shadow` halo** on
  `.buddy svg` keeps the kid legible over any busy cover/background.

## Transitions in detail

- **`pop`** — the default entrance squash on any pose change (`scale .88 → 1.06 → 1`).
- **`land`** — a stronger **drop-and-squash** used only when coming *out of* a travel pose (`para`/`climb`/`walk`,
  the `TRAVEL` set) *into* a grounded pose. Paired with a dedicated **crouch pose** (`POSES.land`) held ~520 ms,
  it is the visible bridge "parachute → reading". Tune feel via the `@keyframes land` (currently `.55s`) and the
  `+520` hold in the follow loop's arrival branch.

## drive() interaction hooks — making the kid author a section

A scene's `drive(bw,bh)` returns the screen point (and optional facing) the buddy should hold *this frame*.
`driveSpine` is the reference: it reads how much of the Work timeline path is drawn and parks the kid's pencil
on the leading tip, so scrolling makes the kid appear to draw the line. The SVG-point → screen recipe:

```js
const total = path.getTotalLength();
const drawn = total - (parseFloat(getComputedStyle(path).strokeDashoffset) || 0); // how far it's drawn
const pt = path.getPointAtLength(drawn);            // point in SVG user units
const m  = path.getScreenCTM();                     // SVG → screen matrix
const sx = pt.x*m.a + pt.y*m.c + m.e;               // → screen px
const sy = pt.x*m.b + pt.y*m.d + m.f;
return { x: sx - bw*0.17, y: sy - bh*0.56, face: -1 };
```

To make the kid drive a new section, write a similar function, set `drive` + `attached:true` on the scene.

## Reduced motion & touch

- `prefersReduced` (read once) **skips the entire animation branch** — Lenis, ScrollTrigger, scenes, and the
  follow loop. The buddy is just shown in its initial pose. Keep all buddy animation classes listed in the
  `@media (prefers-reduced-motion: reduce)` `animation: none` rule.
- `@media (hover: none)` restores the native cursor and shrinks the buddy on touch.

## Verification harness (`.agents/`)

The buddy can't be checked by reading code alone — drive a real browser. Scripts use **`puppeteer-core`**
(installed via `npm install puppeteer-core --no-save`) pointed at the **installed Chrome**, headless, and read
back state / screenshots (which can be viewed directly).

```bash
node .agents/inspect-buddy.js       # reader-paced scroll; prints the pose timeline + land-hold durations
node .agents/pose-gallery.js        # renders a labelled grid of every POSE (art sanity check)
node .agents/check-books-color.js   # screenshots the buddy in Books to confirm it isn't blending in
```

Debug hooks baked into the prototype: **`.buddy-fig[data-pose]`** (the live logical pose) and
**`window.__POSES`** (the pose table). Use these instead of guessing the pose from SVG contents.

**Two gotchas that will waste an hour otherwise:**
- Headless Chrome defaults to **`prefers-reduced-motion: reduce`**, which makes the page skip the *entire*
  animation branch (nothing scrolls, no scene switches). Always
  `await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }])` before `goto`.
- **rAF is uncapped in headless** (~240 fps), so any frame-counted timing collapses. This is why buddy timing
  is wall-clock — and why a headless run reports much shorter holds than a real 60 fps screen unless the hold
  is time-based.

## When porting to production (checklist)

- Mirror the buddy HTML node into **both** `server.js` and `build.js`; move CSS → `style.css`, JS → `script.js`.
- Add mobile (`@media (max-width:768px)`) and `prefers-reduced-motion` fallbacks.
- If the buddy's pinned/scroll-triggered pieces sit near other pinned sections, mind the
  `refreshPriority` pin-ordering rule documented in CLAUDE.md.
- Re-run the `.agents` harness against the integrated page.
```
