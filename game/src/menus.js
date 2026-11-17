// menus.js - every full-screen menu in one place: title (new/continue), pause, controls, shops, and the knocked-out
// screen. Buttons work with the mouse and with W/S/arrows + ENTER; ESC backs out.
import { G, player } from './state.js';
import { GAME_TITLE, CITY_NAME } from './config.js';
import { consume } from './input.js';
import { on } from './events.js';
import { shopItems, tryBuy, SHOPS } from './shops.js';
import { saveGame, eraseSave } from './save.js';
import { startNewGame, loadGame, quitToTitle } from './gameFlow.js';
import { initAudio, sfx, setMusic, musicEnabled } from './audio.js';
import { rankFor, RANKS } from './progression.js';

const root = document.getElementById('screen');
let items = [], sel = 0, onBack = null, shopId = null;

function lockPointer() {
  const c = document.getElementById('view');
  if (c.requestPointerLock) { try { const r = c.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* denied */ } }
}

function show(cls, head, body, list, back) {
  root.className = cls || '';
  root.innerHTML = head + (body || '');
  items = list; sel = 0; onBack = back || null;
  list.forEach((it, i) => {
    const b = document.createElement('div');
    b.className = 'btn' + (it.disabled ? ' off' : '') + (i === 0 ? ' sel' : '');
    b.innerHTML = it.label + (it.sub ? '<small>' + it.sub + '</small>' : '');
    b.addEventListener('mouseenter', () => select(i));
    b.addEventListener('click', () => activate(i));
    root.appendChild(b);
  });
}
function select(i) {
  sel = i;
  const bs = root.querySelectorAll('.btn');
  bs.forEach((b, k) => b.classList.toggle('sel', k === i));
}
function activate(i) {
  const it = items[i];
  if (!it) return;
  initAudio(); sfx('ui');
  it.action();
}

export function hideScreen() {
  root.className = 'hidden'; root.innerHTML = ''; items = []; onBack = null;
}

export function showTitle() {
  G.mode = 'menu';
  const list = [];
  if (G.menu.hasSave) list.push({ label: 'CONTINUE', sub: 'Pick up where you left off', action: () => { beginPlay(loadGame); } });
  list.push({ label: 'NEW GAME', sub: 'Juno Reyes arrives in ' + CITY_NAME, action: () => { if (G.menu.hasSave) eraseSave(); beginPlay(startNewGame); } });
  list.push({ label: 'CONTROLS', action: () => showControls(showTitle) });
  show('', '<h1>' + GAME_TITLE + '</h1><h2>' + CITY_NAME.toUpperCase() + '</h2><p>Steal cars, work for Dessa, outrun the Port Halcyon PD. Everything here is original: the city, the crews and the music.</p>', '', list, null);
}

function beginPlay(starter) {
  initAudio();
  starter();
  hideScreen();
  lockPointer();
}

export function showControls(back) {
  const keys = [
    ['W A S D', 'Move / drive'], ['Mouse', 'Look (click to capture)'], ['Shift', 'Sprint'], ['Space', 'Jump / handbrake'], ['E', 'Enter or exit car, use marker'],
    ['LMB / RMB', 'Fire / aim'], ['1-4 / Q / wheel', 'Switch weapon'], ['Enter', 'Advance dialogue'], ['Arrows', 'Camera without a mouse'], ['P / Esc', 'Pause'], ['M', 'Music on/off'],
  ];
  const rows = keys.map((k) => '<p><kbd>' + k[0] + '</kbd> ' + k[1] + '</p>').join('');
  show('', '<h2>CONTROLS</h2>' + rows, '', [{ label: 'BACK', action: back }], back);
}

export function showPause() {
  if (G.mode !== 'play') return;
  G.mode = 'pause';
  if (document.exitPointerLock) document.exitPointerLock();
  const r = rankFor(player.xp);
  const nxt = r.index < RANKS.length - 1 ? ' - next rank at ' + r.next + ' XP' : '';
  show('', '<h2>PAUSED</h2><p>Rank ' + r.name + ' - ' + player.xp + ' XP' + nxt + '</p><p>Missions ' + G.mission.done.length + '/6 - Sea Glass ' + G.packages.length + '/15 - Cars stolen ' + G.stats.carsStolen + '</p>', '', [
    { label: 'RESUME', action: resume },
    { label: 'SAVE GAME', action: () => { saveGame(); showPause2('Game saved'); } },
    { label: musicEnabled() ? 'MUSIC: ON' : 'MUSIC: OFF', action: () => { setMusic(!musicEnabled()); G.mode = 'play'; showPause(); } },
    { label: 'CONTROLS', action: () => showControls(() => { G.mode = 'play'; showPause(); }) },
    { label: 'QUIT TO TITLE', action: () => { saveGame(); quitToTitle(); showTitle(); } },
  ], resume);
}
function showPause2(msg) {
  G.mode = 'play'; showPause();
  const p = document.createElement('p'); p.textContent = msg; root.insertBefore(p, root.children[1]);
}

export function resume() {
  hideScreen();
  G.mode = 'play';
  lockPointer();
}

export function showShop(id) {
  const shop = SHOPS.find((s) => s.id === id);
  G.mode = 'shop';
  if (document.exitPointerLock) document.exitPointerLock();
  const list = shopItems(id).map((it) => ({
    label: it.label + (it.price ? '  -  $' + it.price : '  -  free'),
    sub: it.ok() || '',
    disabled: !!it.ok() || player.money < it.price,
    action: () => { tryBuy(it); showShop(id); },
  }));
  list.push({ label: 'LEAVE', action: closeShop });
  show('', '<h2>' + shop.title + '</h2><p>Cash: $' + Math.floor(player.money).toLocaleString('en-US') + '</p>', '', list, closeShop);
}
function closeShop() {
  hideScreen(); G.mode = 'play'; lockPointer();
}

export function showKnockedOut() {
  show('wasted', '<h1>KNOCKED OUT</h1><p>Mercy General is sending the bill. Stay down, Juno.</p>', '', [], null);
}

export function stepMenus() {
  if (G.mode === 'menu' || G.mode === 'pause' || G.mode === 'shop') {
    if (!items.length && !onBack) return;
    if (consume('ArrowDown') || consume('KeyS')) { select((sel + 1) % items.length); sfx('ui'); }
    if (consume('ArrowUp') || consume('KeyW')) { select((sel + items.length - 1) % items.length); sfx('ui'); }
    if (consume('Enter')) activate(sel);
    if (consume('Escape') && onBack) onBack();
    for (let d = 1; d <= 9; d++) if (consume('Digit' + d) && items[d - 1]) activate(d - 1);
  } else if (G.mode === 'play') {
    if (consume('KeyP')) showPause();
    if (consume('KeyM')) setMusic(!musicEnabled());
    if (consume('Escape')) showPause();
  }
}

on('openShop', (id) => showShop(id));
on('playerDied', () => showKnockedOut());
on('respawned', () => hideScreen());
