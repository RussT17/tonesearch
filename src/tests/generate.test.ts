import { describe, it, expect } from 'vitest';
import { generatePuzzle, isSolution, isPrefix, type Puzzle } from '../generate';
import { configFor } from '../config';
import { type Tier } from '../bank';
import { footprint, aspect } from '../geometry';

const TIERS: Tier[] = ['easy', 'medium', 'hard', 'expert'];
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

describe('generatePuzzle invariants (every tier, many seeds)', () => {
  it('holds all structural invariants', () => {
    for (const tier of TIERS) {
      const cfg = configFor(tier);
      const [b0, b1] = cfg.decoyRange;
      for (const seed of SEEDS) {
        const p = generatePuzzle(cfg, seed);
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

        // path notes equal root + intervals, and it solves root-agnostically
        expect(pathCells.map((c) => c.note)).toEqual(p.solutionNotes);
        expect(p.solutionNotes).toEqual(p.pattern.intervals.map((iv) => p.root + iv));
        expect(isSolution(pathCells.map((c) => c.note), p.pattern)).toBe(true);

        // decoys stay within the tier's decoy range, widened only to the solution's
        // own extreme (docs/09 §6). Solution notes themselves are never clamped.
        const solMin = Math.min(...p.solutionNotes);
        const solMax = Math.max(...p.solutionNotes);
        const effLo = Math.min(b0, solMin);
        const effHi = Math.max(b1, solMax);
        const pathSet = new Set(p.solutionPath);
        for (const c of p.cells) {
          if (pathSet.has(c.id)) continue;
          expect(c.note).toBeGreaterThanOrEqual(effLo);
          expect(c.note).toBeLessThanOrEqual(effHi);
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
    expect(generatePuzzle(cfg, 12345)).toEqual(generatePuzzle(cfg, 12345));
  });
});

describe('isPrefix (per-step validation)', () => {
  it('accepts every growing prefix of a solution, rejects wrong continuations', () => {
    const p = generatePuzzle(configFor('hard'), 2);
    const notes = p.solutionNotes;
    for (let k = 0; k <= notes.length; k++) {
      expect(isPrefix(notes.slice(0, k), p.pattern)).toBe(true);
    }
    expect(isPrefix([notes[0]!, notes[0]! + 1], p.pattern)).toBe(false);
    expect(isPrefix([...notes, notes[0]!], p.pattern)).toBe(false);
  });
});

describe('isSolution (root-agnostic acceptance)', () => {
  it('accepts an alternate-root realization, rejects wrong intervals', () => {
    const p = generatePuzzle(configFor('hard'), 1);
    const correct = p.solutionNotes;
    expect(isSolution(correct.map((n) => n + 4), p.pattern)).toBe(true);
    const wrong = [...correct];
    wrong[wrong.length - 1] = wrong[wrong.length - 1]! + 1;
    expect(isSolution(wrong, p.pattern)).toBe(false);
    expect(isSolution(correct.slice(0, -1), p.pattern)).toBe(false);
  });
});
