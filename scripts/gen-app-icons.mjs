// gen-app-icons.mjs — regenerate the PWA icons, the favicon and the iOS launch
// (apple-touch-startup-image) splash screens from the app's OWN stylesheet, so the
// launcher icon is literally a selected note tile: same border, fill, glow, corner
// radius, glyph weight and app background as a tile you light up mid-solve.
//
// It does NOT redraw the tile. It loads ToneSearch's real CSS into headless Chromium,
// builds a real `<div class="cell selected">` with a `TS` glyph, and screenshots
// it. So the mark cannot drift from the game — restyle `.cell.selected` and the
// icons follow on the next run. (This is why the dep is Playwright, not an image
// library: only a browser can apply the app's real CSS.)
//
// Build-time only. Run:
//   npx playwright install chromium   # once
//   npm run gen:icons
// then paste the printed <link> block into index.html's <head> if the splash
// buckets changed.
//
// FONT: the app's glyphs use `system-ui`, which resolves per platform — SF Pro on
// macOS/iOS, Segoe UI on Windows, whatever fontconfig picks on Linux. The icon is
// a baked PNG, so it freezes whichever font the MACHINE RUNNING THIS SCRIPT has.
// Run it on macOS to match what iOS/Mac players see. The script prints the family
// it actually resolved so a surprise is visible rather than silent.

import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Which app's icons to write. Both by default; `--app=scribe` for one, so a run
// on a machine with the wrong fonts cannot quietly replace the other app's set.
const ONLY = /--app=(\w+)/.exec(process.argv.join(' '))?.[1];
const APPS = ONLY ? [ONLY] : ['search', 'scribe'];

// The glyph on the mark. Two chars, like the widest in-game labels (A♭, d5, m3).
const MARK_TEXT = 'TS';

// Geometry of a real target diamond, from render.ts. The tile is built at this
// true in-app size and then scaled up as a whole, so the 1.5px border, the 4px
// radius and the 14px glow keep their real proportions instead of turning into
// hairlines on a 1024px canvas.
const CELL_FILL = 0.9; // render.ts CELL_FILL
const TOKEN_PITCH_MAX = 78; // render.ts TOKEN_PITCH_MAX
const REF_SIDE = (CELL_FILL * TOKEN_PITCH_MAX) / Math.SQRT2; // ≈ 49.6px square side
const REF_DIAG = REF_SIDE * Math.SQRT2; // ≈ 70.2px point-to-point, the visual width
const GLYPH_RATIO = 0.42; // render.ts: fontPx = side * 0.42

// The same files each app itself loads: shared structure, then its palette,
// in that order — so the icon cannot drift from the running game.
const cssFor = async (app) =>
  (
    await Promise.all(
      ['src/shell/base.css', `src/${app}/theme.css`].map((f) => readFile(join(ROOT, f), 'utf8')),
    )
  ).join('\n');

// ToneScribe's mark is a clef, not a lettered tile. Two apps whose icons both
// read "TS" would be indistinguishable on a home screen, and the clef says what
// the app is at a glance.
const { TREBLE_CLEF } = await import(`file://${join(ROOT, 'src/scribe/clef-paths.ts')}`)
  .catch(async () => {
    // clef-paths.ts is TypeScript; it holds only string constants, so pull the
    // literal out rather than adding a TS loader to a build-time script.
    const src = await readFile(join(ROOT, 'src/scribe/clef-paths.ts'), 'utf8');
    const m = /export const TREBLE_CLEF =\s*'([^']*)'/.exec(src);
    if (!m) throw new Error('could not read TREBLE_CLEF from src/scribe/clef-paths.ts');
    return { TREBLE_CLEF: m[1] };
  });

/**
 * The page: the app's real stylesheet, one real `.cell.selected`, on the app's
 * real body background. `markFrac` is the diamond's point-to-point width as a
 * fraction of the canvas's shorter side.
 */
const page = (app, css, w, h, markFrac, nudgeX = 0) => {
  const body =
    app === 'scribe'
      ? // The clef is authored with the staff at y 20…60 and spans y 6…77; centre
        // that span and scale it to markFrac of the canvas.
        `<svg class="mark" viewBox="0 4 30 76" width="${Math.min(w, h) * markFrac * 0.42}">` +
        `<path d="${TREBLE_CLEF}" transform="translate(-1 0)"/></svg>`
      : `<div class="mark"><div class="cell selected"><span class="glyph">${MARK_TEXT}</span></div></div>`;
  const scale = (Math.min(w, h) * markFrac) / REF_DIAG;
  const fontPx = REF_SIDE * GLYPH_RATIO;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${css}
/* --- icon harness (not part of the app) --- */
html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
body { display: grid; place-items: center; }
/* Scale the finished tile as a unit so border width, corner radius and glow
   stay in the same ratio to the tile as they are in the running game. */
.mark { transform: scale(${app === 'scribe' ? 1 : scale}); transform-origin: center; }
.mark .cell { position: relative; width: ${REF_SIDE}px; height: ${REF_SIDE}px; }
/* The translate sits before the counter-rotation, and the cell's own +45°
   cancels the glyph's -45°, so this reads as a straight sideways shift on
   screen rather than a diagonal one. */
.mark .glyph {
  font-size: ${fontPx}px;
  transform: rotate(-45deg) translateX(${nudgeX * fontPx}px);
}
svg.mark { display: block; height: auto; overflow: visible; }
svg.mark path { fill: var(--neon); }
</style></head><body>
${body}
</body></html>`;
};

/**
 * How far to shift the glyph sideways so its INK is centred, as a fraction of
 * font size.
 *
 * Centring places the text's ADVANCE box, which carries each glyph's side
 * bearings — the built-in space beside the letterforms. Those are asymmetric for
 * a given pair, so "TS" lands with unequal space either side of it: in SF Pro
 * the letters sit ~0.4% of the icon to the right, in DejaVu ~1% to the left.
 * Measure the real ink box and cancel the difference.
 *
 * The vertical twin of this is handled by `text-box` in the app's own
 * stylesheet, which benefits every note label. This one stays here on purpose:
 * the correction is specific to the exact string being set, and the game's
 * labels all differ, so advance-box centring remains right for the app.
 */
async function measureInkNudgeX(tab, css) {
  const PROBE = 512;
  const FRAC = 0.64;
  const scale = (PROBE * FRAC) / REF_DIAG;
  const fontPx = REF_SIDE * GLYPH_RATIO * scale; // font size in probe pixels

  await tab.setViewportSize({ width: PROBE, height: PROBE });
  let nudge = 0;
  for (let pass = 0; pass < 4; pass++) {
    await tab.setContent(page('search', css, PROBE, PROBE, FRAC, nudge), { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    const shot = await tab.screenshot({ type: 'png' });
    // Read the painted result back: white-ish pixels are the letters, purple ones
    // (green channel clearly below red/blue) are the diamond. Canvas TextMetrics
    // is not reliable enough here — Chrome reports actualBoundingBoxLeft as 0 for
    // fonts where it plainly isn't, which corrects by only half the real error.
    const off = await tab.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const centreX = (hit) => {
        let lo = Infinity;
        let hi = -Infinity;
        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++) {
            const i = (y * c.width + x) * 4;
            if (hit(d[i], d[i + 1], d[i + 2])) {
              if (x < lo) lo = x;
              if (x > hi) hi = x;
            }
          }
        }
        return (lo + hi) / 2;
      };
      const text = centreX((r, g, b) => r > 185 && g > 185 && b > 185);
      const diamond = centreX((r, g, b) => r > 150 && b > 200 && g < 150);
      return text - diamond; // + means the letters sit right of the tile
    }, `data:image/png;base64,${shot.toString('base64')}`);

    if (Math.abs(off) <= 0.5) break; // sub-pixel: as centred as the raster allows
    nudge -= off / fontPx;
  }
  return nudge;
}

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const tab = await browser.newPage();

/**
 * The font the glyph was actually PAINTED with.
 *
 * `getComputedStyle().fontFamily` only echoes the authored stack, so it reads
 * the same on every machine and would never reveal that `system-ui` resolved to,
 * say, DejaVu Sans instead of SF Pro. CDP reports the real resolved faces, which
 * is the whole point of logging this — the PNGs bake in whatever wins here.
 */
async function paintedFont() {
  const cdp = await tab.context().newCDPSession(tab);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.glyph' });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  await cdp.detach();
  return fonts.map((f) => `${f.familyName} (${f.glyphCount} glyphs)`).join(', ') || 'unknown';
}

for (const app of APPS) {
  const css = await cssFor(app);
  const isSearch = app === 'search';
  const dir = isSearch ? 'public' : 'public-scribe';
  // Only the lettered tile needs the side-bearing correction; a clef has no
  // advance box to fight.
  const nudgeX = isSearch ? await measureInkNudgeX(tab, css) : 0;

  let reportedFont = null;
  const render = async (w, h, markFrac, file) => {
    await tab.setViewportSize({ width: w, height: h });
    await tab.setContent(page(app, css, w, h, markFrac, nudgeX), { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    if (isSearch) {
      // Weight too: a stack whose faces stop at 400/700 snaps 600 up to 700.
      reportedFont ??= `${await paintedFont()} @ ${await tab.evaluate(
        () => getComputedStyle(document.querySelector('.glyph')).fontWeight,
      )}`;
    }
    await tab.screenshot({ path: join(ROOT, file), type: 'png' });
  };

  await mkdir(join(ROOT, dir), { recursive: true });

  // Full-bleed "any" icons: home screen where not masked, app switcher, install
  // dialog. ToneSearch's glow needs room to fall off, so its diamond sits at
  // ~64%; the clef is a quieter shape and can sit a touch larger.
  const any = isSearch ? 0.64 : 0.7;
  await render(192, 192, any, `${dir}/icon-192.png`);
  await render(512, 512, any, `${dir}/icon-512.png`);
  await render(1024, 1024, any, `${dir}/icon-1024.png`);
  await render(180, 180, any - 0.02, `${dir}/apple-touch-icon.png`);

  // Maskable icons: Android crops to a shape inscribed in a circle of 80%
  // diameter and zooms, which shrinks the mark on screen — so these are drawn
  // LARGER than the "any" icons to compensate, not smaller.
  const mask = isSearch ? 0.75 : 0.8;
  await render(512, 512, mask, `${dir}/icon-512-maskable.png`);
  await render(1024, 1024, mask, `${dir}/icon-1024-maskable.png`);

  // Favicon: a PNG beats a hand-drawn inline SVG, which was a second drawing of
  // the mark and did not track the app's styling.
  await render(64, 64, any + 0.08, `${dir}/favicon-64.png`);
  await render(32, 32, any + 0.08, `${dir}/favicon-32.png`);

  if (isSearch) {
    // iOS launch images — common modern iPhone buckets [physicalW, physicalH, dpr].
    // (Portrait; the manifest is portrait-locked. Unmatched devices fall back to
    // the OS default.)
    const iphones = [
      [1290, 2796, 3], [1179, 2556, 3], [1284, 2778, 3], [1170, 2532, 3],
      [1125, 2436, 3], [1242, 2688, 3], [828, 1792, 2], [750, 1334, 2],
    ];
    await mkdir(join(ROOT, dir, 'splash'), { recursive: true });
    const links = [];
    for (const [w, h, r] of iphones) {
      await render(w, h, 0.34, `${dir}/splash/apple-splash-${w}-${h}.png`);
      links.push(
        `    <link rel="apple-touch-startup-image" media="(device-width: ${w / r}px) and (device-height: ${h / r}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="/splash/apple-splash-${w}-${h}.png" />`,
      );
    }
    // Build helper, not a site asset — keep it out of public/ so it isn't deployed.
    await writeFile(join(ROOT, 'scripts/splash-links.html'), links.join('\n') + '\n');
    console.log(`glyph font resolved to: ${reportedFont}`);
    console.log(`  ink centred by ${(nudgeX * 100).toFixed(2)}% of font size (side-bearing correction)`);
    console.log(`search: 4 icons + 2 maskable + 2 favicons + ${iphones.length} iOS splashes`);
  } else {
    console.log('scribe: 4 icons + 2 maskable + 2 favicons (clef mark)');
  }
}

await browser.close();
