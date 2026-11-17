// police.js - Port Halcyon PD: cruisers spawn by wanted level, route along roads toward the player (or his last known
// position), ram on a clear line of sight, and officers dismount to arrest on foot. Reports whether any cop sees the
// player, which is what the wanted system needs to decide when the heat is off.
import { C, N, WORLD } from './config.js';
import { G, player, AI_POLICE, AI_TRAFFIC, H_COP, S_ATTACK, S_DEAD } from './state.js';
import { placeTraffic, driveToward } from './traffic.js';
import { removeVehicle } from './vehicles.js';
import { resetHumanSlot } from './pedestrians.js';
import { setHumanColors } from './humanoidView.js';
import { segmentBlocked } from './collision.js';
import { clamp } from './mathUtil.js';
import { rand } from './rng.js';

const WANT_CRUISERS = [0, 2, 3, 4, 5, 6];
let sightClock = 0, seenCache = false;

function nodeOf(x, z) {
  return [clamp(Math.round(x / C), 0, N), clamp(Math.round(z / C), 0, N)];
}

function deployOfficers(v) {
  v.deployed = true;
  for (let k = -1; k <= 1; k += 2) {
    for (const h of G.humans) {
      if (h.active) continue;
      resetHumanSlot(h, H_COP);
      setHumanColors(h.id + 1, 0x2a3f8f, 0x1b2540, 0xd9a07a, 0x15110d);
      h.x = v.x - Math.cos(v.h) * 2.4 * k; h.z = v.z + Math.sin(v.h) * 2.4 * k; h.armed = true; h.state = S_ATTACK; h.hp = h.hpMax = 60; h.cool = 0.6 + rand();
      break;
    }
  }
}

function stepCruiser(v, dt, copsSeePlayer) {
  const dx = player.x - v.x, dz = player.z - v.z, d = Math.sqrt(dx * dx + dz * dz);
  const onFoot = player.veh < 0;
  const los = d < 70 && !segmentBlocked(v.x, v.z, player.x, player.z, 1.0);
  v.siren = true;
  if (onFoot && d < 26 && !v.deployed) { deployOfficers(v); }
  if (!onFoot) v.deployed = false;
  if (v.deployed && onFoot) { v.throttle = 0; v.brake = 0.7; v.steer = 0; v.route = false; return; }
  const spd = (G.shot && G.shot.copSpeed) || 30 + G.wanted.level * 3.2;
  if (los && d < 60) {
    // direct pursuit: aim a little ahead of the target and ram it
    v.route = false;
    const pv = player.veh >= 0 ? G.vehicles[player.veh] : null;
    const tx = player.x + (pv ? pv.vx * 0.5 : 0), tz = player.z + (pv ? pv.vz * 0.5 : 0);
    driveToward(v, tx, tz, d < 14 && !G.shot ? Math.max(12, (pv ? Math.abs(pv.speed) : 8) + 4) : spd, dt);
  } else {
    // road routing toward the player's last known node
    if (!v.route) { v.route = true; const dd = Math.abs(v.vx) > Math.abs(v.vz) ? (v.vx > 0 ? 0 : 2) : (v.vz > 0 ? 1 : 3); v.dir = dd; const n = nodeOf(v.x + v.vx * 0.8, v.z + v.vz * 0.8); v.ni = clamp(n[0] + ((dd === 0) ? 1 : (dd === 2 ? -1 : 0)), 0, N); v.nj = clamp(n[1] + ((dd === 1) ? 1 : (dd === 3 ? -1 : 0)), 0, N); }
    const g = nodeOf(copsSeePlayer ? player.x : G.wanted.lx, copsSeePlayer ? player.z : G.wanted.lz);
    v.gi = g[0]; v.gj = g[1];
    v.cruise = spd * 0.85;
  }
}

export function stepPolice(dt) {
  const w = G.wanted;
  if (G.shot && G.shot.name !== 'chase') return false;
  const lvl = w.level;
  sightClock -= dt;
  if (sightClock <= 0) {
    sightClock = 0.25;
    seenCache = false;
    for (const v of G.vehicles) {
      if (!v.active || v.ai !== AI_POLICE || v.wreck) continue;
      const d2 = (v.x - player.x) * (v.x - player.x) + (v.z - player.z) * (v.z - player.z);
      if (d2 < 60 * 60 && (d2 < 14 * 14 || !segmentBlocked(v.x, v.z, player.x, player.z, 1.0))) { seenCache = true; break; }
    }
    if (!seenCache) for (const h of G.humans) {
      if (!h.active || h.kind !== H_COP || h.state === S_DEAD) continue;
      const d2 = (h.x - player.x) * (h.x - player.x) + (h.z - player.z) * (h.z - player.z);
      if (d2 < 45 * 45 && !segmentBlocked(h.x, h.z, player.x, player.z, 1.2)) { seenCache = true; break; }
    }
    if (seenCache) { w.lx = player.x; w.lz = player.z; }
  }
  // spawn up to the wanted level's quota
  let n = 0;
  for (const v of G.vehicles) if (v.active && v.ai === AI_POLICE && !v.wreck) n++;
  w.spawnCd -= dt;
  if (lvl > 0 && n < WANT_CRUISERS[lvl] && w.spawnCd <= 0) {
    const v = placeTraffic(player.x, player.z, 90, 150, false, 'kestrel', AI_POLICE);
    if (v) { v.driver = 2; v.route = true; v.keep = true; v.gi = nodeOf(player.x, player.z)[0]; v.gj = nodeOf(player.x, player.z)[1]; v.cruise = 30; }
    w.spawnCd = 3.2;
  }
  for (const v of G.vehicles) {
    if (!v.active || v.ai !== AI_POLICE || v.wreck) continue;
    if (lvl === 0) {
      // stand down: become ordinary traffic once nobody is hunting
      v.ai = AI_TRAFFIC; v.siren = false; v.route = false; v.keep = false; v.cruise = 14;
      const dd = Math.abs(v.vx) > Math.abs(v.vz) ? (v.vx > 0 ? 0 : 2) : (v.vz > 0 ? 1 : 3);
      v.dir = dd; v.ni = clamp(Math.round(v.x / C) + (dd === 0 ? 1 : dd === 2 ? -1 : 0), 0, N); v.nj = clamp(Math.round(v.z / C) + (dd === 1 ? 1 : dd === 3 ? -1 : 0), 0, N);
      continue;
    }
    stepCruiser(v, dt, seenCache);
    const d2 = (v.x - player.x) * (v.x - player.x) + (v.z - player.z) * (v.z - player.z);
    if (d2 > 330 * 330) removeVehicle(v);
  }
  void WORLD;
  return seenCache;
}
