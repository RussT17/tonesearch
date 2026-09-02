// harmony.config.ts — the key-aware generation config, authored entirely in
// musical terms (docs/09). harmony.ts parses these tokens into line-of-fifths
// integers and runs the draw; this file is meant to be human-edited.
//
// TOKENS
//   tones / tone-sets: intervals from the CHORD ROOT, as interval names —
//     R m2 M2 A2 m3 M3 P4 A4 d5 P5 A5 m6 M6 d7 m7 M7  (A = augmented, d = diminished)
//   scale degrees: intervals from the TONIC, as scale-degree names —
//     '1' '♭2' '2' '♭3' '3' '4' '♯4' '♭5' '5' '♭6' '6' '♭7' '7'
//   key signatures: 'all_natural', '1_sharp'…'6_sharp', '1_flat'…'6_flat'
//
// TUNING STATUS: SCALE_DEGREE_TONE_SETS and each tier's `modes` + `degrees` weights
// are a considered music-theory tuning pass (still refine freely). The per-pack
// weights, the commonness-level weights, and the key-signature weights remain rough
// placeholders. // TODO(tuning): pack / commonness / key weights.

import type { Kind, Tier } from './pattern';
import type { Mode } from './theory';

export type Commonness = 'ultra' | 'very' | 'somewhat' | 'occasional';

/** A pattern authored in music: `tones` are intervals from the chord root. */
export interface PatternSpec {
  display: string;
  kind: Kind;
  qualifier?: string;
  tones: string[];
}

/** A tone-set on a degree, with the commonness it confers. `toneSet` is EITHER a
 * name from TONE_SETS OR an inline tone list — a tone-set need not be a scale. */
export interface ToneSetRef {
  toneSet: string | string[];
  floor: Commonness;
}

/** One difficulty tier, fully self-contained: gating (which modes/keys/degrees/
 * packs/commonness levels are on) AND their weights, in one place. */
export interface TierConfig {
  modes: Partial<Record<Mode, number>>;
  keys: Partial<Record<Mode, Record<string, number>>>; // key-signature weights, per mode
  degrees: Partial<Record<Mode, Record<string, number>>>;
  commonness: Partial<Record<Commonness, number>>;
  packs: Record<string, number>;
}

// ── Named tone-sets (a readability helper) ──────────────────────────────────
// Reusable named sets referenced by SCALE_DEGREE_TONE_SETS. Mostly modes, but a
// tone-set is just "the tones allowed here" — a degree may reference an inline
// list instead (or one of the tight helper sets below) when a whole scale would be
// too generous.
export const TONE_SETS: Record<string, string[]> = {
  ionian: ['R', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7'],
  dorian: ['R', 'M2', 'm3', 'P4', 'P5', 'M6', 'm7'],
  phrygian: ['R', 'm2', 'm3', 'P4', 'P5', 'm6', 'm7'],
  lydian: ['R', 'M2', 'M3', 'A4', 'P5', 'M6', 'M7'],
  mixolydian: ['R', 'M2', 'M3', 'P4', 'P5', 'M6', 'm7'], // dominant: I7, V7 …
  aeolian: ['R', 'M2', 'm3', 'P4', 'P5', 'm6', 'm7'],
  locrian: ['R', 'm2', 'm3', 'P4', 'd5', 'm6', 'm7'],
  harmonic_minor: ['R', 'M2', 'm3', 'P4', 'P5', 'm6', 'M7'],
  phrygian_dominant: ['R', 'm2', 'M3', 'P4', 'P5', 'm6', 'm7'], // V in minor (harmonic)
  lydian_dominant: ['R', 'M2', 'M3', 'A4', 'P5', 'M6', 'm7'], // ♯11 dominant / IV7
  altered: ['R', 'm2', 'A2', 'M3', 'd5', 'A5', 'm7'], // altered dominant colors (super-Locrian: ♭9 ♯9 M3 ♭5 ♯5 ♭7)
  diminished_seventh: ['R', 'M2', 'm3', 'P4', 'd5', 'm6', 'd7'], // vii°7
  // Melodic minor (ascending): the tonic-minor color that raises BOTH 6 and 7.
  // Coherent (single m3, single M7). Admits i, i6, i(maj7), i6/9, m(add9) — the
  // "jazz minor" / classical melodic-minor tonic.
  melodic_minor: ['R', 'M2', 'm3', 'P4', 'P5', 'M6', 'M7'],
  // Ionian ♯5 — the local mode on the augmented mediant (♭III root of harmonic
  // minor). Its signature chords are the augmented triad and maj7♯5; the only
  // source of A5 that still carries a M7 (so it, not `altered`, covers maj7♯5).
  ionian_augmented: ['R', 'M2', 'M3', 'P4', 'A5', 'M6', 'M7'],
  // A deliberately BROAD "loose net" for fully-loaded altered dominants, used only
  // at 'occasional'. Every UPPER alteration that keeps the plain 3rd/5th spelling
  // on a dominant frame (M3 + P5 + m7): ♭9(m2) ♯9(A2) ♯11(A4) ♭13(m6). Coherent —
  // one third, one seventh, no ♯5/♭5 clash with P5. Lets the ♯9-family voicings
  // (7♯9, 7♯9♭13, 7♯9♯11, 7♭9♯11) appear rarely.
  dominant_altered: ['R', 'm2', 'A2', 'M3', 'A4', 'P5', 'm6', 'm7'],
  // Dominant / half-whole-diminished (HW octatonic): the ♭9 / ♯9 / ♯11 palette that
  // keeps the NATURAL 13 (M6) — distinct from `dominant_altered`, which carries the
  // ♭13 (m6) instead. Lets 13♭9 / 13♯9 appear. One third (M3), one seventh (m7).
  dominant_diminished: ['R', 'm2', 'A2', 'M3', 'A4', 'P5', 'M6', 'm7'],
  // Plain triads as tight sets — so a degree can rank the bare triad on its own,
  // above any fuller chord a whole scale would also admit.
  major_triad: ['R', 'M3', 'P5'],
  minor_triad: ['R', 'm3', 'P5'],
  // Applied-dominant core: a plain secondary dominant (dom7, optionally +9), tight
  // so only the common V/x reading is lifted — fuller/altered flavors stay a floor
  // below in `mixolydian`. Coherent (one third, one seventh).
  applied_dominant_core: ['R', 'M2', 'M3', 'P5', 'm7'],
  // Dominant ♭9 core: the ♭9 dominant isolated, so V7♭9 can rank above the ♭13 /
  // fully-altered flavors. One third, one seventh.
  dominant_flat9_core: ['R', 'M3', 'P5', 'm7', 'm2'],
  // Minor subdominant with its 6th — the "minor plagal" color (iv6). Tight, so it
  // lifts the minor triad and its 6th only; the fuller Dorian iv stays lower.
  minor_sixth_triad: ['R', 'm3', 'P5', 'M6'],
};

// ── Packs: curated groups; each defines its own patterns (tones from the root).
// Pack ids are plain snake_case identifiers. // TODO(tuning): grouping is a
// first cut. (Seeded from the former bank.ts — 118 patterns, nothing lost.)
export const PACKS: Record<string, PatternSpec[]> = {
  simple_intervals: [
    { display: 'Minor 2nd', kind: 'interval', tones: ['R', 'm2'] },
    { display: 'Minor 6th', kind: 'interval', tones: ['R', 'm6'] },
    { display: 'Minor 3rd', kind: 'interval', tones: ['R', 'm3'] },
    { display: 'Minor 7th', kind: 'interval', tones: ['R', 'm7'] },
    { display: 'Perfect 4th', kind: 'interval', tones: ['R', 'P4'] },
    { display: 'Perfect 5th', kind: 'interval', tones: ['R', 'P5'] },
    { display: 'Major 2nd', kind: 'interval', tones: ['R', 'M2'] },
    { display: 'Major 6th', kind: 'interval', tones: ['R', 'M6'] },
    { display: 'Major 3rd', kind: 'interval', tones: ['R', 'M3'] },
    { display: 'Major 7th', kind: 'interval', tones: ['R', 'M7'] },
  ],
  tritone_intervals: [
    { display: 'Augmented 4th', kind: 'interval', tones: ['R', 'A4'] },
    { display: 'Diminished 5th', kind: 'interval', tones: ['R', 'd5'] },
  ],
  augmented_diminished_intervals: [
    { display: 'Augmented 5th', kind: 'interval', tones: ['R', 'A5'] },
    { display: 'Augmented 2nd', kind: 'interval', tones: ['R', 'A2'] },
    { display: 'Diminished 7th', kind: 'interval', tones: ['R', 'd7'] },
  ],
  triads: [
    { display: 'Major', kind: 'triad', tones: ['R', 'M3', 'P5'] },
    { display: 'Minor', kind: 'triad', tones: ['R', 'm3', 'P5'] },
    { display: 'Diminished', kind: 'triad', tones: ['R', 'm3', 'd5'] },
    { display: 'Augmented', kind: 'triad', tones: ['R', 'M3', 'A5'] },
  ],
  suspended_triads: [
    { display: 'sus2', kind: 'chord', tones: ['R', 'M2', 'P5'] },
    { display: 'sus4', kind: 'chord', tones: ['R', 'P4', 'P5'] },
  ],
  sevenths: [
    { display: 'Minor 7th', kind: 'chord', tones: ['R', 'm3', 'P5', 'm7'] },
    { display: 'Major 7th', kind: 'chord', tones: ['R', 'M3', 'P5', 'M7'] },
    { display: 'Dominant 7th', kind: 'chord', tones: ['R', 'M3', 'P5', 'm7'] },
    { display: 'm7♭5', kind: 'chord', tones: ['R', 'm3', 'd5', 'm7'] },
    { display: 'Diminished 7th', kind: 'chord', tones: ['R', 'm3', 'd5', 'd7'] },
  ],
  sixths: [
    { display: 'Major 6th', kind: 'chord', tones: ['R', 'M3', 'P5', 'M6'] },
    { display: 'Minor 6th', kind: 'chord', tones: ['R', 'm3', 'P5', 'M6'] },
    { display: 'Minor ♭6', kind: 'chord', tones: ['R', 'm3', 'P5', 'm6'] },
  ],
  pentatonic_scales: [
    { display: 'Major Pentatonic', kind: 'scale', tones: ['R', 'M2', 'M3', 'P5', 'M6'] },
    { display: 'Minor Pentatonic', kind: 'scale', tones: ['R', 'm3', 'P4', 'P5', 'm7'] },
  ],
  extended_chords: [
    { display: 'add9', kind: 'chord', tones: ['R', 'M3', 'P5', 'M2'] },
    { display: 'm add9', kind: 'chord', tones: ['R', 'm3', 'P5', 'M2'] },
    { display: '6/9', kind: 'chord', tones: ['R', 'M3', 'P5', 'M6', 'M2'] },
    { display: 'm6/9', kind: 'chord', tones: ['R', 'm3', 'P5', 'M6', 'M2'] },
    { display: 'Major 9th', kind: 'chord', tones: ['R', 'M3', 'P5', 'M7', 'M2'] },
    { display: 'Dominant 9th', kind: 'chord', tones: ['R', 'M3', 'P5', 'm7', 'M2'] },
    { display: 'Minor 9th', kind: 'chord', tones: ['R', 'm3', 'P5', 'm7', 'M2'] },
    { display: 'Minor 11th', kind: 'chord', qualifier: 'no 5', tones: ['R', 'm3', 'm7', 'M2', 'P4'] },
    { display: '9sus4', kind: 'chord', tones: ['R', 'P4', 'P5', 'm7', 'M2'] },
    { display: 'Dominant 13th', kind: 'chord', qualifier: 'no 5', tones: ['R', 'M3', 'm7', 'M2', 'M6'] },
    { display: 'Major 13th', kind: 'chord', qualifier: 'no 5', tones: ['R', 'M3', 'M7', 'M2', 'M6'] },
    { display: 'Minor 13th', kind: 'chord', qualifier: 'no 5', tones: ['R', 'm3', 'm7', 'M2', 'M6'] },
    { display: 'maj7♯11', kind: 'chord', tones: ['R', 'M3', 'P5', 'M7', 'A4'] },
    { display: 'Minor-major 9th', kind: 'chord', tones: ['R', 'm3', 'P5', 'M7', 'M2'] },
  ],
  altered_dominants: [
    { display: '7♭9', kind: 'chord', tones: ['R', 'M3', 'P5', 'm7', 'm2'] },
    { display: '7♯9', kind: 'chord', tones: ['R', 'M3', 'P5', 'm7', 'A2'] },
    { display: '7♯11', kind: 'chord', tones: ['R', 'M3', 'P5', 'm7', 'A4'] },
    { display: '7♭13', kind: 'chord', tones: ['R', 'M3', 'm7', 'm6'] },
    { display: '7♯5', kind: 'chord', tones: ['R', 'M3', 'A5', 'm7'] },
    { display: '7♭5', kind: 'chord', tones: ['R', 'M3', 'd5', 'm7'] },
    { display: '7♯9♭13', kind: 'chord', tones: ['R', 'M3', 'm7', 'A2', 'm6'] },
    { display: '7♭9♭13', kind: 'chord', tones: ['R', 'M3', 'm7', 'm2', 'm6'] },
    { display: '7♭9♯11', kind: 'chord', tones: ['R', 'M3', 'm7', 'm2', 'A4'] },
    { display: '7♯9♯11', kind: 'chord', tones: ['R', 'M3', 'm7', 'A2', 'A4'] },
    { display: '9♯11', kind: 'chord', tones: ['R', 'M3', 'm7', 'M2', 'A4'] },
    { display: '13♭9', kind: 'chord', tones: ['R', 'M3', 'm7', 'm2', 'M6'] },
    { display: '7♯5♭9', kind: 'chord', tones: ['R', 'M3', 'A5', 'm7', 'm2'] },
    { display: '7♯5♯9', kind: 'chord', tones: ['R', 'M3', 'A5', 'm7', 'A2'] },
  ],
  inverted_triads: [
    { display: 'Major', kind: 'triad', qualifier: '1st inv.', tones: ['M3', 'P5', 'R'] },
    { display: 'Major', kind: 'triad', qualifier: '2nd inv.', tones: ['P5', 'R', 'M3'] },
    { display: 'Minor', kind: 'triad', qualifier: '1st inv.', tones: ['m3', 'P5', 'R'] },
    { display: 'Minor', kind: 'triad', qualifier: '2nd inv.', tones: ['P5', 'R', 'm3'] },
    { display: 'Diminished', kind: 'triad', qualifier: '1st inv.', tones: ['m3', 'd5', 'R'] },
    { display: 'Diminished', kind: 'triad', qualifier: '2nd inv.', tones: ['d5', 'R', 'm3'] },
    { display: 'Augmented', kind: 'triad', qualifier: '1st inv.', tones: ['M3', 'A5', 'R'] },
    { display: 'Augmented', kind: 'triad', qualifier: '2nd inv.', tones: ['A5', 'R', 'M3'] },
  ],
  open_triads: [
    { display: 'Major', kind: 'triad', qualifier: '1st inv., open', tones: ['M3', 'R', 'P5'] },
    { display: 'Minor', kind: 'triad', qualifier: '1st inv., open', tones: ['m3', 'R', 'P5'] },
    { display: 'Diminished', kind: 'triad', qualifier: '1st inv., open', tones: ['m3', 'R', 'd5'] },
    { display: 'Augmented', kind: 'triad', qualifier: '1st inv., open', tones: ['M3', 'R', 'A5'] },
    { display: 'Major', kind: 'triad', qualifier: 'open', tones: ['R', 'P5', 'M3'] },
    { display: 'Minor', kind: 'triad', qualifier: 'open', tones: ['R', 'P5', 'm3'] },
    { display: 'Diminished', kind: 'triad', qualifier: 'open', tones: ['R', 'd5', 'm3'] },
    { display: 'Augmented', kind: 'triad', qualifier: 'open', tones: ['R', 'A5', 'M3'] },
    { display: 'Major', kind: 'triad', qualifier: '2nd inv., open', tones: ['P5', 'M3', 'R'] },
    { display: 'Minor', kind: 'triad', qualifier: '2nd inv., open', tones: ['P5', 'm3', 'R'] },
    { display: 'Diminished', kind: 'triad', qualifier: '2nd inv., open', tones: ['d5', 'm3', 'R'] },
    { display: 'Augmented', kind: 'triad', qualifier: '2nd inv., open', tones: ['A5', 'M3', 'R'] },
  ],
  rooted_shells: [
    { display: 'Dominant 7th', kind: 'chord', qualifier: 'shell', tones: ['R', 'M3', 'm7'] },
    { display: 'Dominant 7th', kind: 'chord', qualifier: 'shell', tones: ['R', 'm7', 'M3'] },
    { display: 'Minor 7th', kind: 'chord', qualifier: 'shell', tones: ['R', 'm3', 'm7'] },
    { display: 'Minor 7th', kind: 'chord', qualifier: 'shell', tones: ['R', 'm7', 'm3'] },
    { display: 'Major 7th', kind: 'chord', qualifier: 'shell', tones: ['R', 'M3', 'M7'] },
    { display: 'Major 7th', kind: 'chord', qualifier: 'shell', tones: ['R', 'M7', 'M3'] },
    { display: 'Major 6th', kind: 'chord', qualifier: 'shell', tones: ['R', 'M3', 'M6'] },
    { display: 'Major 6th', kind: 'chord', qualifier: 'shell', tones: ['R', 'M6', 'M3'] },
    { display: 'Minor 6th', kind: 'chord', qualifier: 'shell', tones: ['R', 'm3', 'M6'] },
    { display: 'Minor 6th', kind: 'chord', qualifier: 'shell', tones: ['R', 'M6', 'm3'] },
  ],
  extended_shells: [
    { display: 'Dominant 9th', kind: 'chord', qualifier: "ext'd shell", tones: ['R', 'M3', 'm7', 'M2'] },
    { display: 'Dominant 13th', kind: 'chord', qualifier: "ext'd shell", tones: ['R', 'M3', 'm7', 'M6'] },
    { display: '7♭9', kind: 'chord', qualifier: "ext'd shell", tones: ['R', 'M3', 'm7', 'm2'] },
    { display: '7♯9', kind: 'chord', qualifier: "ext'd shell", tones: ['R', 'M3', 'm7', 'A2'] },
    { display: '7♯11', kind: 'chord', qualifier: "ext'd shell", tones: ['R', 'M3', 'm7', 'A4'] },
    { display: 'Major 9th', kind: 'chord', qualifier: "ext'd shell", tones: ['R', 'M3', 'M7', 'M2'] },
    { display: 'Major 13th', kind: 'chord', qualifier: "ext'd shell", tones: ['R', 'M3', 'M7', 'M6'] },
    { display: 'maj7♯11', kind: 'chord', qualifier: "ext'd shell", tones: ['R', 'M3', 'M7', 'A4'] },
    { display: 'Minor 9th', kind: 'chord', qualifier: "ext'd shell", tones: ['R', 'm3', 'm7', 'M2'] },
    { display: 'Minor 11th', kind: 'chord', qualifier: "ext'd shell", tones: ['R', 'm3', 'm7', 'P4'] },
    { display: 'Minor 13th', kind: 'chord', qualifier: "ext'd shell", tones: ['R', 'm3', 'm7', 'M6'] },
  ],
  guide_tone_dyads: [
    { display: 'Dominant 7th', kind: 'chord', qualifier: 'guide tone pair', tones: ['M3', 'm7'] },
    { display: 'Dominant 7th', kind: 'chord', qualifier: 'guide tone pair', tones: ['m7', 'M3'] },
    { display: 'Minor 7th', kind: 'chord', qualifier: 'guide tone pair', tones: ['m3', 'm7'] },
    { display: 'Minor 7th', kind: 'chord', qualifier: 'guide tone pair', tones: ['m7', 'm3'] },
    { display: 'Major 7th', kind: 'chord', qualifier: 'guide tone pair', tones: ['M3', 'M7'] },
    { display: 'Major 7th', kind: 'chord', qualifier: 'guide tone pair', tones: ['M7', 'M3'] },
  ],
  sixth_dyads: [
    { display: 'Major 6th', kind: 'chord', qualifier: '3/6 dyad', tones: ['M3', 'M6'] },
    { display: 'Major 6th', kind: 'chord', qualifier: '3/6 dyad', tones: ['M6', 'M3'] },
    { display: 'Minor 6th', kind: 'chord', qualifier: '3/6 dyad', tones: ['m3', 'M6'] },
    { display: 'Minor 6th', kind: 'chord', qualifier: '3/6 dyad', tones: ['M6', 'm3'] },
    { display: 'Minor ♭6', kind: 'chord', qualifier: '3/6 dyad', tones: ['m3', 'm6'] },
    { display: 'Minor ♭6', kind: 'chord', qualifier: '3/6 dyad', tones: ['m6', 'm3'] },
  ],
  color_chords: [
    { display: 'Minor-major 7th', kind: 'chord', tones: ['R', 'm3', 'P5', 'M7'] },
    { display: 'maj7♯5', kind: 'chord', tones: ['R', 'M3', 'A5', 'M7'] },
    { display: 'Quartal', kind: 'chord', tones: ['R', 'P4', 'm7', 'm3'] },
    { display: 'Quintal', kind: 'chord', tones: ['R', 'P5', 'M2', 'M6'] },
    { display: '7sus4', kind: 'chord', tones: ['R', 'P4', 'P5', 'm7'] },
    { display: '13sus4', kind: 'chord', tones: ['R', 'P4', 'm7', 'M2', 'M6'] },
    { display: 'add4', kind: 'chord', tones: ['R', 'M3', 'P4', 'P5'] },
    { display: 'add♯4', kind: 'chord', tones: ['R', 'M3', 'A4', 'P5'] },
    { display: 'sus♭2', kind: 'chord', tones: ['R', 'm2', 'P5'] },
  ],
  rootless_voicings: [
    { display: 'Minor 9th', kind: 'chord', qualifier: 'rootless A', tones: ['m3', 'P5', 'm7', 'M2'] },
    { display: 'Minor 9th', kind: 'chord', qualifier: 'rootless B', tones: ['m7', 'M2', 'm3', 'P5'] },
    { display: 'Dominant 13th', kind: 'chord', qualifier: 'rootless A', tones: ['M3', 'M6', 'm7', 'M2'] },
    { display: 'Dominant 13th', kind: 'chord', qualifier: 'rootless B', tones: ['m7', 'M2', 'M3', 'M6'] },
    { display: 'Major 9th', kind: 'chord', qualifier: 'rootless A', tones: ['M3', 'P5', 'M7', 'M2'] },
    { display: 'Major 9th', kind: 'chord', qualifier: 'rootless B', tones: ['M7', 'M2', 'M3', 'P5'] },
  ],
  // Seventh-chord inversions (bottom-to-top voicing). The dim7 entries are aurally
  // identical across inversions (symmetric) but are DISTINCT note-name spellings /
  // paths, like the augmented triad inversions — kept for the spelling puzzle.
  seventh_inversions: [
    { display: 'Dominant 7th', kind: 'chord', qualifier: '1st inv.', tones: ['M3', 'P5', 'm7', 'R'] },
    { display: 'Dominant 7th', kind: 'chord', qualifier: '2nd inv.', tones: ['P5', 'm7', 'R', 'M3'] },
    { display: 'Dominant 7th', kind: 'chord', qualifier: '3rd inv.', tones: ['m7', 'R', 'M3', 'P5'] },
    { display: 'Major 7th', kind: 'chord', qualifier: '1st inv.', tones: ['M3', 'P5', 'M7', 'R'] },
    { display: 'Major 7th', kind: 'chord', qualifier: '2nd inv.', tones: ['P5', 'M7', 'R', 'M3'] },
    { display: 'Major 7th', kind: 'chord', qualifier: '3rd inv.', tones: ['M7', 'R', 'M3', 'P5'] },
    { display: 'Minor 7th', kind: 'chord', qualifier: '1st inv.', tones: ['m3', 'P5', 'm7', 'R'] },
    { display: 'Minor 7th', kind: 'chord', qualifier: '2nd inv.', tones: ['P5', 'm7', 'R', 'm3'] },
    { display: 'Minor 7th', kind: 'chord', qualifier: '3rd inv.', tones: ['m7', 'R', 'm3', 'P5'] },
    { display: 'm7♭5', kind: 'chord', qualifier: '1st inv.', tones: ['m3', 'd5', 'm7', 'R'] },
    { display: 'm7♭5', kind: 'chord', qualifier: '2nd inv.', tones: ['d5', 'm7', 'R', 'm3'] },
    { display: 'm7♭5', kind: 'chord', qualifier: '3rd inv.', tones: ['m7', 'R', 'm3', 'd5'] },
    { display: 'Diminished 7th', kind: 'chord', qualifier: '1st inv.', tones: ['m3', 'd5', 'd7', 'R'] },
    { display: 'Diminished 7th', kind: 'chord', qualifier: '2nd inv.', tones: ['d5', 'd7', 'R', 'm3'] },
    { display: 'Diminished 7th', kind: 'chord', qualifier: '3rd inv.', tones: ['d7', 'R', 'm3', 'd5'] },
  ],
};

// ── Per-(mode, degree) tone-sets → commonness floors ────────────────────────
// Keyed by scale-degree token. A pattern's commonness on a degree = the highest
// floor whose tone-set fully contains its tones; unlisted degrees / non-matching
// patterns can't appear there.
//
// HOW TO READ THIS TABLE
//  • A tone-set is a set of intervals FROM THE CHORD ROOT (the note sitting on
//    that scale degree), NOT from the key tonic. The diatonic set on a degree,
//    spelled from its own root, is that degree's LOCAL MODE (major-'4' → Lydian,
//    major-'5' → Mixolydian, minor-'1' → Aeolian, etc.). We start from the local
//    mode at 'ultra', then layer borrowed / altered colors at lower floors.
//  • Floors rank the CHORD TYPES available on a degree by how often, GIVEN a chord
//    is built here, it is that type. (The tier tables rank the DEGREES themselves,
//    separately — so a degree's plain native chord earns 'ultra' even on a rare
//    degree; the degree's own rarity is handled by degree weight, not here.)
//      ultra      = the native chord(s): diatonic triad / seventh and their
//                   pentatonic / add-tone / extension subsets.
//      very       = very common though a notch off the plain triad/7th (e.g. a
//                   common secondary dominant, V7♭9, the borrowed dim7).
//      somewhat   = a characteristic color / common modal-mixture reading.
//      occasional = chromatic, altered, or genuinely rare voicings.
//  • Enharmonics are DISTINCT on the line of fifths, so spelling is load-bearing:
//    A4(♯11) ≠ d5(♭5), A5(♯5) ≠ m6(♭13), A2(♯9) ≠ m3. A set admits only the
//    spelling it literally lists — this is what lets, e.g., a ♯11 dominant and a
//    ♭5 dominant sit at different floors via different sets.
//  • GRANULARITY: where a whole scale would over-admit, a tight set sits high and a
//    looser set low, so ADDING a specific tone drops commonness. (See major '4'.)
//  • No single set contains both m3 and M3, or both m7 and M7. Where a degree needs
//    both (say) a dominant-7 and a maj7 flavor, they are two SEPARATE sets.
export const SCALE_DEGREE_TONE_SETS: Record<Mode, Record<string, ToneSetRef[]>> = {
  // ───────────────────────────── MAJOR KEY ──────────────────────────────────
  major: {
    // I — tonic. Local mode Ionian (I, Imaj7, I6, I6/9, Iadd9, Imaj9/13, sus,
    // major pentatonic → ultra).
    //  • lydian (occasional): the Lydian tonic — Imaj7♯11 / I6/9(♯11), an
    //    idiom-specific jazz / film color.
    //  • mixolydian (somewhat): the dominant tonic I7 / I9 / I13 (blues/gospel/rock,
    //    functionally V/IV).
    //  • aeolian (occasional): parallel-minor tonic i / minor-pentatonic blues over I.
    //  • ionian_augmented (occasional): the chromatic I+ passing chord (I–I+–I6/vi).
    '1': [
      { toneSet: 'ionian', floor: 'ultra' },
      { toneSet: 'lydian', floor: 'occasional' },
      { toneSet: 'mixolydian', floor: 'somewhat' },
      { toneSet: 'aeolian', floor: 'occasional' },
      { toneSet: 'ionian_augmented', floor: 'occasional' },
    ],
    // ii — supertonic minor. Local mode Dorian (ii, ii7, ii6, ii9/11/13, m6/9,
    // quartal → ultra).
    //  • applied_dominant_core (very): V/V — II7 / II9, one of the most common
    //    chromatic chords in tonal music.
    //  • mixolydian (somewhat): the fuller / sus / 13 shades of that V/V.
    //  • aeolian (occasional): the borrowed ♭6-above-root color.
    '2': [
      { toneSet: 'dorian', floor: 'ultra' },
      { toneSet: 'applied_dominant_core', floor: 'very' },
      { toneSet: 'mixolydian', floor: 'somewhat' },
      { toneSet: 'aeolian', floor: 'occasional' },
    ],
    // iii — mediant minor. Local mode Phrygian (iii, iii7, iii(♭6), sus4 → ultra;
    // the ♭2 above the root blocks sus2 / add9).
    //  • applied_dominant_core (very): V/vi — III7 (E7→Am in C).
    //  • mixolydian (somewhat): fuller / extended V/vi.
    //  • aeolian (occasional): the raised-2 (Dorian / borrowed) add9 / min9 reading.
    '3': [
      { toneSet: 'phrygian', floor: 'ultra' },
      { toneSet: 'applied_dominant_core', floor: 'very' },
      { toneSet: 'mixolydian', floor: 'somewhat' },
      { toneSet: 'aeolian', floor: 'occasional' },
    ],
    // IV — subdominant. Local mode Lydian (IV, IVmaj7, IV6/9, IVadd9, IVmaj9/13 and
    // the diatonic maj7♯11 → ultra). Lydian has ♯4 not P4, so IVsus4 / IV7 — needing
    // the non-diatonic ♭7-of-key P4 above IV — come in below.
    //  • minor_triad (very): the modal-mixture minor iv triad — a signature color
    //    across pop / rock / ballad / classical (the "minor plagal").
    //  • minor_sixth_triad (somewhat): iv6 — adding the 6th makes it a shade rarer.
    //  • lydian_dominant (somewhat): IV7♯11 — the bright blues / backdoor IV dominant.
    //  • mixolydian (somewhat): plain IV7 / IVsus4 / IV9 / IV13 (restores P4).
    //  • dorian (occasional): the full minor iv with m7 / 9 / 11 / 13.
    '4': [
      { toneSet: 'lydian', floor: 'ultra' },
      { toneSet: 'minor_triad', floor: 'very' },
      { toneSet: 'minor_sixth_triad', floor: 'somewhat' },
      { toneSet: 'lydian_dominant', floor: 'somewhat' },
      { toneSet: 'mixolydian', floor: 'somewhat' },
      { toneSet: 'dorian', floor: 'occasional' },
    ],
    // V — dominant. Local mode Mixolydian (V, V7, V9, V13, Vsus4/2, V6, major
    // pentatonic → ultra).
    //  • dominant_flat9_core (very): V7♭9 — the ubiquitous cadential dominant.
    //  • phrygian_dominant (somewhat): the ♭13 flavors — V7♭13 / V7♭9♭13.
    //  • lydian_dominant (occasional): V7♯11.
    //  • altered (occasional): V7♭5 / V7♯5 / V+.
    //  • dominant_altered (occasional): the ♯9 family (7♯9, 7♯9♭13, 7♯9♯11, 7♭9♯11).
    '5': [
      { toneSet: 'mixolydian', floor: 'ultra' },
      { toneSet: 'dominant_flat9_core', floor: 'very' },
      { toneSet: 'phrygian_dominant', floor: 'somewhat' },
      { toneSet: 'lydian_dominant', floor: 'occasional' },
      { toneSet: 'altered', floor: 'occasional' },
      { toneSet: 'dominant_altered', floor: 'occasional' },
      { toneSet: 'dominant_diminished', floor: 'occasional' }, // 13♭9 / 13♯9 (HW-diminished)
    ],
    // vi — submediant minor. Local mode Aeolian (vi, vi7, vi9/11, vi(♭6), m(add9),
    // minor pentatonic → ultra).
    //  • applied_dominant_core (very): V/ii — VI7 (A7→Dm in C).
    //  • mixolydian (somewhat): fuller / extended V/ii.
    //  • dorian (occasional): the raised-6 color (vi6 / vi13), borrowed.
    '6': [
      { toneSet: 'aeolian', floor: 'ultra' },
      { toneSet: 'applied_dominant_core', floor: 'very' },
      { toneSet: 'mixolydian', floor: 'somewhat' },
      { toneSet: 'dorian', floor: 'occasional' },
    ],
    // vii° — leading-tone chord. Local mode Locrian: the diminished triad and the
    // diatonic half-diminished viiø7 (m7♭5) → ultra.
    //  • diminished_seventh (very): the fully-diminished vii°7 (borrows ♭6), a common
    //    dominant substitute. The dim triad lives in both sets, so it stays ultra;
    //    only the d7 chord is 'very'.
    '7': [
      { toneSet: 'locrian', floor: 'ultra' },
      { toneSet: 'diminished_seventh', floor: 'very' },
    ],
    // ♭III — borrowed major mediant (E♭ in C). Modal mixture; a rock / soul / film
    // staple. Local color Ionian (♭III, ♭IIImaj7, ♭III6/9 → ultra).
    //  • mixolydian (somewhat): ♭III7 as a functioning dominant (V/♭VI, tritone-sub).
    //  • ionian_augmented (occasional): ♭III+ / ♭IIImaj7♯5, a rare harmonic-minor color.
    '♭3': [
      { toneSet: 'ionian', floor: 'ultra' },
      { toneSet: 'mixolydian', floor: 'somewhat' },
      { toneSet: 'ionian_augmented', floor: 'occasional' },
    ],
    // ♭VI — borrowed major submediant (A♭ in C). In the parallel minor the ♭VI root
    // is Lydian (its 4th is the key's ♮2 = ♯4-above-root), so ♭VI, ♭VImaj7,
    // ♭VImaj7♯11 → ultra.
    //  • ionian (somewhat): the plain-4th reading (♭VI6 / add tones).
    //  • mixolydian (occasional): ♭VI7 — sonic German-6th / V/♭II (with m7 it is
    //    literally a dominant, not the augmented-6th spelling).
    '♭6': [
      { toneSet: 'lydian', floor: 'ultra' },
      { toneSet: 'ionian', floor: 'somewhat' },
      { toneSet: 'mixolydian', floor: 'occasional' },
    ],
    // ♭VII — borrowed subtonic major (B♭ in C). The quintessential Mixolydian/Aeolian
    // rock chord and the backdoor dominant ♭VII7→I. Local mode Mixolydian → ultra.
    //  • lydian (occasional): ♭VIImaj7♯11, a bright rock / pop color.
    '♭7': [
      { toneSet: 'mixolydian', floor: 'ultra' },
      { toneSet: 'lydian', floor: 'occasional' },
    ],
    // ── chromatic degrees ────────────────────────────────────────────────────
    // ♭II — Neapolitan (D♭ in C). Major triad on ♭2; its Phrygian context makes the
    // ♭II root Lydian → ♭II / ♭IImaj7 'somewhat'; ♭II7 (tritone sub of V) 'occasional'.
    '♭2': [
      { toneSet: 'lydian', floor: 'somewhat' },
      { toneSet: 'mixolydian', floor: 'occasional' },
    ],
    // ♯IV — the ♯iv°7 secondary leading-tone / common-tone diminished chord → V.
    // Fully-diminished at 'somewhat'; the ♯iv° triad / half-dim (Locrian) 'occasional'.
    '♯4': [
      { toneSet: 'diminished_seventh', floor: 'somewhat' },
      { toneSet: 'locrian', floor: 'occasional' },
    ],
  },
  // ───────────────────────────── MINOR KEY ──────────────────────────────────
  // natural 3/6/7 are '♭3'/'♭6'/'♭7'; the token '7' is the RAISED leading tone.
  minor: {
    // i — tonic minor. Local mode Aeolian (i, i7, i9/11, i(♭6), m(add9), minor
    // pentatonic → ultra).
    //  • harmonic_minor (very): i(maj7) / im(maj9) — the classic minor-tonic tension.
    //  • melodic_minor (somewhat): i6, i6/9 — the "jazz minor" tonic (raises 6 & 7).
    //  • dorian (somewhat): the ♮6/♭7 modal-minor tonic (i6, im13, quartal).
    //  • ionian (occasional): the Picardy third — tonic turned major.
    '1': [
      { toneSet: 'aeolian', floor: 'ultra' },
      { toneSet: 'harmonic_minor', floor: 'very' },
      { toneSet: 'melodic_minor', floor: 'somewhat' },
      { toneSet: 'dorian', floor: 'somewhat' },
      { toneSet: 'ionian', floor: 'occasional' },
    ],
    // ii° — supertonic. Local mode Locrian: the diminished triad and the half-
    // diminished iiø7 (m7♭5) — the standard minor pre-dominant — → ultra.
    //  • diminished_seventh (occasional): the fully-diminished ii°7 (rare, chromatic
    //    passing use).
    //  • dorian (occasional): the borrowed natural-minor ii (min7 / quartal).
    '2': [
      { toneSet: 'locrian', floor: 'ultra' },
      { toneSet: 'diminished_seventh', floor: 'occasional' },
      { toneSet: 'dorian', floor: 'occasional' },
    ],
    // iv — subdominant minor. Local mode Dorian (the 6th above iv is the key's ♮2,
    // diatonic to natural minor): iv, iv7, iv6, iv9/11/13, m6/9, quartal → ultra.
    //  • major_triad (somewhat): the major IV (Dorian / melodic brightening) — common
    //    in modal rock and as a plagal color.
    //  • mixolydian (occasional): IV7 (dominant on 4 — blues iv / V of ♭VII).
    '4': [
      { toneSet: 'dorian', floor: 'ultra' },
      { toneSet: 'major_triad', floor: 'somewhat' },
      { toneSet: 'mixolydian', floor: 'occasional' },
    ],
    // V / v — dominant. Two co-equal native readings → two separate 'ultra' sets
    // (never unioned: one has m3, one M3):
    //  • phrygian (ultra): the natural-minor v (minor triad, v7) — modal / folk / rock.
    //  • phrygian_dominant (ultra): the harmonic-minor V — V, V7, V7♭9, V7♭13,
    //    V7♭9♭13 (♭9=m2, ♭13=m6 native). The cadential dominant of the minor key.
    //  • altered (somewhat): V7♯5 / V7♭5 / V7♯9 / V+ in a ii–V–i.
    //  • lydian_dominant (occasional): V7♯11.
    //  • dominant_altered (occasional): the remaining fully-altered ♯9 voicings.
    '5': [
      { toneSet: 'phrygian', floor: 'ultra' },
      { toneSet: 'phrygian_dominant', floor: 'ultra' },
      { toneSet: 'altered', floor: 'somewhat' },
      { toneSet: 'lydian_dominant', floor: 'occasional' },
      { toneSet: 'dominant_altered', floor: 'occasional' },
      { toneSet: 'dominant_diminished', floor: 'occasional' }, // 13♭9 / 13♯9 (HW-diminished)
    ],
    // vii° — leading-tone chord on the RAISED 7. The characteristic chord is the
    // fully-diminished vii°7 (harmonic minor):
    //  • diminished_seventh (ultra): vii°7 and the dim triad — the native sound.
    //  • locrian (somewhat): the half-diminished viiø7 (needs ♮6 / melodic minor).
    '7': [
      { toneSet: 'diminished_seventh', floor: 'ultra' },
      { toneSet: 'locrian', floor: 'somewhat' },
    ],
    // ♭III — mediant / relative major (E♭ in C minor). Local mode Ionian → ♭III,
    // ♭IIImaj7, ♭III6/9, add9, maj9/13 → ultra.
    //  • mixolydian (somewhat): ♭III7 (dominant on ♭3 — V/♭VI).
    //  • ionian_augmented (occasional): ♭III+ / ♭IIImaj7♯5, a rare harmonic-minor color.
    '♭3': [
      { toneSet: 'ionian', floor: 'ultra' },
      { toneSet: 'mixolydian', floor: 'somewhat' },
      { toneSet: 'ionian_augmented', floor: 'occasional' },
    ],
    // ♭VI — submediant major (A♭ in C minor). Local mode Lydian within natural minor
    // → ♭VI, ♭VImaj7, ♭VImaj7♯11, ♭VI6/9 → ultra.
    //  • ionian (somewhat): the plain-4th reading (♭VI6 / add tones).
    //  • mixolydian (occasional): ♭VI7 — sonic German-6th / V/♭II.
    '♭6': [
      { toneSet: 'lydian', floor: 'ultra' },
      { toneSet: 'ionian', floor: 'somewhat' },
      { toneSet: 'mixolydian', floor: 'occasional' },
    ],
    // ♭VII — subtonic (B♭ in C minor). Local mode Mixolydian → ♭VII, ♭VII7 (backdoor
    // dominant → i), ♭VII9/13, sus → ultra.
    //  • lydian (occasional): ♭VIImaj7♯11 — the ♮6 (melodic-minor) bright color.
    '♭7': [
      { toneSet: 'mixolydian', floor: 'ultra' },
      { toneSet: 'lydian', floor: 'occasional' },
    ],
    // ── chromatic / rare degrees ─────────────────────────────────────────────
    // ♭II — Neapolitan (D♭ in C minor): a signature minor-key pre-dominant. The ♭II
    // root sits in a Lydian color → ♭II / ♭IImaj7 'very' (more idiomatic here than in
    // major). ♭II7 (tritone sub of V) 'occasional'.
    '♭2': [
      { toneSet: 'lydian', floor: 'very' },
      { toneSet: 'mixolydian', floor: 'occasional' },
    ],
    // ♯IV — the ♯iv°7 common-tone / secondary leading-tone diminished chord → V.
    //  • diminished_seventh (somewhat): the fully-diminished ♯iv°7.
    //  • locrian (occasional): the ♯iv° triad / half-dim reading.
    '♯4': [
      { toneSet: 'diminished_seventh', floor: 'somewhat' },
      { toneSet: 'locrian', floor: 'occasional' },
    ],
    // ♮6 — a chord on the raised / natural 6th, from Dorian / melodic-minor contexts
    // (the ♮6 supports a half-diminished: A–C–E♭–G in C Dorian). Rare.
    //  • locrian (occasional): the ♮vi° / ♮viø7 half-diminished reading.
    //  • dorian (occasional): a borrowed minor chord on ♮6.
    '6': [
      { toneSet: 'locrian', floor: 'occasional' },
      { toneSet: 'dorian', floor: 'occasional' },
    ],
  },
};

// ── Difficulty tiers ─────────────────────────────────────────────────────────
// Each tier lists exactly what's on and its weight — gating and weighting unified.
// `modes` and `degrees` weights are the tuning-pass estimates of how often each
// mode / scale-degree root is actually heard; later tiers open up more degrees
// (and keys/packs). Key, pack, and commonness weights are still rough. Degree
// weights are relative (they are normalized at pick time), anchored tonic = 100.
export const TIERS: Record<Tier, TierConfig> = {
  easy: {
    modes: { major: 1 }, // major only
    keys: { major: { all_natural: 100, '1_sharp': 95, '1_flat': 85 } },
    degrees: { major: { '1': 100, '5': 88, '4': 80, '6': 46, '2': 42 } },
    commonness: { ultra: 1 },
    packs: { simple_intervals: 3, triads: 10 },
  },
  medium: {
    modes: { major: 0.65, minor: 0.35 },
    keys: {
      major: { all_natural: 100, '1_sharp': 95, '2_sharp': 80, '3_sharp': 60, '1_flat': 85, '2_flat': 78, '3_flat': 55 },
      minor: { all_natural: 100, '1_sharp': 98, '2_sharp': 55, '3_sharp': 40, '1_flat': 92, '2_flat': 70, '3_flat': 62 },
    },
    degrees: {
      major: { '1': 100, '5': 88, '4': 80, '6': 46, '2': 42, '3': 13, '7': 11, '♭7': 16 },
      minor: { '1': 100, '5': 80, '♭7': 55, '4': 55, '♭6': 50, '♭3': 48, '2': 24, '7': 16 },
    },
    commonness: { ultra: 1, very: 0.5 },
    packs: { simple_intervals: 3, tritone_intervals: 1.5, triads: 10, suspended_triads: 3, sevenths: 8, sixths: 5, pentatonic_scales: 2 },
  },
  hard: {
    modes: { major: 0.65, minor: 0.35 },
    keys: {
      major: { all_natural: 100, '1_sharp': 95, '2_sharp': 80, '3_sharp': 60, '4_sharp': 42, '1_flat': 85, '2_flat': 78, '3_flat': 55, '4_flat': 28 },
      minor: { all_natural: 100, '1_sharp': 98, '2_sharp': 55, '3_sharp': 40, '4_sharp': 35, '1_flat': 92, '2_flat': 70, '3_flat': 62, '4_flat': 38 },
    },
    degrees: {
      major: { '1': 100, '5': 88, '4': 80, '6': 46, '2': 42, '3': 13, '7': 11, '♭7': 16, '♭6': 8, '♭3': 7 },
      minor: { '1': 100, '5': 80, '♭7': 55, '4': 55, '♭6': 50, '♭3': 48, '2': 24, '7': 16, '♭2': 5 },
    },
    commonness: { ultra: 1, very: 0.7, somewhat: 0.4 },
    packs: {
      simple_intervals: 3, tritone_intervals: 1.5, augmented_diminished_intervals: 1, triads: 10,
      suspended_triads: 3, sevenths: 8, sixths: 5, pentatonic_scales: 2, extended_chords: 5, altered_dominants: 3,
    },
  },
  expert: {
    modes: { major: 0.65, minor: 0.35 },
    keys: {
      major: { all_natural: 100, '1_sharp': 95, '2_sharp': 80, '3_sharp': 60, '4_sharp': 42, '5_sharp': 12, '6_sharp': 3, '1_flat': 85, '2_flat': 78, '3_flat': 55, '4_flat': 28, '5_flat': 18, '6_flat': 4 },
      minor: { all_natural: 100, '1_sharp': 98, '2_sharp': 55, '3_sharp': 40, '4_sharp': 35, '5_sharp': 10, '6_sharp': 2, '1_flat': 92, '2_flat': 70, '3_flat': 62, '4_flat': 38, '5_flat': 20, '6_flat': 8 },
    },
    degrees: {
      major: { '1': 100, '5': 88, '4': 80, '6': 46, '2': 42, '3': 13, '7': 11, '♭7': 16, '♭6': 8, '♭3': 7, '♭2': 1.5, '♯4': 2 },
      minor: { '1': 100, '5': 80, '♭7': 55, '4': 55, '♭6': 50, '♭3': 48, '2': 24, '7': 16, '♭2': 5, '6': 4, '♯4': 2 },
    },
    commonness: { ultra: 1, very: 0.8, somewhat: 0.6, occasional: 0.3 },
    packs: {
      simple_intervals: 3, tritone_intervals: 1.5, augmented_diminished_intervals: 1, triads: 10,
      suspended_triads: 3, sevenths: 8, sixths: 5, pentatonic_scales: 2, extended_chords: 5, altered_dominants: 3,
      inverted_triads: 3, open_triads: 2, rooted_shells: 3, extended_shells: 3, seventh_inversions: 3,
      guide_tone_dyads: 1.5, sixth_dyads: 1.5, color_chords: 2, rootless_voicings: 2,
    },
  },
};
