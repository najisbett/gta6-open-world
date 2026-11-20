// vehicleViews.js - one pair of meshes per pooled vehicle: copies each simulated car's pose to its meshes every frame
// and swaps the paint, the wreck look and the flashing police light bar.
import * as THREE from 'three';
import { MAX_VEHICLES } from './config.js';
import { G } from './state.js';
import { models, paintMats, detailMat, wreckMat, lightBarMats, POLICE_PAINT, CAB_PAINT, BUS_PAINT } from './vehicleModels.js';

const views = [];
export function createVehicleViews(scene) {
  for (let i = 0; i < MAX_VEHICLES; i++) {
    const g = new THREE.Group();
    g.rotation.order = 'YXZ';
    const body = new THREE.Mesh(models.marlin.body, paintMats[0]);
    const det = new THREE.Mesh(models.marlin.detail, detailMat);
    body.castShadow = true;
    const red = new THREE.Mesh(models.lightGeo, lightBarMats.red);
    const blue = new THREE.Mesh(models.lightGeoB, lightBarMats.blue);
    red.position.y = 0.0; blue.position.y = 0.0;
    g.add(body, det, red, blue);
    g.visible = false;
    scene.add(g);
    views.push({ g, body, det, red, blue, type: '' });
  }
}

export function syncVehicleViews(time) {
  const flash = Math.floor(time * 6) % 2 === 0;
  for (let i = 0; i < MAX_VEHICLES; i++) {
    const v = G.vehicles[i], w = views[i];
    if (!v.active) { w.g.visible = false; continue; }
    w.g.visible = true;
    if (w.type !== v.type) { w.type = v.type; w.body.geometry = models[v.type].body; w.det.geometry = models[v.type].detail; }
    const paint = v.type === 'kestrel' ? POLICE_PAINT : v.type === 'taxi' ? CAB_PAINT : v.type === 'bus' ? BUS_PAINT : v.paint;
    w.body.material = v.wreck ? wreckMat : paintMats[paint];
    w.g.position.set(v.x, v.y + 0.04, v.z);
    w.g.rotation.set(v.pitch, v.h, v.roll);
    const cop = v.type === 'kestrel' && !v.wreck;
    w.red.visible = cop && flash; w.blue.visible = cop && !flash;
  }
}
