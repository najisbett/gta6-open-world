// traffic.js - civilian cars that follow road lanes, obey traffic signals, brake for cars and people ahead, turn at
// intersections, and are spawned and retired around the player. Also parks some cars at the kerb to steal.
import { C, N, DX, DZ, LANE, WORLD } from './config.js';
import { G, AI_TRAFFIC, AI_PARKED, AI_POLICE } from './state.js';
import { spawnVehicle, removeVehicle } from './vehicles.js';
import { TRAFFIC_TYPES } from './vehicleTypes.js';
import { signalPhase } from './cityRender.js';
import { rand, randInt, pick } from './rng.js';
import { clamp, angleDiff } from './mathUtil.js';

const MAX_TRAFFIC = 26, MAX_PARKED = 14;

// Steer and throttle a car toward a world point at a target speed (shared with the police AI).
export function driveToward(v, tx, tz, targetSpeed, dt) {
  const want = Math.atan2(tx - v.x, tz - v.z);
  const err = angleDiff(want, v.h);
  v.steer = clamp(-err * 2.2, -1, 1);
  const sp = v.speed;
  if (sp < targetSpeed - 0.5) { v.throttle = 1; v.brake = 0; }
  else if (sp > targetSpeed + 1.5) { v.throttle = 0; v.brake = clamp((sp - targetSpeed) * 0.2, 0.15, 1); }
  else { v.throttle = 0.25; v.brake = 0; }
  v.hb = 0;
  if (Math.abs(sp) < 0.8 && targetSpeed > 2) v.stuck += dt; else v.stuck = Math.max(0, v.stuck - dt);
  if (v.reverse > 0) {
    v.reverse -= dt; v.throttle = -1; v.brake = 0; v.steer = -v.steer;
  } else if (v.stuck > 1.6) { v.reverse = 1.3; v.stuck = 0; }
}

function laneAhead(v, d) {
  // aim point on the lane line 11 m ahead of the car's projection
  const off = LANE;
  if (DX[d] !== 0) return [v.x + DX[d] * 11, v.nj * C - DX[d] * 0 + (DX[d] > 0 ? off : -off)];
  return [v.ni * C + (DZ[d] > 0 ? -off : off), v.z + DZ[d] * 11];
}

const aim = [0, 0];
function chooseTurn(v) {
  const opts = [];
  if (v.ai === AI_POLICE) {
    // greedy road routing toward the goal node: prefer the axis with the larger remaining distance
    let best = -1, bs = -1e9;
    for (let k = 0; k < 4; k++) {
      if (k === ((v.dir + 2) & 3)) continue;
      const ni = v.ni + DX[k], nj = v.nj + DZ[k];
      if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
      const sc = -(Math.abs(v.gi - ni) + Math.abs(v.gj - nj)) * 10 + (k === v.dir ? 1 : 0) + rand() * 0.5;
      if (sc > bs) { bs = sc; best = k; }
    }
    return best >= 0 ? best : (v.dir + 2) & 3;
  }
  for (let k = 0; k < 4; k++) {
    if (k === ((v.dir + 2) & 3)) continue;
    const ni = v.ni + DX[k], nj = v.nj + DZ[k];
    if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
    opts.push(k);
    if (k === v.dir) opts.push(k, k);
  }
  return opts.length ? pick(opts) : (v.dir + 2) & 3;
}

function steerAlongRoad(v, dt) {
  const police = v.ai === AI_POLICE;
  // arrival at the node ahead
  const nx = v.ni * C, nz = v.nj * C;
  const dAhead = (nx - v.x) * DX[v.dir] + (nz - v.z) * DZ[v.dir];
  if (dAhead < 4) {
    const nd = chooseTurn(v);
    // (ni,nj) is the node being crossed; the next target is one step further along the chosen direction
    v.dir = nd;
    v.ni += DX[nd]; v.nj += DZ[nd];
  }
  const L = laneAhead(v, v.dir);
  aim[0] = L[0]; aim[1] = L[1];
  let target = v.cruise;
  // signal
  const nodeX = v.ni * C, nodeZ = v.nj * C;
  const dn = (nodeX - v.x) * DX[v.dir] + (nodeZ - v.z) * DZ[v.dir];
  const ph = signalPhase(G.t);
  const xAxis = DX[v.dir] !== 0;
  const red = !police && (xAxis ? ph !== 0 : ph !== 2);
  if (red && dn > 9 && dn < 30) target = Math.min(target, Math.max(0, (dn - 9.5) * 0.9));
  // leader: any car, ped or the player's body ahead in a narrow corridor
  const fx = DX[v.dir], fz = DZ[v.dir];
  const V = G.vehicles;
  for (let i = 0; i < V.length; i++) {
    const o = V[i];
    if (!o.active || o === v) continue;
    const dx = o.x - v.x, dz = o.z - v.z;
    const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < (police ? 8 : 15) && side < 2.6) target = Math.min(target, Math.max(0, (along - 6.5) * 0.8));
  }
  const Hs = G.humans;
  for (let i = 0; i < Hs.length && !police; i++) {
    const o = Hs[i];
    if (!o.active || o.state === 3) continue;
    const dx = o.x - v.x, dz = o.z - v.z;
    const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < 13 && side < 2.2) target = Math.min(target, Math.max(0, (along - 5) * 0.8));
  }
  // slow for turns
  const err = Math.abs(angleDiff(Math.atan2(aim[0] - v.x, aim[1] - v.z), v.h));
  const cap = police ? 36 : 16;
  target = Math.min(target, Math.max(4, cap - err * 9));
  driveToward(v, aim[0], aim[1], target, dt);
}

export function stepTraffic(dt) {
  const V = G.vehicles;
  for (let i = 0; i < V.length; i++) {
    const v = V[i];
    if (v.active && !v.wreck && (v.ai === AI_TRAFFIC || (v.ai === AI_POLICE && v.route))) steerAlongRoad(v, dt);
  }
}

function countAI(ai) {
  let n = 0;
  for (const v of G.vehicles) if (v.active && v.ai === ai && !v.keep) n++;
  return n;
}

function laneStart(x, z, axis) {
  // axis 0: along x on a z road ; 1: along z on an x road
  const k = axis === 0 ? Math.round(z / C) : Math.round(x / C);
  return clamp(k, 0, N);
}

export function placeTraffic(px, pz, minD, maxD, anywhere, type, ai) {
  for (let tries = 0; tries < 14; tries++) {
    const a = rand() * Math.PI * 2, r = minD + rand() * (maxD - minD);
    let x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
    if (x < 6 || z < 6 || x > WORLD - 6 || z > WORLD - 6) continue;
    const axis = randInt(2);
    const dir = axis === 0 ? (rand() < 0.5 ? 0 : 2) : (rand() < 0.5 ? 1 : 3);
    const k = laneStart(x, z, axis);
    if (axis === 0) { z = k * C + (dir === 0 ? LANE : -LANE); } else { x = k * C + (dir === 1 ? -LANE : LANE); }
    let ci, cj;
    if (axis === 0) { ci = dir === 0 ? Math.ceil(x / C) : Math.floor(x / C); cj = k; } else { ci = k; cj = dir === 1 ? Math.ceil(z / C) : Math.floor(z / C); }
    if (ci < 0 || ci > N || cj < 0 || cj > N) continue;
    // keep clear of the intersection box and of other cars
    const rx = x % C, rz = z % C;
    if ((axis === 0 && (rx < 12 || rx > C - 12)) || (axis === 1 && (rz < 12 || rz > C - 12))) continue;
    let clear = true;
    for (const o of G.vehicles) if (o.active && (o.x - x) * (o.x - x) + (o.z - z) * (o.z - z) < 100) { clear = false; break; }
    if (!clear) continue;
    if (!anywhere && (x - G.cam.x) * (x - G.cam.x) + (z - G.cam.z) * (z - G.cam.z) < 80 * 80) continue;
    const v = spawnVehicle(type || pick(TRAFFIC_TYPES), x, z, Math.atan2(DX[dir], DZ[dir]), ai || AI_TRAFFIC, randInt(10));
    if (!v) return null;
    v.dir = dir; v.ni = ci; v.nj = cj;
    v.vx = DX[dir] * v.cruise * 0.7; v.vz = DZ[dir] * v.cruise * 0.7;
    return v;
  }
  return null;
}

function placeParked(px, pz, minD, maxD) {
  for (let tries = 0; tries < 12; tries++) {
    const a = rand() * Math.PI * 2, r = minD + rand() * (maxD - minD);
    let x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
    if (x < 6 || z < 6 || x > WORLD - 6 || z > WORLD - 6) continue;
    const axis = randInt(2);
    const k = laneStart(x, z, axis);
    const side = rand() < 0.5 ? 1 : -1;
    let h;
    if (axis === 0) { z = k * C + side * 6.4; h = side > 0 ? Math.PI / 2 : -Math.PI / 2; } else { x = k * C + side * 6.4; h = side > 0 ? 0 : Math.PI; }
    const rx = x % C, rz = z % C;
    if ((axis === 0 && (rx < 14 || rx > C - 14)) || (axis === 1 && (rz < 14 || rz > C - 14))) continue;
    let clear = true;
    for (const o of G.vehicles) if (o.active && (o.x - x) * (o.x - x) + (o.z - z) * (o.z - z) < 36) { clear = false; break; }
    if (!clear) continue;
    const v = spawnVehicle(pick(TRAFFIC_TYPES), x, z, h, AI_PARKED, randInt(10));
    if (v) v.driver = 0;
    return;
  }
}

// Keep a ring of traffic around the player: spawn when short, retire cars that fell far behind.
export function streamTraffic(px, pz, filling) {
  let nt = countAI(AI_TRAFFIC), np = countAI(AI_PARKED);
  const quota = G.shot ? 0 : 1;
  if (filling) { while (nt < MAX_TRAFFIC) { placeTraffic(px, pz, 25, 150, true); nt++; } while (np < MAX_PARKED) { placeParked(px, pz, 15, 140); np++; } return; }
  if (nt < MAX_TRAFFIC && quota) placeTraffic(px, pz, 100, 170, false);
  if (np < MAX_PARKED && quota) placeParked(px, pz, 80, 150);
  for (const v of G.vehicles) {
    if (!v.active || v.keep || v.mission || (v.driver === 1)) continue;
    if (v.ai === 2) continue;
    const d2 = (v.x - px) * (v.x - px) + (v.z - pz) * (v.z - pz);
    if (d2 > 230 * 230 || (v.wreck && v.fire <= 0 && d2 > 60 * 60)) removeVehicle(v);
  }
}
