// bank.ts — the curated pattern bank as data (docs/05, 07). A Pattern is an
// ordered list of intervals (fifths from root), plus a display name, its category
// (interval/triad/chord), the minimum cumulative tier, and an optional freeform
// `qualifier` shown in parentheses (voicing note: no 5 / shell / 1st inversion
// / rootless A …). Naming rule (docs/08): count the numbers in a chord's jazz
// shorthand — one number → spell it out ("Minor 9th", "Dominant 7th"); two or
// more → keep the shorthand ("m7♭5", "6/9", "7♭9", "9sus4"). sus/add chords keep
// their idiomatic shorthand. Triads and intervals are always spelled.

import type { Fifths } from './theory';

export type Tier = 'easy' | 'medium' | 'hard' | 'expert';
export type Kind = 'interval' | 'triad' | 'chord';

const TIER_RANK: Record<Tier, number> = { easy: 0, medium: 1, hard: 2, expert: 3 };

// The category word shown after the name.
const CATEGORY_LABEL: Record<Kind, string> = {
  interval: 'Interval',
  triad: 'Triad',
  chord: 'Chord',
};
export const categoryLabel = (kind: Kind): string => CATEGORY_LABEL[kind];

export interface Pattern {
  name: string; // stable id (e.g. 'maj7', 'int-m3')
  display: string; // human caption (e.g. 'm7', 'Dominant 7th', 'Major')
  kind: Kind; // interval / triad / chord (drives the appended category word)
  intervals: Fifths[];
  tier: Tier; // minimum tier; cumulative
  qualifier?: string; // parenthetical voicing note: 'no 5', 'shell', '1st inv.', 'rootless A'…
  weight?: number; // relative pick weight (default 1); < 1 = rarer. Dyads use 0.3.
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
  { name: 'int-m2', display: 'Minor 2nd', kind: 'interval', weight: 0.3,intervals: [R, m2], tier: 'easy' },
  { name: 'int-m6', display: 'Minor 6th', kind: 'interval', weight: 0.3,intervals: [R, m6], tier: 'easy' },
  { name: 'int-m3', display: 'Minor 3rd', kind: 'interval', weight: 0.3,intervals: [R, m3], tier: 'easy' },
  { name: 'int-m7', display: 'Minor 7th', kind: 'interval', weight: 0.3,intervals: [R, m7], tier: 'easy' },
  { name: 'int-P4', display: 'Perfect 4th', kind: 'interval', weight: 0.3,intervals: [R, P4], tier: 'easy' },
  { name: 'int-P5', display: 'Perfect 5th', kind: 'interval', weight: 0.3,intervals: [R, P5], tier: 'easy' },
  { name: 'int-M2', display: 'Major 2nd', kind: 'interval', weight: 0.3,intervals: [R, M2], tier: 'easy' },
  { name: 'int-M6', display: 'Major 6th', kind: 'interval', weight: 0.3,intervals: [R, M6], tier: 'easy' },
  { name: 'int-M3', display: 'Major 3rd', kind: 'interval', weight: 0.3,intervals: [R, M3], tier: 'easy' },
  { name: 'int-M7', display: 'Major 7th', kind: 'interval', weight: 0.3,intervals: [R, M7], tier: 'easy' },
  { name: 'maj', display: 'Major', kind: 'triad', intervals: [R, M3, P5], tier: 'easy' },
  { name: 'min', display: 'Minor', kind: 'triad', intervals: [R, m3, P5], tier: 'easy' },

  // ── MEDIUM (adds) ─────────────────────────────────────────────────────
  { name: 'int-aug4', display: 'Augmented 4th', kind: 'interval', weight: 0.3,intervals: [R, aug4], tier: 'medium' },
  { name: 'int-dim5', display: 'Diminished 5th', kind: 'interval', weight: 0.3,intervals: [R, dim5], tier: 'medium' },
  { name: 'dim', display: 'Diminished', kind: 'triad', intervals: [R, m3, dim5], tier: 'medium' },
  { name: 'aug', display: 'Augmented', kind: 'triad', intervals: [R, M3, aug5], tier: 'medium' },
  { name: 'sus2', display: 'sus2', kind: 'chord', intervals: [R, M2, P5], tier: 'medium' },
  { name: 'sus4', display: 'sus4', kind: 'chord', intervals: [R, P4, P5], tier: 'medium' },
  { name: 'min7', display: 'Minor 7th', kind: 'chord', intervals: [R, m3, P5, m7], tier: 'medium' },
  { name: 'maj7', display: 'Major 7th', kind: 'chord', intervals: [R, M3, P5, M7], tier: 'medium' },
  { name: 'dom7', display: 'Dominant 7th', kind: 'chord', intervals: [R, M3, P5, m7], tier: 'medium' },
  { name: 'maj6', display: 'Major 6th', kind: 'chord', intervals: [R, M3, P5, M6], tier: 'medium' },
  { name: 'min6', display: 'Minor 6th', kind: 'chord', intervals: [R, m3, P5, M6], tier: 'medium' },
  { name: 'min♭6', display: 'Minor ♭6', kind: 'chord', intervals: [R, m3, P5, m6], tier: 'medium' },
  { name: 'm7♭5', display: 'm7♭5', kind: 'chord', intervals: [R, m3, dim5, m7], tier: 'medium' },

  // ── HARD (adds) ───────────────────────────────────────────────────────
  { name: 'int-aug5', display: 'Augmented 5th', kind: 'interval', weight: 0.3,intervals: [R, aug5], tier: 'hard' },
  { name: 'int-aug2', display: 'Augmented 2nd', kind: 'interval', weight: 0.3,intervals: [R, aug2], tier: 'hard' },
  { name: 'int-dim7', display: 'Diminished 7th', kind: 'interval', weight: 0.3,intervals: [R, dim7], tier: 'hard' },
  { name: 'dim7', display: 'Diminished 7th', kind: 'chord', intervals: [R, m3, dim5, dim7], tier: 'hard' },
  { name: 'add9', display: 'add9', kind: 'chord', intervals: [R, M3, P5, M2], tier: 'hard' },
  { name: 'madd9', display: 'm add9', kind: 'chord', intervals: [R, m3, P5, M2], tier: 'hard' },
  { name: '6/9', display: '6/9', kind: 'chord', intervals: [R, M3, P5, M6, M2], tier: 'hard' },
  { name: 'm6/9', display: 'm6/9', kind: 'chord', intervals: [R, m3, P5, M6, M2], tier: 'hard' },
  { name: 'maj9', display: 'Major 9th', kind: 'chord', intervals: [R, M3, P5, M7, M2], tier: 'hard' },
  { name: 'dom9', display: 'Dominant 9th', kind: 'chord', intervals: [R, M3, P5, m7, M2], tier: 'hard' },
  { name: 'min9', display: 'Minor 9th', kind: 'chord', intervals: [R, m3, P5, m7, M2], tier: 'hard' },
  { name: 'min11', display: 'Minor 11th', kind: 'chord', intervals: [R, m3, m7, M2, P4], tier: 'hard', qualifier: 'no 5' },
  { name: '9sus4', display: '9sus4', kind: 'chord', intervals: [R, P4, P5, m7, M2], tier: 'hard' },
  { name: 'dom13', display: 'Dominant 13th', kind: 'chord', intervals: [R, M3, m7, M2, M6], tier: 'hard', qualifier: 'no 5' },
  { name: 'maj13', display: 'Major 13th', kind: 'chord', intervals: [R, M3, M7, M2, M6], tier: 'hard', qualifier: 'no 5' },
  { name: 'min13', display: 'Minor 13th', kind: 'chord', intervals: [R, m3, m7, M2, M6], tier: 'hard', qualifier: 'no 5' },
  { name: '7♭9', display: '7♭9', kind: 'chord', intervals: [R, M3, P5, m7, m2], tier: 'hard' },
  { name: '7♯9', display: '7♯9', kind: 'chord', intervals: [R, M3, P5, m7, aug2], tier: 'hard' },
  { name: '7♯11', display: '7♯11', kind: 'chord', intervals: [R, M3, P5, m7, aug4], tier: 'hard' },
  { name: '7♭13', display: '7♭13', kind: 'chord', intervals: [R, M3, m7, m6], tier: 'hard' }, // 5th dropped (clash)

  // ── EXPERT (adds) — docs/07-expert-mode.md ────────────────────────────
  // Extended-chord shells: reduced 4-note voicings of a 9th/13th/altered chord.
  { name: 'dom9-shell', display: 'Dominant 9th', kind: 'chord', intervals: [R, M3, m7, M2], tier: 'expert', qualifier: "ext'd shell" },
  { name: 'dom13-shell', display: 'Dominant 13th', kind: 'chord', intervals: [R, M3, m7, M6], tier: 'expert', qualifier: "ext'd shell" },
  { name: 'dom7♭9-shell', display: '7♭9', kind: 'chord', intervals: [R, M3, m7, m2], tier: 'expert', qualifier: "ext'd shell" },
  { name: 'dom7♯9-shell', display: '7♯9', kind: 'chord', intervals: [R, M3, m7, aug2], tier: 'expert', qualifier: "ext'd shell" },
  { name: 'dom7♯11-shell', display: '7♯11', kind: 'chord', intervals: [R, M3, m7, aug4], tier: 'expert', qualifier: "ext'd shell" },
  { name: 'maj9-shell', display: 'Major 9th', kind: 'chord', intervals: [R, M3, M7, M2], tier: 'expert', qualifier: "ext'd shell" },
  { name: 'maj13-shell', display: 'Major 13th', kind: 'chord', intervals: [R, M3, M7, M6], tier: 'expert', qualifier: "ext'd shell" },
  { name: 'maj7♯11-shell', display: 'maj7♯11', kind: 'chord', intervals: [R, M3, M7, aug4], tier: 'expert', qualifier: "ext'd shell" },
  { name: 'min9-shell', display: 'Minor 9th', kind: 'chord', intervals: [R, m3, m7, M2], tier: 'expert', qualifier: "ext'd shell" },
  { name: 'min11-shell', display: 'Minor 11th', kind: 'chord', intervals: [R, m3, m7, P4], tier: 'expert', qualifier: "ext'd shell" },
  { name: 'min13-shell', display: 'Minor 13th', kind: 'chord', intervals: [R, m3, m7, M6], tier: 'expert', qualifier: "ext'd shell" },
  // Rooted 5-less shells: root + guide-tones / 3–6, both orders.
  { name: 'dom7-37', display: 'Dominant 7th', kind: 'chord', intervals: [R, M3, m7], tier: 'expert', qualifier: 'shell' },
  { name: 'dom7-73', display: 'Dominant 7th', kind: 'chord', intervals: [R, m7, M3], tier: 'expert', qualifier: 'shell' },
  { name: 'min7-37', display: 'Minor 7th', kind: 'chord', intervals: [R, m3, m7], tier: 'expert', qualifier: 'shell' },
  { name: 'min7-73', display: 'Minor 7th', kind: 'chord', intervals: [R, m7, m3], tier: 'expert', qualifier: 'shell' },
  { name: 'maj7-37', display: 'Major 7th', kind: 'chord', intervals: [R, M3, M7], tier: 'expert', qualifier: 'shell' },
  { name: 'maj7-73', display: 'Major 7th', kind: 'chord', intervals: [R, M7, M3], tier: 'expert', qualifier: 'shell' },
  { name: 'maj6-36', display: 'Major 6th', kind: 'chord', intervals: [R, M3, M6], tier: 'expert', qualifier: 'shell' },
  { name: 'maj6-63', display: 'Major 6th', kind: 'chord', intervals: [R, M6, M3], tier: 'expert', qualifier: 'shell' },
  { name: 'min6-36', display: 'Minor 6th', kind: 'chord', intervals: [R, m3, M6], tier: 'expert', qualifier: 'shell' },
  { name: 'min6-63', display: 'Minor 6th', kind: 'chord', intervals: [R, M6, m3], tier: 'expert', qualifier: 'shell' },
  // Root-position jazz colors.
  { name: 'min-maj7', display: 'Minor-major 7th', kind: 'chord', intervals: [R, m3, P5, M7], tier: 'expert' },
  { name: 'maj7♯5', display: 'maj7♯5', kind: 'chord', intervals: [R, M3, aug5, M7], tier: 'expert' },
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
  // Triad inversions ⟂ (off-root; kind triad → "… Triad (…)").
  { name: 'maj-inv1', display: 'Major', kind: 'triad', intervals: [M3, P5, R], tier: 'expert', qualifier: '1st inv.' },
  { name: 'maj-inv2', display: 'Major', kind: 'triad', intervals: [P5, R, M3], tier: 'expert', qualifier: '2nd inv.' },
  { name: 'min-inv1', display: 'Minor', kind: 'triad', intervals: [m3, P5, R], tier: 'expert', qualifier: '1st inv.' },
  { name: 'min-inv2', display: 'Minor', kind: 'triad', intervals: [P5, R, m3], tier: 'expert', qualifier: '2nd inv.' },
  { name: 'dim-inv1', display: 'Diminished', kind: 'triad', intervals: [m3, dim5, R], tier: 'expert', qualifier: '1st inv.' },
  { name: 'dim-inv2', display: 'Diminished', kind: 'triad', intervals: [dim5, R, m3], tier: 'expert', qualifier: '2nd inv.' },
  { name: 'aug-inv1', display: 'Augmented', kind: 'triad', intervals: [M3, aug5, R], tier: 'expert', qualifier: '1st inv.' },
  { name: 'aug-inv2', display: 'Augmented', kind: 'triad', intervals: [aug5, R, M3], tier: 'expert', qualifier: '2nd inv.' },
  // Triad open re-voicings ⟂ — 3–R–5 (1st inv.), R–5–3 (root), 5–3–R (2nd inv.).
  { name: 'maj-3r5', display: 'Major', kind: 'triad', intervals: [M3, R, P5], tier: 'expert', qualifier: '1st inv., open' },
  { name: 'min-3r5', display: 'Minor', kind: 'triad', intervals: [m3, R, P5], tier: 'expert', qualifier: '1st inv., open' },
  { name: 'dim-3r5', display: 'Diminished', kind: 'triad', intervals: [m3, R, dim5], tier: 'expert', qualifier: '1st inv., open' },
  { name: 'aug-3r5', display: 'Augmented', kind: 'triad', intervals: [M3, R, aug5], tier: 'expert', qualifier: '1st inv., open' },
  { name: 'maj-r53', display: 'Major', kind: 'triad', intervals: [R, P5, M3], tier: 'expert', qualifier: 'open' },
  { name: 'min-r53', display: 'Minor', kind: 'triad', intervals: [R, P5, m3], tier: 'expert', qualifier: 'open' },
  { name: 'dim-r53', display: 'Diminished', kind: 'triad', intervals: [R, dim5, m3], tier: 'expert', qualifier: 'open' },
  { name: 'aug-r53', display: 'Augmented', kind: 'triad', intervals: [R, aug5, M3], tier: 'expert', qualifier: 'open' },
  { name: 'maj-53r', display: 'Major', kind: 'triad', intervals: [P5, M3, R], tier: 'expert', qualifier: '2nd inv., open' },
  { name: 'min-53r', display: 'Minor', kind: 'triad', intervals: [P5, m3, R], tier: 'expert', qualifier: '2nd inv., open' },
  { name: 'dim-53r', display: 'Diminished', kind: 'triad', intervals: [dim5, m3, R], tier: 'expert', qualifier: '2nd inv., open' },
  { name: 'aug-53r', display: 'Augmented', kind: 'triad', intervals: [aug5, M3, R], tier: 'expert', qualifier: '2nd inv., open' },
  // Rootless guide-tone pairs ⟂ — the 3–7 of the implied chord (played over its
  // implied-root bass); named by that chord.
  { name: 'gt-dom-37', display: 'Dominant 7th', kind: 'chord', intervals: [M3, m7], tier: 'expert', weight: 0.3, qualifier: 'guide tone pair' },
  { name: 'gt-dom-73', display: 'Dominant 7th', kind: 'chord', intervals: [m7, M3], tier: 'expert', weight: 0.3, qualifier: 'guide tone pair' },
  { name: 'gt-min-37', display: 'Minor 7th', kind: 'chord', intervals: [m3, m7], tier: 'expert', weight: 0.3, qualifier: 'guide tone pair' },
  { name: 'gt-min-73', display: 'Minor 7th', kind: 'chord', intervals: [m7, m3], tier: 'expert', weight: 0.3, qualifier: 'guide tone pair' },
  { name: 'gt-maj-37', display: 'Major 7th', kind: 'chord', intervals: [M3, M7], tier: 'expert', weight: 0.3, qualifier: 'guide tone pair' },
  { name: 'gt-maj-73', display: 'Major 7th', kind: 'chord', intervals: [M7, M3], tier: 'expert', weight: 0.3, qualifier: 'guide tone pair' },
  // Rootless 3–6 dyads ⟂ — the 3rd + 6th of the implied 6th chord.
  { name: 'd36-maj', display: 'Major 6th', kind: 'chord', intervals: [M3, M6], tier: 'expert', weight: 0.3, qualifier: '3/6 dyad' },
  { name: 'd36-maj-r', display: 'Major 6th', kind: 'chord', intervals: [M6, M3], tier: 'expert', weight: 0.3, qualifier: '3/6 dyad' },
  { name: 'd36-min', display: 'Minor 6th', kind: 'chord', intervals: [m3, M6], tier: 'expert', weight: 0.3, qualifier: '3/6 dyad' },
  { name: 'd36-min-r', display: 'Minor 6th', kind: 'chord', intervals: [M6, m3], tier: 'expert', weight: 0.3, qualifier: '3/6 dyad' },
  { name: 'd36-mb6', display: 'Minor ♭6', kind: 'chord', intervals: [m3, m6], tier: 'expert', weight: 0.3, qualifier: '3/6 dyad' },
  { name: 'd36-mb6-r', display: 'Minor ♭6', kind: 'chord', intervals: [m6, m3], tier: 'expert', weight: 0.3, qualifier: '3/6 dyad' },
  // Rootless 4-note A/B voicings ⟂.
  { name: 'min9-rlA', display: 'Minor 9th', kind: 'chord', intervals: [m3, P5, m7, M2], tier: 'expert', qualifier: 'rootless A' },
  { name: 'min9-rlB', display: 'Minor 9th', kind: 'chord', intervals: [m7, M2, m3, P5], tier: 'expert', qualifier: 'rootless B' },
  { name: 'dom13-rlA', display: 'Dominant 13th', kind: 'chord', intervals: [M3, M6, m7, M2], tier: 'expert', qualifier: 'rootless A' },
  { name: 'dom13-rlB', display: 'Dominant 13th', kind: 'chord', intervals: [m7, M2, M3, M6], tier: 'expert', qualifier: 'rootless B' },
  { name: 'maj9-rlA', display: 'Major 9th', kind: 'chord', intervals: [M3, P5, M7, M2], tier: 'expert', qualifier: 'rootless A' },
  { name: 'maj9-rlB', display: 'Major 9th', kind: 'chord', intervals: [M7, M2, M3, P5], tier: 'expert', qualifier: 'rootless B' },
];

/** Patterns available at `tier` (cumulative: easy ⊂ medium ⊂ hard ⊂ expert). */
export function bankForTier(tier: Tier): Pattern[] {
  return BANK.filter((p) => TIER_RANK[p.tier] <= TIER_RANK[tier]);
}
