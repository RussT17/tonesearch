import { describe, it, expect } from 'vitest';
import { BANK, bankForTier, type Tier } from '../bank';

const TIERS: Tier[] = ['easy', 'medium', 'hard', 'expert'];

describe('bank integrity', () => {
  it('has the expected cumulative counts per tier, with unique ids', () => {
    const counts: Record<Tier, number> = { easy: 12, medium: 25, hard: 45, expert: 106 };
    for (const tier of TIERS) expect(bankForTier(tier).length).toBe(counts[tier]);
    expect(BANK.length).toBe(106); // 45 E/M/H + 61 Expert
    expect(new Set(BANK.map((p) => p.name)).size).toBe(106);
  });

  it('every pattern is 2–5 notes, no duplicate tones, named, valid tier', () => {
    for (const p of BANK) {
      expect(p.intervals.length).toBeGreaterThanOrEqual(2);
      expect(p.intervals.length).toBeLessThanOrEqual(5);
      expect(new Set(p.intervals).size).toBe(p.intervals.length);
      expect(p.display.length).toBeGreaterThan(0);
      expect(TIERS).toContain(p.tier);
    }
  });

  it('only the four bare triads are kind "triad" (inversions are chords)', () => {
    const triads = new Set(BANK.filter((p) => p.kind === 'triad').map((p) => p.name));
    expect(triads).toEqual(new Set(['maj', 'min', 'dim', 'aug']));
  });

  it('E/M/H are all root-position; only Expert may start off-root', () => {
    for (const p of BANK) if (p.tier !== 'expert') expect(p.intervals[0]).toBe(0);
    expect(bankForTier('expert').some((p) => p.intervals[0] !== 0)).toBe(true); // inversions/rootless
  });

  it('the Hard-and-below reduced set is exactly {dom13, maj13, min13, min11}', () => {
    const reduced = new Set(bankForTier('hard').filter((p) => p.reduced).map((p) => p.name));
    expect(reduced).toEqual(new Set(['dom13', 'maj13', 'min13', 'min11']));
  });

  it('bankForTier is cumulative (easy ⊂ medium ⊂ hard ⊂ expert)', () => {
    for (let i = 1; i < TIERS.length; i++) {
      const lo = new Set(bankForTier(TIERS[i - 1]!).map((p) => p.name));
      const hi = new Set(bankForTier(TIERS[i]!).map((p) => p.name));
      for (const n of lo) expect(hi.has(n)).toBe(true);
    }
  });
});
