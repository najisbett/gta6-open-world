// markerView.js - draws the glowing 3D beams and rings for the markers in markers.js (mission goals, shops, pickups).
import * as THREE from 'three';
import { markers, MAXM } from './markers.js';
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
}

export function syncMarkerViews(time) {
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
