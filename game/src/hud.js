// hud.js - updates the DOM HUD: money, wanted stars, weapon and ammo, health and armour, speedometer, clock,
// district name, objective panel, interaction prompt, dialogue subtitle, toasts and the damage flash.
import { G, player } from './state.js';
import { WEAPONS } from './weapons.js';
import { drawMinimap } from './minimap.js';
import { city } from './cityLayout.js';
import { districtName } from './zones.js';
import { rankFor } from './progression.js';

const $ = (id) => document.getElementById(id);
const el = {};
const last = {};
function setText(key, text) {
  if (last[key] !== text) { last[key] = text; el[key].textContent = text; }
}
function setShow(key, on, display) {
  const v = on ? display || 'block' : 'none';
  if (last[key + '_d'] !== v) { last[key + '_d'] = v; el[key].style.display = v; }
}

export function initHud() {
  for (const id of ['hud', 'money', 'stars', 'weaponName', 'ammo', 'objective', 'objTitle', 'objText', 'objTimer', 'place', 'clock', 'minimap', 'hpFill', 'hpText', 'armFill', 'armBar', 'rank', 'speedo', 'speedNum', 'crosshair', 'prompt', 'subtitle', 'subWho', 'subText', 'subHint', 'toast', 'hurt']) el[id] = $(id);
  el.starSpans = el.stars.querySelectorAll('span');
}

export function setHudVisible(on) {
  el.hud.classList.toggle('off', !on);
}

export function updateHud() {
  const p = player;
  setText('money', '$' + Math.floor(p.money).toLocaleString('en-US'));
  const lv = G.wanted.level;
  if (last.stars !== lv) { last.stars = lv; for (let i = 0; i < 5; i++) el.starSpans[i].classList.toggle('on', i < lv); }
  const fl = lv > 0 && !G.wanted.seen && G.wanted.evade > 0;
  if (last.flash !== fl) { last.flash = fl; el.stars.classList.toggle('flash', fl); }
  const wsl = G.weapons[p.weapon], wd = WEAPONS[wsl.id];
  setText('weaponName', wd.name);
  setText('ammo', wsl.id === 'fists' ? '' : String(wsl.ammo));
  const hp = Math.max(0, Math.ceil(p.hp));
  setText('hpText', String(hp));
  if (last.hp !== hp) { last.hp = hp; el.hpFill.style.width = hp + '%'; }
  const ar = Math.ceil(p.armor);
  if (last.ar !== ar) { last.ar = ar; el.armFill.style.width = ar + '%'; el.armBar.style.display = ar > 0 ? 'block' : 'none'; }
  const inCar = p.veh >= 0;
  setShow('speedo', inCar);
  if (inCar) setText('speedNum', String(Math.round(Math.abs(G.vehicles[p.veh].speed) * 3.6)));
  setShow('crosshair', !inCar && p.aiming && G.mode === 'play');
  const hr = Math.floor(G.hour), mn = Math.floor((G.hour - hr) * 60);
  setText('clock', (hr < 10 ? '0' : '') + hr + ':' + (mn < 10 ? '0' : '') + mn);
  setText('place', districtName(p.x, p.z));
  setText('rank', rankFor(p.xp).name);
  // objective
  const o = G.objective;
  setShow('objective', !!o.title);
  setText('objTitle', o.title || '');
  setText('objText', o.text || '');
  setText('objTimer', o.timer || '');
  // prompt
  setShow('prompt', !!G.prompt);
  if (G.prompt && last.prompt !== G.prompt) { last.prompt = G.prompt; el.prompt.innerHTML = G.prompt; }
  // dialogue
  const d = G.dialog;
  setShow('subtitle', d.active);
  if (d.active) {
    const ln = d.lines[d.idx];
    if (ln) { setText('subWho', ln.who); setText('subText', ln.text); }
    setText('subHint', d.blocking ? 'ENTER' : '');
  }
  // toast
  const on = G.toast.t > 0;
  if (last.toastOn !== on) { last.toastOn = on; el.toast.classList.toggle('on', on); }
  setText('toast', G.toast.text);
  const hurt = Math.min(1, p.hurtT * 2 + (p.hp < 30 ? 0.35 : 0));
  if (Math.abs((last.hurt || 0) - hurt) > 0.03) { last.hurt = hurt; el.hurt.style.opacity = hurt; }
  drawMinimap(el.minimap);
  void city;
}
