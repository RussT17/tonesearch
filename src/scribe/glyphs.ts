// glyphs.ts — the shapes ToneScribe draws, and the coordinate system they live in.
//
// Clefs are SVG paths, not text. U+1D11E/U+1D122 are painted by FreeSerif on
// this Linux box and are simply absent from the default macOS/iOS stacks, so a
// text clef would render as tofu on the devices this app is for. The outlines
// are baked from Bravura by scripts/gen-clef-paths.mjs, so nothing is fetched at
// runtime and the app ships no music font.
//
// Accidentals are the opposite case: ♯ ♭ ♮ live in ordinary text fonts and the
// game already sets note names with them, so those stay as text.

import { BASS_CLEF, TREBLE_CLEF } from './clef-paths';
import type { Clef } from '../core/staff';

/** One staff space, in the coordinate system the clef paths are authored in. */
export const GLYPH_SPACE = 10;

/** y of a staff line in that system, counting 0 = bottom line. */
export const glyphLineY = (lineFromBottom: number): number => 60 - GLYPH_SPACE * lineFromBottom;

export const clefPath = (clef: Clef): string => (clef === 'treble' ? TREBLE_CLEF : BASS_CLEF);

/** Horizontal room a clef needs, in glyph units (its own width plus a margin). */
export const clefWidth = (clef: Clef): number => (clef === 'treble' ? 34 : 32);

/**
 * A filled notehead centred on (cx, cy): an ellipse, drawn wider than tall the
 * way a written one is. `space` is one staff space in the caller's units, and a
 * notehead is one space tall by convention.
 */
export function noteheadPath(cx: number, cy: number, space: number): string {
  const rx = space * 0.66;
  const ry = space * 0.5;
  return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
}
