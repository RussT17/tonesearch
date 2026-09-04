// staffview.ts — draws the staff. Presentation only: it knows steps and slots,
// never whether an answer is right.
//
// Everything is laid out in the glyph coordinate system the Bravura paths are
// authored in (10 units per staff space, y down, the five lines at y = 20…60),
// and the SVG viewBox scales that to whatever width the stage gives us.

import {
  bottomLineStep,
  keySignatureMarks,
  ledgerLinesIn,
  playableRange,
  type Accidental,
  type Clef,
  type StaffRange,
  type Step,
} from '../core/staff';
import {
  GLYPH_SPACE,
  accidentalMetrics,
  accidentalPath,
  clefPath,
  clefWidth,
  noteheadPath,
} from './glyphs';
import { SVG_NS } from '../shell/svg';

const STEP_Y = GLYPH_SPACE / 2; // one step is half a space
const PAD_L = 8;
const KEY_GAP = 12; // clef → signature, and signature → writing area
const SIG_GAP = 1.2; // between adjacent key-signature accidentals
/**
 * Writing area at the widest key signature — and, indirectly, how big everything
 * is. The SVG scales to fill its container, so the viewBox width sets the scale:
 * a narrower staff in glyph units renders LARGER on screen. Cut from 150 to 102
 * to make the whole staff ~25% bigger, which is really about the height of a
 * line-or-space, since that is the click target. Notes end up closer together;
 * ledger lines narrow to match (see ledgerHalf).
 */
const MIN_WRITE_W = 102;

/** Widest clef and key signature, so the staff's outer size never changes —
 * a staff that resized per round made the whole page jump between them. */
const CLEF_W_MAX = Math.max(clefWidth('treble'), clefWidth('bass'));
// Six, not seven: harmony.config tops out at 6 sharps / 6 flats, and reserving
// a seventh would shrink every staff to hold a signature that never appears.
const SIG_W_MAX = 6 * (accidentalMetrics(-1).width + SIG_GAP);
const STAFF_W = PAD_L + CLEF_W_MAX + KEY_GAP + SIG_W_MAX + KEY_GAP + MIN_WRITE_W + PAD_L;

/** Vertical extent: three ledger lines either way, plus room for the treble
 * clef's tail. Fixed, so the staff never changes height either. */
const LEDGER_SHOWN = 3;

const el = (tag: string, attrs: Record<string, string | number> = {}): SVGElement => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
};

export interface StaffGeometry {
  clef: Clef;
  /** y for a step, in glyph units. */
  y: (step: Step) => number;
  /** Centre x of the slot for written note `i`. */
  slotX: (i: number) => number;
  /** Where an unwritten note waits: off the right edge, so notes arrive from
   * the direction writing travels. */
  parkX: number;
  /** The region a note may be written in — the grey band. Taps outside it do
   * nothing at all. */
  writeArea: { x0: number; x1: number; yTop: number; yBottom: number };
  /** Half-width of a ledger line — column-dependent, so notes drawn later use
   * the same reach as the guides drawn up front. */
  ledgerHalf: number;
  /** Nearest step to a y in glyph units, clamped to what the clef can show. */
  stepAtY: (y: number) => Step;
  width: number;
  height: number;
  minY: number;
}

export interface StaffView {
  svg: SVGSVGElement;
  geom: StaffGeometry;
  /** One group per written slot; the board fills and moves these. */
  slots: SVGGElement[];
  /** Where a pointer event lands, in glyph units. */
  toGlyph: (ev: PointerEvent) => { x: number; y: number };
  /** Wash the line or space at `step` in the wrong-note colour, once. */
  flashRow: (step: Step) => void;
}

/**
 * Build the staff for a round: five lines, the clef, the key signature, the
 * band the answer must be written inside, and one empty group per note.
 */
export function renderStaff(
  host: HTMLElement,
  clef: Clef,
  sig: number,
  range: StaffRange,
  slotCount: number,
): StaffView {
  host.innerHTML = '';

  const bottom = bottomLineStep(clef);
  const y = (step: Step): number => 60 - (step - bottom) * STEP_Y;

  const playable = playableRange(clef, LEDGER_SHOWN);
  const marks = keySignatureMarks(sig, clef);
  const sigX = PAD_L + clefWidth(clef) + KEY_GAP;
  const sigW = marks.reduce((w, m) => w + accidentalMetrics(m.acc).width + SIG_GAP, 0);

  // The writing area is whatever staff is left once the clef and signature have
  // had their room — so it starts clear of the signature rather than reaching
  // back over it.
  const writeX0 = sigX + sigW + KEY_GAP;
  const writeX1 = STAFF_W - PAD_L;

  // Notes divide that area into equal columns and sit in the middle of theirs.
  // Fixed pitch left a three-note round bunched at the left with dead staff to
  // the right; this spreads three wider than five, and centres a single note.
  const colW = (writeX1 - writeX0) / slotCount;
  const slotX = (i: number): number => writeX0 + colW * (i + 0.5);
  // A ledger line reaches past its notehead but must stay inside its column,
  // which is narrower now that the staff is drawn larger.
  const ledgerHalf = Math.max(7.5, Math.min(10, colW / 2 - 2));

  const minY = y(playable.hi) - 12;
  const maxY = Math.max(y(playable.lo), 78) + 10;
  const height = maxY - minY;

  const svg = el('svg', {
    class: 'staff',
    viewBox: `0 ${minY} ${STAFF_W} ${height}`,
    preserveAspectRatio: 'xMidYMid meet',
  }) as SVGSVGElement;

  // The band you must write inside — drawn first, under everything. It covers
  // exactly the writing area, so it never runs under the key signature.
  const bandTop = y(range.hi) - STEP_Y;
  const bandBottom = y(range.lo) + STEP_Y;
  svg.append(el('rect', {
    class: 'band', x: writeX0, y: bandTop, width: writeX1 - writeX0,
    height: bandBottom - bandTop, rx: 3,
  }));

  // The wrong-note wash: the whole line or space you aimed at, lit for a
  // moment. Under the staff lines and the notes, so it reads as the paper
  // colouring rather than as something written. Idle at zero opacity.
  const flash = el('rect', {
    class: 'row-flash', x: writeX0, y: 0, width: writeX1 - writeX0, height: 0, rx: 1.5,
  });
  svg.append(flash);

  // Ledger lines the band reaches, drawn BEFORE anything is written. Engraving
  // only draws these under a note, but a player needs something to aim at — with
  // nothing there, placing a note above the staff is guesswork.
  for (const ls of ledgerLinesIn(range, clef)) {
    for (let i = 0; i < slotCount; i++) {
      svg.append(el('line', {
        class: 'ledger-guide',
        x1: slotX(i) - ledgerHalf, y1: y(ls), x2: slotX(i) + ledgerHalf, y2: y(ls),
      }));
    }
  }

  for (let line = 0; line < 5; line++) {
    const ly = 60 - line * GLYPH_SPACE;
    svg.append(el('line', { class: 'rule', x1: PAD_L, y1: ly, x2: STAFF_W - PAD_L, y2: ly }));
  }

  svg.append(el('path', { class: 'ink', d: clefPath(clef), transform: `translate(${PAD_L + 2} 0)` }));

  // Key signature: each accidental's own origin sits on its note's step, so
  // placing one is a translate — no eyeballed offsets, and they land centred on
  // the line or space they belong to.
  let sx = sigX;
  for (const m of marks) {
    svg.append(el('path', {
      class: 'ink', d: accidentalPath(m.acc), transform: `translate(${sx} ${y(m.step)})`,
    }));
    sx += accidentalMetrics(m.acc).width + SIG_GAP;
  }

  const parkX = STAFF_W + colW; // just off the right edge
  const slots: SVGGElement[] = [];
  for (let i = 0; i < slotCount; i++) {
    const g = el('g', { class: 'note', transform: `translate(${parkX} 0)` }) as SVGGElement;
    svg.append(g);
    slots.push(g);
  }

  // The band IS the target. A tap inside it picks the nearest line or space
  // rather than demanding pixel accuracy; a tap outside is not a wrong note,
  // it is not a target at all (see the board's bounds check).
  svg.append(el('rect', {
    class: 'slot-hit', x: writeX0, y: bandTop, width: writeX1 - writeX0,
    height: bandBottom - bandTop,
  }));

  host.append(svg);

  const stepAtY = (gy: number): Step => {
    const raw = bottom + Math.round((60 - gy) / STEP_Y);
    return Math.max(playable.lo, Math.min(playable.hi, raw));
  };

  // A line is thinner than a space, so the wash matches what you were aiming at
  // rather than always covering the same slab of staff.
  const flashRow = (step: Step): void => {
    const onLine = Math.abs(step - bottom) % 2 === 0;
    const h = onLine ? GLYPH_SPACE * 0.55 : GLYPH_SPACE * 0.92;
    flash.setAttribute('y', String(y(step) - h / 2));
    flash.setAttribute('height', String(h));
    // Web Animations rather than a CSS class: a second wrong note on the same
    // row has to restart the wash, and re-triggering a CSS animation means
    // removing the class and forcing a reflow.
    flash.animate?.(
      [{ opacity: 0.3 }, { opacity: 0.3, offset: 0.3 }, { opacity: 0 }],
      { duration: 620, easing: 'ease-out' },
    );
  };

  const toGlyph = (ev: PointerEvent): { x: number; y: number } => {
    const r = svg.getBoundingClientRect();
    const scale = STAFF_W / r.width; // uniform: preserveAspectRatio keeps it square
    return { x: (ev.clientX - r.left) * scale, y: (ev.clientY - r.top) * scale + minY };
  };

  return {
    svg,
    geom: {
      clef, y, slotX, parkX, ledgerHalf, stepAtY, width: STAFF_W, height, minY,
      writeArea: { x0: writeX0, x1: writeX1, yTop: bandTop, yBottom: bandBottom },
    },
    slots,
    toGlyph,
    flashRow,
  };
}

/** Ledger lines needed to reach `step` from the staff, as line steps. */
export function ledgerSteps(step: Step, clef: Clef): Step[] {
  const bottom = bottomLineStep(clef);
  const top = bottom + 8;
  const out: Step[] = [];
  for (let s = top + 2; s <= step; s += 2) out.push(s);
  for (let s = bottom - 2; s >= step; s -= 2) out.push(s);
  return out;
}

/**
 * Draw a notehead (plus any ledger lines and accidental) into a slot group.
 *
 * `accX` overrides where the accidental starts, for a stacked chord whose
 * accidentals have been given columns of their own (see chordlayout.ts).
 */
export function paintNote(
  g: SVGGElement,
  geom: StaffGeometry,
  step: Step,
  acc: Accidental,
  accX?: number,
): void {
  while (g.firstChild) g.removeChild(g.firstChild);
  const cy = geom.y(step);
  const cx = 0; // slots are positioned by transform, so draw at the origin

  for (const ls of ledgerSteps(step, geom.clef)) {
    const h = geom.ledgerHalf;
    g.append(el('line', { class: 'ledger', x1: cx - h, y1: geom.y(ls), x2: cx + h, y2: geom.y(ls) }));
  }
  g.append(el('path', { class: 'ink', d: noteheadPath(cx, cy, GLYPH_SPACE), transform: `rotate(-18 ${cx} ${cy})` }));
  if (acc !== null) {
    // Sits left of the notehead, clear of it by a hair — as engraved.
    const m = accidentalMetrics(acc);
    const x = accX ?? cx - 8 - m.width;
    g.append(el('path', {
      class: 'ink', d: accidentalPath(acc), transform: `translate(${x} ${cy})`,
    }));
  }
}
