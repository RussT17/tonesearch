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

// Semitones above C for each letter, in staff order (C D E F G A B).
const SEMITONE_BY_LETTER: readonly number[] = [0, 2, 4, 5, 7, 9, 11];

/**
 * The sounding MIDI note of a notehead: its real pitch, octave included.
 *
 * ToneSearch never needed this — its diamonds are octave-free, so playback folds
 * every note into one reference octave. On a staff the octave is written down,
 * so a note has to sound where it is written or the ear and the eye disagree.
 */
export function midiOf(step: Step, note: Fifths): number {
  const octave = Math.floor(step / 7);
  const alteration = (note - naturalAt(step)) / 7; // sharps (+) or flats (−)
  return 12 * (octave + 1) + SEMITONE_BY_LETTER[mod(step, 7)]! + alteration;
}

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

/** Where `notes` could legally start inside `range` — one entry per distinct
 * placement. The band is sized so this has exactly one element. */
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

/**
 * The band a round must be written inside — as wide as it can be while still
 * admitting exactly one answer, positioned at random within `allowed`.
 *
 * Width is what makes this non-obvious. The first note can only sit on steps
 * carrying its letter, and those recur every 7, so a band whose start-window is
 * 7 steps long holds exactly one of them. That caps the band at `span + 6`: the
 * widest one that cannot fit the same shape twice, and the reason a single-note
 * round gets a seven-step band rather than a one-step giveaway.
 *
 * It works outward from a placement rather than picking a band and hoping the
 * notes fit. Sizing first and searching after fails exactly where it matters —
 * a tight allowance often has no offset at all where the first note's letter
 * lands in the window, and the round comes out unplayable.
 */
export function pickRange(
  notes: readonly Fifths[],
  rng: Rng,
  allowed: { lo: Step; hi: Step },
): StaffRange {
  const span = writtenSpan(notes);
  const starts = validStarts(notes, allowed);
  if (starts.length === 0) return { ...allowed }; // caller must widen; see round.ts
  const start = pick(rng, starts);

  // Grow the band around that placement. `below + above ≤ 6` keeps the
  // start-window at most 7 steps, which is what keeps the answer unique.
  const roomBelow = Math.min(start - allowed.lo, 6);
  const roomAbove = Math.min(allowed.hi - (start + span), 6);
  const total = Math.min(6, roomBelow + roomAbove);
  const below = randInt(rng, Math.max(0, total - roomAbove), Math.min(roomBelow, total) + 1);
  return { lo: start - below, hi: start + span + (total - below) };
}

/** Line steps (not spaces) inside `range` that fall outside the staff — the
 * ledger lines a player needs to see BEFORE writing, or there is nothing to aim
 * at. Engraving draws these only under a note; placement needs them up front. */
export function ledgerLinesIn(range: StaffRange, clef: Clef): Step[] {
  const bottom = bottomLineStep(clef);
  const out: Step[] = [];
  for (let s = range.lo; s <= range.hi; s++) {
    if (mod(s - bottom, 2) === 0 && (s < bottom || s > bottom + 8)) out.push(s);
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
