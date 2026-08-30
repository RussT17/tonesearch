# ToneSearch — Expert Mode (v2 Build 2)

> **Status:** ✅ Built (2026-08-29). Spec + design for the **Expert** tier. Follows the increment
> spec [05-difficulty-and-bank.md](05-difficulty-and-bank.md) (§3 Expert, Sequencing)
> and the E/M/H build [06-difficulty-design.md](06-difficulty-design.md). Ranges on
> the line of fifths; interval → fifths per [00-music-theory.md](00-music-theory.md).

## §0 — Key finding: off-root is *not* a machinery lift

Build 1 flagged Expert's off-root/rootless voicings as "the big lift." Re-reading
the code, that mostly evaporates: the **engine is already root-agnostic**.
- `isSolution`/`isPrefix` use the general form `base = note[0] − interval[0]`,
  which validates *any* interval sequence — it never assumes `interval[0] === 0`.
- Generation (`validRoots`, path lay, decoys) is pattern-agnostic — intervals may
  start off-root or omit R entirely.
- `ascendingMidis` seats the **first** note near the anchor and stacks up, so an
  inversion literally sounds like an inversion (3rd in the bass).

So the **only** things that assume root-position are (a) the `intervals[0] === 0`
line in `bank.test`, and (b) the "first tap = root" *clarification* prose in
[03 §5]. Expert is therefore: **the curated bank + naming + one relaxed invariant
+ the implied-root bass** (below). No new generation/validation/render machinery.

## §1 — Scope decisions (resolved)

- **Inversions:** triads only — **1st + 2nd inversion** of maj/min/dim/aug (aug's
  are enharmonic re-spellings, distinct in a spelling game), plus the **5–3–R**
  (fifth-bottom, root-top) re-voicing of each triad. No 7th-chord inversions.
- **Rootless:** the classic **ii–V–I set** (min9 / dominant-13 / maj9 in A & B
  forms) + the **guide-tone dyads** (3–7, both orders) + the **3–6/13 dyads**
  (M3+M6, m3+M6, both orders). The guide-tone/3–6 dyads count as the "rootless
  inversions."
- **Default-reduce:** enter chords in their *commonly played* voicing. Altered
  dominants are always no-5 → entered that way, full versions skipped. Shells are
  the reduced forms of the extended chords.
- **Naming stays generic** (no root letter — the root is hidden): "Major Triad
  (1st inv)", "Minor 9th (rootless A)". The `reduced` flag still appends `[reduced]`.

## §2 — The Expert bank (+ 71 patterns)

Adds to all of Hard. ⟂ = off-root (starts off R / omits R). Intervals are `[fifths…]`.

> **Revised 2026-08-30 — `src/bank.ts` is authoritative.** Since this doc was
> written: names/qualifiers were codified per [docs/08](08-naming-conventions.md)
> (the `reduced` boolean below → freeform `qualifier`, e.g. "no 5", "ext'd shell"
> for the 4-note extended shells, "shell" for the rooted 5-less shells); the triad
> re-voicings grew from 4 to 12 (added **3–R–5** "1st inv., open" and **R–5–3**
> "open" alongside **5–3–R** "2nd inv., open"); the guide-tone pairs and 3–6 dyads
> are now **named by the implied chord** ("Dominant 7th (guide tone pair)", "Major
> 6th (3/6 dyad)") and are `kind:'chord'`; a **Minor ♭6** 3–6 dyad (both orders)
> was added. Net +10 → 71 Expert patterns.

### Extended-chord shells — reduced 4-note voicings (root-position, `[reduced]`) — 11
`dom9 [R,M3,m7,M2]`, `dom13 [R,M3,m7,M6]`, `dom7♭9 [R,M3,m7,m2]`,
`dom7♯9 [R,M3,m7,aug2]`, `dom7♯11 [R,M3,m7,aug4]`, `maj9 [R,M3,M7,M2]`,
`maj13 [R,M3,M7,M6]`, `maj7♯11 [R,M3,M7,aug4]`, `min9 [R,m3,m7,M2]`,
`min11 [R,m3,m7,P4]`, `min13 [R,m3,m7,M6]`.
*(`dom7♭13` shell omitted — equals Hard's `7♭13`.)* The 4-note `dom13`/`maj13`/
`min13`/`min11` are the **no-9** voicings (R-3-7-13 / R-3-7-11) — a genuinely
different, very common voicing from Hard's *with-9* reduced 5-notes, so per [M4]
they're kept even though both caption "…[reduced]" (same caption is fine for
legitimately distinct voicings).

### Rooted 5-less shells — root + guide-tones / 3–6, both orders (root-position, `[reduced]`) — 10
The with-root versions of the rootless dyads below (the everyday jazz comping
shells: a 7th/6th chord with the 5th dropped). Both orderings kept.
- dom 3–7 `[R,M3,m7]` / `[R,m7,M3]`; min 3–7 `[R,m3,m7]` / `[R,m7,m3]`;
  maj 3–7 `[R,M3,M7]` / `[R,M7,M3]`.
- maj/dom 3–6 `[R,M3,M6]` / `[R,M6,M3]`; min 3–6 `[R,m3,M6]` / `[R,M6,m3]`.

### Root-position jazz colors — 12
`min(maj7) [R,m3,P5,M7]`, `maj7♯5 [R,M3,aug5,M7]`, `7♯5 [R,M3,aug5,m7]`,
`7♭5 [R,M3,dim5,m7]`, `7♯9♭13 [R,M3,m7,aug2,m6]`, `7♭9♭13 [R,M3,m7,m2,m6]`,
`7♭9♯11 [R,M3,m7,m2,aug4]`, `7♯9♯11 [R,M3,m7,aug2,aug4]`,
`quartal [R,P4,m7,m3]`, `quintal [R,P5,M2,M6]`, `7sus4 [R,P4,P5,m7]`,
`13sus4 [R,P4,m7,M2,M6]`.

### Triad inversions ⟂ — 8
maj `[M3,P5,R]` / `[P5,R,M3]`; min `[m3,P5,R]` / `[P5,R,m3]`;
dim `[m3,dim5,R]` / `[dim5,R,m3]`; aug `[M3,aug5,R]` / `[aug5,R,M3]`.
*(Aug inversions are enharmonic re-spellings — E–G♯–C vs E–G♯–B♯ — distinct in a
spelling game, so kept.)*

### Triad 5–3–R voicings ⟂ — 4
Fifth-on-bottom, root-on-top (a non-cyclic re-voicing, distinct from the three
inversions): maj `[P5,M3,R]`; min `[P5,m3,R]`; dim `[dim5,m3,R]`; aug `[aug5,M3,R]`.

### Rootless guide-tone dyads ⟂ (both orders) — 6
dom 3–7 `[M3,m7]`/`[m7,M3]`; min 3–7 `[m3,m7]`/`[m7,m3]`; maj 3–7 `[M3,M7]`/`[M7,M3]`.

### Rootless 3–6 / 13 dyads ⟂ (both orders) — 4
maj/dom `[M3,M6]`/`[M6,M3]`; min `[m3,M6]`/`[M6,m3]`.

> **M1 — resolved: keep.** On the grid these 10 two-note dyads reduce to the *fifths
> gap* between the notes, so they map onto interval dyads already present
> (guide-tones → dim5/P5/P5; 3–6 → P4/aug4), and `[M3,M7]`/`[m3,m7]` share a win
> condition. That's intentional here: they **teach which named guide-tone pair maps
> to which plain interval**, and the §4 bass makes each *sound* like its chord.
> Kept as ear-training variants (accepting no added grid difficulty; the maj/min
> guide-tone pair sharing a win-condition is fine — distinct spelling + bass).

### Rootless 4-note A/B voicings ⟂ — 6
min9 A `[m3,P5,m7,M2]` / B `[m7,M2,m3,P5]`;
dom13 A `[M3,M6,m7,M2]` / B `[m7,M2,M3,M6]`;
maj9 A `[M3,P5,M7,M2]` / B `[M7,M2,M3,P5]`.

## §3 — Data / naming / test changes

- **Every Expert pattern still needs all the existing Pattern fields:** `name`
  (stable id), `display`, `kind`, `intervals`, `tier: 'expert'`, `reduced?`. "Off-
  root" isn't a new field — it's derived (`!intervals.includes(0)` for the bass).
- **`kind` for Expert:** shells / colors / rootless-4-note / rooted-shells →
  `'chord'`; the 2-note dyads → `'interval'` (so `dyadWeight` still downweights
  them). **Triad inversions → `'chord'`, not `'triad'`** — `'triad'` stays reserved
  for the four bare root-position triads (keeps the categorization test intact),
  and the inversion's display already says "Triad".
- **Naming — superseded by [docs/08](08-naming-conventions.md).** The category
  word is now kept for **all** tiers, and the `reduced` boolean was replaced by a
  freeform `qualifier` shown in parens. Caption =
  `${display} ${categoryLabel(kind)}${qualifier ? ' (' + qualifier + ')' : ''}`.
  Expert captions read e.g. "Major Triad (1st inv.)", "Minor 9th Chord (rootless A)",
  "Dominant 9th Chord (ext'd shell)"; triad inversions/re-voicings are `kind:'triad'`;
  the guide-tone pairs and 3–6 dyads are `kind:'chord'`, named by the **implied
  chord** ("Dominant 7th Chord (guide tone pair)", "Major 6th Chord (3/6 dyad)").
- **`Tier` gains `'expert'`** (`TIER_RANK.expert = 3`); `bankForTier('expert')`
  returns all; `configFor('expert') = { gridCellCount: 18, noteRange: [-12, 12] }`
  (per [05 §3]/[03 §8]).
- **Bank-test rewrite (bigger than "relax one line").** `bank.test` hardcodes
  `BANK.length===45`, `dyads===15`, `reduced==={dom13,maj13,min13,min11}`, the
  triad set `{maj,min,dim,aug}`, and tier counts `12/25/45`. All change. Rework the
  assertions to be **tier-scoped**: assert the E/M/H counts via `bankForTier`
  (Easy 12, Medium 25, Hard 45 unchanged), scope the reduced/triad-kind sets to
  Hard-and-below, and add Expert checks — every pattern `≤5` notes, no duplicate
  fifths, non-empty `display`; **E/M/H patterns all `intervals[0]===0`** (only
  Expert may start off-root); the four bare triads remain the only `kind:'triad'`.
- **Display names (proposals, tune in review):** inversions "Major Triad (1st inv)";
  rootless-4 "Minor 9th (rootless A)"; guide tones "Dominant guide tones"; 3–6
  "Major 6th (3–6)"; shells reuse the chord name + `[reduced]`. Non-unique OK.

## §4 — The implied-root bass (grounding rootless voicings)

A rootless sequence has no root, so out of context it implies the wrong chord.
When the active pattern is **rootless** (`!intervals.includes(0)`), sound the
**implied root** beneath the notes so the ear has a bass reference — as if a
bassist were holding the root.

- **Which root:** the *player's own* implied root = `firstSelectedNote −
  intervals[0]` (root-agnostic), as a pitch class. During Give Up, the revealed
  path's first note drives it the same way.
- **Where voiced:** the **implied root's pitch class** seated in the octave nearest
  ~one below the first note — `seatNearAnchor(pitchClass(root), ascendingMidis(notes)[0] − 12)`
  (drop another octave if it lands too high). Note the target `…[0] − 12` only sets
  the *register*; the sounded pitch class is the root's, not the first note's
  (review M2).
- **Distinct timbre:** a separate, softer bass voice (e.g. a sine, longer/rounder
  envelope) so it reads as accompaniment, not part of the sequence.
- **When it sounds:** (1) with **each note** as it's selected (a light root pulse
  under the note), (2) under **each note of the Give-Up reveal**, and (3) under the
  **final chord** (held with it).
- **Not for inversions or root-position** — R is present there, and an inversion
  should keep its 3rd/5th-in-the-bass character.
- *Implementation:* an `audio.playRootBass(midi)` (bass voice) called alongside the
  existing note/chord playback in `game.ts` only when the pattern is rootless;
  `playChord` gains an optional bass note. Tunable: octave offset, timbre, gain.

## §5 — Build order

Total Expert additions: **61** (11 shells + 10 rooted shells + 12 colors + 8 triad
inversions + 4 triad 5–3–R + 6 guide-tone dyads + 4 3–6 dyads + 6 rootless A/B).

1. **bank.ts** — add the Expert patterns + the `'expert'` tier; rewrite the bank
   test (tier-scoped counts, Expert checks — §3).
2. **config.ts** — `expert` tier params; `bankForTier`/`configFor` for expert.
3. **game.ts / render.ts** — Expert as the 4th dropdown option; suppress the
   category word for Expert captions (§3).
4. **audio.ts / game.ts** — the implied-root bass for rootless patterns. Notes:
   fix the `ascendingMidis` `i===0` comment ("first note", not "Root", since an
   inversion's first note is the 3rd/5th); and tap feedback during selection must
   compute the bass reference from the **ascending** voicing of the selection so
   far (not `playNote`'s fixed octave), so "an octave below the first note" is
   defined mid-selection.
5. Update [03 §5] "first tap = root" → "first tap sets the reference note (the root
   only in root-position)", and fold the counts into [03 §3].

**Playtest note:** on the 18-cell Expert grid a 2-note target likely has several
valid paths (any matching pair wins) and may feel trivial/ambiguous — consider a
per-tier minimum sequence length or down-weighting dyads further for Expert.

## §6 — For review (open calls)
- Display names for the dyads/rootless/rooted-shells (§3) — concise vs descriptive
  (owner may revisit as a follow-up). Rooted 5-less shells reuse the chord name +
  `[reduced]` (e.g. `[R,M3,m7]` → "Dominant 7th [reduced]"); both orderings share
  the name.
- Root-bass octave/timbre/gain — feel in playtest.
- Any remaining jazz colors that feel like clutter, or a common one still missing?
