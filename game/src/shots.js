// shots.js - deterministic scenes for ?shot=cover|chase|hud|mission: a fixed seed, a fixed hour, scripted controls
// and a fixed number of simulation steps, so every capture of a shot is the same frame.
import { G, player, AI_NONE } from './state.js';
import { STEP } from './config.js';
import { spawnVehicle, removeVehicle } from './vehicles.js';
import { setWanted } from './wanted.js';
import { AI_POLICE } from './state.js';
import { placePlayer, enterVehicle } from './player.js';
import { streamTraffic } from './traffic.js';
import { streamPeds } from './pedestrians.js';
import { runSteps } from './sim.js';
import { updateCamera } from './cameraRig.js';
import { city } from './cityLayout.js';

// remove civilian cars from a rectangle so a scripted run is not blocked by random traffic
function clearRect(x0, z0, x1, z1) {
  for (const v of G.vehicles) if (v.active && v.driver !== 1 && v.ai !== AI_POLICE && v.x > x0 && v.x < x1 && v.z > z0 && v.z < z1) removeVehicle(v);
}

function settleCamera(camera, n) {
  for (let i = 0; i < n; i++) updateCamera(camera, STEP);
}

const SCENES = {
  cover(camera) {
    G.hour = 16.4;
    const v = spawnVehicle('vesper', 330, 323.8, Math.PI / 2, AI_NONE, 0);
    placePlayer(330, 323.8, Math.PI / 2);
    v.vx = 18; enterVehicle(v.id);
    G.player.veh = v.id;
    G.cam.yaw = Math.PI / 2;
    streamTraffic(330, 323, true); streamPeds(330, 323, true);
    clearRect(325, 312, 420, 328);
    G.shot.controls = (K) => { K.fwd = 0.7; K.right = 0; };
    runSteps(150);
    settleCamera(camera, 90);
  },
  hud(camera) {
    G.hour = 15.2;
    const p = city.places.guns;
    placePlayer(p.x - 10, p.z - 1, Math.PI / 2);
    G.cam.yaw = Math.PI / 2 + 0.5; G.cam.pitch = 0.2;
    streamTraffic(p.x, p.z, true); streamPeds(p.x, p.z, true);
    G.shot.controls = (K) => { K.fwd = 0; K.right = 0; };
    runSteps(120);
    settleCamera(camera, 90);
  },
};

SCENES.chase = (camera) => {
  G.hour = 17.6;
  const lane = 7 * 64 - 3.8;
  const v = spawnVehicle('vesper', lane, 200, 0, AI_NONE, 2);
  placePlayer(lane, 200, 0);
  v.vz = 21; enterVehicle(v.id);
  G.cam.yaw = 0;
  streamTraffic(lane, 200, true); streamPeds(lane, 200, true);
  clearRect(lane - 7, 120, lane + 7, 330);
  const offs = [[0.0, 11], [-2.2, 19], [2.0, 27]];
  G.shot.copSpeed = 24.5;
  for (const o of offs) {
    const c = spawnVehicle('kestrel', lane + o[0], 200 - o[1], 0, AI_POLICE, 0);
    c.driver = 2; c.vz = 24; c.keep = true;
  }
  setWanted(3);
  G.wanted.seen = true;
  G.shot.controls = (K) => { const pv = G.vehicles[G.player.veh]; K.fwd = pv.speed < 24 ? 1 : 0.2; K.right = 0; K.handbrake = false; };
  // a low front-quarter camera so the player's car and the pursuit behind it share the frame
  G.shot.cam = (cam, c) => {
    const pv = G.vehicles[G.player.veh];
    const fx = Math.sin(pv.h), fz = Math.cos(pv.h);
    cam.position.set(pv.x + fx * 7 + fz * 3.4, pv.y + 2.0, pv.z + fz * 7 - fx * 3.4);
    cam.lookAt(pv.x - fx * 14, pv.y + 0.9, pv.z - fz * 14);
    c.x = cam.position.x; c.y = cam.position.y; c.z = cam.position.z;
    if (cam.fov !== 60) { cam.fov = 60; cam.updateProjectionMatrix(); }
  };
  runSteps(150);
  settleCamera(camera, 2);
};

SCENES.dusk = (camera) => {
  SCENES.cover(camera);
  G.hour = 19.3;
};

export function setupShot(name, camera) {
  G.shot = { name, controls: null };
  G.mode = 'play';
  G.player.money = 4280;
  (SCENES[name] || SCENES.cover)(camera);
  void player;
}
