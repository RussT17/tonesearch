# ToneSearch — Pattern Naming Conventions

> **Status:** ✅ Implemented (2026-08-29). Codifies how a pattern's caption is
> built. **The rule (owner's):** count the numbers in a chord's jazz shorthand —
> **one** number → spell it out ("Minor 9th", "Dominant 7th", "Diminished 7th");
> **two or more** → keep the shorthand ("m7♭5", "6/9", "7♭9", "9sus4", "7♯9♭13").
> sus/add chords keep their idiomatic shorthand (sus2, sus4, add9). Triads and
> intervals are always spelled. Category word kept for all tiers; `qualifier`
> field adopted (e.g. "no 5", "shell", "3–7", "1st inversion", "rootless A");
> `△7/ø7/°7` deferred (§5).

## §0 — Constraints that shape naming

- **The root is hidden.** These aren't full chord symbols (no root letter) — they
  name a **quality/voicing** only: "7" = "a dominant-7 chord of unknown root".
- **Audience is one jazz-literate player** (the designer) — no hand-holding needed;
  concise jazz shorthand is legible.
- **The caption sits under the target diamonds**, small and subtle. Shorter is
  better; the diamond count already signals size (2 = interval, 3 = triad, …).
- **Font risk is real** — we already had to abandon `𝄪/𝄫` (tofu). Any symbol
  (`△ ø °`) must be verified to render before committing.

## §1 — The qualifier field (recommended)

Replace three overlapping mechanisms — the `reduced` boolean → `[reduced]`, the
voicing text baked into `display` ("Major Triad (1st inv)"), and the Expert-only
category-word suppression — with **one freeform field**:

```ts
interface Pattern { …; qualifier?: string; }   // "reduced", "1st inversion", "rootless A", "shell", "open"
```

`display` becomes the **bare** name ("Major", "Dominant 7th"/"7", "Quartal",
"Minor 9th"). Caption = `display` + category word (if kept, §3) + ` (qualifier)`.
Benefits:
- Uniform: every voicing note renders the same way — `(…)` — instead of `[reduced]`
  vs `(1st inv)` vs nothing.
- Fixes the [M4] collision cleanly: Hard's reduced-13 = "…(reduced)", the Expert
  4-note shell = "…(shell)" — distinct without a second marker type.
- No tier special-casing; the rule is the same for all tiers.

## §2 — The inconsistency, and the one axis

Today's chord names straddle two registers:
- **Spelled**: "Dominant 7th", "Major 9th", "Minor ♭6", "Half-diminished 7th".
- **Jazz symbol**: "7sus4", "6/9", "7♭9", "7♯11", "add9".

The friendly-spelled ones are easy to read but the *altered/extended* chords don't
spell cleanly ("Dominant seven sharp nine flat thirteen"). The symbolic ones are
compact but terse. **Pick one register per category and hold it.**

## §3 — Three coherent systems (same sample chords)

| pattern | A · Spelled | B · Jazz symbol | C · Symbol, no category word |
|---|---|---|---|
| dom7 | Dominant 7th **Chord** | 7 **Chord** | **7** |
| maj7 | Major 7th Chord | maj7 (or △7) Chord | maj7 / △7 |
| m7♭5 | Half-diminished 7th Chord | m7♭5 (or ø7) Chord | m7♭5 / ø7 |
| dim7 | Diminished 7th Chord | °7 Chord | °7 |
| maj9 | Major 9th Chord | maj9 Chord | maj9 |
| dom13 | Dominant 13th Chord | 13 Chord | 13 |
| 7♭9 | Dominant 7th ♭9 Chord | 7♭9 Chord | 7♭9 |
| 6/9 | Major 6/9 Chord | 6/9 Chord | 6/9 |
| 9sus4 | Dominant 9th sus4 Chord | 9sus4 Chord | 9sus4 |
| maj triad | Major **Triad** | Major Triad | Major triad |
| m3 | Minor 3rd **Interval** | Minor 3rd Interval | Minor 3rd |

Notes: in every system **intervals stay spelled** ("Minor 3rd") — they're the
pedagogical core and don't take alterations, and they mirror the token labels.
Triads stay spelled too (they read badly as symbols: "maj Triad").

## §4 — My recommendation: **System B**, category word kept

- **Chords (7th and up): jazz shorthand** — converge the spelled ones *toward*
  symbols (which the altered chords already force), so the whole chord category is
  one register: `7`, `maj7`, `m7`, `m7♭5`, `dim7`, `6`, `m6`, `9`, `maj9`, `m9`,
  `11`, `13`, `6/9`, `7♭9`, `7♯11`, `9sus4`, `add9`, `m(maj7)`, `maj7♯5`, `quartal`,
  `quintal`.
- **Triads & intervals: spelled** — "Major", "Minor 3rd", etc.
- **Category word kept for all tiers** (drops the Expert hack) — it disambiguates a
  3-note *shell* from a triad, and reads fine: "maj9 **Chord** (rootless A)",
  "Major **Triad** (1st inversion)", "Minor 3rd **Interval**".
- Why B over C: the standalone terseness of C ("7", "13") loses the "these are
  chords" cue that the category word gives for free; B keeps compactness *and* the
  cue. Why B over A: A can't spell the altered chords without getting unwieldy, so
  it never actually reaches consistency.

*(If "7 Chord" reads too terse to you, the fallback is A — fully spelled — accepting
the long altered-chord names. That's the real fork.)*

## §5 — The jazz symbols `△ ø °`

- **`△7` for maj7** is idiomatic and looks great for a jazz audience. Use **`△7`**,
  not bare `△` (which reads as a major *triad* in some notations). If adopted, be
  consistent: **`ø7`** for half-diminished, **`°7`** for diminished 7th.
- **Caveat — verify rendering first** (the `𝄪` lesson). `△` (U+25B3), `ø` (U+00F8),
  `°` (U+00B0) are common characters with far better support than the musical
  double-accidentals, so likely fine — but I'd smoke-test them in a diamond/caption
  before committing, and keep text fallbacks (`maj7`, `m7♭5`, `dim7`) ready.
- My lean: **ship System B with text (`maj7`, `m7♭5`, `dim7`) first**, then swap in
  `△7 / ø7 / °7` as a follow-up once we've eyeballed them on-device — best of both,
  no font gamble on the first pass.

## §6 — Decisions for you

1. **Register:** System **B** (jazz shorthand, my rec) or **A** (fully spelled)?
2. **Category word:** keep for all tiers (my rec), or drop it entirely (System C)?
3. **`△7 / ø7 / °7`:** adopt now, adopt after a render test (my rec), or never?
4. **Qualifier field:** approve `qualifier?: string` → `(…)`? (my rec: yes)

Once you pick, this is one focused refactor: add `qualifier`, rewrite `display`
strings to the chosen register, update `patternName`, and re-point the E/M/H bank
captions in [03 §3]. No logic changes.
