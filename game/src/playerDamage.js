// playerDamage.js - how the player takes damage: armour soaks most of it, the screen flashes and shakes, and death
// is handed to player.js when health runs out.
import { G, player } from './state.js';
import { emit } from './events.js';

export function hurtPlayer(dmg, srcX, srcZ) {
  if (player.invuln > 0 || G.mode !== 'play' || G.shot) return;
  if (player.armor > 0) {
    const soak = Math.min(player.armor, dmg * 0.7);
    player.armor -= soak; dmg -= soak;
  }
  player.hp -= dmg;
  player.hurtT = 0.45;
  G.cam.shake = Math.max(G.cam.shake, 0.25);
  emit('playerHurt', dmg, srcX, srcZ);
}
