import { describe, it, expect } from 'vitest';
import { makeRng, randInt, pick, weightedPick } from '../rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('differs across seeds', () => {
    expect(makeRng(1).next()).not.toBe(makeRng(2).next());
  });

  it('randInt stays within [lo, hi)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 200; i++) {
      const n = randInt(r, 3, 9);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThan(9);
    }
  });

  it('weightedPick never selects a zero-weight item', () => {
    const r = makeRng(99);
    const items = ['a', 'b', 'c'] as const;
    const weight = (t: string) => (t === 'a' ? 1 : 0);
    for (let i = 0; i < 100; i++) expect(weightedPick(r, items, weight)).toBe('a');
    expect(items).toContain(pick(r, items));
  });
});
