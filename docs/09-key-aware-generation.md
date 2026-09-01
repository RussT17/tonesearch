# ToneSearch — Key-Aware Sequence Generation

> **Status:** 📝 Spec, redesigned 2026-09-01 (supersedes an earlier
> partition-function draft, then a granular-`type` draft). Redesigns how a puzzle's
> (pattern, root) pair is chosen so pairings are as (un)common as in real music.
> New representations (key, mode, scale degree — all fifths) drive an **iterative
> weighted draw** — mode → degree → pattern → key — where mode/degree use hand-coded
> per-tier tables and the pattern step is *derived* from per-tier pack & commonness
> weights plus per-degree tone-sets. **Dead ends are ruled out by a tested config
> invariant**, so it runs live (or precomputes to the identical distribution).
> Selection granularity lives in **packs** (a new object), leaving `kind` untouched.
> Open forks in §9.

> ⚠️ **Every number, ordering, and tone-set membership in this doc is illustrative —
> present only to show the *shape* of a table or the *structure* of the mechanism,
> never a proposal about how often anything should actually occur.** Do not read
> "V = 8, IV = 7" (etc.) as a recommendation; treat all such values as `TODO`. The
> real distributions and per-degree commonness assignments will be set in a
> dedicated, careful pass (leaning on music-theory analysis and research, inspected
> via `harmony:dump`), *after* the mechanism is built — not seeded from the
> placeholders here. Nothing about the structure depends on the specific numbers.

## §0 — The problem

Today (`src/generate.ts`) a puzzle is two independent picks: a **pattern** by its
`weight`, then a **root** uniformly over every root whose notes fit the tier's
`noteRange`. The root ignores the chord, so absurd pairings are as likely as
idiomatic ones. A **minor triad on C♭** is picked as often as one on A — though C♭
minor occurs essentially only as the borrowed `iv` of G♭ major (a rare key, `iv` a
rare-ish function). Chord and root are **independent**; real music makes them
**strongly dependent**.

**The fix:** choose a **key** and a **scale degree**, let the pattern depend on how
*idiomatic* it is there, and let the key's rarity carry through. The root becomes a
*derived* note.

## §1 — Everything is still one integer (fifths)

Three added concepts, each a signed integer on the line of fifths — the same type
as notes and intervals (docs/00), so `note = root + interval` extends unchanged.

| concept | meaning | integer |
|---|---|---|
| **note** | fifths from D (existing) | D=0, A=1, C=−2, G=−1, … |
| **interval** | fifths from root (existing) | R=0, P5=+1, M3=+4, m3=−3, … |
| **scale degree** | fifths from the **tonic** | same scale as intervals |
| **key signature** | fifths of "sharpness" | C/Am=0, each ♯=+1, each ♭=−1 |
| **mode** | major / minor | offset from the sig's Dorian center |

### Scale degree as fifths (verified)

Higher → lower: `♯4(+6) 7(+5) 3(+4) 6(+3) 2(+2) 5(+1) 1(0) 4(−1) ♭7(−2) ♭3(−3)
♭6(−4) ♭2(−5) ♭5(−6)`. Degree `d` and interval `d` are the same number.

### Key signature and the tonic note (verified)

Keys run **+6 → −6**: F♯(+6) … C(0) … G♭(−6). The signature integer *is* the key's
**Dorian center** on the line of fifths (C major's 7 notes span fifths −3…+3,
centered on **D** = 0). Each mode's tonic is a fixed offset from that center:
**major (Ionian) = −2**, **minor (Aeolian) = +1** (owner's derivation checks out).

```
tonicNote(mode, sig) = sig + modeOffset          // major −2, minor +1
  majorTonic(0)  = −2 = C ✓     minorTonic(0)  = +1 = A ✓
  majorTonic(+1) = −1 = G ✓     minorTonic(+1) = +2 = E ✓   (relative minor sits +3 ✓)
```

### The root note — the whole chain is one sum

```
rootNote     = tonicNote(mode, sig) + scaleDegree
solutionNote = rootNote + pattern.intervals[i] = sig + modeOffset + degree + interval[i]
```

## §2 — The pipeline: an iterative draw (dead-end-free by construction)

Generation is a short sequence of weighted picks. Steps 1–2 are hand-coded and each
renormalized over their own options, so `MODE_W` and `DEGREE_W` are respected
**exactly**. Step 3 is *derived* from the pack / commonness / tone-set configs. Step
4 is independent of 1–3.

1. **Mode** — pick major/minor by `MODE_W[tier]` (§3.2).
2. **Degree** — pick `d` by `DEGREE_W[tier][mode]` (§3.3).
3. **Pattern** — pick by the derived weight below, over patterns valid on `(mode, d)`
   at this tier.
4. **Key signature** — pick `sig` by `SIG_W[tier]` (§3.6).

Then `rootNote = tonicNote(mode, sig) + d`, `solutionNotes = rootNote + intervals`;
build the grid + decoys as today.

**Step 3 — the pattern weight.** For each pattern `p` valid on `(mode, d)` at the
tier (in an active pack, at a tier-allowed commonness), for each active pack it's
in:

```
w(p, pack) = PACK_W[tier][pack] · COMMON_W[tier][ c ] / N(pack, c, mode, d)
  c      = commonness(p, mode, d)                         // §3.5, highest matching tone-set floor
  N(…)   = # patterns in `pack` at commonness c on (mode, d)   // uniform within the (pack × commonness) cell
P(p | mode, d) = Σ_pack w(p, pack) / Σ_all
```

Read it as a grid of **(pack × commonness) cells**: each nonempty cell targets mass
`PACK_W · COMMON_W`, split uniformly among its patterns (`/N`), renormalized over
the cells that exist here. (A pattern in several active packs sums its per-pack
weights.) So `MODE_W`/`DEGREE_W` are exact marginals, while `PACK_W` and `COMMON_W`
combine as a product over the cells that actually exist for this `(mode, d)` —
neither is an isolated marginal (a pack surfaces in proportion to which commonness
levels it populates here; the intended coupling).

```
P(puzzle) = P(mode) · P(d | mode) · P(p | mode, d) · P(sig)
```

**All `*_W` are raw relative weights**, renormalized where used, so hand-coded
tables need not sum to 1. **Live or precomputed is the same distribution** — being
dead-end-free (§4), the draw can run live (a few weighted picks); or tabulate the
product of the per-step conditionals for `harmony:dump`.

**Worked example — C♭ minor triad.** major, key G♭ (`sig=−6`), degree `4 (−1)`, a
minor triad (borrowed `iv`): `tonic=−6−2=−8`, `root=−8−1=−9=C♭` ✓. On major-4 a
minor triad only reaches the `somewhat` floor (§3.5), so it's **absent below Hard**
(where `COMMON_W[somewhat]=0`); at Hard/Expert its cell mass is `PACK_W[triads]·
COMMON_W[somewhat]/N`, tiny after renormalizing, and `× P(sig=−6)` tinier still ⇒
**rare, correctly spelled** — about as often as in real life. That is the point.

## §3 — The factors (structure only — every value below is an illustrative `TODO`)

### §3.1 Packs — the selection-granularity object

A **pack** is a first-class object grouping bank patterns; it is **not** a field on
patterns, and patterns may belong to several. It's the single lever for
probability *and* difficulty gating, at whatever granularity we want — split a pack
when finer control is needed. `kind` (interval/triad/chord/scale) is **untouched**
and keeps doing display + playback only.

```ts
interface Pack { id: string; members: string[] }        // members = pattern names
const PACK_W: Record<Tier, Record<string /*packId*/, number>>;  // 0 / absent = off at that tier
```

- **Selection (§2):** a pattern's weight is `PACK_W · COMMON_W / N(pack, commonness)`
  — within a pack the mass splits across its commonness cells, then uniformly among
  the patterns in a cell. Per-member weights inside a cell are deferred — for finer
  bias, split into more packs.
- **Overlap is allowed;** per-tier `PACK_W` decides which packs are live (a pattern
  in two live packs sums its weights). The clean way to grow scope by tier is
  **disjoint packs activated cumulatively** (below).

First-cut packs over the 118-pattern bank (redline freely):

| pack | members (by name) | live from tier |
|---|---|---|
| `intervals-simple` | int-{m2,M2,m3,M3,P4,P5,m6,M6,m7,M7} | easy |
| `intervals-tritone` | int-aug4, int-dim5 | medium |
| `intervals-augdim` | int-aug5, int-aug2, int-dim7 | hard |
| `triads` | maj, min, dim, aug | easy |
| `triads-inverted` | *-inv1, *-inv2 | expert |
| `triads-open` | *-3r5, *-r53, *-53r | expert |
| `sus` | sus2, sus4 | medium |
| `sevenths` | maj7, dom7, min7, m7♭5, dim7 | medium |
| `sevenths-shell` | *-37, *-73 | expert |
| `guide-tone-dyads` | gt-* | expert |
| `sixths` | maj6, min6, min♭6 | medium |
| `sixth-dyads` | d36-* | expert |
| `extended` | maj9, dom9, min9, min11, maj13, dom13, min13, 9sus4, add9, madd9, 6/9, m6/9 | hard |
| `extended-shells` | *-shell (ext'd) | expert |
| `altered-dominants` | 7♭9, 7♯9, 7♯11, 7♭13, 7♯5, 7♭5, 7♯9♭13, 7♭9♭13, 7♭9♯11, 7♯9♯11 | hard→expert |
| `colors` | quartal, quintal, maj7♯5, maj7♯11, min-maj7 | expert |
| `rootless` | *-rlA, *-rlB | expert |
| `pentatonics` | maj-pent, min-pent | medium |

The three interval packs are disjoint; Easy runs `intervals-simple`, Medium adds
`intervals-tritone`, Hard adds `intervals-augdim` — the available interval set grows
without any pack overlapping another. Their low overall rate (today's `weight:
0.3`) is just a small `PACK_W`.

### §3.2 Mode

`MODE_W = { major, minor }`, e.g. `{ major: 6, minor: 4 }`. Easy may be major-only
(§5, §9-4).

### §3.3 Scale-degree

A weight per degree, per mode (the `fifths` column is the fixed structural mapping;
the two weight columns are illustrative `TODO`s, ordering included — set later).

| degree | fifths (maj / min) | major wt | minor wt |
|---|---|---|---|
| 1 / i | 0 | 10 | 10 |
| 5 / v | +1 | 8 | 7 |
| 4 / iv | −1 | 7 | 6 |
| 2 / ii | +2 | 5 | 4 |
| 6 / ♭6 | +3 / −4 | 4 | 5 |
| 3 / ♭3 | +4 / −3 | 3 | 5 |
| 7 / ♭7 | +5 / −2 | 2 | 4 |
| raised 7 (min) | +5 | — | 2 |
| borrowed ♭7,♭3,♭6 (maj) | −2,−3,−4 | 1 each | — |
| chromatic ♯4,♭2,♭5 | +6,−5,−6 | 0.3 | 0.3 |

### §3.4 Commonness ladder

Four named levels, tier-weighted — "how idiomatic a chord must be to show up here".
The four levels and the "a level absent at a tier = 0 = gated off" behavior are
structural; the numbers below are illustrative `TODO`s (the only load-bearing claim
is that levels not listed for a tier are 0):

```
COMMON_W[tier][ ultra | very | somewhat | occasional ]    // values illustrative
  easy:   { ultra: 1 }                                        // diatonic only
  medium: { ultra: 1, very: 0.5 }
  hard:   { ultra: 1, very: 0.7, somewhat: 0.4 }
  expert: { ultra: 1, very: 0.8, somewhat: 0.6, occasional: 0.3 }
```

### §3.5 Tone-sets → commonness floors (the core mechanism)

Each `(mode, degree)` owns an **ordered list of `(toneSet, floor)` entries**.
`toneSet` = a set of intervals relative to the chord root (same space as
`pattern.intervals`). A pattern's commonness there = the **highest floor whose set
fully contains all its intervals**; no containing set ⇒ can't appear.

Two structural rules:

1. **Multiple tone-sets may share a floor** (e.g. minor tonic lists both an Aeolian
   and a harmonic-minor set at `ultra`).
2. **Never union them** — keep sets distinct so the subset test can't admit a
   frankenstein chord (a set merging Aeolian's ♭7 and harmonic minor's ♮7 would
   wrongly pass a chord holding *both* m7 and M7). A chord must fit *entirely
   within one* real scale/extension to qualify.

**All sets are hand-authored** (no derivation logic). For diatonic degrees the
`ultra` set will usually *be* the local mode — a handy mental check when writing it
(major-4's `ultra` is Lydian `[R,M2,M3,♯4,P5,M6,M7] = {0..6}`; major-5's is
Mixolydian `{−2..4}`, so V7 lands ultra ✓) — but it is written out, not computed,
because the **chromatic degrees** (♯4, ♭2, ♭5) have no clean "local mode" and may
carry **no `ultra` set at all**, only `somewhat`/`occasional` ones. Minor tonic
gets two distinct `ultra` sets — natural-minor and harmonic-minor (so V7/vii°7 in
minor stay ultra) — per the no-union rule; melodic optional. Example major degree 4
(illustrative — which sets exist and which floor each gets is a `TODO` for the
tuning pass, not a claim that IV7 *is* "very"):

```
majorDegree(4 /* −1 */) = [                                    // illustrative only
  { set: LYDIAN_ON_ROOT,               floor: 'ultra'      },  // IV, 6/9, maj7♯11
  { set: [...LYDIAN, m7],              floor: 'very'       },  // IV7 (blues)
  { set: DORIAN_ON_ROOT,               floor: 'somewhat'   },  // iv borrowed (m3, m6)
  { set: [...DORIAN, dim5],            floor: 'occasional' },  // outer chromatic color
]
```

So a major-4 **maj7♯11** ⊆ Lydian → `ultra`; a major-4 **minor triad** (needs m3 ∉
Lydian, ∈ Dorian) → `somewhat`. The same test places bare intervals/dyads on their
idiomatic degrees for free (an `aug4` ⊆ Lydian on major-4 = the diatonic tritone; a
`Dominant-7th guide-tone dyad` ⊆ Mixolydian on major-5) — no separate keyless lane.

### §3.6 Key signature

A weight per signature `−6…+6`, drawn independently (§2). Structurally it's
mode-independent (a signature is one draw whether the instance is major or its
relative minor); the numbers are an illustrative `TODO`:

| sig | 0 | ±1 | ±2 | ±3 | ±4 | ±5 | ±6 |
|---|---|---|---|---|---|---|---|
| weight | 6 | 5 | 4 | 3 | 2 | 1 | 0.5 |

## §4 — No dead ends: the config invariant

Every step of the draw must have a positive-weight option given the prior picks. We
keep the live draw safe not by look-ahead reweighting but by a **config invariant**
— every part of it enumerable and asserted in a test. For every tier:

> 1. **≥1 key** has `SIG_W > 0`.
> 2. **≥1 mode** has `MODE_W > 0`; and for every mode with `MODE_W > 0`, **≥1
>    degree** has `DEGREE_W > 0`.
> 3. For every `(mode, degree)` with `MODE_W·DEGREE_W > 0`, **≥1 pattern** sits in a
>    pack active at that tier **and** at a tier-allowed commonness (`COMMON_W > 0`).

If all hold, each step always has ≥1 candidate and the draw never dead-ends. The
test enumerates the tables and asserts them, so a broken config — Easy enabling a
borrowed degree whose only patterns are `somewhat`, or a tier that weights both
modes but zero degrees, or a tier with no key — fails **loudly at test time**
rather than throwing at runtime. This is the "no free lunch" avoided the right way:
we forbid infeasible config instead of computing feasibility on the fly.

**Live vs precomputed — same distribution.** Being dead-end-free, the draw runs
live (a handful of weighted picks per puzzle). Equivalently, tabulate `P(mode,
degree, pattern)` as the product of the per-step conditionals (and `P(sig)`
separately) — identical distribution, and the natural form for `harmony:dump` to
print realized marginals (pack / degree / key). Either is fine; live is simplest,
precompute is nice for the dump.

Conceptually this is a **product of experts**: `MODE_W`/`DEGREE_W` are exact
marginals; within a `(mode,degree)` the pack and commonness factors multiply over
the cells that exist (the tone-set mask), so a chord that fits few idiomatic homes
is genuinely rarer — the intended chord↔root coupling from §0, which a naive
independent product would miss.

## §5 — Difficulty gates modes, degrees, keys, and packs

Difficulty restricts the factor tables; the note spread *emerges* from the menu.
The *structural* claim is only "each tier gates modes / key sigs / degrees / packs /
commonness, and later tiers open up more" — the specific assignments in this table
are an illustrative sketch (`TODO`), to be set in the tuning pass, not a proposal.

| tier | modes | key sigs | degrees | packs live (`PACK_W`>0) | commonness |
|---|---|---|---|---|---|
| Easy | major | 0, ±1 | I, IV, V (+ ii, vi) | intervals-simple, triads | ultra |
| Medium | +minor | 0…±3 | all diatonic | + intervals-tritone, sus, sevenths, sixths, pentatonics | + very |
| Hard | major, minor | 0…±4 | + common borrowed | + intervals-augdim, extended, altered-dominants | + somewhat |
| Expert | major, minor | 0…±6 | + chromatic ♯4,♭2,♭5 | + inverted/open triads, shells, guide-tone & sixth dyads, rootless, colors | + occasional |

## §6 — Decoys keep a per-tier range (with a solution override)

Solutions are **not** range-clamped — the distributions make triple-accidental
spellings impossible (major key never selects a dim7 on ♭5), so a bizarre note in
playtest is a **distribution bug to see**. `validRoots`, `rootPool`,
`rootCenterBias`, and the *root-side* use of `noteRange` all go away (the root is
computed, not searched).

But **decoys keep a per-tier range** so they don't drag extreme notes in when a
solution sits near an edge — with one override: if the solution itself pokes outside
the configured range, the decoy window bound shifts in only as far as the
**solution's own most extreme note**, never further. So decoys never introduce a
note more extreme than the solution already does.

```
[b0, b1] = cfg.decoyRange                               // per-tier (was noteRange)
effLo = min(b0, min(solutionNotes))                     // solution can only widen, never past itself
effHi = max(b1, max(solutionNotes))
// place the width-W window to contain the solution, within [effLo, effHi]  (else fillDecoys unchanged)
```

## §7 — Code impact

- **`theory.ts`** — `Mode` type + `tonicNote(mode, sig)`; optional `degreeName` /
  `romanNumeral` / `keyName` for captions and other apps (§8). Tone-sets are
  authored data in harmony.ts, not derived here.
- **New `harmony.ts`** — owns selection: the weight tables (`MODE_W`, `DEGREE_W`,
  `PACK_W`, `COMMON_W`, `SIG_W`), the `Pack` list, the per-`(mode,degree)` tone-set
  lists (all authored), `commonness(pattern, mode, degree)` (max matching floor),
  and `sampleHarmony(tier, rng) → { pattern, rootNote, mode, degree, sig }` (the
  §2 iterative draw; a cached table only if `harmony:dump` wants one).
- **`bank.ts`** — patterns keep `name`, `display`, `kind`, `intervals`,
  `qualifier?`. **Drop `weight` and `tier`** (packs + `PACK_W` subsume both). `kind`
  unchanged. Packs live here or in harmony.ts as `Pack[]` referencing pattern names.
- **`generate.ts`** — replace the pattern + `validRoots` + root block with
  `sampleHarmony`; drop `validRoots`. `generatePuzzle` → `(cfg, seed)`. `fillDecoys`
  swaps the `noteRange` clamp for `[min(b0,minS), max(b1,maxS)]` (§6).
- **`config.ts`** — rename `noteRange` → `decoyRange` (decoys only); drop `rootPool`,
  `rootCenterBias`, `dyadWeight`, `patternWeights`; keep `gridCellCount`,
  grid/aspect knobs, `decoyWindowWidth`; reference the per-tier factor gates.
- **Dev tooling** — `harmony:dump`: per `(mode, degree)`, the tone-sets, each
  pattern's commonness, and realized per-tier probabilities + pack/degree/key
  marginals, so tables tune without playing.
- **Tests** — `tonicNote` across 13 sigs × 2 modes; **the no-dead-end invariant
  (§4), all three clauses per tier**: ≥1 key; ≥1 mode and ≥1 degree per live mode;
  ≥1 tier-valid pattern per live `(mode, degree)`. Plus: commonness = max matching
  floor, never unions; every pack member resolves to a real pattern; C♭-minor absent
  below Hard, rare at Hard+; decoys stay within `[min(b0,minS), max(b1,maxS)]`.
  Adapt existing generation-invariant tests to `(cfg, seed)`.

## §8 — Reusability for other apps

`harmony.ts` is content-agnostic: it emits a rich functional instance `{ mode, sig,
degree, pack, pattern, rootNote, solutionNotes }`, from which `theory.ts` derives
**key name**, **roman numeral** (degree + case from the third + accidental prefix,
e.g. `iv`, `♭VII`, `V7/V`), and **spelled notes**. A future ear-training /
transcription app can ask "a `very`-common chord in F♯ major" or "a `iv` in F♯
major on the treble staff" and get correct spelling + labels — same engine,
different renderer. Modes beyond major/minor are just more `modeOffset` values.

## §9 — Decisions

**Locked (owner):** tone-set + commonness-ladder model, multiple distinct sets per
degree never unioned (§3.5); **all tone-sets hand-authored**, none derived (§3.5);
**packs** as a separate object carry probability+gating, `kind` unchanged (§3.1);
**iterative draw** mode→degree→pattern→key with `MODE_W`/`DEGREE_W` exact and the
pattern step derived as `PACK_W·COMMON_W/N(pack,commonness)` over the valid
`(pack × commonness)` cells (§2); **no dead ends by a tested config invariant**, not
look-ahead (§4); per-member-within-cell weights deferred; all `*_W` raw weights
renormalized where used; no accidental guard on solutions (§6); decoys keep a
per-tier range with the solution-extreme override (§6); retire per-pattern `weight`
and `tier`.

**Open, for implementation:**

1. **Minor `ultra` scope:** natural + harmonic (my rec); add melodic?
2. **Pack membership form:** explicit name lists (my rec — inspectable), or
   predicate-built (`isDominant`, `hasAll(m7,M3)`) for less churn as the bank grows?
3. **Easy = major-only** (my rec), or major+minor with only `sig ∈ {0, ±1}`?
4. **All distributions + tone-set/commonness assignments** — every number and
   floor in this doc is an illustrative placeholder (see the ⚠️ note up top). Set
   them in a **dedicated tuning pass** *after* the mechanism is built: a deliberate
   process drawing on music-theory analysis and research (owner wants heavy
   assistant input here, not seat-of-the-pants instinct), inspected via
   `harmony:dump`. Not to be seeded from these placeholders. **Consider running
   that pass in a subagent with carefully scoped context** — the theory framing and
   the built mechanism only, none of this doc's placeholder numbers or the design
   back-and-forth — so it reasons about real-world frequencies with a fresh,
   unanchored mindset.
