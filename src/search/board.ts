// board.ts — ToneSearch's play surface as a session Board. Owns the diamond
// grid, its tap handling and its own feedback; converts taps into note
// proposals and reflects whatever the session commits.
//
// Adjacency lives here on purpose: it is an input restriction, not a rule about
// the answer. The session validates notes and knows nothing about the lattice.

import type { Puzzle } from '../core/generate';
import type { Fifths } from '../core/theory';
import * as audio from '../shell/audio';
import type { Board, SessionApi } from '../shell/session';
import type { Shell } from '../shell/chrome';
import { drawPath, renderGrid, type GridView } from './render';
import { updateSelection } from './input';

export function createGridBoard(shell: Shell, api: SessionApi): Board<Puzzle> {
  const gridEl = document.createElement('div');
  gridEl.className = 'grid';
  shell.stageEl.append(gridEl);
  shell.stageEl.setAttribute('aria-label', 'Note grid');

  let puzzle!: Puzzle;
  let view!: GridView;
  let busy = false;
  /** Cell ids chosen so far — the board's private view of the session's notes. */
  let selection: number[] = [];
  let coordOf = new Map<number, { col: number; row: number }>();
  let noteOf = new Map<number, Fifths>();

  const adjacent = (a: number, b: number): boolean => {
    const ca = coordOf.get(a)!;
    const cb = coordOf.get(b)!;
    return Math.abs(ca.col - cb.col) + Math.abs(ca.row - cb.row) === 1;
  };

  /** A cell is tappable if it would continue the path from the last one. */
  const clickable = (id: number): boolean => {
    const last = selection[selection.length - 1];
    return last === undefined || adjacent(last, id);
  };

  const flashWrong = (id: number): void => {
    const el = view.cellEls.get(id);
    if (!el) return;
    el.classList.add('wrong');
    setTimeout(() => el.classList.remove('wrong'), 420);
  };

  const repaint = (): void => {
    const sel = new Set(selection);
    view.cellEls.forEach((el, id) => {
      el.classList.toggle('selected', sel.has(id));
      el.classList.toggle('clickable', !busy && !sel.has(id) && clickable(id));
    });
    drawPath(view, selection);
  };

  const wireCells = (): void => {
    view.cellEls.forEach((el, id) => {
      // Sound AND action on press (immediate; also robust to press-and-hold).
      // A tappable cell is voiced as the candidate NEXT note (ascending), right
      // or wrong; a re-tap of a selected cell blips; non-adjacent is inert.
      el.onpointerdown = () => {
        if (busy) return;
        const next = updateSelection(selection, id, adjacent);
        if (next === selection) return; // non-adjacent → fully inert (no sound, no visual)
        if (next.length < selection.length) {
          audio.playCancel(); // re-tap → rewind (deselect blip)
          selection = next;
          api.rewind(next.length);
          return;
        }
        const note = noteOf.get(id)!;
        api.voice(note); // voice the candidate before judging it
        if (api.propose(note)) selection = next;
        else flashWrong(id); // adjacent but wrong interval → gentle reddish flash
      };
    });
  };

  const build = (tokenPitch: number): void => {
    // Cap cell size at half the target pitch so a puzzle diamond never exceeds
    // a target diamond.
    view = renderGrid(shell.stageEl, gridEl, puzzle, tokenPitch / 2);
    wireCells();
    repaint();
  };

  return {
    setRound(next, tokenPitch) {
      puzzle = next;
      selection = [];
      coordOf = new Map(puzzle.cells.map((c) => [c.id, { col: c.col, row: c.row }]));
      noteOf = new Map(puzzle.cells.map((c) => [c.id, c.note]));
      build(tokenPitch);
      if (import.meta.env.DEV) {
        (window as unknown as { __solution: number[] }).__solution = puzzle.solutionPath;
      }
    },
    layout(tokenPitch) {
      build(tokenPitch);
    },
    paint(notes) {
      // The session drives the reveal by pushing notes the player never tapped,
      // so re-derive the path from the solution when our own trail falls behind.
      if (notes.length !== selection.length) {
        selection = puzzle.solutionPath.slice(0, notes.length);
      }
      repaint();
    },
    setBusy(b) {
      busy = b;
      repaint();
    },
  };
}
