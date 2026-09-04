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
 * A run of prompt text, `em` where the word carries the question.
 *
 * The prompt is built as spans rather than a string with markup in it because
 * the renderer builds text nodes from these — nothing here is ever parsed as
 * HTML, so a pattern name containing an angle bracket stays a pattern name.
 */
export interface Span {
  readonly text: string;
  readonly em?: boolean;
}

const t = (text: string): Span => ({ text });
const em = (text: string): Span => ({ text, em: true });

/** The instruction line as spans; see `promptLine` for the wording. */
export function promptSpans(ctx: PromptContext): Span[] {
  const { pattern, degree } = ctx;
  const where = degreeWord(degree);
  switch (pattern.kind) {
    case 'note':
      return [t('Write '), em(where)];
    case 'interval':
      // Names BOTH notes on purpose: "a P4 above sol" reads as one note to
      // write, when an interval round wants the degree and the note above it.
      return [t('Write '), em(where), t(' and its '), em(pattern.display)];
    case 'scale':
      return [t('Write the '), em(pattern.display), t(' from '), em(where)];
    case 'triad':
    case 'chord': {
      const numeral = romanNumeral(pattern, degree);
      if (numeral) return [t('Write the '), em(`${numeral} chord`)];
      // "a 7sus4 on te" leaves "7sus4" doing two jobs; naming the chord and
      // then its root splits the question into the two things being asked.
      const qualifier: Span[] = pattern.qualifier ? [t(` (${pattern.qualifier})`)] : [];
      return [
        t('Write a '), em(`${pattern.display} chord`), ...qualifier,
        t(' rooted on '), em(where),
      ];
    }
  }
}

/** The key half as spans; see `keyLine`. */
export const keySpans = (ctx: PromptContext): Span[] => [
  t('in '),
  em(keyName(ctx.mode, ctx.sig)),
];

/** The whole instruction as spans, e.g. "Write a **7sus4 chord** rooted on
 * **te** in **D♯ minor**". */
export const sentenceSpans = (ctx: PromptContext): Span[] => [
  ...promptSpans(ctx), t(' '), ...keySpans(ctx),
];

/** Spans flattened back to plain text. */
export const spansText = (spans: readonly Span[]): string =>
  spans.map((s) => s.text).join('');

/**
 * The instruction line, e.g.
 *   "Write the iii7 chord"                    (chord/triad, quality derivable)
 *   "Write a 7sus4 chord rooted on te"        (chord/triad, rootless — no numeral)
 *   "Write sol and its Perfect 5th"           (interval — two notes, so both are named)
 *   "Write the Major Pentatonic from do"      (scale)
 *   "Write la"                                (single note)
 * Pair with `keyLine` for the "in D major" half — the staff shows the key
 * signature, so the two are deliberately separate.
 */
export const promptLine = (ctx: PromptContext): string => spansText(promptSpans(ctx));

/** The key half of the prompt, e.g. "in D major". */
export const keyLine = (ctx: PromptContext): string => spansText(keySpans(ctx));

/** The whole instruction as one sentence. */
export const promptSentence = (ctx: PromptContext): string =>
  `${spansText(sentenceSpans(ctx))}.`;
