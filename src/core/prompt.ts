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
const R = 0;
const M3 = 4;
const m3 = -3;
const P5 = 1;
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
 * Returns null unless the numeral names EVERY tone the chord has. A numeral has
 * only four things to say — a root, a third, a fifth, a seventh — so a sixth, a
 * ninth, an eleventh, a thirteenth or an alteration has nowhere to go in it, and
 * the suffix itself covers only certain fifth/seventh pairs (there is no numeral
 * for a ♭5 under a major third, or a ♯5 under a major seventh). Dropping such a
 * tone does not abbreviate the chord, it renames it: a minor triad with an added
 * ♭6 is not "v", and the player would then be asked to write a different chord
 * from the one named. About half the chord patterns carry such a tone, so this
 * is the common case rather than the edge.
 *
 * Omissions are fine in the other direction — a shell voicing with no fifth is
 * still V7 — so the test is that nothing is present which the numeral does not
 * account for.
 *
 * A rootless or shell voicing may also have no third at all, and then the
 * quality cannot be derived; callers fall back to naming the chord in words,
 * which is where the pattern's own hand-written name gets used.
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
  const third = major ? M3 : m3;

  // Quality suffix, most specific first — and, alongside it, exactly which fifth
  // and seventh that suffix claims the chord has.
  let suffix = '';
  let fifth: Fifths = P5;
  let seventh: Fifths | null = null;
  if (minor && has(d5)) {
    fifth = d5;
    if (has(d7)) { suffix = '°7'; seventh = d7; } else if (has(m7)) { suffix = 'ø7'; seventh = m7; } else suffix = '°';
  } else if (major && has(A5)) {
    fifth = A5;
    if (has(m7)) { suffix = '+7'; seventh = m7; } else suffix = '+';
  } else if (has(m7)) {
    suffix = '7';
    seventh = m7;
  } else if (has(M7)) {
    suffix = 'maj7';
    seventh = M7;
  }

  const named = new Set<Fifths>([R, third, fifth]);
  if (seventh !== null) named.add(seventh);
  if (pattern.intervals.some((iv) => !named.has(iv))) return null;

  let numeral: string = ROMAN[num - 1]!;
  if (minor) numeral = numeral.toLowerCase();
  return accidental + numeral + suffix;
}

/** How a degree is spoken in a prompt: solfège when it has a syllable, else the
 * plain degree number ("♭♭7"). */
const degreeWord = (degree: Fifths): string => solfege(degree) ?? `degree ${degreeName(degree)}`;

/** "a" or "an" before a chord name. Decided by the first LETTER, not by how the
 * name is said aloud: "add9" wants "an", while an initialism would need to know
 * that "m7♭5" is said "em" but "maj7♯11" is said "major" — same letter, and
 * guessing would be wrong about as often as it was right. */
const article = (name: string): string => (/^[aeiou]/i.test(name) ? 'an' : 'a');

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
      // The voicing is a real part of the question — the target row shows it,
      // but only this says what it is called.
      const qualifier: Span[] = pattern.qualifier ? [t(` (${pattern.qualifier})`)] : [];
      const numeral = romanNumeral(pattern, degree);
      if (numeral) return [t('Write the '), em(`${numeral} chord`), ...qualifier];
      // "a 7sus4 on te" leaves "7sus4" doing two jobs; naming the chord and
      // then its root splits the question into the two things being asked.
      return [
        t(`Write ${article(pattern.display)} `), em(`${pattern.display} chord`), ...qualifier,
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
