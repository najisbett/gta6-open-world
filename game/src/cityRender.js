// cityRender.js - turns the city layout into three.js meshes: ground, ocean, roads, sidewalks, buildings with lit
// windows, neon signs, palms, lamps and traffic signals. Static geometry is merged into a handful of draw calls.
import * as THREE from 'three';
import { C, N, WORLD, KERB_H, HALF_ROAD } from './config.js';
import { city, districtOf } from './cityLayout.js';
import { MeshBuilder } from './meshBuilder.js';
import { makeWetRoad } from './weather.js';
import { makeWindowTextures, makeRoadTexture, makeIntersectionTexture, makeSandTexture, makeWaterTexture, makeSignAtlas, signUv } from './proceduralTextures.js';

export const cityView = { buildingMat: null, signMat: null, lampMat: null, lightX: null, lightZ: null, water: null, waterTex: null };

const GROUND_COL = { downtown: 0xc9c5bd, mid: 0xcfc9bb, resid: 0x9fc27a, industrial: 0x9a9a95, port: 0x8d9296, beach: 0xe8d6a4, park: 0x6fae5a };

function addPalm(b, p) {
  const s = p.s, H = 7.5 * s;
  for (let k = 0; k < 5; k++) b.box(p.x + Math.sin(k * 0.7) * 0.12 * s, 0.7 * s + k * (H / 5), p.z, (0.5 - k * 0.05) * s, H / 5 + 0.05, (0.5 - k * 0.05) * s, k % 2 ? 0x8a6a4a : 0x7a5c3e);
  const topX = p.x + Math.sin(4 * 0.7) * 0.12 * s, topY = H + 0.6 * s;
  for (let f = 0; f < 7; f++) {
    const a = (f / 7) * Math.PI * 2 + p.x;
    b.box(topX + Math.cos(a) * 1.9 * s, topY - 0.35 * s, p.z + Math.sin(a) * 1.9 * s, 3.9 * s, 0.07, 1.1 * s, f % 2 ? 0x2f8a46 : 0x3fa356, { ry: -a, rz: -0.38 });
  }
  b.box(topX, topY - 0.1, p.z, 0.55 * s, 0.5 * s, 0.55 * s, 0x6b4a2e);
}

// ---- facade variation: everything below is a pure function of the building index, so the same seed gives the
// same city every run. The window texture holds a 4x4 grid of bays per repeat; we rescale world-space UVs so each
// building gets its own storey height (and so storey count) and bay width, and pick a roofline per building.
function hashIdx(i, salt) {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
}
const STOREY_H = [3.3, 3.7, 4.1, 4.6, 5.2];
const BAY_W = [2.6, 3.2, 3.8, 4.5, 5.4];
const ROOF_TALL = 5, ROOF_HOUSE = 3, ROOF_SHED = 3;
// Pick an option from n for building i, never repeating the previous building's pick on the same channel.
function pickNo(i, salt, n, prev) {
  let k = hashIdx(i, salt) % n;
  if (k === prev) k = (k + 1 + (hashIdx(i, salt + 101) % (n - 1))) % n;
  return k;
}
const _shade = new THREE.Color();
function shade(hex, f) { _shade.setHex(hex).multiplyScalar(f); return _shade.getHex(); }

// A box whose side UVs map one texture repeat to (4*bay) horizontally and (4*storey) vertically, starting at a
// storey line at ground level and offset sideways by ou repeats.
function facadeBox(b, cx, cy, cz, sx, sy, sz, color, bay, storey, ou) {
  const start = b.uv.length;
  b.box(cx, cy, cz, sx, sy, sz, color, { tile: 1 });
  const tu = 4 * bay, tv = 4 * storey;
  for (let v = 0; v < 24; v++) {
    if (v >= 8 && v < 16) continue; // top and bottom faces keep the solid corner sample
    const a = start + v * 2;
    b.uv[a] = b.uv[a] / tu + ou;
    b.uv[a + 1] = (b.uv[a + 1] - KERB_H) / tv;
  }
}
function parapet(bb, cx, cz, w, d, y, ht, t, color) {
  bb.box(cx, y + ht / 2, cz - d / 2 + t / 2, w, ht, t, color);
  bb.box(cx, y + ht / 2, cz + d / 2 - t / 2, w, ht, t, color);
  bb.box(cx - w / 2 + t / 2, y + ht / 2, cz, t, ht, d - 2 * t, color);
  bb.box(cx + w / 2 - t / 2, y + ht / 2, cz, t, ht, d - 2 * t, color);
}

export function buildCityMeshes(scene) {
  const win = makeWindowTextures();
  const group = new THREE.Group();
  scene.add(group);

  // ---- ground and ocean
  const sandTex = makeSandTexture(); sandTex.repeat.set(120, 120);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1900), new THREE.MeshLambertMaterial({ color: 0xcfc4a0, map: sandTex }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(WORLD / 2, -0.02, WORLD + 8 - 950); ground.receiveShadow = true;
  group.add(ground);
  const waterTex = makeWaterTexture(); waterTex.repeat.set(60, 60);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1400), new THREE.MeshPhongMaterial({ color: 0x2fb0c4, map: waterTex, shininess: 90, specular: 0xffffff, transparent: true, opacity: 0.94 }));
  water.rotation.x = -Math.PI / 2; water.position.set(WORLD / 2, -0.35, WORLD + 8 + 700);
  group.add(water);
  cityView.water = water; cityView.waterTex = waterTex;
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(2600, 40), new THREE.MeshLambertMaterial({ color: 0xf0dfae, map: sandTex }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(WORLD / 2, 0.0, WORLD + 8 + 22); beach.receiveShadow = true;
  group.add(beach);

  // ---- roads
  const roadTex = makeRoadTexture();
  const roadMat = makeWetRoad(new THREE.MeshPhongMaterial({ map: roadTex, specular: 0x141414, shininess: 14 }));
  const rb = new MeshBuilder();
  const R = HALF_ROAD, L = WORLD + 2 * R;
  for (let i = 0; i <= N; i++) {
    const c = i * C, rep = L / 16;
    // road along z at x = c: u across x, v along z
    rb.floorQuad(c - R, -R, c + R, WORLD + R, 0.02, 0xffffff, 0, 0, 1, rep);
    // road along x at z = c: stretch with swapped uvs
  }
  const roadsZ = new THREE.Mesh(rb.build(), roadMat); roadsZ.receiveShadow = true; group.add(roadsZ);
  const rb2 = new MeshBuilder();
  for (let j = 0; j <= N; j++) {
    const c = j * C, rep = L / 16;
    // uv rotated: u runs along v of quad; build quad manually with swapped uvs
    const base = rb2.pos.length / 3;
    const pts = [[-R, c - R, 0, 0], [WORLD + R, c - R, 0, rep], [WORLD + R, c + R, 1, rep], [-R, c + R, 1, 0]];
    for (const p of pts) { rb2.pos.push(p[0], 0.024, p[1]); rb2.nor.push(0, 1, 0); rb2.col.push(1, 1, 1); rb2.uv.push(p[2], p[3]); }
    rb2.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const roadsX = new THREE.Mesh(rb2.build(), roadMat); roadsX.receiveShadow = true; group.add(roadsX);
  const ib = new MeshBuilder();
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) ib.floorQuad(i * C - R, j * C - R, i * C + R, j * C + R, 0.03, 0xffffff, 0, 0, 1, 1);
  const inter = new THREE.Mesh(ib.build(), makeWetRoad(new THREE.MeshPhongMaterial({ map: makeIntersectionTexture(), specular: 0x141414, shininess: 14 }))); inter.receiveShadow = true; group.add(inter);

  // ---- sidewalk slabs and lot ground
  const sb = new MeshBuilder();
  for (let bi = 0; bi < N; bi++) for (let bj = 0; bj < N; bj++) {
    const k = city.blocks[bi][bj];
    sb.box((k.x0 + k.x1) / 2, KERB_H / 2, (k.z0 + k.z1) / 2, 48, KERB_H, 48, k.type === 'beach' ? 0xe9dcb4 : 0xc9c4b8);
    sb.box((k.x0 + k.x1) / 2, KERB_H + 0.02, (k.z0 + k.z1) / 2, 42, 0.05, 42, GROUND_COL[k.type]);
  }
  const slabs = new THREE.Mesh(sb.build(), new THREE.MeshLambertMaterial({ vertexColors: true })); slabs.receiveShadow = true; group.add(slabs);

  // ---- buildings
  const bb = new MeshBuilder();
  // Collision uses b.h, so the main body keeps its height; storeys, bays and roof furniture vary on top of it.
  let prevS = -1, prevB = -1, prevR = -1;
  city.buildings.forEach((b, i) => {
    const w = b.x1 - b.x0, d = b.z1 - b.z0;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, top = b.h + KERB_H;
    const textured = b.kind !== 'container' && b.kind !== 'hut';
    if (!textured) { bb.box(cx, b.h / 2 + KERB_H, cz, w, b.h, d, b.color, { tile: 400 }); return; }
    const sI = pickNo(i, 1, STOREY_H.length, prevS), bI = pickNo(i, 2, BAY_W.length, prevB);
    prevS = sI; prevB = bI;
    // whole number of storeys that fill the body exactly, so the top floor never gets cut mid-window
    const storeys = Math.max(1, Math.round(b.h / STOREY_H[sI]));
    const storey = b.h / storeys, bay = BAY_W[bI], ou = (hashIdx(i, 3) % 4) / 4;
    facadeBox(bb, cx, b.h / 2 + KERB_H, cz, w, b.h, d, b.color, bay, storey, ou);
    const rim = shade(b.color, 0.78);
    const tall = b.kind === 'office' || b.kind === 'mid' || b.kind === 'tower';
    if (tall) {
      const r = b.crown ? 0 : pickNo(i, 4, ROOF_TALL, prevR); prevR = r;
      const acX = ((hashIdx(i, 5) % 5) - 2) * w * 0.12, acZ = ((hashIdx(i, 6) % 5) - 2) * d * 0.12;
      if (r === 0 || r === 3) parapet(bb, cx, cz, w, d, top, r === 0 ? 0.8 : 1.6, 0.35, rim);
      if (r === 1 || r === 2) {
        // setback tiers: one or two smaller blocks carrying the same facade rhythm
        const tiers = r === 1 ? 1 : 2;
        let tw = w, td = d, y = top;
        for (let t = 0; t < tiers; t++) {
          tw *= 0.62 + (hashIdx(i, 10 + t) % 4) * 0.06; td *= 0.62 + (hashIdx(i, 20 + t) % 4) * 0.06;
          const n = 1 + (hashIdx(i, 30 + t) % 3), th = n * storey;
          facadeBox(bb, cx, y + th / 2, cz, tw, th, td, shade(b.color, 0.94 - t * 0.06), bay, storey, ou);
          y += th;
        }
        bb.box(cx + acX * 0.4, y + 0.6, cz + acZ * 0.4, Math.min(3, tw * 0.4), 1.2, Math.min(2.4, td * 0.4), 0x9a9a9a);
      } else if (r === 4) {
        // plant-room box off-centre plus a cornice band
        bb.box(cx, top + 0.25, cz, w + 0.6, 0.5, d + 0.6, rim);
        bb.box(cx + acX, top + 0.5 + storey * 0.5, cz + acZ, w * 0.35, storey, d * 0.3, shade(b.color, 0.7));
      } else {
        bb.box(cx + acX, top + 0.9, cz + acZ, 4, 1.8, 3, 0x9a9a9a);
      }
      if (b.kind === 'tower' && !b.crown) {
        const mh = 3 + (hashIdx(i, 7) % 4) * 2;
        bb.box(cx - acX - 3 * Math.sign(acX || 1), top + mh / 2, cz - acZ, 1, mh, 1, 0xdddddd);
      }
    } else if (b.kind === 'house') {
      const r = pickNo(i, 8, ROOF_HOUSE, prevR); prevR = r;
      const roofCol = hashIdx(i, 9) % 2 ? 0xfaf3e6 : shade(b.color, 0.85);
      if (r === 0) bb.box(cx, top + 0.5, cz, w + 0.8, 1, d + 0.8, roofCol);
      else if (r === 1) {
        // stepped hip: three shrinking slabs
        for (let k = 0; k < 3; k++) bb.box(cx, top + 0.3 + k * 0.6, cz, w + 0.8 - k * w * 0.28, 0.6, d + 0.8 - k * d * 0.28, shade(roofCol, 1 - k * 0.06));
      } else {
        parapet(bb, cx, cz, w, d, top, 0.7, 0.3, rim);
        bb.box(cx + w * 0.2, top + 0.6, cz - d * 0.2, Math.min(2.5, w * 0.3), 1.2, Math.min(2.5, d * 0.3), roofCol);
      }
    } else if (b.kind === 'warehouse') {
      const r = pickNo(i, 11, ROOF_SHED, prevR); prevR = r;
      if (r === 0) parapet(bb, cx, cz, w, d, top, 1.0, 0.4, rim);
      else {
        // sawtooth / ridge vents along the long axis, count varied by index
        const n = 3 + (hashIdx(i, 12) % 4), alongX = w >= d, span = alongX ? w : d;
        for (let k = 0; k < n; k++) {
          const o = -span / 2 + (k + 0.5) * span / n;
          if (alongX) bb.box(cx + o, top + 0.7, cz, span / n * 0.55, 1.4, d * 0.9, r === 1 ? rim : 0xa8b0b4, { rx: 0.35 });
          else bb.box(cx, top + 0.7, cz + o, w * 0.9, 1.4, span / n * 0.55, r === 1 ? rim : 0xa8b0b4, { rz: 0.35 });
        }
      }
    }
    if (b.crown) {
      bb.box(cx, top + 5, cz, w * 0.7, 10, d * 0.7, 0x2e4a63, { tile: 16 });
      bb.box(cx, top + 24, cz, 1.2, 28, 1.2, 0xff4a6a);
    }
  });
  const bmat = new THREE.MeshLambertMaterial({ vertexColors: true, map: win.map, emissiveMap: win.emissive, emissive: 0xffffff });
  bmat.emissiveIntensity = 0;
  const buildings = new THREE.Mesh(bb.build(), bmat); buildings.castShadow = true; buildings.receiveShadow = true; group.add(buildings);
  cityView.buildingMat = bmat;

  // ---- signs
  const atlas = makeSignAtlas();
  const gb = new MeshBuilder();
  for (const s of city.signs) { const uv = signUv(s.idx); gb.signQuad(s.x, s.y + KERB_H, s.z, s.nx, s.nz, s.w, s.h, 0xffffff, uv[0], uv[1], uv[2], uv[3]); }
  const signMat = new THREE.MeshBasicMaterial({ map: atlas, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(gb.build(), signMat));
  cityView.signMat = signMat;

  // ---- palms and lamps
  const pb = new MeshBuilder();
  for (const p of city.palms) addPalm(pb, { x: p.x, z: p.z, s: p.s });
  const palms = new THREE.Mesh(pb.build(), new THREE.MeshLambertMaterial({ vertexColors: true })); palms.castShadow = true; group.add(palms);
  const lb = new MeshBuilder();
  const hb = new MeshBuilder();
  for (const l of city.lamps) {
    lb.box(l.x, KERB_H + 3, l.z, 0.18, 6, 0.18, 0x3a3f46);
    lb.box(l.x + 0.5, KERB_H + 6, l.z, 1.1, 0.12, 0.12, 0x3a3f46);
    hb.box(l.x + 1, KERB_H + 5.9, l.z, 0.7, 0.18, 0.35, 0xffffff);
  }
  group.add(new THREE.Mesh(lb.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
  group.add(new THREE.Mesh(hb.build(), lampMat));
  cityView.lampMat = lampMat;

  // ---- traffic signals: poles at the four corners of every intersection, heads coloured per axis
  const tb = new MeshBuilder(), hx = new MeshBuilder(), hz = new MeshBuilder();
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = i * C + sx * (R + 0.6), z = j * C + sz * (R + 0.6);
    tb.box(x, 2.6, z, 0.16, 5.2, 0.16, 0x30343a);
    (sx * sz > 0 ? hx : hz).box(x, 5.3, z, 0.5, 1.3, 0.5, 0xffffff);
  }
  group.add(new THREE.Mesh(tb.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
  cityView.lightX = new THREE.MeshBasicMaterial({ color: 0x33ff66 }); cityView.lightZ = new THREE.MeshBasicMaterial({ color: 0xff3344 });
  group.add(new THREE.Mesh(hx.build(), cityView.lightX), new THREE.Mesh(hz.build(), cityView.lightZ));

  // ---- pier, beach props, distant hills
  const pr = new MeshBuilder();
  pr.box(400, 0.15, WORLD + 52, 9, 0.5, 80, 0x9c7a55);
  for (let k = 0; k < 8; k++) { pr.box(396, -1, WORLD + 20 + k * 9, 0.5, 3, 0.5, 0x5b4630); pr.box(404, -1, WORLD + 20 + k * 9, 0.5, 3, 0.5, 0x5b4630); }
  for (let k = 0; k < 6; k++) pr.box(396, 1.2, WORLD + 24 + k * 12, 0.2, 1.4, 0.2, 0xf5f5f5);
  const hillMat = new THREE.MeshLambertMaterial({ color: 0x5f8a6f, vertexColors: false });
  const hills = new THREE.Mesh(pr.build(), new THREE.MeshLambertMaterial({ vertexColors: true })); hills.receiveShadow = true; group.add(hills);
  for (let k = 0; k < 14; k++) {
    const h = 60 + ((k * 37) % 70), w = 160 + ((k * 53) % 120);
    const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5), hillMat);
    const a = -0.9 + k * 0.4;
    m.position.set(WORLD / 2 + Math.cos(a) * 900 * (k % 2 ? 1 : 1.1) - 100, h / 2 - 4, -330 + Math.sin(a * 2.2) * 120 - (k % 3) * 80);
    if (a > 1.8) m.position.set(WORLD + 450 + (k % 3) * 70, h / 2 - 4, 200 + (k - 8) * 160);
    group.add(m);
  }
  void districtOf;
  return group;
}

// Traffic signal phase shared by drawing and by the traffic AI: returns 0 x-axis green, 1 x yellow, 2 z green, 3 z yellow.
export function signalPhase(t) {
  const p = t % 24;
  return p < 10 ? 0 : p < 12 ? 1 : p < 22 ? 2 : 3;
}
export function updateSignalColours(t) {
  const ph = signalPhase(t);
  cityView.lightX.color.setHex(ph === 0 ? 0x33ff66 : ph === 1 ? 0xffcc33 : 0xff3344);
  cityView.lightZ.color.setHex(ph === 2 ? 0x33ff66 : ph === 3 ? 0xffcc33 : 0xff3344);
}
