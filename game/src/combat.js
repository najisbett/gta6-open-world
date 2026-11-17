// combat.js - the player's weapons: switching, aiming, hitscan firing from the camera crosshair through the muzzle,
// melee punches, ammo, and the area damage of explosions and crash damage to the player.
import { G, player, H_PED, H_COP, S_DEAD } from './state.js';
import { K, consume, mouse } from './input.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';
import { rayWorld } from './collision.js';
import { fx } from './effects.js';
import { hurtHuman } from './humanDamage.js';
import { damageVehicle } from './vehicles.js';
import { scarePeds } from './pedestrians.js';
import { addCrime } from './wanted.js';
import { hurtPlayer } from './playerDamage.js';
import { exitVehicle } from './player.js';
import { on, emit } from './events.js';
import { rand } from './rng.js';
import { toast } from './state.js';

export const hit = { t: 0, type: 0, idx: -1, y: 0 }; // type 0 free, 1 world, 2 human, 3 vehicle

// Nearest of: static world, humans (three spheres each), vehicles (two spheres). Writes the answer into `hit`.
export function traceRay(ox, oy, oz, dx, dy, dz, maxT, ignoreVeh) {
  hit.t = rayWorld(ox, oy, oz, dx, dy, dz, maxT); hit.type = hit.t < maxT ? 1 : 0; hit.idx = -1;
  for (let i = 0; i < G.humans.length; i++) {
    const h = G.humans[i];
    if (!h.active || h.state === S_DEAD) continue;
    for (let k = 0; k < 3; k++) {
      const cy = h.y + 0.45 + k * 0.55, r = 0.36;
      const t = raySphere(ox, oy, oz, dx, dy, dz, h.x, cy, h.z, r);
      if (t > 0 && t < hit.t) { hit.t = t; hit.type = 2; hit.idx = i; hit.y = oy + dy * t - h.y; }
    }
  }
  for (let i = 0; i < G.vehicles.length; i++) {
    const v = G.vehicles[i];
    if (!v.active || i === ignoreVeh) continue;
    for (let k = -1; k <= 1; k += 2) {
      const t = raySphere(ox, oy, oz, dx, dy, dz, v.x + Math.sin(v.h) * v.t.len * 0.22 * k, v.y + 0.8, v.z + Math.cos(v.h) * v.t.len * 0.22 * k, v.t.wid * 0.62 + 0.25);
      if (t > 0 && t < hit.t) { hit.t = t; hit.type = 3; hit.idx = i; }
    }
  }
  return hit.t;
}

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return -1;
  return tca - Math.sqrt(r * r - d2);
}

function fire(w, wsl) {
  const p = player;
  const c = G.cam;
  // aim point: the camera ray through the crosshair
  let cdx = c.lookX - c.x, cdy = c.lookY - c.y, cdz = c.lookZ - c.z;
  const cl = Math.sqrt(cdx * cdx + cdy * cdy + cdz * cdz) || 1;
  cdx /= cl; cdy /= cl; cdz /= cl;
  traceRay(c.x + cdx * 2.5, c.y + cdy * 2.5, c.z + cdz * 2.5, cdx, cdy, cdz, 90, -1);
  const ax = c.x + cdx * (2.5 + hit.t), ay = c.y + cdy * (2.5 + hit.t), az = c.z + cdz * (2.5 + hit.t);
  const mx = p.x + Math.sin(p.h) * 0.7, my = p.y + 1.45, mz = p.z + Math.cos(p.h) * 0.7;
  fx.flash(mx, my, mz);
  for (let n = 0; n < w.pellets; n++) {
    let dx = ax - mx, dy = ay - my, dz = az - mz;
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    dx = dx / l + (rand() - 0.5) * w.spread * 2; dy = dy / l + (rand() - 0.5) * w.spread * 2; dz = dz / l + (rand() - 0.5) * w.spread * 2;
    const dl = Math.sqrt(dx * dx + dy * dy + dz * dz); dx /= dl; dy /= dl; dz /= dl;
    traceRay(mx, my, mz, dx, dy, dz, w.range, -1);
    const ex = mx + dx * hit.t, ey = my + dy * hit.t, ez = mz + dz * hit.t;
    if (n < 3 || w.pellets === 1) fx.tracer(mx, my, mz, ex, ey, ez);
    if (hit.type === 2) { const h = G.humans[hit.idx]; hurtHuman(h, w.dmg * (hit.y > 1.5 ? 2.2 : 1), true, p.x, p.z); if (h.kind === H_COP) addCrime(1.5, h.x, h.z); }
    else if (hit.type === 3) { damageVehicle(G.vehicles[hit.idx], w.dmg * 0.55); fx.spark(ex, ey, ez, 3); }
    else if (hit.type === 1) fx.spark(ex, ey, ez, 3);
  }
  wsl.ammo--;
  p.recoil = 1; c.shake = Math.max(c.shake, wsl.id === 'shotgun' ? 0.3 : 0.1);
  c.pitch -= w.pellets > 1 ? 0.035 : 0.012;
  scarePeds(p.x, p.z, 28);
  // shooting near witnesses is a crime
  let witness = false;
  for (const h of G.humans) if (h.active && h.kind !== 2 && h.state !== S_DEAD && (h.x - p.x) * (h.x - p.x) + (h.z - p.z) * (h.z - p.z) < 30 * 30) { witness = true; break; }
  if (witness) addCrime(0.35, p.x, p.z);
  emit('gunshot', p.x, p.z, w.snd);
}

function punch(w) {
  const p = player;
  p.punchT = 0.3;
  let best = null, bd = w.range * w.range;
  for (const h of G.humans) {
    if (!h.active || h.state === S_DEAD) continue;
    const dx = h.x - p.x, dz = h.z - p.z, d2 = dx * dx + dz * dz;
    if (d2 < bd && dx * Math.sin(p.h) + dz * Math.cos(p.h) > 0) { bd = d2; best = h; }
  }
  if (best) { hurtHuman(best, w.dmg, true, p.x, p.z); fx.blood(best.x, best.y + 1.4, best.z, 4); G.cam.shake = Math.max(G.cam.shake, 0.12); emit('punch'); }
}

export function giveWeapon(id, ammo) {
  const i = WEAPON_ORDER.indexOf(id);
  const s = G.weapons[i];
  s.owned = true; s.ammo += ammo;
}

function selectWeapon(i) {
  if (!G.weapons[i].owned) return;
  player.weapon = i;
  toast(WEAPONS[G.weapons[i].id].name, 1.2);
}

export function stepCombat(dt) {
  const p = player;
  if (p.fireCd > 0) p.fireCd -= dt;
  if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 6);
  if (p.punchT > 0) p.punchT -= dt;
  if (p.veh >= 0) { p.aiming = false; return; }
  if (consume('Digit1')) selectWeapon(0); if (consume('Digit2')) selectWeapon(1); if (consume('Digit3')) selectWeapon(2); if (consume('Digit4')) selectWeapon(3);
  const step = consume('KeyQ') ? 1 : mouse.wheel !== 0 ? Math.sign(mouse.wheel) : 0;
  mouse.wheel = 0;
  if (step !== 0) {
    let i = p.weapon;
    for (let k = 0; k < 4; k++) { i = (i + step + 4) % 4; if (G.weapons[i].owned) { selectWeapon(i); break; } }
  }
  p.aiming = K.aim;
  const wsl = G.weapons[p.weapon], w = WEAPONS[wsl.id];
  if (K.fire && p.fireCd <= 0) {
    if (wsl.id === 'fists') { punch(w); p.fireCd = w.rate; }
    else if (wsl.ammo > 0) { fire(w, wsl); p.fireCd = w.rate; if (!w.auto) K.fire = false; }
    else if (p.fireCd <= 0) { toast('Out of ammo', 1); p.fireCd = 0.5; }
  }
}

// ---- reactions to world events
on('explosion', (x, z, r, vid) => {
  const p = player;
  for (const h of G.humans) {
    if (!h.active || h.state === S_DEAD) continue;
    const d = Math.hypot(h.x - x, h.z - z);
    if (d < r * 1.4) hurtHuman(h, 140 * (1 - d / (r * 1.5)), Math.hypot(p.x - x, p.z - z) < 70, x, z);
  }
  for (const v of G.vehicles) {
    if (!v.active || v.id === vid || v.wreck) continue;
    const d = Math.hypot(v.x - x, v.z - z);
    if (d < r * 1.3) { damageVehicle(v, 70 * (1 - d / (r * 1.4))); v.vx += (v.x - x) / (d + 1) * 6; v.vz += (v.z - z) / (d + 1) * 6; }
  }
  scarePeds(x, z, 45);
  if (p.veh === vid) { exitVehicle(); hurtPlayer(55, x, z); p.invuln = 0; }
  else if (p.veh < 0) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < r * 1.3) hurtPlayer(70 * (1 - d / (r * 1.4)), x, z);
  } else if (Math.hypot(p.x - x, p.z - z) < r) hurtPlayer(25, x, z);
  addCrimeIfPlayerNear(x, z);
});
function addCrimeIfPlayerNear(x, z) {
  if (Math.hypot(player.x - x, player.z - z) < 40) addCrime(1, x, z);
}
on('crash', (vid, speed) => {
  if (player.veh === vid && speed > 9) hurtPlayer((speed - 9) * 0.9, player.x, player.z);
});
on('carCrash', (a, b, speed) => {
  if ((player.veh === a || player.veh === b) && speed > 7) {
    hurtPlayer((speed - 7) * 0.7, player.x, player.z);
    const other = G.vehicles[player.veh === a ? b : a];
    if (other.ai === 2) addCrime(0.4, other.x, other.z);
    else if (speed > 9 && other.driver === 2) addCrime(0.5, other.x, other.z);
  }
});
on('playerRunOver', () => {});
void H_PED;
