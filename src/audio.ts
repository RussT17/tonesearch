// audio.ts — Web Audio synthesis. Tap tones and solve playback. One shared
// AudioContext, unlocked on the first user gesture (mobile starts it suspended
// with a frozen clock; scheduling then would queue every note at one past time
// and fire them all at once on resume — so we only schedule once it's running).

import { pitchClass } from './theory';
import type { Fifths } from './theory';

const MUTE_KEY = 'tonesearch.muted';
const BASE_MIDI = 60; // C4 — the fixed reference octave (docs §6/E3)

const VOICE: { type: OscillatorType; attack: number; decay: number } = {
  type: 'triangle',
  attack: 0.02,
  decay: 0.6,
};

let ctx: AudioContext | null = null;
let warmed = false;
let muted = loadMuted();

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function audioCtx(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

export const isMuted = (): boolean => muted;

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* storage may be unavailable */
  }
}

export const toggleMuted = (): boolean => {
  setMuted(!muted);
  return muted;
};

/**
 * Wake the audio on a user gesture. Resumes the context and, once, plays a
 * one-sample silent buffer — the canonical trick that actually starts the
 * mobile audio hardware (a bare resume() sometimes leaves the clock frozen).
 */
export function unlock(): void {
  const c = audioCtx();
  if (c.state !== 'running') void c.resume();
  if (!warmed) {
    warmed = true;
    try {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, c.sampleRate);
      src.connect(c.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
  }
}

const midiToFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** Run `fn` with a definitely-running context — awaiting resume if needed, so a
 * note plays exactly once (never queued against a frozen clock). */
function whenRunning(fn: (c: AudioContext) => void): void {
  const c = audioCtx();
  if (c.state === 'running') {
    fn(c);
  } else {
    void c.resume().then(() => {
      if (c.state === 'running') fn(c);
    });
  }
}

function playFreq(c: AudioContext, freq: number, when: number, peak: number): void {
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = VOICE.type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + VOICE.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + VOICE.decay);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + VOICE.decay + 0.05);
}

/** Play a single note (tap feedback) in the fixed reference octave. */
export function playNote(note: Fifths): void {
  if (muted) return;
  const freq = midiToFreq(BASE_MIDI + pitchClass(note));
  whenRunning((c) => playFreq(c, freq, 0, 0.28));
}

/** Root-on-bottom voicing: root lowest, other tones wrapped up above it. */
function voicedMidis(notes: readonly Fifths[]): number[] {
  const rootMidi = BASE_MIDI + pitchClass(notes[0]!);
  return notes
    .map((n, i) => {
      let m = BASE_MIDI + pitchClass(n);
      if (i > 0 && m < rootMidi) m += 12;
      return m;
    })
    .sort((a, b) => a - b);
}

/** Play the solved chord: arpeggiate root→up, then strike it together. */
export function playSequence(notes: readonly Fifths[], gap = 0.18, chordAtEnd = true): void {
  if (muted) return;
  const midis = voicedMidis(notes);
  whenRunning((c) => {
    midis.forEach((m, i) => playFreq(c, midiToFreq(m), i * gap, 0.26));
    if (chordAtEnd) {
      const t = midis.length * gap + 0.15;
      for (const m of midis) playFreq(c, midiToFreq(m), t, 0.16);
    }
  });
}
