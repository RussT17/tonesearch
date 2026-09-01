import { describe, it, expect } from 'vitest';
import { BANK, type Tier } from '../bank';
import { PACKS, commonness, sampleHarmony, configViolations } from '../harmony';
import { makeRng } from '../rng';

const TIERS: Tier[] = ['easy', 'medium', 'hard', 'expert'];

describe('harmony packs', () => {
  it('the packs partition the bank — every pattern in exactly one pack', () => {
    const names = PACKS.flatMap((p) => p.members.map((m) => m.name));
    expect(names.length).toBe(BANK.length); // no dups, no misses (count)
    expect(new Set(names)).toEqual(new Set(BANK.map((p) => p.name))); // same set
  });
});

describe('harmony config invariant (docs/09 §4)', () => {
  it('no dead ends: every positive-weight (mode, degree) has ≥1 pattern; keys/modes present', () => {
    expect(configViolations()).toEqual([]);
  });
});

describe('commonness', () => {
  it('is the highest matching floor; undefined off any tone-set', () => {
    const maj = BANK.find((p) => p.name === 'maj')!;
    const maj7s11 = BANK.find((p) => p.name === 'maj7♯11-shell')!;
    // major IV (degree −1): a plain major triad is diatonic (Lydian) → ultra
    expect(commonness(maj, 'major', -1)).toBe('ultra');
    // maj7♯11 is the Lydian signature chord on IV → ultra; on I (Ionian) it needs
    // the ♯4, which Ionian lacks → not present
    expect(commonness(maj7s11, 'major', -1)).toBe('ultra');
    expect(commonness(maj7s11, 'major', 0)).toBeNull();
  });
});

describe('sampleHarmony', () => {
  it('is deterministic per seed and yields spelled notes = root + intervals', () => {
    for (const tier of TIERS) {
      const a = sampleHarmony(tier, makeRng(42));
      const b = sampleHarmony(tier, makeRng(42));
      expect(a).toEqual(b);
      const notes = a.pattern.intervals.map((iv) => a.rootNote + iv);
      // root is tonic + degree; every note is root + its interval (sanity)
      expect(notes[0]).toBe(a.rootNote + a.pattern.intervals[0]!);
      expect(a.pattern.intervals.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('Easy is major-only and stays near common keys; Expert reaches wider', () => {
    const easyModes = new Set<string>();
    const easySigs = new Set<number>();
    for (let s = 0; s < 400; s++) {
      const p = sampleHarmony('easy', makeRng(s));
      easyModes.add(p.mode);
      easySigs.add(p.sig);
    }
    expect([...easyModes]).toEqual(['major']); // Easy = major only
    expect(Math.max(...[...easySigs].map(Math.abs))).toBeLessThanOrEqual(1); // sig ∈ {0,±1}

    const expertSigs = new Set<number>();
    for (let s = 0; s < 400; s++) expertSigs.add(sampleHarmony('expert', makeRng(s)).sig);
    expect(Math.max(...[...expertSigs].map(Math.abs))).toBeGreaterThan(1); // Expert opens keys up
  });
});
