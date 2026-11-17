// markerView.js - draws the glowing 3D beams and rings for the markers in markers.js (mission goals, shops, pickups).
import * as THREE from 'three';
import { markers, MAXM } from './markers.js';

const pool = [];
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
}
