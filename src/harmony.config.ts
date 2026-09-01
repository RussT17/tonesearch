// harmony.config.ts — the key-aware generation config, authored entirely in
// musical terms (docs/09). harmony.ts parses these tokens into line-of-fifths
// integers and runs the draw; this file is meant to be human-edited (and filled
// out by a fresh-context tuning pass).
//
// TOKENS
//   tones / tone-sets: intervals from the CHORD ROOT, as interval names —
//     R m2 M2 A2 m3 M3 P4 A4 d5 P5 A5 m6 M6 d7 m7 M7  (A = augmented, d = diminished)
//   scale degrees: intervals from the TONIC, as scale-degree names —
//     '1' '♭2' '2' '♭3' '3' '4' '♯4' '♭5' '5' '♭6' '6' '♭7' '7'
//   key signatures: 'all_natural', '1_sharp'…'6_sharp', '1_flat'…'6_flat'
//
// ⚠️ EVERY weight and tone-set floor below is an ILLUSTRATIVE PLACEHOLDER
// (docs/09 ⚠️ note) — present only to run the mechanism and satisfy the no-dead-end
// invariant, NOT a claim about real-world frequency. A later dedicated tuning pass
// (candidate for a fresh-context subagent) sets the real values. // TODO(tuning)

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
  keys: Record<string, number>;
  degrees: Partial<Record<Mode, Record<string, number>>>;
  commonness: Partial<Record<Commonness, number>>;
  packs: Record<string, number>;
}

// ── Named tone-sets (a readability helper) ──────────────────────────────────
// Reusable named sets referenced by SCALE_DEGREE_TONE_SETS. Mostly modes, but a
// tone-set is just "the tones allowed here" — a degree may reference an inline
// list instead (e.g. a plain triad) when a whole scale would be too generous.
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
  altered: ['R', 'm2', 'A2', 'M3', 'd5', 'A5', 'm7'], // altered dominant colors
  diminished_seventh: ['R', 'M2', 'm3', 'P4', 'd5', 'm6', 'd7'], // vii°7
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
  ],
  rootless_voicings: [
    { display: 'Minor 9th', kind: 'chord', qualifier: 'rootless A', tones: ['m3', 'P5', 'm7', 'M2'] },
    { display: 'Minor 9th', kind: 'chord', qualifier: 'rootless B', tones: ['m7', 'M2', 'm3', 'P5'] },
    { display: 'Dominant 13th', kind: 'chord', qualifier: 'rootless A', tones: ['M3', 'M6', 'm7', 'M2'] },
    { display: 'Dominant 13th', kind: 'chord', qualifier: 'rootless B', tones: ['m7', 'M2', 'M3', 'M6'] },
    { display: 'Major 9th', kind: 'chord', qualifier: 'rootless A', tones: ['M3', 'P5', 'M7', 'M2'] },
    { display: 'Major 9th', kind: 'chord', qualifier: 'rootless B', tones: ['M7', 'M2', 'M3', 'P5'] },
  ],
};

// ── Per-(mode, degree) tone-sets → commonness floors ────────────────────────
// Keyed by scale-degree token. A pattern's commonness on a degree = the highest
// floor whose tone-set fully contains its tones; unlisted degrees / non-matching
// patterns can't appear there. // TODO(tuning): floors & memberships are placeholder.
export const SCALE_DEGREE_TONE_SETS: Record<Mode, Record<string, ToneSetRef[]>> = {
  major: {
    '1': [{ toneSet: 'ionian', floor: 'ultra' }, { toneSet: 'mixolydian', floor: 'very' }], // I ; I7 (blues)
    '5': [{ toneSet: 'mixolydian', floor: 'ultra' }, { toneSet: 'lydian_dominant', floor: 'somewhat' }, { toneSet: 'altered', floor: 'occasional' }], // V
    '4': [{ toneSet: 'lydian', floor: 'ultra' }, { toneSet: 'lydian_dominant', floor: 'very' }, { toneSet: 'dorian', floor: 'somewhat' }], // IV ; IV7 ; iv
    '2': [{ toneSet: 'dorian', floor: 'ultra' }, { toneSet: 'mixolydian', floor: 'somewhat' }], // ii ; V/V
    '6': [{ toneSet: 'aeolian', floor: 'ultra' }, { toneSet: 'mixolydian', floor: 'somewhat' }], // vi ; V/ii
    '3': [{ toneSet: 'phrygian', floor: 'ultra' }], // iii
    '7': [{ toneSet: 'locrian', floor: 'ultra' }, { toneSet: 'diminished_seventh', floor: 'ultra' }], // vii°
    '♭7': [{ toneSet: 'mixolydian', floor: 'somewhat' }], // ♭VII (borrowed)
    '♭3': [{ toneSet: 'ionian', floor: 'somewhat' }], // ♭III (borrowed)
    '♭6': [{ toneSet: 'lydian', floor: 'somewhat' }], // ♭VI (borrowed)
  },
  minor: {
    '1': [{ toneSet: 'aeolian', floor: 'ultra' }, { toneSet: 'harmonic_minor', floor: 'ultra' }, { toneSet: 'ionian', floor: 'somewhat' }], // i ; picardy
    '5': [{ toneSet: 'phrygian', floor: 'ultra' }, { toneSet: 'phrygian_dominant', floor: 'ultra' }, { toneSet: 'altered', floor: 'occasional' }], // v ; V
    '4': [{ toneSet: 'dorian', floor: 'ultra' }, { toneSet: 'aeolian', floor: 'very' }], // iv
    '2': [{ toneSet: 'locrian', floor: 'ultra' }, { toneSet: 'dorian', floor: 'somewhat' }], // ii°
    '♭3': [{ toneSet: 'ionian', floor: 'ultra' }, { toneSet: 'lydian', floor: 'somewhat' }], // ♭III
    '♭6': [{ toneSet: 'lydian', floor: 'ultra' }], // ♭VI
    '♭7': [{ toneSet: 'mixolydian', floor: 'ultra' }], // ♭VII
    '7': [{ toneSet: 'locrian', floor: 'ultra' }, { toneSet: 'diminished_seventh', floor: 'ultra' }], // vii° (leading tone)
  },
};

// ── Difficulty tiers ─────────────────────────────────────────────────────────
// Each tier lists exactly what's on and its weight — gating and weighting unified.
// Later tiers open up more keys/degrees/packs/commonness. // TODO(tuning): values.
export const TIERS: Record<Tier, TierConfig> = {
  easy: {
    modes: { major: 1 },
    keys: { all_natural: 6, '1_sharp': 5, '1_flat': 5 },
    degrees: { major: { '1': 10, '4': 7, '5': 8, '2': 5, '6': 4 } },
    commonness: { ultra: 1 },
    packs: { simple_intervals: 3, triads: 10 },
  },
  medium: {
    modes: { major: 0.6, minor: 0.4 },
    keys: { all_natural: 6, '1_sharp': 5, '1_flat': 5, '2_sharp': 4, '2_flat': 4, '3_sharp': 3, '3_flat': 3 },
    degrees: {
      major: { '1': 10, '5': 8, '4': 7, '2': 5, '6': 4, '3': 3, '7': 2 },
      minor: { '1': 10, '5': 7, '4': 6, '2': 4, '♭3': 5, '♭6': 5, '♭7': 4, '7': 2 },
    },
    commonness: { ultra: 1, very: 0.5 },
    packs: { simple_intervals: 3, tritone_intervals: 1.5, triads: 10, suspended_triads: 3, sevenths: 8, sixths: 5, pentatonic_scales: 2 },
  },
  hard: {
    modes: { major: 0.6, minor: 0.4 },
    keys: { all_natural: 6, '1_sharp': 5, '1_flat': 5, '2_sharp': 4, '2_flat': 4, '3_sharp': 3, '3_flat': 3, '4_sharp': 2, '4_flat': 2 },
    degrees: {
      major: { '1': 10, '5': 8, '4': 7, '2': 5, '6': 4, '3': 3, '7': 2, '♭7': 1, '♭3': 1, '♭6': 1 },
      minor: { '1': 10, '5': 7, '4': 6, '2': 4, '♭3': 5, '♭6': 5, '♭7': 4, '7': 2 },
    },
    commonness: { ultra: 1, very: 0.7, somewhat: 0.4 },
    packs: {
      simple_intervals: 3, tritone_intervals: 1.5, augmented_diminished_intervals: 1, triads: 10,
      suspended_triads: 3, sevenths: 8, sixths: 5, pentatonic_scales: 2, extended_chords: 5, altered_dominants: 3,
    },
  },
  expert: {
    modes: { major: 0.6, minor: 0.4 },
    keys: {
      all_natural: 6, '1_sharp': 5, '1_flat': 5, '2_sharp': 4, '2_flat': 4, '3_sharp': 3, '3_flat': 3,
      '4_sharp': 2, '4_flat': 2, '5_sharp': 1, '5_flat': 1, '6_sharp': 0.5, '6_flat': 0.5,
    },
    degrees: {
      major: { '1': 10, '5': 8, '4': 7, '2': 5, '6': 4, '3': 3, '7': 2, '♭7': 1, '♭3': 1, '♭6': 1 },
      minor: { '1': 10, '5': 7, '4': 6, '2': 4, '♭3': 5, '♭6': 5, '♭7': 4, '7': 2 },
    },
    commonness: { ultra: 1, very: 0.8, somewhat: 0.6, occasional: 0.3 },
    packs: {
      simple_intervals: 3, tritone_intervals: 1.5, augmented_diminished_intervals: 1, triads: 10,
      suspended_triads: 3, sevenths: 8, sixths: 5, pentatonic_scales: 2, extended_chords: 5, altered_dominants: 3,
      inverted_triads: 3, open_triads: 2, rooted_shells: 3, extended_shells: 3,
      guide_tone_dyads: 1.5, sixth_dyads: 1.5, color_chords: 2, rootless_voicings: 2,
    },
  },
};
