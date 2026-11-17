// dialogue.js - subtitle queue for story scenes (blocking: wait for ENTER) and radio chatter (timed, non-blocking).
import { G } from './state.js';
import { consume } from './input.js';

export function say(lines, blocking, onDone) {
  const d = G.dialog;
  d.lines = lines; d.idx = 0; d.active = true; d.blocking = !!blocking; d.timer = 3.6; d.onDone = onDone || null;
}
export function dialogBusy() {
  return G.dialog.active && G.dialog.blocking;
}
export function stepDialogue(dt) {
  const d = G.dialog;
  if (!d.active) return;
  const advance = d.blocking ? consume('Enter') || consume('KeyE') : false;
  if (!d.blocking) d.timer -= dt;
  if (advance || (!d.blocking && d.timer <= 0)) {
    d.idx++; d.timer = 3.6;
    if (d.idx >= d.lines.length) {
      d.active = false;
      const cb = d.onDone; d.onDone = null;
      if (cb) cb();
    }
  }
}
export function endDialogue() {
  G.dialog.active = false; G.dialog.onDone = null;
}
