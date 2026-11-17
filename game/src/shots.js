// shots.js - deterministic scenes for ?shot=cover|chase|hud|mission: a fixed seed, a fixed hour, scripted controls
// and a fixed number of simulation steps, so every capture of a shot is the same frame.
import { G, player, AI_NONE } from './state.js';
import { STEP } from './config.js';
import { spawnVehicle } from './vehicles.js';
import { placePlayer, enterVehicle } from './player.js';
import { streamTraffic } from './traffic.js';
import { streamPeds } from './pedestrians.js';
import { runSteps } from './sim.js';
import { updateCamera } from './cameraRig.js';
import { city } from './cityLayout.js';

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
