// glyphs.ts — the shapes ToneScribe draws, and the coordinate system they live in.
//
// Clefs and accidentals are SVG paths, not text. U+1D11E/U+1D122 are painted by
// FreeSerif on Linux and are absent from the default macOS/iOS stacks, so a text
// clef would be tofu on the devices this app is for. ♯ ♭ ♮ do exist in UI fonts,
// but a UI font's accidental is the wrong shape and weight next to a Bravura
// clef, and its metrics have nothing to do with the staff — so those come from
// Bravura too, and land on a line or in a space by construction.
//
// Baked by scripts/gen-smufl-paths.mjs; nothing is fetched at runtime.

import {
  BASS_CLEF,
  DOUBLE_FLAT,
  DOUBLE_SHARP,
  FLAT,
  METRICS,
  NATURAL,
  SHARP,
  TREBLE_CLEF,
} from './smufl-paths';
import type { Accidental, Clef } from '../core/staff';

/** One staff space, in the coordinate system the glyph paths are authored in. */
export const GLYPH_SPACE = 10;

export const clefPath = (clef: Clef): string => (clef === 'treble' ? TREBLE_CLEF : BASS_CLEF);
export const clefWidth = (clef: Clef): number => METRICS[clef === 'treble' ? 'TREBLE_CLEF' : 'BASS_CLEF']!.width;

const ACCIDENTAL_KEY: Record<Exclude<Accidental, null>, string> = {
  [-2]: 'DOUBLE_FLAT',
  [-1]: 'FLAT',
  [0]: 'NATURAL',
  [1]: 'SHARP',
  [2]: 'DOUBLE_SHARP',
};
const ACCIDENTAL_PATH: Record<string, string> = {
  DOUBLE_FLAT, FLAT, NATURAL, SHARP, DOUBLE_SHARP,
};

/** The path for an accidental, authored around y = 0 — its origin sits on the
 * staff position of the note it alters, so placing it is a translate. */
export const accidentalPath = (a: Exclude<Accidental, null>): string =>
  ACCIDENTAL_PATH[ACCIDENTAL_KEY[a]]!;

/** Advance width and ink box of an accidental, for spacing that matches how
 * these are actually engraved rather than a guessed constant. */
export const accidentalMetrics = (
  a: Exclude<Accidental, null>,
): { width: number; x1: number; x2: number; y1: number; y2: number } => METRICS[ACCIDENTAL_KEY[a]]!;

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
