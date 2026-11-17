// wanted.js - the crime heat meter, star level, and how police lose track of you: stay out of sight long enough
// (break line of sight) and the stars clear.
import { G } from './state.js';
import { toast } from './state.js';
import { emit } from './events.js';

const STAR_AT = [0, 1, 3, 6, 10, 15];

export function setWanted(level) {
  G.wanted.level = level;
  G.wanted.heat = STAR_AT[level];
  G.wanted.evade = 0;
}

export function addCrime(points, x, z) {
  const w = G.wanted;
  if (G.shot) return;
  const before = w.level;
  w.heat = Math.min(STAR_AT[5] + 2, w.heat + points);
  let lv = 0;
  for (let i = 1; i < STAR_AT.length; i++) if (w.heat >= STAR_AT[i]) lv = i;
  w.level = Math.max(w.level, lv);
  w.evade = 0;
  if (w.level > before) { toast(w.level >= 3 ? 'WANTED - the police are on your tail' : 'Wanted level up', 2.2); emit('wantedUp', w.level, x, z); }
}

export function clearWanted(msg) {
  const w = G.wanted;
  if (w.level > 0 && msg) toast(msg, 3);
  w.level = 0; w.heat = 0; w.evade = 0; w.seen = false;
  emit('wantedCleared');
}

// seenNow is decided by the police module each step (a cop with clear line of sight).
export function stepWanted(dt, seenNow) {
  const w = G.wanted;
  w.flash += dt;
  w.seen = seenNow;
  if (w.level === 0) return;
  if (seenNow) { w.evade = 0; return; }
  w.evade += dt;
  if (w.evade > 9 + w.level * 2.5) clearWanted('You lost the cops');
}
