import { describe, expect, it } from 'vitest';
import { HEAD_HALF, chordLayout, type NoteToPlace } from '../scribe/chordlayout';
import { accidentalMetrics } from '../scribe/glyphs';
import type { Accidental, Step } from '../core/staff';
import { makeRng, randInt } from '../core/rng';

// The staff's own mapping: one step is half a space, and up the page is down in y.
const y = (step: Step): number => 60 - step * 5;
const n = (step: Step, acc: Accidental = null): NoteToPlace => ({ step, acc });

describe('seconds are displaced, as they must be', () => {
  it('leaves a chord with no seconds in one column', () => {
    const lay = chordLayout([n(0), n(2), n(4), n(6)], y);
    expect(lay.places.map((p) => p.dx)).toEqual([0, 0, 0, 0]);
  });

  it('pushes the upper note of a second one notehead right', () => {
    const lay = chordLayout([n(0), n(1)], y);
    expect(lay.places[0]!.dx).toBe(0);
    expect(lay.places[1]!.dx).toBeCloseTo(HEAD_HALF * 2, 6);
  });

  // Only the adjacent pair collides, so a cluster alternates rather than
  // stepping ever further right.
  it('alternates through a run of three', () => {
    const lay = chordLayout([n(0), n(1), n(2)], y);
    expect(lay.places.map((p) => p.dx > 0)).toEqual([false, true, false]);
  });

  it('reads the notes by step, whatever order they arrive in', () => {
    const lay = chordLayout([n(1), n(0)], y);
    expect(lay.places[1]!.dx).toBe(0); // the lower one stays put
    expect(lay.places[0]!.dx).toBeGreaterThan(0);
  });

  // Two noteheads a second apart on the same side would be the same ink twice.
  it('never leaves two noteheads a second apart on the same side', () => {
    const notes = [n(3), n(4), n(5), n(7), n(8)];
    const lay = chordLayout(notes, y);
    notes.forEach((a, i) => {
      notes.forEach((b, j) => {
        if (b.step === a.step + 1) expect(lay.places[i]!.dx).not.toBe(lay.places[j]!.dx);
      });
    });
    // …and notes that are not a second apart stay in the principal column.
    expect(lay.places.map((p) => p.dx > 0)).toEqual([false, true, false, false, true]);
  });
});

/** The ink box of note `i`'s accidental, or null when it has none. */
const accBox = (
  notes: readonly NoteToPlace[],
  lay: ReturnType<typeof chordLayout>,
  i: number,
): { x0: number; x1: number; y0: number; y1: number } | null => {
  const acc = notes[i]!.acc;
  const ax = lay.places[i]!.accX;
  if (acc === null || ax === null) return null;
  const m = accidentalMetrics(acc);
  // accX is relative to the note's own head, which may itself be displaced.
  const x = lay.places[i]!.dx + ax;
  const cy = y(notes[i]!.step);
  return { x0: x + m.x1, x1: x + m.x2, y0: cy + m.y1, y1: cy + m.y2 };
};

const overlaps = (
  a: { x0: number; x1: number; y0: number; y1: number },
  b: { x0: number; x1: number; y0: number; y1: number },
): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe('accidentals stack instead of piling up', () => {
  /** Where an accidental starts within the chord, heads and all. */
  const chordAccX = (lay: ReturnType<typeof chordLayout>, i: number): number =>
    lay.places[i]!.dx + lay.places[i]!.accX!;

  it('lets distant accidentals share the column nearest the chord', () => {
    const notes = [n(0, 1), n(8, 1)];
    const lay = chordLayout(notes, y);
    expect(chordAccX(lay, 0)).toBeCloseTo(chordAccX(lay, 1), 9);
  });

  it('moves one out a column when they would touch', () => {
    const notes = [n(0, 1), n(1, 1)];
    const lay = chordLayout(notes, y);
    // The upper note keeps the near column; the lower one steps out.
    expect(chordAccX(lay, 0)).toBeLessThan(chordAccX(lay, 1));
  });

  it('gives none to a note that carries none', () => {
    const lay = chordLayout([n(0), n(4, -1)], y);
    expect(lay.places[0]!.accX).toBeNull();
    expect(lay.places[1]!.accX).not.toBeNull();
  });

  // The property the whole exercise is for: whatever the chord, no two
  // accidentals share ink, and none of them sits on a notehead.
  it('never overlaps another accidental, or a notehead, in any chord', () => {
    const rng = makeRng(20240915);
    const ACCS: Accidental[] = [null, -2, -1, 0, 1, 2];
    for (let trial = 0; trial < 4000; trial++) {
      const count = randInt(rng, 2, 6);
      const notes: NoteToPlace[] = [];
      let step = randInt(rng, -6, 10);
      for (let i = 0; i < count; i++) {
        notes.push({ step, acc: ACCS[randInt(rng, 0, ACCS.length)]! });
        step += randInt(rng, 1, 4); // ascending, seconds included
      }
      const lay = chordLayout(notes, y);
      const boxes = notes.map((_note, i) => accBox(notes, lay, i));
      for (let i = 0; i < boxes.length; i++) {
        const a = boxes[i];
        if (!a) continue;
        for (let j = i + 1; j < boxes.length; j++) {
          const b = boxes[j];
          if (b) expect(overlaps(a, b)).toBe(false);
        }
        // Clear of every notehead, which is why they go left in the first place.
        for (const p of lay.places) {
          expect(a.x1).toBeLessThanOrEqual(p.dx - HEAD_HALF);
        }
        expect(a.x0).toBeGreaterThanOrEqual(lay.x0 - 1e-9);
      }
      for (const p of lay.places) {
        expect(p.dx + HEAD_HALF).toBeLessThanOrEqual(lay.x1 + 1e-9);
      }
    }
  });
});
