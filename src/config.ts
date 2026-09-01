// config.ts — tunable parameters (docs/03-full-spec.md §11) plus the per-tier grid
// / decoy knobs (docs/06 §1). A tier is just a Config; harmony.ts owns which
// patterns/keys/degrees a tier draws (docs/09).

import type { Tier } from './bank';

export interface Config {
  /** Which difficulty tier this config is — harmony.ts reads it for selection. */
  tier: Tier;
  /** Target grid cell count (met or slightly exceeded by 3×3 accretion). */
  gridCellCount: number;
  /** Bounded start grid for accretion; area must exceed gridCellCount + margin. */
  startGridW: number;
  startGridH: number;
  /** Aspect cap on the rotated on-screen footprint (guard; rarely trips). */
  gridMaxAspect: number;
  /** Decoy window width as a position count (≥ max pattern span + 1). */
  decoyWindowWidth: number;
  /** Per-tier decoy note range on the line of fifths. Decoys stay within it unless
   * the solution itself pokes out — then the window widens only to the solution's
   * own extreme note, never further (docs/09 §6). Solutions are never clamped. */
  decoyRange: [number, number];
}

/** Knobs that vary by difficulty tier. */
interface TierParams {
  gridCellCount: number;
  decoyRange: [number, number];
}

const TIERS: Record<Tier, TierParams> = {
  easy: { gridCellCount: 10, decoyRange: [-7, 7] },
  medium: { gridCellCount: 14, decoyRange: [-8, 8] },
  hard: { gridCellCount: 18, decoyRange: [-10, 10] },
  expert: { gridCellCount: 18, decoyRange: [-12, 12] },
};

/** Shared, tier-independent params. */
const BASE = {
  startGridW: 8,
  startGridH: 8,
  gridMaxAspect: 1.6,
  decoyWindowWidth: 15,
};

/** Build the full Config for a difficulty tier. */
export function configFor(tier: Tier): Config {
  const t = TIERS[tier];
  return { ...BASE, tier, gridCellCount: t.gridCellCount, decoyRange: t.decoyRange };
}

/** Convenience default (the starting tier). */
export const DEFAULT_CONFIG: Config = configFor('easy');
