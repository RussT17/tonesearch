// render.ts — ToneSearch's play surface: the 45° diamond grid (DOM cells + an
// SVG path overlay). Pure presentation; imports the shared geometry so the
// aspect cap and the fit agree, and the shared SVG helpers so its path line
// looks the same as the target row's.

import type { Puzzle, Cell } from '../core/generate';
import { footprint, latticeToScreen } from '../core/geometry';
import { noteName } from '../core/theory';
import { makeOverlay, setFadeVertices } from '../shell/svg';

const CELL_FILL = 0.9; // diamond side vs. edge-touching size (leaves a thin gap)

/** References to the rendered grid, so the board can drive it. */
export interface GridView {
  cellEls: Map<number, HTMLElement>;
  polyline: SVGPolylineElement;
  centers: Map<number, { x: number; y: number }>;
  fadeGroup: SVGGElement;
  fadeRadius: number;
  fadeFill: string;
}

/**
 * Draw `puzzle` into `gridEl`, sized to fit `stageEl`. Cells are diamonds; the
 * SVG polyline (empty until a path is selected) draws the connecting line.
 */
export function renderGrid(
  stageEl: HTMLElement,
  gridEl: HTMLElement,
  puzzle: Puzzle,
  maxS?: number,
): GridView {
  gridEl.innerHTML = '';
  const cells = puzzle.cells;

  // Footprint in unit spacing, then choose pixel spacing s to fit the stage,
  // capped at maxS so a puzzle diamond never exceeds a target diamond. The
  // vertical inset is larger so a tall grid keeps a small spacer above/below
  // (doesn't crowd the top bar or the target row).
  const box = footprint(cells, 1);
  const availW = Math.max(stageEl.clientWidth - 16, 120);
  const availH = Math.max(stageEl.clientHeight - 64, 120); // ~32px spacer above/below
  let s = Math.min(availW / box.width, availH / box.height);
  if (maxS !== undefined) s = Math.min(s, maxS);

  const px = (cell: Cell): { x: number; y: number } => {
    const p = latticeToScreen(cell.col, cell.row, s);
    return { x: p.x - box.minX * s, y: p.y - box.minY * s };
  };

  gridEl.style.width = `${box.width * s}px`;
  gridEl.style.height = `${box.height * s}px`;

  const { polyline, fadeGroup, fadeFill } = makeOverlay(gridEl, box.width * s, box.height * s);

  const d = s * Math.SQRT2 * CELL_FILL; // diamond side length
  const glyphPx = Math.max(11, Math.min(d * 0.42, 26));

  const cellEls = new Map<number, HTMLElement>();
  const centers = new Map<number, { x: number; y: number }>();

  for (const cell of cells) {
    const c = px(cell);
    centers.set(cell.id, c);
    const div = document.createElement('div');
    div.className = 'cell';
    div.dataset.id = String(cell.id);
    div.style.left = `${c.x - d / 2}px`;
    div.style.top = `${c.y - d / 2}px`;
    div.style.width = `${d}px`;
    div.style.height = `${d}px`;
    const glyph = document.createElement('span');
    glyph.className = 'glyph';
    glyph.style.fontSize = `${glyphPx}px`;
    glyph.textContent = noteName(cell.note);
    div.append(glyph);
    gridEl.append(div);
    cellEls.set(cell.id, div);
  }

  // fade covers the letter (~0.5·s) but stays well inside the edge crossing (~0.7·s)
  return { cellEls, polyline, centers, fadeGroup, fadeRadius: s * 0.5, fadeFill };
}

/** Update the SVG path line to pass through the given ordered cell ids. */
export function drawPath(view: GridView, ids: number[]): void {
  const pts = ids.map((id) => view.centers.get(id)!);
  view.polyline.setAttribute('points', pts.map((c) => `${c.x},${c.y}`).join(' '));
  setFadeVertices(view.fadeGroup, pts, view.fadeRadius, view.fadeFill);
}
