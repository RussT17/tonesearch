// main.ts — ToneSearch. Wires the shared session to the diamond-grid board and
// the grid-based round generator.

import '../style.css';
import { configFor } from '../core/config';
import { generatePuzzle, type Puzzle } from '../core/generate';
import { categoryLabel, type Pattern } from '../core/pattern';
import { startSession, type GameDef } from '../shell/session';
import { createGridBoard } from './board';

/** The caption: name + category word (Interval/Triad/Chord) + freeform qualifier
 * in parens ("reduced", "1st inversion", "rootless A"…) — docs/08. */
const patternName = (p: Pattern): string =>
  `${p.display} ${categoryLabel(p.kind)}${p.qualifier ? ` (${p.qualifier})` : ''}`;

const toneSearch: GameDef<Puzzle> = {
  storageKey: 'tonesearch.difficulty',
  bandLabel: 'Find this sequence',
  title: 'ToneSearch',
  subtitle: 'Find the interval sequence in the grid.',
  newRound: (tier) => generatePuzzle(configFor(tier), Math.floor(Math.random() * 1e9)),
  caption: (round) => patternName(round.pattern),
  createBoard: createGridBoard,
};

const app = document.querySelector<HTMLDivElement>('#app');
if (app) startSession(app, toneSearch);
