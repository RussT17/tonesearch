// gen-app-icons.mjs — regenerate the PWA maskable icons and the iOS launch
// (apple-touch-startup-image) splash screens from the brand mark, so the OS launch
// screen shows a crisp centered logo on the app background instead of a stretched /
// zoom-cropped icon. Build-time only (sharp is a devDependency). Run:
//   node scripts/gen-app-icons.mjs
// then paste the printed <link> block into index.html's <head>.

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const BG = '#0b0713'; // app background_color
const STROKE = '#c77dff'; // neon diamond
const TEXT = '#ece7f5'; // light glyph

/** The brand mark (glowing rounded diamond + "TS") centered on the app bg, at w×h.
 * `markFrac` = the diamond's diagonal as a fraction of the shorter side. */
function logoSvg(w, h, markFrac) {
  const cx = w / 2;
  const cy = h / 2;
  const mark = Math.round(Math.min(w, h) * markFrac);
  const s = mark / Math.SQRT2; // side of the (unrotated) square whose diagonal is `mark`
  const sw = Math.max(2, mark * 0.045);
  const blur = mark * 0.03;
  const rx = s * 0.16;
  const fs = mark * 0.34;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${BG}"/>
  <defs><filter id="g" x="-70%" y="-70%" width="240%" height="240%">
    <feGaussianBlur stdDeviation="${blur}" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter></defs>
  <rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="${rx}" transform="rotate(45 ${cx} ${cy})" fill="none" stroke="${STROKE}" stroke-width="${sw}" filter="url(#g)"/>
  <text x="${cx}" y="${cy + fs * 0.35}" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${fs}" fill="${TEXT}" text-anchor="middle">TS</text>
</svg>`;
}

const render = (w, h, frac, file) => sharp(Buffer.from(logoSvg(w, h, frac))).png().toFile(file);

await mkdir('public/splash', { recursive: true });

// Maskable icons: the mark padded to ~60% of the square, well inside the maskable
// safe zone, so Android's adaptive-icon / splash crop no longer zooms or clips it.
await render(512, 512, 0.6, 'public/icon-512-maskable.png');
await render(1024, 1024, 0.6, 'public/icon-1024-maskable.png');

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
  const cw = w / r;
  const ch = h / r;
  links.push(
    `    <link rel="apple-touch-startup-image" media="(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="/splash/apple-splash-${w}-${h}.png" />`,
  );
}

console.log('\n--- paste into index.html <head> ---\n');
console.log(links.join('\n'));
console.log('\n--- done: 2 maskable icons + ' + iphones.length + ' iOS splashes ---');
