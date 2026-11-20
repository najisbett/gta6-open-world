// shots.js - deterministic scenes for ?shot=cover|chase|hud|mission: a fixed seed, a fixed hour, scripted controls
// and a fixed number of simulation steps, so every capture of a shot is the same frame. Nothing needs a key press.
import { G, AI_NONE, AI_POLICE, AI_TRAFFIC } from './state.js';
import { STEP } from './config.js';
import { spawnVehicle, removeVehicle } from './vehicles.js';
import { setWanted } from './wanted.js';
import { placePlayer, enterVehicle } from './player.js';
import { streamTraffic, placeTraffic } from './traffic.js';
import { streamPeds, crowdAround } from './pedestrians.js';
import { runSteps } from './sim.js';
import { updateCamera } from './cameraRig.js';
import { city } from './cityLayout.js';
import { startNewGame } from './gameFlow.js';
import { startMission } from './missions.js';
import { applyShotWeather } from './weather.js';

// put a civilian car on a road lane at a fixed spot, already moving, so the frame always has neighbours
function trafficCar(type, x, z, dir, speed, paint) {
  const v = spawnVehicle(type, x, z, dir === 0 ? Math.PI / 2 : -Math.PI / 2, AI_TRAFFIC, paint);
  v.dir = dir; v.ni = dir === 0 ? Math.ceil(x / 64) : Math.floor(x / 64); v.nj = Math.round(z / 64);
  v.vx = dir === 0 ? speed : -speed; v.cruise = speed;
}

// remove civilian cars from a rectangle so a scripted run is not blocked by random traffic
function clearRect(x0, z0, x1, z1) {
  for (const v of G.vehicles) if (v.active && v.driver !== 1 && v.ai !== AI_POLICE && v.x > x0 && v.x < x1 && v.z > z0 && v.z < z1) removeVehicle(v);
}

function settleCamera(camera, n) {
  for (let i = 0; i < n; i++) updateCamera(camera, STEP);
}

const SCENES = {
  // player in a stolen Vesper GT on a boulevard: oncoming traffic, a crowd on both sidewalks, one wanted star
  cover(camera) {
    const v = spawnVehicle('vesper', 330, 323.8, Math.PI / 2, AI_NONE, 0);
    placePlayer(330, 323.8, Math.PI / 2);
    v.vx = 18; enterVehicle(v.id);
    G.cam.yaw = Math.PI / 2;
    streamTraffic(330, 323, true); streamPeds(330, 323, true);
    clearRect(318, 312, 440, 328);
    for (let i = 0; i < 7; i++) placeTraffic(380, 323, 20, 90, true);
    clearRect(318, 312, 440, 328);
    crowdAround(380, 323, 18, 5, 60);
    trafficCar('taxi', 428, 316.2, 2, 11, 0);
    trafficCar('dune', 470, 316.2, 2, 12, 5);
    trafficCar('hauler', 402, 323.8, 0, 9, 3);
    trafficCar('bus', 452, 323.8, 0, 8, 0);
    trafficCar('pickup', 392, 316.2, 2, 12, 1);
    trafficCar('hatch', 505, 316.2, 2, 11, 7);
    setWanted(1);
    G.shot.controls = (K) => { K.fwd = 0.7; K.right = 0; };
    runSteps(150);
    settleCamera(camera, 90);
  },

  // a three-star pursuit seen from a low front-quarter camera so the player's car and the cruisers share the frame
  chase(camera) {
    const lane = 7 * 64 - 3.8;
    const v = spawnVehicle('vesper', lane, 200, 0, AI_NONE, 2);
    placePlayer(lane, 200, 0);
    v.vz = 21; enterVehicle(v.id);
    G.cam.yaw = 0;
    streamTraffic(lane, 200, true); streamPeds(lane, 200, true);
    clearRect(lane - 7, 120, lane + 7, 330);
    G.shot.copSpeed = 24.5;
    for (const o of [[0.0, 11], [-2.2, 19], [2.0, 27]]) {
      const c = spawnVehicle('kestrel', lane + o[0], 200 - o[1], 0, AI_POLICE, 0);
      c.driver = 2; c.vz = 24; c.keep = true;
    }
    setWanted(3);
    G.wanted.seen = true;
    G.shot.controls = (K) => { const pv = G.vehicles[G.player.veh]; K.fwd = pv.speed < 24 ? 1 : 0.2; K.right = 0; K.handbrake = false; };
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
  },

  // on foot in the street beside the gun shop: aiming, full HUD, bars, weapon, one star, a busy road and sidewalk
  hud(camera) {
    const p = city.places.guns;
    placePlayer(p.x - 6, p.z + 5.4, Math.PI / 2);
    G.cam.yaw = Math.PI / 2 + 0.22; G.cam.pitch = 0.17;
    G.player.hp = 76; G.player.armor = 45; G.player.weapon = 2; G.weapons[2].owned = true; G.weapons[2].ammo = 74;
    setWanted(1);
    streamTraffic(p.x, p.z, true); streamPeds(p.x, p.z, true);
    clearRect(p.x - 40, p.z + 2, p.x + 80, p.z + 9);
    for (let i = 0; i < 5; i++) placeTraffic(p.x + 30, p.z + 8, 15, 80, true);
    crowdAround(p.x, p.z, 22, 4, 50);
    G.shot.controls = (K) => { K.fwd = 0; K.right = 0; K.aim = true; };
    runSteps(120);
    settleCamera(camera, 90);
  },

  // Dessa at the diner with the first mission's dialogue open and the gold marker beam ahead of the player
  mission(camera) {
    const d = city.places.diner;
    startNewGame();
    applyShotWeather('mission'); // startNewGame resets the clock
    G.shot.controls = (K) => { K.fwd = 0; K.right = 0; };
    G.player.money = 4280;
    placePlayer(d.x - 3, d.z - 7.5, 0.1);
    G.cam.yaw = 0.1; G.cam.pitch = 0.24;
    crowdAround(d.x, d.z, 18, 5, 55);
    runSteps(40);
    startMission(0);
    runSteps(10);
    G.shot.cam = (cam, c) => {
      cam.position.set(d.x - 8.5, 5.2, d.z - 17);
      cam.lookAt(d.x - 0.5, 2.6, d.z - 1.5);
      c.x = cam.position.x; c.y = cam.position.y; c.z = cam.position.z;
      if (cam.fov !== 62) { cam.fov = 62; cam.updateProjectionMatrix(); }
    };
    settleCamera(camera, 2);
  },
};

export function setupShot(name, camera) {
  G.shot = { name, controls: null };
  G.mode = 'play';
  G.player.money = 4280;
  applyShotWeather(SCENES[name] ? name : 'cover'); // forces this shot's hour and rain (see weather.js)
  (SCENES[name] || SCENES.cover)(camera);
}
