// cityLayout.js - generates Port Halcyon: districts, blocks, buildings, props and named places from a fixed seed,
// and registers every solid thing with the collision grid. Pure data: no three.js here.
import { C, HALF_ROAD, N, WORLD, KERB_H } from './config.js';
import { makeRng } from './rng.js';
import { addBox } from './collision.js';

export const city = { blocks: [], buildings: [], palms: [], lamps: [], signs: [], nodes: [], places: {}, parked: [], pickups: [], bounds: { x0: -14, z0: -14, x1: WORLD + 14, z1: WORLD + 70 } };

export const SIGN_NAMES = [
  'PELICAN DINER', 'QUICKSHINE GARAGE', 'BRASS PELICAN GUNS', 'TIDELINE TACOS', 'PALMETTO BANK', 'NEON PELICAN', 'MERCY GENERAL', 'OSTRANDER',
  "SUNDAY'S COFFEE", 'HALCYON HOTEL', "SALTY'S BAIT", 'CASA MARISOL', 'BLUE CRAB SUSHI', 'FLAMINGO MOTEL', 'LUCKY 9 ARCADE', 'GULL ST MARKET',
  'SOL RECORDS', 'SPIN CYCLE', 'CORAL BEAUTY', 'TIKI HUT', 'DOCKSIDE FUEL', 'WAREHOUSE 9', 'VOLT PHARMACY', 'KING TIDE BREWERY',
];
const PASTELS = [0xf2c9b0, 0xf6e3b4, 0xbfe3d6, 0xf0a9a0, 0xe9d8c4, 0xa9d4e8, 0xf7d6e0, 0xfff1d6, 0xc9e4b8, 0xf4b985];
const GLASS = [0x7aa6c2, 0x8fb4c8, 0x6f95b0, 0x9bbfd0, 0xb5c9d3, 0x5e86a6];
const CONTAINER = [0xc0503a, 0x2f6f8f, 0xd8a13a, 0x3f8a5a, 0x8a4a8a, 0xe9e2d0];

export const blockX0 = (bi) => bi * C + HALF_ROAD;
export const blockX1 = (bi) => (bi + 1) * C - HALF_ROAD;

export function districtOf(bi, bj) {
  if (bj === N - 1 && bi < 8) return 'beach';
  if (bj >= N - 2 && bi >= 8) return 'port';
  if ((bi === 2 && bj === 2) || (bi === 9 && bj === 5) || (bi === 5 && bj === 8)) return 'park';
  if (bi >= 4 && bi <= 7 && bj >= 3 && bj <= 6) return 'downtown';
  if (bi <= 2 && bj <= 4) return 'industrial';
  if (bi >= 3 && bi <= 8 && bj >= 2 && bj <= 8) return 'mid';
  return 'resid';
}

// A point on the sidewalk of block (bi,bj): side n/s/e/w, t 0..1 along it.
export function sidewalkPoint(bi, bj, side, t) {
  const x0 = blockX0(bi), x1 = blockX1(bi), z0 = blockX0(bj), z1 = blockX1(bj);
  if (side === 'n') return { x: x0 + t * 48, z: z0 + 1.5 };
  if (side === 's') return { x: x0 + t * 48, z: z1 - 1.5 };
  if (side === 'w') return { x: x0 + 1.5, z: z0 + t * 48 };
  return { x: x1 - 1.5, z: z0 + t * 48 };
}
export const roadCentre = (i) => i * C;

function addBuilding(b) {
  city.buildings.push(b);
  addBox(b.x0, b.z0, b.x1, b.z1, b.h);
}

function addSign(rng, b, bi, bj, forced) {
  // choose the facade that faces the nearest road
  const bx0 = blockX0(bi), bx1 = blockX1(bi), bz0 = blockX0(bj), bz1 = blockX1(bj);
  const dW = b.x0 - bx0, dE = bx1 - b.x1, dN = b.z0 - bz0, dS = bz1 - b.z1;
  const m = Math.min(dW, dE, dN, dS);
  if (m > 6) return;
  let nx = 0, nz = 0, cx, cz;
  if (m === dN) { nz = -1; cx = (b.x0 + b.x1) / 2; cz = b.z0 - 0.12; }
  else if (m === dS) { nz = 1; cx = (b.x0 + b.x1) / 2; cz = b.z1 + 0.12; }
  else if (m === dW) { nx = -1; cx = b.x0 - 0.12; cz = (b.z0 + b.z1) / 2; }
  else { nx = 1; cx = b.x1 + 0.12; cz = (b.z0 + b.z1) / 2; }
  city.signs.push({ x: cx, y: 3.4 + rng() * 1.2, z: cz, nx, nz, w: 6.5, h: 1.6, idx: forced >= 0 ? forced : Math.floor(rng() * SIGN_NAMES.length) });
}

function buildBlock(rng, bi, bj) {
  const type = districtOf(bi, bj);
  const x0 = blockX0(bi), x1 = blockX1(bi), z0 = blockX0(bj), z1 = blockX1(bj);
  const blk = { bi, bj, type, x0, z0, x1, z1 };
  city.blocks[bi][bj] = blk;
  const ix0 = x0 + 3, ix1 = x1 - 3, iz0 = z0 + 3, iz1 = z1 - 3; // inner lot area 42 x 42
  const forcedSign = (bi === 3 && bj === 6) ? 0 : (bi === 7 && bj === 7) ? 1 : (bi === 4 && bj === 3) ? 2 : -1;
  if (type === 'downtown') {
    if (bi === 5 && bj === 4) {
      addBuilding({ x0: ix0 + 6, z0: iz0 + 6, x1: ix1 - 6, z1: iz1 - 6, h: 188, color: 0x4f7fa0, kind: 'tower', crown: true });
      addSign(rng, city.buildings[city.buildings.length - 1], bi, bj, 7);
    } else if (rng() < 0.5) {
      const h = 4 * (16 + Math.floor(rng() * 22));
      const inset = 3 + rng() * 3;
      addBuilding({ x0: ix0 + inset, z0: iz0 + inset, x1: ix1 - inset, z1: iz1 - inset, h, color: GLASS[Math.floor(rng() * GLASS.length)], kind: 'tower' });
    } else {
      for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {
        const h = 4 * (8 + Math.floor(rng() * 14));
        const bx = ix0 + a * 22, bz = iz0 + c * 22;
        const b = { x0: bx, z0: bz, x1: bx + 20, z1: bz + 20, h, color: rng() < 0.6 ? GLASS[Math.floor(rng() * GLASS.length)] : PASTELS[Math.floor(rng() * PASTELS.length)], kind: 'office' };
        addBuilding(b);
        if (rng() < 0.3) addSign(rng, b, bi, bj, -1);
      }
    }
  } else if (type === 'mid') {
    for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {
      if (rng() < 0.12) continue;
      const bx = ix0 + a * 22, bz = iz0 + c * 22;
      const h = 4 * (3 + Math.floor(rng() * 8));
      const b = { x0: bx, z0: bz, x1: bx + 20, z1: bz + 20, h, color: PASTELS[Math.floor(rng() * PASTELS.length)], kind: 'mid' };
      addBuilding(b);
      if (rng() < 0.5) addSign(rng, b, bi, bj, (bi === 4 && bj === 3 && a === 0 && c === 1) ? 2 : (bi === 7 && bj === 7 && a === 0 && c === 0) ? 1 : -1);
    }
  } else if (type === 'resid') {
    for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) {
      if (rng() < 0.18) continue;
      const w = 11 + rng() * 2, d = 11 + rng() * 2;
      const bx = ix0 + a * 14.5 + 0.5, bz = iz0 + c * 14.5 + 0.5;
      const h = 4 * (2 + Math.floor(rng() * 2));
      const b = { x0: bx, z0: bz, x1: bx + w, z1: bz + d, h, color: PASTELS[Math.floor(rng() * PASTELS.length)], kind: 'house' };
      addBuilding(b);
      if (rng() < 0.12) addSign(rng, b, bi, bj, forcedSign >= 0 && a === 1 && c === 0 ? forcedSign : -1);
    }
    if (forcedSign >= 0) {
      const b = { x0: ix0 + 13, z0: iz0 + 1, x1: ix0 + 29, z1: iz0 + 12, h: 8, color: 0xf0a9a0, kind: 'house' };
      city.buildings.push(b); addBox(b.x0, b.z0, b.x1, b.z1, b.h); addSign(rng, b, bi, bj, forcedSign);
    }
  } else if (type === 'industrial' || type === 'port') {
    const h = 4 * (2 + Math.floor(rng() * 2));
    if (type === 'industrial') {
      addBuilding({ x0: ix0, z0: iz0, x1: ix1, z1: iz0 + 17, h, color: 0xcfc6b6, kind: 'warehouse' });
      for (let k = 0; k < 6; k++) {
        const bx = ix0 + (k % 3) * 14 + 1, bz = iz0 + 24 + Math.floor(k / 3) * 8;
        addBuilding({ x0: bx, z0: bz, x1: bx + 11, z1: bz + 2.6, h: 2.6 * (1 + Math.floor(rng() * 2)), color: CONTAINER[Math.floor(rng() * CONTAINER.length)], kind: 'container' });
      }
    } else {
      addBuilding({ x0: ix0, z0: iz0, x1: ix1, z1: iz0 + 20, h, color: 0xb8c4cc, kind: 'warehouse' });
      for (let k = 0; k < 9; k++) {
        const bx = ix0 + (k % 3) * 14 + 1, bz = iz0 + 26 + Math.floor(k / 3) * 5;
        addBuilding({ x0: bx, z0: bz, x1: bx + 11, z1: bz + 2.6, h: 2.6 * (1 + Math.floor(rng() * 3)), color: CONTAINER[Math.floor(rng() * CONTAINER.length)], kind: 'container' });
      }
    }
    if (bi === 10 && bj === 10) { city.signs.push({ x: ix0 + 20, y: 6.5, z: iz0 + 17.12, nx: 0, nz: 1, w: 8, h: 2, idx: 21 }); }
  } else if (type === 'beach') {
    for (let k = 0; k < 4; k++) {
      const bx = ix0 + 5 + k * 10, bz = iz0 + 6;
      addBuilding({ x0: bx, z0: bz, x1: bx + 4.5, z1: bz + 4.5, h: 4, color: PASTELS[(k * 3 + bi) % PASTELS.length], kind: 'hut' });
    }
    addBuilding({ x0: ix0 + 30, z0: iz0 + 20, x1: ix0 + 32, z1: iz0 + 22, h: 6, color: 0xf2f2f2, kind: 'hut' });
  }
  // palms and lamps along sidewalks
  if (type !== 'industrial' && type !== 'port') {
    const step = type === 'beach' || type === 'park' ? 9 : 16;
    for (let t = 6; t < 46; t += step) {
      if (type === 'downtown' && t % 2 > 0.1 && rng() < 0.5) continue;
      city.palms.push({ x: x0 + t, z: z0 + 2.4, s: 0.8 + rng() * 0.5 });
      city.palms.push({ x: x0 + t + 3, z: z1 - 2.4, s: 0.8 + rng() * 0.5 });
      if (type === 'beach' || type === 'park') {
        city.palms.push({ x: x0 + 2.4, z: z0 + t, s: 0.8 + rng() * 0.5 });
        city.palms.push({ x: x1 - 2.4, z: z0 + t + 3, s: 0.8 + rng() * 0.5 });
      }
    }
  }
  if (type === 'park') {
    for (let k = 0; k < 14; k++) city.palms.push({ x: ix0 + 3 + rng() * 36, z: iz0 + 3 + rng() * 36, s: 1 + rng() * 0.6 });
  }
  for (const t of [14, 34]) {
    city.lamps.push({ x: x0 + t, z: z0 + 2.7 }, { x: x1 - t, z: z1 - 2.7 }, { x: x0 + 2.7, z: z1 - t }, { x: x1 - 2.7, z: z0 + t });
  }
}

export function buildCityLayout() {
  const rng = makeRng(20261117);
  for (let i = 0; i < N; i++) city.blocks.push(new Array(N));
  for (let bi = 0; bi < N; bi++) for (let bj = 0; bj < N; bj++) buildBlock(rng, bi, bj);
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) city.nodes.push({ i, j, x: i * C, z: j * C });
  for (const p of city.palms) addBox(p.x - 0.3, p.z - 0.3, p.x + 0.3, p.z + 0.3, 8);
  for (const l of city.lamps) addBox(l.x - 0.2, l.z - 0.2, l.x + 0.2, l.z + 0.2, 6);
  // world boundary walls, with a gap for the pier
  const b = city.bounds;
  addBox(b.x0 - 8, b.z0 - 8, b.x1 + 8, b.z0, 99);
  addBox(b.x0 - 8, b.z0, b.x0, b.z1 + 8, 99);
  addBox(b.x1, b.z0, b.x1 + 8, b.z1 + 8, 99);
  addBox(b.x0, WORLD + 30, 392, b.z1 + 8, 99);
  addBox(408, WORLD + 30, b.x1, b.z1 + 8, 99);
  addBox(392, b.z1, 408, b.z1 + 8, 99);
  addBox(b.x0, WORLD + 26, 392, WORLD + 30, 99);
  addBox(408, WORLD + 26, b.x1, WORLD + 30, 99);
  // named places (all on sidewalks or road margins, never inside a building)
  const P = city.places;
  const pt = (bi, bj, side, t) => sidewalkPoint(bi, bj, side, t);
  P.diner = { name: 'Pelican Diner', ...pt(3, 6, 'n', 0.5) };
  P.garage = { name: 'Quickshine Garage', ...pt(7, 7, 'w', 0.5) };
  P.guns = { name: 'Brass Pelican Guns', ...pt(4, 3, 's', 0.5) };
  P.safehouse = { name: 'Gull Street Safehouse', ...pt(2, 9, 'e', 0.5) };
  P.hospital = { name: 'Mercy General', ...pt(8, 2, 's', 0.5) };
  P.tower = { name: 'Ostrander Tower', ...pt(5, 4, 's', 0.5) };
  P.pier = { name: 'Tideline Pier', x: 400, z: WORLD + 52 };
  P.docks = { name: 'Warehouse 9', ...pt(10, 10, 'n', 0.5) };
  P.yard = { name: 'Salt Kings Yard', ...pt(1, 1, 'e', 0.5) };
  P.carSpot = { name: 'Vesper GT', x: roadCentre(9) + 11.5, z: roadCentre(5) + 14 };
  P.vanSpot = { name: 'Hauler van', x: roadCentre(11) + 11.5, z: roadCentre(10) - 12 };
  return city;
}

// Ground height under a point: raised sidewalks inside blocks, flat asphalt on roads.
export function groundHeight(x, z) {
  if (x < 0 || z < 0 || x > WORLD || z > WORLD) return 0;
  const rx = x % C, rz = z % C;
  const inRoadX = rx < HALF_ROAD || rx > C - HALF_ROAD;
  const inRoadZ = rz < HALF_ROAD || rz > C - HALF_ROAD;
  return inRoadX || inRoadZ ? 0 : KERB_H;
}
export function onRoad(x, z) {
  return groundHeight(x, z) === 0 && x >= 0 && z >= 0 && x <= WORLD && z <= WORLD;
}
