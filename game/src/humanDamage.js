// humanDamage.js - applying damage to pedestrians, cops and gunmen: blood, death, cash drops and the crimes that
// follow when the player is the cause.
import { G, H_PED, H_COP, H_GANG, S_DEAD, S_FLEE, S_ATTACK } from './state.js';
import { fx } from './effects.js';
import { addCrime } from './wanted.js';
import { emit } from './events.js';
import { rand } from './rng.js';

export function hurtHuman(h, dmg, byPlayer, sx, sz) {
  if (!h.active || h.state === S_DEAD) return;
  h.hp -= dmg;
  fx.blood(h.x, h.y + 1.3, h.z, 5);
  if (h.hp <= 0) {
    h.state = S_DEAD; h.fadeT = 0; h.vx = (h.x - sx) * 1.5; h.vz = (h.z - sz) * 1.5;
    if (byPlayer) {
      G.player.kills++;
      if (h.kind === H_PED) { addCrime(2, h.x, h.z); G.stats.pedsHit++; emit('pedKilled'); }
      else if (h.kind === H_COP) { addCrime(5, h.x, h.z); G.stats.copsKilled++; }
      if (h.kind === H_GANG) emit('gangKilled', h.id);
    }
    if (h.cash > 0) emit('cashDrop', h.x, h.z, h.cash);
    if (h.kind === H_COP && rand() < 0.5) emit('cashDrop', h.x, h.z, 40);
  } else if (h.kind === H_PED) {
    h.state = S_FLEE; h.panic = 7; h.fx = h.x - sx; h.fz = h.z - sz;
    if (byPlayer) addCrime(1, h.x, h.z);
  } else if (h.kind === H_GANG || h.kind === H_COP) h.state = S_ATTACK;
}
