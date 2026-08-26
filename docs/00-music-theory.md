# ToneSearch — Music Theory Doc

> **Status:** Draft · foundational reference. Underpins all other docs.
> This defines how notes and intervals are represented and combined. The whole
> game engine reduces to integer arithmetic on a **line of fifths**.

## Core idea: the line of fifths

Both **notes** and **intervals** are represented as **integers** on a line of
fifths (each step = one perfect fifth up; a fourth is a negative fifth). This
representation is **octaveless** (no octave number) and treats **enharmonic
spellings as distinct** (C and B♯ are different integers, never merged).

The single operation that drives the game:

> **`target_note = root_note + interval`**  (add their fifths values)
>
> and conversely **`interval = note_b − note_a`**.

## Notes as fifths (centered on D = 0)

Ascending = sharp direction (+1 per fifth). Descending = flat direction.

| Note | Fifths | | Note | Fifths |
|------|:---:|---|------|:---:|
| B♯ | +10 | | G   |  −1 |
| E♯ |  +9 | | C   |  −2 |
| A♯ |  +8 | | F   |  −3 |
| D♯ |  +7 | | B♭  |  −4 |
| G♯ |  +6 | | E♭  |  −5 |
| C♯ |  +5 | | A♭  |  −6 |
| F♯ |  +4 | | D♭  |  −7 |
| B  |  +3 | | G♭  |  −8 |
| E  |  +2 | | C♭  |  −9 |
| A  |  +1 | | F♭  | −10 |
| **D** | **0** | | | |

**Accidental rule (extends the line infinitely):**
- Adding a **♯** = **+7** fifths; adding a **♭** = **−7** fifths.
- So double sharps/flats are just further out: F𝄪 = +11, D𝄫 = −14, etc.

## Intervals as fifths (from the root, R = 0)

Measured **from the root** (chord-tone labeling — see [Initial Idea Doc](01-initial-idea.md)),
on the *same* line.

| Interval | Fifths | | Interval | Fifths |
|----------|:---:|---|----------|:---:|
| aug2 | +9 | | P4  | −1 |
| aug5 | +8 | | m7  | −2 |
| augR | +7 | | m3  | −3 |
| aug4 | +6 | | m6  | −4 |
| M7   | +5 | | m2  | −5 |
| M3   | +4 | | dim5 | −6 |
| M6   | +3 | | dimR | −7 |
| M2   | +2 | | dim4 | −8 |
| P5   | +1 | | dim7 | −9 |
| **R** | **0** | | | |

Symmetric about R: the sharp/wide side runs P5→aug2, the flat/narrow side runs
P4→dim7. Quality shifts by ±7: e.g. m3 (−3) +7 = M3 (+4) +7 = aug3-ish, etc.

## Derived quantities (for audio & enharmonic checks only)

The **game logic uses fifths integers directly** — the following are needed only
for *sounding* a note or testing enharmonic equivalence.

- **Pitch class** (0–11, C = 0): `pc = (7 · fifths + 2) mod 12`.
  - e.g. C(−2)→0, G(−1)→7, A(+1)→9. ✓
- **Semitones above root** for an interval: `(7 · interval_fifths) mod 12`.
  - e.g. m3(−3)→3, P5(+1)→7, m7(−2)→10. ✓
- **Enharmonic equivalence:** two notes are enharmonic ⇔ their fifths values
  differ by a multiple of **12** (12 fifths = 7 octaves = same pitch class in
  equal temperament). e.g. C(−2) and B♯(+10) differ by 12. ✓
  **The game never reduces mod 12**, which is exactly why spelling matters.

## Worked example (the mockup's sequence)

Target `R – m3 – P5 – m7` (a minor-7 chord), tried on root **A** (= +1):

| Token | Interval fifths | Root + interval | Note |
|-------|:---:|:---:|:---:|
| R   |  0 | +1 + 0  | +1 = **A** |
| m3  | −3 | +1 + −3 | −2 = **C** |
| P5  | +1 | +1 + +1 | +2 = **E** |
| m7  | −2 | +1 + −2 | −1 = **G** |

→ A, C, E, G. ✓

## Range & naming — emergent, not fixed

**The note/interval type is an unbounded integer.** There is no hard-coded
min/max on the line of fifths. Double (and further) accidentals arise naturally
and must be supported. Two real cases that force them:

- **C♭ lydian → minor chord.** Root C♭ (−9); `R m3 P5` → C♭, **E𝄫** (−12), G♭ (−8).
- **A♯ phrygian → major chord.** Root A♯ (+8); `R M3 P5` → A♯, **C𝄪** (+12), E♯ (+9).

**Naming is algorithmic, not a lookup table.** Any integer yields a correct
spelling: the generic number comes from the fifths value's position in the
repeating 7-step pattern (…4th · unison · 5th · 2nd · 6th · 3rd · 7th…), and the
quality comes from which ±7 "band" it sits in (…dim · minor · Perfect/Major ·
aug · double-aug…). The 21 notes and 19 intervals tabled above are the common
**core for reference only** — the type is not limited to them, and we add **no
logic to prohibit** any interval (augR, dimR, dim4, …). Which intervals actually
appear is decided entirely by the interval-sequence bank (a later doc), not by
the type.

**The in-play note range is therefore _emergent_,** falling out of
(sequence bank) × (viable roots), plus grid-fill logic that draws the non-answer
"decoy" notes from a window *near* the answer.

> ⚠️ **Anti-cheat constraint:** that decoy window must **not always be centered
> on the answer**, or the center of the grid would leak the root. (Full
> grid-generation rules live in the spec docs.)

## Not answered by this doc (design decisions, tracked elsewhere)

- **Audio octave mapping:** a fifths integer has no octave; sounding it requires
  choosing an octave/register (and how the solved sequence is played back).
- **Voicing labeling:** if a puzzle's path may *start* on a non-root chord tone
  (e.g. the P5), do the interval tokens get relabeled, or stay rooted? This is a
  gameplay decision, not a theory one.
