// prompt.ts — how ToneScribe asks for a pattern in words. Pure; no DOM.
//
// ToneSearch never needs this: it shows you a shape and asks you to find it, so
// the intervals ARE the question. ToneScribe gives you a key and asks for a
// function, so the question has to be spoken — and it reads differently for a
// chord, an interval, a scale and a single note.
//
// Everything here is derived from the (pattern, mode, degree) the generator
// already picks (docs/09); nothing new is chosen at prompt time.

import type { Pattern } from './pattern';
import type { Fifths, Mode } from './theory';
import { degreeName, keyName } from './theory';

// ── Interval constants on the line of fifths (see theory.ts) ────────────────
const M3 = 4;
const m3 = -3;
const d5 = -6;
const A5 = 8;
const m7 = -2;
const M7 = 5;
const d7 = -9;

/** Movable-do solfège, do-based in both modes (so minor's third is "me", which
 * is how the user asked for it — not la-based minor). Keyed by the degree label
 * `degreeName` produces, so the accidental spelling stays in one place. */
const SOLFEGE: Record<string, string> = {
  '1': 'do', '♯1': 'di', '♭2': 'ra', '2': 're', '♯2': 'ri', '♭3': 'me',
  '3': 'mi', '4': 'fa', '♯4': 'fi', '♭5': 'se', '5': 'sol', '♯5': 'si',
  '♭6': 'le', '6': 'la', '♯6': 'li', '♭7': 'te', '7': 'ti',
};

/** Solfège syllable for a scale degree, or null for exotic spellings (♭♭7,
 * ♯♯4 …) that have no standard syllable. */
export function solfege(degree: Fifths): string | null {
  return SOLFEGE[degreeName(degree)] ?? null;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

/**
 * The roman numeral for a chord on `degree` whose quality comes from
 * `intervals`, e.g. "iii7", "V7", "ii°", "♭VII".
 *
 * Returns null when the pattern does not carry enough to name a quality — a
 * rootless or shell voicing may have no third, and inversions reorder but do
 * not add one. A wrong numeral teaches the wrong thing, so callers fall back to
 * naming the chord in words instead of guessing.
 */
export function romanNumeral(pattern: Pattern, degree: Fifths): string | null {
  const label = degreeName(degree); // e.g. "5", "♭3"
  const num = Number(label.replace(/[^\d]/g, ''));
  if (!num || num < 1 || num > 7) return null;
  const accidental = label.slice(0, label.length - String(num).length);

  const has = (iv: Fifths): boolean => pattern.intervals.includes(iv);
  const major = has(M3);
  const minor = has(m3);
  if (major === minor) return null; // no third, or (impossibly) both → don't guess

  let numeral: string = ROMAN[num - 1]!;
  if (minor) numeral = numeral.toLowerCase();

  // Quality suffix, most specific first.
  let suffix = '';
  if (minor && has(d5)) suffix = has(d7) ? '°7' : has(m7) ? 'ø7' : '°';
  else if (major && has(A5)) suffix = has(m7) ? '+7' : '+';
  else if (has(m7)) suffix = '7';
  else if (has(M7)) suffix = 'maj7';

  return accidental + numeral + suffix;
}

/** How a degree is spoken in a prompt: solfège when it has a syllable, else the
 * plain degree number ("♭♭7"). */
const degreeWord = (degree: Fifths): string => solfege(degree) ?? `degree ${degreeName(degree)}`;

export interface PromptContext {
  pattern: Pattern;
  mode: Mode;
  degree: Fifths;
  sig: Fifths;
}

/**
 * The instruction line, e.g.
 *   "Write the iii7 chord"          (chord/triad, quality derivable)
 *   "Write a Dominant 7th on sol"   (chord/triad, rootless — no numeral)
 *   "Write a Perfect 5th above sol" (interval)
 *   "Write the Major Pentatonic from do"  (scale)
 *   "Write la"                      (single note)
 * Pair with `keyLine` for the "in D major" half — the staff shows the key
 * signature, so the two are deliberately separate.
 */
export function promptLine(ctx: PromptContext): string {
  const { pattern, degree } = ctx;
  const where = degreeWord(degree);
  switch (pattern.kind) {
    case 'note':
      return `Write ${where}`;
    case 'interval':
      return `Write a ${pattern.display} above ${where}`;
    case 'scale':
      return `Write the ${pattern.display} from ${where}`;
    case 'triad':
    case 'chord': {
      const numeral = romanNumeral(pattern, degree);
      if (numeral) return `Write the ${numeral} chord`;
      const qualifier = pattern.qualifier ? ` (${pattern.qualifier})` : '';
      return `Write a ${pattern.display}${qualifier} on ${where}`;
    }
  }
}

/** The key half of the prompt, e.g. "in D major". */
export const keyLine = (ctx: PromptContext): string => `in ${keyName(ctx.mode, ctx.sig)}`;

/** The whole instruction as one sentence. */
export const promptSentence = (ctx: PromptContext): string =>
  `${promptLine(ctx)} ${keyLine(ctx)}.`;
