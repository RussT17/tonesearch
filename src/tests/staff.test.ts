import { describe, expect, it } from 'vitest';
import {
  accidentalFor,
  ascendingSteps,
  bottomLineStep,
  keyAlter,
  keySignatureMarks,
  naturalAt,
  naturalOf,
  noteAt,
  pickRange,
  playableRange,
  stepOf,
  validStarts,
  writtenSpan,
  type Clef,
} from '../core/staff';
import { noteName, type Fifths } from '../core/theory';
import { makeRng } from '../core/rng';
import { generatePuzzle } from '../core/generate';
import { configFor } from '../core/config';
import type { Tier } from '../core/pattern';

// Fifths values for the naturals (theory.ts: D = 0, letters run F C G D A E B).
const C = -2, D = 0, E = 2, F = -3, G = -1, A = 1, B = 3;

describe('steps and letters', () => {
  it('counts one step per line or space, seven per octave', () => {
    expect(stepOf(C, 4)).toBe(28); // middle C
    expect(stepOf(D, 4)).toBe(29);
    expect(stepOf(B, 4)).toBe(34);
    expect(stepOf(C, 5)).toBe(35);
  });

  it('puts a note and its accidental variants on the same step', () => {
    expect(stepOf(F, 4)).toBe(stepOf(F + 7, 4)); // F and F♯
    expect(stepOf(B, 4)).toBe(stepOf(B - 7, 4)); // B and B♭
  });

  it('reads the natural letter back out', () => {
    expect(noteName(naturalOf(F + 7))).toBe('F'); // F♯ → F
    expect(noteName(naturalOf(B - 7))).toBe('B'); // B♭ → B
    expect(naturalAt(stepOf(G, 3))).toBe(G);
  });

  it('places the bottom line at E4 for treble and G2 for bass', () => {
    expect(bottomLineStep('treble')).toBe(stepOf(E, 4));
    expect(bottomLineStep('bass')).toBe(stepOf(G, 2));
  });

  it('puts middle C one ledger line outside both staves', () => {
    // Two steps below the treble's bottom line, two above the bass's top line.
    expect(bottomLineStep('treble') - stepOf(C, 4)).toBe(2);
    expect(stepOf(C, 4) - (bottomLineStep('bass') + 8)).toBe(2);
  });
});

describe('key signatures', () => {
  it('sharps F C G … and flats B E A … as the signature grows', () => {
    expect(keyAlter(F, 1)).toBe(F + 7); // G major sharps F
    expect(keyAlter(C, 1)).toBe(C); // …but not C
    expect(keyAlter(C, 2)).toBe(C + 7); // D major sharps F and C
    expect(keyAlter(B, -1)).toBe(B - 7); // F major flats B
    expect(keyAlter(E, -1)).toBe(E); // …but not E
    expect(keyAlter(E, -2)).toBe(E - 7);
  });

  it('leaves everything natural in C', () => {
    for (const n of [C, D, E, F, G, A, B]) expect(keyAlter(n, 0)).toBe(n);
  });

  it('makes a bare notehead mean what the signature says', () => {
    const fStep = stepOf(F, 4);
    expect(noteName(noteAt(fStep, 2))).toBe('F♯'); // D major
    expect(noteName(noteAt(fStep, 0))).toBe('F'); // C major
    expect(noteName(noteAt(fStep, 2, 0))).toBe('F'); // written natural overrides
    expect(noteName(noteAt(fStep, 0, 1))).toBe('F♯'); // written sharp
  });

  it('says which accidental you must write for a given note', () => {
    const fStep = stepOf(F, 4);
    expect(accidentalFor(fStep, 2, F + 7)).toBeNull(); // signature already does it
    expect(accidentalFor(fStep, 2, F)).toBe(0); // needs a natural
    expect(accidentalFor(fStep, 0, F + 7)).toBe(1); // needs a sharp
    expect(accidentalFor(fStep, 0, G)).toBeUndefined(); // wrong letter entirely
  });

  it('writes the right number of accidentals, and bass sits two octaves lower', () => {
    expect(keySignatureMarks(0, 'treble')).toHaveLength(0);
    expect(keySignatureMarks(3, 'treble')).toHaveLength(3);
    expect(keySignatureMarks(-4, 'treble')).toHaveLength(4);
    expect(keySignatureMarks(3, 'treble').every((m) => m.acc === 1)).toBe(true);
    expect(keySignatureMarks(-4, 'treble').every((m) => m.acc === -1)).toBe(true);
    const t = keySignatureMarks(2, 'treble');
    const b = keySignatureMarks(2, 'bass');
    expect(t.map((m) => m.step - 14)).toEqual(b.map((m) => m.step));
  });

  it('starts sharps on F5 and flats on B4 in the treble', () => {
    expect(keySignatureMarks(1, 'treble')[0]!.step).toBe(stepOf(F, 5));
    expect(keySignatureMarks(-1, 'treble')[0]!.step).toBe(stepOf(B, 4));
  });

  it('starts sharps on F3 and flats on B2 in the bass', () => {
    expect(keySignatureMarks(1, 'bass')[0]!.step).toBe(stepOf(F, 3));
    expect(keySignatureMarks(-1, 'bass')[0]!.step).toBe(stepOf(B, 2));
  });

  // Swept over ±6 because that is what the generator can draw (harmony.config
  // tops out at 6_sharp / 6_flat). Signature accidentals sit on the staff, with
  // one classical exception: the treble clef's G♯ (third sharp) is engraved in
  // the space just above the top line. Its bass counterpart sits in the top
  // space, inside. A 7th flat would fall below the bass staff, which is why the
  // sweep stops at 6 rather than pretending to place it.
  it('keeps every signature accidental on the staff, bar the treble G♯', () => {
    for (const clef of ['treble', 'bass'] as Clef[]) {
      const bottom = bottomLineStep(clef);
      const top = bottom + 8;
      for (let sig = -6; sig <= 6; sig++) {
        for (const m of keySignatureMarks(sig, clef)) {
          const outside = m.step < bottom || m.step > top;
          if (outside) {
            expect(clef).toBe('treble');
            expect(m.step).toBe(stepOf(G, 5)); // the G♯, one space above the staff
          }
          expect(m.step).toBeGreaterThanOrEqual(bottom);
          expect(m.step).toBeLessThanOrEqual(top + 1);
        }
      }
    }
  });

  it('puts the bass G♯ inside the staff, unlike the treble one', () => {
    const marks = keySignatureMarks(3, 'bass');
    expect(marks[2]!.step).toBe(stepOf(G, 3));
    expect(marks[2]!.step).toBeLessThanOrEqual(bottomLineStep('bass') + 8);
  });
});

describe('ascending placement', () => {
  it('puts each note on the next line or space carrying its letter', () => {
    // A C-major triad from C4: C4 E4 G4.
    expect(ascendingSteps([C, E, G], stepOf(C, 4))).toEqual([
      stepOf(C, 4), stepOf(E, 4), stepOf(G, 4),
    ]);
  });

  it('carries an inverted voicing up an octave, as it would be engraved', () => {
    // Ordered 3rd–5th–root: the root lands above, not below.
    expect(ascendingSteps([E, G, C], stepOf(E, 4))).toEqual([
      stepOf(E, 4), stepOf(G, 4), stepOf(C, 5),
    ]);
  });

  it('ignores accidentals when choosing the line', () => {
    expect(ascendingSteps([F + 7, A, C], stepOf(F, 4))).toEqual([
      stepOf(F, 4), stepOf(A, 4), stepOf(C, 5),
    ]);
  });

  it('spans the same number of steps wherever it starts', () => {
    const notes = [C, E, G, B];
    expect(writtenSpan(notes)).toBe(6);
    for (const start of [0, 3, 28, 41]) {
      const s = ascendingSteps(notes, start);
      expect(s[s.length - 1]! - s[0]!).toBe(6);
    }
  });
});

describe('the written range', () => {
  const clefs: Clef[] = ['treble', 'bass'];

  it('fits inside what the clef can show', () => {
    const rng = makeRng(3);
    for (const clef of clefs) {
      const playable = playableRange(clef);
      for (let i = 0; i < 200; i++) {
        const r = pickRange([C, E, G], clef, rng);
        expect(r.lo).toBeGreaterThanOrEqual(playable.lo);
        expect(r.hi).toBeLessThanOrEqual(playable.hi);
      }
    }
  });

  // The property the whole design rests on: a band narrower than span + 7 admits
  // exactly one octave, so the round has exactly one right answer.
  it('admits exactly one placement, over real generated rounds', () => {
    const rng = makeRng(11);
    for (const tier of ['easy', 'medium', 'hard', 'expert'] as Tier[]) {
      for (let i = 0; i < 60; i++) {
        const puzzle = generatePuzzle(configFor(tier), 1000 + i);
        for (const clef of clefs) {
          const range = pickRange(puzzle.solutionNotes, clef, rng);
          const starts = validStarts(puzzle.solutionNotes, range);
          expect(starts).toHaveLength(1);
        }
      }
    }
  });

  it('ranges over the staff instead of hugging the middle', () => {
    const rng = makeRng(5);
    const los = new Set<number>();
    for (let i = 0; i < 300; i++) los.add(pickRange([C, E, G], 'treble', rng).lo);
    expect(los.size).toBeGreaterThan(6); // many different heights, incl. ledger territory
  });

  it('reaches ledger lines on both sides', () => {
    const rng = makeRng(9);
    const bottom = bottomLineStep('treble');
    let below = false;
    let above = false;
    for (let i = 0; i < 500; i++) {
      const r = pickRange([C, E, G], 'treble', rng);
      if (r.lo < bottom) below = true;
      if (r.hi > bottom + 8) above = true;
    }
    expect(below).toBe(true);
    expect(above).toBe(true);
  });
});

describe('round trip', () => {
  it('every solution note can be written and read back on its step', () => {
    const rng = makeRng(21);
    for (let i = 0; i < 120; i++) {
      const puzzle = generatePuzzle(configFor('hard'), 500 + i);
      const clef: Clef = i % 2 ? 'treble' : 'bass';
      const range = pickRange(puzzle.solutionNotes, clef, rng);
      const start = validStarts(puzzle.solutionNotes, range)[0]!;
      const steps = ascendingSteps(puzzle.solutionNotes, start);
      steps.forEach((step, k) => {
        const want: Fifths = puzzle.solutionNotes[k]!;
        const acc = accidentalFor(step, puzzle.sig, want);
        expect(acc).not.toBeUndefined();
        expect(noteAt(step, puzzle.sig, acc as never)).toBe(want);
      });
    }
  });
});
