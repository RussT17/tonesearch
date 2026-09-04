// tokens.ts — the target sequence: the intervals to be found (ToneSearch) or
// written (ToneScribe).
//
// Two shapes, because the two games ask different things of the row. ToneSearch
// draws diamonds threaded by a line, matching the lattice you hunt the shape in.
// ToneScribe draws cards split in half: the interval on top, and underneath it
// the note that interval turns out to name, filled in as you write it — the row
// is a worked answer by the end, which a diamond has no room to be.
//
// Only the shape and the labels differ; the progress rule ("the first `count`
// are done") is one code path, and the colours come from CSS either way.

import type { Pattern } from '../core/pattern';
import { intervalName } from '../core/theory';
import { makeOverlay, setFadeVertices } from './svg';

const CELL_FILL = 0.9; // diamond side vs. edge-touching size (leaves a thin gap)
const TOKEN_REF_LEN = 5; // size the row to fit up to this many (5-note chords)
const TOKEN_PITCH_MAX = 78; // fixed target-diamond size (matches a phone; caps desktop)

/** How the row is drawn. */
export type TokenShape = 'diamond' | 'card';

/** References to the rendered target row, so the session can light it in step. */
export interface TokenView {
  tokenEls: Map<number, HTMLElement>;
  /** The lower half of each card, filled in as the sequence is completed.
   * Empty for the diamond row, which has no second half. */
  subEls: Map<number, HTMLElement>;
  /** What to write there, one per position. */
  subLabels: readonly string[];
  /** The thread through the satisfied diamonds; absent on a card row. */
  line?: {
    polyline: SVGPolylineElement;
    centers: Map<number, { x: number; y: number }>;
    fadeGroup: SVGGElement;
    fadeRadius: number;
    fadeFill: string;
  };
}

export interface TokenOptions {
  shape?: TokenShape;
  /** Second line per token, revealed as the sequence is completed. */
  subLabels?: readonly string[];
}

/**
 * Center-to-center spacing for the target diamonds — sized so REF_LEN of them
 * fit `availW`. Shared with the play surface, which caps its own cells against
 * this so a puzzle diamond never exceeds a target diamond.
 */
export function targetPitch(availW: number): number {
  const w = Math.max(availW, 200); // guard against transient 0/negative widths
  return Math.min(TOKEN_PITCH_MAX, w / TOKEN_REF_LEN);
}

/**
 * Draw the target intervals as diamonds in a tight horizontal row — the same
 * diamond-in-slot ratio and one-diagonal (near-touching) spacing as the grid.
 * Driven by a shared `pitch` so the size is constant across puzzles and up to
 * REF_LEN fit. Font is scaled so the widest labels (A2/d5) always fit.
 */
export function renderTokens(
  tokensEl: HTMLElement,
  pattern: Pattern,
  pitch: number,
  opts: TokenOptions = {},
): TokenView {
  tokensEl.innerHTML = '';
  if (opts.shape === 'card') return renderCards(tokensEl, pattern, pitch, opts.subLabels ?? []);
  const intervals = pattern.intervals;
  const n = intervals.length;

  const side = (CELL_FILL * pitch) / Math.SQRT2; // drawn diamond side (matches grid)
  const diag = side * Math.SQRT2; // = CELL_FILL * pitch
  const rowW = (n - 1) * pitch + diag;
  const rowH = diag;

  tokensEl.style.width = `${rowW}px`;
  tokensEl.style.height = `${rowH}px`;

  const { polyline, fadeGroup, fadeFill } = makeOverlay(tokensEl, rowW, rowH);

  const fontPx = Math.max(12, Math.min(side * 0.42, 26));
  const tokenEls = new Map<number, HTMLElement>();
  const centers = new Map<number, { x: number; y: number }>();

  intervals.forEach((iv, i) => {
    const cx = diag / 2 + i * pitch;
    const cy = rowH / 2;
    centers.set(i, { x: cx, y: cy });
    const div = document.createElement('div');
    div.className = 'cell token-diamond';
    div.style.left = `${cx - side / 2}px`;
    div.style.top = `${cy - side / 2}px`;
    div.style.width = `${side}px`;
    div.style.height = `${side}px`;
    const glyph = document.createElement('span');
    glyph.className = 'glyph';
    glyph.style.fontSize = `${fontPx}px`;
    glyph.textContent = intervalName(iv);
    div.append(glyph);
    tokensEl.append(div);
    tokenEls.set(i, div);
  });

  return {
    tokenEls,
    subEls: new Map(),
    subLabels: [],
    line: { polyline, centers, fadeGroup, fadeRadius: pitch * 0.38, fadeFill },
  };
}

/** Proportions of a card, against the shared pitch. Taller than wide: the two
 * halves each need a line of text, and a square would squeeze both. */
const CARD_GAP = 0.14; // of pitch
const CARD_TALL = 1.3; // height vs width

/** The card row: interval above, the note it names below. */
function renderCards(
  tokensEl: HTMLElement,
  pattern: Pattern,
  pitch: number,
  subLabels: readonly string[],
): TokenView {
  const intervals = pattern.intervals;
  const n = intervals.length;
  const gap = pitch * CARD_GAP;
  const w = pitch - gap;
  const h = w * CARD_TALL;
  const rowW = n * pitch - gap;

  tokensEl.style.width = `${rowW}px`;
  tokensEl.style.height = `${h}px`;

  // Sized against the card's WIDTH: "Major 7th"-length labels never appear here
  // (they are intervals like M7/d5), but a wide card with small type reads as an
  // empty box, and the halves are half the height so height cannot set it.
  const fontPx = Math.max(12, Math.min(w * 0.36, 26));
  const tokenEls = new Map<number, HTMLElement>();
  const subEls = new Map<number, HTMLElement>();

  intervals.forEach((iv, i) => {
    const card = document.createElement('div');
    card.className = 'token-card';
    card.style.left = `${i * pitch}px`;
    card.style.width = `${w}px`;
    card.style.height = `${h}px`;

    const top = document.createElement('div');
    top.className = 'tk-top';
    top.style.fontSize = `${fontPx}px`;
    top.textContent = intervalName(iv);

    const bottom = document.createElement('div');
    bottom.className = 'tk-bottom';
    bottom.style.fontSize = `${fontPx * 0.94}px`;

    card.append(top, bottom);
    tokensEl.append(card);
    tokenEls.set(i, card);
    subEls.set(i, bottom);
  });

  return { tokenEls, subEls, subLabels };
}

/**
 * Show that the first `count` positions are done: light those tokens, name the
 * notes they turned out to be, and thread the line through them.
 */
export function setTokenProgress(view: TokenView, count: number): void {
  view.tokenEls.forEach((el, i) => el.classList.toggle('selected', i < count));
  view.subEls.forEach((el, i) => {
    el.textContent = i < count ? (view.subLabels[i] ?? '') : '';
  });
  const line = view.line;
  if (!line) return;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) pts.push(line.centers.get(i)!);
  line.polyline.setAttribute('points', pts.map((c) => `${c.x},${c.y}`).join(' '));
  setFadeVertices(line.fadeGroup, pts, line.fadeRadius, line.fadeFill);
}
