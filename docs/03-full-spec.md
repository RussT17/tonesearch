# ToneSearch — Full Specification Doc

> **Status:** Draft · Step 3 of 5. Resolves the open items from the
> [Underspecified Aspects Doc](02-underspecified-aspects.md) into a concrete v1
> specification, on the foundation of the [Music Theory Doc](00-music-theory.md)
> and [Initial Idea Doc](01-initial-idea.md).
>
> Convention: **[F#]** = a resolved fork · **[default]** = written-in default
> (veto freely) · **[param]** = a tunable knob (starting value in the table at
> the end; final value found in playtest, Step 6).

## 1. Goal

A zen, endless puzzle game that trains fluent association between **note names**
and **root-relative intervals** across common keys and chord/scale patterns.
Single player, the designer as sole audience — no in-game theory teaching.

## 2. Data model

Everything rides on the line of fifths (see Music Theory Doc). One integer type
underlies both notes (fifths from D) and intervals (fifths from root), unbounded,
enharmonics distinct. The one operation: **`note = root + interval`**.

- **Pattern** — a named, ordered list of intervals (fifths values), e.g.
  `min7 = [R(0), m3(−3), P5(+1), m7(−2)]`. Data-driven; the bank is just data.
  *Reserved for v2:* a `startOffset` / `rootless` flag on a pattern (unused in v1
  — see [F3]).
- **Puzzle** — `{ pattern, root, grid, solutionPath }` where
  `solutionNotes[i] = root + pattern.intervals[i]`.
- **Grid** — a set of cells at integer `(col, row)` coordinates forming one
  connected, irregular orthogonal shape; each cell holds one note (fifths int).
- **SolutionPath** — the ordered list of cells whose notes equal `solutionNotes`.

## 3. Sequences (the bank) — [F2]

Sequences come from a **curated, data-driven bank of named musical patterns**,
not arbitrary interval soup.

- **v1 starter bank [default]:**
  - *triads* — maj `[R,M3,P5]`, min `[R,m3,P5]`, dim `[R,m3,dim5]`, aug
    `[R,M3,aug5]`, sus4 `[R,P4,P5]`, sus2 `[R,M2,P5]`;
  - *sevenths* — maj7 `[R,M3,P5,M7]`, dom7 `[R,M3,P5,m7]`, min7 `[R,m3,P5,m7]`,
    m7♭5 `[R,m3,dim5,m7]`, dim7 `[R,m3,dim5,dim7]`;
  - *sixths* — maj6 `[R,M3,P5,M6]`, min6 `[R,m3,P5,M6]` (its 6th is a *major*
    6th, by convention), min♭6 `[R,m3,P5,m6]`;
  - *extended (9 / 11 / 13)* — given as **4-note reductions**: `R + 3rd + 7th +
    the characteristic extension`, dropping the 5th and lower extensions
    (standard shell-voicing practice — the 3rd & 7th are the defining guide
    tones):
    - *dominant* — dom9 `[R,M3,m7,M2]`, dom7♭9 `[R,M3,m7,m2]`, dom7♯9
      `[R,M3,m7,aug2]`, dom7♯11 `[R,M3,m7,aug4]`, dom13 `[R,M3,m7,M6]`, dom7♭13
      `[R,M3,m7,m6]`;
    - *major* — maj9 `[R,M3,M7,M2]`, maj7♯11 `[R,M3,M7,aug4]`, maj13
      `[R,M3,M7,M6]`;
    - *minor* — min9 `[R,m3,m7,M2]`, min11 `[R,m3,m7,P4]`, min13 `[R,m3,m7,M6]`.
  - Everything stays ≤ 4 notes. Deliberately omitted (easy to add later): a
    natural-11 dominant (♮11 clashes with M3 → becomes 9sus4; P4 already covered
    by sus4), extended half-diminished (can't reduce to 4 notes cleanly), 6/9
    chords, all 5+ note voicings, and scales.
- **Order is meaningful [A5]:** the path must visit notes in the pattern's order.
- **v1 labeling [F3]:** root-position, rooted only — every sequence starts on R.
- **No duplicate tones [A6]:** patterns never produce two equal fifths values.

### Roots — [A7]

The **root pool** is a window on the line of fifths [param], default **[−9, +9]**
(F♭ … E♯), which covers the modal roots of all diatonic keys up to 6 sharps/6
flats (e.g. C♭ lydian, A♯ phrygian). Roots may be **weighted toward the center**
[param] so common keys appear more often. Any (pattern × root) yields valid
spellings automatically, including double accidentals (C♭ min7 → C♭ E𝄫 G♭ B𝄫).

**Root × pattern validity rule [default]:** a (root, pattern) pair is only used
if **every** resulting note stays within **[E𝄫 (−12) … C𝄪 (+12)]** on the note
line — i.e. no sequence note is pushed flatter than E𝄫 or sharper than C𝄪. This
dynamically narrows the usable roots per pattern (patterns that reach far in one
direction admit fewer extreme roots), and it defines the outer bound for decoy
fill (§4).

## 4. Puzzle generation

1. **Choose pattern** from the bank (difficulty-weighted [param]).
2. **Choose root** from the root pool (center-weighted [param]).
3. **Compute solution notes** = `root + interval` for each token.
4. **Build the empty grid shape _first_ [default]:** grow an irregular connected
   blob to the target cell count [param] by attaching cells to the shape.
   **Shape-quality rules [default]:** growth favors cells adjacent to
   **multiple** existing cells (→ compact, blob-like, not straggly); constrain
   the aspect ratio of the **rotated on-screen footprint** [param] (see §7 — the
   grid is displayed at 45°) so it fits phone portrait; and **avoid fully
   enclosed empty holes**.
   > Building the shape *before* the path is deliberate: growing the shape
   > *around* a pre-placed path would bias the solution toward the shape's
   > center, partly re-leaking the root. Shape-first keeps placement unbiased.
5. **Lay the solution path _inside_ the shape:** find a random self-avoiding
   **orthogonal** path of length = sequence length within the blob (randomized
   DFS from a random start cell). If no path of that length exists (rare for a
   compact blob), retry from another start or regrow the shape.
6. **Place solution notes** on the path cells in order.
7. **Fill decoy cells — [F7]:**
   a. Let `S` = solution note set, spanning `[minS, maxS]` on the line of fifths.
   b. Window width `W = max(W_param, span(S))`.
   c. Valid window left-edges `L ∈ [maxS − W + 1, minS]`; **pick `L` uniformly at
      random** (non-centered placement falls out of this).
   d. **Shift inward** if `[L, L+W−1]` extends past the plausible outer bounds
      `[B_min, B_max] = [−12, +12]` (E𝄫 … C𝄪) — the same bound as the root×pattern
      rule (§3) — so decoys never fall in double-accidental zones that could
      never occur naturally.
   e. Sample each decoy note from the window's fifths integers [param weighting];
      **repeats allowed [B7]**.
8. **Solvability [F6]:** the embedded path guarantees ≥1 solution. **No** second-
   solution detection; the player wins on *any* valid path.

## 5. Interaction & rules

- **Adjacency [F4]:** orthogonal only (↑↓←→). Cell neighbors are only existing
  cells [C9].
- **Path rule:** each cell used **at most once** — this alone prevents any
  self-crossing under orthogonal movement [C2/C3].
- **Input [F5]:** tap cells in order. Tapping the **last-selected** cell
  backtracks one step; a **Clear** control resets the whole selection [C5].
  Selecting a non-adjacent cell is rejected (with a subtle nudge) [default].
- **Submission [F5]:** **auto-check** the moment the path length equals the
  sequence length — no submit button.
- **Correct:** solve animation + audio playback + fade to next puzzle
  (Section 7); increment the session counter.
- **Wrong [C7, default]:** gentle shake + the selection fades away; no penalty,
  no score, retry freely (zen). Tapped notes still sounded (below).
- **Skip [F5]:** a **New puzzle** control regenerates without solving (does not
  increment the counter).

## 6. Audio — [F8]

Web Audio API, synthesized (no samples).

- **Tap [E6]:** tapping *any* cell plays that note's pitch — during solving,
  including decoys and wrong taps.
- **Voice [E1, param]:** simple oscillator (sine/triangle [default: triangle])
  with a soft attack + short decay envelope (~0.5–0.7 s).
- **Tuning [E2]:** 12-tone equal temperament, A440. (Enharmonics sound identical
  — C♯ = D♭ in ET; only the *spelling* differs, which is the whole point.)
- **Octave [E3]:** every note sounds in a **single fixed reference octave**
  [param] (comfortable mid-range), mapping fifths → pitch class → frequency.
- **Solve playback [E4]:** play the solution notes **ascending in pitch**, spaced
  by a gap [param], then optionally strike the full chord together [param bool].
- **Mute [E5]:** a persistent mute toggle (localStorage).

## 7. Visuals & UX — [F1 = v1 look]

- **Aesthetic [R5]:** dark background, **neon purple** grid; calm, no timer.
- **Layout:** top bar (difficulty label + **solved-this-session counter**);
  center (the grid); bottom (the interval tokens, e.g. `R – m3 – P5 – m7`).
- **45° grid orientation [default]:** the grid is displayed **rotated 45°** (a
  diamond lattice), matching the mockup. Grid *logic* stays in plain integer
  `(col, row)` space with orthogonal adjacency; the rotation is a **render-time
  transform** only. The note glyphs themselves stay upright (counter-rotated) for
  legibility.
  - **Fit logic [default]:** because a 45° rotation makes the on-screen footprint
    the shape's *diagonal* extent, screen-fit (the aspect cap in §4 and
    scale-to-fit) is computed on the **rotated footprint**, not the raw
    `(col,row)` bounding box, then uniformly scaled to fit the viewport with
    padding.
- **Render approach [H2, leaning]:** DOM cells positioned on the coordinate grid,
  with an SVG overlay drawing the connecting path line. (Final call in the Design
  Doc, Step 4.)
- **Solve animation [F1, default]:** the path line glows/pulses, then the grid
  fades out [param] and the next fades in [param]. Particles deferred to v2.
- **Responsive [H1]:** phone portrait is primary; scales up on desktop; grid
  stays centered; tap targets ≥ 44 px.
- **Entry [H5]:** drop straight into a puzzle (no menu wall); minimal title touch
  only.
- **Settings [H4]:** a small corner control for mute (and difficulty once tiers
  exist).
- **Accessibility [H6]:** honor `prefers-reduced-motion` (shorten/skip
  animations); ensure neon-on-dark contrast; cells carry their note name as text
  (screen-reader friendly).

## 8. Difficulty — [F1]

v1 ships **one preset** ("Medium" [default]), but every difficulty-sensitive
value is a **parameter**, so adding tiers later is just new parameter sets
(no code change) [D2]. Parameters that a tier would set: grid cell count, pattern
subset & weighting, root-pool width & weighting, decoy-window width.

## 9. Persistence & platform

- **Session counter [R4]:** in-memory, **resets on reload** (it's per-session).
- **Settings:** mute (and later difficulty) persisted via **localStorage** [H3].
- **Offline [H7]:** fully static; works offline once loaded. Hostable on GitHub
  Pages.

## 10. Scope

**In v1:** everything above — visual mode, one preset, tap input, chord bank,
root-position, orthogonal grid, tap+solve audio, session counter, skip.

**Deferred to v2+ [F1]:** audio-only mode; off-root / rootless voicings; diagonal
adjacency; multiple difficulty tiers & selector; hints; drag-to-trace input;
particle effects; scales in the bank; streaks / personal-best scoring.

**Non-goals [I2]:** accounts, networking, monetization, teaching theory from
scratch.

## 11. Tunable parameters (starting values — tune in Step 6)

| Param | Meaning | Start |
|-------|---------|-------|
| `gridCellCount` | total cells in the grid | 18 |
| `gridMaxAspect` | aspect-ratio cap on the **rotated** on-screen footprint (portrait-friendly) | ~1.4 |
| `growthCompactness` | bias toward cells with more existing neighbors | mild–strong |
| `patternWeights` | relative frequency of each bank pattern | uniform |
| `rootPool` | allowed root range (fifths) | [−9, +9] |
| `rootCenterBias` | weighting toward central (common) roots | mild |
| `decoyWindowWidth` (`W`) | width of the fifths window decoys sample from | 15 |
| `plausibleBounds` | outer note-fifths clamp for decoys | [−12, +12] (E𝄫 … C𝄪) |
| `voice` | oscillator type | triangle |
| `attack` / `decay` | note envelope | 0.02 s / 0.6 s |
| `tapOctave` | fixed reference octave for playback | ~C4 band |
| `playbackGap` | gap between notes in solve playback | 180 ms |
| `playChordAtEnd` | strike full chord after arpeggio | true |
| `fadeOutMs` / `fadeInMs` | puzzle transition | 350 / 350 |
| `solveAnimMs` | solve highlight duration | 700 |

## 12. Still deferred to the Design Doc (Step 4)

Implementation-level choices: exact render tech (DOM+SVG vs canvas), module
structure, the polyomino-growth algorithm's specifics, and the note-naming
function's implementation.
