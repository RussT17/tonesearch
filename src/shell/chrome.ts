// chrome.ts — the app frame every game wears: top bar (difficulty + solved
// counter), the target-sequence band with its caption and Give Up, the corner
// install/mute buttons, and the "tap to start" gate that unlocks audio.
//
// Deliberately game-agnostic: it owns no puzzle state and knows nothing about
// grids or staves. It hands back element handles plus a `stage` region, and the
// game fills that stage with whatever it plays on.

import * as audio from './audio';

// Mono (currentColor) glyphs, sized by CSS.
const ICON_INSTALL =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M12 3v10m0 0l-3.5-3.5M12 13l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M5 20h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const SPEAKER_BODY =
  '<path d="M3 10v4a1 1 0 0 0 1 1h3l4 4V5L7 9H4a1 1 0 0 0-1 1z" fill="currentColor"/>';
const ICON_SOUND_ON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + SPEAKER_BODY +
  '<path d="M15.5 9a4 4 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
  '<path d="M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_SOUND_OFF =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + SPEAKER_BODY +
  '<path d="M15.5 9.5l5 5M20.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

/** The `beforeinstallprompt` event (not in the standard DOM lib types). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface Shell {
  difficultyEl: HTMLSelectElement;
  counterEl: HTMLElement;
  stageEl: HTMLElement; // the game's play surface (grid, staff, …)
  tokensEl: HTMLElement; // the target sequence
  bandEl: HTMLElement; // whole target band (label + tokens + name), for fading
  labelEl: HTMLElement;
  nameEl: HTMLElement;
  installBtn: HTMLButtonElement;
  giveUpBtn: HTMLButtonElement;
  muteBtn: HTMLButtonElement;
}

const el = <T extends HTMLElement>(tag: string, cls?: string, text?: string): T => {
  const e = document.createElement(tag) as T;
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** How to install by hand, for browsers that will not offer to do it. Read off
 * the user agent because there is nothing better: no API reports where a given
 * browser keeps its install command, and a wrong instruction is worse than
 * none — hence the vague last line rather than a guess. */
function manualInstallStep(): string {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) return 'To install: tap Share, then “Add to Home Screen”.';
  if (/Android/.test(ua)) return 'To install: open the browser menu (the three dots), then “Install app”.';
  return 'To install: use your browser’s menu — look for “Install”.';
}

/**
 * Build the static app skeleton once; returns handles to the live regions.
 *
 * `bandFirst` puts the target band above the play surface. ToneSearch reads
 * top-down from the grid you are hunting in to the shape you are hunting for,
 * which is the order you look at them in. ToneScribe is the other way round: its
 * band carries the question in words, and a question belongs above the staff it
 * is answered on, not below it.
 */
export function mountShell(root: HTMLElement, bandLabel: string, bandFirst = false): Shell {
  root.innerHTML = '';

  const topbar = el('div', 'topbar');
  const difficultyEl = el<HTMLSelectElement>('select', 'difficulty');
  difficultyEl.setAttribute('aria-label', 'Difficulty');
  for (const [value, label] of [
    ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['expert', 'Expert'],
  ] as const) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    difficultyEl.append(opt);
  }
  const counterEl = el('span', 'counter', 'Solved: 0');
  topbar.append(difficultyEl, counterEl);

  const stageEl = el('div', 'stage');
  stageEl.setAttribute('aria-label', 'Play area');

  const labelEl = el('div', 'tokens-label', bandLabel);
  const tokensEl = el('div', 'tokens');
  tokensEl.setAttribute('aria-label', 'Target intervals');
  const nameEl = el('div', 'seq-name'); // subtle chord/interval name (always visible)
  // Give Up belongs to the current puzzle, so it fades with the band — but it is
  // a sibling of it, not a child: the band moves above the play surface in
  // ToneScribe and Give Up must not travel with it into the middle of the page.
  const giveUpBtn = el<HTMLButtonElement>('button', 'giveup', 'Give Up');
  giveUpBtn.setAttribute('aria-label', 'Give up and reveal the answer');
  const bandEl = el('div', 'tokens-band');
  bandEl.append(labelEl, tokensEl, nameEl);

  // App-level chrome: borderless, pinned to the screen corners (low prominence).
  const installBtn = el<HTMLButtonElement>('button', 'install');
  installBtn.innerHTML = `${ICON_INSTALL}<span>Install</span>`;
  installBtn.setAttribute('aria-label', 'Install app');
  const muteBtn = el<HTMLButtonElement>('button', 'mute'); // icon set by wireChrome
  muteBtn.setAttribute('aria-label', 'Mute');

  // Flexible bottom spacer: pulls the stage + target group upward.
  const footSpacer = el('div', 'foot-spacer');

  const middle = bandFirst ? [bandEl, stageEl] : [stageEl, bandEl];
  root.append(topbar, ...middle, giveUpBtn, footSpacer, installBtn, muteBtn);
  return { difficultyEl, counterEl, stageEl, tokensEl, bandEl, labelEl, nameEl, installBtn, giveUpBtn, muteBtn };
}

/**
 * Size the borderless dropdown to its current word so the caret trails the word
 * by a fixed gap (a native select would otherwise size to the widest option).
 */
export function sizeDifficulty(s: HTMLSelectElement): void {
  const cs = getComputedStyle(s);
  const span = document.createElement('span');
  span.style.position = 'absolute';
  span.style.visibility = 'hidden';
  span.style.whiteSpace = 'pre';
  span.style.fontFamily = cs.fontFamily;
  span.style.fontSize = cs.fontSize;
  span.style.fontWeight = cs.fontWeight;
  span.style.fontStyle = cs.fontStyle;
  span.style.letterSpacing = cs.letterSpacing;
  span.style.textTransform = cs.textTransform;
  span.textContent = s.options[s.selectedIndex]?.text ?? '';
  document.body.appendChild(span);
  const wordW = span.offsetWidth;
  span.remove();
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  s.style.width = `${Math.ceil(wordW + padL + padR)}px`;
}

/** Mute toggle, install prompt and background-audio handling — identical in
 * every game, so wired once here. */
export function wireChrome(shell: Shell): void {
  const paintMute = (m: boolean): void => {
    shell.muteBtn.innerHTML = m ? ICON_SOUND_OFF : ICON_SOUND_ON;
    shell.muteBtn.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
  };
  shell.muteBtn.onclick = () => paintMute(audio.toggleMuted());
  paintMute(audio.isMuted());

  // PWA install: suppress the browser's automatic prompt and expose our own
  // corner button instead.
  //
  // beforeinstallprompt cannot be the only way in: Safari has never fired it, and
  // Chrome withholds it whenever it decides the page is already covered by an
  // installed app. So the button also appears without the event, and then says
  // how to install by hand. (The two games used to trip that second case on each
  // other — ToneScribe sat inside ToneSearch's scope — which is why they are now
  // siblings under a scope-less landing page; see vite.config.ts.)
  let deferredPrompt: BeforeInstallPromptEvent | null = null;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  const hide = (): void => {
    shell.installBtn.classList.remove('show', 'manual');
    tip.classList.remove('show');
  };

  // The by-hand instructions, which differ per browser and are useless if wrong.
  const tip = el('div', 'install-tip', manualInstallStep());
  tip.setAttribute('role', 'status');
  shell.installBtn.after(tip);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    if (standalone) return;
    // The browser will do it properly after all — drop the by-hand fallback.
    shell.installBtn.classList.add('show');
    shell.installBtn.classList.remove('manual');
    tip.classList.remove('show');
  });
  shell.installBtn.onclick = () => {
    if (!deferredPrompt) {
      tip.classList.toggle('show'); // no prompt to offer: explain instead
      return;
    }
    tip.classList.remove('show');
    void deferredPrompt.prompt();
    void deferredPrompt.userChoice.finally(() => {
      deferredPrompt = null;
      hide(); // one-shot; hide after the choice
    });
  };
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hide();
  });

  // Nothing offered the prompt, so offer the instructions. Late enough that a
  // browser which was going to fire the event has had its chance — Chrome fires
  // it once the worker is controlling, which is well inside this.
  if (!standalone) {
    setTimeout(() => {
      if (deferredPrompt) return;
      shell.installBtn.classList.add('show', 'manual');
    }, 3000);
  }

  // Stop the keep-alive in the background (let Bluetooth idle → save battery);
  // resume + restart it on return.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.stopKeepAlive();
    else audio.unlock();
  });
}

/**
 * "Tap to start" gate: the first gesture unlocks + warms the audio pipeline
 * while no sound is expected, so the first real note tap is lag-free.
 */
/** The Play button's outline. Per-game: the shape is the first thing seen, and
 * ToneSearch's widened diamond is ToneSearch's own signature. */
export interface PlayShape {
  viewBox: string;
  d: string;
}

/** ToneSearch's: a widened diamond — left/right points, flat top/bottom edges. */
export const DIAMOND_PLAY: PlayShape = {
  viewBox: '0 0 144 52',
  d: 'M 5.38 29.69 Q 2 26 5.38 22.31 L 20.62 5.69 Q 24 2 29 2 L 115 2 Q 120 2 123.38 5.69 L 138.62 22.31 Q 142 26 138.62 29.69 L 123.38 46.31 Q 120 50 115 50 L 29 50 Q 24 50 20.62 46.31 Z',
};

export function showStartGate(
  root: HTMLElement,
  title: string,
  subtitle: string,
  shape: PlayShape = DIAMOND_PLAY,
): void {
  const overlay = el('div', 'start-overlay');
  const inner = el('div', 'start-inner');
  const titleEl = el('div', 'start-title');
  titleEl.innerHTML = title; // may carry per-app markup (e.g. a split wordmark)
  const sub = el('div', 'start-sub', subtitle);
  // Play button, drawn in the game's own shape with the word inside.
  const btn = el<HTMLButtonElement>('button', 'start-btn');
  btn.innerHTML =
    `<svg class="shape" viewBox="${shape.viewBox}" aria-hidden="true">` +
    `<path d="${shape.d}" vector-effect="non-scaling-stroke"/>` +
    '</svg><span>Play</span>';
  inner.append(titleEl, sub, btn);
  overlay.append(inner);

  let begun = false;
  const begin = (): void => {
    if (begun) return;
    begun = true;
    audio.unlock(); // resume + warm-up inside this gesture
    btn.classList.add('lit'); // brighten like a tapped note cell
    setTimeout(() => {
      overlay.classList.add('hide');
      setTimeout(() => overlay.remove(), 400);
    }, 150); // brief hold so the press registers before the fade
  };
  btn.addEventListener('click', begin);
  overlay.addEventListener('pointerdown', begin);
  root.append(overlay);
}
