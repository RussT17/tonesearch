// render.ts — the shell's view. Draws the 45° diamond grid (DOM cells + an SVG
// path overlay) and the interval tokens. Pure-presentation; imports the shared
// geometry from geometry.ts so the aspect cap and the fit agree.

import type { Puzzle, Cell } from './generate';
import { footprint, latticeToScreen } from './geometry';
import { intervalName, noteName } from './theory';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CELL_FILL = 0.9; // diamond side vs. edge-touching size (leaves a thin gap)

// Mono (currentColor) download glyph for the Install pill.
const ICON_INSTALL =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M12 3v10m0 0l-3.5-3.5M12 13l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M5 20h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

let maskSeq = 0;
const svgEl = (tag: string, attrs: Record<string, string>): SVGElement => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]!);
  return e;
};

/**
 * Give the path line a radial fade mask so it thins to nothing right at each
 * vertex (the letters) and stays bright at the mid-segments (the shared edges).
 * Combined with the line painting on top of the cells, the line crosses cleanly
 * over the diamond edges yet leaves the letters unobstructed. Returns the group
 * to fill with one fade circle per vertex, plus that circle's fill.
 */
function attachFadeMask(
  svg: SVGSVGElement,
  poly: SVGPolylineElement,
  w: number,
  h: number,
): { group: SVGGElement; fill: string } {
  const uid = `pf${maskSeq++}`;
  const M = 48; // margin so the line's glow isn't clipped by the mask region
  const grad = svgEl('radialGradient', { id: `${uid}g` });
  grad.append(
    svgEl('stop', { offset: '0%', 'stop-color': '#000', 'stop-opacity': '1' }),
    svgEl('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': '0' }),
  );
  const group = svgEl('g', {}) as SVGGElement;
  const region = { x: `${-M}`, y: `${-M}`, width: `${w + 2 * M}`, height: `${h + 2 * M}` };
  const mask = svgEl('mask', { id: `${uid}m`, maskUnits: 'userSpaceOnUse', ...region });
  mask.append(svgEl('rect', { ...region, fill: '#fff' }), group); // white = visible; circles subtract
  const defs = svgEl('defs', {});
  defs.append(grad, mask);
  svg.append(defs);
  poly.setAttribute('mask', `url(#${uid}m)`);
  return { group, fill: `url(#${uid}g)` };
}

/** Put a fade circle (radius `r`) at each path vertex so the line dims there. */
function setFadeVertices(
  group: SVGGElement,
  pts: ReadonlyArray<{ x: number; y: number }>,
  r: number,
  fill: string,
): void {
  while (group.firstChild) group.removeChild(group.firstChild);
  for (const p of pts) {
    group.append(svgEl('circle', { cx: `${p.x}`, cy: `${p.y}`, r: `${r}`, fill }));
  }
}

export interface Shell {
  difficultyEl: HTMLSelectElement;
  counterEl: HTMLElement;
  stageEl: HTMLElement;
  gridEl: HTMLElement;
  tokensEl: HTMLElement;
  bandEl: HTMLElement; // the whole target band (label + tokens + name), for fading
  nameEl: HTMLElement;
  installBtn: HTMLButtonElement;
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
  const difficultyEl = el<HTMLSelectElement>('select', 'difficulty');
  difficultyEl.setAttribute('aria-label', 'Difficulty');
  for (const [value, label] of [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']] as const) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    difficultyEl.append(opt);
  }
  const counterEl = el('span', 'counter', 'Solved: 0');
  topbar.append(difficultyEl, counterEl);

  const stageEl = el('div', 'stage');
  const gridEl = el('div', 'grid');
  stageEl.append(gridEl);

  const tokensLabel = el('div', 'tokens-label', 'Find this sequence');
  const tokensEl = el('div', 'tokens');
  const nameEl = el('div', 'seq-name'); // subtle chord/interval name (always visible)
  // Give Up belongs to the current puzzle → sits under the name inside the band,
  // so it fades out/in with the rest of the puzzle on transition.
  const giveUpBtn = el<HTMLButtonElement>('button', 'giveup', 'Give Up');
  giveUpBtn.setAttribute('aria-label', 'Give up and reveal the answer');
  const tokensBand = el('div', 'tokens-band');
  tokensBand.append(tokensLabel, tokensEl, nameEl, giveUpBtn);

  // App-level chrome: borderless, pinned to the screen corners (low prominence).
  // Install (left) is hidden until the browser says the app is installable
  // (game.ts wires beforeinstallprompt).
  const installBtn = el<HTMLButtonElement>('button', 'install');
  installBtn.innerHTML = `${ICON_INSTALL}<span>Install</span>`;
  installBtn.setAttribute('aria-label', 'Install app');
  const muteBtn = el<HTMLButtonElement>('button', 'mute'); // mono icon set by game.paintMute
  muteBtn.setAttribute('aria-label', 'Mute');
  stageEl.setAttribute('aria-label', 'Note grid');
  tokensEl.setAttribute('aria-label', 'Target intervals');

  // Flexible bottom spacer: pulls the grid + target group upward (see §7 layout).
  const footSpacer = el('div', 'foot-spacer');

  root.append(topbar, stageEl, tokensBand, footSpacer, installBtn, muteBtn);
  return { difficultyEl, counterEl, stageEl, gridEl, tokensEl, bandEl: tokensBand, nameEl, installBtn, giveUpBtn, muteBtn };
}

/** References to the rendered grid, so input/game can drive it. */
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
  const availH = Math.max(stageEl.clientHeight - 64, 120); // ~32px spacer above/below a tall grid
  let s = Math.min(availW / box.width, availH / box.height);
  if (maxS !== undefined) s = Math.min(s, maxS);

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
  const fade = attachFadeMask(svg, polyline, box.width * s, box.height * s);

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
  return { cellEls, polyline, centers, fadeGroup: fade.group, fadeRadius: s * 0.5, fadeFill: fade.fill };
}

/** References to the rendered target row, so game.ts can highlight it in step. */
export interface TokenView {
  tokenEls: Map<number, HTMLElement>;
  polyline: SVGPolylineElement;
  centers: Map<number, { x: number; y: number }>;
  fadeGroup: SVGGElement;
  fadeRadius: number;
  fadeFill: string;
}

const TOKEN_REF_LEN = 5; // size the target row to fit up to this many (future 5-note chords)
const TOKEN_PITCH_MAX = 130; // cap on center-to-center spacing (keeps desktop sane)

/**
 * Center-to-center spacing for the target diamonds — sized so REF_LEN of them
 * fit `availW`. Shared with the grid: the puzzle caps its cell size to half this
 * so a puzzle diamond never exceeds a target diamond.
 */
export function targetPitch(availW: number): number {
  const w = Math.max(availW, 200); // guard against transient 0/negative widths
  return Math.min(TOKEN_PITCH_MAX, w / TOKEN_REF_LEN);
}

/**
 * Draw the target intervals as puzzle-style diamonds in a tight horizontal row —
 * the same diamond-in-slot ratio and one-diagonal (near-touching) spacing as the
 * grid. Driven by a shared `pitch` so the size is constant across puzzles and up
 * to REF_LEN fit. Font is scaled so the widest labels (aug2/dim5) always fit.
 */
export function renderTokens(tokensEl: HTMLElement, puzzle: Puzzle, pitch: number): TokenView {
  tokensEl.innerHTML = '';
  const intervals = puzzle.pattern.intervals;
  const n = intervals.length;

  const side = (CELL_FILL * pitch) / Math.SQRT2; // drawn diamond side (matches grid)
  const diag = side * Math.SQRT2; // = CELL_FILL * pitch
  const rowW = (n - 1) * pitch + diag;
  const rowH = diag;

  tokensEl.style.width = `${rowW}px`;
  tokensEl.style.height = `${rowH}px`;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'path-overlay');
  svg.setAttribute('width', `${rowW}`);
  svg.setAttribute('height', `${rowH}`);
  const polyline = document.createElementNS(SVG_NS, 'polyline') as SVGPolylineElement;
  svg.append(polyline);
  tokensEl.append(svg);
  const fade = attachFadeMask(svg, polyline, rowW, rowH);

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

  return { tokenEls, polyline, centers, fadeGroup: fade.group, fadeRadius: pitch * 0.38, fadeFill: fade.fill };
}

/** Draw the pink line through the first `count` satisfied target diamonds. */
export function drawTokenLine(view: TokenView, count: number): void {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) pts.push(view.centers.get(i)!);
  view.polyline.setAttribute('points', pts.map((c) => `${c.x},${c.y}`).join(' '));
  setFadeVertices(view.fadeGroup, pts, view.fadeRadius, view.fadeFill);
}

/** Update the SVG path line to pass through the given ordered cell ids. */
export function drawPath(view: GridView, ids: number[]): void {
  const pts = ids.map((id) => view.centers.get(id)!);
  view.polyline.setAttribute('points', pts.map((c) => `${c.x},${c.y}`).join(' '));
  setFadeVertices(view.fadeGroup, pts, view.fadeRadius, view.fadeFill);
}
