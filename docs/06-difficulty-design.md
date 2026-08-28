# ToneSearch — Difficulty & Bank Design Doc (Build 1: Easy/Medium/Hard)

> **Status:** Draft · implementation plan for the [increment spec](05-difficulty-and-bank.md)
> (E/M/H only; Expert is a later build). *How* we build it, on the v1
> [Design Doc](04-design.md). References spec as `[05 §n]` / `[03 §n]`.

## 0. Key decisions (flag for veto)

- **All root-position** → no change to the core model, `isSolution`/`isPrefix`,
  "first tap = root", or the 45°/audio machinery. This build is **data + config +
  a name caption + a tier selector**. The off-root lift stays deferred with Expert.
- **A tier is just a Config + a bank subset** — the v1 "everything's a parameter"
  design ([03 §8]) pays off; no generation branching.
- **Bank stays flat data**, each pattern tagged with the **minimum tier** it
  appears in (levels are cumulative) plus a **display name** and a **`reduced`**
  flag. No behavioral fields.

## 1. Data model changes

### `bank.ts` — add fields, rebuild contents to E/M/H
```ts
type Tier = 'easy' | 'medium' | 'hard';        // 'expert' added in Build 2
interface Pattern {
  name: string;        // stable id (existing): 'maj7', 'int-m3', 'dom13'
  display: string;     // human caption: 'Major 7th', 'Minor third', 'Dominant 13th'
  intervals: Fifths[];
  tier: Tier;          // minimum tier; cumulative (easy ⊂ medium ⊂ hard)
  reduced?: boolean;   // true → append the '[reduced]' marker [05 §Names]
}
```
Contents come verbatim from [05 §3](05-difficulty-and-bank.md) — **45 patterns**
(15 dyads + 30 chords): Easy 12, +Medium 13, +Hard 20. Notes:
- The extended chords are the **full ≤5-note** voicings (e.g. `dom9 =
  [R,M3,P5,m7,M2]`), *replacing* today's 4-note reductions (those return in Build 2
  as Expert shells). The `int-*` dyad names are unchanged.
- `reduced: true` on exactly **`dom13`, `maj13`, `min13`, `min11`** (economy drop
  of the 5th for the cap). Everything else in E/M/H is unmarked.
- `bankForTier(tier)` returns patterns with `rank(tier) ≥ rank(pattern.tier)`.

### `config.ts` — per-tier params
Rename `plausibleBounds → noteRange` (semantic: it's the tier's allowed notes, the
outer clamp for solution *and* decoys). Split the tier-varying knobs out of the
shared base:
```ts
interface TierParams { gridCellCount: number; noteRange: [Fifths, Fifths]; }
const TIERS: Record<Tier, TierParams> = {
  easy:   { gridCellCount: 10, noteRange: [-7,  7] },
  medium: { gridCellCount: 14, noteRange: [-8,  8] },
  hard:   { gridCellCount: 18, noteRange: [-10, 10] },
};
const BASE = { startGridW, startGridH, gridMaxAspect, rootCenterBias,
               decoyWindowWidth: 15 };            // shared, tier-independent
function configFor(tier: Tier): Config {          // rootPool := noteRange
  const t = TIERS[tier];
  return { ...BASE, gridCellCount: t.gridCellCount,
           noteRange: t.noteRange, rootPool: t.noteRange };
}
```
- `rootPool = noteRange`: every pattern starts on R (=0 offset), so the root is
  itself a solution note and must lie in `noteRange`; `validRoots` then keeps only
  roots whose *whole* solution fits (unchanged logic, new bound).
- `startGridW/H` must satisfy the accretion invariant for the **largest** tier
  (18) — already 8×8, fine; the smaller tiers just grow a smaller blob.

## 2. Generation changes (`generate.ts`)

Minimal, all mechanical:
- `plausibleBounds` → `noteRange` in `validRoots` and `fillDecoys` (2 refs).
- `generatePuzzle(cfg, patterns, seed)` — take the **tier's bank subset** as an
  arg instead of importing `BANK` (keeps the module pure and tier-agnostic).
  `weightedPick(rng, patterns, …)`.
- **Easy edge case [05 §U6]:** Easy's `noteRange` is exactly 15 wide = `W`, so the
  decoy window fills the whole range with no offset room — `fillDecoys`' `loL..hiL`
  collapses to a single `L` (`randInt(−7,−6)=−7`, valid, no crash). Equality is
  fine — no `noteRange width ≥ decoyWindowWidth` guard needed. The root still
  floats the solution within the fixed full-range window, so the root isn't
  positionally leaked. Flagged for playtest.
- No change to `growBlob` / `findPath` / `isSolution` / `isPrefix`.
- **Test rewrite is real (not a one-liner):** `generate.test.ts` has **four**
  `generatePuzzle` calls, a `validRoots`-over-`BANK` loop, and `DEFAULT_CONFIG`
  uses — all touched by the signature change + `BANK → bankForTier` + the
  `DEFAULT_CONFIG` decision. Budget it as a proper rewrite (per-tier loop, §5).

## 3. Shell changes

### `game.ts` — tier state + regen
- `let tier = loadTier()` (localStorage `tonesearch.difficulty`, default `'easy'`).
- Derive `cfg = configFor(tier)` and `patterns = bankForTier(tier)`; `newPuzzle`
  calls `generatePuzzle(cfg, patterns, seed)`.
- `cycleTier()`: easy→medium→hard→easy; persist; rebuild `cfg`/`patterns`; start a
  fresh puzzle; update the label + name caption. Session counter keeps running
  across tiers (it's "solved this session").
- **Initial label:** `mountShell` currently hard-codes the label text `'Medium'`
  (render.ts:33) and `game.ts` never touches `shell.difficultyEl`. On init, set the
  label from the loaded `tier` (so it doesn't read "Medium" while playing Easy) —
  change that span to a `<button>` (see render.ts below) and set it in one
  `setLabel(tier)` used by both init and `cycleTier`.
- **`DEFAULT_CONFIG` fate:** it's removed/replaced by `configFor(tier)`. Either
  drop it (update the game.ts:99 use and the test import) or keep
  `DEFAULT_CONFIG = configFor('easy')` as a convenience alias. Decide in step 2.

### `render.ts` — name caption + selector
- **Name caption:** a subtle text node by the target diamonds showing
  `pattern.display` (+ ` [reduced]` when `pattern.reduced`). Always visible, low
  emphasis (small, muted color, e.g. `--neon-mute` at reduced opacity) so it's
  easy to ignore — [05 §Names], [03 §7]. Update it in `renderTokens` (it already
  gets the puzzle) or a sibling `setName(pattern)`.
- **Selector:** the top-bar difficulty control is a `<select>` dropdown (options
  Easy/Medium/Hard); `onchange` sets the tier and starts a fresh puzzle. Its
  `.value` reflects the loaded tier on init. *(Chosen over tap-to-cycle.)*

### `style.css`
- `.seq-name` caption (subtle) and `.difficulty` button affordance (looks tappable
  but quiet). No new theme tokens expected.

## 4. Naming data

`display` strings live in `bank.ts` (one per pattern). Dyads read as interval
names ("Minor third" … "Augmented second"); chords use conventional short names
("Half-diminished 7th", "9sus4", "7♯11", "Minor ♭6"). The `[reduced]` marker is
appended at render time from the flag, not baked into `display` (so the text is
tunable in one place).

## 5. Tests

- **bank.test.ts** (rewrite): count **45**, unique `name`s; every pattern has a
  non-empty `display`; every `intervals[0] === R` and no duplicate tones; **length
  ≤ 5**; each pattern's `tier` ∈ {easy,medium,hard}; the four `reduced` flags are
  exactly `{dom13,maj13,min13,min11}`; `bankForTier` is cumulative
  (`easy ⊂ medium ⊂ hard`) with the expected counts (12 / 25 / 45).
- **generate.test.ts** (extend, per tier): for each tier, over many seeds — every
  solution note **and every decoy ∈ that tier's `noteRange`**; grid cell count meets
  the tier minimum; `validRoots(pattern)` non-empty for **every** pattern in the
  tier (hang guard); determinism holds. Keep the existing adjacency/prefix/
  root-agnostic invariants.
- **config.test.ts** (small, new): `configFor` maps each tier to the spec'd
  `gridCellCount`/`noteRange`; `rootPool === noteRange`.

## 6. Build sequence (each step green & committable)

1. **bank.ts** — new fields + full E/M/H contents + `bankForTier`; rewrite
   bank.test. (Pure; green before any wiring.)
2. **config.ts** — `Tier`, `TIERS`, `configFor`, `noteRange` rename; config.test.
3. **generate.ts** — `noteRange` rename + `patterns` arg; extend generate.test per
   tier.
4. **game.ts** — tier state, persistence, `cycleTier`, regen wiring.
5. **render.ts + style.css** — name caption + tappable selector.
6. **Verify** — build + preview; cycle tiers, watch bank/range/grid change, confirm
   the caption + `[reduced]` marker; deploy; playtest (decoy width, Easy range).

## 7. Risks / watch items

- **Easy decoy range = window width** (no offset room) — may feel slightly easy or
  make the root more findable; the first playtest knob (widen Easy `noteRange`, or
  drop `decoyWindowWidth` per tier).
- **Name-vs-challenge tension** — always-visible names could over-help; mitigated
  by making the caption genuinely subtle. Tune emphasis in playtest.
- **Easy grid granularity** — 3×3 accretion yields 9 cells from the first block,
  so `gridCellCount = 10` forces a second block and effectively lands at **~13–15**
  cells (still "≥10", but the lever is coarse). Fine, but know it when tuning Easy.
  The real `findPath` stress is **Hard** (length-5 path in a ~18-cell blob), which
  the reviewer verified is fine — not Easy (Easy is only length 2–3).
- **Audio — 5-note chords:** Hard is the first bank with 5-note extended chords and
  wider spreads than the v1 ≤4-note set. `ascendingMidis`/`playChord` are general
  (pitch-class fold + ascending) and should cope, but **verify the 9/11/13 voicings
  sound right** in step 6 (not in this build's touch list otherwise).
- Signature change `generatePuzzle(cfg, patterns, seed)` touches the one call site
  (game.ts) plus a **real** `generate.test.ts` rewrite (see §2) — mechanical but
  not a one-liner.
