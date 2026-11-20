// sim.js - one fixed simulation step (1/60 s): samples controls, runs every system in a fixed order, keeps the
// traffic and crowd streamed around the player, and advances the clock and weather. No rendering happens here.
import { G, player } from './state.js';
import { STEP } from './config.js';
import { sampleControls, K } from './input.js';
import { stepPlayer } from './player.js';
import { stepVehicles } from './vehicles.js';
import { stepTraffic, streamTraffic } from './traffic.js';
import { stepPedestrians, streamPeds } from './pedestrians.js';
import { stepEffects } from './effects.js';
import { stepCombat } from './combat.js';
import { stepPolice } from './police.js';
import { stepGunmen } from './gunmen.js';
import { stepWanted } from './wanted.js';
import { stepMissions } from './missions.js';
import { stepActivities } from './activities.js';
import { stepPickups } from './pickups.js';
import { stepShops } from './shops.js';
import { dialogBusy } from './dialogue.js';
import { respawnPlayer } from './player.js';
import { updateSignalColours } from './cityRender.js';
import { stepWeather } from './weather.js';

let streamClock = 0;
export const focus = { x: 384, z: 330 };

export function simStep(dt) {
  if (G.mode === 'pause' || G.mode === 'shop') return;
  G.t += dt;
  if (G.mode === 'play' || G.mode === 'dead') {
    G.stats.playTime += dt;
    focus.x = player.x; focus.z = player.z;
  } else { focus.x = 384; focus.z = 330; }
  if (G.mode === 'play') {
    sampleControls();
    if (G.shot && G.shot.controls) G.shot.controls(K, G.t);
    stepMissions(dt);
    stepActivities(dt);
    stepPickups(dt);
    stepShops();
    if (!dialogBusy()) { stepPlayer(dt); stepCombat(dt); }
  } else {
    stepMissions(dt);
    if (G.mode === 'dead') {
      player.deadT = (player.deadT || 0) + dt;
      if (player.deadT > 3.4) respawnPlayer();
    }
  }
  stepTraffic(dt);
  const seen = stepPolice(dt);
  stepGunmen(dt);
  stepPedestrians(dt);
  stepVehicles(dt);
  stepWanted(dt, seen);
  stepEffects(dt);
  if (G.toast.t > 0) G.toast.t -= dt;
  streamClock += dt;
  if (streamClock > 0.5) {
    streamClock = 0;
    streamTraffic(focus.x, focus.z, false);
    streamPeds(focus.x, focus.z, false);
  }
  if (!G.shot) {
    stepWeather(dt); // deterministic: hour advances by dt, rain is a fixed-seed function of G.t
  }
  updateSignalColours(G.t);
}

export function runSteps(n) {
  for (let i = 0; i < n; i++) simStep(STEP);
}
