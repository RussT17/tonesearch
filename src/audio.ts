// audio.ts — Web Audio synthesis. Tap tones and solve playback. One shared
// AudioContext, resumed on a user gesture. Notes are scheduled only once the
// context is actually running: mobile starts it suspended with a frozen clock,
// so scheduling then would queue every note at one past time and fire them all
// at once on resume. (First-note latency over Bluetooth is the A2DP link's
// cold-start — a platform cost we accept rather than chase.)

import { pitchClass } from './theory';
import type { Fifths } from './theory';

const MUTE_KEY = 'tonesearch.muted';
const BASE_MIDI = 60; // C4 — the fixed reference octave (docs §6/E3)

const VOICE = { type: 'triangle' as OscillatorType, attack: 0.02, decay: 0.6 };

let ctx: AudioContext | null = null;
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

/** Resume the context on a user gesture (required on mobile). */
export function unlock(): void {
  const c = audioCtx();
  if (c.state !== 'running') void c.resume();
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

const midiToFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** Run `fn` with a running context — awaiting resume if needed, so a note plays
 * exactly once (never queued against a frozen clock). */
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

const CHORD_DECAY = VOICE.decay * 2; // hold the solved chord twice as long

function playFreq(c: AudioContext, freq: number, when: number, peak: number, decay = VOICE.decay): void {
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = VOICE.type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + VOICE.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + decay + 0.05);
}

/** Play a single note (tap feedback) in the fixed reference octave. */
export function playNote(note: Fifths): void {
  if (muted) return;
  const freq = midiToFreq(BASE_MIDI + pitchClass(note));
  whenRunning((c) => playFreq(c, freq, 0, 0.28));
}

/** Play a tap tone at a specific MIDI note — for ascending selection feedback. */
export function playNoteMidi(midi: number): void {
  if (muted) return;
  whenRunning((c) => playFreq(c, midiToFreq(midi), 0, 0.28));
}

/** A short toneless "uncheck"/bubble blip — a quick downward sine glide. Played
 * when the player deselects (re-taps a selected note to rewind). */
export function playCancel(): void {
  if (muted) return;
  whenRunning((c) => {
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t0);
    osc.frequency.exponentialRampToValueAtTime(150, t0 + 0.11);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.17);
  });
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

/** Strike the chord (all tones together), root on the bottom, held long. Used
 * on a solve — the player has already heard the tones while selecting. */
export function playChord(notes: readonly Fifths[], when = 0): void {
  if (muted) return;
  const midis = voicedMidis(notes);
  whenRunning((c) => {
    for (const m of midis) playFreq(c, midiToFreq(m), when, 0.16, CHORD_DECAY);
  });
}

/** Arpeggiate root→up, then strike the held chord. Used on Give Up (reveal). */
export function playSequence(notes: readonly Fifths[], gap = 0.18): void {
  if (muted) return;
  const midis = voicedMidis(notes);
  whenRunning((c) => {
    midis.forEach((m, i) => playFreq(c, midiToFreq(m), i * gap, 0.26));
    const t = midis.length * gap + 0.15;
    for (const m of midis) playFreq(c, midiToFreq(m), t, 0.16, CHORD_DECAY);
  });
}
