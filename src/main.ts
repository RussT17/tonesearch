// Bootstrap. Steps 6–8: mount and run the interactive game.
import './style.css';
import { startGame } from './game';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) startGame(app);
