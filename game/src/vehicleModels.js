// vehicleModels.js - builds the merged geometry of every car type: a paintable body and a fixed-colour detail mesh
// (wheels, glass, lamps, light bar). Each car is two draw calls.
import * as THREE from 'three';
import { MeshBuilder } from './meshBuilder.js';
import { VTYPES, PAINTS } from './vehicleTypes.js';

const WHITE = 0xffffff;
export const models = {};
export const paintMats = [];
export const detailMat = new THREE.MeshLambertMaterial({ vertexColors: true });
export const wreckMat = new THREE.MeshLambertMaterial({ color: 0x1d1d1f });
export const lightBarMats = { red: new THREE.MeshBasicMaterial({ color: 0xff2030 }), blue: new THREE.MeshBasicMaterial({ color: 0x2060ff }) };

function wheels(d, t) {
  const x = t.wid / 2 - 0.1, zf = t.len * 0.32, r = 0.36;
  for (const sx of [-1, 1]) for (const z of [zf, -zf]) d.box(sx * x, r, z, 0.3, r * 2, r * 2, 0x17181b);
}

function buildSedan(t, kind) {
  const body = new MeshBuilder(), det = new MeshBuilder();
  const L = t.len, W = t.wid;
  body.box(0, 0.62, 0, W, 0.62, L, WHITE);
  body.box(0, 1.08, -0.15, W - 0.2, 0.4, L * 0.55, WHITE, { });
  if (kind === 'vesper') { body.box(0, 1.0, -0.2, W - 0.1, 0.34, L * 0.42, WHITE); body.box(0, 0.98, -L * 0.45, W, 0.1, 0.5, WHITE); }
  det.box(0, 1.06, -0.15, W - 0.1, 0.3, L * 0.5, 0x1d2a38);
  det.box(0, 0.5, L / 2 - 0.02, W - 0.3, 0.2, 0.06, 0xfff6c8);
  det.box(0, 0.5, -L / 2 + 0.02, W - 0.3, 0.2, 0.06, 0xd8283a);
  det.box(0, 0.38, L / 2 - 0.1, W - 0.2, 0.12, 0.1, 0x2a2a2e);
  wheels(det, t);
  return [body, det];
}

function buildSuv(t) {
  const body = new MeshBuilder(), det = new MeshBuilder();
  body.box(0, 0.82, 0, t.wid, 0.8, t.len, WHITE);
  body.box(0, 1.46, -0.25, t.wid - 0.15, 0.6, t.len * 0.72, WHITE);
  det.box(0, 1.5, -0.25, t.wid - 0.05, 0.46, t.len * 0.66, 0x1d2a38);
  det.box(0, 0.8, t.len / 2 - 0.02, t.wid - 0.3, 0.22, 0.06, 0xfff6c8);
  det.box(0, 0.8, -t.len / 2 + 0.02, t.wid - 0.3, 0.22, 0.06, 0xd8283a);
  wheels(det, t);
  return [body, det];
}

function buildVan(t) {
  const body = new MeshBuilder(), det = new MeshBuilder();
  body.box(0, 1.25, -0.3, t.wid, 1.6, t.len * 0.8, WHITE);
  body.box(0, 0.8, t.len * 0.36, t.wid, 0.8, t.len * 0.28, WHITE);
  det.box(0, 1.45, t.len * 0.25, t.wid - 0.1, 0.6, 0.9, 0x1d2a38);
  det.box(0, 0.8, t.len / 2 - 0.02, t.wid - 0.3, 0.22, 0.06, 0xfff6c8);
  det.box(0, 0.9, -t.len * 0.7 / 2 - 0.3, t.wid - 0.3, 0.22, 0.06, 0xd8283a);
  wheels(det, t);
  return [body, det];
}

function buildBus(t) {
  const body = new MeshBuilder(), det = new MeshBuilder();
  const L = t.len, W = t.wid;
  body.box(0, 1.55, 0, W, 2.3, L, WHITE);
  body.box(0, 3.0, 0, W - 0.2, 0.12, L - 0.4, WHITE);
  det.box(0, 2.0, 0, W + 0.04, 0.85, L - 1.6, 0x1d2a38); // side window band
  det.box(0, 2.05, L / 2 - 0.02, W - 0.35, 1.05, 0.06, 0x1d2a38); // windscreen
  det.box(0, 0.55, 0, W + 0.02, 0.18, L - 0.3, 0x2b2d33); // skirt
  det.box(0, 3.1, 0, 1.4, 0.2, 2.2, 0x9aa3ad); // roof AC unit
  det.box(0, 2.75, L / 2 - 0.05, 1.5, 0.3, 0.08, 0xffb43a); // destination board
  det.box(0, 0.7, L / 2 - 0.02, W - 0.4, 0.22, 0.06, 0xfff6c8);
  det.box(0, 0.8, -L / 2 + 0.02, W - 0.4, 0.22, 0.06, 0xd8283a);
  for (const sx of [-1, 1]) det.box(sx * (W / 2 + 0.01), 1.3, L * 0.2, 0.04, 1.8, 1.1, 0x23303d); // doors
  wheels(det, t);
  det.box(0, 0.36, L * 0.32 - 3.0, W - 0.1, 0.1, 0.1, 0x17181b);
  return [body, det];
}

function buildPickup(t) {
  const body = new MeshBuilder(), det = new MeshBuilder();
  const L = t.len, W = t.wid;
  body.box(0, 0.75, 0, W, 0.7, L, WHITE); // lower chassis and bed sides
  body.box(0, 1.32, L * 0.12, W - 0.1, 0.5, L * 0.36, WHITE); // cab
  body.box(0, 1.1, -L * 0.2, W, 0.28, 0.12, WHITE); // tailgate lip
  det.box(0, 1.38, L * 0.12, W - 0.02, 0.34, L * 0.3, 0x1d2a38);
  det.box(0, 1.12, -L * 0.18, W - 0.5, 0.06, L * 0.4, 0x25272c); // bed floor
  det.box(0, 0.62, L / 2 - 0.02, W - 0.3, 0.22, 0.06, 0xfff6c8);
  det.box(0, 0.7, -L / 2 + 0.02, W - 0.3, 0.22, 0.06, 0xd8283a);
  det.box(0, 0.42, L / 2 - 0.1, W - 0.2, 0.14, 0.1, 0x2a2a2e);
  wheels(det, t);
  return [body, det];
}

function buildHatch(t) {
  const body = new MeshBuilder(), det = new MeshBuilder();
  const L = t.len, W = t.wid;
  body.box(0, 0.62, 0, W, 0.62, L, WHITE);
  body.box(0, 1.14, -0.2, W - 0.14, 0.5, L * 0.66, WHITE);
  det.box(0, 1.16, -0.2, W - 0.06, 0.34, L * 0.6, 0x1d2a38);
  det.box(0, 0.5, L / 2 - 0.02, W - 0.3, 0.2, 0.06, 0xfff6c8);
  det.box(0, 0.55, -L / 2 + 0.02, W - 0.3, 0.2, 0.06, 0xd8283a);
  wheels(det, t);
  return [body, det];
}

function buildCruiser(t) {
  const [body, det] = buildSedan(t, 'cruiser');
  const d2 = new MeshBuilder();
  d2.box(0, 1.35, -0.15, 0.6, 0.12, 1.1, 0x15171c);
  d2.box(0, 0.64, 0.0, t.wid + 0.02, 0.18, t.len * 0.8, 0x1b2a6b);
  det.pos.push(...d2.pos); det.nor.push(...d2.nor); det.col.push(...d2.col); det.uv.push(...d2.uv);
  const off = det.pos.length / 3 - d2.pos.length / 3;
  for (const i of d2.idx) det.idx.push(i + off);
  return [body, det];
}

export function buildModels() {
  for (const p of PAINTS) paintMats.push(new THREE.MeshLambertMaterial({ color: p, vertexColors: true }));
  paintMats.push(new THREE.MeshLambertMaterial({ color: 0xf2f4f7, vertexColors: true })); // police white (index PAINTS.length)
  paintMats.push(new THREE.MeshLambertMaterial({ color: 0xf2c52e, vertexColors: true })); // cab yellow
  paintMats.push(new THREE.MeshLambertMaterial({ color: 0x1f9fa8, vertexColors: true })); // city bus teal
  for (const key of Object.keys(VTYPES)) {
    const t = VTYPES[key];
    const [b, d] = key === 'dune' ? buildSuv(t) : key === 'hauler' ? buildVan(t) : key === 'kestrel' ? buildCruiser(t) : key === 'bus' ? buildBus(t) : key === 'pickup' ? buildPickup(t) : key === 'hatch' ? buildHatch(t) : buildSedan(t, key);
    models[key] = { body: b.build(), detail: d.build() };
  }
  models.lightGeo = new MeshBuilder();
  models.lightGeo.box(-0.45, 1.5, -0.15, 0.7, 0.16, 0.25, 0xffffff);
  models.lightGeoB = new MeshBuilder();
  models.lightGeoB.box(0.45, 1.5, -0.15, 0.7, 0.16, 0.25, 0xffffff);
  models.lightGeo = models.lightGeo.build();
  models.lightGeoB = models.lightGeoB.build();
}
export const POLICE_PAINT = PAINTS.length;
export const CAB_PAINT = PAINTS.length + 1;
export const BUS_PAINT = PAINTS.length + 2;
