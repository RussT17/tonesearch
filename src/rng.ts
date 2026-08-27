// rng.ts — one seedable PRNG (mulberry32) that all randomness flows through,
// so puzzles are reproducible and daily-seed puzzles are free later.

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
}

/** Deterministic PRNG seeded by a 32-bit integer. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Random integer in `[lo, hi)`. */
export const randInt = (rng: Rng, lo: number, hi: number): number =>
  lo + Math.floor(rng.next() * (hi - lo));

/** Uniformly pick one element. */
export const pick = <T>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng.next() * arr.length)]!;

/** Pick one element with probability proportional to `weight(item)`. */
export function weightedPick<T>(rng: Rng, items: readonly T[], weight: (t: T) => number): T {
  const total = items.reduce((s, it) => s + weight(it), 0);
  let r = rng.next() * total;
  for (const it of items) {
    r -= weight(it);
    if (r < 0) return it;
  }
  return items[items.length - 1]!;
}
