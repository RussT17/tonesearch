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
            audio.playNoteMidi(ascendMidi(noteOf.get(id)!, selectionMidis[selectionMidis.length - 1]));
          } // non-adjacent → no sound
        }
        onTap(id);
      };
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
    updateHighlights(); // clear clickable highlights
    // Play the player's OWN selected notes (their root, which may differ from the
    // generator's) so the chord matches the arpeggio they just heard.
    const selectedNotes = selection.map((id) => noteOf.get(id)!);
    audio.playChord(selectedNotes, 0.4); // chord only, well after the final tap note
    solved += 1;
    shell.counterEl.textContent = `Solved: ${solved}`;
    setTimeout(nextPuzzle, 1150);
  }

  function reveal(): void {
    if (phase !== 'playing') return;
    phase = 'busy';
    const path = puzzle.solutionPath;
    selection = [];
    selectionMidis = [];
    updateHighlights();
    shell.gridEl.classList.add('solved');
    shell.tokensEl.classList.add('solved');

    // Reveal the path one note at a time, arpeggiated (rising) and in order —
    // which also makes the starting note obvious (it appears first).
    const stepMs = 520; // half speed — easier to follow
    path.forEach((id, i) => {
      setTimeout(() => {
        selection = path.slice(0, i + 1);
        const m = ascendMidi(noteOf.get(id)!, selectionMidis[selectionMidis.length - 1]);
        selectionMidis.push(m);
        audio.playNoteMidi(m);
        updateHighlights();
      }, i * stepMs);
    });
    const arped = path.length * stepMs;
    setTimeout(() => audio.playChord(puzzle.solutionNotes, 0.05), arped + 120); // then the chord
    setTimeout(nextPuzzle, arped + 4500); // ~3s extra pause to take it all in, then advance
  }

  function nextPuzzle(): void {
    shell.gridEl.classList.remove('solved');
    shell.tokensEl.classList.remove('solved');
    shell.stageEl.classList.add('fade');
    setTimeout(() => {
      phase = 'playing'; // before newPuzzle so its updateHighlights paints clickables
      newPuzzle();
      shell.stageEl.classList.remove('fade');
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
