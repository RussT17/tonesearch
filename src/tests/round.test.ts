import { describe, expect, it } from 'vitest';
import { generateScribeRound } from '../scribe/round';
import {
  bottomLineStep,
  ledgerLinesIn,
  midiOf,
  validStarts,
  writtenSpan,
} from '../core/staff';
import type { Tier } from '../core/pattern';

const TIERS: Tier[] = ['easy', 'medium', 'hard', 'expert'];
const rounds = (tier: Tier, n = 400) =>
  Array.from({ length: n }, (_, i) => generateScribeRound(tier, i * 7919 + 13));

describe('every generated round is playable', () => {
  it('has exactly one placement inside its band', () => {
    for (const tier of TIERS) {
      for (const r of rounds(tier)) {
        expect(validStarts(r.solutionNotes, r.range)).toEqual([r.solutionSteps[0]]);
      }
    }
  });

  it('writes the answer entirely within the band', () => {
    for (const tier of TIERS) {
      for (const r of rounds(tier)) {
        for (const step of r.solutionSteps) {
          expect(step).toBeGreaterThanOrEqual(r.range.lo);
          expect(step).toBeLessThanOrEqual(r.range.hi);
        }
      }
    }
  });

  // The band should be generous. A band only as tall as the answer would make
  // placement a formality, and a one-step band on a single note gives it away.
  it('makes the band as wide as uniqueness allows', () => {
    for (const tier of TIERS) {
      for (const r of rounds(tier)) {
        const span = writtenSpan(r.solutionNotes);
        expect(r.range.hi - r.range.lo).toBeLessThanOrEqual(span + 6);
      }
    }
  });

  it('never gives a single note a trivial band', () => {
    const singles = rounds('easy', 1500).filter((r) => r.pattern.kind === 'note');
    expect(singles.length).toBeGreaterThan(50); // the tier really does produce them
    for (const r of singles) {
      expect(r.range.hi - r.range.lo).toBeGreaterThanOrEqual(4);
      expect(validStarts(r.solutionNotes, r.range)).toHaveLength(1);
    }
  });
});

describe('difficulty controls how far off the staff you go', () => {
  // Easy should not ask you to read a ledger line: that is a separate skill, and
  // meeting it at the same time as the staff itself is what makes a first
  // attempt feel impossible.
  it('keeps Easy on the staff', () => {
    for (const r of rounds('easy', 1200)) {
      expect(ledgerLinesIn(r.range, r.clef)).toEqual([]);
      const bottom = bottomLineStep(r.clef);
      expect(r.range.lo).toBeGreaterThanOrEqual(bottom);
      expect(r.range.hi).toBeLessThanOrEqual(bottom + 8);
    }
  });

  it('opens up gradually, and never past its allowance', () => {
    const maxLedger: Record<Tier, number> = { easy: 0, medium: 1, hard: 2, expert: 3 };
    for (const tier of TIERS) {
      for (const r of rounds(tier, 600)) {
        const bottom = bottomLineStep(r.clef);
        const over = Math.max(0, r.range.hi - (bottom + 8), bottom - r.range.lo);
        // A voicing too tall for the staff forces extra room; that is the only
        // way a tier exceeds its own allowance.
        const forced = writtenSpan(r.solutionNotes) > 8;
        if (!forced) expect(Math.ceil(over / 2)).toBeLessThanOrEqual(maxLedger[tier]);
      }
    }
  });

  it('lets the harder tiers actually reach ledger lines', () => {
    for (const tier of ['medium', 'hard', 'expert'] as Tier[]) {
      const reached = rounds(tier, 600).some((r) => ledgerLinesIn(r.range, r.clef).length > 0);
      expect(reached).toBe(true);
    }
  });
});

describe('sounding pitch follows the written position', () => {
  it('matches each notehead, octave included', () => {
    for (const tier of TIERS) {
      for (const r of rounds(tier, 200)) {
        expect(r.solutionMidis).toEqual(
          r.solutionSteps.map((step, i) => midiOf(step, r.solutionNotes[i]!)),
        );
      }
    }
  });

  it('rises with the written notes, since they are written ascending', () => {
    for (const tier of TIERS) {
      for (const r of rounds(tier, 200)) {
        for (let i = 1; i < r.solutionMidis.length; i++) {
          expect(r.solutionMidis[i]!).toBeGreaterThan(r.solutionMidis[i - 1]!);
        }
      }
    }
  });

  it('stays in a register a person would actually sing or play', () => {
    for (const tier of TIERS) {
      for (const r of rounds(tier, 400)) {
        for (const m of r.solutionMidis) {
          expect(m).toBeGreaterThan(31); // below G1 is subterranean
          expect(m).toBeLessThan(96); // above B6 is piccolo territory
        }
      }
    }
  });
});
