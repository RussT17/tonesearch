// staff.ts — the staff's integer geometry. Pure; no DOM.
//
// ToneSearch never needed octaves: `Fifths` is octave-free, and a diamond only
// has to spell a note. A notehead has a height, so ToneScribe adds one axis —
// the diatonic STEP, an integer counting letters (C0 = 0, D0 = 1 … C1 = 7). One
// step is one line-or-space, which is exactly what the eye reads.
//
// Step and accidental together pin a note: the step gives the letter (and so the
// line), the key signature supplies the default accidental, and a pressed
// accidental button overrides it. That is why F on the staff is F♯ in D major
// unless you explicitly write a natural.

import type { Fifths, Mode } from './theory';
import { tonicNote } from './theory';
import type { Rng } from './rng';
import { pick, randInt } from './rng';

export type Step = number;
export type Clef = 'treble' | 'bass';

/** Accidental written on a note: −2…+2 semitone-ish steps on the line of fifths,
 * or null for "whatever the key signature says". */
export type Accidental = -2 | -1 | 0 | 1 | 2 | null;

/** JS `%` is sign-preserving; normalize into `[0, n)`. */
const mod = (x: number, n: number): number => ((x % n) + n) % n;

// Natural letters by step position within an octave (C D E F G A B), as fifths.
const NATURAL_BY_LETTER: readonly Fifths[] = [-2, 0, 2, -3, -1, 1, 3];
// Inverse: fifths of a natural letter → its position within the octave.
const LETTER_OF_NATURAL = new Map<Fifths, number>(
  NATURAL_BY_LETTER.map((f, i) => [f, i]),
);

/** The natural note (as fifths) sitting at `step`, ignoring any key signature. */
export const naturalAt = (step: Step): Fifths => NATURAL_BY_LETTER[mod(step, 7)]!;

/**
 * Which letters a key signature alters.
 *
 * Signatures accumulate outward along the line of fifths: sharps take the
 * flat-most naturals first (F, then C, G…), flats the sharp-most (B, then E,
 * A…). So a natural `n` is sharped when `n ≤ sig − 4` and flatted when
 * `n ≥ sig + 4`, which collapses both directions into one expression.
 */
export function keyAlter(natural: Fifths, sig: Fifths): Fifths {
  if (natural <= sig - 4) return natural + 7; // in the sharps of this signature
  if (natural >= sig + 4) return natural - 7; // in the flats
  return natural;
}

/** The note produced by a notehead at `step` in key `sig`, with `acc` written on
 * it (null = take the signature's accidental). */
export function noteAt(step: Step, sig: Fifths, acc: Accidental = null): Fifths {
  const natural = naturalAt(step);
  return acc === null ? keyAlter(natural, sig) : natural + 7 * acc;
}

/** The accidental you must write at `step` in key `sig` to mean `note`, or null
 * if the signature already spells it. Returns undefined when `note` cannot be
 * written at that step at all (wrong letter). */
export function accidentalFor(step: Step, sig: Fifths, note: Fifths): Accidental | undefined {
  const natural = naturalAt(step);
  const delta = (note - natural) / 7;
  if (!Number.isInteger(delta) || Math.abs(delta) > 2) return undefined;
  return keyAlter(natural, sig) === note ? null : (delta as Accidental);
}

/** The natural letter underlying `note` (F♯ → F, B♭♭ → B), as fifths.
 * Note the two orderings in play: theory.ts indexes letters in FIFTHS order
 * (F C G D A E B, so `mod(note + 3, 7)`), while steps count them in STAFF order
 * (C D E F G A B). This maps into the first; NATURAL_BY_LETTER is the second. */
export const naturalOf = (note: Fifths): Fifths => mod(note + 3, 7) - 3;

/** The step of `note` in octave `octave` (scientific pitch: C4 = middle C). */
export const stepOf = (note: Fifths, octave: number): Step =>
  octave * 7 + LETTER_OF_NATURAL.get(naturalOf(note))!;

/**
 * Write `notes` ascending from `startStep`: each note goes on the next line or
 * space at or above the previous one that carries its letter.
 *
 * This is what "written in order" means on a staff, and it makes the placement
 * unique — which matters because the same pitch class exists in every octave.
 * It also handles inverted voicings correctly: a pattern ordered 3rd–5th–root
 * simply puts the root an octave up, exactly as it would be engraved.
 */
export function ascendingSteps(notes: readonly Fifths[], startStep: Step): Step[] {
  if (!Number.isFinite(startStep)) {
    // Guard, not decoration: the search below advances until the letter matches,
    // and a non-finite seed makes that never terminate.
    throw new RangeError(`ascendingSteps: startStep must be finite, got ${startStep}`);
  }
  const out: Step[] = [];
  let prev = startStep - 1;
  for (const note of notes) {
    const letter = staffLetter(note);
    let s = prev + 1;
    while (mod(s, 7) !== letter) s++;
    out.push(s);
    prev = s;
  }
  return out;
}

/** Position of `note`'s letter within an octave, in staff order (C = 0 … B = 6). */
export const staffLetter = (note: Fifths): number => LETTER_OF_NATURAL.get(naturalOf(note))!;

/** How many steps the written form of `notes` spans, independent of where it
 * starts (the ascending rule makes this fixed). */
export const writtenSpan = (notes: readonly Fifths[]): number => {
  const steps = ascendingSteps(notes, 0);
  return steps[steps.length - 1]! - steps[0]!;
};

// ── Clefs ───────────────────────────────────────────────────────────────────
// The step sitting on the bottom line: treble E4, bass G2.
const BOTTOM_LINE: Record<Clef, Step> = { treble: 4 * 7 + 2, bass: 2 * 7 + 4 };

/** Step on the bottom line of `clef`. Line/space index = step − this. */
export const bottomLineStep = (clef: Clef): Step => BOTTOM_LINE[clef];

/** Steps reachable on `clef`, allowing `ledger` ledger lines above and below.
 * A ledger line is two steps (line + the space under it) past the staff. */
export function playableRange(clef: Clef, ledger = 3): { lo: Step; hi: Step } {
  const bottom = bottomLineStep(clef);
  return { lo: bottom - 2 * ledger, hi: bottom + 8 + 2 * ledger };
}

/** The band a round must be written inside. */
export interface StaffRange {
  lo: Step;
  hi: Step;
}

/**
 * Pick the band for a round: wide enough to hold the written notes with a
 * little slack, narrow enough that only one octave placement fits, and set at a
 * random height so play ranges over the staff and its ledger lines rather than
 * sitting in the comfortable middle every time.
 *
 * Slack stays under 7 on purpose. At 7 the same shape would fit an octave up as
 * well, and the round would have two right answers.
 */
export function pickRange(
  notes: readonly Fifths[],
  clef: Clef,
  rng: Rng,
  ledger = 3,
): StaffRange {
  const span = writtenSpan(notes);
  const playable = playableRange(clef, ledger);

  // Choose where the FIRST note actually lands, not an arbitrary window that the
  // notes then have to fit into. Only steps carrying the first note's letter can
  // hold it, and they recur every 7 — so a window picked independently can
  // easily contain none of them and admit no answer at all.
  const letter = staffLetter(notes[0] ?? 0);
  const starts: Step[] = [];
  for (let s = playable.lo; s + span <= playable.hi; s++) {
    if (mod(s, 7) === letter) starts.push(s);
  }
  if (starts.length === 0) return { lo: playable.lo, hi: playable.hi }; // unreachable in practice
  const first = pick(rng, starts);

  // Pad the band by up to 5 steps split above and below. Staying under 7 keeps
  // the answer unique: at 7 the same shape would also fit an octave away.
  const total = randInt(rng, 0, 6); // 0…5
  const below = randInt(rng, 0, total + 1);
  const lo = Math.max(playable.lo, first - below);
  const hi = Math.min(playable.hi, first + span + (total - below));
  return { lo, hi };
}

/** Where `notes` could legally start inside `range` — one entry per distinct
 * placement. Used to assert the answer is unique, and to judge an attempt. */
export function validStarts(notes: readonly Fifths[], range: StaffRange): Step[] {
  if (notes.length === 0) return [];
  const span = writtenSpan(notes);
  const letter = staffLetter(notes[0]!);
  const out: Step[] = [];
  for (let s = range.lo; s + span <= range.hi; s++) {
    if (mod(s, 7) === letter) out.push(s); // its letter, and the rest fits above
  }
  return out;
}

// ── Key signature layout ────────────────────────────────────────────────────
// Sharps are written F C G D A E B, flats the reverse, each at its conventional
// octave. Derived from stepOf rather than hand-numbered — writing these out by
// eye is how they end up two steps off.
const TREBLE_SHARP_STEPS: readonly Step[] = [
  stepOf(-3, 5), stepOf(-2, 5), stepOf(-1, 5), stepOf(0, 5), // F5 C5 G5 D5
  stepOf(1, 4), stepOf(2, 5), stepOf(3, 4), //                  A4 E5 B4
];
const TREBLE_FLAT_STEPS: readonly Step[] = [
  stepOf(3, 4), stepOf(2, 5), stepOf(1, 4), stepOf(0, 5), //    B4 E5 A4 D5
  stepOf(-1, 4), stepOf(-2, 5), stepOf(-3, 4), //               G4 C5 F4
];
/** Bass-clef signatures sit two octaves below the treble ones: the treble's
 * first sharp is F♯5, the bass clef's is F♯3.
 *
 * The shift is exact for every signature the generator draws (±6). At a 7th
 * flat the shift would put F♭ below the bass staff — engraving handles that case
 * specially, but harmony.config never asks for it. */
const CLEF_SHIFT: Record<Clef, number> = { treble: 0, bass: -14 };

/** The steps carrying a key signature's accidentals, in writing order, plus
 * which accidental they are. */
export function keySignatureMarks(
  sig: Fifths,
  clef: Clef,
): { step: Step; acc: -1 | 1 }[] {
  const n = Math.min(Math.abs(sig), 7);
  const steps = sig >= 0 ? TREBLE_SHARP_STEPS : TREBLE_FLAT_STEPS;
  const acc: -1 | 1 = sig >= 0 ? 1 : -1;
  return steps.slice(0, n).map((s) => ({ step: s + CLEF_SHIFT[clef], acc }));
}

/** The tonic's step nearest the middle of `clef`'s staff — a reasonable place to
 * centre a "which key is this" hint. */
export function tonicStepNear(mode: Mode, sig: Fifths, clef: Clef): Step {
  const tonic = naturalOf(tonicNote(mode, sig));
  const letter = LETTER_OF_NATURAL.get(tonic)!;
  const middle = bottomLineStep(clef) + 4;
  let s = middle - 3;
  while (mod(s, 7) !== letter) s++;
  return s;
}
