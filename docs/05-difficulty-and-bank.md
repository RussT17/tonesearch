# ToneSearch — Difficulty Levels & Expanded Bank (v2 increment)

> **Status:** Draft · increment spec. E/M/H **locked**; Expert principles set,
> full enumeration pending (see §3 Sequencing). Once settled, the outcomes fold
> back into the
> canonical [Full Spec](03-full-spec.md) §3 (bank), §4 (ranges), §8 (difficulty).
> Ranges are on the **line of fifths** (see [Music Theory Doc](00-music-theory.md)).

## §1 — Idea capture

### Scales — HELD (not this increment)
Deferred for two reasons to solve first: (1) a 7-note sequence would force the
target diamonds to **shrink**; (2) unclear **solve behavior** — playing a whole
scale as a simultaneous chord sounds bad. Parked in the backlog.

### Four difficulty levels — player-selected, **default Easy**
"≥ N cells" = grid cell-count minimum. Levels are cumulative (each adds to the
previous). *Interval/note ranges below are my reading of the fifths-line
endpoints you gave — check them.*

**Easy**
- *Dyads:* every interval from **m2 (−5) … M7 (+5)** → m2, m6, m3, m7, P4, P5,
  M2, M6, M3, M7 (10).
- *Triads:* major, minor.
- *Grid:* ≥ 10 cells.
- *Allowed grid notes:* **D♯ (+7) … D♭ (−7)**.

**Medium** (+ Easy)
- *Dyads:* + aug4 (+6), dim5 (−6) → 12.
- *Triads:* + dim, aug, sus2, sus4 → 6.
- *Four-note chords:* m7, maj7, dom7, maj6, min6, min♭6, m7♭5 (half-dim).
- *Grid:* ≥ 14.
- *Allowed notes:* **A♯ (+8) … G♭ (−8)**.

**Hard** (+ Medium)
- *Dyads:* + aug5 (+8), aug2 (+9), dim7 (−9) → all 15.
- *Chords:* + dim7 (fully diminished); add2, add4, add9; 6/9; five-note 9 chords;
  11 chords; 13 chords; common altered dominants.
- *Grid:* ≥ 18.
- *Allowed notes:* **B♯ (+10) … F♭ (−10)**.

**Expert** (+ Hard)
- *Alternate voicings:* triad inversions, 5-less voicings, rootless voicings, and
  other common voicings of all chords.
- *Remaining common jazz chords:* multiple extensions/alterations, quartal,
  quintal, anything else reasonable. Common voicings only where a full version
  isn't idiomatic — some tones may be dropped (not every chord needs its complete
  form).
- *Grid:* ≥ 18 (same as Hard).
- *Allowed notes:* **C𝄪 (+12) … E𝄫 (−12)** (the full plausible range).

### Sequence names
Every sequence has a human name (e.g. "Dominant 7th", "Major third"), **always
visible but subtle** — present for reference, easy to mentally ignore for a
player who wants to name it themselves first.

### Decoy window
Width stays exactly as today (`decoyWindowWidth = 15`) on **all** levels — to be
tuned in playtest.

## §2 — Underspecified aspects (resolve in §3)

⚑ = high-leverage / shapes scope.

- **U1. ⚑ Exact chord definitions (Hard/Expert).** The categories (add2/4/9, 6/9,
  9/11/13, altered dominants, quartal/quintal, jazz extensions) need concrete
  interval lists. A sizeable music-theory pass — I'll propose them for review.
- **U2. ⚑ Sequence length vs. diamond size.** Target diamonds are sized for up to
  **5** (`REF_LEN = 5`). Five-note 9-chords fit; full **11/13 chords are 6–7
  notes** and would shrink the diamonds — the same problem that held scales.
  *Proposal:* **cap sequence length at 5**, using reduced voicings for 11/13
  (consistent with the existing 4-note reductions and Expert's "common voicings,
  drop tones" philosophy). Confirm?
- **U3. add2 vs add9 (and add4 vs add11) collapse.** Octaveless, M2 = 9 and
  P4 = 11 (same fifths value), so add2 and add9 are the *same notes* — differing
  only by sequence *order*. Include both as distinct ordered sequences, or one?
  *Proposal:* one each.
- **U4. ⚑⚑ Expert's alt-voicings = the deferred off-root/rootless feature.**
  Inversions and rootless voicings mean the sequence **doesn't start on R**, which
  the v1 model doesn't do (per-step validation, "first tap = root", labeling all
  assume root position). The root-agnostic check's *general* form already supports
  it, but "first tap = root", naming, and generation need rework — this is the
  bulk of the work. *Proposal:* **split it** — ship Easy/Medium/Hard first; do
  Expert's alt-voicings as its own follow-up increment. Confirm?
- **U5. Names — data & format.** Each pattern needs a display name: dyads →
  interval names ("Minor third"); chords → chord names ("Half-diminished 7th").
  Full vs. short form? Alt-voicing naming ties to U4. *Proposal:* concise names.
- **U6. Per-level note range × decoy window.** Each level's "allowed grid notes"
  becomes the note-range bound, **replacing the fixed [−12,+12]**: Easy [−7,+7],
  Medium [−8,+8], Hard [−10,+10], Expert [−12,+12]. Root selection must keep every
  solution note inside it; the decoy window (width 15) is clamped to it. *Note:*
  Easy's range is exactly 15 wide, so decoys fill the whole range (no offset room)
  — acceptable, or worth a tweak? Roots also get constrained by the range.
- **U7. Difficulty selector UI.** Where/how does the player pick the level (the
  top bar already shows the label — tap-to-cycle? a menu?), and persist the choice
  (localStorage)? *Proposal:* top-bar label becomes a tap-to-cycle control,
  persisted.
- **U8. Grid "≥ N" semantics.** Maps to `gridCellCount` as a minimum target
  (3×3 accretion already meets-or-exceeds). Trivial; noted for completeness.

## §3 — Resolved spec (in progress)

**Decisions:** U2 — Easy/Medium/Hard cap at **≤5 notes** (common voicings,
reduced where needed). Expert may exceed 5 **only** for genuinely common voicings.
U4 — Expert's non-root-start voicings are a **follow-up build**, but its full
sequence list is specced here now.

### The bank, by level (cumulative)

Patterns are `[interval tokens]`. Every level *includes all previous levels*.

**Easy — 12**
- *Dyads (10):* `[R,X]` for X ∈ m2, m6, m3, m7, P4, P5, M2, M6, M3, M7.
- *Triads (2):* maj `[R,M3,P5]`, min `[R,m3,P5]`.

**Medium — +13**
- *Dyads (+2):* `[R,aug4]`, `[R,dim5]`.
- *Triads (+4):* dim `[R,m3,dim5]`, aug `[R,M3,aug5]`, sus2 `[R,M2,P5]`,
  sus4 `[R,P4,P5]`.
- *Sixths/sevenths (+7):* min7 `[R,m3,P5,m7]`, maj7 `[R,M3,P5,M7]`,
  dom7 `[R,M3,P5,m7]`, maj6 `[R,M3,P5,M6]`, min6 `[R,m3,P5,M6]`,
  min♭6 `[R,m3,P5,m6]`, m7♭5 `[R,m3,dim5,m7]`.

**Hard — +20** (all ≤ 5 notes)
- *Dyads (+3):* `[R,aug5]`, `[R,aug2]`, `[R,dim7]` → all 15 dyads.
- *Fully diminished:* dim7 `[R,m3,dim5,dim7]`.
- *Adds:* add9 `[R,M3,P5,M2]`, m(add9) `[R,m3,P5,M2]`.
- *6/9:* 6/9 `[R,M3,P5,M6,M2]`, m6/9 `[R,m3,P5,M6,M2]`.
- *Ninths (full 5-note):* maj9 `[R,M3,P5,M7,M2]`, dom9 `[R,M3,P5,m7,M2]`,
  min9 `[R,m3,P5,m7,M2]`.
- *Elevenths (common ≤5):* min11 `[R,m3,m7,M2,P4]` (drops the 5th to keep 9+11),
  9sus4 `[R,P4,P5,m7,M2]` (the idiomatic 3rd-less dominant-11). A true dom11 with
  the M3 is **omitted** — the ♮11 clashes with the 3rd (same reason `maj11`/`add4`
  are out); `9sus4` covers the 3rd-less sound and `7♯11` the clash-free dominant
  eleventh color.
- *Thirteenths (common ≤5, R-3-7-9-13):* dom13 `[R,M3,m7,M2,M6]`,
  maj13 `[R,M3,M7,M2,M6]`, min13 `[R,m3,m7,M2,M6]`.
- *Altered dominants:* 7♭9 `[R,M3,P5,m7,m2]`, 7♯9 `[R,M3,P5,m7,aug2]`,
  7♯11 `[R,M3,P5,m7,aug4]`, 7♭13 `[R,M3,m7,m6]` (drops the clashing 5th).

> **Resolved (Hard):** add4 omitted (♮4–M3 clash); maj11 omitted (♮11–M3 clash).
> **One voicing per chord** through Hard, leaning to the fuller form, dropping a
> tone only for a genuine clash (e.g. 7♭13 drops the 5th). The slick **4-note
> "shell" reductions** (today's `dom9`, `maj13`, …) are **not** in Hard — they
> move to Expert as alternate voicings.

**Expert — exhaustive *common* voicings** (build deferred; ⟂ = needs the
non-root-start lift)

*Principles:* cover **all common voicings** of the chords, **curated** — no
contrived inversions, no clutter. Names **need not be unique**; use the common
name where one exists and isn't cumbersome (judgment). Genuine common voicings may
exceed 5 notes, be rootless, or be partial (even 2 notes). All of Hard's chords,
plus:

- **Shell / reduced voicings** (root-position) — the 4-note reductions of the
  extended chords: dom9 `[R,M3,m7,M2]`, dom13 `[R,M3,m7,M6]`,
  dom7♭9 `[R,M3,m7,m2]`, dom7♯9 `[R,M3,m7,aug2]`, dom7♯11 `[R,M3,m7,aug4]`,
  dom7♭13 `[R,M3,m7,m6]` (⚠ identical to Hard's `7♭13` — dedupe at Build 2),
  maj9 `[R,M3,M7,M2]`, maj13 `[R,M3,M7,M6]`,
  maj7♯11 `[R,M3,M7,aug4]`, min9 `[R,m3,m7,M2]`, min11 `[R,m3,m7,P4]`,
  min13 `[R,m3,m7,M6]`.
- **Root-position jazz colors** — min(maj7) `[R,m3,P5,M7]`,
  maj7♯5 `[R,M3,aug5,M7]`, 7♯5 `[R,M3,aug5,m7]`, 7♭5 `[R,M3,dim5,m7]`;
  multi-alteration dominants 7♯9♭13 `[R,M3,m7,aug2,m6]`, 7♭9♯11 `[R,M3,m7,m2,aug4]`,
  7♭9♭13, a representative 7alt; quartal `[R,P4,m7,m3]`, quintal `[R,P5,M2,M6]`;
  7sus4 `[R,P4,P5,m7]`.
- **Rootless voicings** ⟂ — 4-note A/B rootless (e.g. min9 rootless
  `[m3,P5,m7,M2]`, dom13 rootless `[M3,M6,m7,M2]`, maj9 rootless `[M3,P5,M7,M2]`),
  and **2-note guide-tone dyads in both orders** — `[M3,m7]`/`[m7,M3]` (dom),
  `[m3,m7]`/`[m7,m3]` (min), `[M3,M7]`/`[M7,M3]` (maj).
- **Inversions** ⟂ — curated common only: triad 1st/2nd inversions (slash chords),
  common 7th-chord inversions / drop-2. No contrived inversions.

*Naming:* e.g. rootless Cm9 → "Cm9 (rootless)", C/E → "C/E", guide-tones →
"3–7 (dom)". Finalized at the Expert build.

> **Next:** the *full curated Expert enumeration* is its own pass (large — I'll
> draft it; a subagent can help batch it). Recommend doing it just before the
> Expert build, after E/M/H ships (see sequencing note below).

### Difficulty as parameters (folds into Full Spec §8)
Each level is a parameter set: `{ patterns (bank subset), gridCellCountMin,
noteRange, register? }`. Concrete values:

| Level | Grid ≥ | Note range (fifths) | Bank |
|-------|:---:|:---:|---|
| Easy | 10 | [−7, +7] (D♯…D♭) | dyads m2–M7 + maj/min triads |
| Medium | 14 | [−8, +8] (A♯…G♭) | + aug4/dim5 dyads, 4 triads, 7 sixth/seventh chords |
| Hard | 18 | [−10, +10] (B♯…F♭) | + 3 dyads, extended/altered (≤5) |
| Expert | 18 | [−12, +12] (C𝄪…E𝄫) | + alt voicings & remaining jazz chords |

- **`noteRange`** replaces the fixed `plausibleBounds`: solution notes and decoys
  must stay within it; the decoy window (width 15, unchanged) is clamped to it.
  Root selection is constrained so all solution notes fit (U6).
- **`gridCellCountMin`** — the accretion target (already meets-or-exceeds).
- **Selection [U7]:** player-selected, default Easy, persisted (localStorage); the
  top-bar difficulty selector is a dropdown.

### Names [U5]
Each pattern carries a display `name` (dyads → interval names like "Minor third";
chords → "Dominant 7th", "Half-diminished"). Shown **always, subtly** near the
tokens. Concise form. (Alt-voicing naming decided with the Expert build.)

**Reduced-voicing marker.** A voicing's name gets a bracketed marker (e.g.
`Dom13 [reduced]`) when it omits one or more tones of the chord its **name implies
at full extension** — *except* tones dropped to avoid a genuine clash, which are
conventional and stay unbracketed. Lets the player tell an economy voicing from
the fuller chord. Rules:
- **Reference = the fullest *playable* chord the name implies** (clash tones,
  which are conventionally dropped, don't count as present), not the fullest
  voicing currently in the bank. A dom/maj "13" implies R-3-5-7-9-13 — the ♮11 is
  clash-dropped against the 3rd, so it never earns a marker; a "9" implies
  R-3-5-7-9; "7♭13" implies only the tones it names (no 9); min13 *does* admit the
  11 (no 3rd–11 clash).
- **Bracketed (economy omission):** Hard's `dom13`/`maj13` (drop the 5th for the
  cap; their 11 is the *clash* drop, not counted), `min13` (drops the 5th **and**
  the 11 — *both* economy, since minor has no 3rd–11 clash), and `min11` (drops the
  5th to keep 9+11) — and every Expert **shell** (`dom9 [reduced] = [R,M3,m7,M2]`,
  …). Expert
  also carries the **fuller** versions *unbracketed* (e.g. the 6-note
  `dom13 = R-3-5-7-9-13`).
- **Unbracketed (complete, or clash-only drop):** `dom9`, `maj9`, `min9`, `6/9`,
  `9sus4`, the triads/6ths/7ths, and clash reductions like `7♭13` (the 5th is
  dropped only because it clashes with the ♭13).
- Marker doesn't name the dropped tones; two bracketed alternates may share a name.
  Implementation: a per-pattern `reduced?: boolean` flag appends the marker.
  Judgment applies at the margins (whether a name "implies" a given tone).
- Net: markers appear on Hard's 11/13 families and throughout Expert; **none** in
  Easy/Medium. (Exact text — `[reduced]` / `[red.]` / a glyph — finalized at build.)

### Sequencing
1. **Now:** lock this spec for **Easy/Medium/Hard**; fold into Full Spec §3/§4/§8.
2. **Build 1:** implement the difficulty system + E/M/H bank + names + selector.
3. **Enumeration pass:** the full curated Expert bank (its own focused effort;
   subagent optional) — sharper once E/M/H exists and voicings can be tested.
4. **Build 2:** the non-root-start machinery + Expert tier.
