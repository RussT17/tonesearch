// tokens.ts — the target sequence: the intervals to be found (ToneSearch) or
// written (ToneScribe), drawn as a tight horizontal row of diamonds with a line
// threading the ones satisfied so far. Identical in both games; only the theme
// colours differ, and those come from CSS.

import type { Pattern } from '../core/pattern';
import { intervalName } from '../core/theory';
import { makeOverlay, setFadeVertices } from './svg';

const CELL_FILL = 0.9; // diamond side vs. edge-touching size (leaves a thin gap)
const TOKEN_REF_LEN = 5; // size the row to fit up to this many (5-note chords)
const TOKEN_PITCH_MAX = 78; // fixed target-diamond size (matches a phone; caps desktop)

/** References to the rendered target row, so the session can light it in step. */
export interface TokenView {
  tokenEls: Map<number, HTMLElement>;
  polyline: SVGPolylineElement;
  centers: Map<number, { x: number; y: number }>;
  fadeGroup: SVGGElement;
  fadeRadius: number;
  fadeFill: string;
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
export function renderTokens(tokensEl: HTMLElement, pattern: Pattern, pitch: number): TokenView {
  tokensEl.innerHTML = '';
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

  return { tokenEls, polyline, centers, fadeGroup, fadeRadius: pitch * 0.38, fadeFill };
}

/** Draw the line through the first `count` satisfied target diamonds. */
export function drawTokenLine(view: TokenView, count: number): void {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) pts.push(view.centers.get(i)!);
  view.polyline.setAttribute('points', pts.map((c) => `${c.x},${c.y}`).join(' '));
  setFadeVertices(view.fadeGroup, pts, view.fadeRadius, view.fadeFill);
}
