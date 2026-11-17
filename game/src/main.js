// main.js - boots the renderer and the world, then runs the frame loop: fixed-step simulation, then camera, view
// sync, HUD and draw. Reads ?shot= for deterministic screenshot scenes.
import * as THREE from 'three';
import { G } from './state.js';
import { STEP } from './config.js';
import { buildCityLayout } from './cityLayout.js';
import { buildCityMeshes } from './cityRender.js';
import { createSky, updateSky } from './skyLighting.js';
import { buildModels } from './vehicleModels.js';
import { createVehicleViews, syncVehicleViews } from './vehicleViews.js';
import { createHumanoidViews, syncHumanViews } from './humanoidView.js';
import { createMarkerViews, syncMarkerViews } from './markerView.js';
import { addEffectsToScene, updateRain } from './effects.js';
import { initInput } from './input.js';
import { initHud, updateHud, setHudVisible } from './hud.js';
import { updateCamera } from './cameraRig.js';
import { simStep, focus } from './sim.js';
import { setupShot } from './shots.js';
import { streamTraffic } from './traffic.js';
import { streamPeds } from './pedestrians.js';
import { seed } from './rng.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, 1, 0.25, 2200);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

function boot() {
  seed(Date.now() & 0xffffff);
  buildCityLayout();
  buildModels();
  buildCityMeshes(scene);
  createSky(scene, renderer);
  createVehicleViews(scene);
  createHumanoidViews(scene);
  createMarkerViews(scene);
  addEffectsToScene(scene);
  initInput(canvas);
  initHud();
  resize();
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    seed(4242);
    setupShot(shot, camera);
    renderFrame(STEP);
    window.__shotReady = true;
    return;
  }
  streamTraffic(384, 330, true); streamPeds(384, 330, true);
  G.mode = 'play';
  startLoop();
}

function renderFrame(dt) {
  updateCamera(camera, dt);
  updateSky(camera, G.hour, camera.position.x, camera.position.z, G.rain);
  updateRain(camera, dt);
  syncVehicleViews(G.t);
  syncHumanViews();
  syncMarkerViews(G.t);
  updateHud();
  renderer.render(scene, camera);
}

let acc = 0, lastT = 0;
function startLoop() {
  lastT = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) { simStep(STEP); acc -= STEP; n++; }
    if (n === 5) acc = 0;
    renderFrame(dt);
  };
  requestAnimationFrame(frame);
}

window.__game = { G, simStep, renderFrame, focus, setHudVisible };
try { boot(); } catch (e) { document.title = 'ERR ' + e.message; console.error(e); window.__bootError = String(e.stack || e); }
