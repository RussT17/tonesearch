// audio.ts — Web Audio synthesis. Tap tones and solve playback. One shared
// AudioContext, resumed on a user gesture. Two defenses against mobile/Bluetooth
// audio going to sleep between taps (which causes cold-start lag and the "all
// notes at once" burst): ① a keep-alive (inaudible non-zero tone) that keeps the
// Bluetooth link + audio clock awake during play, and ② a burst guard that drops
// a note rather than queueing it when it detects the clock has frozen.

import { pitchClass } from './theory';
import type { Fifths } from './theory';

const MUTE_KEY = 'tonesearch.muted';
const BASE_MIDI = 60; // C4 — the fixed reference octave (docs §6/E3)

const VOICE = { type: 'triangle' as OscillatorType, attack: 0.02, decay: 0.75 };
// A distinct, rounder bass voice for the implied root under rootless voicings
// (Expert) — sounds like a bassist grounding the chord (docs/07 §4). A warm
// custom waveform (fundamental + gently decreasing harmonics, built lazily in
// `bassVoice`) so the low pitch carries on small phone speakers — richer and
// more present than a pure sine, without a sawtooth's buzz.
const BASS = { peak: 0.2, decay: 1.06 };

// Harmonic amplitudes (index 0 = DC, 1 = fundamental, …) for the bass timbre.
const BASS_HARMONICS = [0, 1, 0.5, 0.32, 0.18, 0.1];
let bassWave: PeriodicWave | null = null;
function bassVoice(c: AudioContext): PeriodicWave {
  if (!bassWave) {
    const imag = new Float32Array(BASS_HARMONICS);
    bassWave = c.createPeriodicWave(new Float32Array(imag.length), imag);
  }
  return bassWave;
}

// Octave-seating for sequences: each sequence's ROOT is placed at whichever
// octave of its pitch class sits closest to `anchorMidi` (tie → the lower one),
// and the remaining tones stack ascending above it. The one knob to tune the
// register — lower it to sink everything, raise it to lift. (60 = C4.)
const VOICING = { anchorMidi: 60 };

let ctx: AudioContext | null = null;
let muted = loadMuted();
let keepAlive: { osc: OscillatorNode; gain: GainNode } | null = null;
// ② burst guard: track whether the audio clock is actually advancing.
let lastPerf = -1;
let lastCtxTime = -1;

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

/** Resume the context on a user gesture (required on mobile) and keep it alive. */
export function unlock(): void {
  const c = audioCtx();
  if (c.state !== 'running') void c.resume();
  startKeepAlive(c);
}

/**
 * ① Keep-alive: an INAUDIBLE but non-zero ultrasonic tone that runs the whole
 * time the game is in active play, so neither the Bluetooth A2DP link nor the
 * Web Audio clock sleeps between taps (which causes the cold-start lag and the
 * "all notes at once" burst). Gated off on background/mute to save battery.
 */
function startKeepAlive(c: AudioContext): void {
  if (keepAlive || muted) return;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = Math.min(20000, c.sampleRate / 2 - 1000); // near-ultrasonic, inaudible
  const gain = c.createGain();
  const t0 = c.currentTime;
  // Assertive (but still ultrasonic/inaudible) burst to spin the Bluetooth
  // stream up fast on the Play gesture, then settle to the quiet steady level.
  gain.gain.setValueAtTime(0.02, t0); // ~-34 dBFS at 20kHz
  gain.gain.setTargetAtTime(0.0008, t0 + 0.3, 0.15); // → ~-62 dBFS steady
  osc.connect(gain).connect(c.destination);
  osc.start();
  keepAlive = { osc, gain };
}

/** Stop the keep-alive (on background/mute) so the Bluetooth link can idle. */
export function stopKeepAlive(): void {
  if (!keepAlive) return;
  try {
    keepAlive.osc.stop();
  } catch {
    /* already stopped */
  }
  keepAlive.osc.disconnect();
  keepAlive.gain.disconnect();
  keepAlive = null;
}

export const isMuted = (): boolean => muted;

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* storage may be unavailable */
  }
  // No sound while muted → no need to hold the Bluetooth link open.
  if (m) stopKeepAlive();
  else if (ctx) startKeepAlive(ctx);
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

/**
 * ② Burst guard: if wall-clock time has passed but the audio clock hasn't
 * advanced, the pipeline is frozen (mobile/Bluetooth can freeze it while still
 * reporting state==='running'). Scheduling then queues notes at one past time
 * that all fire at once on wake — so report "not live" and drop the note.
 */
function clockLive(c: AudioContext): boolean {
  const t = c.currentTime;
  const p = performance.now();
  let live = true;
  if (lastPerf >= 0) {
    const wall = (p - lastPerf) / 1000;
    if (wall > 0.1 && t - lastCtxTime < wall * 0.25) {
      live = false;
      void c.resume(); // nudge it awake for next time
    }
  }
  lastPerf = p;
  lastCtxTime = t;
  return live;
}

function playFreq(
  c: AudioContext,
  freq: number,
  when: number,
  peak: number,
  decay = VOICE.decay,
  wave: OscillatorType | PeriodicWave = VOICE.type,
): void {
  if (!clockLive(c)) return; // drop rather than queue against a frozen clock
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  if (wave instanceof PeriodicWave) osc.setPeriodicWave(wave);
  else osc.type = wave;
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

/**
 * Ascending voicing: root on the bottom, each note voiced above the previous.
 * Matches the selection/reveal arpeggio (same base + rule) so the chord sits in
 * the exact same octaves and order as the notes the player just heard.
 */
/** The octave of pitch class `pc` (0–11) nearest `anchor` (tie → the lower). */
function seatNearAnchor(pc: number, anchor: number): number {
  let m = pc;
  while (m < anchor - 6) m += 12;
  while (m >= anchor + 6) m -= 12;
  return m;
}

export function ascendingMidis(notes: readonly Fifths[]): number[] {
  const midis: number[] = [];
  let prev = -Infinity;
  notes.forEach((n, i) => {
    // Root seated near the anchor; every later tone stacks ascending above it
    // (preserves all intervals). No separate fold — the anchor picks the octave.
    let m = i === 0 ? seatNearAnchor(pitchClass(n), VOICING.anchorMidi) : pitchClass(n);
    while (m <= prev) m += 12;
    midis.push(m);
    prev = m;
  });
  return midis;
}

/** Strike the chord (all tones together), held long. Voiced identically to the
 * arpeggio the player heard while selecting/revealing. */
export function playChord(notes: readonly Fifths[], when = 0): void {
  if (muted) return;
  const midis = ascendingMidis(notes);
  whenRunning((c) => {
    for (const m of midis) playFreq(c, midiToFreq(m), when, 0.16, CHORD_DECAY);
  });
}

/** Play the notes as a quick ascending run (for scales) rather than a struck
 * chord — a light flourish up the scale, voiced like the arpeggio. */
export function playScaleRun(notes: readonly Fifths[], when = 0, step = 0.07): void {
  if (muted) return;
  const midis = ascendingMidis(notes);
  whenRunning((c) => {
    midis.forEach((m, i) => playFreq(c, midiToFreq(m), when + i * step, 0.26));
  });
}

/** The implied root voiced as a bass note ~an octave below the sequence's first
 * note — the ROOT's pitch class (not the first note), seated in that register. */
function bassMidi(rootFifths: Fifths, notes: readonly Fifths[]): number {
  const first = ascendingMidis(notes)[0] ?? VOICING.anchorMidi;
  return seatNearAnchor(pitchClass(rootFifths), first - 12);
}

/** Sound the implied root beneath a rootless voicing, in the distinct bass voice
 * (docs/07 §4). No-op for rooted patterns — the caller decides when to invoke it. */
export function playRootBass(
  rootFifths: Fifths,
  notes: readonly Fifths[],
  when = 0,
  decay = BASS.decay,
): void {
  if (muted || notes.length === 0) return;
  const freq = midiToFreq(bassMidi(rootFifths, notes));
  whenRunning((c) => playFreq(c, freq, when, BASS.peak, decay, bassVoice(c)));
}
