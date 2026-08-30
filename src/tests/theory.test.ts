import { describe, it, expect } from 'vitest';
import {
  noteName,
  intervalName,
  noteFor,
  intervalBetween,
  pitchClass,
  frequency,
  enharmonic,
  type Fifths,
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
