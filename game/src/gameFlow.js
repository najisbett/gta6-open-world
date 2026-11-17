// gameFlow.js - starting a fresh game: resets the player's stats, places Juno at the diner's corner, fills the
// streets around her and switches to play mode.
import { G, player } from './state.js';
import { city } from './cityLayout.js';
import { placePlayer } from './player.js';
import { streamTraffic } from './traffic.js';
import { streamPeds } from './pedestrians.js';
import { clearWanted } from './wanted.js';

export function startNewGame() {
  const d = city.places.diner;
  player.hp = 100; player.armor = 0; player.money = 500; player.weapon = 1; player.xp = 0; player.kills = 0;
  G.weapons[1].ammo = 60;
  placePlayer(d.x + 9, d.z + 1.5, -Math.PI / 2);
  G.cam.yaw = -Math.PI / 2; G.cam.pitch = 0.25;
  for (const v of G.vehicles) v.active = false;
  for (const h of G.humans) h.active = false;
  clearWanted();
  streamTraffic(player.x, player.z, true);
  streamPeds(player.x, player.z, true);
  G.mode = 'play';
}
