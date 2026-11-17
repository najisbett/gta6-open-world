// pedestrians.js - civilians who stroll round block sidewalks, wait for the signal before crossing, flee from danger,
// get hit by cars, and are spawned and retired around the player. Also shared body upkeep for any dead human.
import { C, N, DX, DZ } from './config.js';
import { G, H_PED, S_WALK, S_FLEE, S_DEAD } from './state.js';
import { city } from './cityLayout.js';
import { signalPhase } from './cityRender.js';
import { pushOutCircle } from './collision.js';
import { setHumanColors } from './humanoidView.js';
import { hurtHuman } from './humanDamage.js';
import { rand, randInt, pick } from './rng.js';
import { clamp, angleDiff, wrapAngle } from './mathUtil.js';

const MAX_PEDS = 44;
const SHIRTS = [0xe4572e, 0xf3a712, 0x29b6a8, 0x4a7fd4, 0xf2e9e4, 0xd96fa8, 0x7ac74f, 0xffd166, 0x8e6bd8, 0x303744];
const PANTS = [0x2b3a55, 0x4a4a52, 0xc2b280, 0x1f1f24, 0x7a5c44, 0x3e6a8a];
const SKINS = [0xf1c9a5, 0xd9a07a, 0xb97a56, 0x8a5a3c, 0x5f3b2a];
const HAIRS = [0x1d1511, 0x4a2f1c, 0xb98a4b, 0x222222, 0x8a8a8a];
const _o = { x: 0, z: 0 };

function cornerPos(blk, k, off, out) {
  const o = 0.9 + off;
  out.x = k === 0 || k === 3 ? blk.x0 + o : blk.x1 - o;
  out.z = k === 0 || k === 1 ? blk.z0 + o : blk.z1 - o;
}

export function resetHumanSlot(h, kind) {
  h.active = true; h.kind = kind; h.state = S_WALK; h.vx = h.vz = 0; h.hp = h.hpMax = 40; h.panic = 0; h.timer = 0; h.cool = 0; h.armed = false; h.fadeT = 0;
  h.cash = 0; h.mission = false; h.crossing = false; h.walk = rand() * 6; h.y = 0.22;
  setHumanColors(h.id + 1, pick(SHIRTS), pick(PANTS), pick(SKINS), pick(HAIRS));
}

function spawnPed(x, z, blk, k) {
  for (const h of G.humans) {
    if (h.active) continue;
    resetHumanSlot(h, H_PED);
    h.off = rand() * 1.1; h.bi = blk.bi; h.bj = blk.bj; h.corner = k; h.cdir = rand() < 0.5 ? 1 : -1;
    h.speed = 1.2 + rand() * 0.5; h.x = x; h.z = z; h.cash = rand() < 0.5 ? 8 + randInt(40) : 0;
    h.hp = h.hpMax = 30;
    return h;
  }
  return null;
}

function placePed(px, pz, minD, maxD, anywhere) {
  for (let tries = 0; tries < 12; tries++) {
    const a = rand() * Math.PI * 2, r = minD + rand() * (maxD - minD);
    const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
    const bi = Math.floor(x / C), bj = Math.floor(z / C);
    if (bi < 0 || bj < 0 || bi >= N || bj >= N) continue;
    const blk = city.blocks[bi][bj];
    if (blk.type === 'industrial' && rand() < 0.7) continue;
    const k = randInt(4), k2 = (k + 1) & 3;
    const t = rand();
    cornerPos(blk, k, 0.4, _o); const ax = _o.x, az = _o.z; cornerPos(blk, k2, 0.4, _o);
    const sx = ax + (_o.x - ax) * t, sz = az + (_o.z - az) * t;
    if (!anywhere && (sx - G.cam.x) * (sx - G.cam.x) + (sz - G.cam.z) * (sz - G.cam.z) < 55 * 55) continue;
    spawnPed(sx, sz, blk, k2);
    return;
  }
}

function crossAllowed(dir) {
  const ph = signalPhase(G.t);
  return DX[dir] !== 0 ? ph === 0 : ph === 2; // walking along x crosses the z road, which is stopped during x green
}

export function scarePeds(x, z, r) {
  for (const h of G.humans) {
    if (!h.active || h.kind !== H_PED || h.state === S_DEAD) continue;
    const d2 = (h.x - x) * (h.x - x) + (h.z - z) * (h.z - z);
    if (d2 < r * r) { h.state = S_FLEE; h.panic = 5 + rand() * 3; h.fx = h.x - x; h.fz = h.z - z; }
  }
}

function stepPed(h, dt) {
  h.y += (0.22 - h.y) * Math.min(1, dt * 10);
  if (h.state === S_FLEE) {
    h.panic -= dt;
    const l = Math.sqrt(h.fx * h.fx + h.fz * h.fz) || 1;
    h.vx = h.fx / l * 4.6; h.vz = h.fz / l * 4.6;
    h.x += h.vx * dt; h.z += h.vz * dt; h.walk += dt * 14;
    h.h = Math.atan2(h.vx, h.vz);
    _o.x = h.x; _o.z = h.z;
    if (pushOutCircle(_o, 0.4) > 0) { h.x = _o.x; h.z = _o.z; h.fx = h.fz * 0.7 + (rand() - 0.5); h.fz = -h.fx; }
    if (h.panic <= 0) {
      h.state = S_WALK;
      const bi = clamp(Math.floor(h.x / C), 0, N - 1), bj = clamp(Math.floor(h.z / C), 0, N - 1);
      h.bi = bi; h.bj = bj;
      let best = 0, bd = 1e9;
      const blk = city.blocks[bi][bj];
      for (let k = 0; k < 4; k++) { cornerPos(blk, k, h.off, _o); const d = (_o.x - h.x) * (_o.x - h.x) + (_o.z - h.z) * (_o.z - h.z); if (d < bd) { bd = d; best = k; } }
      h.corner = best;
    }
    return;
  }
  const blk = city.blocks[h.bi][h.bj];
  cornerPos(blk, h.corner, h.off, _o);
  const dx = _o.x - h.x, dz = _o.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
  if (h.timer > 0) { h.timer -= dt; if (h.timer > 0) return; }
  if (d < 0.35) {
    const prev = (h.corner - h.cdir + 4) & 3;
    // direction of the edge just walked: corners run NW,NE,SE,SW, so +1 goes east,south,west,north
    const dir = h.cdir > 0 ? prev : (prev + 1) & 3;
    const nbi = h.bi + DX[dir], nbj = h.bj + DZ[dir];
    if (rand() < 0.3 && nbi >= 0 && nbj >= 0 && nbi < N && nbj < N) {
      if (!crossAllowed(dir)) { h.timer = 1.5; return; }
      h.bi = nbi; h.bj = nbj; h.corner = prev; h.crossing = true;
    } else {
      h.corner = (h.corner + h.cdir + 4) & 3; h.crossing = false;
      if (rand() < 0.08) h.cdir = -h.cdir;
    }
    return;
  }
  const want = Math.atan2(dx, dz);
  h.h = wrapAngle(h.h + clamp(angleDiff(want, h.h), -9 * dt, 9 * dt));
  const sp = h.speed * (h.crossing ? 1.5 : 1);
  h.x += Math.sin(h.h) * sp * dt; h.z += Math.cos(h.h) * sp * dt;
  h.walk += dt * sp * 4.2;
  h.vx = Math.sin(h.h) * sp; h.vz = Math.cos(h.h) * sp;
}

function upkeepBody(h, dt) {
  if (h.state === S_DEAD) {
    h.fadeT += dt;
    h.x += h.vx * dt; h.z += h.vz * dt;
    h.vx *= Math.exp(-5 * dt); h.vz *= Math.exp(-5 * dt);
    if (h.fadeT > 14) h.active = false;
  }
}

export function stepPedestrians(dt) {
  const V = G.vehicles;
  for (const h of G.humans) {
    if (!h.active) continue;
    if (h.state === S_DEAD) { upkeepBody(h, dt); continue; }
    if (h.kind === H_PED) {
      stepPed(h, dt);
      for (const v of V) {
        if (!v.active || Math.abs(v.speed) < 3.2) continue;
        const dx = h.x - v.x, dz = h.z - v.z;
        if (dx * dx + dz * dz > 20) continue;
        const fx = Math.sin(v.h), fz = Math.cos(v.h);
        const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
        if (Math.abs(along) < v.t.len * 0.5 + 0.4 && side < v.t.wid * 0.5 + 0.5) {
          const byPlayer = v.driver === 1;
          hurtHuman(h, Math.abs(v.speed) * 5, byPlayer, v.x, v.z);
          if (h.state === S_DEAD) { h.vx = v.vx * 0.7; h.vz = v.vz * 0.7; }
          if (byPlayer) G.stats.pedsHit++;
          scarePeds(h.x, h.z, 12);
        }
      }
    }
  }
}

export function streamPeds(px, pz, filling) {
  let n = 0;
  for (const h of G.humans) if (h.active && h.kind === H_PED) n++;
  if (filling) { while (n < MAX_PEDS) { placePed(px, pz, 8, 110, true); n++; } return; }
  if (n < MAX_PEDS && !G.shot) placePed(px, pz, 60, 120, false);
  for (const h of G.humans) {
    if (!h.active || h.mission) continue;
    const d2 = (h.x - px) * (h.x - px) + (h.z - pz) * (h.z - pz);
    if (d2 > 160 * 160) h.active = false;
  }
}
