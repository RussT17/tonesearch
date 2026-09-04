// pattern.ts — the core pattern types, shared by the whole engine. A Pattern is an
// ordered interval sequence (fifths from the chord root) plus how it's shown. The
// actual pattern DATA lives in harmony.config.ts (grouped into packs) and is turned
// into Pattern objects by harmony.ts; this module is just the vocabulary.

import type { Fifths } from './theory';

/** Difficulty tier. */
export type Tier = 'easy' | 'medium' | 'hard' | 'expert';

/** Category — drives the caption word and (for 'scale') the solve/reveal run-up. */
export type Kind = 'note' | 'interval' | 'triad' | 'chord' | 'scale';

export interface Pattern {
  display: string; // human name, e.g. 'Dominant 7th', 'm7♭5', 'Major'
  kind: Kind;
  intervals: Fifths[]; // fifths from the chord root, in path order
  qualifier?: string; // parenthetical voicing note: 'shell', '1st inv.', 'rootless A'…
}

// The word appended after the name. "Triad" is the four triad qualities; sus &
// everything ≥4 notes read as "Chord"; two-note guide-tone/3-6 pairs are also
// "Chord" (they name a chord); bare dyads are "Interval"; scales "Scale".
const CATEGORY_LABEL: Record<Kind, string> = {
  note: 'Note',
  interval: 'Interval',
  triad: 'Triad',
  chord: 'Chord',
  scale: 'Scale',
};
export const categoryLabel = (kind: Kind): string => CATEGORY_LABEL[kind];
