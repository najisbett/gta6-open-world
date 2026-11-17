// player.js - the protagonist: on-foot movement, jumping, entering and leaving cars (carjacking drivers), driving
// controls, being run over, dying and respawning at Mercy General.
import { G, player, AI_NONE, AI_PARKED, H_PED, S_FLEE, toast } from './state.js';
import { K, consume } from './input.js';
import { pushOutCircle } from './collision.js';
import { groundHeight, city } from './cityLayout.js';
import { nearestVehicle } from './vehicles.js';
import { resetHumanSlot, scarePeds } from './pedestrians.js';
import { addCrime, clearWanted } from './wanted.js';
import { emit } from './events.js';
import { wrapAngle, angleDiff, clamp } from './mathUtil.js';
import { rand } from './rng.js';

const _o = { x: 0, z: 0 };

export function placePlayer(x, z, h) {
  player.x = x; player.z = z; player.h = h; player.y = groundHeight(x, z); player.veh = -1; player.vy = 0; player.vxm = player.vzm = 0;
  G.cam.yaw = h;
}

export function enterVehicle(idx) {
  const v = G.vehicles[idx];
  if (v.driver === 2) {
    // carjack: the driver is thrown out and runs
    for (const hm of G.humans) {
      if (hm.active) continue;
      resetHumanSlot(hm, H_PED);
      hm.x = v.x - Math.cos(v.h) * 2.2; hm.z = v.z + Math.sin(v.h) * 2.2; hm.state = S_FLEE; hm.panic = 6; hm.fx = hm.x - v.x; hm.fz = hm.z - v.z; hm.bi = 0; hm.bj = 0;
      break;
    }
    addCrime(2, v.x, v.z);
    scarePeds(v.x, v.z, 18);
  } else if (v.type === 'kestrel') addCrime(4, v.x, v.z);
  else if (!v.mission && v.ai === AI_PARKED && v.driver === 0 && !v.owned) { addCrime(0.6, v.x, v.z); }
  if (!v.owned && !v.mission) G.stats.carsStolen++;
  v.driver = 1; v.ai = AI_NONE; v.keep = true;
  player.veh = idx; player.aiming = false;
  emit('enteredVehicle', idx);
}

export function exitVehicle() {
  const v = G.vehicles[player.veh];
  if (!v) { player.veh = -1; return; }
  player.x = v.x - Math.cos(v.h) * 2.4; player.z = v.z + Math.sin(v.h) * 2.4;
  _o.x = player.x; _o.z = player.z;
  if (pushOutCircle(_o, 0.45) > 0) { player.x = v.x + Math.cos(v.h) * 2.4; player.z = v.z - Math.sin(v.h) * 2.4; }
  player.h = v.h; player.y = v.y; player.vy = 0;
  G.cam.yaw = v.h;
  v.driver = 0; v.throttle = 0; v.brake = 0.3; v.steer = 0; v.keep = false; v.ai = AI_PARKED;
  player.veh = -1;
  emit('leftVehicle', v.id);
}

function driveInput(v, dt) {
  const fwd = K.fwd;
  if (fwd > 0) { v.throttle = v.speed < -1.5 ? 0 : fwd; v.brake = v.speed < -1.5 ? 1 : 0; }
  else if (fwd < 0) { if (v.speed > 1.5) { v.throttle = 0; v.brake = 1; } else { v.throttle = -1; v.brake = 0; } }
  else { v.throttle = 0; v.brake = 0.02; }
  v.steer += (K.steer - v.steer) * Math.min(1, dt * 7);
  v.hb = K.handbrake ? 1 : 0;
}

export function killPlayer() {
  if (G.mode === 'dead') return;
  G.mode = 'dead';
  player.deaths++;
  player.deadT = 0;
  if (player.veh >= 0) { const v = G.vehicles[player.veh]; v.driver = 0; v.keep = false; v.throttle = 0; v.brake = 1; player.veh = -1; }
  emit('playerDied');
}

export function respawnPlayer() {
  const p = city.places.hospital;
  const fee = Math.min(player.money, 200);
  player.money -= fee;
  player.hp = 100; player.armor = 0; player.invuln = 3;
  placePlayer(p.x, p.z + 3, 0);
  clearWanted();
  G.mode = 'play';
  toast('Patched up at Mercy General. Bill: $' + fee, 4);
  emit('respawned');
}

export function stepPlayer(dt) {
  const p = player;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.enterCd > 0) p.enterCd -= dt;
  if (p.hp <= 0 && G.mode === 'play') { killPlayer(); return; }
  if (p.veh >= 0) {
    const v = G.vehicles[p.veh];
    driveInput(v, dt);
    p.x = v.x; p.z = v.z; p.y = v.y; p.h = v.h;
    G.stats.distance += Math.abs(v.speed) * dt;
    if (consume('KeyE') && p.enterCd <= 0 && Math.abs(v.speed) < 14) { exitVehicle(); p.enterCd = 0.4; }
    return;
  }
  // on foot
  const cy = G.cam.yaw;
  const fx = Math.sin(cy), fz = Math.cos(cy), rx = -Math.cos(cy), rz = Math.sin(cy);
  let mx = fx * K.fwd + rx * K.right, mz = fz * K.fwd + rz * K.right;
  const ml = Math.sqrt(mx * mx + mz * mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  const top = p.aiming ? 2.6 : K.sprint ? 6.4 : 3.7;
  const ax = 1 - Math.exp(-11 * dt);
  p.vxm += (mx * top - p.vxm) * ax; p.vzm += (mz * top - p.vzm) * ax;
  p.x += p.vxm * dt; p.z += p.vzm * dt;
  p.speed = Math.sqrt(p.vxm * p.vxm + p.vzm * p.vzm);
  _o.x = p.x; _o.z = p.z;
  if (pushOutCircle(_o, 0.42) > 0) { p.x = _o.x; p.z = _o.z; }
  // cars are solid to a walker
  for (const v of G.vehicles) {
    if (!v.active) continue;
    const dx = p.x - v.x, dz = p.z - v.z;
    if (dx * dx + dz * dz > 16) continue;
    const fxv = Math.sin(v.h), fzv = Math.cos(v.h);
    for (let k = -1; k <= 1; k += 2) {
      const cx = v.x + fxv * v.t.len * 0.28 * k, cz = v.z + fzv * v.t.len * 0.28 * k;
      const ddx = p.x - cx, ddz = p.z - cz, rr = v.t.wid * 0.5 + 0.42, d2 = ddx * ddx + ddz * ddz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x += ddx / d * (rr - d); p.z += ddz / d * (rr - d);
        if (Math.abs(v.speed) > 5 && p.invuln <= 0) {
          p.hp -= Math.abs(v.speed) * 1.6; p.hurtT = 0.5; p.invuln = 0.6; G.cam.shake = Math.max(G.cam.shake, 0.5);
          if (v.driver === 2 || v.driver === 0) emit('playerRunOver', v.id);
        }
      }
    }
  }
  // facing: toward the camera while aiming, otherwise toward travel
  if (p.aiming || p.fireCd > 0.12) p.h = wrapAngle(p.h + clamp(angleDiff(cy, p.h), -14 * dt, 14 * dt));
  else if (p.speed > 0.4) p.h = wrapAngle(p.h + clamp(angleDiff(Math.atan2(p.vxm, p.vzm), p.h), -10 * dt, 10 * dt));
  p.walk += p.speed * dt * 2.9;
  // vertical: kerb step-up smoothing and jumping
  const gh = groundHeight(p.x, p.z);
  if (p.grounded) {
    p.y += (gh - p.y) * Math.min(1, dt * 20);
    if (K.jump && p.speed > -1) { p.vy = 6.2; p.grounded = false; K.jump = false; }
  } else {
    p.vy -= 20 * dt; p.y += p.vy * dt;
    if (p.y <= gh) { p.y = gh; p.vy = 0; p.grounded = true; }
  }
  // enter a car
  G.nearVeh = nearestVehicle(p.x, p.z, 3.4);
  if (consume('KeyE') && G.nearVeh >= 0 && p.enterCd <= 0 && !G.nearPlace) { enterVehicle(G.nearVeh); p.enterCd = 0.4; }
  void rand;
}
