// render.ts — the shell's view. Draws the 45° diamond grid (DOM cells + an SVG
// path overlay) and the interval tokens. Pure-presentation; imports the shared
// geometry from geometry.ts so the aspect cap and the fit agree.

import type { Puzzle, Cell } from './generate';
import { footprint, latticeToScreen } from './geometry';
import { intervalName, noteName } from './theory';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CELL_FILL = 0.9; // diamond side vs. edge-touching size (leaves a thin gap)

export interface Shell {
  difficultyEl: HTMLElement;
  counterEl: HTMLElement;
  stageEl: HTMLElement;
  gridEl: HTMLElement;
  tokensEl: HTMLElement;
  giveUpBtn: HTMLButtonElement;
  muteBtn: HTMLButtonElement;
}

/** Build the static app skeleton once; returns handles to the live regions. */
export function mountShell(root: HTMLElement): Shell {
  root.innerHTML = '';
  const el = <T extends HTMLElement>(tag: string, cls?: string, text?: string): T => {
    const e = document.createElement(tag) as T;
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };

  const topbar = el('div', 'topbar');
  const difficultyEl = el('span', 'difficulty', 'Medium');
  const counterEl = el('span', 'counter', 'Solved: 0');
  topbar.append(difficultyEl, counterEl);

  const stageEl = el('div', 'stage');
  const gridEl = el('div', 'grid');
  stageEl.append(gridEl);

  const tokensEl = el('div', 'tokens');

  const controls = el('div', 'controls');
  const giveUpBtn = el<HTMLButtonElement>('button', 'giveup', 'Give Up');
  giveUpBtn.setAttribute('aria-label', 'Give up and reveal the answer');
  const muteBtn = el<HTMLButtonElement>('button', 'mute', '🔊');
  muteBtn.setAttribute('aria-label', 'Mute');
  controls.append(giveUpBtn, muteBtn);
  stageEl.setAttribute('aria-label', 'Note grid');
  tokensEl.setAttribute('aria-label', 'Target intervals');

  root.append(topbar, stageEl, tokensEl, controls);
  return { difficultyEl, counterEl, stageEl, gridEl, tokensEl, giveUpBtn, muteBtn };
}

/** References to the rendered grid, so input/game can drive it. */
export interface GridView {
  cellEls: Map<number, HTMLElement>;
  polyline: SVGPolylineElement;
  centers: Map<number, { x: number; y: number }>;
}

/**
 * Draw `puzzle` into `gridEl`, sized to fit `stageEl`. Cells are diamonds; the
 * SVG polyline (empty until a path is selected) draws the connecting line.
 */
export function renderGrid(stageEl: HTMLElement, gridEl: HTMLElement, puzzle: Puzzle): GridView {
  gridEl.innerHTML = '';
  const cells = puzzle.cells;

  // Footprint in unit spacing, then choose pixel spacing s to fit the stage.
  const box = footprint(cells, 1);
  const availW = Math.max(stageEl.clientWidth - 16, 120);
  const availH = Math.max(stageEl.clientHeight - 16, 120);
  const s = Math.min(availW / box.width, availH / box.height);

  const px = (cell: Cell): { x: number; y: number } => {
    const p = latticeToScreen(cell.col, cell.row, s);
    return { x: p.x - box.minX * s, y: p.y - box.minY * s };
  };

  gridEl.style.width = `${box.width * s}px`;
  gridEl.style.height = `${box.height * s}px`;

  // SVG overlay for the path line.
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'path-overlay');
  svg.setAttribute('width', `${box.width * s}`);
  svg.setAttribute('height', `${box.height * s}`);
  const polyline = document.createElementNS(SVG_NS, 'polyline') as SVGPolylineElement;
  svg.append(polyline);
  gridEl.append(svg);

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

  return { cellEls, polyline, centers };
}

/** Draw the interval tokens (R – m3 – P5 …) below the grid. */
export function renderTokens(tokensEl: HTMLElement, puzzle: Puzzle): void {
  tokensEl.innerHTML = '';
  puzzle.pattern.intervals.forEach((iv, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'token-sep';
      sep.textContent = '–';
      tokensEl.append(sep);
    }
    const t = document.createElement('span');
    t.className = 'token';
    t.textContent = intervalName(iv);
    tokensEl.append(t);
  });
}

/** Update the SVG path line to pass through the given ordered cell ids. */
export function drawPath(view: GridView, ids: number[]): void {
  const pts = ids.map((id) => {
    const c = view.centers.get(id)!;
    return `${c.x},${c.y}`;
  });
  view.polyline.setAttribute('points', pts.join(' '));
}
