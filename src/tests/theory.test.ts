import { describe, it, expect } from 'vitest';
import {
  noteName,
  intervalName,
  noteFor,
  intervalBetween,
  pitchClass,
  frequency,
  enharmonic,
  tonicNote,
  keyName,
  degreeName,
  MODE_OFFSET,
  type Fifths,
  type Mode,
} from '../theory';

// Ground-truth tables from docs/00-music-theory.md, extended past F♭…B♯ into the
// double-accidental spellings the game actually produces (clamp is [−12,+12]).
const NOTE_NAMES: Record<number, string> = {
  [-12]: 'E♭♭', [-11]: 'B♭♭', [-10]: 'F♭', [-9]: 'C♭', [-8]: 'G♭', [-7]: 'D♭',
  [-6]: 'A♭', [-5]: 'E♭', [-4]: 'B♭', [-3]: 'F', [-2]: 'C', [-1]: 'G',
  [0]: 'D', [1]: 'A', [2]: 'E', [3]: 'B', [4]: 'F♯', [5]: 'C♯', [6]: 'G♯',
  [7]: 'D♯', [8]: 'A♯', [9]: 'E♯', [10]: 'B♯', [11]: 'F♯♯', [12]: 'C♯♯',
};

const INTERVAL_NAMES: Record<number, string> = {
  [-9]: 'd7', [-8]: 'd4', [-7]: 'dR', [-6]: 'd5', [-5]: 'm2', [-4]: 'm6',
  [-3]: 'm3', [-2]: 'm7', [-1]: 'P4', [0]: 'R', [1]: 'P5', [2]: 'M2', [3]: 'M6',
  [4]: 'M3', [5]: 'M7', [6]: 'A4', [7]: 'AR', [8]: 'A5', [9]: 'A2',
};

describe('noteName', () => {
  it('matches the note table across F𝄫…C𝄪 (incl. double accidentals)', () => {
    for (const [f, name] of Object.entries(NOTE_NAMES)) {
      expect(noteName(Number(f))).toBe(name);
    }
  });

  it('produces the C♭ min7 double-flat spelling C♭ E𝄫 G♭ B𝄫', () => {
    const root = -9; // C♭
    const min7 = [0, -3, 1, -2]; // R, m3, P5, m7
    expect(min7.map((iv) => noteName(noteFor(root, iv)))).toEqual(['C♭', 'E♭♭', 'G♭', 'B♭♭']);
  });

  it('is stable under a monotonic sweep and never throws', () => {
    for (let f = -14; f <= 14; f++) expect(typeof noteName(f)).toBe('string');
  });
});

describe('intervalName', () => {
  it('matches the interval table A2…d7', () => {
    for (const [f, name] of Object.entries(INTERVAL_NAMES)) {
      expect(intervalName(Number(f))).toBe(name);
    }
  });

  it('spells the unison specially (R / AR / dR)', () => {
    expect(intervalName(0)).toBe('R');
    expect(intervalName(7)).toBe('AR');
    expect(intervalName(-7)).toBe('dR');
  });
});

describe('keys, modes, degrees (docs/09)', () => {
  it('tonicNote = sig + modeOffset across every signature', () => {
    for (let sig = -6; sig <= 6; sig++) {
      expect(tonicNote('major', sig)).toBe(sig + MODE_OFFSET.major);
      expect(tonicNote('minor', sig)).toBe(sig + MODE_OFFSET.minor);
    }
    expect(tonicNote('major', 0)).toBe(-2); // C
    expect(tonicNote('minor', 0)).toBe(1); // A
    // relative minor sits 3 fifths sharp of its major
    for (let sig = -6; sig <= 6; sig++) {
      expect(tonicNote('minor', sig) - tonicNote('major', sig)).toBe(3);
    }
  });

  it('keyName spells the tonic + quality', () => {
    const cases: Array<[Mode, number, string]> = [
      ['major', 0, 'C major'], ['minor', 0, 'A minor'], ['major', 1, 'G major'],
      ['minor', 3, 'F♯ minor'], ['major', -6, 'G♭ major'], ['major', 6, 'F♯ major'],
    ];
    for (const [mode, sig, name] of cases) expect(keyName(mode, sig)).toBe(name);
  });

  it('degreeName labels degrees vs the major scale', () => {
    const cases: Array<[Fifths, string]> = [
      [0, '1'], [1, '5'], [2, '2'], [3, '6'], [4, '3'], [5, '7'], [6, '♯4'],
      [-1, '4'], [-2, '♭7'], [-3, '♭3'], [-4, '♭6'], [-5, '♭2'], [-6, '♭5'],
    ];
    for (const [d, name] of cases) expect(degreeName(d)).toBe(name);
  });
});

describe('arithmetic', () => {
  it('noteFor and intervalBetween are inverses', () => {
    const cases: Array<[Fifths, Fifths]> = [
      [-2, -3], [1, 1], [0, 6], [8, 4], [-9, -3],
    ];
    for (const [root, iv] of cases) {
      const note = noteFor(root, iv);
      expect(intervalBetween(root, note)).toBe(iv);
    }
  });

  it('worked example: A min7 → A C E G', () => {
    const notes = [0, -3, 1, -2].map((iv) => noteName(noteFor(1, iv)));
    expect(notes).toEqual(['A', 'C', 'E', 'G']);
  });
});

describe('pitch class & frequency', () => {
  it('pitchClass places C=0, G=7, A=9', () => {
    expect(pitchClass(-2)).toBe(0); // C
    expect(pitchClass(-1)).toBe(7); // G
    expect(pitchClass(1)).toBe(9); // A
  });

  it('enharmonic spellings share a pitch class (C♯ = D♭, D♯ = E♭)', () => {
    expect(enharmonic(5, -7)).toBe(true); // C♯ vs D♭
    expect(enharmonic(7, -5)).toBe(true); // D♯ vs E♭
    expect(enharmonic(0, 1)).toBe(false); // D vs A
  });

  it('frequency: A→440 exactly, C→C4 (~261.63)', () => {
    expect(frequency(1)).toBeCloseTo(440, 6); // A
    expect(frequency(-2)).toBeCloseTo(261.6256, 3); // C4
  });
});
