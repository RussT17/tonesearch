// main.ts — ToneScribe. Same session, same audio, same target row and chrome as
// ToneSearch; a staff instead of a grid, and a spoken prompt instead of a shape.

import '../shell/base.css';
import './theme.css';
import { sentenceSpans } from '../core/prompt';
import { startSession, type GameDef } from '../shell/session';
import { createStaffBoard } from './board';
import { generateScribeRound, type ScribeRound } from './round';
import { noteName } from '../core/theory';

/** ToneScribe's Play button: a card, like the target row and the note buttons —
 * ToneSearch's widened diamond belongs to ToneSearch's lattice. */
const CARD_PLAY = {
  viewBox: '0 0 144 52',
  d: 'M 14 2 L 130 2 Q 142 2 142 14 L 142 38 Q 142 50 130 50 L 14 50 Q 2 50 2 38 L 2 14 Q 2 2 14 2 Z',
};

const toneScribe: GameDef<ScribeRound> = {
  storageKey: 'tonescribe.difficulty',
  // The instruction is the question, so it sits where ToneSearch puts "Find
  // this sequence" — above the intervals it refers to.
  bandLabel: 'Write this sequence',
  label: (round) => sentenceSpans(round),
  title: 'Tone<span class="hand">Scribe</span>',
  subtitle: 'Write the notes on the staff.',
  playShape: CARD_PLAY,
  // Split cards rather than diamonds: the interval on top, and the note it
  // turns out to name underneath, written in as you get it. By the end the row
  // reads as the worked answer, which is the thing worth keeping.
  tokenShape: 'card',
  // The question goes above the staff it is answered on. Reading it under the
  // staff meant looking down for the prompt and back up to write, every round.
  bandFirst: true,
  tokenSubLabels: (round) => round.solutionNotes.map(noteName),
  newRound: (tier) => generateScribeRound(tier, Math.floor(Math.random() * 1e9)),
  // Nothing under the intervals: ToneSearch puts the pattern's name there
  // because its prompt is a shape, but here the line above already names it.
  caption: () => '',
  // The staff writes the octave down, so it must sound where it is written.
  midisFor: (round, notes) => notes.map((_n, i) => round.solutionMidis[i]!),
  createBoard: createStaffBoard,
};

const app = document.querySelector<HTMLDivElement>('#app');
if (app) startSession(app, toneScribe);
