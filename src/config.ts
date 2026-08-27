// config.ts — the tunable parameters (docs/03-full-spec.md §11) in one typed
// object. Starting values; tuned by feel in playtest (Step 6).

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
  /** Outer clamp for any in-play note (E𝄫 … C𝄪). */
  plausibleBounds: [number, number];
  /** Optional per-pattern weights by name; missing → 1 (uniform). */
  patternWeights?: Record<string, number>;
}

export const DEFAULT_CONFIG: Config = {
  gridCellCount: 18,
  startGridW: 8,
  startGridH: 8,
  gridMaxAspect: 1.6,
  rootPool: [-9, 9],
  rootCenterBias: 0, // full-variety preset (designer's call)
  decoyWindowWidth: 15,
  plausibleBounds: [-12, 12],
};
