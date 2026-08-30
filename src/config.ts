// config.ts — tunable parameters (docs/03-full-spec.md §11) plus the per-tier
// difficulty sets (docs/06-difficulty-design.md §1). A tier is just a Config;
// generation reads the same knobs regardless of tier.

import type { Tier } from './bank';

export interface Config {
  /** Target grid cell count (met or slightly exceeded by 3×3 accretion). */
  gridCellCount: number;
  /** Bounded start grid for accretion; area must exceed gridCellCount + margin. */
  startGridW: number;
  startGridH: number;
  /** Aspect cap on the rotated on-screen footprint (guard; rarely trips). */
  gridMaxAspect: number;
  /** Inclusive root range on the line of fifths. */
  rootPool: [number, number];
  /** 0 = uniform; higher concentrates roots near D (common keys). */
  rootCenterBias: number;
  /** Decoy window width as a position count (≥ max pattern span + 1). */
  decoyWindowWidth: number;
  /** Per-tier allowed notes; outer clamp for solution + decoys (E𝄫 … C𝄪 at widest). */
  noteRange: [number, number];
  /** Optional per-pattern weights by name; missing → 1 (uniform). */
  patternWeights?: Record<string, number>;
}

/** Knobs that vary by difficulty tier (docs/05 §3, §8). */
interface TierParams {
  gridCellCount: number;
  noteRange: [number, number];
}

const TIERS: Record<Tier, TierParams> = {
  easy: { gridCellCount: 10, noteRange: [-7, 7] },
  medium: { gridCellCount: 14, noteRange: [-8, 8] },
  hard: { gridCellCount: 18, noteRange: [-10, 10] },
  expert: { gridCellCount: 18, noteRange: [-12, 12] },
};

/** Shared, tier-independent params. */
const BASE = {
  startGridW: 8,
  startGridH: 8,
  gridMaxAspect: 1.6,
  rootCenterBias: 0, // full-variety (designer's call)
  decoyWindowWidth: 15,
};

/** Build the full Config for a difficulty tier. */
export function configFor(tier: Tier): Config {
  const t = TIERS[tier];
  return {
    ...BASE,
    gridCellCount: t.gridCellCount,
    noteRange: t.noteRange,
    rootPool: t.noteRange, // every pattern starts on R, so the root must lie in range
  };
}

/** Convenience default (the starting tier). */
export const DEFAULT_CONFIG: Config = configFor('easy');
