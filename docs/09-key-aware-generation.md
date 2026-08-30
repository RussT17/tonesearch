# ToneSearch — Key-Aware Sequence Generation

> **Status:** 📝 Spec, design locked (2026-08-30) — ready to implement. Redesigns
> how a puzzle's (chord, root) pair is chosen: new representations (key, mode,
> scale degree, all fifths), a four-stage sampling pipeline, per-degree **partition
> functions** that classify the bank into weighted/tiered classes, and per-tier
> gating that replaces the hardcoded note ranges. Weight tables are first
> proposals to tune against `harmony:dump` in playtest. Remaining implementation
> forks in §8.

## §0 — The problem

Today (`src/generate.ts`) a puzzle is built in two independent picks:

1. `weightedPick` a **pattern** (chord/interval/scale) by its `weight`.
2. `weightedPick` a **root** — uniformly (`rootCenterBias = 0`) over every root in
   `rootPool` whose notes land inside the tier's `noteRange`.

Because the root is chosen with no regard for the chord, musically absurd pairings
are as likely as idiomatic ones. A **minor triad on C♭** is picked exactly as often
as one on A or E — even though C♭ minor only occurs as the borrowed `iv` of G♭
major (a rare key, and `iv` a rare-ish function). The chord and its root are
**independent**; real music makes them **strongly dependent**.

**The fix:** stop choosing a root as "a spot on the line of fifths." Instead choose
a **key** and a **scale degree**, let the chord depend on that degree, and let the
key's rarity carry through. The root becomes a *derived* note.

## §1 — Everything is still one integer (fifths)

We add three concepts. Each is just a signed integer on the line of fifths — the
same type as notes and intervals (docs/00), so the engine's `note = root +
interval` arithmetic extends with no new machinery.

| concept | meaning | integer |
|---|---|---|
| **note** | fifths from D (existing) | D=0, A=1, …, C=−2, G=−1, … |
| **interval** | fifths from root (existing) | R=0, P5=+1, M3=+4, m3=−3, … |
| **scale degree** | fifths from the **tonic** | identical scale to intervals |
| **key signature** | fifths of "sharpness" | C/Am=0, each ♯ = +1, each ♭ = −1 |
| **mode** | major / minor | — |

### Scale degree as fifths (owner's table, verified)

Higher integer → lower: `♯4(+6) 7(+5) 3(+4) 6(+3) 2(+2) 5(+1) 1(0) 4(−1) ♭7(−2)
♭3(−3) ♭6(−4) ♭2(−5) ♭5(−6)`. A scale degree is literally "the interval of the
root above the tonic," so degree `d` and interval `d` are the **same number**
(5th = +1, ♭3 = −3, …). Major's diatonic set is `{1,2,3,4,5,6,7} = {0,+2,+4,−1,
+1,+3,+5}`; natural minor's is `{1,2,♭3,4,5,♭6,♭7} = {0,+2,−3,−1,+1,−4,−2}` plus
the harmonic-minor raised 7 `(+5)`.

### Key signature as fifths, and the tonic note

Keys run **+6 → −6** by signature: F♯(+6) … C(0) … G♭(−6). The **tonic note**
(fifths from D) falls out of two anchors — C major's tonic is C = −2, A minor's is
A = +1:

```
majorTonicNote(sig) = sig − 2      // C major: 0−2 = −2 = C ✓ ; G major: +1−2 = −1 = G ✓
minorTonicNote(sig) = sig + 1      // A minor: 0+1 = +1 = A ✓ ; E minor: +1+1 = +2 = E ✓
```

(Relative minor sits 3 fifths sharp of its major: `(sig+1) − (sig−2) = 3` ✓.)

### The root note

```
rootNote      = tonicNote(mode, sig) + scaleDegree
solutionNotes = rootNote + pattern.intervals[i]      // unchanged
```

## §2 — The four-stage pipeline

Replace steps 1–2 of `generatePuzzle` with:

1. **Mode** — pick major / minor by `MODE_WEIGHT` (§3.1), tier-gated.
2. **Scale degree** — pick `d` by `DEGREE_WEIGHT[mode]` (§3.2), tier-gated.
3. **Chord** — pick by `CHORD_ON_DEGREE[mode][d]` (§3.3), a distribution over the
   chord **qualities** viable on that degree; then realize it as a concrete bank
   pattern (a voicing) available at the tier.
4. **Key** — pick signature `sig` by `KEY_WEIGHT` (§3.4), tier-gated.

Then compute `rootNote`, `solutionNotes`, and build the grid + decoys exactly as
today. The probability of any concrete puzzle is

```
P = P(mode) · P(d | mode) · P(quality | mode, d) · P(voicing | quality, tier) · P(sig)
```

**Worked example — the C♭ minor triad.** major mode, key G♭ (`sig = −6`), degree
`4 (−1)`, quality `min` (the borrowed `iv`): `tonic = −6−2 = −8`, `root = −8−1 =
−9 = C♭` ✓. Its probability is `P(major) · P(4) · P(min | major, 4)_borrowed ·
P(sig=−6)` — a moderate × a small × a *tiny* × a *tiny*. It still **can** appear
(spelling stays correct), but now about as often as it does in real life, instead
of as often as C-minor. That is the whole point.

## §3 — The distributions (proposed defaults)

All are plain weighted tables — tune freely; the numbers below are opening bids,
not physics. Relative weights only (normalized at pick time).

### §3.1 Mode

`{ major: 0.6, minor: 0.4 }`. (Easy could be major-only — see §4.)

### §3.2 Scale-degree weights

Proposed, leaning on real chord-root frequency (I/IV/V dominate; borrowed degrees
are rare). Ordering is the tunable part.

| degree | fifths | major wt | minor wt | notes |
|---|---|---|---|---|
| 1 / i | 0 | 10 | 10 | tonic |
| 5 / v | +1 | 8 | 7 | dominant |
| 4 / iv | −1 | 7 | 6 | subdominant |
| 2 / ii | +2 | 5 | 4 | |
| 6 / ♭6 | +3 / −4 | 4 | 5 | vi (maj) / ♭VI (min) |
| 3 / ♭3 | +4 / −3 | 3 | 5 | iii (maj) / ♭III (min) |
| 7 / ♭7 | +5 / −2 | 2 | 4 | vii° (maj) / ♭VII (min) |
| raised 7 | +5 | — | 2 | minor leading-tone (harmonic) |
| borrowed ♭7,♭3,♭6 (maj) | −2,−3,−4 | 1 each | — | mixture |
| chromatic ♯4,♭2,♭5 | +6,−5,−6 | 0.3 | 0.3 | Expert only |

*(Note: major degree 6 = +3, minor degree ♭6 = −4 — different integers, same row
because they play the same structural role in each mode.)*

### §3.3 Chord-on-degree via **per-degree partition functions** (chosen approach)

Rather than hand-write static tables (which rot as the bank grows), the two-level
`class → member` tables are **derived by code** — a "script" of per-degree
functions run over the whole bank. Owner's design:

- **A partition function per (mode, degree)** classifies the *entire bank* into
  **classes**. Each class carries a **weight** and a **minTier** (the difficulty at
  which it switches on). A pattern matching no class on this degree simply can't
  appear there.
- **Classes are defined by predicates** over a pattern's **tones (`intervals`),
  `name`, and `kind`** — via a library of reusable helpers (`isTriad`,
  `isDominant`, `hasIntervals(m7, M3)`, `isTritoneDyad`, `diatonicFit(…)`, …). An
  ordered predicate list gives a true partition (first match wins).
- **Shared constants** tune cross-cutting ratios so weights stay consistent across
  every degree — e.g. `MIX = { dyad, triad, chord, scale }` frequency shares (the
  dyad share replaces today's per-pattern `weight: 0.3`), plus knobs like
  `borrowed`, `secondaryDominant`. Class weights are written *in terms of* these.
- **At generation:** once `(mode, degree)` is fixed, pick a **tier-available
  class** by weight, then a **member pattern within** it (uniform; an optional
  residual per-pattern `weight` can bias toward fuller voicings). Voicing richness
  still scales with difficulty for free (Easy `maj` class = the triad only; Expert
  `maj` class = triad + its inversions/open voicings — because those voicings carry
  higher `tier`).
- **Materialization:** run the functions over the bank once at module load and
  cache the resolved class→member tables; ship a `harmony:dump` script/test that
  prints them (and example realized probabilities) for eyeballing and tuning. No
  hand-maintained table, no stored `quality` field on patterns.

**Intervals are placed by scale degree, not a separate lane.** An interval belongs
on a degree when its notes are **diatonic (or idiomatically chromatic) from that
degree** — e.g. `aug4` on **major 4** (fa→ti, the diatonic tritone: `−1 + 6 = +5`,
the leading tone ✓), `m2` on **minor 5** (5→♭6). A shared
`diatonicFit(pattern, mode, degree)` scorer (how many of the pattern's notes land
in the key's scale) does this generically, so the keyless dyads auto-assign and the
old two-lane split (§5) is gone.

Sketch:

```ts
const MIX = { dyad: 0.3, triad: 1, chord: 1, scale: 0.5, borrowed: 0.25 };
type ChordClass = { id: string; is: (p: Pattern) => boolean; weight: number; minTier: Tier };

// e.g. major degree 5 (V):
const V_major: ChordClass[] = [
  { id: 'dom7',     is: isDominant,               weight: MIX.chord * 7, minTier: 'medium' },
  { id: 'majTriad', is: isMajorTriad,             weight: MIX.triad * 5, minTier: 'easy'   },
  { id: 'tritone',  is: isTritoneDyad,            weight: MIX.dyad  * 2, minTier: 'medium' },
  { id: 'domExt',   is: isAlteredOrExtendedDom,   weight: MIX.chord * 2, minTier: 'hard'   },
];
```

Pentatonic **scales** fold in as a class on the tonic degree (`majPent` on major I,
`minPent` on minor i); their solve / Give-Up run-up behavior is unchanged.

### §3.4 Key-signature weights

Peaked at C/Am, tapering to the 6-accidental extremes:

| sig | 0 | ±1 | ±2 | ±3 | ±4 | ±5 | ±6 |
|---|---|---|---|---|---|---|---|
| weight | 6 | 5 | 4 | 3 | 2 | 1 | 0.5 |

Mode-independent (a signature is equally "common" read as major or its relative
minor).

## §4 — Difficulty gates modes, degrees, keys — and note range goes away

Difficulty stops clamping `noteRange` and instead **restricts the three new
distributions** (chords stay gated by the existing `pattern.tier`). The realized
note spread then *emerges* from which keys/degrees/chords are on the menu.

| tier | modes | key sigs | degrees | chords (via tier) |
|---|---|---|---|---|
| Easy | major | 0, ±1 | I, IV, V (+ ii, vi) | triads, intervals |
| Medium | major, minor | 0…±3 | all diatonic | + 7ths, 6ths, pentatonics |
| Hard | major, minor | 0…±4 | diatonic + common borrowed | + extended |
| Expert | major, minor | 0…±6 | + chromatic (♯4, ♭2, ♭5) | all voicings |

**Removing `noteRange` / `rootPool` / `validRoots`:** the root is now *computed*
(§1), never searched, so `validRoots`, `rootPool`, and the per-tier `noteRange`
clamp all disappear. Only the **decoy filler** still needs an outer bound (so a
15-wide decoy window near an extreme solution doesn't spill into absurd
triple-accidental spellings). Proposal: **derive** `noteBounds` per tier as the
min/max note reachable across that tier's enabled `(mode, sig, degree, quality)`
combinations, computed once at `configFor(tier)`. This replaces the hand-tuned
`noteRange` with one that provably contains every solution the tier can produce,
and adjusts automatically as the gates change.

## §5 — Bare intervals live on scale degrees too (no separate lane)

Earlier drafts gave bare **intervals** (`int-m3`, the Expert guide-tone/3–6 pairs)
their own keyless lane. **Dropped** — per §3.3 the partition functions place
intervals on the degrees where they're idiomatic, using `diatonicFit`:

- `aug4` on **major 4** (the fa–ti tritone), `m2` on **minor 5** (5–♭6),
  `M2`/`M3`/`P5` broadly on the tonic, etc.
- The same interval can sit on several degrees (a `M3` is diatonic from many),
  each an entry in that degree's dyad class — so a bare interval still gets a
  musically-plausible root and spelling, for free.

The dyad's overall rarity is now the `MIX.dyad` share (§3.3), and its Easy-heavy
character comes from the Easy tier enabling few chord classes but the full dyad
classes — preserving today's "intervals dominate Easy" feel without a lane knob.

## §6 — Code impact

- **`theory.ts`** — add `tonicNote(mode, sig)` (and a `Mode` type), plus a
  `diatonicNotes(mode, sig)` / `diatonicFit` helper. Optional `degreeName` for
  captions. **No `quality` field on patterns** — classification is by predicate.
- **New `harmony.ts`** — the reusable predicate library (`isDominant`, `isTriad`,
  `hasIntervals`, `isTritoneDyad`, `diatonicFit`, …), the shared `MIX` constants,
  the `MODE_WEIGHT` / `DEGREE_WEIGHT` / `KEY_WEIGHT` tables, and the per-degree
  **partition functions** `classesFor(mode, degree)`. A builder resolves these
  against the bank once (cached) into class→member tables; `sampleHarmony(cfg,
  rng)` → `{ pattern, rootNote }` does mode→degree→class→member→key.
- **`generate.ts`** — replace the pattern + `validRoots` + root block with
  `sampleHarmony`. Drop `validRoots`. `fillDecoys` takes derived `noteBounds`
  instead of `noteRange`. `generatePuzzle` becomes `(cfg, seed)` — no bank subset
  passed in (harmony.ts owns selection).
- **`config.ts`** — drop `noteRange`, `rootPool`, `rootCenterBias`; add the
  per-tier enabled sets (modes / key sigs / degrees) — or reference them from
  harmony.ts; keep `gridCellCount`, grid/aspect knobs, `decoyWindowWidth`; add
  derived `noteBounds`.
- **Dev tooling** — a `harmony:dump` script/test that prints, per (mode, degree),
  the resolved classes + members + realized probabilities at each tier, so the
  distributions are inspectable and tunable without playing.
- **Tests** — tonic-note formulas across all 13 sigs × 2 modes; every enabled
  `(mode, degree)` yields ≥1 tier-available class with ≥1 member; the partition is
  exhaustive/non-overlapping; sampled roots always spell within derived
  `noteBounds`; the C♭-minor case is rare, not impossible. Existing
  generation-invariant tests adapt to the new signature.

## §7 — What this buys

- Idiomatic chord/root pairings; rare keys and functions stay rare *by
  construction*, common ones common.
- One clean difficulty story: tiers open up **keys, degrees, and voicings**, and
  the note range follows — no more hand-tuned `noteRange` per tier.
- The bank stays the single source of chord *content*; harmony.ts owns *when* each
  chord appears. Adding a voicing needs only a `quality` tag, not edits to every
  degree table.

## §8 — Decisions

**Locked (2026-08-30):** partition-function / script model for chord-on-degree
(§3.3); intervals placed on degrees by `diatonicFit`, no keyless lane (§5);
frequency-leaning scale-degree weights (§3.2); no subagent — author the class
functions inline.

**Still open, for implementation:**

1. **Materialization (§3.3):** run the partition functions at module load and
   cache (my rec — always in sync, plus a `harmony:dump` for inspection), or a
   build-time codegen step that emits a committed, reviewable table file?
2. **Chord difficulty gate:** let the **class `minTier`** be the sole authority for
   when a chord appears (retire pattern `tier`), or keep pattern `tier` as an
   intrinsic floor that class `minTier` refines?
3. **Within-class pick:** uniform among members (my rec), or keep a residual
   per-pattern `weight` to bias toward fuller/root-position voicings?
4. **Note bound (§4):** derive `noteBounds` per tier from the enabled gates (my
   rec), or one generous global clamp constant?
5. **Easy = major-only** (simplest first key experience), or major+minor from the
   start with only `sig ∈ {0, ±1}`?
6. **`MIX` constants + class weights** — placeholder values here; tune against the
   `harmony:dump` output during implementation.
```
