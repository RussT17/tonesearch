// session.ts — the game loop both apps share, with no idea what the player is
// looking at. It owns the round, the committed notes, difficulty, the solved
// counter, and the solve / give-up / next-puzzle choreography.
//
// The seam is the note sequence. ToneSearch produces notes by walking adjacent
// diamonds; ToneScribe will produce them by placing noteheads on a staff. Either
// way a round is won by committing the right ordered list of `Fifths`, which is
// how validation already worked (`isPrefix` takes notes, never cells).

import type { Fifths } from '../core/theory';
import type { Pattern, Tier } from '../core/pattern';
import { isPrefix } from '../core/generate';
import * as audio from './audio';
import { mountShell, showStartGate, sizeDifficulty, wireChrome, type Shell } from './chrome';
import { drawTokenLine, renderTokens, targetPitch, type TokenView } from './tokens';

/** The minimum a round must expose for the shared loop to run it. */
export interface Round {
  pattern: Pattern;
  solutionNotes: Fifths[];
}

/** The play surface. Owns its own DOM, input and feedback; the session never
 * reaches inside it. */
export interface Board<R extends Round> {
  /** A new round begins — rebuild for it. `tokenPitch` is the target-diamond
   * spacing, shared so a play-surface glyph can be sized against it. */
  setRound(round: R, tokenPitch: number): void;
  /** Re-measure for the current round (window resize). */
  layout(tokenPitch: number): void;
  /** Paint the committed prefix — also drives the give-up reveal. */
  paint(notes: readonly Fifths[]): void;
  /** Accept or ignore input. */
  setBusy(busy: boolean): void;
}

/** What a board may ask of the session. */
export interface SessionApi {
  /** Notes committed so far. */
  readonly notes: readonly Fifths[];
  /** Sound a candidate as the next note of the sequence — right or wrong.
   * Boards call this on press, before proposing, so touch feels immediate. */
  voice(candidate: Fifths): void;
  /** Offer the next note. True if it continues the pattern and was committed;
   * false if it was wrong (the board renders its own rejection feedback). */
  propose(note: Fifths): boolean;
  /** Drop back to the first `n` committed notes (tap-to-undo). */
  rewind(n: number): void;
}

/** Everything that differs between the two games. */
export interface GameDef<R extends Round> {
  /** localStorage key for the remembered difficulty. */
  storageKey: string;
  /** Caption above the target sequence, e.g. "Find this sequence". */
  bandLabel: string;
  /** Optional per-round replacement for it. ToneSearch's label is fixed — the
   * shape below it IS the question. ToneScribe's question is a sentence that
   * changes every round, so it belongs here rather than in the small caption. */
  label?: (round: R) => string;
  /** Start-gate wordmark (may carry markup) and one-line explainer. */
  title: string;
  subtitle: string;
  /** Build a round for `tier`. */
  newRound(tier: Tier): R;
  /** The line under the target sequence. */
  caption(round: R): string;
  createBoard(shell: Shell, api: SessionApi): Board<R>;
}

type Phase = 'playing' | 'busy';

const isTier = (t: string): t is Tier =>
  t === 'easy' || t === 'medium' || t === 'hard' || t === 'expert';

function loadTier(key: string): Tier {
  try {
    const t = localStorage.getItem(key);
    if (t !== null && isTier(t)) return t;
  } catch {
    /* storage may be unavailable */
  }
  return 'easy'; // default
}

/** The voiced (ascending, root-seated) MIDI of the last note in `notes`. */
const lastVoiced = (notes: number[]): number => {
  const v = audio.ascendingMidis(notes);
  return v[v.length - 1]!;
};

export function startSession<R extends Round>(root: HTMLElement, def: GameDef<R>): void {
  const shell: Shell = mountShell(root, def.bandLabel);

  let round!: R;
  let board!: Board<R>;
  let tokenView!: TokenView;
  let notes: Fifths[] = [];
  let solved = 0;
  let phase: Phase = 'playing';
  let tier: Tier = loadTier(def.storageKey);

  // For rootless voicings (Expert; R absent), ground the notes/chord with the
  // player's implied root in the bass voice (docs/07 §4). No-op when rooted.
  const rootlessBass = (seq: number[], when = 0): void => {
    const iv = round.pattern.intervals;
    if (iv.includes(0) || seq.length === 0) return;
    audio.playRootBass(seq[0]! - iv[0]!, seq, when);
  };

  /** Push current progress to both views: the board and the target row. */
  const paint = (): void => {
    board.paint(notes);
    tokenView.tokenEls.forEach((el, i) => el.classList.toggle('selected', i < notes.length));
    drawTokenLine(tokenView, notes.length);
  };

  const api: SessionApi = {
    get notes() {
      return notes;
    },
    voice(candidate) {
      const seq = [...notes, candidate];
      audio.playNoteMidi(lastVoiced(seq));
      rootlessBass(seq);
    },
    propose(note) {
      if (phase !== 'playing') return false;
      const next = [...notes, note];
      if (!isPrefix(next, round.pattern)) return false;
      notes = next;
      paint();
      if (notes.length === round.solutionNotes.length) onSolve();
      return true;
    },
    rewind(n) {
      if (phase !== 'playing') return;
      notes = notes.slice(0, n);
      paint();
    },
  };

  const layout = (): void => {
    // One shared pitch drives both: target diamonds sized to fit up to 5, and
    // the board capped against it. Render the tokens FIRST so the band's height
    // is settled before the stage is measured — otherwise a play surface sized
    // to the pre-band stage height can overflow into the target row.
    const bandW = shell.tokensEl.parentElement?.clientWidth ?? window.innerWidth;
    const pitch = targetPitch(bandW - 24);
    tokenView = renderTokens(shell.tokensEl, round.pattern, pitch);
    board.layout(pitch);
    paint();
  };

  const newRound = (): void => {
    shell.giveUpBtn.classList.remove('lit'); // clear the held Give Up highlight
    round = def.newRound(tier);
    notes = [];
    if (def.label) shell.labelEl.textContent = def.label(round);
    shell.nameEl.textContent = def.caption(round);
    const bandW = shell.tokensEl.parentElement?.clientWidth ?? window.innerWidth;
    const pitch = targetPitch(bandW - 24);
    tokenView = renderTokens(shell.tokensEl, round.pattern, pitch);
    board.setRound(round, pitch);
    paint();
    if (import.meta.env.DEV) {
      (window as unknown as { __round: R }).__round = round;
    }
  };

  function setPhase(p: Phase): void {
    phase = p;
    board.setBusy(p === 'busy');
  }

  function onSolve(): void {
    setPhase('busy');
    shell.stageEl.classList.add('solved');
    shell.tokensEl.classList.add('solved');
    // Play the player's OWN notes (their root, which may differ from the
    // generator's) so the chord matches the arpeggio they just heard.
    // Match the give-up gap between the final note and the chord: reveal waits
    // one arpeggio step (520ms) + 170ms after the last note ≈ 690ms.
    if (round.pattern.kind === 'scale') {
      audio.playScaleRun(notes, 0.69); // a quick run up instead of a chord
    } else {
      audio.playChord(notes, 0.69);
      rootlessBass(notes, 0.69);
    }
    solved += 1;
    shell.counterEl.textContent = `Solved: ${solved}`;
    setTimeout(nextRound, 1450); // later chord → hold a bit longer before advancing
  }

  function reveal(): void {
    if (phase !== 'playing') return;
    setPhase('busy');
    const answer = round.solutionNotes;
    notes = [];
    paint();
    shell.stageEl.classList.add('solved');
    shell.tokensEl.classList.add('solved');

    // Reveal one note at a time, arpeggiated (rising) and in order — which also
    // makes the starting note obvious (it appears first).
    const stepMs = 520; // half speed — easier to follow
    answer.forEach((_n, i) => {
      setTimeout(() => {
        notes = answer.slice(0, i + 1);
        audio.playNoteMidi(lastVoiced(notes));
        rootlessBass(notes);
        paint();
      }, i * stepMs);
    });
    const arped = answer.length * stepMs;
    setTimeout(() => {
      if (round.pattern.kind === 'scale') {
        audio.playScaleRun(answer, 0.05); // cap the reveal with a quick run up
      } else {
        audio.playChord(answer, 0.05); // then the chord
        rootlessBass(answer, 0.05);
      }
    }, arped + 120);
    setTimeout(nextRound, arped + 4500); // ~3s extra pause to take it in
  }

  function nextRound(): void {
    shell.stageEl.classList.remove('solved');
    shell.tokensEl.classList.remove('solved');
    shell.stageEl.classList.add('fade');
    shell.bandEl.classList.add('fade'); // fade the target sequence + text in sync
    setTimeout(() => {
      setPhase('playing'); // before newRound so its paint shows live affordances
      newRound();
      shell.stageEl.classList.remove('fade');
      shell.bandEl.classList.remove('fade');
    }, 350);
  }

  shell.giveUpBtn.onpointerdown = () => {
    if (phase !== 'playing') return;
    shell.giveUpBtn.classList.add('lit'); // stay highlighted through the reveal
    reveal();
  };

  // Difficulty dropdown: reflect the loaded tier; on change, start a fresh round.
  shell.difficultyEl.value = tier;
  sizeDifficulty(shell.difficultyEl);
  shell.difficultyEl.onchange = (): void => {
    shell.difficultyEl.blur(); // drop focus so nothing stays highlighted
    if (phase !== 'playing') {
      shell.difficultyEl.value = tier; // ignore changes mid-solve/reveal
      sizeDifficulty(shell.difficultyEl);
      return;
    }
    const v = shell.difficultyEl.value;
    if (!isTier(v)) return;
    tier = v;
    sizeDifficulty(shell.difficultyEl); // caret follows the new word
    try {
      localStorage.setItem(def.storageKey, tier);
    } catch {
      /* storage may be unavailable */
    }
    setPhase('busy'); // block input during the fade
    nextRound(); // fade out → fresh round in the new tier → fade in
  };

  wireChrome(shell);
  window.addEventListener('resize', () => {
    if (phase === 'playing') layout();
  });

  board = def.createBoard(shell, api);
  newRound();
  showStartGate(root, def.title, def.subtitle);
}
