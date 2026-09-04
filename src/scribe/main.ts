// main.ts — ToneScribe. Same session, same audio, same target row and chrome as
// ToneSearch; a staff instead of a grid, and a spoken prompt instead of a shape.

import '../shell/base.css';
import './theme.css';
import { sentenceSpans } from '../core/prompt';
import { startSession, type GameDef } from '../shell/session';
import { createStaffBoard } from './board';
import { generateScribeRound, type ScribeRound } from './round';

const toneScribe: GameDef<ScribeRound> = {
  storageKey: 'tonescribe.difficulty',
  // The instruction is the question, so it sits where ToneSearch puts "Find
  // this sequence" — above the intervals it refers to.
  bandLabel: 'Write this sequence',
  label: (round) => sentenceSpans(round),
  title: 'Tone<span class="hand">Scribe</span>',
  subtitle: 'Write the notes on the staff.',
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
