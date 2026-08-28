// generate.ts — shape-first puzzle generation (docs/03-full-spec.md §4).
// Build the empty grid shape by 3×3 accretion, lay a random self-avoiding path
// inside it, name that path from a (pattern, root), fill the rest with decoys.

import type { Fifths } from './theory';
import type { Pattern } from './bank';
import type { Config } from './config';
import { footprint, aspect } from './geometry';
import { makeRng, randInt, pick, weightedPick, type Rng } from './rng';

export interface Cell {
  id: number;
  col: number;
  row: number;
  note: Fifths;
}
export interface Puzzle {
  pattern: Pattern;
  root: Fifths;
  solutionNotes: Fifths[];
  cells: Cell[];
  solutionPath: number[]; // cell ids, in token order
}

interface Coord {
  col: number;
  row: number;
}
const key = (c: number, r: number): string => `${c},${r}`;
const NEIGHBORS: ReadonlyArray<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

/**
 * The win condition (docs/03-full-spec.md §F6): a selected path of notes solves
 * the pattern relative to ANY root. Root-agnostic — compares interval structure,
 * not the generator's specific root. General form survives v2 off-root voicings.
 */
export function isSolution(selectedNotes: readonly Fifths[], pattern: Pattern): boolean {
  const iv = pattern.intervals;
  if (selectedNotes.length !== iv.length) return false;
  const base = selectedNotes[0]! - iv[0]!;
  return iv.every((interval, i) => selectedNotes[i]! - interval === base);
}

/**
 * True if `selectedNotes` correctly realizes the FIRST notes of the pattern
 * relative to some root — a valid partial path. Used for per-step validation:
 * a tap is allowed only if it keeps the selection a valid prefix.
 */
export function isPrefix(selectedNotes: readonly Fifths[], pattern: Pattern): boolean {
  const iv = pattern.intervals;
  if (selectedNotes.length === 0) return true;
  if (selectedNotes.length > iv.length) return false;
  const base = selectedNotes[0]! - iv[0]!;
  return selectedNotes.every((n, i) => n - iv[i]! === base);
}

/** Roots in the pool for which every resulting note stays within noteRange. */
export function validRoots(pattern: Pattern, cfg: Config): Fifths[] {
  const [lo, hi] = cfg.rootPool;
  const [b0, b1] = cfg.noteRange;
  const roots: Fifths[] = [];
  for (let r = lo; r <= hi; r++) {
    if (pattern.intervals.every((iv) => r + iv >= b0 && r + iv <= b1)) roots.push(r);
  }
  return roots;
}

/** 3×3-block accretion inside the bounded start grid → a connected coord list. */
function growBlob(cfg: Config, rng: Rng): Coord[] {
  const { startGridW: W, startGridH: H, gridCellCount: target } = cfg;
  const selected = new Set<string>();
  const inBounds = (c: number, r: number): boolean => c >= 0 && c < W && r >= 0 && r < H;
  const add3x3 = (cc: number, cr: number): void => {
    for (let dc = -1; dc <= 1; dc++)
      for (let dr = -1; dr <= 1; dr++) if (inBounds(cc + dc, cr + dr)) selected.add(key(cc + dc, cr + dr));
  };

  add3x3(randInt(rng, 0, W), randInt(rng, 0, H));

  while (selected.size < target) {
    // frontier: unselected in-bounds cells orthogonally adjacent to the selection
    const frontier: Coord[] = [];
    for (let c = 0; c < W; c++)
      for (let r = 0; r < H; r++) {
        if (selected.has(key(c, r))) continue;
        if (NEIGHBORS.some(([dc, dr]) => selected.has(key(c + dc, r + dr)))) frontier.push({ col: c, row: r });
      }
    if (frontier.length === 0) break; // grid full
    const center = pick(rng, frontier);
    add3x3(center.col, center.row);
  }

  return [...selected]
    .map((k) => {
      const [c, r] = k.split(',').map(Number);
      return { col: c!, row: r! };
    })
    .sort((a, b) => a.col - b.col || a.row - b.row); // deterministic order
}

/** A random self-avoiding orthogonal path of exactly `len` cells, or null. */
function findPath(shape: Set<string>, len: number, rng: Rng): Coord[] | null {
  const cells = [...shape].map((k) => {
    const [c, r] = k.split(',').map(Number);
    return { col: c!, row: r! };
  });
  const starts = shuffle(cells, rng);

  for (const start of starts) {
    const path: Coord[] = [start];
    const visited = new Set<string>([key(start.col, start.row)]);
    if (extend(path, visited, shape, len, rng)) return path;
  }
  return null;
}

function extend(path: Coord[], visited: Set<string>, shape: Set<string>, len: number, rng: Rng): boolean {
  if (path.length === len) return true;
  const last = path[path.length - 1]!;
  const options = shuffle(
    NEIGHBORS.map(([dc, dr]) => ({ col: last.col + dc, row: last.row + dr })).filter(
      (n) => shape.has(key(n.col, n.row)) && !visited.has(key(n.col, n.row)),
    ),
    rng,
  );
  for (const n of options) {
    path.push(n);
    visited.add(key(n.col, n.row));
    if (extend(path, visited, shape, len, rng)) return true;
    path.pop();
    visited.delete(key(n.col, n.row));
  }
  return false;
}

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Pick `n` decoy notes from an offset window that contains `notes`. */
function fillDecoys(notes: Fifths[], n: number, cfg: Config, rng: Rng): Fifths[] {
  const minS = Math.min(...notes);
  const maxS = Math.max(...notes);
  const span = maxS - minS + 1;
  const W = Math.max(cfg.decoyWindowWidth, span);
  const [b0, b1] = cfg.noteRange;
  // L must keep the window containing the notes AND within plausible bounds.
  const loL = Math.max(maxS - W + 1, b0);
  const hiL = Math.min(minS, b1 - W + 1);
  const L = randInt(rng, loL, hiL + 1); // uniform in [loL, hiL] → off-center placement
  const window = Array.from({ length: W }, (_, i) => L + i);
  return Array.from({ length: n }, () => pick(rng, window));
}

/** Generate one puzzle from the given pattern set. Deterministic given `seed`. */
export function generatePuzzle(cfg: Config, patterns: readonly Pattern[], seed: number): Puzzle {
  const rng = makeRng(seed);

  const pattern = weightedPick(rng, patterns, (p) => cfg.patternWeights?.[p.name] ?? 1);
  const roots = validRoots(pattern, cfg);
  if (roots.length === 0) throw new Error(`No valid roots for pattern ${pattern.name}`);
  const root = weightedPick(rng, roots, (r) => Math.exp(-cfg.rootCenterBias * Math.abs(r)));
  const solutionNotes = pattern.intervals.map((iv) => root + iv);
  const len = pattern.intervals.length;

  // Retry loop: aspect guard + path existence (both rarely fail).
  for (let attempt = 0; attempt < 50; attempt++) {
    const shapeCoords = growBlob(cfg, rng);
    if (aspect(footprint(shapeCoords)) > cfg.gridMaxAspect) continue;
    const shapeSet = new Set(shapeCoords.map((c) => key(c.col, c.row)));
    const path = findPath(shapeSet, len, rng);
    if (!path) continue;

    // Assign ids and notes.
    const pathKeys = new Set(path.map((c) => key(c.col, c.row)));
    const decoys = fillDecoys(solutionNotes, shapeCoords.length - len, cfg, rng);
    let decoyIdx = 0;
    const idOf = new Map<string, number>();
    const cells: Cell[] = shapeCoords.map((c, id) => {
      idOf.set(key(c.col, c.row), id);
      const note = pathKeys.has(key(c.col, c.row)) ? 0 : decoys[decoyIdx++]!; // path notes set below
      return { id, col: c.col, row: c.row, note };
    });
    const solutionPath = path.map((c, i) => {
      const id = idOf.get(key(c.col, c.row))!;
      cells[id]!.note = solutionNotes[i]!;
      return id;
    });

    return { pattern, root, solutionNotes, cells, solutionPath };
  }
  throw new Error('Puzzle generation failed after retries');
}
