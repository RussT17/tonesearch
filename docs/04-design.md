# ToneSearch — Design Doc (implementation plan)

> **Status:** Draft · Step 4 of 5. *How* we build the v1 specified in the
> [Full Spec](03-full-spec.md). Review target: you approve this (Step 5), then I
> implement. References spec sections as `[§n]`.

## 0. Key decisions (flag for veto)

- **Toolchain:** Vite + TypeScript + Vitest. Node via `brew install node`
  (Homebrew present; no password needed).
- **Deploy:** a GitHub Action builds on push and publishes to Pages (replaces the
  current "deploy from branch" hello-world). Vite `base: '/tonesearch/'` for
  correct asset URLs on project Pages.
- **Architecture:** a **pure core** (no DOM/audio — fully unit-tested) behind a
  thin **shell** (DOM render, Web Audio, input). This is the single most
  important structural choice: all the subtle music/generation logic lives where
  it can be tested headlessly.
- **Determinism:** all randomness flows through one injectable seedable RNG, so
  tests are reproducible (and daily-seed puzzles become trivial later).

## 1. Module map

```
src/
  theory.ts    PURE  line-of-fifths: naming, arithmetic, pitch/frequency
  geometry.ts  PURE  latticeToScreen(col,row) + footprint(cells) — the 45° math
  bank.ts      PURE  the 26 patterns [§3] as data
  rng.ts       PURE  seedable PRNG (mulberry32) + helpers (pick, weighted)
  generate.ts  PURE  puzzle generation [§4]: blob → path → decoys
  config.ts    PURE  the tunable parameters [§11] in one typed object
  audio.ts     shell Web Audio synth: tap tones, solve playback, mute [§6]
  render.ts    shell DOM cells + SVG path overlay, 45° transform, fit [§7]
  input.ts     shell tap/backtrack/auto-check selection state machine [§5]
  game.ts      shell orchestrator: state, solve flow, transitions, counter
  main.ts      shell bootstrap; mounts game into index.html
  style.css          neon theme tokens, layout, responsive
  tests/
    theory.test.ts     naming round-trips, arithmetic, enharmonics
    generate.test.ts   generation invariants over many seeds
```

Dependency direction: `game → {generate, render, audio, input}`; everything pure
depends only on `theory`/`geometry`/`rng`/`config`. **`geometry.ts` is pure and
shared** by `generate.ts` (aspect cap on the rotated footprint) and `render.ts`
(scale-to-fit) — so the two never compute "footprint" differently, and neither
pure module imports from the shell. Shell never leaks into the pure core.

## 2. Core types

```ts
type Fifths = number;                    // signed integer on the line of fifths
interface Pattern { name: string; intervals: Fifths[]; }   // from root [§R2]
interface Cell { id: number; col: number; row: number; note: Fifths; }
interface Puzzle {
  pattern: Pattern;
  root: Fifths;
  solutionNotes: Fifths[];   // root + intervals
  cells: Cell[];             // whole grid
  solutionPath: number[];    // cell ids, in token order
}
type Phase = 'playing' | 'solved' | 'transitioning';
interface GameState {
  puzzle: Puzzle; selection: number[];   // cell ids chosen so far
  solvedThisSession: number; muted: boolean; phase: Phase;
}
```

## 3. `theory.ts` — the whole engine is integer math [§2]

**Note naming** (D = 0; letters run in fifths order; ♯ = +7, ♭ = −7):

```ts
const LETTERS = ['F','C','G','D','A','E','B'];        // index 3 = D = fifths 0
function noteName(f: Fifths): string {
  const letter = LETTERS[((f + 3) % 7 + 7) % 7];
  const k = Math.floor((f + 3) / 7);                  // 0 natural, + sharps, − flats
  return letter + accidental(k);                      // '', '♯', '♭', '𝄪', '𝄫', …
}
```

**Interval naming** (R = 0; same line, from root):

```ts
const NUMS = [4,1,5,2,6,3,7];               // by ((f+1) mod 7)
const PERFECT = new Set([1,4,5]);
function intervalName(f: Fifths): string {
  const n = NUMS[((f + 1) % 7 + 7) % 7];
  const k = Math.floor((f + 1) / 7);          // 0 = Perfect/Major band
  if (n === 1 && f === 0) return 'R';
  const q = PERFECT.has(n)
    ? (k === 0 ? 'P' : k > 0 ? dup('aug',k) : dup('dim',-k))
    : (k === 0 ? 'M' : k > 0 ? dup('aug',k) : k === -1 ? 'm' : dup('dim',-k-1));
  return n === 1 ? q + 'R' : q + n;           // augR / dimR for unison
}
```

Helpers (degrade gracefully past ±2 accidentals, though the in-play clamp
`[−12,+12]` never exceeds double accidentals):

```ts
const dup = (s: string, k: number) => s.repeat(k);          // 'aug'→'augaug' for k≥2
// doubled ♯/♭ (e.g. "♯♯"), NOT 𝄪/𝄫 Unicode — poor font support (see §11)
const accidental = (k: number): string =>
  k === 0 ? '' : (k > 0 ? '♯' : '♭').repeat(Math.abs(k));
```

Verified against the Music Theory Doc tables (R, P5, M2…dim7 and note F♭…B♯), and
by the design reviewer's independent hand-execution across the double-accidental
edges (E𝄫, C𝄪, augR, dimR, dim7).

**Arithmetic & audio helpers:**

```ts
const noteFor = (root: Fifths, iv: Fifths) => root + iv;   // the one operation [§2]
const pitchClass = (f: Fifths) => ((7*f + 2) % 12 + 12) % 12;              // C=0
const frequency = (f: Fifths, base = 60) =>                // single fixed octave [§6]
  440 * 2 ** ((base + pitchClass(f) - 69) / 12);
```

Enharmonic test (for tests only): `pitchClass(a) === pitchClass(b)` ⇔ same sound.

## 4. `generate.ts` — shape-first [§4]

```
generatePuzzle(cfg, rng):
  1. pattern = weightedPick(bank, cfg.patternWeights, rng)
  2. root    = weightedPick(validRoots(pattern, cfg), centerBias, rng)
       validRoots = { r ∈ cfg.rootPool : ∀ iv∈pattern, −12 ≤ r+iv ≤ +12 }   [§3 rule]
  3. notes   = pattern.intervals.map(iv => root + iv)
  4. shape   = growBlob(cfg.gridCellCount, cfg, rng)      // EMPTY cells first
  5. path    = findPath(shape, pattern.intervals.length, rng)   // random self-avoiding
  6. assign notes → path cells (in order); everything else → decoys (step 7)
  7. decoys  = fillDecoys(notes, cfg, rng)
  → Puzzle
```

- **`growBlob` (3×3-block accretion)**: inside a bounded start grid
  (`startGridW × startGridH` [param]), select the in-bounds 3×3 block around a
  random seed; then while `selected < gridCellCount`, pick a random frontier cell
  (unselected, adjacent to the selection) and select the in-bounds 3×3 block
  around it. 3×3 blocks make the shape inherently compact/rounded, so no
  neighbor-weight heuristic is needed; **naturally occurring holes are allowed**
  (no fill pass). Count is met-or-slightly-exceeded (≤ +8), so `gridCellCount` is
  an **approximate** target. Assert `startGridW·startGridH ≥
  gridCellCount + margin`. The `geometry.footprint` aspect cap is a cheap guard
  (rarely trips); restart on the rare aspect failure. (Generation failure, such as
  it is, concentrates here — not in `findPath`.)
- **`findPath`**: randomized DFS from a random start, orthogonal, self-avoiding,
  return the first path of exactly `len`. For `len` 3–4 in an 18-cell compact blob
  a path essentially always exists and is found immediately; the retry/regrow is a
  cheap guard, not a hot path. (Guarantees the ≥1 solution [§F6].)
- **`fillDecoys`** [§F7]: `W = max(cfg.decoyWindowWidth, (maxNote−minNote)+1)` as a
  **position count** (invariant `decoyWindowWidth ≥ maxPatternSpan+1`, asserted);
  pick left edge `L` uniformly among placements containing `notes`; clamp into
  `[−12,+12]`, **randomizing which side absorbs the clamp** near a bound to keep
  offset freedom; sample each decoy from the window (repeats ok).

## 5. `render.ts` — the 45° diamond grid [§7]

Grid logic stays in integer `(col,row)`; the 45° math lives in the shared pure
`geometry.ts` and is presentation-only:

```ts
// geometry.ts — single source of truth, imported by generate.ts AND render.ts
latticeToScreen = (col, row) => ({ x: (col - row) * s, y: (col + row) * s });
// footprint(cells): min/max of screen x,y, INFLATED by half a cell's rotated
// extent (a diamond's half-diagonal = s) so edge cells don't clip.
```

- **Cells are true diamonds:** each cell is a `<div>` rotated 45° with its glyph
  counter-rotated −45° to stay upright. For edge-touching diamonds, **cell
  diagonal = 2·`s`** (larger `s` gaps neighbors, smaller overlaps them).
- **Fit:** `scale = min(vw/fw, vh/fh) · padding` over the *inflated* footprint,
  then center — the rotated (diagonal) extent, which is why the aspect cap (§4)
  lives on it, not on raw `(col,row)`.
- **Structure:** one absolutely-positioned diamond `<div>` per cell (easy taps,
  transitions, note name as text); a single SVG overlay draws the path line
  between selected cell centers (the angular woven look).
- **Theme:** CSS custom properties for the neon palette; dark bg, neon-purple
  cells; honor `prefers-reduced-motion` [§H6].

## 6. `audio.ts` [§6]

One lazily-created `AudioContext`, resumed on first user gesture (the iOS/Safari
unlock we already proved out in hello-world). Each note = oscillator
(`cfg.voice`) → gain envelope (`attack`/`decay`) → destination, at
`frequency(note)`. Solve playback schedules the tones with the **root on the
bottom** (octave-wrap the rest above it, then ascending) spaced by `playbackGap`,
optional final chord. `muted` gates output and persists to `localStorage`.

## 7. `input.ts` + `game.ts` [§5]

- **input**: a small state machine over `selection`. Tap an unselected cell that
  is orthogonally adjacent to the last selected → append (and sound it). Tap an
  **already-selected** cell at index `i` → **truncate** to `selection.slice(0, i)`
  (drop it and everything after — rewinding along the path; tapping the last cell
  is the pop-one special case). Tap elsewhere → reject with a nudge. A **Clear**
  control empties the selection.
- **auto-check** [§F5, §F6]: when `selection.length === solutionNotes.length`,
  check **root-agnostically** — `sel[i].note − sel[0].note === pattern.intervals[i]`
  for all i (accepts *any* root per [§F6]; the general `intervals[i]−intervals[0]`
  form also survives v2 off-root voicings). **Not** a compare to the generator's
  absolute `solutionNotes`.
- **game**: holds `GameState`; on correct → glow + `audio.playSequence` → fade
  out/in → `generatePuzzle` → increment counter; on wrong → shake + **pop the last
  tap** (keep the correct prefix). A **Give Up** control **reveals the intended
  `solutionPath`** (brief highlight), then advances to the next puzzle **without**
  incrementing. Session counter is in-memory (resets on reload [§9]); `muted`
  persists.

## 8. Testing plan (Vitest, pure core only)

- **theory.test.ts**: `noteName`/`intervalName` match the Music-Theory-Doc tables
  **and a sweep of f ∈ [−14,+14]** (the tables stop at F♭…B♯, but the game emits
  double accidentals) including E𝄫, C𝄪, augR, dimR, dim7; `noteFor` worked
  examples; `pitchClass`; enharmonic pairs share pitch class; `frequency` spot
  values (A→440, C→C4); no two tones in a pattern collide to one pitch class.
- **generate.test.ts** (property-style, many seeds): every puzzle satisfies —
  solution path has correct length, is orthogonally adjacent, uses distinct
  cells, and its notes equal `root + intervals`; **all notes ∈ [−12,+12]**; grid
  **connected** (natural holes allowed); footprint within `gridMaxAspect`; decoy window contains all solution notes,
  width ≥ span+1, every decoy ∈ [−12,+12]; **`validRoots(pattern)` non-empty for
  every bank pattern** (the hang guard — `generatePuzzle` throws, not loops, if
  ever empty); **root-agnostic acceptance** (an alternate-root path is accepted,
  the intended path is accepted, a length-correct/interval-wrong path is
  rejected); **determinism** (same seed ⇒ byte-identical puzzle); and a
  **statistical** check that solutions are not systematically centered in the
  value window (the actual anti-cheat property [§R8]). Seeded RNG makes every
  failure reproducible.

## 9. Repo & deploy

```
index.html · vite.config.ts · tsconfig.json · package.json
src/… (incl. geometry.ts) · .github/workflows/deploy.yml · docs/ (unchanged)
```

- **Local dev:** `npm run dev` (Vite hot-reload). `npm test` (Vitest watch).
- **Deploy:** push → Action runs `npm ci && npm run build` → uploads `dist` →
  Pages. Requires switching the Pages **Source** to *GitHub Actions* (a one-time
  settings change I'll walk you through). `base: '/tonesearch/'` set in Vite.
- The current root `index.html` hello-world is replaced by the app entry.

## 10. Build sequence (each step ends runnable & committable)

1. **Scaffold** — `brew install node`; Vite `vanilla-ts`; strip template; add the
   deploy Action; switch Pages source; verify a placeholder deploys live.
2. **theory.ts + tests** — green before anything visual.
3. **bank.ts + rng.ts + geometry.ts** (pure; geometry has its own footprint tests).
4. **generate.ts + invariant tests** — green.
5. **render.ts** — draw a generated puzzle statically (45° grid + tokens), no
   interaction; eyeball on desktop + iOS Simulator.
6. **audio.ts** — tap-to-sound.
7. **input.ts** — selection/backtrack/auto-check.
8. **game.ts** — solve flow, playback, fade, counter, mute persistence.
9. **Polish** — responsive, reduced-motion, accessibility, theme pass.
10. **Deploy & playtest** (→ Step 6 tuning).

## 11. Risks / things I expect to tune in code

- `growBlob` hole-avoidance + aspect enforcement is where generation failure
  actually concentrates (not `findPath`) → bounded retries then restart.
- 45° tiling geometry (`geometry.ts`) + upright glyph counter-rotation + edge-cell
  clip inflation is fiddly → expect a render tuning pass (step 5).
- Double-accidental **glyph**: **decided `♯♯`/`♭♭`** (doubled singles) — the
  `𝄪`/`𝄫` Unicode rendered as an "x"/tofu on the target fonts (confirmed in step 5).
- iOS Safari audio-unlock and tap latency → validate early on the Simulator.
```
