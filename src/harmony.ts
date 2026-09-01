// harmony.ts — key-aware selection (docs/09). Parses the musical tokens in
// harmony.config.ts into line-of-fifths integers, builds the packs' patterns, and
// runs the iterative draw: mode → scale degree → pattern → key signature. No dead
// ends: configViolations() (asserted in tests) forbids config with no continuation.

import type { Fifths, Mode } from './theory';
import { intervalName, degreeName, tonicNote } from './theory';
import type { Pattern, Tier } from './pattern';
import type { Rng } from './rng';
import { weightedPick } from './rng';
import {
  TONE_SETS,
  PACKS,
  SCALE_DEGREE_TONE_SETS,
  TIERS,
  type Commonness,
  type TierConfig,
} from './harmony.config';

// ── Token parsers (config token → fifths), inverting theory.ts spellers ──────
const INTERVAL_TO_FIFTHS = new Map<string, Fifths>();
for (let f = -13; f <= 13; f++) INTERVAL_TO_FIFTHS.set(intervalName(f), f);
const DEGREE_TO_FIFTHS = new Map<string, Fifths>();
for (let d = -6; d <= 6; d++) DEGREE_TO_FIFTHS.set(degreeName(d), d);

function interval(token: string): Fifths {
  const f = INTERVAL_TO_FIFTHS.get(token);
  if (f === undefined) throw new Error(`harmony: unknown interval token '${token}'`);
  return f;
}
function degreeToFifths(token: string): Fifths {
  const d = DEGREE_TO_FIFTHS.get(token);
  if (d === undefined) throw new Error(`harmony: unknown scale-degree token '${token}'`);
  return d;
}
/** 'all_natural' → 0, 'N_sharp' → +N, 'N_flat' → −N. */
function keySig(token: string): Fifths {
  if (token === 'all_natural') return 0;
  const m = /^(\d+)_(sharp|flat)$/.exec(token);
  if (!m) throw new Error(`harmony: unknown key-signature token '${token}'`);
  const n = Number(m[1]);
  return m[2] === 'sharp' ? n : -n;
}
function resolveToneSet(ts: string | string[]): Fifths[] {
  const tokens = typeof ts === 'string' ? TONE_SETS[ts] : ts;
  if (!tokens) throw new Error(`harmony: unknown tone-set '${ts as string}'`);
  return tokens.map(interval);
}

// ── Build the packs' patterns from the config (tones → intervals) ────────────
export interface ResolvedPack {
  id: string;
  patterns: Pattern[];
}
export const PACK_LIST: ResolvedPack[] = Object.entries(PACKS).map(([id, specs]) => ({
  id,
  patterns: specs.map((s) => {
    const p: Pattern = { display: s.display, kind: s.kind, intervals: s.tones.map(interval) };
    if (s.qualifier !== undefined) p.qualifier = s.qualifier;
    return p;
  }),
}));
const PACK_PATTERNS = new Map(PACK_LIST.map((p) => [p.id, p.patterns]));
/** Every pattern the game can produce (all packs flattened). */
export const ALL_PATTERNS: Pattern[] = PACK_LIST.flatMap((p) => p.patterns);

// ── Per-(mode, degree) tone-sets, resolved to fifths ─────────────────────────
const RANK: Record<Commonness, number> = { ultra: 3, very: 2, somewhat: 1, occasional: 0 };
const DEGREE_SETS: Record<Mode, Map<Fifths, { set: Fifths[]; floor: Commonness }[]>> = {
  major: new Map(),
  minor: new Map(),
};
for (const mode of ['major', 'minor'] as Mode[]) {
  for (const [token, refs] of Object.entries(SCALE_DEGREE_TONE_SETS[mode])) {
    DEGREE_SETS[mode].set(
      degreeToFifths(token),
      refs.map((r) => ({ set: resolveToneSet(r.toneSet), floor: r.floor })),
    );
  }
}

/** Commonness a pattern reaches on `(mode, degree)`: highest floor whose tone-set
 * fully contains its intervals; null if none does (docs/09 §3.5). */
export function commonness(p: Pattern, mode: Mode, degree: Fifths): Commonness | null {
  const sets = DEGREE_SETS[mode].get(degree);
  if (!sets) return null;
  let best: Commonness | null = null;
  for (const { set, floor } of sets) {
    if (p.intervals.every((iv) => set.includes(iv))) {
      if (best === null || RANK[floor] > RANK[best]) best = floor;
    }
  }
  return best;
}

// ── Resolve each tier's tables once ──────────────────────────────────────────
interface ResolvedTier {
  modes: [Mode, number][];
  sigs: [Fifths, number][];
  degrees: Record<Mode, [Fifths, number][]>;
  commonness: Partial<Record<Commonness, number>>;
  packs: [string, number][];
}
const degList = (d?: Record<string, number>): [Fifths, number][] =>
  d ? (Object.entries(d).map(([t, w]) => [degreeToFifths(t), w]) as [Fifths, number][]).filter(([, w]) => w > 0) : [];

const TIER_R: Record<Tier, ResolvedTier> = (() => {
  const out = {} as Record<Tier, ResolvedTier>;
  for (const [tier, cfg] of Object.entries(TIERS) as [Tier, TierConfig][]) {
    out[tier] = {
      modes: (Object.entries(cfg.modes) as [Mode, number][]).filter(([, w]) => w > 0),
      sigs: Object.entries(cfg.keys)
        .map(([k, w]) => [keySig(k), w] as [Fifths, number])
        .filter(([, w]) => w > 0),
      degrees: { major: degList(cfg.degrees.major), minor: degList(cfg.degrees.minor) },
      commonness: cfg.commonness,
      packs: Object.entries(cfg.packs).filter(([, w]) => w > 0),
    };
  }
  return out;
})();

// ── The draw ─────────────────────────────────────────────────────────────────
interface Candidate {
  pattern: Pattern;
  weight: number;
}
/** Patterns pickable on `(mode, degree)` at `tier`, weighted `PACK_W · COMMON_W /
 * N(pack, commonness)` — the (pack × commonness) cell rule (docs/09 §2). */
function candidates(tier: Tier, mode: Mode, degree: Fifths): Candidate[] {
  const rt = TIER_R[tier];
  const out: Candidate[] = [];
  for (const [packId, packW] of rt.packs) {
    const patterns = PACK_PATTERNS.get(packId);
    if (!patterns) continue;
    const cells = new Map<Commonness, Pattern[]>();
    for (const p of patterns) {
      const c = commonness(p, mode, degree);
      if (c === null || !((rt.commonness[c] ?? 0) > 0)) continue;
      (cells.get(c) ?? cells.set(c, []).get(c)!).push(p);
    }
    for (const [c, ps] of cells) {
      const cellW = (packW * (rt.commonness[c] ?? 0)) / ps.length;
      for (const p of ps) out.push({ pattern: p, weight: cellW });
    }
  }
  return out;
}

export interface HarmonyPick {
  pattern: Pattern;
  rootNote: Fifths;
  mode: Mode;
  degree: Fifths;
  sig: Fifths;
}

/** One functional instance for `tier` (docs/09 §2). Assumes the config invariant
 * (§4, configViolations) holds — every step has ≥1 positive-weight option. */
export function sampleHarmony(tier: Tier, rng: Rng): HarmonyPick {
  const rt = TIER_R[tier];
  const mode = weightedPick(rng, rt.modes, ([, w]) => w)[0];
  const degree = weightedPick(rng, rt.degrees[mode], ([, w]) => w)[0];
  const { pattern } = weightedPick(rng, candidates(tier, mode, degree), (c) => c.weight);
  const sig = weightedPick(rng, rt.sigs, ([, w]) => w)[0];
  return { pattern, rootNote: tonicNote(mode, sig) + degree, mode, degree, sig };
}

// ── Config invariant (docs/09 §4) — asserted in tests, never at runtime ──────
/** Human-readable violations of the no-dead-end invariant, per tier. Empty = ok. */
export function configViolations(): string[] {
  const problems: string[] = [];
  for (const [tier, rt] of Object.entries(TIER_R) as [Tier, ResolvedTier][]) {
    if (rt.sigs.length === 0) problems.push(`${tier}: no key signatures`);
    if (rt.modes.length === 0) problems.push(`${tier}: no modes`);
    for (const [mode] of rt.modes) {
      const degs = rt.degrees[mode];
      if (degs.length === 0) {
        problems.push(`${tier}/${mode}: mode enabled but no degrees`);
        continue;
      }
      for (const [deg] of degs) {
        if (candidates(tier, mode, deg).length === 0) {
          problems.push(`${tier}/${mode}/degree ${deg}: no valid patterns`);
        }
      }
    }
    for (const [packId] of rt.packs) {
      if (!PACK_PATTERNS.has(packId)) problems.push(`${tier}: pack '${packId}' has no members`);
    }
  }
  return problems;
}
