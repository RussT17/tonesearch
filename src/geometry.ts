// geometry.ts — the 45° diamond-lattice math. PURE and shared by generate.ts
// (aspect cap on the rotated footprint) and render.ts (scale-to-fit), so the two
// never disagree about "footprint". See docs/04-design.md §5.
//
// Grid cells live at integer (col, row). Displayed, the lattice is rotated 45°,
// so a cell is a diamond. For edge-touching diamonds, cell diagonal = 2·s, i.e.
// the half-diagonal equals the spacing `s`.

export interface Point {
  x: number;
  y: number;
}
export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}
export interface GridCoord {
  col: number;
  row: number;
}

/** Lattice (col,row) → screen center, a 45° rotation scaled by `s`. */
export const latticeToScreen = (col: number, row: number, s = 1): Point => ({
  x: (col - row) * s,
  y: (col + row) * s,
});

/**
 * Axis-aligned bounding box of the rendered cells, inflated by a half-diagonal
 * (= `s`) on each side so edge diamonds don't clip. Empty input → zero box.
 */
export function footprint(cells: readonly GridCoord[], s = 1): Box {
  if (cells.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of cells) {
    const p = latticeToScreen(c.col, c.row, s);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  minX -= s; minY -= s; maxX += s; maxY += s;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Aspect ratio (longer / shorter side) of a box; 1 for a square, ∞-safe. */
export const aspect = (b: Box): number => {
  const lo = Math.min(b.width, b.height);
  return lo === 0 ? Infinity : Math.max(b.width, b.height) / lo;
};
