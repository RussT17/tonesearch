// game.ts — the shell orchestrator. Holds game state and wires input → audio →
// render → solve flow (docs/03-full-spec.md §5, §7).

import { generatePuzzle, isPrefix, type Puzzle } from './generate';
import { DEFAULT_CONFIG } from './config';
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
import { pitchClass } from './theory';
import * as audio from './audio';

type Phase = 'playing' | 'busy';

const TAP_BASE_MIDI = 60; // C4 — bottom of the ascending selection voicing

/** MIDI for a selected note voiced above the previous one (ascending path). */
function ascendMidi(note: number, prev: number | undefined): number {
  let m = TAP_BASE_MIDI + pitchClass(note);
  if (prev !== undefined) while (m <= prev) m += 12;
  return m;
}

export function startGame(root: HTMLElement): void {
  const shell: Shell = mountShell(root);

  let puzzle!: Puzzle;
  let view!: GridView;
  let tokenView!: TokenView;
  let selection: number[] = [];
  let selectionMidis: number[] = []; // ascending MIDI played for each selected note
  let solved = 0;
  let phase: Phase = 'playing';
  let coordOf = new Map<number, { col: number; row: number }>();
  let noteOf = new Map<number, number>();

  const adjacent = (a: number, b: number): boolean => {
    const ca = coordOf.get(a)!;
    const cb = coordOf.get(b)!;
    return Math.abs(ca.col - cb.col) + Math.abs(ca.row - cb.row) === 1;
  };

  // Sync both views to the current selection: grid cells + path line, and the
  // target's satisfied diamonds + pink line (incremental).
  const updateHighlights = (): void => {
    const sel = new Set(selection);
    view.cellEls.forEach((el, id) => el.classList.toggle('selected', sel.has(id)));
    drawPath(view, selection);
    tokenView.tokenEls.forEach((el, i) => el.classList.toggle('selected', i < selection.length));
    drawTokenLine(tokenView, selection.length);
  };

  const wireCells = (): void => {
    view.cellEls.forEach((el, id) => {
      // Sound on press. ANY unselected tap is voiced as the candidate NEXT note
      // (ascending above the last selected) — right or wrong — so the user can
      // hear how it would sound in position. Re-tapping a selected cell replays
      // its own pitch in context.
      el.onpointerdown = () => {
        if (phase !== 'playing') return;
        const idx = selection.indexOf(id);
        if (idx !== -1) audio.playNoteMidi(selectionMidis[idx]!);
        else audio.playNoteMidi(ascendMidi(noteOf.get(id)!, selectionMidis[selectionMidis.length - 1]));
      };
      el.onclick = () => onTap(id);
    });
  };

  const layout = (): void => {
    // One shared pitch drives both: target diamonds sized to fit up to 5, and
    // the grid capped at pitch/2 so a puzzle diamond never exceeds a target one.
    const bandW = shell.tokensEl.parentElement?.clientWidth ?? window.innerWidth;
    const pitch = targetPitch(bandW - 24);
    view = renderGrid(shell.stageEl, shell.gridEl, puzzle, pitch / 2);
    tokenView = renderTokens(shell.tokensEl, puzzle, pitch);
    wireCells();
    updateHighlights();
  };

  const newPuzzle = (): void => {
    puzzle = generatePuzzle(DEFAULT_CONFIG, Math.floor(Math.random() * 1e9));
    selection = [];
    selectionMidis = [];
    coordOf = new Map(puzzle.cells.map((c) => [c.id, { col: c.col, row: c.row }]));
    noteOf = new Map(puzzle.cells.map((c) => [c.id, c.note]));
    layout();
    if (import.meta.env.DEV) (window as unknown as { __solution: number[] }).__solution = puzzle.solutionPath;
  };

  const shake = (): void => {
    shell.gridEl.classList.add('shake');
    setTimeout(() => shell.gridEl.classList.remove('shake'), 320);
  };

  function onTap(id: number): void {
    if (phase !== 'playing') return;
    const next = updateSelection(selection, id, adjacent);
    if (next === selection) {
      shake(); // non-adjacent → doesn't continue the sequence
      return;
    }
    if (next.length > selection.length) {
      // appended a cell — per-step validation: it must continue the sequence
      const notes = next.map((cid) => noteOf.get(cid)!);
      if (!isPrefix(notes, puzzle.pattern)) {
        shake(); // wrong interval → doesn't continue
        return;
      }
      selectionMidis.push(ascendMidi(noteOf.get(id)!, selectionMidis[selectionMidis.length - 1]));
    } else {
      selectionMidis = selectionMidis.slice(0, next.length); // rewind
    }
    selection = next; // sound already played on pointerdown
    updateHighlights();
    if (selection.length === puzzle.solutionNotes.length) onSolve();
  }

  function onSolve(): void {
    phase = 'busy';
    shell.gridEl.classList.add('solved');
    shell.tokensEl.classList.add('solved');
    audio.playChord(puzzle.solutionNotes, 0.22); // chord only, after the final tap note settles
    solved += 1;
    shell.counterEl.textContent = `Solved: ${solved}`;
    setTimeout(nextPuzzle, 1150);
  }

  function reveal(): void {
    if (phase !== 'playing') return;
    phase = 'busy';
    selection = puzzle.solutionPath.slice();
    updateHighlights();
    shell.gridEl.classList.add('solved');
    shell.tokensEl.classList.add('solved');
    audio.playSequence(puzzle.solutionNotes);
    setTimeout(nextPuzzle, 1400); // Give Up: reveal, then advance (no increment)
  }

  function nextPuzzle(): void {
    shell.gridEl.classList.remove('solved');
    shell.tokensEl.classList.remove('solved');
    shell.stageEl.classList.add('fade');
    setTimeout(() => {
      newPuzzle();
      shell.stageEl.classList.remove('fade');
      phase = 'playing';
    }, 350);
  }

  shell.giveUpBtn.onclick = reveal;
  const paintMute = (m: boolean): void => {
    shell.muteBtn.textContent = m ? '🔇' : '🔊';
    shell.muteBtn.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
  };
  shell.muteBtn.onclick = () => paintMute(audio.toggleMuted());
  paintMute(audio.isMuted());
  window.addEventListener('resize', () => {
    if (phase === 'playing') layout();
  });

  // Resume audio when returning from background (mobile suspends it there).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) audio.unlock();
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
    sub.textContent = 'Find the interval sequence in the grid';
    const btn = document.createElement('button');
    btn.className = 'start-btn';
    btn.textContent = 'Play';
    inner.append(title, sub, btn);
    overlay.append(inner);

    let begun = false;
    const begin = (): void => {
      if (begun) return;
      begun = true;
      audio.unlock(); // resume + warm-up inside this gesture
      overlay.classList.add('hide');
      setTimeout(() => overlay.remove(), 400);
    };
    btn.addEventListener('click', begin);
    overlay.addEventListener('pointerdown', begin);
    root.append(overlay);
  }
}
