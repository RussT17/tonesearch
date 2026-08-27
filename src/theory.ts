// theory.ts — the whole engine is integer math on the line of fifths.
// See docs/00-music-theory.md. Notes and intervals are the SAME unbounded
// integer type: a note is "fifths from D", an interval is "fifths from root".
// The one operation the game runs on: note = root + interval.

/** A signed integer on the line of fifths (unbounded; enharmonics stay distinct). */
export type Fifths = number;

// --- Naming -----------------------------------------------------------------

// Letters run in fifths order; index 3 = D = fifths 0. Adding a ♯ = +7, ♭ = −7.
const LETTERS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const;

/** JS `%` is sign-preserving; this normalizes into `[0, n)`. */
const mod = (x: number, n: number): number => ((x % n) + n) % n;

/**
 * Accidental suffix for `k`: 0 natural, +k sharps, −k flats. Uses doubled
 * ♯/♭ (e.g. "♯♯") rather than the 𝄪/𝄫 Unicode, which many fonts don't render.
 */
function accidental(k: number): string {
  if (k === 0) return '';
  return (k > 0 ? '♯' : '♭').repeat(Math.abs(k));
}

/** Spell a note, e.g. 0→"D", −4→"B♭", +12→"C𝄪". Correct for any integer. */
export function noteName(f: Fifths): string {
  const letter = LETTERS[mod(f + 3, 7)];
  const k = Math.floor((f + 3) / 7); // 0 natural, + sharps, − flats
  return letter + accidental(k);
}

// Generic interval number by ((f+1) mod 7); 1,4,5 are the "perfect" degrees.
const NUMS = [4, 1, 5, 2, 6, 3, 7] as const;
const PERFECT = new Set([1, 4, 5]);
const dup = (s: string, k: number): string => s.repeat(k);

/** Name an interval from the root, e.g. 0→"R", −3→"m3", +6→"aug4", +7→"augR". */
export function intervalName(f: Fifths): string {
  const n = NUMS[mod(f + 1, 7)];
  const k = Math.floor((f + 1) / 7); // 0 = Perfect/Major band
  if (n === 1 && f === 0) return 'R';
  const q = PERFECT.has(n)
    ? k === 0
      ? 'P'
      : k > 0
        ? dup('aug', k)
        : dup('dim', -k)
    : k === 0
      ? 'M'
      : k > 0
        ? dup('aug', k)
        : k === -1
          ? 'm'
          : dup('dim', -k - 1);
  return n === 1 ? q + 'R' : q + n; // augR / dimR for the unison
}

// --- Arithmetic & audio ------------------------------------------------------

/** The one operation: the note an interval above a root. */
export const noteFor = (root: Fifths, interval: Fifths): Fifths => root + interval;

/** The interval (in fifths) from note `a` up to note `b`. */
export const intervalBetween = (a: Fifths, b: Fifths): Fifths => b - a;

/** Pitch class 0–11 (C = 0). For audio & enharmonic checks only. */
export const pitchClass = (f: Fifths): number => mod(7 * f + 2, 12);

/**
 * Frequency in Hz, mapping every note into ONE fixed octave by pitch class.
 * `base` is the MIDI note of that octave's C (default 60 = C4). A=440 exactly.
 */
export const frequency = (f: Fifths, base = 60): number =>
  440 * 2 ** ((base + pitchClass(f) - 69) / 12);

/** True iff two spellings sound the same (equal pitch class). Tests/audio only. */
export const enharmonic = (a: Fifths, b: Fifths): boolean => pitchClass(a) === pitchClass(b);
