// board.ts — ToneScribe's play surface as a session Board.
//
// The session judges an ordered list of notes and knows nothing about staves,
// exactly as it knows nothing about ToneSearch's lattice. What is specific here
// is how a gesture becomes a note: a tap picks the nearest line or space, the
// key signature supplies the accidental unless a button overrides it, and the
// pair (step, accidental) spells exactly one note.
//
// Placement is also checked, not just spelling. The session's isPrefix is
// root-relative — right for ToneSearch, where you find a shape anywhere — but
// ToneScribe names the key, so there is one correct answer and the octave is
// part of it. The board rejects a note written on the wrong line before the
// session ever sees it.

import { midiOf, noteAt, type Accidental, type Step } from '../core/staff';
import * as audio from '../shell/audio';
import type { Shell } from '../shell/chrome';
import type { Board, SessionApi } from '../shell/session';
import { paintNote, renderStaff, type StaffView } from './staffview';
import { GLYPH_SPACE, accidentalMetrics, accidentalPath } from './glyphs';
import { SOLVE_CHORD_DELAY_MS } from '../shell/session';
import type { ScribeRound } from './round';

/** Accidentals always offered. Doubles are added only when a round needs one. */
const BASE_ACCIDENTALS: Exclude<Accidental, null>[] = [-1, 0, 1];

const ACC_LABEL: Record<Exclude<Accidental, null>, string> = {
  [-2]: 'Write a double flat',
  [-1]: 'Write a flat',
  [0]: 'Write a natural',
  [1]: 'Write a sharp',
  [2]: 'Write a double sharp',
};

/** How long a wrong note takes to fade away. Matches the CSS animation. */
const WRONG_FADE_MS = 420;

export function createStaffBoard(shell: Shell, api: SessionApi): Board<ScribeRound> {
  const wrap = document.createElement('div');
  wrap.className = 'staff-wrap';
  const staffHost = document.createElement('div');
  staffHost.style.width = '100%';
  const accRow = document.createElement('div');
  accRow.className = 'accidentals';
  wrap.append(staffHost, accRow);
  shell.stageEl.append(wrap);
  shell.stageEl.setAttribute('aria-label', 'Staff');

  let round!: ScribeRound;
  let view!: StaffView;
  let busy = false;
  /** What the player has written: one entry per committed note. */
  let written: { step: Step; acc: Accidental }[] = [];
  /** The accidental button currently held down, or null for "use the key". */
  let armed: Accidental = null;
  let squashTimer: ReturnType<typeof setTimeout> | undefined;

  const buildAccidentalRow = (): void => {
    accRow.innerHTML = '';
    // Offer doubles only when the answer needs one. It leaks that some note is
    // doubly altered, which is a fair hint and far better than an unwinnable
    // round — the alternative is five buttons of clutter on every puzzle.
    const needsDouble = round.solutionSteps.some((step, i) => {
      const want = round.solutionNotes[i]!;
      return Math.abs((want - noteAt(step, 0, 0)) / 7) === 2;
    });
    accSet = needsDouble ? [-2, -1, 0, 1, 2] : BASE_ACCIDENTALS;
    for (const a of accSet) {
      const b = document.createElement('button');
      b.className = 'acc-btn';
      // The same glyph the staff writes, from Bravura — a UI font's ♯ beside a
      // Bravura clef is the wrong shape, and its baseline centres nothing.
      const m = accidentalMetrics(a);
      const pad = GLYPH_SPACE * 0.5;
      b.innerHTML =
        `<svg viewBox="${m.x1 - pad} ${m.y1 - pad} ${m.x2 - m.x1 + pad * 2} ${m.y2 - m.y1 + pad * 2}" ` +
        `aria-hidden="true"><path d="${accidentalPath(a)}"/></svg>`;
      b.setAttribute('aria-label', ACC_LABEL[a]);
      b.onclick = () => {
        armed = armed === a ? null : a; // tapping the armed one disarms it
        paintArmed();
      };
      accRow.append(b);
    }
    paintArmed();
  };

  /** The accidental set currently on offer, in button order. */
  let accSet: Exclude<Accidental, null>[] = BASE_ACCIDENTALS;

  const paintArmed = (): void => {
    [...accRow.children].forEach((b, i) => b.classList.toggle('armed', armed === accSet[i]));
  };

  const repaint = (): void => {
    view.slots.forEach((g, i) => {
      const w = written[i];
      if (!w) {
        while (g.firstChild) g.removeChild(g.firstChild);
        g.setAttribute('transform', `translate(${view.geom.parkX} 0)`);
        return;
      }
      paintNote(g, view.geom, w.step, w.acc);
      g.setAttribute('transform', `translate(${view.geom.slotX(i)} 0)`);
    });
  };

  /** Mark the note just written as wrong and let it fade, rather than blinking
   * out of existence — a correction on paper, not a deletion. */
  const flashWrong = (i: number): void => {
    const g = view.slots[i];
    if (!g) return;
    g.classList.add('wrong');
    setTimeout(() => g.classList.remove('wrong'), WRONG_FADE_MS);
  };

  const onTap = (ev: PointerEvent): void => {
    if (busy) return;
    const { x, y } = view.toGlyph(ev);

    // A tap on a written note takes it (and everything after) back off.
    const hitIndex = written.findIndex((w, i) => {
      const dx = Math.abs(x - view.geom.slotX(i));
      const dy = Math.abs(y - view.geom.y(w.step));
      return dx < 14 && dy < 7;
    });
    if (hitIndex !== -1) {
      audio.playCancel();
      written = written.slice(0, hitIndex);
      api.rewind(hitIndex);
      repaint();
      return;
    }

    const i = written.length;
    if (i >= round.solutionSteps.length) return;
    const step = view.geom.stepAtY(y);
    const note = noteAt(step, round.sig, armed);

    // Show it before judging it, and commit to `written` FIRST. api.propose is
    // synchronous and calls back into paint(), which reconciles against the
    // answer whenever our trail is a different length from the session's — so
    // appending after the call appended a second time.
    const previous = written;
    written = [...written, { step, acc: armed }];
    repaint();
    // Sound the pitch actually written — the tapped step's octave, right or
    // wrong — rather than a pitch class folded into a reference octave.
    api.voiceMidi(midiOf(step, note));

    // The line matters as much as the letter: a right note written an octave off
    // is wrong here, and the session's root-relative check would accept it.
    const rightLine = step === round.solutionSteps[i];
    if (!rightLine || !api.propose(note)) {
      flashWrong(i);
      written = previous;
      setTimeout(repaint, WRONG_FADE_MS);
      return;
    }
    armed = null; // an accidental applies only to the note just written
    paintArmed();
  };

  const build = (): void => {
    view = renderStaff(staffHost, round.clef, round.sig, round.range, round.solutionSteps.length);
    view.svg.onpointerdown = onTap;
    repaint();
  };

  return {
    setRound(next) {
      clearTimeout(squashTimer); // a pending squash must not land on the next round
      round = next;
      written = [];
      armed = null;
      buildAccidentalRow();
      build();
      if (import.meta.env.DEV) {
        (window as unknown as { __answer: unknown }).__answer = {
          steps: round.solutionSteps,
          notes: round.solutionNotes,
          sig: round.sig,
          clef: round.clef,
        };
      }
    },
    layout() {
      build();
    },
    paint(notes) {
      // The give-up reveal pushes notes the player never wrote; rebuild the
      // written trail from the answer when ours has fallen behind.
      if (notes.length !== written.length) {
        written = round.solutionSteps.slice(0, notes.length).map((step, i) => ({
          step,
          acc: accidentalOf(step, round.sig, round.solutionNotes[i]!),
        }));
      }
      repaint();
      // On a completed chord, slide the noteheads together into a stack — how
      // the same notes would actually be engraved. Held until the chord sounds,
      // so the last note lands in its own place first and the stack coincides
      // with hearing it. Scales stay written out and run instead.
      const complete = notes.length === round.solutionSteps.length;
      if (complete && round.pattern.kind !== 'scale' && round.pattern.kind !== 'note') {
        const x0 = view.geom.slotX(0);
        clearTimeout(squashTimer);
        squashTimer = setTimeout(() => {
          view.slots.forEach((g) => g.setAttribute('transform', `translate(${x0} 0)`));
        }, SOLVE_CHORD_DELAY_MS);
      }
    },
    setBusy(b) {
      busy = b;
    },
  };
}

/** Which accidental the answer needs written at `step` — mirrors staff.ts's
 * accidentalFor, but never undefined here because the step came from the
 * answer itself. */
function accidentalOf(step: Step, sig: number, note: number): Accidental {
  for (const a of [null, 0, 1, -1, 2, -2] as Accidental[]) {
    if (noteAt(step, sig, a) === note) return a;
  }
  return null;
}
