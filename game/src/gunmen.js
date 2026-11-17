// gunmen.js - armed people on foot: police officers and gang members. They close in, keep a firing distance,
// strafe, and shoot the player when they have a clear line, with accuracy that falls off with range.
import { G, player, H_COP, H_GANG, S_ATTACK, S_DEAD, S_IDLE, S_WALK } from './state.js';
import { pushOutCircle, segmentBlocked } from './collision.js';
import { hurtPlayer } from './playerDamage.js';
import { fx } from './effects.js';
import { emit } from './events.js';
import { rand } from './rng.js';

const _o = { x: 0, z: 0 };

export function stepGunmen(dt) {
  const p = player;
  for (const h of G.humans) {
    if (!h.active || h.state === S_DEAD || (h.kind !== H_COP && h.kind !== H_GANG)) continue;
    const dx = p.x - h.x, dz = p.z - h.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
    if (h.state === S_IDLE) { if (d < 36) h.state = S_ATTACK; else continue; }
    if (G.mode !== 'play') continue;
    h.h = Math.atan2(dx, dz);
    const los = d < 55 && !segmentBlocked(h.x, h.z, p.x, p.z, 1.2);
    h.y += (0.22 - h.y) * Math.min(1, dt * 10);
    // movement: advance until a comfortable range, strafe when close, otherwise chase around cover
    let mx = 0, mz = 0;
    const speed = h.kind === H_COP ? 4.1 : 3.5;
    if (d > (los ? 13 : 3)) { mx = dx / d; mz = dz / d; }
    else if (d < 6) { mx = -dz / d * Math.sin(G.t + h.id); mz = dx / d * Math.sin(G.t + h.id); }
    h.x += mx * speed * dt; h.z += mz * speed * dt;
    if (mx || mz) h.walk += dt * 9;
    _o.x = h.x; _o.z = h.z;
    if (pushOutCircle(_o, 0.42) > 0) { h.x = _o.x; h.z = _o.z; }
    h.cool -= dt;
    if (los && h.cool <= 0 && p.hp > 0) {
      h.cool = (h.kind === H_COP ? 0.9 : 0.75) + rand() * 0.6;
      const chance = Math.max(0.12, 0.62 - d / 85);
      fx.flash(h.x + Math.sin(h.h) * 0.7, 1.4, h.z + Math.cos(h.h) * 0.7);
      fx.tracer(h.x, 1.4, h.z, p.x + (rand() - 0.5) * 1.4, p.y + 1.1, p.z + (rand() - 0.5) * 1.4);
      if (rand() < chance) hurtPlayer(h.kind === H_COP ? 7 : 8, h.x, h.z);
      emit('gunshot', h.x, h.z, 'pistol');
    }
    if (G.wanted.level === 0 && h.kind === H_COP) { h.timer += dt; if (h.timer > 10 && d > 30) h.active = false; }
    if (d > 150) h.active = false;
  }
}
void S_ATTACK; void S_WALK;
