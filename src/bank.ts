// bank.ts — the curated pattern bank as data (docs/05-difficulty-and-bank.md §3).
// A Pattern is an ordered list of intervals (fifths from root), plus a display
// name and the minimum difficulty tier it appears in (tiers are cumulative:
// easy ⊂ medium ⊂ hard). Extended chords are full ≤5-note voicings; a `reduced`
// flag marks economy voicings for the '[reduced]' name marker.

import type { Fifths } from './theory';

export type Tier = 'easy' | 'medium' | 'hard'; // 'expert' is a later build

const TIER_RANK: Record<Tier, number> = { easy: 0, medium: 1, hard: 2 };

export interface Pattern {
  name: string; // stable id (e.g. 'maj7', 'int-m3')
  display: string; // human caption (e.g. 'Major 7th')
  intervals: Fifths[];
  tier: Tier; // minimum tier; cumulative
  reduced?: boolean; // economy voicing → append '[reduced]' marker at render
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
  // ── EASY ──────────────────────────────────────────────────────────────
  // consonant dyads m2…M7 (fifths −5…+5)
  { name: 'int-m2', display: 'Minor 2nd', intervals: [R, m2], tier: 'easy' },
  { name: 'int-m6', display: 'Minor 6th', intervals: [R, m6], tier: 'easy' },
  { name: 'int-m3', display: 'Minor 3rd', intervals: [R, m3], tier: 'easy' },
  { name: 'int-m7', display: 'Minor 7th', intervals: [R, m7], tier: 'easy' },
  { name: 'int-P4', display: 'Perfect 4th', intervals: [R, P4], tier: 'easy' },
  { name: 'int-P5', display: 'Perfect 5th', intervals: [R, P5], tier: 'easy' },
  { name: 'int-M2', display: 'Major 2nd', intervals: [R, M2], tier: 'easy' },
  { name: 'int-M6', display: 'Major 6th', intervals: [R, M6], tier: 'easy' },
  { name: 'int-M3', display: 'Major 3rd', intervals: [R, M3], tier: 'easy' },
  { name: 'int-M7', display: 'Major 7th', intervals: [R, M7], tier: 'easy' },
  { name: 'maj', display: 'Major', intervals: [R, M3, P5], tier: 'easy' },
  { name: 'min', display: 'Minor', intervals: [R, m3, P5], tier: 'easy' },

  // ── MEDIUM (adds) ─────────────────────────────────────────────────────
  // tritone dyads
  { name: 'int-aug4', display: 'Augmented 4th', intervals: [R, aug4], tier: 'medium' },
  { name: 'int-dim5', display: 'Diminished 5th', intervals: [R, dim5], tier: 'medium' },
  // remaining triads
  { name: 'dim', display: 'Diminished', intervals: [R, m3, dim5], tier: 'medium' },
  { name: 'aug', display: 'Augmented', intervals: [R, M3, aug5], tier: 'medium' },
  { name: 'sus2', display: 'Sus2', intervals: [R, M2, P5], tier: 'medium' },
  { name: 'sus4', display: 'Sus4', intervals: [R, P4, P5], tier: 'medium' },
  // 6th / 7th chords (full 4-note)
  { name: 'min7', display: 'Minor 7th', intervals: [R, m3, P5, m7], tier: 'medium' },
  { name: 'maj7', display: 'Major 7th', intervals: [R, M3, P5, M7], tier: 'medium' },
  { name: 'dom7', display: 'Dominant 7th', intervals: [R, M3, P5, m7], tier: 'medium' },
  { name: 'maj6', display: 'Major 6th', intervals: [R, M3, P5, M6], tier: 'medium' },
  { name: 'min6', display: 'Minor 6th', intervals: [R, m3, P5, M6], tier: 'medium' },
  { name: 'min♭6', display: 'Minor ♭6', intervals: [R, m3, P5, m6], tier: 'medium' },
  { name: 'm7♭5', display: 'Half-diminished 7th', intervals: [R, m3, dim5, m7], tier: 'medium' },

  // ── HARD (adds) ───────────────────────────────────────────────────────
  // far dyads → all 15
  { name: 'int-aug5', display: 'Augmented 5th', intervals: [R, aug5], tier: 'hard' },
  { name: 'int-aug2', display: 'Augmented 2nd', intervals: [R, aug2], tier: 'hard' },
  { name: 'int-dim7', display: 'Diminished 7th', intervals: [R, dim7], tier: 'hard' },
  // fully diminished
  { name: 'dim7', display: 'Diminished 7th', intervals: [R, m3, dim5, dim7], tier: 'hard' },
  // adds
  { name: 'add9', display: 'Add9', intervals: [R, M3, P5, M2], tier: 'hard' },
  { name: 'madd9', display: 'Minor add9', intervals: [R, m3, P5, M2], tier: 'hard' },
  // 6/9
  { name: '6/9', display: '6/9', intervals: [R, M3, P5, M6, M2], tier: 'hard' },
  { name: 'm6/9', display: 'Minor 6/9', intervals: [R, m3, P5, M6, M2], tier: 'hard' },
  // ninths (full 5-note)
  { name: 'maj9', display: 'Major 9th', intervals: [R, M3, P5, M7, M2], tier: 'hard' },
  { name: 'dom9', display: 'Dominant 9th', intervals: [R, M3, P5, m7, M2], tier: 'hard' },
  { name: 'min9', display: 'Minor 9th', intervals: [R, m3, P5, m7, M2], tier: 'hard' },
  // elevenths
  { name: 'min11', display: 'Minor 11th', intervals: [R, m3, m7, M2, P4], tier: 'hard', reduced: true },
  { name: '9sus4', display: '9sus4', intervals: [R, P4, P5, m7, M2], tier: 'hard' },
  // thirteenths (economy 5-note, R-3-7-9-13)
  { name: 'dom13', display: 'Dominant 13th', intervals: [R, M3, m7, M2, M6], tier: 'hard', reduced: true },
  { name: 'maj13', display: 'Major 13th', intervals: [R, M3, M7, M2, M6], tier: 'hard', reduced: true },
  { name: 'min13', display: 'Minor 13th', intervals: [R, m3, m7, M2, M6], tier: 'hard', reduced: true },
  // altered dominants
  { name: '7♭9', display: '7♭9', intervals: [R, M3, P5, m7, m2], tier: 'hard' },
  { name: '7♯9', display: '7♯9', intervals: [R, M3, P5, m7, aug2], tier: 'hard' },
  { name: '7♯11', display: '7♯11', intervals: [R, M3, P5, m7, aug4], tier: 'hard' },
  { name: '7♭13', display: '7♭13', intervals: [R, M3, m7, m6], tier: 'hard' }, // 5th dropped (clash)
];

/** Patterns available at `tier` (cumulative: easy ⊂ medium ⊂ hard). */
export function bankForTier(tier: Tier): Pattern[] {
  return BANK.filter((p) => TIER_RANK[p.tier] <= TIER_RANK[tier]);
}
