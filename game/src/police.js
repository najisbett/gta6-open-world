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
let sightClock = 0, seenCache = false, prevLevel = 0;

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

// Slots around a fleeing car: 0 cuts in ahead and brakes to block, 1 and 2 flank it and shove sideways, 3 rams from behind.
// Offsets are kept tight so the squad stays visibly glued to the car instead of hanging back.
const SLOT_SIDE = [0, -1, 1, 0], SLOT_AHEAD = [11, 1, 1, -4];
const SLOW_SPEED = 9;      // below this the player counts as crawling / stopped and the squad collapses onto him
const LOS_RANGE = 80;      // how far a cruiser can keep eyes on the player
const CHASE_RANGE = 70;    // within this, with sight, cruisers drive at the player instead of routing
const MEMORY_T = 1.2;      // after losing sight, keep driving at the last seen spot this long before falling back to roads

// Intercept the player's predicted position (lead time grows with distance), take a slot around the car, and once
// within ramming range aim straight at the car so cruisers pin it between them.
function boxIn(v, pv, d, spd, dt) {
  const slot = v.slot | 0;
  const pspd = Math.abs(pv.speed);
  const slow = pspd < SLOW_SPEED;
  const lead = clamp(d / Math.max(spd, 12), 0.2, slow ? 0.6 : 1.8);
  const px = player.x + pv.vx * lead, pz = player.z + pv.vz * lead;
  const sp = Math.hypot(pv.vx, pv.vz) || 1;
  const fx = pv.vx / sp, fz = pv.vz / sp;
  const near = d < (slow ? 32 : 26);
  // a slow target gets swarmed: slots shrink right down to bumper-to-bumper
  const side = SLOT_SIDE[slot] * (slow ? 1.4 : near ? 1.8 : 4.5);
  const ahead = slow ? SLOT_AHEAD[slot] * 0.35 : near && slot !== 0 ? 0 : SLOT_AHEAD[slot];
  const tx = px + fx * ahead - fz * side, tz = pz + fz * ahead + fx * side;
  let target = spd;
  if (slow) target = d < 10 ? Math.max(8, pspd + 5) : Math.max(18, spd * 0.8); // hurry in, then ease into contact
  else if (slot === 0 && near) target = Math.max(8, pspd * 0.75);           // blocker eases off so the others close the box
  else if (near) target = Math.max(16, pspd + 8);                           // flankers and rammer match speed and shove
  v.boxed = d < 10;
  driveToward(v, tx, tz, target, dt);
}

function stepCruiser(v, dt, copsSeePlayer) {
  const dx = player.x - v.x, dz = player.z - v.z, d = Math.sqrt(dx * dx + dz * dz);
  const onFoot = player.veh < 0;
  const los = d < LOS_RANGE && (d < 16 || !segmentBlocked(v.x, v.z, player.x, player.z, 1.0));
  v.siren = true;
  if (los) { v.seenT = 0; v.sx = player.x; v.sz = player.z; } else v.seenT = (v.seenT || 0) + dt;
  if (onFoot && d < 26 && !v.deployed) { deployOfficers(v); }
  if (!onFoot) v.deployed = false;
  if (v.deployed && onFoot) { v.throttle = 0; v.brake = 0.7; v.steer = 0; v.route = false; return; }
  const spd = (G.shot && G.shot.copSpeed) || 30 + G.wanted.level * 3.2;
  if (los && d < CHASE_RANGE) {
    v.route = false;
    const pv = player.veh >= 0 ? G.vehicles[player.veh] : null;
    if (G.shot || !pv) {
      // scripted shot, or the player is on foot: close in directly and ram
      const tx = player.x + (pv ? pv.vx * 0.4 : 0), tz = player.z + (pv ? pv.vz * 0.4 : 0);
      driveToward(v, tx, tz, d < 16 && !G.shot ? Math.max(12, (pv ? Math.abs(pv.speed) : 8) + 5) : spd, dt);
    } else {
      boxIn(v, pv, d, spd, dt);
    }
  } else if (!G.shot && v.seenT < MEMORY_T && v.sx !== undefined && d < CHASE_RANGE + 20) {
    // just lost sight around a corner: keep charging the spot he vanished at instead of dropping to road routing,
    // which is usually enough to swing round and pick him straight back up
    v.route = false;
    driveToward(v, v.sx, v.sz, spd * 0.9, dt);
  } else {
    // road routing toward the player's last known node
    if (!v.route) { v.route = true; const dd = Math.abs(v.vx) > Math.abs(v.vz) ? (v.vx > 0 ? 0 : 2) : (v.vz > 0 ? 1 : 3); v.dir = dd; const n = nodeOf(v.x + v.vx * 0.8, v.z + v.vz * 0.8); v.ni = clamp(n[0] + ((dd === 0) ? 1 : (dd === 2 ? -1 : 0)), 0, N); v.nj = clamp(n[1] + ((dd === 1) ? 1 : (dd === 3 ? -1 : 0)), 0, N); }
    const g = nodeOf(copsSeePlayer ? player.x : G.wanted.lx, copsSeePlayer ? player.z : G.wanted.lz);
    v.gi = g[0]; v.gj = g[1];
    v.cruise = spd * 0.95;
  }
}

export function stepPolice(dt) {
  const w = G.wanted;
  if (G.shot && G.shot.name !== 'chase') return false;
  const lvl = w.level;
  // a fresh crime tells dispatch roughly where the player is: seed the last known position so cruisers head for him
  if (lvl > 0 && prevLevel === 0) { w.lx = player.x; w.lz = player.z; }
  prevLevel = lvl;
  sightClock -= dt;
  if (sightClock <= 0) {
    // check sight more often than before so a broken line of sight is regained within a beat, not a quarter second
    sightClock = 0.12;
    seenCache = false;
    for (const v of G.vehicles) {
      if (!v.active || v.ai !== AI_POLICE || v.wreck) continue;
      const d2 = (v.x - player.x) * (v.x - player.x) + (v.z - player.z) * (v.z - player.z);
      if (d2 < LOS_RANGE * LOS_RANGE && (d2 < 18 * 18 || !segmentBlocked(v.x, v.z, player.x, player.z, 1.0))) { seenCache = true; break; }
    }
    if (!seenCache) for (const h of G.humans) {
      if (!h.active || h.kind !== H_COP || h.state === S_DEAD) continue;
      const d2 = (h.x - player.x) * (h.x - player.x) + (h.z - player.z) * (h.z - player.z);
      if (d2 < 55 * 55 && (d2 < 10 * 10 || !segmentBlocked(h.x, h.z, player.x, player.z, 1.2))) { seenCache = true; break; }
    }
    if (seenCache) {
      // remember where the player is heading, not just where he was, so routing cuts him off
      const pv = player.veh >= 0 ? G.vehicles[player.veh] : null;
      w.lx = player.x + (pv ? pv.vx * 2 : 0); w.lz = player.z + (pv ? pv.vz * 2 : 0);
    }
  }
  // spawn up to the wanted level's quota
  let n = 0;
  for (const v of G.vehicles) if (v.active && v.ai === AI_POLICE && !v.wreck) n++;
  w.spawnCd -= dt;
  if (lvl > 0 && n < WANT_CRUISERS[lvl] && w.spawnCd <= 0) {
    const v = placeTraffic(player.x, player.z, 90, 150, false, 'kestrel', AI_POLICE);
    if (v) {
      // take the least used box-in slot so a squad spreads around the target instead of stacking behind it
      const used = [0, 0, 0, 0];
      for (const o of G.vehicles) if (o !== v && o.active && o.ai === AI_POLICE && !o.wreck) used[o.slot | 0]++;
      v.slot = used.indexOf(Math.min(...used));
      v.driver = 2; v.route = true; v.keep = true; v.gi = nodeOf(player.x, player.z)[0]; v.gj = nodeOf(player.x, player.z)[1]; v.cruise = 30; }
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
