// bank.ts — the curated pattern bank as data (docs/03-full-spec.md §3).
// A Pattern is an ordered list of intervals (fifths from root). Extended chords
// are 4-note reductions: R + 3rd + 7th + the characteristic extension.

import type { Fifths } from './theory';

export interface Pattern {
  name: string;
  intervals: Fifths[];
}

// Interval tokens → fifths from root (see docs/00-music-theory.md).
const R = 0;
const m2 = -5, M2 = 2, aug2 = 9;
const m3 = -3, M3 = 4;
const P4 = -1, aug4 = 6;
const dim5 = -6, P5 = 1, aug5 = 8;
const m6 = -4, M6 = 3;
const dim7 = -9, m7 = -2, M7 = 5;

export const BANK: readonly Pattern[] = [
  // triads
  { name: 'maj', intervals: [R, M3, P5] },
  { name: 'min', intervals: [R, m3, P5] },
  { name: 'dim', intervals: [R, m3, dim5] },
  { name: 'aug', intervals: [R, M3, aug5] },
  { name: 'sus4', intervals: [R, P4, P5] },
  { name: 'sus2', intervals: [R, M2, P5] },
  // sevenths
  { name: 'maj7', intervals: [R, M3, P5, M7] },
  { name: 'dom7', intervals: [R, M3, P5, m7] },
  { name: 'min7', intervals: [R, m3, P5, m7] },
  { name: 'm7♭5', intervals: [R, m3, dim5, m7] },
  { name: 'dim7', intervals: [R, m3, dim5, dim7] },
  // sixths
  { name: 'maj6', intervals: [R, M3, P5, M6] },
  { name: 'min6', intervals: [R, m3, P5, M6] },
  { name: 'min♭6', intervals: [R, m3, P5, m6] },
  // extended dominant (4-note reductions)
  { name: 'dom9', intervals: [R, M3, m7, M2] },
  { name: 'dom7♭9', intervals: [R, M3, m7, m2] },
  { name: 'dom7♯9', intervals: [R, M3, m7, aug2] },
  { name: 'dom7♯11', intervals: [R, M3, m7, aug4] },
  { name: 'dom13', intervals: [R, M3, m7, M6] },
  { name: 'dom7♭13', intervals: [R, M3, m7, m6] },
  // extended major
  { name: 'maj9', intervals: [R, M3, M7, M2] },
  { name: 'maj7♯11', intervals: [R, M3, M7, aug4] },
  { name: 'maj13', intervals: [R, M3, M7, M6] },
  // extended minor
  { name: 'min9', intervals: [R, m3, m7, M2] },
  { name: 'min11', intervals: [R, m3, m7, P4] },
  { name: 'min13', intervals: [R, m3, m7, M6] },
];
