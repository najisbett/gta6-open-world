// save.js - persistence in localStorage: money, weapons, rank, completed missions, collected packages, race record and
// the garage car. Mission progress inside a mission is not saved; an unfinished mission restarts at the diner.
import { G, player } from './state.js';
import { SAVE_KEY } from './config.js';

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function saveGame() {
  if (G.shot) return false;
  const data = {
    v: 1, money: Math.floor(player.money), hp: Math.ceil(player.hp), armor: Math.ceil(player.armor), xp: player.xp, kills: player.kills,
    weapons: G.weapons.map((w) => ({ owned: w.owned, ammo: w.ammo })), weapon: player.weapon,
    done: G.mission.done, packages: G.packages, raceBest: G.race.best, garage: G.garage, stats: G.stats,
    x: player.x, z: player.z, h: player.h, hour: G.hour,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); G.menu.hasSave = true; return true; } catch { return false; }
}

export function readSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function eraseSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
  G.menu.hasSave = false;
}
