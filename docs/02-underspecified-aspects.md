# ToneSearch — Underspecified Aspects Doc

> **Status:** Draft · Step 2 of 5. Purpose: **enumerate** every ambiguity, not
> resolve it. Resolutions happen in the Full Specification Doc (Step 3). Items
> have stable IDs (e.g. `A3`) so we can refer to them precisely.
> ⚑ = high-leverage (shapes the data model or scope; resolve early).

## Already resolved (foundation — do not relitigate)

From [Music Theory Doc](00-music-theory.md) and [Initial Idea Doc](01-initial-idea.md):

- **R1.** Pitch = line of fifths; octaveless; unbounded integer; enharmonics distinct.
- **R2.** Interval tokens measured **from the root** (chord tones).
- **R3.** Note spelling **must match** interval spelling (falls out of R1).
- **R4.** Endless random generator; a **solved-this-session counter** up top.
- **R5.** Neon aesthetic (dark bg, neon purple grid); **zen — no timer**.
- **R6.** Tapping a note plays its pitch; a correct solve plays the sequence back.
- **R7.** Audience = the designer; **no in-game theory teaching** required.
- **R8.** Note & interval share one unbounded type; naming is algorithmic; no
  interval is prohibited by the type; in-play range is emergent; decoy-fill
  window must not be centered on the answer (anti-cheat).

---

## A. Sequence generation & content

- **A1. ⚑ Where do sequences come from?** A curated **bank** of named
  chords/patterns, a procedural generator, or arbitrary interval sets? (Designer
  leans chords, unsure about arbitrary.)
- **A2. Which chord families are in scope?** Triads, 7ths, extensions (9/11/13,
  #9…), sus, altered? Scales too, or chords only?
- **A3. ⚑ Voicings.** Can a sequence *start* on a non-root tone (e.g. begin on
  the P5)? If so, do the tokens **relabel** (start reading `P5 …`) or **stay
  rooted**? Are **rootless** voicings (no R token) allowed?
- **A4. Sequence length.** Range, and how it scales with difficulty.
- **A5. Ordering.** The sequence is an **ordered** list and the path must visit
  notes in that exact order — confirm (assumed yes).
- **A6. Duplicates.** Can a sequence yield two identical notes (e.g. octave
  doubling → same fifths value)? Presumably disallowed since octaveless.
- **A7. Viable roots.** Which roots are allowed for a given sequence? (Designer's
  framing: diatonic keys up to 6 sharps/flats are fair game → their modal roots
  are fair game.) How is the (sequence × root) pool defined?

## B. Grid generation

- **B1. Grid shape.** The grid is an irregular connected shape. How is it
  generated (bounding box + mask? random polyomino? fixed silhouettes)?
- **B2. Grid size** per difficulty (cell count / bounding dimensions).
- **B3. Answer placement.** How/where the solution path is laid into the grid.
- **B4. ⚑ Decoy fill.** How non-answer cells get their notes: a window *near* the
  answer, **deliberately off-center** (R8 anti-cheat). Exact policy TBD.
- **B5. ⚑ Solvability & uniqueness.** Must every puzzle have **≥1** solution
  (surely yes). **Exactly one**, or may multiple valid paths exist? Does the
  player need to find one, or a specific one?
- **B6. Decoy near-misses.** Are partial/near-solution traps desirable and
  controlled, or incidental?
- **B7. Repeated note names** in the grid allowed? (Mockup shows yes.)
- **B8. Accidental alternate solutions.** Filler notes could create an unintended
  second solution. Detect & regenerate, or allow?

## C. Path & interaction

- **C1. ⚑ Adjacency.** Orthogonal only, or diagonal too?
- **C2. Self-crossing.** Forbidden — but only meaningful if diagonal is allowed
  (C1). Define precisely if so.
- **C3. Revisiting** a cell within one path — disallowed (confirm).
- **C4. ⚑ Input modality.** Tap-each-cell, drag a line, or both?
- **C5. Correction mid-entry.** Undo last, backtrack, clear, deselect?
- **C6. Submission.** Auto-check when the path reaches sequence length, or an
  explicit submit action?
- **C7. Wrong-answer feedback.** What happens (shake, dim, sound, nothing)?
- **C8. Path length** must equal sequence length exactly (confirm).
- **C9. Adjacency at irregular edges** — neighbors are only existing cells
  (confirm; trivial but worth stating).

## D. Difficulty

- **D1. Tiers.** How many, and their names (mockup shows "Medium").
- **D2. Parameters per tier.** Concretely: grid size, sequence length, interval
  set, voicing options (A3), enharmonic/double-accidental complexity.
- **D3. Selection.** Player-chosen, auto-progressing, or both?
- **D4. Mid-session change** allowed?

## E. Audio

- **E1. Synthesis.** Waveform/instrument; envelope (ADSR); duration.
- **E2. Tuning.** Equal temperament / A440 assumed (note: in ET, enharmonics
  sound identical — C♯ and D♭ are the same pitch). Confirm.
- **E3. ⚑ Octave mapping.** A fifths integer has no octave; sounding it needs a
  register. Fixed octave? Map by pitch class into a chosen octave? Keep melodic
  contour of the sequence?
- **E4. Solve playback.** Order (as-pathed? re-sorted low→high?), tempo/timing,
  and whether it ends on a simultaneous chord.
- **E5. Volume / mute** control.
- **E6. Tap sound.** Tapping any cell plays its pitch even mid-solve — confirm,
  and whether wrong taps still sound.

## F. Solve experience & meta

- **F1. Correct-solve animation.** Line highlight / glow / particles — what?
- **F2. Transition.** Fade-out/fade-in timing to the next puzzle.
- **F3. Scoring.** Beyond the session counter — streaks, totals, personal best?
- **F4. Hints / reveal** option? Or pure no-help?
- **F5. Skip / new puzzle** control (give up)?

## G. Modes

- **G1. Audio-only mode** — v1 or later?
- **G2. Reveal mechanism.** How the played sequence is presented (replay button;
  how many replays allowed).
- **G3. Interaction with difficulty/scoring** — separate track, or a toggle?

## H. Platform / UX / persistence

- **H1. Responsive layout.** Portrait phone + desktop; orientation handling.
- **H2. Render tech.** DOM vs SVG vs canvas for the grid (may defer to Design Doc).
- **H3. Persistence.** Session counter across reloads? Persist settings
  (difficulty, mute) via localStorage?
- **H4. Settings UI.** Where difficulty / mute / mode toggle live.
- **H5. Entry flow.** Start screen / menu, or drop straight into a puzzle?
- **H6. Accessibility.** Purple-on-dark contrast, reduced-motion for animations,
  screen-reader labels (note names are text — an advantage).
- **H7. Offline.** Static page works offline once loaded (confirm as a goal).

## I. Scope / phasing

- **I1. ⚑ MVP definition.** What's in v1 vs later? (Candidate deferrals:
  audio-only mode, extended voicings, many difficulty tiers, fancy animations.)
- **I2. Non-goals.** Anything explicitly out of scope to state up front?
