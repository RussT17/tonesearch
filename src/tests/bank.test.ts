import { describe, it, expect } from 'vitest';
import { BANK, bankForTier, type Tier } from '../bank';

describe('bank integrity', () => {
  it('has 45 patterns (15 dyads + 30 chords) with unique names', () => {
    expect(BANK.length).toBe(45);
    expect(new Set(BANK.map((p) => p.name)).size).toBe(45);
    const dyads = BANK.filter((p) => p.intervals.length === 2);
    expect(dyads.length).toBe(15);
  });

  it('every pattern is root-position, ≤5 notes, no duplicate tones, and named', () => {
    for (const p of BANK) {
      expect(p.intervals[0]).toBe(0); // R
      expect(p.intervals.length).toBeLessThanOrEqual(5);
      expect(new Set(p.intervals).size).toBe(p.intervals.length);
      expect(p.display.length).toBeGreaterThan(0);
      expect(['easy', 'medium', 'hard']).toContain(p.tier);
    }
  });

  it('marks exactly {dom13, maj13, min13, min11} as reduced', () => {
    const reduced = new Set(BANK.filter((p) => p.reduced).map((p) => p.name));
    expect(reduced).toEqual(new Set(['dom13', 'maj13', 'min13', 'min11']));
  });

  it('bankForTier is cumulative with expected counts (12 / 25 / 45)', () => {
    const counts: Record<Tier, number> = { easy: 12, medium: 25, hard: 45 };
    for (const tier of ['easy', 'medium', 'hard'] as Tier[]) {
      expect(bankForTier(tier).length).toBe(counts[tier]);
    }
    const easy = new Set(bankForTier('easy').map((p) => p.name));
    const medium = new Set(bankForTier('medium').map((p) => p.name));
    const hard = new Set(bankForTier('hard').map((p) => p.name));
    for (const n of easy) expect(medium.has(n)).toBe(true); // easy ⊂ medium
    for (const n of medium) expect(hard.has(n)).toBe(true); // medium ⊂ hard
  });
});
