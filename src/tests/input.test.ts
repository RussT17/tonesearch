import { describe, it, expect } from 'vitest';
import { updateSelection } from '../input';

// A simple linear adjacency for tests: ids are adjacent iff they differ by 1.
const adj = (a: number, b: number): boolean => Math.abs(a - b) === 1;

describe('updateSelection', () => {
  it('appends the first tap and adjacent taps', () => {
    expect(updateSelection([], 5, adj)).toEqual([5]);
    expect(updateSelection([5], 6, adj)).toEqual([5, 6]);
  });

  it('rejects a non-adjacent tap (unchanged, same reference)', () => {
    const sel = [5, 6];
    expect(updateSelection(sel, 9, adj)).toBe(sel);
  });

  it('rewinds when tapping an already-selected earlier cell', () => {
    expect(updateSelection([5, 6, 7, 8], 6, adj)).toEqual([5]); // drop 6,7,8
    expect(updateSelection([5, 6, 7, 8], 8, adj)).toEqual([5, 6, 7]); // pop-one special case
    expect(updateSelection([5, 6, 7, 8], 5, adj)).toEqual([]); // rewind to empty
  });
});
