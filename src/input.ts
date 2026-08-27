// input.ts — the pure selection transition (docs/03-full-spec.md §5). Kept pure
// so it's unit-testable; game.ts applies the side effects (sound, redraw, check).

/**
 * Given the current ordered `selection` of cell ids and a `tapped` id, return
 * the next selection:
 *  - tapping an already-selected cell rewinds to just before it (drop it + after);
 *  - tapping a cell adjacent to the last selected appends it;
 *  - anything else is rejected (selection unchanged, referentially equal).
 * `isAdjacent(a, b)` reports orthogonal grid adjacency.
 */
export function updateSelection(
  selection: number[],
  tapped: number,
  isAdjacent: (a: number, b: number) => boolean,
): number[] {
  const idx = selection.indexOf(tapped);
  if (idx !== -1) return selection.slice(0, idx); // rewind
  const last = selection[selection.length - 1];
  if (last === undefined || isAdjacent(last, tapped)) return [...selection, tapped]; // append
  return selection; // rejected
}
