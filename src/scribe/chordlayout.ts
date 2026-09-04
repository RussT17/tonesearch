// chordlayout.ts — where the noteheads and accidentals of a stacked chord go.
// Pure; no DOM. Glyph units (10 per staff space), x relative to the chord's
// principal column, y from the caller's staff geometry.
//
// Written out left to right, a chord is just notes in a row. Stacked into a
// single column — which is how it would actually be engraved, and what the
// squash animates into — two problems appear that a row never has:
//
//   Seconds collide. Two notes a step apart cannot both sit on the same side of
//   the stem: their noteheads would occupy the same ink. Engraving displaces the
//   upper one of the pair by exactly one notehead width, so the pair interlocks.
//
//   Accidentals collide. Every accidental wants the space immediately left of
//   the chord, and there is only one such space. Engraving stacks them into
//   columns, working down from the top note, each accidental taking the
//   rightmost column it fits in without touching what is already there.
//
// Both rules are simplified from Gould, *Behind Bars* — enough for the two- to
// five-note chords this game asks for, not a general engraver.

import type { Accidental, Step } from '../core/staff';
import { GLYPH_SPACE, accidentalMetrics } from './glyphs';

/** Half the horizontal reach of a notehead. The ellipse is drawn tilted (see
 * paintNote), so this is the rotated bounding box, not simply its rx. */
const TILT = (18 * Math.PI) / 180;
const RX = GLYPH_SPACE * 0.66;
const RY = GLYPH_SPACE * 0.5;
export const HEAD_HALF = Math.hypot(RX * Math.cos(TILT), RY * Math.sin(TILT));

/** How far a second is displaced: one notehead, so the two heads touch. */
const SECOND_SHIFT = HEAD_HALF * 2;

const ACC_GAP = 2.2; // notehead ← accidental
const ACC_COL_GAP = 1.4; // between accidental columns
const ACC_CLEAR = 1.2; // vertical air between accidentals sharing a column

export interface NoteToPlace {
  step: Step;
  acc: Accidental;
}

export interface ChordPlace {
  /** Notehead offset from the chord's principal column: 0, or one notehead
   * right when the note is the displaced half of a second. */
  dx: number;
  /** Left edge of this note's accidental, measured from its OWN notehead centre
   * — the same frame `paintNote` draws in — or null when it has none. A
   * displaced note therefore carries a bigger negative offset than its
   * neighbours, since its accidental still belongs to the column on the left. */
  accX: number | null;
}

export interface ChordLayout {
  /** One entry per input note, in input order. */
  places: ChordPlace[];
  /** Ink extent of the whole chord, so a caller can centre it. */
  x0: number;
  x1: number;
}

/**
 * Lay out `notes` (any order; they are read by step) as one stacked chord.
 *
 * `y` maps a step to its vertical position — the same function the staff draws
 * with, so accidental stacking is judged against where the glyphs actually land.
 */
export function chordLayout(
  notes: readonly NoteToPlace[],
  y: (step: Step) => number,
): ChordLayout {
  const places: ChordPlace[] = notes.map(() => ({ dx: 0, accX: null }));
  if (notes.length === 0) return { places, x0: 0, x1: 0 };

  // Ascending, because displacement is decided from the note below.
  const up = notes.map((_n, i) => i).sort((a, b) => notes[a]!.step - notes[b]!.step);

  // Seconds: each note a single step above its neighbour goes to the other side.
  // A run of three (C D E) therefore alternates back, which is right — only the
  // adjacent pair collides.
  let prevStep = -Infinity;
  let prevDisplaced: boolean = false;
  for (const i of up) {
    const displaced: boolean = notes[i]!.step - prevStep === 1 && !prevDisplaced;
    places[i]!.dx = displaced ? SECOND_SHIFT : 0;
    prevStep = notes[i]!.step;
    prevDisplaced = displaced;
  }

  // Accidentals, top note down. Column 0 is nearest the chord; a glyph drops to
  // the next column out only when it would touch one already placed.
  const columns: { top: number; bottom: number }[][] = [];
  const colOf: number[] = notes.map(() => -1);
  for (const i of [...up].reverse()) {
    const acc = notes[i]!.acc;
    if (acc === null) continue;
    const m = accidentalMetrics(acc);
    const cy = y(notes[i]!.step);
    const box = { top: cy + m.y1, bottom: cy + m.y2 };
    let k = 0;
    while (columns[k]?.some((b) => box.top < b.bottom + ACC_CLEAR && box.bottom > b.top - ACC_CLEAR)) {
      k++;
    }
    (columns[k] ??= []).push(box);
    colOf[i] = k;
  }

  // Columns are as wide as their widest glyph, and are laid right to left from
  // the chord's leftmost notehead.
  const colWidth = columns.map(() => 0);
  notes.forEach((n, i) => {
    if (colOf[i] === -1 || n.acc === null) return;
    colWidth[colOf[i]!] = Math.max(colWidth[colOf[i]!]!, accidentalMetrics(n.acc).width);
  });
  const colRight: number[] = [];
  let edge: number = -HEAD_HALF - ACC_GAP;
  for (let k = 0; k < colWidth.length; k++) {
    colRight[k] = edge;
    edge -= colWidth[k]! + ACC_COL_GAP;
  }

  let x0 = -HEAD_HALF;
  let x1 = -HEAD_HALF;
  notes.forEach((n, i) => {
    x1 = Math.max(x1, places[i]!.dx + HEAD_HALF);
    if (colOf[i] === -1 || n.acc === null) return;
    const ax = colRight[colOf[i]!]! - accidentalMetrics(n.acc).width;
    places[i]!.accX = ax - places[i]!.dx; // into the note's own frame
    x0 = Math.min(x0, ax);
  });
  return { places, x0, x1 };
}
