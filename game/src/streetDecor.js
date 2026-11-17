// streetDecor.js - everything that makes Port Halcyon read as a lived-in city rather than a blockout: crosswalks and
// stop lines, shop awnings and neon signboards, cars parked at the kerb, benches, bins, hydrants, bus stops, mailboxes
// and rooftop clutter. Layout is generated from its own fixed seed (the main city seed is untouched) and registers
// small colliders; geometry is merged per 256-unit chunk into three shared materials, so frustum culling still works
// and the whole layer costs a handful of draw calls instead of thousands of objects.
import * as THREE from 'three';
import { C, N, HALF_ROAD, KERB_H, WORLD } from './config.js';
import { city } from './cityLayout.js';
import { addBox } from './collision.js';
import { makeRng } from './rng.js';
import { MeshBuilder } from './meshBuilder.js';

const ACCENTS = [0xff3d7f, 0x22c7e8, 0xffb020, 0x7bd84a, 0xb86bff];
const AWNING = [[0xd8362f, 0xf4efe2], [0x1f6fb2, 0xf4efe2], [0x2e9a62, 0xf4efe2], [0xf0a020, 0xfff6dc], [0x7a3db8, 0xf4efe2]];
const CAR_COL = [0xc23b3b, 0x2f5fa8, 0xe9e6dd, 0x23262b, 0xd9a02a, 0x4a8f64, 0x8b8f96, 0xb9503a];
const CHUNK = 256;

export const decor = { parked: [], props: [], awnings: 0, signboards: 0, crosswalks: 0, roofs: 0, meshes: 0, neonMat: null };

// ---- chunked builders: one (solid, marks, neon) triple per 256-unit square of the city
const chunks = new Map();
function chunk(x, z) {
  const cx = Math.max(0, Math.min(2, Math.floor(x / CHUNK))), cz = Math.max(0, Math.min(2, Math.floor(z / CHUNK)));
  const k = cx * 3 + cz;
  let c = chunks.get(k);
  if (!c) { c = { solid: new MeshBuilder(), marks: new MeshBuilder(), neon: new MeshBuilder() }; chunks.set(k, c); }
  return c;
}

const nearAny = (list, x, z, r) => { for (const p of list) if ((p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < r * r) return true; return false; };

// ---- crosswalks and stop lines on every intersection approach
function markings() {
  const Y = 0.05, W = 0xf1eee2;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const cx = i * C, cz = j * C, b = chunk(cx, cz).marks;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + dx, nj = j + dz;
      if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
      const mid = HALF_ROAD + 2.4; // crosswalk centre distance from the intersection centre
      for (let k = -6; k <= 6; k++) {
        const along = k * 1.15; // spread across the road
        if (dx) b.floorQuad(cx + dx * mid - 1.7, cz + along - 0.34, cx + dx * mid + 1.7, cz + along + 0.34, Y, W, 0, 0, 1, 1);
        else b.floorQuad(cx + along - 0.34, cz + dz * mid - 1.7, cx + along + 0.34, cz + dz * mid + 1.7, Y, W, 0, 0, 1, 1);
      }
      decor.crosswalks++;
      // stop line across the incoming lane only
      const sl = HALF_ROAD + 5.6;
      const lo = Math.min(0.4, 7.4), hi = 7.4;
      if (dx) { const za = cz - dx * hi, zb = cz - dx * lo; b.floorQuad(cx + dx * sl - 0.3, Math.min(za, zb), cx + dx * sl + 0.3, Math.max(za, zb), Y, W, 0, 0, 1, 1); }
      else { const xa = cx + dz * lo, xb = cx + dz * hi; b.floorQuad(Math.min(xa, xb), cz + dz * sl - 0.3, Math.max(xa, xb), cz + dz * sl + 0.3, Y, W, 0, 0, 1, 1); }
    }
  }
}

// ---- awnings and neon signboards on facades that face a road
function frontOf(b, blk) {
  const dW = b.x0 - blk.x0, dE = blk.x1 - b.x1, dN = b.z0 - blk.z0, dS = blk.z1 - b.z1;
  const m = Math.min(dW, dE, dN, dS);
  if (m > 6) return null;
  if (m === dN) return { nx: 0, nz: -1, cx: (b.x0 + b.x1) / 2, cz: b.z0, w: b.x1 - b.x0 };
  if (m === dS) return { nx: 0, nz: 1, cx: (b.x0 + b.x1) / 2, cz: b.z1, w: b.x1 - b.x0 };
  if (m === dW) return { nx: -1, nz: 0, cx: b.x0, cz: (b.z0 + b.z1) / 2, w: b.z1 - b.z0 };
  return { nx: 1, nz: 0, cx: b.x1, cz: (b.z0 + b.z1) / 2, w: b.z1 - b.z0 };
}

function facades(rng) {
  for (const b of city.buildings) {
    if (b.kind === 'container' || b.kind === 'hut' || b.kind === 'tower') continue;
    const bi = Math.floor(((b.x0 + b.x1) / 2) / C), bj = Math.floor(((b.z0 + b.z1) / 2) / C);
    const blk = city.blocks[bi] && city.blocks[bi][bj];
    if (!blk) continue;
    const f = frontOf(b, blk);
    if (!f || f.w < 8) continue;
    const s = chunk(f.cx, f.cz);
    const pal = AWNING[Math.floor(rng() * AWNING.length)];
    const acc = ACCENTS[Math.floor(rng() * ACCENTS.length)];
    // along-facade axis (ax, az) and outward normal (nx, nz)
    const ax = Math.abs(f.nz), az = Math.abs(f.nx);
    const wAw = Math.min(f.w - 2, 11), segs = Math.max(3, Math.round(wAw / 2));
    const sw = wAw / segs;
    if (b.kind !== 'warehouse' && rng() < 0.8) {
      // striped awning: tilted slabs standing out 1.6 m from the wall, a valance under the lip
      for (let k = 0; k < segs; k++) {
        const t = -wAw / 2 + sw * (k + 0.5);
        const x = f.cx + ax * t + f.nx * 0.95, z = f.cz + az * t + f.nz * 0.95;
        const col = k % 2 ? pal[1] : pal[0];
        s.solid.box(x, KERB_H + 2.55, z, ax ? sw : 1.9, 0.09, ax ? 1.9 : sw, col);
        s.solid.box(x + f.nx * 0.85, KERB_H + 2.32, z + f.nz * 0.85, ax ? sw : 0.08, 0.34, ax ? 0.08 : sw, col);
      }
      // two slim posts
      for (const t of [-wAw / 2 + 0.2, wAw / 2 - 0.2]) s.solid.box(f.cx + ax * t + f.nx * 1.75, KERB_H + 1.2, f.cz + az * t + f.nz * 1.75, 0.1, 2.4, 0.1, 0x3a3f46);
      decor.awnings++;
    }
    if (b.kind !== 'house' || rng() < 0.4) {
      // neon signboard above the awning: dark frame, bright accent field, light strip, plus a blade sign
      const y = KERB_H + 6.1 + rng() * 0.5, sw2 = Math.min(f.w - 3, 6.5);
      const px = f.cx + f.nx * 0.2, pz = f.cz + f.nz * 0.2;
      s.solid.box(px, y, pz, ax ? sw2 + 0.3 : 0.3, 1.25, ax ? 0.3 : sw2 + 0.3, 0x23262b);
      s.neon.box(px + f.nx * 0.18, y, pz + f.nz * 0.18, ax ? sw2 : 0.08, 0.95, ax ? 0.08 : sw2, acc);
      s.neon.box(px + f.nx * 0.24, y - 0.25, pz + f.nz * 0.24, ax ? sw2 * 0.8 : 0.06, 0.12, ax ? 0.06 : sw2 * 0.8, 0xfff2cc);
      const bx = f.cx + ax * (f.w / 2 - 1.2) + f.nx * 1.0, bz = f.cz + az * (f.w / 2 - 1.2) + f.nz * 1.0;
      s.solid.box(bx - f.nx * 0.5, KERB_H + 5.2, bz - f.nz * 0.5, ax ? 0.08 : 1.0, 0.08, ax ? 1.0 : 0.08, 0x23262b);
      s.neon.box(bx, KERB_H + 4.95, bz, ax ? 0.1 : 0.9, 0.9, ax ? 0.9 : 0.1, ACCENTS[(ACCENTS.indexOf(acc) + 2) % ACCENTS.length]);
      decor.signboards++;
    }
    roofClutter(rng, b, s.solid);
  }
}

// ---- rooftop details: parapet, AC units, water tank, stair box, dish, solar panels
function roofClutter(rng, b, sb) {
  const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, top = b.h + KERB_H;
  decor.roofs++;
  if (b.kind === 'house') {
    sb.box(b.x0 + w * 0.7, top + 1.6, b.z0 + d * 0.3, 0.9, 2.2, 0.9, 0x9b5b45); // chimney
    sb.box(cx - w * 0.25, top + 1.3, cz + d * 0.15, 1.3, 0.6, 1.3, 0xb8bcc2); // AC
    return;
  }
  const rim = b.kind === 'warehouse' ? 0xa8a49a : 0xd8d4c8;
  sb.box(cx, top + 0.35, b.z0 + 0.15, w, 0.7, 0.3, rim); sb.box(cx, top + 0.35, b.z1 - 0.15, w, 0.7, 0.3, rim);
  sb.box(b.x0 + 0.15, top + 0.35, cz, 0.3, 0.7, d, rim); sb.box(b.x1 - 0.15, top + 0.35, cz, 0.3, 0.7, d, rim);
  const n = 1 + Math.floor(rng() * 3);
  for (let k = 0; k < n; k++) {
    const x = b.x0 + 2 + rng() * (w - 4), z = b.z0 + 2 + rng() * (d - 4);
    sb.box(x, top + 0.75, z, 1.8, 1.1, 1.4, 0xaeb3b9); sb.box(x, top + 1.36, z, 1.5, 0.12, 1.1, 0x4c525a);
  }
  if (b.kind === 'office' || b.kind === 'mid') {
    const x = b.x0 + 3 + rng() * (w - 6), z = b.z0 + 3 + rng() * (d - 6);
    for (const [ox, oz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) sb.box(x + ox, top + 1.0, z + oz, 0.14, 2.0, 0.14, 0x5b4630); // tank legs
    sb.box(x, top + 3.0, z, 2.4, 2.0, 2.4, 0x8a6a4a); sb.box(x, top + 4.15, z, 2.6, 0.3, 2.6, 0x6e5238);
    sb.box(b.x1 - 3, top + 1.4, b.z1 - 3, 2.4, 2.8, 2.4, 0x9a9a98); // stair box
  } else if (b.kind === 'warehouse') {
    for (let k = 0; k < 4; k++) sb.box(b.x0 + 4 + k * 4.2, top + 0.7, cz, 3.4, 0.2, d * 0.5, 0x23395b, { rx: 0.25 }); // solar row
  }
}

// ---- parked cars along the kerb lane, as static merged boxes with real colliders
function parkedCars(rng) {
  const spots = [city.places.carSpot, city.places.vanSpot];
  for (let axis = 0; axis < 2; axis++) for (let k = 0; k <= N; k++) for (let seg = 0; seg < N; seg++) for (const side of [-1, 1]) for (const rx of [19, 32, 45]) {
    if (rng() > 0.2) continue;
    const along = seg * C + rx, off = k * C + side * 6.4;
    const x = axis === 0 ? along : off, z = axis === 0 ? off : along;
    if (x < 4 || z < 4 || x > WORLD - 4 || z > WORLD - 4) continue;
    if (nearAny(spots, x, z, 9)) continue;
    const col = CAR_COL[Math.floor(rng() * CAR_COL.length)];
    const s = chunk(x, z).solid, L = 4.3, Wd = 1.8;
    const sx = axis === 0 ? L : Wd, sz = axis === 0 ? Wd : L;
    s.box(x, 0.62, z, sx, 0.62, sz, col);                                                            // body
    s.box(x, 1.22, z, axis === 0 ? 2.2 : 1.6, 0.55, axis === 0 ? 1.6 : 2.2, 0x1d2a38);              // glass cabin
    s.box(x, 1.55, z, axis === 0 ? 2.0 : 1.5, 0.06, axis === 0 ? 1.5 : 2.0, col);                    // roof
    s.box(x, 0.27, z, axis === 0 ? 3.5 : 1.9, 0.5, axis === 0 ? 1.9 : 3.5, 0x15171a);                // wheels and underbody
    addBox(x - sx / 2, z - sz / 2, x + sx / 2, z + sz / 2, 1.5);
    decor.parked.push({ x, z });
  }
}

// ---- sidewalk furniture
function props(rng) {
  const named = Object.values(city.places);
  const keepOff = (x, z) => nearAny(named, x, z, 4.5) || nearAny(city.lamps, x, z, 1.8) || nearAny(city.palms, x, z, 1.8) || nearAny(decor.props, x, z, 2.4);
  for (let bi = 0; bi < N; bi++) for (let bj = 0; bj < N; bj++) {
    const blk = city.blocks[bi][bj];
    if (blk.type === 'industrial' || blk.type === 'port') continue;
    const sides = ['n', 's', 'w', 'e'];
    const place = (kind, side, t) => {
      const along = t, inset = 1.25;
      const x = side === 'w' ? blk.x0 + inset : side === 'e' ? blk.x1 - inset : blk.x0 + along;
      const z = side === 'n' ? blk.z0 + inset : side === 's' ? blk.z1 - inset : blk.z0 + along;
      if (keepOff(x, z)) return false;
      const nx = side === 'w' ? -1 : side === 'e' ? 1 : 0, nz = side === 'n' ? -1 : side === 's' ? 1 : 0; // facing the road
      const s = chunk(x, z).solid, y = KERB_H, ax = nz !== 0;
      if (kind === 'hydrant') { s.box(x, y + 0.4, z, 0.34, 0.8, 0.34, 0xd8362f); s.box(x, y + 0.85, z, 0.44, 0.12, 0.44, 0xd8362f); s.box(x, y + 0.5, z, ax ? 0.62 : 0.2, 0.14, ax ? 0.2 : 0.62, 0xd8362f); addBox(x - 0.25, z - 0.25, x + 0.25, z + 0.25, 0.9); }
      else if (kind === 'bin') { s.box(x, y + 0.5, z, 0.6, 1.0, 0.6, 0x3f6f58); s.box(x, y + 1.04, z, 0.68, 0.1, 0.68, 0x23262b); addBox(x - 0.32, z - 0.32, x + 0.32, z + 0.32, 1.05); }
      else if (kind === 'mailbox') { s.box(x, y + 0.75, z, 0.5, 1.2, 0.5, 0x2f5fa8); s.box(x, y + 1.4, z, 0.5, 0.18, 0.5, 0x23487a); addBox(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 1.5); }
      else if (kind === 'bench') {
        const lx = ax ? 1.9 : 0.55, lz = ax ? 0.55 : 1.9;
        s.box(x, y + 0.5, z, lx, 0.1, lz, 0x9c7a55);                                               // seat
        s.box(x - nx * 0.28, y + 0.95, z - nz * 0.28, ax ? 1.9 : 0.1, 0.55, ax ? 0.1 : 1.9, 0x8a6a4a); // back, toward the buildings
        for (const e of [-0.8, 0.8]) s.box(x + (ax ? e : 0), y + 0.25, z + (ax ? 0 : e), 0.1, 0.5, 0.1, 0x3a3f46);
        addBox(x - lx / 2, z - lz / 2, x + lx / 2, z + lz / 2, 1.0);
      } else if (kind === 'busstop') {
        const lx = ax ? 3.6 : 1.4, lz = ax ? 1.4 : 3.6;
        s.box(x, y + 2.5, z, lx, 0.12, lz, 0x2b3038);                                                 // roof
        s.box(x - nx * 0.55, y + 1.3, z - nz * 0.55, ax ? 3.4 : 0.06, 2.3, ax ? 0.06 : 3.4, 0x6fa6c2); // glass back
        for (const e of [-1.7, 1.7]) s.box(x + (ax ? e : 0), y + 1.25, z + (ax ? 0 : e), 0.1, 2.5, 0.1, 0x2b3038);
        s.box(x - nx * 0.1, y + 0.5, z - nz * 0.1, ax ? 2.4 : 0.5, 0.1, ax ? 0.5 : 2.4, 0xc9c4b8);   // bench
        const ps = chunk(x, z);
        ps.solid.box(x + (ax ? 2.2 : 0), y + 1.5, z + (ax ? 0 : 2.2), 0.08, 3.0, 0.08, 0x3a3f46);     // stop pole
        ps.neon.box(x + (ax ? 2.2 : 0), y + 3.1, z + (ax ? 0 : 2.2), 0.7, 0.5, 0.12, 0x22c7e8);        // route plate
        addBox(x - lx / 2, z - lz / 2, x + lx / 2, z + lz / 2, 2.6);
      }
      decor.props.push({ kind, x, z });
      return true;
    };
    const order = [['hydrant', 9], ['bin', 25], ['mailbox', 41], ['bench', 17], ['bench', 31]];
    for (const [kind, t] of order) {
      if (kind === 'bench' && rng() < 0.45) continue;
      const side = sides[Math.floor(rng() * 4)];
      place(kind, side, t + (rng() - 0.5) * 3) || place(kind, side, t + 4);
    }
    if (blk.type !== 'beach' && blk.type !== 'park' && rng() < 0.45) {
      const side = sides[Math.floor(rng() * 4)];
      place('busstop', side, 12 + rng() * 22);
    }
  }
}

// ---- build meshes
export function buildStreetDecor(scene) {
  const rng = makeRng(8675309);
  markings(); parkedCars(rng); props(rng); facades(rng);
  const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const marksMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const neonMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  decor.neonMat = neonMat;
  const group = new THREE.Group();
  for (const c of chunks.values()) {
    for (const [b, mat, cast, recv] of [[c.solid, solidMat, true, true], [c.marks, marksMat, false, true], [c.neon, neonMat, false, false]]) {
      if (!b.pos.length) continue;
      const m = new THREE.Mesh(b.build(), mat);
      m.castShadow = cast; m.receiveShadow = recv; m.matrixAutoUpdate = false;
      group.add(m); decor.meshes++;
    }
  }
  scene.add(group);
  return group;
}
