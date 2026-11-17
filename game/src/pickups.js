// pickups.js - collectibles on the street: dropped cash, health and armour packs, and the fifteen hidden Sea Glass
// packages. Walking or driving through one collects it; packages are remembered in the save.
import { G, player, toast } from './state.js';
import { city, blockX0, blockX1 } from './cityLayout.js';
import { pushMarker, KIND_PICKUP } from './markers.js';
import { fx } from './effects.js';
import { on, emit } from './events.js';

export const PACKAGE_COUNT = 15;
export const KIND = { CASH: 0, HEALTH: 1, ARMOR: 2, PACKAGE: 3 };
const COLORS = [0x6dff8a, 0xff5a7a, 0x5ab4ff, 0xffd24a];

function add(kind, x, z, value, idx) {
  G.pickups.push({ kind, x, z, value, active: true, idx, respawn: 0, life: kind === KIND.CASH ? 45 : -1 });
}

export function buildPickups() {
  G.pickups.length = 0;
  for (let k = 0; k < PACKAGE_COUNT; k++) {
    const bi = (k * 5 + 2) % 12, bj = (k * 7 + 3) % 12;
    const x0 = blockX0(bi), x1 = blockX1(bi), z0 = blockX0(bj), z1 = blockX1(bj);
    const side = k % 4, t = 8 + ((k * 13) % 30);
    const x = side === 0 ? x0 + t : side === 1 ? x1 - 1.6 : side === 2 ? x0 + t : x0 + 1.6;
    const z = side === 0 ? z0 + 1.6 : side === 1 ? z0 + t : side === 2 ? z1 - 1.6 : z0 + t;
    add(KIND.PACKAGE, x, z, 250, k);
  }
  const h = city.places.hospital, g = city.places.guns, s = city.places.safehouse;
  add(KIND.HEALTH, h.x - 5, h.z, 50, -1); add(KIND.HEALTH, h.x + 5, h.z, 50, -1);
  add(KIND.ARMOR, g.x + 7, g.z, 50, -1); add(KIND.ARMOR, s.x, s.z - 7, 50, -1);
}

function collect(p) {
  const pl = player;
  if (p.kind === KIND.CASH) { pl.money += p.value; toast('+$' + p.value, 1.2); }
  else if (p.kind === KIND.HEALTH) { if (pl.hp >= 100) return false; pl.hp = Math.min(100, pl.hp + p.value); toast('Health restored', 1.4); }
  else if (p.kind === KIND.ARMOR) { if (pl.armor >= 100) return false; pl.armor = Math.min(100, pl.armor + p.value); toast('Armor +' + p.value, 1.4); }
  else if (p.kind === KIND.PACKAGE) {
    if (!G.packages.includes(p.idx)) G.packages.push(p.idx);
    pl.money += p.value; pl.xp += 40;
    const n = G.packages.length;
    toast(n >= PACKAGE_COUNT ? 'ALL SEA GLASS FOUND  +$5,000' : 'Sea Glass ' + n + '/' + PACKAGE_COUNT + '  +$' + p.value, 2.4);
    if (n >= PACKAGE_COUNT) pl.money += 5000;
  }
  fx.coin(p.x, 1, p.z);
  emit('pickup');
  return true;
}

export function stepPickups(dt) {
  for (let i = 0; i < G.pickups.length; i++) {
    const p = G.pickups[i];
    if (p.kind === KIND.PACKAGE && G.packages.includes(p.idx)) { p.active = false; continue; }
    if (!p.active) {
      if (p.life < 0 && p.respawn > 0) { p.respawn -= dt; if (p.respawn <= 0) p.active = true; }
      continue;
    }
    if (p.life > 0) { p.life -= dt; if (p.life <= 0) { p.active = false; continue; } }
    const d2 = (p.x - player.x) * (p.x - player.x) + (p.z - player.z) * (p.z - player.z);
    if (d2 < 130 * 130 && G.mode === 'play') pushMarker(p.x, p.z, COLORS[p.kind], KIND_PICKUP, false);
    if (d2 < (player.veh >= 0 ? 3.2 : 1.6) * (player.veh >= 0 ? 3.2 : 1.6) && collect(p)) { p.active = false; if (p.life < 0) p.respawn = 90; }
  }
  // recycle spent cash drops so the list stays short
  if (G.pickups.length > 80) for (let i = G.pickups.length - 1; i >= 0; i--) if (G.pickups[i].kind === KIND.CASH && !G.pickups[i].active) G.pickups.splice(i, 1);
}

on('cashDrop', (x, z, amt) => { if (!G.shot) add(KIND.CASH, x, z, amt, -1); });
export const pickupColor = (kind) => COLORS[kind];
