// round.ts — what ToneScribe asks for. Pure; no DOM.
//
// ToneSearch's generatePuzzle is harmony pick + grid + decoys; ToneScribe needs
// only the first of those, plus where on the staff the answer must be written.
// So it calls sampleHarmony directly rather than building a grid it would throw
// away.

import { sampleHarmony } from '../core/harmony';
import type { Pattern, Tier } from '../core/pattern';
import type { Fifths, Mode } from '../core/theory';
import { makeRng, randInt, type Rng } from '../core/rng';
import type { Round } from '../shell/session';
import {
  ascendingSteps,
  pickRange,
  validStarts,
  type Clef,
  type StaffRange,
  type Step,
} from '../core/staff';

export interface ScribeRound extends Round {
  pattern: Pattern;
  solutionNotes: Fifths[];
  /** Where the answer must be written, and on which clef. */
  clef: Clef;
  range: StaffRange;
  /** The one placement the range admits — the answer, as staff positions. */
  solutionSteps: Step[];
  // Functional context, for the spoken prompt.
  mode: Mode;
  degree: Fifths;
  sig: Fifths;
}

/**
 * A single-note round: "write la". Built here rather than added to
 * harmony.config because it exists only for ToneScribe — a one-note sequence is
 * a degenerate puzzle in ToneSearch, where you would simply be pointed at one
 * diamond.
 */
const SINGLE_NOTE: Pattern = { display: 'Scale Degree', kind: 'note', intervals: [0] };

/** How often Easy asks for a single note instead of a full pattern. Easy only:
 * naming one degree by ear-free reading is the entry skill, and it stops being
 * instructive quickly. */
const EASY_SINGLE_NOTE_CHANCE = 0.35;

export function generateScribeRound(tier: Tier, seed: number): ScribeRound {
  const rng: Rng = makeRng(seed);
  const pick = sampleHarmony(tier, rng);

  const pattern = tier === 'easy' && rng.next() < EASY_SINGLE_NOTE_CHANCE ? SINGLE_NOTE : pick.pattern;
  const solutionNotes = pattern.intervals.map((iv) => pick.rootNote + iv);

  const clef: Clef = randInt(rng, 0, 2) === 0 ? 'treble' : 'bass';
  const range = pickRange(solutionNotes, clef, rng);
  // pickRange guarantees a placement exists; validStarts names it. The range is
  // narrow enough that there is exactly one (see core/staff.ts).
  const start = validStarts(solutionNotes, range)[0]!;

  return {
    pattern,
    solutionNotes,
    clef,
    range,
    solutionSteps: ascendingSteps(solutionNotes, start),
    mode: pick.mode,
    degree: pick.degree,
    sig: pick.sig,
  };
}
