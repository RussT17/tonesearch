// bank.ts — the curated pattern bank as data (docs/05-difficulty-and-bank.md §3).
// A Pattern is an ordered list of intervals (fifths from root), plus a display
// name, its category (interval/triad/chord), and the minimum difficulty tier it
// appears in (tiers are cumulative: easy ⊂ medium ⊂ hard). Extended chords are
// full ≤5-note voicings; a `reduced` flag marks economy voicings.

import type { Fifths } from './theory';

export type Tier = 'easy' | 'medium' | 'hard' | 'expert';
export type Kind = 'interval' | 'triad' | 'chord';

const TIER_RANK: Record<Tier, number> = { easy: 0, medium: 1, hard: 2, expert: 3 };

// The category word shown after the name. "Triad" is reserved for the four
// classic triads; sus2/sus4 (and everything ≥4 notes) read as "Chord".
const CATEGORY_LABEL: Record<Kind, string> = {
  interval: 'Interval',
  triad: 'Triad',
  chord: 'Chord',
};
export const categoryLabel = (kind: Kind): string => CATEGORY_LABEL[kind];

export interface Pattern {
  name: string; // stable id (e.g. 'maj7', 'int-m3')
  display: string; // human caption (e.g. 'Major 7th')
  kind: Kind; // interval / triad / chord (drives the appended category word)
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
  { name: 'int-m2', display: 'Minor 2nd', kind: 'interval', intervals: [R, m2], tier: 'easy' },
  { name: 'int-m6', display: 'Minor 6th', kind: 'interval', intervals: [R, m6], tier: 'easy' },
  { name: 'int-m3', display: 'Minor 3rd', kind: 'interval', intervals: [R, m3], tier: 'easy' },
  { name: 'int-m7', display: 'Minor 7th', kind: 'interval', intervals: [R, m7], tier: 'easy' },
  { name: 'int-P4', display: 'Perfect 4th', kind: 'interval', intervals: [R, P4], tier: 'easy' },
  { name: 'int-P5', display: 'Perfect 5th', kind: 'interval', intervals: [R, P5], tier: 'easy' },
  { name: 'int-M2', display: 'Major 2nd', kind: 'interval', intervals: [R, M2], tier: 'easy' },
  { name: 'int-M6', display: 'Major 6th', kind: 'interval', intervals: [R, M6], tier: 'easy' },
  { name: 'int-M3', display: 'Major 3rd', kind: 'interval', intervals: [R, M3], tier: 'easy' },
  { name: 'int-M7', display: 'Major 7th', kind: 'interval', intervals: [R, M7], tier: 'easy' },
  { name: 'maj', display: 'Major', kind: 'triad', intervals: [R, M3, P5], tier: 'easy' },
  { name: 'min', display: 'Minor', kind: 'triad', intervals: [R, m3, P5], tier: 'easy' },

  // ── MEDIUM (adds) ─────────────────────────────────────────────────────
  // tritone dyads
  { name: 'int-aug4', display: 'Augmented 4th', kind: 'interval', intervals: [R, aug4], tier: 'medium' },
  { name: 'int-dim5', display: 'Diminished 5th', kind: 'interval', intervals: [R, dim5], tier: 'medium' },
  // remaining triads (only the four classic triads are "Triad"; sus are chords)
  { name: 'dim', display: 'Diminished', kind: 'triad', intervals: [R, m3, dim5], tier: 'medium' },
  { name: 'aug', display: 'Augmented', kind: 'triad', intervals: [R, M3, aug5], tier: 'medium' },
  { name: 'sus2', display: 'Sus2', kind: 'chord', intervals: [R, M2, P5], tier: 'medium' },
  { name: 'sus4', display: 'Sus4', kind: 'chord', intervals: [R, P4, P5], tier: 'medium' },
  // 6th / 7th chords (full 4-note)
  { name: 'min7', display: 'Minor 7th', kind: 'chord', intervals: [R, m3, P5, m7], tier: 'medium' },
  { name: 'maj7', display: 'Major 7th', kind: 'chord', intervals: [R, M3, P5, M7], tier: 'medium' },
  { name: 'dom7', display: 'Dominant 7th', kind: 'chord', intervals: [R, M3, P5, m7], tier: 'medium' },
  { name: 'maj6', display: 'Major 6th', kind: 'chord', intervals: [R, M3, P5, M6], tier: 'medium' },
  { name: 'min6', display: 'Minor 6th', kind: 'chord', intervals: [R, m3, P5, M6], tier: 'medium' },
  { name: 'min♭6', display: 'Minor ♭6', kind: 'chord', intervals: [R, m3, P5, m6], tier: 'medium' },
  { name: 'm7♭5', display: 'Half-diminished 7th', kind: 'chord', intervals: [R, m3, dim5, m7], tier: 'medium' },

  // ── HARD (adds) ───────────────────────────────────────────────────────
  // far dyads → all 15
  { name: 'int-aug5', display: 'Augmented 5th', kind: 'interval', intervals: [R, aug5], tier: 'hard' },
  { name: 'int-aug2', display: 'Augmented 2nd', kind: 'interval', intervals: [R, aug2], tier: 'hard' },
  { name: 'int-dim7', display: 'Diminished 7th', kind: 'interval', intervals: [R, dim7], tier: 'hard' },
  // fully diminished
  { name: 'dim7', display: 'Diminished 7th', kind: 'chord', intervals: [R, m3, dim5, dim7], tier: 'hard' },
  // adds
  { name: 'add9', display: 'Add9', kind: 'chord', intervals: [R, M3, P5, M2], tier: 'hard' },
  { name: 'madd9', display: 'Minor add9', kind: 'chord', intervals: [R, m3, P5, M2], tier: 'hard' },
  // 6/9
  { name: '6/9', display: '6/9', kind: 'chord', intervals: [R, M3, P5, M6, M2], tier: 'hard' },
  { name: 'm6/9', display: 'Minor 6/9', kind: 'chord', intervals: [R, m3, P5, M6, M2], tier: 'hard' },
  // ninths (full 5-note)
  { name: 'maj9', display: 'Major 9th', kind: 'chord', intervals: [R, M3, P5, M7, M2], tier: 'hard' },
  { name: 'dom9', display: 'Dominant 9th', kind: 'chord', intervals: [R, M3, P5, m7, M2], tier: 'hard' },
  { name: 'min9', display: 'Minor 9th', kind: 'chord', intervals: [R, m3, P5, m7, M2], tier: 'hard' },
  // elevenths
  { name: 'min11', display: 'Minor 11th', kind: 'chord', intervals: [R, m3, m7, M2, P4], tier: 'hard', reduced: true },
  { name: '9sus4', display: '9sus4', kind: 'chord', intervals: [R, P4, P5, m7, M2], tier: 'hard' },
  // thirteenths (economy 5-note, R-3-7-9-13)
  { name: 'dom13', display: 'Dominant 13th', kind: 'chord', intervals: [R, M3, m7, M2, M6], tier: 'hard', reduced: true },
  { name: 'maj13', display: 'Major 13th', kind: 'chord', intervals: [R, M3, M7, M2, M6], tier: 'hard', reduced: true },
  { name: 'min13', display: 'Minor 13th', kind: 'chord', intervals: [R, m3, m7, M2, M6], tier: 'hard', reduced: true },
  // altered dominants
  { name: '7♭9', display: '7♭9', kind: 'chord', intervals: [R, M3, P5, m7, m2], tier: 'hard' },
  { name: '7♯9', display: '7♯9', kind: 'chord', intervals: [R, M3, P5, m7, aug2], tier: 'hard' },
  { name: '7♯11', display: '7♯11', kind: 'chord', intervals: [R, M3, P5, m7, aug4], tier: 'hard' },
  { name: '7♭13', display: '7♭13', kind: 'chord', intervals: [R, M3, m7, m6], tier: 'hard' }, // 5th dropped (clash)

  // ── EXPERT (adds) — docs/07-expert-mode.md ────────────────────────────
  // Extended-chord shells: reduced 4-note voicings (root-position, [reduced]).
  { name: 'dom9-shell', display: 'Dominant 9th', kind: 'chord', intervals: [R, M3, m7, M2], tier: 'expert', reduced: true },
  { name: 'dom13-shell', display: 'Dominant 13th', kind: 'chord', intervals: [R, M3, m7, M6], tier: 'expert', reduced: true },
  { name: 'dom7♭9-shell', display: '7♭9', kind: 'chord', intervals: [R, M3, m7, m2], tier: 'expert', reduced: true },
  { name: 'dom7♯9-shell', display: '7♯9', kind: 'chord', intervals: [R, M3, m7, aug2], tier: 'expert', reduced: true },
  { name: 'dom7♯11-shell', display: '7♯11', kind: 'chord', intervals: [R, M3, m7, aug4], tier: 'expert', reduced: true },
  { name: 'maj9-shell', display: 'Major 9th', kind: 'chord', intervals: [R, M3, M7, M2], tier: 'expert', reduced: true },
  { name: 'maj13-shell', display: 'Major 13th', kind: 'chord', intervals: [R, M3, M7, M6], tier: 'expert', reduced: true },
  { name: 'maj7♯11-shell', display: 'Major 7♯11', kind: 'chord', intervals: [R, M3, M7, aug4], tier: 'expert', reduced: true },
  { name: 'min9-shell', display: 'Minor 9th', kind: 'chord', intervals: [R, m3, m7, M2], tier: 'expert', reduced: true },
  { name: 'min11-shell', display: 'Minor 11th', kind: 'chord', intervals: [R, m3, m7, P4], tier: 'expert', reduced: true },
  { name: 'min13-shell', display: 'Minor 13th', kind: 'chord', intervals: [R, m3, m7, M6], tier: 'expert', reduced: true },
  // Rooted 5-less shells: root + guide-tones / 3–6, both orders ([reduced]).
  { name: 'dom7-37', display: 'Dominant 7th', kind: 'chord', intervals: [R, M3, m7], tier: 'expert', reduced: true },
  { name: 'dom7-73', display: 'Dominant 7th', kind: 'chord', intervals: [R, m7, M3], tier: 'expert', reduced: true },
  { name: 'min7-37', display: 'Minor 7th', kind: 'chord', intervals: [R, m3, m7], tier: 'expert', reduced: true },
  { name: 'min7-73', display: 'Minor 7th', kind: 'chord', intervals: [R, m7, m3], tier: 'expert', reduced: true },
  { name: 'maj7-37', display: 'Major 7th', kind: 'chord', intervals: [R, M3, M7], tier: 'expert', reduced: true },
  { name: 'maj7-73', display: 'Major 7th', kind: 'chord', intervals: [R, M7, M3], tier: 'expert', reduced: true },
  { name: 'maj6-36', display: 'Major 6th', kind: 'chord', intervals: [R, M3, M6], tier: 'expert', reduced: true },
  { name: 'maj6-63', display: 'Major 6th', kind: 'chord', intervals: [R, M6, M3], tier: 'expert', reduced: true },
  { name: 'min6-36', display: 'Minor 6th', kind: 'chord', intervals: [R, m3, M6], tier: 'expert', reduced: true },
  { name: 'min6-63', display: 'Minor 6th', kind: 'chord', intervals: [R, M6, m3], tier: 'expert', reduced: true },
  // Root-position jazz colors.
  { name: 'min-maj7', display: 'Minor-major 7th', kind: 'chord', intervals: [R, m3, P5, M7], tier: 'expert' },
  { name: 'maj7♯5', display: 'Major 7♯5', kind: 'chord', intervals: [R, M3, aug5, M7], tier: 'expert' },
  { name: '7♯5', display: '7♯5', kind: 'chord', intervals: [R, M3, aug5, m7], tier: 'expert' },
  { name: '7♭5', display: '7♭5', kind: 'chord', intervals: [R, M3, dim5, m7], tier: 'expert' },
  { name: '7♯9♭13', display: '7♯9♭13', kind: 'chord', intervals: [R, M3, m7, aug2, m6], tier: 'expert' },
  { name: '7♭9♭13', display: '7♭9♭13', kind: 'chord', intervals: [R, M3, m7, m2, m6], tier: 'expert' },
  { name: '7♭9♯11', display: '7♭9♯11', kind: 'chord', intervals: [R, M3, m7, m2, aug4], tier: 'expert' },
  { name: '7♯9♯11', display: '7♯9♯11', kind: 'chord', intervals: [R, M3, m7, aug2, aug4], tier: 'expert' },
  { name: 'quartal', display: 'Quartal', kind: 'chord', intervals: [R, P4, m7, m3], tier: 'expert' },
  { name: 'quintal', display: 'Quintal', kind: 'chord', intervals: [R, P5, M2, M6], tier: 'expert' },
  { name: '7sus4', display: '7sus4', kind: 'chord', intervals: [R, P4, P5, m7], tier: 'expert' },
  { name: '13sus4', display: '13sus4', kind: 'chord', intervals: [R, P4, m7, M2, M6], tier: 'expert' },
  // Triad inversions ⟂ (off-root; kind chord, not 'triad').
  { name: 'maj-inv1', display: 'Major Triad (1st inv)', kind: 'chord', intervals: [M3, P5, R], tier: 'expert' },
  { name: 'maj-inv2', display: 'Major Triad (2nd inv)', kind: 'chord', intervals: [P5, R, M3], tier: 'expert' },
  { name: 'min-inv1', display: 'Minor Triad (1st inv)', kind: 'chord', intervals: [m3, P5, R], tier: 'expert' },
  { name: 'min-inv2', display: 'Minor Triad (2nd inv)', kind: 'chord', intervals: [P5, R, m3], tier: 'expert' },
  { name: 'dim-inv1', display: 'Diminished Triad (1st inv)', kind: 'chord', intervals: [m3, dim5, R], tier: 'expert' },
  { name: 'dim-inv2', display: 'Diminished Triad (2nd inv)', kind: 'chord', intervals: [dim5, R, m3], tier: 'expert' },
  { name: 'aug-inv1', display: 'Augmented Triad (1st inv)', kind: 'chord', intervals: [M3, aug5, R], tier: 'expert' },
  { name: 'aug-inv2', display: 'Augmented Triad (2nd inv)', kind: 'chord', intervals: [aug5, R, M3], tier: 'expert' },
  // Triad 5–3–R re-voicings ⟂ (fifth-bottom, root-top).
  { name: 'maj-53r', display: 'Major Triad (5–3–R)', kind: 'chord', intervals: [P5, M3, R], tier: 'expert' },
  { name: 'min-53r', display: 'Minor Triad (5–3–R)', kind: 'chord', intervals: [P5, m3, R], tier: 'expert' },
  { name: 'dim-53r', display: 'Diminished Triad (5–3–R)', kind: 'chord', intervals: [dim5, m3, R], tier: 'expert' },
  { name: 'aug-53r', display: 'Augmented Triad (5–3–R)', kind: 'chord', intervals: [aug5, M3, R], tier: 'expert' },
  // Rootless guide-tone dyads ⟂ (both orders).
  { name: 'gt-dom-37', display: 'Dominant guide tones', kind: 'interval', intervals: [M3, m7], tier: 'expert' },
  { name: 'gt-dom-73', display: 'Dominant guide tones', kind: 'interval', intervals: [m7, M3], tier: 'expert' },
  { name: 'gt-min-37', display: 'Minor guide tones', kind: 'interval', intervals: [m3, m7], tier: 'expert' },
  { name: 'gt-min-73', display: 'Minor guide tones', kind: 'interval', intervals: [m7, m3], tier: 'expert' },
  { name: 'gt-maj-37', display: 'Major guide tones', kind: 'interval', intervals: [M3, M7], tier: 'expert' },
  { name: 'gt-maj-73', display: 'Major guide tones', kind: 'interval', intervals: [M7, M3], tier: 'expert' },
  // Rootless 3–6 dyads ⟂ (both orders).
  { name: 'd36-maj', display: 'Major 6th (3–6)', kind: 'interval', intervals: [M3, M6], tier: 'expert' },
  { name: 'd36-maj-r', display: 'Major 6th (3–6)', kind: 'interval', intervals: [M6, M3], tier: 'expert' },
  { name: 'd36-min', display: 'Minor 6th (3–6)', kind: 'interval', intervals: [m3, M6], tier: 'expert' },
  { name: 'd36-min-r', display: 'Minor 6th (3–6)', kind: 'interval', intervals: [M6, m3], tier: 'expert' },
  // Rootless 4-note A/B voicings ⟂.
  { name: 'min9-rlA', display: 'Minor 9th (rootless A)', kind: 'chord', intervals: [m3, P5, m7, M2], tier: 'expert' },
  { name: 'min9-rlB', display: 'Minor 9th (rootless B)', kind: 'chord', intervals: [m7, M2, m3, P5], tier: 'expert' },
  { name: 'dom13-rlA', display: 'Dominant 13th (rootless A)', kind: 'chord', intervals: [M3, M6, m7, M2], tier: 'expert' },
  { name: 'dom13-rlB', display: 'Dominant 13th (rootless B)', kind: 'chord', intervals: [m7, M2, M3, M6], tier: 'expert' },
  { name: 'maj9-rlA', display: 'Major 9th (rootless A)', kind: 'chord', intervals: [M3, P5, M7, M2], tier: 'expert' },
  { name: 'maj9-rlB', display: 'Major 9th (rootless B)', kind: 'chord', intervals: [M7, M2, M3, P5], tier: 'expert' },
];

/** Patterns available at `tier` (cumulative: easy ⊂ medium ⊂ hard). */
export function bankForTier(tier: Tier): Pattern[] {
  return BANK.filter((p) => TIER_RANK[p.tier] <= TIER_RANK[tier]);
}
