// markerView.js - draws the glowing 3D beams and rings for the markers in markers.js (mission goals, shops, pickups).
import * as THREE from 'three';
import { markers, MAXM, waypoint } from './markers.js';
import { G, player } from './state.js';
import { pickupColor } from './pickups.js';

const pool = [];
const gems = [];
export function createMarkerViews(scene) {
  const beamGeo = new THREE.CylinderGeometry(1.5, 1.5, 46, 20, 1, true);
  const ringGeo = new THREE.TorusGeometry(2.4, 0.18, 8, 36);
  for (let i = 0; i < 24; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(beamGeo, mat); beam.position.y = 23;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.4;
    const g = new THREE.Group(); g.add(beam, ring); g.visible = false; scene.add(g);
    pool.push({ g, beam, ring });
  }
  const gemGeo = new THREE.OctahedronGeometry(0.55, 0);
  for (let i = 0; i < 36; i++) {
    const m = new THREE.Mesh(gemGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.visible = false; scene.add(m); gems.push(m);
  }
  void MAXM;
  // waypoint beacon: a spinning diamond with a tapering stem, drawn on top of the world so it reads through buildings
  const mk = (geo, op) => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const g = new THREE.Group();
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mk(null, 0.95)); diamond.scale.set(0.9, 1.5, 0.9);
  const stem = new THREE.Mesh(new THREE.ConeGeometry(0.55, 5, 12, 1, true), mk(null, 0.55)); stem.rotation.x = Math.PI; stem.position.y = -3.6;
  g.add(diamond, stem); g.visible = false; g.renderOrder = 20; diamond.renderOrder = 21; stem.renderOrder = 20;
  scene.add(g);
  beacon.g = g; beacon.diamond = diamond; beacon.stem = stem;
}
const beacon = { g: null, diamond: null, stem: null, label: null, cam: null };

// per frame: float the beacon above the current objective (hidden when none); size grows with distance so it stays legible
function syncBeacon(time) {
  const b = beacon;
  if (!b.g) return;
  b.g.visible = waypoint.active;
  if (!b.label) { b.label = document.createElement('div'); b.label.id = 'wpLabel'; document.body.appendChild(b.label); }
  if (!waypoint.active) { b.label.style.display = 'none'; return; }
  const d = Math.hypot(waypoint.x - player.x, waypoint.z - player.z);
  const s = Math.min(6, Math.max(1, d / 28));
  b.g.position.set(waypoint.x, 15 + s * 1.5 + Math.sin(time * 2.4) * 0.8, waypoint.z);
  b.g.scale.setScalar(s);
  b.diamond.rotation.y = time * 1.8;
  b.diamond.material.color.setHex(waypoint.hex); b.stem.material.color.setHex(waypoint.hex);
  // distance label under the beacon (screen-projected); hidden when the objective is behind the camera
  b.cam = b.cam || (window.__game && window.__game.camera);
  if (!b.cam) { b.label.style.display = 'none'; return; }
  b.cam.updateMatrixWorld();
  _p.set(waypoint.x, b.g.position.y - 7 * s, waypoint.z).project(b.cam);
  const on = _p.z < 1 && Math.abs(_p.x) < 1.1 && Math.abs(_p.y) < 1.1;
  b.label.style.display = on ? 'block' : 'none';
  if (on) { b.label.style.left = ((_p.x + 1) / 2 * innerWidth) + 'px'; b.label.style.top = ((1 - _p.y) / 2 * innerHeight) + 'px'; b.label.textContent = Math.round(d) + ' m'; b.label.style.borderColor = '#' + waypoint.hex.toString(16).padStart(6, '0'); }
}
const _p = new THREE.Vector3();

export function syncMarkerViews(time) {
  syncBeacon(time);
  let used = 0;
  for (let i = 0; i < markers.n && used < pool.length; i++) {
    if (!markers.beam[i]) continue;
    const m = pool[used++];
    m.g.visible = true;
    m.g.position.set(markers.x[i], 0, markers.z[i]);
    m.beam.material.color.setHex(markers.hex[i]); m.ring.material.color.setHex(markers.hex[i]);
    m.ring.scale.setScalar(1 + Math.sin(time * 4 + i) * 0.08);
  }
  for (let i = used; i < pool.length; i++) pool[i].g.visible = false;
  // collectibles: spinning gems near the player
  let g = 0;
  for (let i = 0; i < G.pickups.length && g < gems.length; i++) {
    const p = G.pickups[i];
    if (!p.active) continue;
    const dx = p.x - player.x, dz = p.z - player.z;
    if (dx * dx + dz * dz > 110 * 110) continue;
    const m = gems[g++];
    m.visible = true; m.position.set(p.x, 1.1 + Math.sin(time * 3 + i) * 0.18, p.z); m.rotation.y = time * 2 + i;
    m.scale.setScalar(p.kind === 0 ? 0.7 : 1);
    m.material.color.setHex(pickupColor(p.kind));
  }
  for (let i = g; i < gems.length; i++) gems[i].visible = false;
}
