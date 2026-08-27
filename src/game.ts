// game.ts — the shell orchestrator. Holds game state and wires input → audio →
// render → solve flow (docs/03-full-spec.md §5, §7).

import { generatePuzzle, isSolution, type Puzzle } from './generate';
import { DEFAULT_CONFIG } from './config';
import { mountShell, renderGrid, renderTokens, drawPath, type Shell, type GridView } from './render';
import { updateSelection } from './input';
import * as audio from './audio';

type Phase = 'playing' | 'busy';

export function startGame(root: HTMLElement): void {
  const shell: Shell = mountShell(root);

  let puzzle!: Puzzle;
  let view!: GridView;
  let selection: number[] = [];
  let solved = 0;
  let phase: Phase = 'playing';
  let coordOf = new Map<number, { col: number; row: number }>();
  let noteOf = new Map<number, number>();

  const adjacent = (a: number, b: number): boolean => {
    const ca = coordOf.get(a)!;
    const cb = coordOf.get(b)!;
    return Math.abs(ca.col - cb.col) + Math.abs(ca.row - cb.row) === 1;
  };

  const highlight = (): void => {
    const sel = new Set(selection);
    view.cellEls.forEach((el, id) => el.classList.toggle('selected', sel.has(id)));
  };

  const wireCells = (): void => {
    view.cellEls.forEach((el, id) => {
      el.onclick = () => onTap(id);
    });
  };

  const layout = (): void => {
    view = renderGrid(shell.stageEl, shell.gridEl, puzzle);
    wireCells();
    highlight();
    drawPath(view, selection);
  };

  const newPuzzle = (): void => {
    puzzle = generatePuzzle(DEFAULT_CONFIG, Math.floor(Math.random() * 1e9));
    selection = [];
    coordOf = new Map(puzzle.cells.map((c) => [c.id, { col: c.col, row: c.row }]));
    noteOf = new Map(puzzle.cells.map((c) => [c.id, c.note]));
    renderTokens(shell.tokensEl, puzzle);
    layout();
    if (import.meta.env.DEV) (window as unknown as { __solution: number[] }).__solution = puzzle.solutionPath;
  };

  const nudge = (id: number): void => {
    const el = view.cellEls.get(id);
    if (!el) return;
    el.classList.add('nudge');
    setTimeout(() => el.classList.remove('nudge'), 200);
  };

  function onTap(id: number): void {
    if (phase !== 'playing') return;
    const next = updateSelection(selection, id, adjacent);
    if (next.length > selection.length) audio.playNote(noteOf.get(id)!); // appended
    else if (next.length === selection.length) {
      nudge(id); // rejected (non-adjacent)
      return;
    }
    selection = next;
    highlight();
    drawPath(view, selection);
    if (selection.length === puzzle.solutionNotes.length) check();
  }

  function check(): void {
    const notes = selection.map((id) => noteOf.get(id)!);
    if (isSolution(notes, puzzle.pattern)) onSolve();
    else onWrong();
  }

  function onWrong(): void {
    shell.gridEl.classList.add('shake');
    setTimeout(() => shell.gridEl.classList.remove('shake'), 320);
    selection = selection.slice(0, -1); // pop last, keep the correct prefix
    highlight();
    drawPath(view, selection);
  }

  function onSolve(): void {
    phase = 'busy';
    shell.gridEl.classList.add('solved');
    audio.playSequence(puzzle.solutionNotes);
    solved += 1;
    shell.counterEl.textContent = `Solved: ${solved}`;
    setTimeout(nextPuzzle, 1150);
  }

  function reveal(): void {
    if (phase !== 'playing') return;
    phase = 'busy';
    selection = puzzle.solutionPath.slice();
    highlight();
    drawPath(view, selection);
    shell.gridEl.classList.add('solved');
    audio.playSequence(puzzle.solutionNotes);
    setTimeout(nextPuzzle, 1400); // Give Up: reveal, then advance (no increment)
  }

  function nextPuzzle(): void {
    shell.gridEl.classList.remove('solved');
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

  // Keep audio unlocked: resume on the first (and every) pointer gesture, and
  // whenever the tab becomes visible again (mobile re-suspends on background).
  document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) audio.unlock();
  });

  newPuzzle();
}
