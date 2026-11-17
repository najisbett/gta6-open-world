// vehicles.js - the vehicle pool and its arcade physics: acceleration, braking, steering, handbrake drift, kerb
// bumps, wall and car-to-car collisions, damage, fire and explosions. AI and the player only set the control fields.
import { G, AI_NONE, AI_PARKED } from './state.js';
import { VTYPES } from './vehicleTypes.js';
import { pushOutCircle, COL } from './collision.js';
import { groundHeight } from './cityLayout.js';
import { fx, addTyreMark } from './effects.js';
import { emit } from './events.js';
import { rand } from './rng.js';
import { wrapAngle } from './mathUtil.js';

const _p = { x: 0, z: 0 };

export function spawnVehicle(type, x, z, h, ai, paint) {
  let v = null;
  for (let i = 0; i < G.vehicles.length; i++) if (!G.vehicles[i].active) { v = G.vehicles[i]; break; }
  if (!v) {
    // pool full: recycle the farthest ordinary car so story cars and police always get a slot
    let far = -1;
    for (const o of G.vehicles) {
      if (o.keep || o.mission || o.driver === 1) continue;
      const d = (o.x - G.player.x) * (o.x - G.player.x) + (o.z - G.player.z) * (o.z - G.player.z);
      if (d > far) { far = d; v = o; }
    }
    if (!v) return null;
  }
  const t = VTYPES[type];
  v.active = true; v.type = type; v.t = t; v.paint = paint; v.x = x; v.z = z; v.y = groundHeight(x, z); v.h = h;
  v.vx = v.vz = v.yaw = v.pitch = v.roll = 0; v.steer = v.throttle = v.brake = v.hb = 0; v.hp = t.hp; v.ai = ai; v.driver = ai === AI_NONE || ai === AI_PARKED ? 0 : 2;
  v.stuck = v.reverse = v.slip = v.speed = v.fire = 0; v.wreck = false; v.keep = false; v.tune = 0; v.mission = false; v.siren = false; v.boom = 0;
  v.hasMark = false; v.wasOnKerb = false; v.lastHit = 0; v.cruise = 14 + rand() * 8; v.spawnT = G.t;
  return v;
}

export function removeVehicle(v) {
  v.active = false;
  v.keep = false;
}

export function damageVehicle(v, dmg) {
  if (v.wreck || dmg <= 0) return;
  v.hp -= dmg;
  if (v.hp <= 0) explodeVehicle(v);
}

export function explodeVehicle(v) {
  v.wreck = true; v.hp = 0; v.fire = 22; v.throttle = v.brake = v.steer = 0; v.ai = AI_NONE; v.siren = false;
  v.vy = 0;
  fx.explosion(v.x, 1.2, v.z);
  v.vx += (rand() - 0.5) * 6; v.vz += (rand() - 0.5) * 6;
  emit('explosion', v.x, v.z, 9, v.id);
}

function stepOne(v, dt) {
  const t = v.t;
  const hasDriver = v.driver !== 0 && !v.wreck;
  let fx_ = Math.sin(v.h), fz_ = Math.cos(v.h), rx = -Math.cos(v.h), rz = Math.sin(v.h);
  let vl = v.vx * fx_ + v.vz * fz_, vt = v.vx * rx + v.vz * rz;
  const top = t.top * (1 + 0.08 * v.tune);
  const accel = t.accel * (1 + 0.1 * v.tune);
  if (hasDriver) {
    if (v.throttle > 0) vl += accel * v.throttle * (vl < 0 ? 2.2 : Math.max(0, 1 - vl / top)) * dt;
    else if (v.throttle < 0) vl += accel * 0.55 * v.throttle * Math.max(0, 1 + vl / 12) * dt;
    if (v.brake > 0) { const b = 30 * dt * v.brake; vl = vl > 0 ? Math.max(0, vl - b) : Math.min(0, vl + b); }
  } else {
    vl *= Math.exp(-(v.wreck ? 1.4 : 2.2) * dt);
  }
  vl *= Math.exp(-0.05 * dt * 60 * 0.1);
  vl -= Math.sign(vl) * Math.min(Math.abs(vl), 0.35 * dt);
  const gh = groundHeight(v.x, v.z);
  const onKerb = gh > 0.1;
  if (onKerb) vl *= Math.exp(-0.9 * dt);
  if (onKerb !== v.wasOnKerb) { v.wasOnKerb = onKerb; v.pitch += 0.05; if (Math.abs(vl) > 8 && v === G.vehicles[G.player.veh]) G.cam.shake = Math.max(G.cam.shake, 0.18); v.y += 0.05; }
  if (hasDriver) {
    const sp = Math.abs(vl);
    const maxSteer = t.steer / (1 + sp / 15);
    let yawT = (vl * v.steer * maxSteer) / 2.7;
    if (v.hb > 0.5 && sp > 6) { yawT *= 1.55; vl *= Math.exp(-0.55 * dt); }
    v.yaw += (-yawT - v.yaw) * Math.min(1, dt * 9);
  } else v.yaw *= Math.exp(-4 * dt);
  // rebuild velocity in the old basis, rotate the heading, then split it in the new basis so slip appears naturally
  v.vx = fx_ * vl + rx * vt; v.vz = fz_ * vl + rz * vt;
  v.h = wrapAngle(v.h + v.yaw * dt);
  fx_ = Math.sin(v.h); fz_ = Math.cos(v.h); rx = -Math.cos(v.h); rz = Math.sin(v.h);
  vl = v.vx * fx_ + v.vz * fz_; vt = v.vx * rx + v.vz * rz;
  const grip = t.grip * (v.hb > 0.5 ? 0.16 : 1) * (1 - G.rain * 0.22) * (hasDriver ? 1 : 3);
  vt *= Math.exp(-grip * dt);
  v.vx = fx_ * vl + rx * vt; v.vz = fz_ * vl + rz * vt;
  v.slip = Math.abs(vt); v.speed = vl;
  v.x += v.vx * dt; v.z += v.vz * dt;
  // static collisions with two circles
  const off = t.len * 0.3, rad = t.wid * 0.5 + 0.05;
  for (let k = -1; k <= 1; k += 2) {
    _p.x = v.x + fx_ * off * k; _p.z = v.z + fz_ * off * k;
    const ox = _p.x, oz = _p.z;
    if (pushOutCircle(_p, rad) > 0) {
      v.x += _p.x - ox; v.z += _p.z - oz;
      const vn = v.vx * COL.nx + v.vz * COL.nz;
      if (vn < 0) {
        v.vx -= 1.25 * vn * COL.nx; v.vz -= 1.25 * vn * COL.nz;
        v.vx *= 0.97; v.vz *= 0.97;
        if (-vn > 4) {
          damageVehicle(v, (-vn - 3) * 2.4 / t.mass);
          fx.spark(_p.x, 0.8, _p.z, 6);
          emit('crash', v.id, -vn);
          if (v === G.vehicles[G.player.veh]) { G.cam.shake = Math.min(1, Math.max(G.cam.shake, -vn * 0.05)); }
        }
      }
    }
  }
  // visual height, pitch and roll
  const ty = gh;
  v.y += (ty - v.y) * Math.min(1, dt * 14);
  const lat = vt * 0.012, lng = (vl - v.speed) * 0.0;
  v.roll += (-v.yaw * Math.min(1, Math.abs(vl) / 20) * 0.12 - lat * 0.4 - v.roll) * Math.min(1, dt * 6);
  v.pitch += (-(hasDriver ? (v.throttle - v.brake) : 0) * 0.025 - v.pitch + lng) * Math.min(1, dt * 6);
  // smoke and fire
  if (v.wreck) {
    v.fire -= dt;
    if (v.fire > 0 && rand() < 0.5) fx.fire(v.x, 1.2, v.z);
    if (v.fire > 0 && rand() < 0.25) fx.smoke(v.x, 1.6, v.z, 1, true);
  } else if (v.hp < t.hp * 0.3 && rand() < 0.12) fx.smoke(v.x + fx_ * 1.5, 1.2, v.z + fz_ * 1.5, 1, v.hp < t.hp * 0.15);
  // tyre smoke and skid marks when sliding or handbraking
  if (!v.wreck && hasDriver && !onKerb && v.slip > 3.2 && Math.abs(vl) > 6) {
    if (rand() < 0.5) fx.smoke(v.x - fx_ * 1.4, 0.3, v.z - fz_ * 1.4, 1, false);
    const bx = v.x - fx_ * 1.4, bz = v.z - fz_ * 1.4;
    if (v.hasMark) { addTyreMark(v.tireMarkX + rx * 0.8, v.tireMarkZ + rz * 0.8, bx + rx * 0.8, bz + rz * 0.8, 0.5); addTyreMark(v.tireMarkX - rx * 0.8, v.tireMarkZ - rz * 0.8, bx - rx * 0.8, bz - rz * 0.8, 0.5); }
    v.tireMarkX = bx; v.tireMarkZ = bz; v.hasMark = true;
  } else v.hasMark = false;
  // an unmanned parked car coasts to a stop; wrecks keep their last spot
  if (v.driver === 0 && v.ai !== AI_NONE && !v.wreck) v.ai = AI_PARKED;
}

const ca = { x: 0, z: 0 }, cb = { x: 0, z: 0 };
function collidePair(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const lim = (a.t.len + b.t.len) * 0.5 + 0.5;
  if (dx * dx + dz * dz > lim * lim) return;
  const ra = (a.t.wid * 0.5) + 0.05, rb = (b.t.wid * 0.5) + 0.05;
  const oa = a.t.len * 0.3, ob = b.t.len * 0.3;
  const afx = Math.sin(a.h), afz = Math.cos(a.h), bfx = Math.sin(b.h), bfz = Math.cos(b.h);
  for (let i = -1; i <= 1; i += 2) for (let j = -1; j <= 1; j += 2) {
    ca.x = a.x + afx * oa * i; ca.z = a.z + afz * oa * i; cb.x = b.x + bfx * ob * j; cb.z = b.z + bfz * ob * j;
    let nx = cb.x - ca.x, nz = cb.z - ca.z;
    const d2 = nx * nx + nz * nz, rr = ra + rb;
    if (d2 >= rr * rr) continue;
    const d = Math.sqrt(d2) || 0.001;
    nx /= d; nz /= d;
    const pen = rr - d;
    const ma = a.t.mass, mb = b.t.mass, wa = mb / (ma + mb), wb = ma / (ma + mb);
    a.x -= nx * pen * wa; a.z -= nz * pen * wa; b.x += nx * pen * wb; b.z += nz * pen * wb;
    const rvn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (rvn < 0) {
      const imp = -(1.3) * rvn / (1 / ma + 1 / mb);
      a.vx -= nx * imp / ma; a.vz -= nz * imp / ma; b.vx += nx * imp / mb; b.vz += nz * imp / mb;
      if (-rvn > 3) {
        damageVehicle(a, (-rvn - 2) * 1.8 * mb / ma); damageVehicle(b, (-rvn - 2) * 1.8 * ma / mb);
        fx.spark((a.x + b.x) / 2, 0.8, (a.z + b.z) / 2, 5);
        a.lastHit = b.lastHit = G.t;
        emit('carCrash', a.id, b.id, -rvn);
        const pv = G.vehicles[G.player.veh];
        if (pv === a || pv === b) G.cam.shake = Math.min(1, Math.max(G.cam.shake, -rvn * 0.06));
      }
    }
  }
}

export function stepVehicles(dt) {
  const V = G.vehicles;
  for (let i = 0; i < V.length; i++) if (V[i].active) stepOne(V[i], dt);
  for (let i = 0; i < V.length; i++) {
    if (!V[i].active) continue;
    for (let j = i + 1; j < V.length; j++) if (V[j].active) collidePair(V[i], V[j]);
  }
}

// Nearest empty-or-occupied car within reach of a point (used for entering).
export function nearestVehicle(x, z, reach) {
  let best = -1, bd = reach * reach;
  for (let i = 0; i < G.vehicles.length; i++) {
    const v = G.vehicles[i];
    if (!v.active || v.wreck) continue;
    const d = (v.x - x) * (v.x - x) + (v.z - z) * (v.z - z);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
