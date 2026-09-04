import { describe, expect, it } from 'vitest';
import {
  keyLine,
  promptLine,
  promptSentence,
  romanNumeral,
  sentenceSpans,
  solfege,
  spansText,
} from '../core/prompt';
import { ALL_PATTERNS, sampleHarmony } from '../core/harmony';
import type { Pattern, Tier } from '../core/pattern';
import type { Fifths, Mode } from '../core/theory';
import { makeRng } from '../core/rng';

const chord = (intervals: Fifths[], display = 'X'): Pattern => ({
  display,
  kind: 'chord',
  intervals,
});
// Interval constants, mirroring theory.ts's line-of-fifths values.
const R = 0, M3 = 4, m3 = -3, P5 = 1, d5 = -6, A5 = 8, m7 = -2, M7 = 5, d7 = -9, M2 = 2;
const m6 = -4, M6 = 3, P4 = -1;

describe('solfege', () => {
  it('is do-based in both modes, so minor thirds read as me', () => {
    expect(solfege(0)).toBe('do');
    expect(solfege(-3)).toBe('me'); // ♭3
    expect(solfege(4)).toBe('mi'); // 3
    expect(solfege(3)).toBe('la'); // 6
    expect(solfege(1)).toBe('sol'); // 5
  });

  it('returns null for spellings with no standard syllable', () => {
    expect(solfege(-10)).toBeNull(); // ♭♭7
  });
});

describe('romanNumeral', () => {
  it('cases by the third and suffixes by the quality', () => {
    expect(romanNumeral(chord([R, M3, P5]), 0)).toBe('I');
    expect(romanNumeral(chord([R, m3, P5]), 4)).toBe('iii');
    expect(romanNumeral(chord([R, m3, P5, m7]), 4)).toBe('iii7');
    expect(romanNumeral(chord([R, M3, P5, m7]), 1)).toBe('V7');
    expect(romanNumeral(chord([R, M3, P5, M7]), 0)).toBe('Imaj7');
    expect(romanNumeral(chord([R, m3, d5]), 2)).toBe('ii°');
    expect(romanNumeral(chord([R, m3, d5, m7]), 2)).toBe('iiø7');
    expect(romanNumeral(chord([R, m3, d5, d7]), 5)).toBe('vii°7');
    expect(romanNumeral(chord([R, M3, A5]), 0)).toBe('I+');
  });

  it('carries the degree accidental', () => {
    // −2 is ♭7 on the line of fifths (♭VII, the major chord of minor keys);
    // −5 is ♭2, the Neapolitan's degree.
    expect(romanNumeral(chord([R, M3, P5]), -2)).toBe('♭VII');
    expect(romanNumeral(chord([R, M3, P5]), -5)).toBe('♭II');
  });

  // The safety property: a chord with no third has no derivable quality, and
  // guessing one would teach the wrong thing.
  it('declines rather than guessing when there is no third', () => {
    expect(romanNumeral(chord([R, P5]), 0)).toBeNull();
    expect(romanNumeral(chord([R, m7]), 1)).toBeNull(); // shell voicing
  });

  // The bug this guards: a numeral has four things to say — root, third, fifth,
  // seventh — and a tone outside those was simply dropped, which renames the
  // chord rather than abbreviating it. Reported case: R m3 P5 m6 in D minor was
  // called "the v chord", and v has no ♭6.
  it('declines when the chord has a tone the numeral cannot say', () => {
    expect(romanNumeral(chord([R, m3, P5, m6]), 1)).toBeNull(); // the reported one
    expect(romanNumeral(chord([R, m3, P5, M6]), 1)).toBeNull(); // m6 chord
    expect(romanNumeral(chord([R, M3, P5, M2]), 0)).toBeNull(); // add9
    expect(romanNumeral(chord([R, M3, P4, P5]), 0)).toBeNull(); // add4
    expect(romanNumeral(chord([R, M3, P5, m7, M2]), 1)).toBeNull(); // 9th, not V7
    expect(romanNumeral(chord([M3, M6]), 0)).toBeNull(); // a 3/6 dyad is not "I"
  });

  // Subtler: the suffix carries only certain fifth/seventh pairs. There is no
  // numeral for a ♭5 under a major third, nor for a ♯5 under a major seventh, so
  // membership in "root, third, fifth, seventh" is not enough on its own.
  it('declines when the suffix cannot carry the fifth and seventh it has', () => {
    expect(romanNumeral(chord([R, M3, d5, m7]), 1)).toBeNull(); // 7♭5, not V7
    expect(romanNumeral(chord([R, M3, A5, M7]), 0)).toBeNull(); // maj7♯5, not I+
  });

  // The other direction: leaving a tone OUT is fine. A shell voicing with no
  // fifth is still V7, and refusing those would lose the numeral on chords it
  // names perfectly well.
  it('accepts a voicing that omits tones', () => {
    expect(romanNumeral(chord([R, M3, m7]), 1)).toBe('V7'); // shell
    expect(romanNumeral(chord([M3, P5, M7]), 0)).toBe('Imaj7'); // rootless
    expect(romanNumeral(chord([M3, m7]), 1)).toBe('V7'); // tritone dyad
  });
});

/** The tones a numeral claims, read back out of the numeral string itself —
 * independent of how romanNumeral decided, so the property below is a real
 * check and not a restatement. */
const tonesOf = (numeral: string): Set<Fifths> => {
  const body = numeral.replace(/^[♭♯]/, '');
  const roman = body.match(/^[IViv]+/)![0];
  const suffix = body.slice(roman.length);
  const third = roman === roman.toUpperCase() ? M3 : m3;
  const fifth = /^[°ø]/.test(suffix) ? d5 : suffix.startsWith('+') ? A5 : P5;
  const seventh = suffix === '°7' ? d7 : suffix === 'maj7' ? M7
    : suffix.endsWith('7') ? m7 : null;
  const tones = new Set<Fifths>([R, third, fifth]);
  if (seventh !== null) tones.add(seventh);
  return tones;
};

describe('a numeral accounts for every tone of the chord it names', () => {
  it('holds across every chord the game can draw', () => {
    let named = 0;
    let declined = 0;
    for (const pattern of ALL_PATTERNS) {
      if (pattern.kind !== 'chord' && pattern.kind !== 'triad') continue;
      for (const degree of [-2, 0, 1, 4] as Fifths[]) {
        const numeral = romanNumeral(pattern, degree);
        if (numeral === null) {
          declined++;
          continue;
        }
        const tones = tonesOf(numeral);
        for (const iv of pattern.intervals) {
          expect(
            tones.has(iv),
            `${numeral} does not say ${iv} of ${pattern.display}`,
          ).toBe(true);
        }
        named++;
      }
    }
    // Both paths are exercised: roughly half the chord patterns carry a tone no
    // numeral can say, and the other half are named by one.
    expect(named).toBeGreaterThan(100);
    expect(declined).toBeGreaterThan(100);
  });

  // Whatever a numeral cannot name still gets named, by the pattern's own
  // hand-written name — so no chord loses its identity in the prompt.
  it('leaves the words to say the rest', () => {
    const say = (p: Pattern, degree: Fifths) =>
      promptLine({ pattern: p, mode: 'minor', degree, sig: -1 });
    expect(say({ display: 'Minor ♭6', kind: 'chord', intervals: [R, m3, P5, m6] }, 1))
      .toBe('Write a Minor ♭6 chord rooted on sol');
    expect(say({ display: 'add9', kind: 'chord', intervals: [R, M3, P5, M2] }, 0))
      .toBe('Write an add9 chord rooted on do'); // "a add9" is not a sentence
  });

  // The voicing is part of the question, and the numeral has no room for it
  // either — so it is said alongside, exactly as the worded form already did.
  it('keeps the voicing next to the numeral', () => {
    const inv: Pattern = { display: 'Major', kind: 'triad', qualifier: '1st inv.', intervals: [M3, P5, R] };
    expect(promptLine({ pattern: inv, mode: 'major', degree: 0, sig: 0 }))
      .toBe('Write the I chord (1st inv.)');
  });
});

describe('promptLine', () => {
  const ctx = (p: Pattern, degree: Fifths, mode: Mode = 'major', sig: Fifths = 2) => ({
    pattern: p,
    mode,
    degree,
    sig,
  });

  it('words each kind differently', () => {
    expect(promptLine(ctx({ display: 'Note', kind: 'note', intervals: [R] }, 3))).toBe('Write la');
    expect(
      promptLine(ctx({ display: 'Perfect 5th', kind: 'interval', intervals: [R, P5] }, 1)),
    ).toBe('Write sol and its Perfect 5th');
    expect(
      promptLine(ctx({ display: 'Major Pentatonic', kind: 'scale', intervals: [R, M2, M3] }, 0)),
    ).toBe('Write the Major Pentatonic from do');
    expect(promptLine(ctx(chord([R, m3, P5, m7]), 4))).toBe('Write the iii7 chord');
  });

  it('falls back to naming the chord when no numeral is derivable', () => {
    const shell: Pattern = { display: 'Dominant 7th', kind: 'chord', intervals: [R, m7], qualifier: 'shell' };
    expect(promptLine(ctx(shell, 1))).toBe('Write a Dominant 7th chord (shell) rooted on sol');
    const sus: Pattern = { display: '7sus4', kind: 'chord', intervals: [R, 3, P5, m7] };
    expect(promptLine(ctx(sus, -2))).toBe('Write a 7sus4 chord rooted on te');
  });

  it('names the key separately, since the staff shows the signature', () => {
    expect(keyLine(ctx(chord([R, M3, P5]), 0, 'major', 2))).toBe('in D major');
    expect(keyLine(ctx(chord([R, m3, P5]), 0, 'minor', 1))).toBe('in E minor');
  });
});

// The words a player has to act on are emphasised; the connective tissue is not.
// Spans, not markup: the shell turns these into text nodes, so a pattern name
// like "m7♭5" can never be read as HTML.
describe('sentenceSpans', () => {
  const ctx = (p: Pattern, degree: Fifths, mode: Mode = 'major', sig: Fifths = 2) => ({
    pattern: p,
    mode,
    degree,
    sig,
  });

  it('emphasises the chord, its root and the key — and nothing else', () => {
    const sus: Pattern = { display: '7sus4', kind: 'chord', intervals: [R, 3, P5, m7] };
    const spans = sentenceSpans(ctx(sus, -2, 'minor', 6));
    expect(spans.filter((s) => s.em).map((s) => s.text)).toEqual([
      '7sus4 chord', 'te', 'D♯ minor',
    ]);
  });

  it('emphasises both halves of an interval, and the degree of a single note', () => {
    const iv: Pattern = { display: 'Perfect 4th', kind: 'interval', intervals: [R, -1] };
    expect(sentenceSpans(ctx(iv, 1)).filter((s) => s.em).map((s) => s.text)).toEqual([
      'sol', 'Perfect 4th', 'D major',
    ]);
    const one: Pattern = { display: 'Note', kind: 'note', intervals: [R] };
    expect(sentenceSpans(ctx(one, 3)).filter((s) => s.em).map((s) => s.text)).toEqual([
      'la', 'D major',
    ]);
  });

  it('says exactly what the plain sentence says', () => {
    for (const pattern of ALL_PATTERNS) {
      for (const degree of [-2, 0, 1, 4] as Fifths[]) {
        const c = ctx(pattern, degree);
        expect(spansText(sentenceSpans(c))).toBe(`${promptLine(c)} ${keyLine(c)}`);
      }
    }
  });
});

// The point of this one: prompt wording runs over generator output, so every
// pattern the game can actually draw has to produce a usable sentence. A new
// pack that breaks the wording should fail here, not in front of a player.
describe('every reachable pattern produces a sentence', () => {
  it('covers ALL_PATTERNS across both modes and every degree', () => {
    const degrees: Fifths[] = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
    for (const pattern of ALL_PATTERNS) {
      for (const mode of ['major', 'minor'] as Mode[]) {
        for (const degree of degrees) {
          const s = promptSentence({ pattern, mode, degree, sig: 0 });
          expect(s.startsWith('Write ')).toBe(true);
          expect(s.endsWith('.')).toBe(true);
          expect(s).not.toContain('undefined');
          expect(s).not.toContain('null');
          expect(s).not.toContain('NaN');
        }
      }
    }
  });

  it('covers what the tiers actually sample', () => {
    const rng = makeRng(7);
    for (const tier of ['easy', 'medium', 'hard', 'expert'] as Tier[]) {
      for (let i = 0; i < 200; i++) {
        const pick = sampleHarmony(tier, rng);
        const s = promptSentence(pick);
        expect(s.length).toBeGreaterThan(8);
        expect(s).not.toContain('undefined');
      }
    }
  });
});
