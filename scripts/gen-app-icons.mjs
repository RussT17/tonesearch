// gen-app-icons.mjs — regenerate the PWA icons, the favicon and the iOS launch
// (apple-touch-startup-image) splash screens from the app's OWN stylesheet, so the
// launcher icon is literally a selected note tile: same border, fill, glow, corner
// radius, glyph weight and app background as a tile you light up mid-solve.
//
// It does NOT redraw the tile. It loads src/style.css into a headless Chromium,
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

const css = await readFile(join(ROOT, 'src/style.css'), 'utf8');

/**
 * The page: the app's real stylesheet, one real `.cell.selected`, on the app's
 * real body background. `markFrac` is the diamond's point-to-point width as a
 * fraction of the canvas's shorter side.
 */
const page = (w, h, markFrac) => {
  const scale = (Math.min(w, h) * markFrac) / REF_DIAG;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${css}
/* --- icon harness (not part of the app) --- */
html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
body { display: grid; place-items: center; }
/* Scale the finished tile as a unit so border width, corner radius and glow
   stay in the same ratio to the tile as they are in the running game. */
.mark { transform: scale(${scale}); transform-origin: center; }
.mark .cell { position: relative; width: ${REF_SIDE}px; height: ${REF_SIDE}px; }
.mark .glyph { font-size: ${REF_SIDE * GLYPH_RATIO}px; }
</style></head><body>
<div class="mark"><div class="cell selected"><span class="glyph">${MARK_TEXT}</span></div></div>
</body></html>`;
};

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const tab = await browser.newPage();

let reportedFont = null;
const render = async (w, h, markFrac, file) => {
  await tab.setViewportSize({ width: w, height: h });
  await tab.setContent(page(w, h, markFrac), { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  reportedFont ??= await tab.evaluate(() => {
    const el = document.querySelector('.glyph');
    // The stack as authored, plus what the box actually rendered with.
    return getComputedStyle(el).fontFamily;
  });
  await tab.screenshot({ path: join(ROOT, file), type: 'png' });
};

await mkdir(join(ROOT, 'public/splash'), { recursive: true });

// Full-bleed "any" icons: home screen where not masked, app switcher, install
// dialog. The glow needs room to fall off, so the diamond sits at ~64% — wider
// than that and the bloom clips against the canvas edge.
await render(192, 192, 0.64, 'public/icon-192.png');
await render(512, 512, 0.64, 'public/icon-512.png');
await render(1024, 1024, 0.64, 'public/icon-1024.png');
await render(180, 180, 0.62, 'public/apple-touch-icon.png');

// Maskable icons: Android may crop to a circle of 80% diameter and zoom, so the
// mark is pulled in to ~50% to sit entirely inside that safe zone.
await render(512, 512, 0.5, 'public/icon-512-maskable.png');
await render(1024, 1024, 0.5, 'public/icon-1024-maskable.png');

// Favicon: a 32px PNG beats the hand-drawn inline SVG in index.html, which was a
// separate drawing of the diamond and did not track the app's styling.
await render(64, 64, 0.72, 'public/favicon-64.png');
await render(32, 32, 0.72, 'public/favicon-32.png');

// iOS launch images — common modern iPhone buckets [physicalW, physicalH, dpr].
// (Portrait; the manifest is portrait-locked. Unmatched devices fall back to the
// OS default — no worse than before.)
const iphones = [
  [1290, 2796, 3], [1179, 2556, 3], [1284, 2778, 3], [1170, 2532, 3],
  [1125, 2436, 3], [1242, 2688, 3], [828, 1792, 2], [750, 1334, 2],
];
const links = [];
for (const [w, h, r] of iphones) {
  await render(w, h, 0.34, `public/splash/apple-splash-${w}-${h}.png`);
  links.push(
    `    <link rel="apple-touch-startup-image" media="(device-width: ${w / r}px) and (device-height: ${h / r}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="/splash/apple-splash-${w}-${h}.png" />`,
  );
}

// Build helper, not a site asset — keep it out of public/ so it isn't deployed.
await writeFile(join(ROOT, 'scripts/splash-links.html'), links.join('\n') + '\n');
await browser.close();

console.log(`glyph font resolved to: ${reportedFont}`);
console.log(`  (baked into the PNGs — run on macOS for the SF Pro the app shows on iOS)`);
console.log(`\ndone: 4 icons + 2 maskable + 2 favicons + ${iphones.length} iOS splashes`);
console.log(`splash <link> block written to scripts/splash-links.html`);
