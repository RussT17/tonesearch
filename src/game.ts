// game.ts — the shell orchestrator. Holds game state and wires input → audio →
// render → solve flow (docs/03-full-spec.md §5, §7).

import { generatePuzzle, isPrefix, type Puzzle } from './generate';
import { configFor } from './config';
import { bankForTier, categoryLabel, type Pattern, type Tier } from './bank';
import {
  mountShell,
  renderGrid,
  renderTokens,
  targetPitch,
  drawPath,
  drawTokenLine,
  type Shell,
  type GridView,
  type TokenView,
} from './render';
import { updateSelection } from './input';
import * as audio from './audio';

type Phase = 'playing' | 'busy';

const TIER_KEY = 'tonesearch.difficulty';

const isTier = (t: string): t is Tier =>
  t === 'easy' || t === 'medium' || t === 'hard' || t === 'expert';

function loadTier(): Tier {
  try {
    const t = localStorage.getItem(TIER_KEY);
    if (t !== null && isTier(t)) return t;
  } catch {
    /* storage may be unavailable */
  }
  return 'easy'; // default
}

/** The caption: name + category word (Interval/Triad/Chord) + freeform qualifier
 * in parens ("reduced", "1st inversion", "rootless A"…) — docs/08. */
const patternName = (p: Pattern): string =>
  `${p.display} ${categoryLabel(p.kind)}${p.qualifier ? ` (${p.qualifier})` : ''}`;

/** The voiced (ascending, root-seated) MIDI of the last note in `notes`. */
const lastVoiced = (notes: number[]): number => {
  const v = audio.ascendingMidis(notes);
  return v[v.length - 1]!;
};

// Mono (currentColor) speaker icons for the mute toggle.
const SPEAKER_BODY = '<path d="M3 10v4a1 1 0 0 0 1 1h3l4 4V5L7 9H4a1 1 0 0 0-1 1z" fill="currentColor"/>';
const ICON_SOUND_ON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + SPEAKER_BODY +
  '<path d="M15.5 9a4 4 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
  '<path d="M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_SOUND_OFF =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + SPEAKER_BODY +
  '<path d="M15.5 9.5l5 5M20.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

/** The `beforeinstallprompt` event (not in the standard DOM lib types). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function startGame(root: HTMLElement): void {
  const shell: Shell = mountShell(root);

  let puzzle!: Puzzle;
  let view!: GridView;
  let tokenView!: TokenView;
  let selection: number[] = [];
  let solved = 0;
  let phase: Phase = 'playing';
  let tier: Tier = loadTier();
  let coordOf = new Map<number, { col: number; row: number }>();
  let noteOf = new Map<number, number>();

  const adjacent = (a: number, b: number): boolean => {
    const ca = coordOf.get(a)!;
    const cb = coordOf.get(b)!;
    return Math.abs(ca.col - cb.col) + Math.abs(ca.row - cb.row) === 1;
  };

  // For rootless voicings (Expert; R absent), ground the notes/chord with the
  // player's implied root in the bass voice (docs/07 §4). No-op for rooted patterns.
  const rootlessBass = (notes: number[], when = 0): void => {
    const iv = puzzle.pattern.intervals;
    if (iv.includes(0) || notes.length === 0) return;
    audio.playRootBass(notes[0]! - iv[0]!, notes, when);
  };

  // Sync both views to the current selection: grid selected/clickable/start,
  // path line, and the target's satisfied diamonds + pink line (incremental).
  const updateHighlights = (): void => {
    const sel = new Set(selection);
    const last = selection[selection.length - 1];
    view.cellEls.forEach((el, id) => {
      el.classList.toggle('selected', sel.has(id));
      const clickable =
        phase === 'playing' &&
        !sel.has(id) &&
        (selection.length === 0 || (last !== undefined && adjacent(last, id)));
      el.classList.toggle('clickable', clickable);
    });
    drawPath(view, selection);
    tokenView.tokenEls.forEach((el, i) => el.classList.toggle('selected', i < selection.length));
    drawTokenLine(tokenView, selection.length);
  };

  const wireCells = (): void => {
    view.cellEls.forEach((el, id) => {
      // Sound AND action on press (immediate; also robust to press-and-hold).
      // A clickable tap is voiced as the candidate NEXT note (ascending), right
      // or wrong; a re-tap of a selected cell blips; non-adjacent is inert.
      el.onpointerdown = () => {
        if (phase !== 'playing') return;
        if (selection.includes(id)) {
          audio.playCancel(); // re-tap → rewind (deselect blip)
        } else {
          const last = selection[selection.length - 1];
          const clickable = selection.length === 0 || (last !== undefined && adjacent(last, id));
          if (clickable) {
            // voice the candidate as the next note of the prospective sequence
            const seq = [...selection.map((c) => noteOf.get(c)!), noteOf.get(id)!];
            audio.playNoteMidi(lastVoiced(seq));
            rootlessBass(seq); // + the implied root, if this is a rootless voicing
          } // non-adjacent → no sound
        }
        onTap(id);
      };
    });
  };

  const layout = (): void => {
    // One shared pitch drives both: target diamonds sized to fit up to 5, and
    // the grid capped at pitch/2 so a puzzle diamond never exceeds a target one.
    // Render the tokens FIRST so the band's height is settled before the grid is
    // measured against the stage — otherwise a grid sized to the pre-band stage
    // height can overflow down into the target row.
    const bandW = shell.tokensEl.parentElement?.clientWidth ?? window.innerWidth;
    const pitch = targetPitch(bandW - 24);
    tokenView = renderTokens(shell.tokensEl, puzzle, pitch);
    view = renderGrid(shell.stageEl, shell.gridEl, puzzle, pitch / 2);
    wireCells();
    updateHighlights();
  };

  const newPuzzle = (): void => {
    shell.giveUpBtn.classList.remove('lit'); // clear the held Give Up highlight
    puzzle = generatePuzzle(configFor(tier), bankForTier(tier), Math.floor(Math.random() * 1e9));
    selection = [];
    coordOf = new Map(puzzle.cells.map((c) => [c.id, { col: c.col, row: c.row }]));
    noteOf = new Map(puzzle.cells.map((c) => [c.id, c.note]));
    shell.nameEl.textContent = patternName(puzzle.pattern);
    layout();
    if (import.meta.env.DEV) (window as unknown as { __solution: number[] }).__solution = puzzle.solutionPath;
  };

  const flashWrong = (id: number): void => {
    const el = view.cellEls.get(id);
    if (!el) return;
    el.classList.add('wrong');
    setTimeout(() => el.classList.remove('wrong'), 420);
  };

  function onTap(id: number): void {
    if (phase !== 'playing') return;
    const next = updateSelection(selection, id, adjacent);
    if (next === selection) return; // non-adjacent → fully inert (no sound, no visual)
    if (next.length > selection.length) {
      // appended a cell — per-step validation: it must continue the sequence
      const notes = next.map((cid) => noteOf.get(cid)!);
      if (!isPrefix(notes, puzzle.pattern)) {
        flashWrong(id); // adjacent but wrong interval → gentle reddish flash on the cell
        return;
      }
    }
    selection = next; // sound already played on pointerdown
    updateHighlights();
    if (selection.length === puzzle.solutionNotes.length) onSolve();
  }

  function onSolve(): void {
    phase = 'busy';
    shell.gridEl.classList.add('solved');
    shell.tokensEl.classList.add('solved');
    updateHighlights(); // clear clickable highlights
    // Play the player's OWN selected notes (their root, which may differ from the
    // generator's) so the chord matches the arpeggio they just heard.
    const selectedNotes = selection.map((id) => noteOf.get(id)!);
    // Match the give-up gap between the final note and the chord: reveal waits one
    // arpeggio step (520ms) + 170ms after the last note ≈ 690ms.
    if (puzzle.pattern.kind === 'scale') {
      audio.playScaleRun(selectedNotes, 0.69); // a quick run up instead of a chord
    } else {
      audio.playChord(selectedNotes, 0.69);
      rootlessBass(selectedNotes, 0.69); // implied root under the chord (rootless only)
    }
    solved += 1;
    shell.counterEl.textContent = `Solved: ${solved}`;
    setTimeout(nextPuzzle, 1450); // later chord → hold a bit longer before advancing
  }

  function reveal(): void {
    if (phase !== 'playing') return;
    phase = 'busy';
    const path = puzzle.solutionPath;
    selection = [];
    updateHighlights();
    shell.gridEl.classList.add('solved');
    shell.tokensEl.classList.add('solved');

    // Reveal the path one note at a time, arpeggiated (rising) and in order —
    // which also makes the starting note obvious (it appears first).
    const stepMs = 520; // half speed — easier to follow
    path.forEach((_id, i) => {
      setTimeout(() => {
        selection = path.slice(0, i + 1);
        const notes = selection.map((c) => noteOf.get(c)!);
        audio.playNoteMidi(lastVoiced(notes));
        rootlessBass(notes); // + implied root (rootless only)
        updateHighlights();
      }, i * stepMs);
    });
    const arped = path.length * stepMs;
    // Scales already climb note-by-note in the reveal — no closing chord needed.
    if (puzzle.pattern.kind !== 'scale') {
      setTimeout(() => {
        audio.playChord(puzzle.solutionNotes, 0.05); // then the chord
        rootlessBass(puzzle.solutionNotes, 0.05);
      }, arped + 120);
    }
    setTimeout(nextPuzzle, arped + 4500); // ~3s extra pause to take it all in, then advance
  }

  function nextPuzzle(): void {
    shell.gridEl.classList.remove('solved');
    shell.tokensEl.classList.remove('solved');
    shell.stageEl.classList.add('fade');
    shell.bandEl.classList.add('fade'); // fade the target sequence + text in sync
    setTimeout(() => {
      phase = 'playing'; // before newPuzzle so its updateHighlights paints clickables
      newPuzzle();
      shell.stageEl.classList.remove('fade');
      shell.bandEl.classList.remove('fade');
    }, 350);
  }

  shell.giveUpBtn.onpointerdown = () => {
    if (phase !== 'playing') return;
    shell.giveUpBtn.classList.add('lit'); // stay highlighted through the reveal
    reveal();
  };

  // Size the borderless dropdown to its current word so the caret trails the word
  // by a fixed gap (a native select would otherwise size to the widest option).
  const sizeDifficulty = (): void => {
    const s = shell.difficultyEl;
    const cs = getComputedStyle(s);
    const span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.visibility = 'hidden';
    span.style.whiteSpace = 'pre';
    span.style.fontFamily = cs.fontFamily;
    span.style.fontSize = cs.fontSize;
    span.style.fontWeight = cs.fontWeight;
    span.style.fontStyle = cs.fontStyle;
    span.style.letterSpacing = cs.letterSpacing;
    span.style.textTransform = cs.textTransform;
    span.textContent = s.options[s.selectedIndex]?.text ?? '';
    document.body.appendChild(span);
    const wordW = span.offsetWidth;
    span.remove();
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    s.style.width = `${Math.ceil(wordW + padL + padR)}px`;
  };

  // Difficulty dropdown: reflect the loaded tier; on change, start a fresh puzzle.
  shell.difficultyEl.value = tier;
  sizeDifficulty();
  shell.difficultyEl.onchange = (): void => {
    shell.difficultyEl.blur(); // drop focus so nothing stays highlighted
    if (phase !== 'playing') {
      shell.difficultyEl.value = tier; // ignore changes mid-solve/reveal; keep in sync
      sizeDifficulty();
      return;
    }
    const v = shell.difficultyEl.value;
    if (!isTier(v)) return;
    tier = v;
    sizeDifficulty(); // caret follows the new word
    try {
      localStorage.setItem(TIER_KEY, tier);
    } catch {
      /* storage may be unavailable */
    }
    phase = 'busy'; // block taps during the fade
    nextPuzzle(); // fade out → fresh puzzle in the new tier → fade in
  };

  const paintMute = (m: boolean): void => {
    shell.muteBtn.innerHTML = m ? ICON_SOUND_OFF : ICON_SOUND_ON;
    shell.muteBtn.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
  };
  shell.muteBtn.onclick = () => paintMute(audio.toggleMuted());
  paintMute(audio.isMuted());

  // PWA install: suppress Chrome's automatic prompt and expose our own corner
  // button instead, shown only while the app is installable (i.e. not already
  // installed — the event stops firing once installed / when run standalone).
  let deferredPrompt: BeforeInstallPromptEvent | null = null;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // no auto mini-infobar; we drive it from the button
    deferredPrompt = e as BeforeInstallPromptEvent;
    if (!standalone) shell.installBtn.classList.add('show');
  });
  shell.installBtn.onclick = () => {
    if (!deferredPrompt) return;
    void deferredPrompt.prompt();
    void deferredPrompt.userChoice.finally(() => {
      deferredPrompt = null;
      shell.installBtn.classList.remove('show'); // one-shot; hide after the choice
    });
  };
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    shell.installBtn.classList.remove('show');
  });
  window.addEventListener('resize', () => {
    if (phase === 'playing') layout();
  });

  // Stop the keep-alive in the background (let Bluetooth idle → save battery);
  // resume + restart it on return.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.stopKeepAlive();
    else audio.unlock();
  });

  newPuzzle();
  showStartGate();

  // "Tap to start" gate: the first gesture unlocks + warms the audio pipeline
  // while no sound is expected, so the first real note tap is lag-free.
  function showStartGate(): void {
    const overlay = document.createElement('div');
    overlay.className = 'start-overlay';
    const inner = document.createElement('div');
    inner.className = 'start-inner';
    const title = document.createElement('div');
    title.className = 'start-title';
    title.textContent = 'ToneSearch';
    const sub = document.createElement('div');
    sub.className = 'start-sub';
    sub.textContent = 'Find the interval sequence in the grid.';
    // Play button as a widened diamond (hexagon: left/right points + flat
    // top/bottom edges), styled like a lit target diamond with the word inside.
    const btn = document.createElement('button');
    btn.className = 'start-btn';
    btn.innerHTML =
      '<svg class="hex" viewBox="0 0 144 52" aria-hidden="true">' +
      '<path d="M 5.38 29.69 Q 2 26 5.38 22.31 L 20.62 5.69 Q 24 2 29 2 L 115 2 Q 120 2 123.38 5.69 L 138.62 22.31 Q 142 26 138.62 29.69 L 123.38 46.31 Q 120 50 115 50 L 29 50 Q 24 50 20.62 46.31 Z" vector-effect="non-scaling-stroke"/>' +
      '</svg><span>Play</span>';
    inner.append(title, sub, btn);
    overlay.append(inner);

    let begun = false;
    const begin = (): void => {
      if (begun) return;
      begun = true;
      audio.unlock(); // resume + warm-up inside this gesture
      btn.classList.add('lit'); // brighten like a tapped note cell
      setTimeout(() => {
        overlay.classList.add('hide');
        setTimeout(() => overlay.remove(), 400);
      }, 150); // brief hold so the press registers before the fade
    };
    btn.addEventListener('click', begin);
    overlay.addEventListener('pointerdown', begin);
    root.append(overlay);
  }
}
