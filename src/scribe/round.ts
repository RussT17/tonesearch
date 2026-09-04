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
  accidentalFor,
  ascendingSteps,
  midiOf,
  pickRange,
  playableRange,
  validStarts,
  type Accidental,
  type Clef,
  type StaffRange,
  type Step,
} from '../core/staff';

/**
 * How far outside the staff each tier may send you, in ledger lines.
 *
 * Easy stays on the staff itself: reading a ledger line is a separate skill from
 * reading the staff, and meeting both at once is what makes a first attempt
 * feel impossible. The rest open up gradually.
 */
const LEDGER_BY_TIER: Record<Tier, number> = { easy: 0, medium: 1, hard: 2, expert: 3 };

/** The steps a clef offers at a given ledger allowance. */
const allowance = (clef: Clef, ledger: number): { lo: Step; hi: Step } =>
  playableRange(clef, ledger);

/**
 * Is what was written at `step` with `acc` what the round wants for position `i`?
 *
 * Compares the WRITING, not just the pitch, and neither half is covered by the
 * session's check.
 *
 * `isPrefix` is root-relative: with a single note it computes the root FROM that
 * note and then confirms the note matches it, which is true of every note — so
 * the first note of a round passed no matter what accidental it carried. The
 * step alone ignores accidentals entirely, since F♮ and F♯ share a line.
 *
 * And comparing the resulting NOTE is still too loose: in a flat key, writing a
 * flat on a note the signature already flats gives the same pitch, so a
 * redundant accidental would pass. Reading the signature instead of restating it
 * is the skill this app is for, so the accidental has to match exactly — null
 * where the signature already does the work.
 */
export const isCorrectAt = (
  round: ScribeRound,
  i: number,
  step: Step,
  acc: Accidental,
): boolean => step === round.solutionSteps[i] && acc === round.solutionAccidentals[i];

export interface ScribeRound extends Round {
  pattern: Pattern;
  solutionNotes: Fifths[];
  /** Where the answer must be written, and on which clef. */
  clef: Clef;
  range: StaffRange;
  /** The one placement the range admits — the answer, as staff positions. */
  solutionSteps: Step[];
  /** Those positions as sounding pitches, so the ear matches the eye. */
  solutionMidis: number[];
  /** The accidental each note must carry — null where the key signature already
   * spells it, which is most of them. */
  solutionAccidentals: Accidental[];
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

/**
 * One round for `tier`.
 *
 * Fitting the answer on the staff is fussier than it looks. A shape can only
 * start on a step carrying its first note's letter, and within the staff that
 * leaves a window of just `9 − span` steps — so a 6-step voicing fits only if
 * its first letter is one of three, and the treble and bass windows between them
 * cover only five of the seven letters. Widening to a ledger line whenever that
 * failed would have broken Easy's promise on roughly a third of its wider
 * shapes, not on the rare edge case it looked like.
 *
 * So the harmony is resampled until one fits inside the tier's allowance, trying
 * both clefs each time. That does bias Easy's roots towards those that sit on
 * the staff — a real cost, accepted because a beginner meeting ledger lines on
 * their first round is the worse one. Only if nothing fits after many tries does
 * the allowance open up, which keeps an unplayable round impossible.
 */
export function generateScribeRound(tier: Tier, seed: number): ScribeRound {
  const rng: Rng = makeRng(seed);
  const ledger = LEDGER_BY_TIER[tier];

  for (let attempt = 0; attempt < 60; attempt++) {
    const harmony = sampleHarmony(tier, rng);
    const pattern =
      tier === 'easy' && rng.next() < EASY_SINGLE_NOTE_CHANCE ? SINGLE_NOTE : harmony.pattern;
    const solutionNotes = pattern.intervals.map((iv) => harmony.rootNote + iv);

    // Try both clefs before giving up on this harmony: their windows start on
    // different letters, so one often fits where the other cannot.
    const first: Clef = randInt(rng, 0, 2) === 0 ? 'treble' : 'bass';
    for (const clef of [first, first === 'treble' ? 'bass' : 'treble'] as Clef[]) {
      const allowed = allowance(clef, ledger);
      if (validStarts(solutionNotes, allowed).length === 0) continue;
      return build(pattern, solutionNotes, harmony, clef, allowed, rng);
    }
  }

  // Nothing fit on the staff; open up until something does, so a round is never
  // unplayable even when the tier's promise cannot be kept.
  const harmony = sampleHarmony(tier, rng);
  const solutionNotes = harmony.pattern.intervals.map((iv) => harmony.rootNote + iv);
  const clef: Clef = randInt(rng, 0, 2) === 0 ? 'treble' : 'bass';
  let allowed = allowance(clef, ledger);
  for (let l = ledger; l <= 6 && validStarts(solutionNotes, allowed).length === 0; l++) {
    allowed = allowance(clef, l);
  }
  return build(harmony.pattern, solutionNotes, harmony, clef, allowed, rng);
}

function build(
  pattern: Pattern,
  solutionNotes: Fifths[],
  harmony: { mode: Mode; degree: Fifths; sig: Fifths },
  clef: Clef,
  allowed: { lo: Step; hi: Step },
  rng: Rng,
): ScribeRound {
  const range = pickRange(solutionNotes, rng, allowed);
  // pickRange sizes the band so exactly one placement fits; validStarts names it.
  const start = validStarts(solutionNotes, range)[0]!;
  const solutionSteps = ascendingSteps(solutionNotes, start);
  return {
    pattern,
    solutionNotes,
    clef,
    range,
    solutionSteps,
    solutionMidis: solutionSteps.map((step, i) => midiOf(step, solutionNotes[i]!)),
    solutionAccidentals: solutionSteps.map(
      (step, i) => accidentalFor(step, harmony.sig, solutionNotes[i]!) ?? null,
    ),
    mode: harmony.mode,
    degree: harmony.degree,
    sig: harmony.sig,
  };
}
