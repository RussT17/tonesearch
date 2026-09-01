// harmony.ts — key-aware sequence selection (docs/09-key-aware-generation.md).
// Chooses a functional instance by an iterative weighted draw — mode → scale
// degree → pattern → key signature — so chord/root pairings are as (un)common as
// in real music. The pattern step is derived from packs, a commonness ladder, and
// per-(mode,degree) tone-sets (§2/§3). No dead ends: a tested config invariant
// (§4) forbids putting weight where there is no valid continuation.
//
// ⚠️ EVERY weight table and tone-set membership below is an ILLUSTRATIVE
// PLACEHOLDER (docs/09 ⚠️ note): present only to run the mechanism and satisfy the
// invariant — NOT a claim about how often anything should occur. Real values come
// from a later, dedicated tuning pass (candidate for a fresh-context subagent).
// Marked // TODO(tuning) throughout.

import type { Fifths, Mode } from './theory';
import { tonicNote } from './theory';
import type { Pattern, Tier } from './bank';
import { BANK } from './bank';
import type { Rng } from './rng';
import { weightedPick } from './rng';

export type Commonness = 'ultra' | 'very' | 'somewhat' | 'occasional';
const COMMONNESS_RANK: Record<Commonness, number> = { ultra: 3, very: 2, somewhat: 1, occasional: 0 };

const MODES: Mode[] = ['major', 'minor'];

// Interval tokens (fifths from root) — see docs/00.
const R = 0;
const m2 = -5, M2 = 2, aug2 = 9;
const m3 = -3, M3 = 4;
const P4 = -1, aug4 = 6;
const dim5 = -6, P5 = 1, aug5 = 8;
const m6 = -4, M6 = 3;
const dim7 = -9, m7 = -2, M7 = 5;

// ── Tone-sets: the local scale(s) on a degree, as intervals from the chord root.
// All hand-authored (docs/09 §3.5) — for diatonic degrees the ultra set simply IS
// the local mode. // TODO(tuning): these memberships/floors are placeholders.
const IONIAN = [R, M2, M3, P4, P5, M6, M7];
const DORIAN = [R, M2, m3, P4, P5, M6, m7];
const PHRYGIAN = [R, m2, m3, P4, P5, m6, m7];
const LYDIAN = [R, M2, M3, aug4, P5, M6, M7];
const MIXOLYDIAN = [R, M2, M3, P4, P5, M6, m7];
const AEOLIAN = [R, M2, m3, P4, P5, m6, m7];
const LOCRIAN = [R, m2, m3, P4, dim5, m6, m7];
const HARM_MINOR = [R, M2, m3, P4, P5, m6, M7];
const PHRYG_DOM = [R, m2, M3, P4, P5, m6, m7]; // 5th mode of harmonic minor (V in minor)
const LYD_DOM = [R, M2, M3, aug4, P5, M6, m7]; // dominant ♯11
const ALTERED = [R, m2, aug2, M3, dim5, aug5, m7]; // altered dominant colors
const DIMINISHED = [R, M2, m3, P4, dim5, m6, dim7]; // fully-diminished (vii°7)

interface ToneSet {
  set: Fifths[];
  floor: Commonness;
}
// keyed by scale-degree (fifths from tonic). // TODO(tuning)
const TONE_SETS: Record<Mode, Map<Fifths, ToneSet[]>> = {
  major: new Map<Fifths, ToneSet[]>([
    [0, [{ set: IONIAN, floor: 'ultra' }, { set: [...IONIAN, m7], floor: 'very' }]], // I
    [1, [{ set: MIXOLYDIAN, floor: 'ultra' }, { set: LYD_DOM, floor: 'somewhat' }, { set: ALTERED, floor: 'occasional' }]], // V
    [-1, [{ set: LYDIAN, floor: 'ultra' }, { set: [...LYDIAN, m7], floor: 'very' }, { set: DORIAN, floor: 'somewhat' }]], // IV
    [2, [{ set: DORIAN, floor: 'ultra' }, { set: LYD_DOM, floor: 'somewhat' }]], // ii (+ V/V)
    [3, [{ set: AEOLIAN, floor: 'ultra' }, { set: MIXOLYDIAN, floor: 'somewhat' }]], // vi (+ V/ii)
    [4, [{ set: PHRYGIAN, floor: 'ultra' }]], // iii
    [5, [{ set: LOCRIAN, floor: 'ultra' }, { set: DIMINISHED, floor: 'ultra' }]], // vii°
    [-2, [{ set: MIXOLYDIAN, floor: 'somewhat' }]], // ♭VII (borrowed)
    [-3, [{ set: IONIAN, floor: 'somewhat' }]], // ♭III (borrowed)
    [-4, [{ set: LYDIAN, floor: 'somewhat' }]], // ♭VI (borrowed)
  ]),
  minor: new Map<Fifths, ToneSet[]>([
    [0, [{ set: AEOLIAN, floor: 'ultra' }, { set: HARM_MINOR, floor: 'ultra' }, { set: IONIAN, floor: 'somewhat' }]], // i (+ picardy)
    [1, [{ set: PHRYGIAN, floor: 'ultra' }, { set: PHRYG_DOM, floor: 'ultra' }, { set: ALTERED, floor: 'occasional' }]], // v / V
    [-1, [{ set: DORIAN, floor: 'ultra' }, { set: AEOLIAN, floor: 'very' }]], // iv
    [2, [{ set: LOCRIAN, floor: 'ultra' }, { set: DORIAN, floor: 'somewhat' }]], // ii°
    [-3, [{ set: IONIAN, floor: 'ultra' }, { set: LYDIAN, floor: 'somewhat' }]], // ♭III
    [-4, [{ set: LYDIAN, floor: 'ultra' }]], // ♭VI
    [-2, [{ set: MIXOLYDIAN, floor: 'ultra' }]], // ♭VII
    [5, [{ set: LOCRIAN, floor: 'ultra' }, { set: DIMINISHED, floor: 'ultra' }]], // vii° (harmonic leading tone)
  ]),
};

/** The commonness a pattern reaches on `(mode, degree)`: the highest floor whose
 * tone-set fully contains the pattern's intervals; null if none does (§3.5). */
export function commonness(p: Pattern, mode: Mode, degree: Fifths): Commonness | null {
  const sets = TONE_SETS[mode].get(degree);
  if (!sets) return null;
  let best: Commonness | null = null;
  for (const { set, floor } of sets) {
    if (p.intervals.every((iv) => set.includes(iv))) {
      if (best === null || COMMONNESS_RANK[floor] > COMMONNESS_RANK[best]) best = floor;
    }
  }
  return best;
}

// ── Packs: a partition of the bank into curated groups (docs/09 §3.1). A pack is
// its own object, not a field on patterns; `kind` is untouched. // TODO(tuning):
// membership grouping (and the weights below) are a first cut.
export interface Pack {
  id: string;
  members: Pattern[];
}

/** Which pack a pattern belongs to (partition — exactly one each). */
function packIdOf(p: Pattern): string {
  const n = p.name;
  if (n.startsWith('int-')) {
    if (n === 'int-aug4' || n === 'int-dim5') return 'intervals-tritone';
    if (n === 'int-aug5' || n === 'int-aug2' || n === 'int-dim7') return 'intervals-augdim';
    return 'intervals-simple';
  }
  if (n.startsWith('gt-')) return 'guide-tone-dyads';
  if (n.startsWith('d36-')) return 'sixth-dyads';
  if (/-(inv1|inv2)$/.test(n)) return 'triads-inverted';
  if (/-(3r5|r53|53r)$/.test(n)) return 'triads-open';
  if (/-(37|73|36|63)$/.test(n)) return 'rooted-shells';
  if (n.endsWith('-shell')) return 'extended-shells';
  if (/-(rlA|rlB)$/.test(n)) return 'rootless';
  if (['maj', 'min', 'dim', 'aug'].includes(n)) return 'triads';
  if (['sus2', 'sus4'].includes(n)) return 'sus';
  if (['maj7', 'dom7', 'min7', 'm7♭5', 'dim7'].includes(n)) return 'sevenths';
  if (['maj6', 'min6', 'min♭6'].includes(n)) return 'sixths';
  if (['maj-pent', 'min-pent'].includes(n)) return 'pentatonics';
  if (['maj9', 'dom9', 'min9', 'min11', 'maj13', 'dom13', 'min13', '9sus4', 'add9', 'madd9', '6/9', 'm6/9'].includes(n))
    return 'extended';
  if (['7♭9', '7♯9', '7♯11', '7♭13', '7♯5', '7♭5', '7♯9♭13', '7♭9♭13', '7♭9♯11', '7♯9♯11'].includes(n))
    return 'altered-dominants';
  if (['quartal', 'quintal', 'maj7♯5', 'min-maj7', '7sus4', '13sus4'].includes(n)) return 'colors';
  throw new Error(`harmony: pattern '${n}' is not assigned to a pack`);
}

export const PACKS: Pack[] = (() => {
  const byId = new Map<string, Pattern[]>();
  for (const p of BANK) {
    const id = packIdOf(p);
    (byId.get(id) ?? byId.set(id, []).get(id)!).push(p);
  }
  return [...byId].map(([id, members]) => ({ id, members }));
})();
const PACK_BY_ID = new Map(PACKS.map((pk) => [pk.id, pk]));

// ── Weight tables (all // TODO(tuning) placeholders) ────────────────────────
const MODE_W: Record<Tier, Record<Mode, number>> = {
  easy: { major: 1, minor: 0 },
  medium: { major: 0.6, minor: 0.4 },
  hard: { major: 0.6, minor: 0.4 },
  expert: { major: 0.6, minor: 0.4 },
};

const DEGREE_BASE: Record<Mode, Map<Fifths, number>> = {
  major: new Map([[0, 10], [1, 8], [-1, 7], [2, 5], [3, 4], [4, 3], [5, 2], [-2, 1], [-3, 1], [-4, 1]]),
  minor: new Map([[0, 10], [1, 7], [-1, 6], [2, 4], [-3, 5], [-4, 5], [-2, 4], [5, 2]]),
};
const DEGREES_ENABLED: Record<Tier, Record<Mode, Fifths[]>> = {
  easy: { major: [0, -1, 1, 2, 3], minor: [] },
  medium: { major: [0, 1, -1, 2, 3, 4, 5], minor: [0, 1, -1, 2, -3, -4, -2, 5] },
  hard: { major: [0, 1, -1, 2, 3, 4, 5, -2, -3, -4], minor: [0, 1, -1, 2, -3, -4, -2, 5] },
  expert: { major: [0, 1, -1, 2, 3, 4, 5, -2, -3, -4], minor: [0, 1, -1, 2, -3, -4, -2, 5] },
};

const PACKS_ENABLED: Record<Tier, string[]> = (() => {
  const easy = ['intervals-simple', 'triads'];
  const medium = [...easy, 'intervals-tritone', 'sus', 'sevenths', 'sixths', 'pentatonics'];
  const hard = [...medium, 'intervals-augdim', 'extended', 'altered-dominants'];
  const expert = [
    ...hard, 'triads-inverted', 'triads-open', 'rooted-shells', 'extended-shells',
    'guide-tone-dyads', 'sixth-dyads', 'colors', 'rootless',
  ];
  return { easy, medium, hard, expert };
})();
const PACK_WEIGHT: Record<string, number> = {
  'intervals-simple': 3, 'intervals-tritone': 1.5, 'intervals-augdim': 1,
  triads: 10, sus: 3, sevenths: 8, sixths: 5, pentatonics: 2,
  extended: 5, 'altered-dominants': 3,
  'triads-inverted': 3, 'triads-open': 2, 'rooted-shells': 3, 'extended-shells': 3,
  'guide-tone-dyads': 1.5, 'sixth-dyads': 1.5, colors: 2, rootless: 2,
};

const COMMON_W: Record<Tier, Partial<Record<Commonness, number>>> = {
  easy: { ultra: 1 },
  medium: { ultra: 1, very: 0.5 },
  hard: { ultra: 1, very: 0.7, somewhat: 0.4 },
  expert: { ultra: 1, very: 0.8, somewhat: 0.6, occasional: 0.3 },
};

const SIG_BASE = new Map<Fifths, number>([
  [0, 6], [1, 5], [-1, 5], [2, 4], [-2, 4], [3, 3], [-3, 3], [4, 2], [-4, 2], [5, 1], [-5, 1], [6, 0.5], [-6, 0.5],
]);
const SIG_MAX: Record<Tier, number> = { easy: 1, medium: 3, hard: 4, expert: 6 };

// ── Selection ───────────────────────────────────────────────────────────────
const enabledModes = (tier: Tier): Mode[] => MODES.filter((m) => MODE_W[tier][m] > 0);
const enabledDegrees = (tier: Tier, mode: Mode): Fifths[] =>
  DEGREES_ENABLED[tier][mode].filter((d) => (DEGREE_BASE[mode].get(d) ?? 0) > 0);
const enabledSigs = (tier: Tier): Fifths[] =>
  [...SIG_BASE.keys()].filter((s) => Math.abs(s) <= SIG_MAX[tier]);

interface Candidate {
  pattern: Pattern;
  weight: number;
}
/** Patterns pickable on `(mode, degree)` at `tier`, with their step-3 weights
 * (`PACK_W · COMMON_W / N(pack, commonness)`), the (pack × commonness) cell rule. */
function candidates(tier: Tier, mode: Mode, degree: Fifths): Candidate[] {
  const active = new Set(PACKS_ENABLED[tier]);
  const allowed = COMMON_W[tier];
  const out: Candidate[] = [];
  for (const pack of PACKS) {
    if (!active.has(pack.id)) continue;
    const cells = new Map<Commonness, Pattern[]>();
    for (const p of pack.members) {
      const c = commonness(p, mode, degree);
      if (c === null || !((allowed[c] ?? 0) > 0)) continue;
      (cells.get(c) ?? cells.set(c, []).get(c)!).push(p);
    }
    for (const [c, ps] of cells) {
      const cellW = (PACK_WEIGHT[pack.id] * (allowed[c] ?? 0)) / ps.length;
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
 * (§4) holds — every step has ≥1 positive-weight option — verified by tests. */
export function sampleHarmony(tier: Tier, rng: Rng): HarmonyPick {
  const mode = weightedPick(rng, enabledModes(tier), (m) => MODE_W[tier][m]);
  const degree = weightedPick(rng, enabledDegrees(tier, mode), (d) => DEGREE_BASE[mode].get(d) ?? 0);
  const cands = candidates(tier, mode, degree);
  const { pattern } = weightedPick(rng, cands, (c) => c.weight);
  const sig = weightedPick(rng, enabledSigs(tier), (s) => SIG_BASE.get(s) ?? 0);
  return { pattern, rootNote: tonicNote(mode, sig) + degree, mode, degree, sig };
}

// ── Config invariant (docs/09 §4) — asserted in tests, never at runtime ──────
/** Returns human-readable violations of the no-dead-end invariant, per tier. */
export function configViolations(): string[] {
  const tiers: Tier[] = ['easy', 'medium', 'hard', 'expert'];
  const problems: string[] = [];
  for (const tier of tiers) {
    if (enabledSigs(tier).length === 0) problems.push(`${tier}: no key signatures`);
    const modes = enabledModes(tier);
    if (modes.length === 0) problems.push(`${tier}: no modes`);
    for (const mode of modes) {
      const degs = enabledDegrees(tier, mode);
      if (degs.length === 0) {
        problems.push(`${tier}/${mode}: mode enabled but no degrees`);
        continue;
      }
      for (const d of degs) {
        if (candidates(tier, mode, d).length === 0) {
          problems.push(`${tier}/${mode}/degree ${d}: no valid patterns`);
        }
      }
    }
    // every active pack must resolve to real patterns
    for (const id of PACKS_ENABLED[tier]) {
      if (!PACK_BY_ID.has(id)) problems.push(`${tier}: pack '${id}' has no members`);
    }
  }
  return problems;
}
