// gen-smufl-paths.mjs — extract the clef and accidental outlines from Bravura
// and write them as static SVG paths (src/scribe/smufl-paths.ts).
//
// Why not just set the clef characters as text? U+1D11E / U+1D122 are painted by
// FreeSerif on Linux and are absent from the default macOS and iOS stacks, so a
// text clef renders as tofu on the devices this app is for. Why not hand-draw
// them? A bass clef is tractable by hand; a treble clef's spiral is not.
//
// So the outlines are baked once, here, and committed. Nothing is fetched or
// parsed at runtime, and the app ships no font.
//
// Bravura is SIL OFL 1.1 (Steinberg). Outlines are embedded in vexflow's font
// module as a base64 woff2. This script runs about once, so its dependencies are
// intentionally NOT in package.json — install them ad hoc:
//
//   npm i --no-save vexflow wawoff2 opentype.js
//   node scripts/gen-clef-paths.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// SMuFL codepoints, and the staff line each clef's origin sits on, expressed in
// the target coordinate system (10 units per space, y down, lines at 20…60).
const GLYPHS = [
  { name: 'TREBLE_CLEF', codepoint: 0xe050, anchorY: 50, note: 'G4 — the line the spiral wraps' },
  { name: 'BASS_CLEF', codepoint: 0xe062, anchorY: 30, note: 'F3 — the line the dots straddle' },
  // Accidentals are authored around y = 0: SMuFL puts their origin on the staff
  // position of the note they alter, so drawing one is a translate to that step
  // and nothing else. That is what makes them land centred on a line or in a
  // space instead of being nudged by eye.
  { name: 'FLAT', codepoint: 0xe260, anchorY: 0, note: 'origin sits on the note it alters' },
  { name: 'NATURAL', codepoint: 0xe261, anchorY: 0, note: 'origin sits on the note it alters' },
  { name: 'SHARP', codepoint: 0xe262, anchorY: 0, note: 'origin sits on the note it alters' },
  { name: 'DOUBLE_SHARP', codepoint: 0xe263, anchorY: 0, note: 'origin sits on the note it alters' },
  { name: 'DOUBLE_FLAT', codepoint: 0xe264, anchorY: 0, note: 'origin sits on the note it alters' },
];

const SPACE_UNITS = 10; // one staff space in the target system
const SMUFL_SPACE = 250; // one staff space in Bravura font units (em = 1000)
const SCALE = SPACE_UNITS / SMUFL_SPACE;

// Read the font module as text rather than importing it: vexflow's package
// exports do not expose this subpath, and all we want is the base64 payload.
// (vexflow's "exports" hides even package.json, so resolve by path, not by name.)
const bravuraSrc = await readFile(
  join(ROOT, 'node_modules/vexflow/build/esm/src/fonts/bravura.js'),
  'utf8',
);
const b64 = /base64,([A-Za-z0-9+/=]+)/.exec(bravuraSrc)?.[1];
if (!b64) throw new Error('could not find the base64 font payload in vexflow bravura.js');

const wawoff = await import('wawoff2');
const otMod = await import('opentype.js');
const parse = otMod.parse ?? otMod.default?.parse;

const woff2 = Buffer.from(b64, 'base64');
const ttf = Buffer.from(await wawoff.decompress(woff2));
const font = parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
if (font.unitsPerEm !== 1000) throw new Error(`expected em 1000, got ${font.unitsPerEm}`);

/** Round path numbers so the committed file is readable and diffs stay small. */
const tidy = (d) => d.replace(/-?\d+\.?\d*/g, (n) => String(Math.round(Number(n) * 100) / 100));

const parts = [];
const metrics = [];
for (const { name, codepoint, anchorY, note } of GLYPHS) {
  const glyph = font.charToGlyph(String.fromCodePoint(codepoint));
  if (!glyph || glyph.index === 0) throw new Error(`${name}: glyph not found in Bravura`);
  // getPath(0, 0, em) yields font units with the baseline at y = 0 and y running
  // DOWN, which is already the SVG convention — so the only work is scaling and
  // dropping the whole thing onto its staff line.
  const path = glyph.getPath(0, 0, font.unitsPerEm);
  for (const cmd of path.commands) {
    for (const [ax, ay] of [['x', 'y'], ['x1', 'y1'], ['x2', 'y2']]) {
      if (cmd[ax] !== undefined) cmd[ax] = cmd[ax] * SCALE;
      if (cmd[ay] !== undefined) cmd[ay] = anchorY + cmd[ay] * SCALE;
    }
  }
  const bb = glyph.getBoundingBox();
  parts.push(
    `/** ${note}. Spans y ${(anchorY - bb.y2 * SCALE).toFixed(1)}…${(anchorY - bb.y1 * SCALE).toFixed(1)}` +
      `, x ${(bb.x1 * SCALE).toFixed(1)}…${(bb.x2 * SCALE).toFixed(1)}. */\nexport const ${name} =\n  '${tidy(path.toPathData(2))}';`,
  );
  // Real advance width, so key signatures can be spaced the way they are
  // engraved rather than by a guessed constant.
  metrics.push(
    `  ${name}: { width: ${(glyph.advanceWidth * SCALE).toFixed(2)}, ` +
      `x1: ${(bb.x1 * SCALE).toFixed(2)}, x2: ${(bb.x2 * SCALE).toFixed(2)}, ` +
      `y1: ${(anchorY - bb.y2 * SCALE).toFixed(2)}, y2: ${(anchorY - bb.y1 * SCALE).toFixed(2)} },`,
  );
}

const out = `// smufl-paths.ts — GENERATED by scripts/gen-clef-paths.mjs. Do not edit.
//
// Clef and accidental outlines from Bravura (SIL OFL 1.1, Steinberg), baked to
// static SVG paths so the app depends on no music font at runtime — these
// characters are missing from the default macOS/iOS font stacks, and text
// accidentals from a UI font are the wrong shape and weight beside a clef.
//
// Coordinates: 10 units per staff space, y down, the five lines at y = 20, 30,
// 40, 50, 60. Clefs are positioned on the line they name; accidentals are
// authored around y = 0, so drawing one is a translate to its note's step.

${parts.join('\n\n')}

/** Advance width and ink box of each glyph, for engraving-accurate spacing. */
export const METRICS: Record<string, { width: number; x1: number; x2: number; y1: number; y2: number }> = {
${metrics.join('\n')}
};
`;
await writeFile(join(ROOT, 'src/scribe/smufl-paths.ts'), out);
console.log('wrote src/scribe/smufl-paths.ts');
