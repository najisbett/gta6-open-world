// effects.js - particles (additive sparks/fire and alpha smoke), tyre marks, screen shake and rain, all pooled.
import * as THREE from 'three';
import { makeParticleSprite } from './proceduralTextures.js';
import { rand } from './rng.js';
import { G } from './state.js';

const MAXP = 700;
function makeSystem(additive) {
  const pos = new Float32Array(MAXP * 3), col = new Float32Array(MAXP * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const mat = new THREE.PointsMaterial({ size: 1, sizeAttenuation: true, map: makeParticleSprite(), vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return { pos, col, geo, mat, pts, vx: new Float32Array(MAXP), vy: new Float32Array(MAXP), vz: new Float32Array(MAXP), life: new Float32Array(MAXP), max: new Float32Array(MAXP), grow: new Float32Array(MAXP), r: new Float32Array(MAXP), g: new Float32Array(MAXP), b: new Float32Array(MAXP), grav: new Float32Array(MAXP), next: 0, size: new Float32Array(MAXP) };
}
const addSys = makeSystem(true), smokeSys = makeSystem(false);
addSys.mat.size = 0.5; smokeSys.mat.size = 1.6;

function emit(S, x, y, z, vx, vy, vz, life, r, g, b, grav) {
  const i = S.next; S.next = (S.next + 1) % MAXP;
  S.pos[i * 3] = x; S.pos[i * 3 + 1] = y; S.pos[i * 3 + 2] = z;
  S.vx[i] = vx; S.vy[i] = vy; S.vz[i] = vz; S.life[i] = life; S.max[i] = life; S.r[i] = r; S.g[i] = g; S.b[i] = b; S.grav[i] = grav;
}
function stepSys(S, dt, smoke) {
  for (let i = 0; i < MAXP; i++) {
    if (S.life[i] <= 0) { S.col[i * 4 + 3] = 0; S.col[i * 4] = S.col[i * 4 + 1] = S.col[i * 4 + 2] = 0; S.pos[i * 3 + 1] = -50; continue; }
    S.life[i] -= dt;
    S.vy[i] -= S.grav[i] * dt;
    S.pos[i * 3] += S.vx[i] * dt; S.pos[i * 3 + 1] += S.vy[i] * dt; S.pos[i * 3 + 2] += S.vz[i] * dt;
    const f = Math.max(0, S.life[i] / S.max[i]);
    if (smoke) { S.col[i * 4] = S.r[i]; S.col[i * 4 + 1] = S.g[i]; S.col[i * 4 + 2] = S.b[i]; S.col[i * 4 + 3] = f * 0.55; }
    else { S.col[i * 4] = S.r[i] * f; S.col[i * 4 + 1] = S.g[i] * f; S.col[i * 4 + 2] = S.b[i] * f; S.col[i * 4 + 3] = 1; }
  }
  S.geo.attributes.position.needsUpdate = true; S.geo.attributes.color.needsUpdate = true;
}

export const fx = {
  spark(x, y, z, n) { for (let k = 0; k < n; k++) emit(addSys, x, y, z, (rand() - 0.5) * 6, rand() * 4, (rand() - 0.5) * 6, 0.25 + rand() * 0.3, 1, 0.8, 0.4, 14); },
  blood(x, y, z, n) { for (let k = 0; k < n; k++) emit(smokeSys, x, y, z, (rand() - 0.5) * 3, rand() * 2.5, (rand() - 0.5) * 3, 0.45, 0.7, 0.05, 0.05, 9); },
  flash(x, y, z) { emit(addSys, x, y, z, 0, 0, 0, 0.06, 1, 0.85, 0.5, 0); emit(addSys, x, y, z, 0, 0, 0, 0.05, 1, 0.9, 0.6, 0); },
  smoke(x, y, z, sz, dark) { const c = dark ? 0.12 : 0.82; emit(smokeSys, x, y, z, (rand() - 0.5) * 1.2, 0.8 + rand(), (rand() - 0.5) * 1.2, 0.9 + rand() * 0.6, c, c, c, -0.5); void sz; },
  fire(x, y, z) { emit(addSys, x + (rand() - 0.5) * 1.2, y, z + (rand() - 0.5) * 1.2, (rand() - 0.5), 2 + rand() * 2, (rand() - 0.5), 0.5 + rand() * 0.3, 1, 0.45, 0.1, -2); },
  explosion(x, y, z) {
    for (let k = 0; k < 70; k++) emit(addSys, x, y, z, (rand() - 0.5) * 16, rand() * 12, (rand() - 0.5) * 16, 0.5 + rand() * 0.6, 1, 0.5 + rand() * 0.3, 0.15, 6);
    for (let k = 0; k < 40; k++) emit(smokeSys, x, y, z, (rand() - 0.5) * 8, 2 + rand() * 6, (rand() - 0.5) * 8, 1.6 + rand(), 0.1, 0.1, 0.1, -1);
    G.cam.shake = Math.max(G.cam.shake, 0.9);
  },
  tracer(x0, y0, z0, x1, y1, z1) {
    const n = 14;
    for (let k = 0; k < n; k++) { const t = k / n; emit(addSys, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t, 0, 0, 0, 0.07, 1, 0.95, 0.6, 0); }
  },
  dust(x, y, z) { emit(smokeSys, x, y, z, (rand() - 0.5), 0.6, (rand() - 0.5), 0.7, 0.8, 0.72, 0.55, -0.3); },
  coin(x, y, z) { for (let k = 0; k < 10; k++) emit(addSys, x, y, z, (rand() - 0.5) * 3, 2 + rand() * 3, (rand() - 0.5) * 3, 0.6, 1, 0.85, 0.2, 9); },
};

// ---- tyre marks: a ring of quads
const MAXMARK = 900;
const markPos = new Float32Array(MAXMARK * 4 * 3), markCol = new Float32Array(MAXMARK * 4 * 4);
const markGeo = new THREE.BufferGeometry();
markGeo.setAttribute('position', new THREE.BufferAttribute(markPos, 3));
markGeo.setAttribute('color', new THREE.BufferAttribute(markCol, 4));
const idx = new Uint16Array(MAXMARK * 6);
for (let i = 0; i < MAXMARK; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
markGeo.setIndex(new THREE.BufferAttribute(idx, 1));
const markMesh = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
markMesh.frustumCulled = false;
let markNext = 0;
export function addTyreMark(x0, z0, x1, z1, alpha) {
  const dx = x1 - x0, dz = z1 - z0, l = Math.sqrt(dx * dx + dz * dz) || 1;
  const nx = -dz / l * 0.13, nz = dx / l * 0.13;
  const i = markNext; markNext = (markNext + 1) % MAXMARK;
  const p = i * 12, y = 0.045;
  markPos.set([x0 - nx, y, z0 - nz, x0 + nx, y, z0 + nz, x1 + nx, y, z1 + nz, x1 - nx, y, z1 - nz], p);
  for (let k = 0; k < 4; k++) { markCol[i * 16 + k * 4] = 0.04; markCol[i * 16 + k * 4 + 1] = 0.04; markCol[i * 16 + k * 4 + 2] = 0.05; markCol[i * 16 + k * 4 + 3] = alpha; }
  markGeo.attributes.position.needsUpdate = true; markGeo.attributes.color.needsUpdate = true;
}

// ---- rain: streaks that follow the camera
const RAIN = 1800;
const rainPos = new Float32Array(RAIN * 6);
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainLines = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xd6e6f5, transparent: true, opacity: 0.45 }));
rainLines.frustumCulled = false; rainLines.visible = false;
const rainSeed = new Float32Array(RAIN * 3);
for (let i = 0; i < RAIN; i++) { rainSeed[i * 3] = rand() * 60 - 30; rainSeed[i * 3 + 1] = rand() * 30; rainSeed[i * 3 + 2] = rand() * 60 - 30; }

export function addEffectsToScene(scene) {
  scene.add(addSys.pts, smokeSys.pts, markMesh, rainLines);
}

export function stepEffects(dt) {
  stepSys(addSys, dt, false);
  stepSys(smokeSys, dt, true);
  G.cam.shake = Math.max(0, G.cam.shake - dt * 1.6);
}

export function updateRain(camera, dt) {
  const on = G.rain > 0.05;
  rainLines.visible = on;
  if (!on) return;
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  for (let i = 0; i < RAIN; i++) {
    rainSeed[i * 3 + 1] -= 38 * dt;
    if (rainSeed[i * 3 + 1] < -8) rainSeed[i * 3 + 1] += 30;
    const x = cx + rainSeed[i * 3], y = cy + rainSeed[i * 3 + 1], z = cz + rainSeed[i * 3 + 2];
    rainPos[i * 6] = x; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 2] = z;
    rainPos[i * 6 + 3] = x - 0.18; rainPos[i * 6 + 4] = y + 1.6; rainPos[i * 6 + 5] = z;
  }
  rainGeo.attributes.position.needsUpdate = true;
  rainLines.material.opacity = 0.3 + G.rain * 0.5;
}
