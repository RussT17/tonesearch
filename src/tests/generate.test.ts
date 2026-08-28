import { describe, it, expect } from 'vitest';
import { generatePuzzle, validRoots, isSolution, isPrefix, type Puzzle } from '../generate';
import { configFor } from '../config';
import { bankForTier, type Tier } from '../bank';
import { footprint, aspect } from '../geometry';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const SEEDS = Array.from({ length: 150 }, (_, i) => i);

function cellById(p: Puzzle, id: number) {
  return p.cells.find((c) => c.id === id)!;
}

// BFS connectivity over orthogonal adjacency among the grid's cells.
function isConnected(p: Puzzle): boolean {
  const keys = new Set(p.cells.map((c) => `${c.col},${c.row}`));
  const seen = new Set<string>();
  const start = p.cells[0]!;
  const stack = [`${start.col},${start.row}`];
  while (stack.length) {
    const k = stack.pop()!;
    if (seen.has(k)) continue;
    seen.add(k);
    const [c, r] = k.split(',').map(Number);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = `${c! + dc},${r! + dr}`;
      if (keys.has(nk) && !seen.has(nk)) stack.push(nk);
    }
  }
  return seen.size === p.cells.length;
}

describe('validRoots', () => {
  it('is non-empty for every pattern within its tier (the generation hang guard)', () => {
    for (const tier of TIERS) {
      const cfg = configFor(tier);
      for (const p of bankForTier(tier)) {
        expect(validRoots(p, cfg).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('generatePuzzle invariants (every tier, many seeds)', () => {
  it('holds all structural invariants', () => {
    for (const tier of TIERS) {
      const cfg = configFor(tier);
      const patterns = bankForTier(tier);
      const [lo, hi] = cfg.noteRange;
      for (const seed of SEEDS) {
        const p = generatePuzzle(cfg, patterns, seed);
        const len = p.pattern.intervals.length;

        // solution path shape
        expect(p.solutionPath.length).toBe(len);
        expect(new Set(p.solutionPath).size).toBe(len); // distinct cells
        const pathCells = p.solutionPath.map((id) => cellById(p, id));
        for (let i = 1; i < pathCells.length; i++) {
          const a = pathCells[i - 1]!;
          const b = pathCells[i]!;
          expect(Math.abs(a.col - b.col) + Math.abs(a.row - b.row)).toBe(1); // orthogonal
        }

        // path notes equal root + intervals
        expect(pathCells.map((c) => c.note)).toEqual(p.solutionNotes);
        expect(p.solutionNotes).toEqual(p.pattern.intervals.map((iv) => p.root + iv));

        // it actually solves, root-agnostically
        expect(isSolution(pathCells.map((c) => c.note), p.pattern)).toBe(true);

        // every note (solution + decoy) within the tier's noteRange
        for (const c of p.cells) {
          expect(c.note).toBeGreaterThanOrEqual(lo);
          expect(c.note).toBeLessThanOrEqual(hi);
        }

        // grid: connected, met-or-exceeded target, aspect within cap
        expect(isConnected(p)).toBe(true);
        expect(p.cells.length).toBeGreaterThanOrEqual(cfg.gridCellCount);
        expect(aspect(footprint(p.cells))).toBeLessThanOrEqual(cfg.gridMaxAspect);
      }
    }
  });

  it('is deterministic: same seed ⇒ identical puzzle', () => {
    const cfg = configFor('hard');
    const patterns = bankForTier('hard');
    expect(generatePuzzle(cfg, patterns, 12345)).toEqual(generatePuzzle(cfg, patterns, 12345));
  });
});

describe('isPrefix (per-step validation)', () => {
  it('accepts every growing prefix of a solution, rejects wrong continuations', () => {
    const p = generatePuzzle(configFor('hard'), bankForTier('hard'), 2);
    const notes = p.solutionNotes;
    for (let k = 0; k <= notes.length; k++) {
      expect(isPrefix(notes.slice(0, k), p.pattern)).toBe(true);
    }
    // a wrong second note (not the pattern's 2nd interval from the root) → rejected
    expect(isPrefix([notes[0]!, notes[0]! + 1], p.pattern)).toBe(false);
    // longer than the pattern → rejected
    expect(isPrefix([...notes, notes[0]!], p.pattern)).toBe(false);
  });
});

describe('isSolution (root-agnostic acceptance)', () => {
  it('accepts an alternate-root realization, rejects wrong intervals', () => {
    const p = generatePuzzle(configFor('hard'), bankForTier('hard'), 1);
    const correct = p.solutionNotes;
    // shift every note by +4 fifths → a different root, same interval shape
    expect(isSolution(correct.map((n) => n + 4), p.pattern)).toBe(true);
    // corrupt one interval → reject
    const wrong = [...correct];
    wrong[wrong.length - 1] = wrong[wrong.length - 1]! + 1;
    expect(isSolution(wrong, p.pattern)).toBe(false);
    // wrong length → reject
    expect(isSolution(correct.slice(0, -1), p.pattern)).toBe(false);
  });
});
