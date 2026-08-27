import { describe, it, expect } from 'vitest';
import { latticeToScreen, footprint, aspect } from '../geometry';

describe('geometry (45° lattice)', () => {
  it('maps the lattice via the 45° rotation', () => {
    expect(latticeToScreen(0, 0, 1)).toEqual({ x: 0, y: 0 });
    expect(latticeToScreen(1, 0, 1)).toEqual({ x: 1, y: 1 });
    expect(latticeToScreen(0, 1, 1)).toEqual({ x: -1, y: 1 });
    expect(latticeToScreen(1, 1, 2)).toEqual({ x: 0, y: 4 });
  });

  it('inflates a single cell to a full diamond (2s × 2s) with aspect 1', () => {
    const box = footprint([{ col: 0, row: 0 }], 1);
    expect(box.width).toBe(2);
    expect(box.height).toBe(2);
    expect(aspect(box)).toBe(1);
  });

  it('bounds a small blob and reports a finite aspect', () => {
    const cells = [
      { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 },
    ];
    const box = footprint(cells, 1);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(aspect(box)).toBeGreaterThanOrEqual(1);
  });

  it('handles empty input without throwing', () => {
    expect(footprint([], 1).width).toBe(0);
  });
});
