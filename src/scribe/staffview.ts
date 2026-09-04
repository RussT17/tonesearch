// staffview.ts — draws the staff. Presentation only: it knows steps and slots,
// never whether an answer is right.
//
// Everything is laid out in the glyph coordinate system the clefs are authored
// in (10 units per staff space, y down, the five lines at y = 20…60), and the
// SVG viewBox scales that to whatever width the stage gives us.

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
import { GLYPH_SPACE, clefPath, clefWidth, noteheadPath } from './glyphs';
import { SVG_NS } from '../shell/svg';

const STEP_Y = GLYPH_SPACE / 2; // one step is half a space
const SLOT_W = 30; // horizontal room per written note
const PAD_L = 8;
const KEY_GAP = 10;
const SIG_W = 9; // per key-signature accidental

const ACC_TEXT: Record<Exclude<Accidental, null>, string> = {
  [-2]: '𝄫',
  [-1]: '♭',
  [0]: '♮',
  [1]: '♯',
  [2]: '𝄪',
};
/** ♭♭ and ♯♯ as doubled singles: the dedicated Unicode doubles (𝄫 𝄪) are in the
 * same musical-symbols block as the clefs, so they are missing from the same
 * font stacks. The doubled forms always render. */
export const accidentalText = (a: Exclude<Accidental, null>): string =>
  a === -2 ? '♭♭' : a === 2 ? '♯♯' : ACC_TEXT[a];

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
  ledger = 3,
): StaffView {
  host.innerHTML = '';

  const bottom = bottomLineStep(clef);
  const y = (step: Step): number => 60 - (step - bottom) * STEP_Y;

  const playable = playableRange(clef, ledger);
  const sigW = Math.min(Math.abs(sig), 7) * SIG_W;
  const slotsX0 = PAD_L + clefWidth(clef) + (sigW ? sigW + KEY_GAP : KEY_GAP);
  const slotX = (i: number): number => slotsX0 + i * SLOT_W + SLOT_W / 2;

  const width = slotsX0 + slotCount * SLOT_W + PAD_L;
  // Vertical extent: whatever the clef can show, plus room for the treble
  // clef's tail, plus a margin so ledger lines never touch the edge.
  const minY = Math.min(y(playable.hi), 4) - 10;
  const maxY = Math.max(y(playable.lo), 78) + 10;
  const height = maxY - minY;

  const svg = el('svg', {
    class: 'staff',
    viewBox: `0 ${minY} ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet',
  }) as SVGSVGElement;

  // The band you must write inside — drawn first, under everything.
  const bandTop = y(range.hi) - STEP_Y;
  const bandBottom = y(range.lo) + STEP_Y;
  svg.append(
    el('rect', { class: 'band', x: slotsX0 - 4, y: bandTop, width: width - slotsX0 - PAD_L + 8, height: bandBottom - bandTop, rx: 3 }),
    el('rect', { class: 'band-edge', x: slotsX0 - 4, y: bandTop, width: width - slotsX0 - PAD_L + 8, height: bandBottom - bandTop, rx: 3 }),
  );

  // Ledger lines the band reaches, drawn BEFORE anything is written. Engraving
  // only draws these under a note, but a player needs something to aim at — with
  // nothing there, placing a note above the staff is guesswork.
  for (const ls of ledgerLinesIn(range, clef)) {
    for (let i = 0; i < slotCount; i++) {
      svg.append(el('line', {
        class: 'ledger-guide',
        x1: slotX(i) - 11, y1: y(ls), x2: slotX(i) + 11, y2: y(ls),
      }));
    }
  }

  for (let line = 0; line < 5; line++) {
    svg.append(el('line', { class: 'rule', x1: PAD_L, y1: 60 - line * GLYPH_SPACE, x2: width - PAD_L, y2: 60 - line * GLYPH_SPACE }));
  }

  svg.append(el('path', { class: 'ink', d: clefPath(clef), transform: `translate(${PAD_L + 2} 0)` }));

  keySignatureMarks(sig, clef).forEach((m, i) => {
    const t = el('text', { class: 'keysig', x: PAD_L + clefWidth(clef) + i * SIG_W + SIG_W / 2, y: y(m.step) });
    t.textContent = m.acc === 1 ? '♯' : '♭';
    svg.append(t);
  });

  const slots: SVGGElement[] = [];
  for (let i = 0; i < slotCount; i++) {
    const g = el('g', { class: 'note' }) as SVGGElement;
    svg.append(g);
    slots.push(g);
  }

  // One transparent hit area over the writing region, so a tap anywhere picks
  // the nearest line or space rather than demanding pixel accuracy.
  const hit = el('rect', { class: 'slot-hit', x: slotsX0 - SLOT_W / 2, y: minY, width: width - slotsX0 + SLOT_W, height });
  svg.append(hit);

  host.append(svg);

  const stepAtY = (gy: number): Step => {
    const raw = bottom + Math.round((60 - gy) / STEP_Y);
    return Math.max(playable.lo, Math.min(playable.hi, raw));
  };

  const toGlyph = (ev: PointerEvent): { x: number; y: number } => {
    const r = svg.getBoundingClientRect();
    const scale = width / r.width; // uniform: preserveAspectRatio keeps it square
    return { x: (ev.clientX - r.left) * scale, y: (ev.clientY - r.top) * scale + minY };
  };

  return { svg, geom: { clef, y, slotX, stepAtY, width, height, minY }, slots, toGlyph };
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

/** Draw a notehead (plus any ledger lines and accidental) into a slot group. */
export function paintNote(
  g: SVGGElement,
  geom: StaffGeometry,
  step: Step,
  acc: Accidental,
): void {
  while (g.firstChild) g.removeChild(g.firstChild);
  const cy = geom.y(step);
  const cx = 0; // slots are positioned by transform, so draw at the origin

  for (const ls of ledgerSteps(step, geom.clef)) {
    g.append(el('line', { class: 'ledger', x1: cx - 11, y1: geom.y(ls), x2: cx + 11, y2: geom.y(ls) }));
  }
  g.append(el('path', { class: 'ink', d: noteheadPath(cx, cy, GLYPH_SPACE), transform: `rotate(-18 ${cx} ${cy})` }));
  if (acc !== null) {
    const t = el('text', { class: 'acc', x: cx - 13, y: cy });
    t.textContent = accidentalText(acc);
    g.append(t);
  }
}

/** Show where the next note will go: a faint caret under the active slot. */
export function paintCaret(g: SVGGElement, geom: StaffGeometry, active: boolean): void {
  while (g.firstChild) g.removeChild(g.firstChild);
  if (!active) return;
  const yb = geom.y(geom.stepAtY(90)) + 6;
  g.append(el('path', { class: 'caret', d: `M -7 ${yb} L 7 ${yb}` }));
}
