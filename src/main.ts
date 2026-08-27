// Bootstrap. Step 5: mount the shell and statically render one generated puzzle
// (no interaction yet — that arrives with input.ts/game.ts).
import './style.css';
import { mountShell, renderGrid, renderTokens } from './render';
import { generatePuzzle } from './generate';
import { DEFAULT_CONFIG } from './config';

const app = document.querySelector<HTMLDivElement>('#app')!;
const shell = mountShell(app);

const puzzle = generatePuzzle(DEFAULT_CONFIG, Math.floor(Math.random() * 1e9));
renderTokens(shell.tokensEl, puzzle);

const draw = (): void => {
  renderGrid(shell.stageEl, shell.gridEl, puzzle);
};

requestAnimationFrame(draw);
window.addEventListener('resize', draw);
