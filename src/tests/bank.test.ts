import { describe, it, expect } from 'vitest';
import { BANK } from '../bank';
import { intervalName } from '../theory';

describe('bank integrity', () => {
  it('has 26 patterns with unique names', () => {
    expect(BANK.length).toBe(26);
    expect(new Set(BANK.map((p) => p.name)).size).toBe(26);
  });

  it('every pattern starts on R and has no duplicate tones (root-position)', () => {
    for (const p of BANK) {
      expect(p.intervals[0]).toBe(0); // R
      expect(new Set(p.intervals).size).toBe(p.intervals.length);
    }
  });

  it('covers exactly the 16 expected intervals, missing only augR/dimR/dim4', () => {
    const used = new Set(BANK.flatMap((p) => p.intervals));
    expect(used.size).toBe(16);
    // present sample
    for (const f of [0, 1, -3, 4, 6, 9, -9]) expect(used.has(f)).toBe(true);
    // the three musically-implausible omissions
    for (const f of [7, -7, -8]) expect(used.has(f)).toBe(false);
    expect([...used].map(intervalName)).not.toContain('augR');
  });
});
