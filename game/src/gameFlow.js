// gameFlow.js - starting a fresh game, continuing a save, and returning to the title: resets the player and world
// pools, places Juno, restores the saved progress, brings the garage car back and fills the streets.
import { G, player, AI_NONE } from './state.js';
import { city } from './cityLayout.js';
import { placePlayer } from './player.js';
import { streamTraffic } from './traffic.js';
import { streamPeds } from './pedestrians.js';
import { clearWanted } from './wanted.js';
import { spawnVehicle } from './vehicles.js';
import { resetMissions } from './missions.js';
import { buildPickups } from './pickups.js';
import { readSave, hasSave } from './save.js';

function resetWorld() {
  for (const v of G.vehicles) { v.active = false; v.keep = false; v.mission = false; }
  for (const h of G.humans) { h.active = false; h.mission = false; }
  clearWanted();
  G.dialog.active = false; G.objective.title = ''; G.objective.text = ''; G.objective.timer = '';
  G.race.active = false;
}

function spawnGarageCar() {
  if (!G.garage.saved) return;
  const s = city.places.safehouse;
  const v = spawnVehicle(G.garage.type, s.x + 7, s.z + 4, Math.PI / 2, AI_NONE, G.garage.paint);
  if (v) { v.tune = G.garage.tune; v.owned = true; v.driver = 0; }
}

function finishStart() {
  streamTraffic(player.x, player.z, true);
  streamPeds(player.x, player.z, true);
  spawnGarageCar();
  G.mode = 'play';
}

export function startNewGame() {
  const d = city.places.diner;
  resetWorld();
  player.hp = 100; player.armor = 0; player.money = 500; player.weapon = 1; player.xp = 0; player.kills = 0; player.deaths = 0;
  G.weapons[0].owned = true; G.weapons[1].owned = true; G.weapons[1].ammo = 60;
  G.weapons[2].owned = false; G.weapons[2].ammo = 0; G.weapons[3].owned = false; G.weapons[3].ammo = 0;
  G.packages.length = 0; G.race.best = 0; G.garage = { type: 'vesper', paint: 3, tune: 0, saved: false };
  G.stats = { playTime: 0, carsStolen: 0, pedsHit: 0, copsKilled: 0, missionsDone: 0, distance: 0 };
  G.hour = 16.2;
  resetMissions([]);
  buildPickups();
  placePlayer(d.x + 9, d.z - 0.2, -Math.PI / 2);
  G.cam.yaw = -Math.PI / 2; G.cam.pitch = 0.25;
  finishStart();
}

export function loadGame() {
  const s = readSave();
  if (!s) { startNewGame(); return; }
  resetWorld();
  player.hp = Math.max(30, s.hp || 100); player.armor = s.armor || 0; player.money = s.money; player.xp = s.xp || 0; player.kills = s.kills || 0; player.weapon = s.weapon || 1;
  s.weapons.forEach((w, i) => { G.weapons[i].owned = w.owned; G.weapons[i].ammo = w.ammo; });
  G.packages.length = 0; G.packages.push(...(s.packages || []));
  G.race.best = s.raceBest || 0; G.garage = s.garage || G.garage; G.stats = { ...G.stats, ...(s.stats || {}) };
  G.hour = s.hour || 16;
  resetMissions(s.done || []);
  buildPickups();
  placePlayer(s.x, s.z, s.h || 0);
  G.cam.yaw = s.h || 0;
  finishStart();
}

export function quitToTitle() {
  resetWorld();
  G.mode = 'menu';
  streamTraffic(384, 330, true);
  streamPeds(384, 330, true);
}

export { hasSave };
