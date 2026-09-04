// main.ts — ToneScribe. Same session, same audio, same target row and chrome as
// ToneSearch; a staff instead of a grid, and a spoken prompt instead of a shape.

import '../shell/base.css';
import './theme.css';
import { categoryLabel } from '../core/pattern';
import { keyLine, promptLine } from '../core/prompt';
import { startSession, type GameDef } from '../shell/session';
import { createStaffBoard } from './board';
import { generateScribeRound, type ScribeRound } from './round';

const toneScribe: GameDef<ScribeRound> = {
  storageKey: 'tonescribe.difficulty',
  // The instruction is the question, so it sits where ToneSearch puts "Find
  // this sequence" — above the intervals it refers to.
  bandLabel: 'Write this sequence',
  label: (round) => `${promptLine(round)} ${keyLine(round)}`,
  title: 'Tone<span class="hand">Scribe</span>',
  subtitle: 'Write the notes on the staff.',
  newRound: (tier) => generateScribeRound(tier, Math.floor(Math.random() * 1e9)),
  // The quality in words, under the intervals — the same secondary hint
  // ToneSearch gives, and a check on the roman numeral above.
  caption: (round) =>
    round.pattern.kind === 'note'
      ? ''
      : `${round.pattern.display} ${categoryLabel(round.pattern.kind)}`,
  // The staff writes the octave down, so it must sound where it is written.
  midisFor: (round, notes) => notes.map((_n, i) => round.solutionMidis[i]!),
  createBoard: createStaffBoard,
};

const app = document.querySelector<HTMLDivElement>('#app');
if (app) startSession(app, toneScribe);
