import { describe, it, expect } from 'vitest';
import { type Tier } from '../pattern';
import { PACK_LIST, ALL_PATTERNS, commonness, sampleHarmony, configViolations } from '../harmony';
import { makeRng } from '../rng';

const TIERS: Tier[] = ['easy', 'medium', 'hard', 'expert'];

describe('harmony packs / patterns', () => {
  it('every pack is non-empty and all patterns parse to 2–5 distinct tones', () => {
    for (const pack of PACK_LIST) expect(pack.patterns.length).toBeGreaterThan(0);
    expect(ALL_PATTERNS.length).toBe(118); // migrated from the former bank, nothing lost
    for (const p of ALL_PATTERNS) {
      expect(p.intervals.length).toBeGreaterThanOrEqual(2);
      expect(p.intervals.length).toBeLessThanOrEqual(5);
      expect(new Set(p.intervals).size).toBe(p.intervals.length); // no duplicate tones
      expect(p.display.length).toBeGreaterThan(0);
    }
  });

  it('kind "triad" names one of the four triad qualities', () => {
    const qualities = new Set(['Major', 'Minor', 'Diminished', 'Augmented']);
    for (const p of ALL_PATTERNS) if (p.kind === 'triad') expect(qualities.has(p.display)).toBe(true);
  });
});

describe('harmony config invariant (docs/09 §4)', () => {
  it('no dead ends: keys/modes present, and every live (mode, degree) has ≥1 pattern', () => {
    expect(configViolations()).toEqual([]);
  });
});

describe('commonness', () => {
  it('is the highest matching floor; null off any tone-set', () => {
    const maj = ALL_PATTERNS.find((p) => p.display === 'Major' && p.kind === 'triad' && !p.qualifier)!;
    const lydSig = ALL_PATTERNS.find((p) => p.display === 'maj7♯11')!; // the ♯11 shell
    const dim7 = ALL_PATTERNS.find((p) => p.display === 'Diminished 7th' && p.kind === 'chord')!;
    // major IV (degree −1): a plain major triad is diatonic (Lydian) → ultra
    expect(commonness(maj, 'major', -1)).toBe('ultra');
    // the ♯11 chord is the Lydian signature on IV → ultra; on I it's the (rarer)
    // Lydian tonic, reachable at 'occasional'
    expect(commonness(lydSig, 'major', -1)).toBe('ultra');
    expect(commonness(lydSig, 'major', 0)).toBe('occasional');
    // a fully-diminished 7th fits no tone-set on the major tonic → null
    expect(commonness(dim7, 'major', 0)).toBeNull();
  });
});

describe('sampleHarmony', () => {
  it('is deterministic per seed; notes = root + intervals', () => {
    for (const tier of TIERS) {
      const a = sampleHarmony(tier, makeRng(42));
      const b = sampleHarmony(tier, makeRng(42));
      expect(a).toEqual(b);
      expect(a.pattern.intervals.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('Easy is major-only in near keys; Expert reaches wider', () => {
    const easyModes = new Set<string>();
    const easySigs = new Set<number>();
    for (let s = 0; s < 400; s++) {
      const p = sampleHarmony('easy', makeRng(s));
      easyModes.add(p.mode);
      easySigs.add(p.sig);
    }
    expect([...easyModes]).toEqual(['major']);
    expect(Math.max(...[...easySigs].map(Math.abs))).toBeLessThanOrEqual(1);

    const expertSigs = new Set<number>();
    for (let s = 0; s < 400; s++) expertSigs.add(sampleHarmony('expert', makeRng(s)).sig);
    expect(Math.max(...[...expertSigs].map(Math.abs))).toBeGreaterThan(1);
  });
});
