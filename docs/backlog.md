# ToneSearch — Backlog / Future Ideas

> A running parking-lot for things we've **consciously deferred** or want to
> revisit. Not version-scoped and not a commitment — just so nothing gets lost.
> Distinct from the parameters table in the [Full Spec](03-full-spec.md) §11,
> which is for *tuning* values we _will_ dial in during playtest.
> Add freely as ideas surface, at any step.

## Deferred features (from Full Spec §10)

- **Audio-only mode** — play the note sequence; player finds it by ear.
- **Voicings** — off-root starts (begin on P5/m3) and rootless voicings.
  (Data model reserves a `startOffset` / `rootless` flag for this.)
- **Diagonal adjacency** — as an added movement option / difficulty spice.
- **Difficulty tiers & selector** — v1 ships one "Medium" preset; the parameter
  system is built to support tiers as pure data.
- **Drag-to-trace input** — alternative to tap-to-select (decide in playtest).
- **Hints / reveal** option.
- **Particle / richer solve effects** — v1 keeps a simple glow + fade.
- **Streaks / personal-best / totals** — v1 has only the session counter.

## Chord/scale bank additions (from Full Spec §3)

- **Scales** as sequences (not just chords). **Held** (2026-08-28) for two
  reasons to solve first: (1) a 7-note sequence would force the target diamonds
  to shrink; (2) unclear solve behavior — playing a whole scale as a simultaneous
  chord sounds bad.
- **Natural-11 dominant** (→ really a 9sus4).
- **Extended half-diminished** chords (need >4 notes to keep defining tones).
- **6/9 chords.**
- **5+ note voicings** — full extended chords without the shell reduction.
- **min-major7** and other altered-fifth colors (7♯5, 7♭5, etc.).

## Possible mechanics / variations (unfiltered)

- Daily puzzle / shareable seed.
- Explicit "key mode" that fixes the root and trains just note↔interval naming.
- Show/teach mode (currently a non-goal — audience is the designer).

## Tuning to settle in playtest (Step 6)

Pointer only — details live in Full Spec §11: grid size, root-pool width &
weighting, decoy-window width, audio voice/envelope, playback timing, transition
/ animation timing.
