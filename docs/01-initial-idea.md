# ToneSearch — Initial Idea Doc

> **Status:** Draft · Step 1 of 5 (Initial Idea).
> Purpose: capture the idea *as it lives in the designer's head* — raw, possibly
> incomplete. Gaps are **not** resolved here; they get enumerated in the
> Underspecified Aspects Doc (Step 2). Working title "ToneSearch" is taken from
> the repo name and is not final.

## One-line concept

A puzzle game that trains the player to connect **note names** (C, E♭, F♯…) with
**intervals** (R, m3, P5, m7…) *at the same time*, by hunting for a given
interval sequence as a connected path through a grid of notes — **without being
told the root**.

## Learning goal

Help the player think in note names and scale/chord-relative intervals
*simultaneously*, building the mental muscle of recognizing an interval "shape"
regardless of key.

## Audience

For now, **the designer themselves** — a personal practice tool. No in-game
education / theory teaching required; the game can assume the player already
knows the theory.

## Look & feel

- **Neon music-app** aesthetic: dark background, **neon purple** grid.
- **Zen** — calm, **no timer, no time pressure.**

## Sound

- Tapping a note **plays that note's pitch.**
- On a correct solve, the game **plays the solved sequence back** (a satisfying
  musical payoff).
- (Details of waveform/instrument/tuning: TBD.)

## Session shape

- **Endless / random generator** — not a fixed campaign of authored levels.
- A **counter up top** tracks how many puzzles solved this session.
- (Difficulty still has discrete "levels" as a *setting* — see below — even
  though puzzles are endless.)

## Screen layout (from the mockup)

- **Top bar:** Difficulty (e.g. "Medium") and a solved-this-session counter.
- **Center:** a randomly / procedurally generated grid of note-name cells. The
  grid is an **irregular connected shape**, not necessarily a full rectangle.
- **Bottom:** the target **interval sequence**, shown as circled tokens —
  e.g. `R – m3 – P5 – m7`.

## Core mechanic

1. The player is given an interval sequence (bottom of screen).
2. They must find a **path** through the grid whose notes realize that sequence
   relative to *some* root.
   - The **root is not given.** The player mentally tries different starting
     notes until the whole sequence fits.
3. Path rules:
   - Consecutive notes in the path must occupy **adjacent** grid cells.
   - **Adjacency is undecided:** orthogonal only, or also diagonal?
   - The path **must not cross itself** (moot if diagonal moves aren't allowed).
4. Input: the player **taps** each cell in order, or **drags** a line through
   them. (tap vs drag: undecided)

### On a correct solve

Satisfying **animation** + **playback of the solved sequence**, then a **fade
out / fade in** into the next generated puzzle.

### Worked example

The sequence `R – m3 – P5 – m7` is a minor-7 chord. It can be satisfied by many
paths, each implying a different root:

| Path | Implied root |
|------|--------------|
| C → E♭ → G → B♭ | C |
| A → C → E → G | A |
| D → F → A → C | D |

The same interval sequence having many valid roots is the **source of the
difficulty**: the player scans the grid for the interval *pattern*, not a fixed
set of notes.

## Enharmonic rule (a real rule, not just an open question)

**Note spelling must match the interval's spelling.** Enharmonic equivalents are
*not* interchangeable.

- Example: `R – dim5` from C is satisfied by **C, G♭** (a diminished fifth), but
  **not** by **C, F♯** — that spelling would be `R – aug4`, even though G♭ and F♯
  are the same pitch.

> The designer will provide a **Music Theory Doc** defining intervals and their
> spellings precisely; this rule flows from it.

## Interval vocabulary (examples given)

R, m3, P5, m7, dim7, aug5, M6, … (full set defined in the forthcoming Music
Theory Doc).

## Difficulty

Discrete difficulty levels control:

- **Complexity** of the interval sequences,
- **Length** of the sequences,
- **Size** of the grid.

## Open design directions (undecided — captured for Step 2)

- **Sequence content:** always sensible **chords**, or possibly more **arbitrary**
  interval sequences?
- **Voicings (if chords):**
  - Allow sequences that **don't start on the root** (e.g. begin on the P5 or m3)?
  - Allow **rootless voicings** (the root interval absent entirely)?
- **Adjacency:** orthogonal vs diagonal.
- **Input:** tap vs drag.
- **Non-self-crossing rule** (tied to the adjacency choice).

## Stretch idea

- **Audio-only mode:** instead of showing the interval tokens, the game **plays
  the sequence of notes**, and the player must find it in the grid **purely by
  ear.**

## Reference

- Example mockup: hand-drawn card — "Difficulty: Medium / Level: 1", an
  irregular grid of ~20+ note cells, target sequence `R – m3 – P5 – m7`. Photo
  retained by the designer; the exact grid can be transcribed later as a
  concrete test fixture if useful.
