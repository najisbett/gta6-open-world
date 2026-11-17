// missions.js - the mission state machine: offers the next story mission at the diner, runs its steps (steal, drive,
// goto, kill, collect, lose, talk), publishes markers and the objective panel, and pays out, fails or retries.
import { G, player, AI_NONE, H_GANG, H_PED, S_IDLE, S_DEAD, toast } from './state.js';
import { MISSIONS } from './missionData.js';
import { city, groundHeight } from './cityLayout.js';
import { clearMarkers, pushMarker, KIND_MISSION, KIND_GOAL, KIND_ENEMY } from './markers.js';
import { say, dialogBusy, stepDialogue } from './dialogue.js';
import { spawnVehicle } from './vehicles.js';
import { resetHumanSlot } from './pedestrians.js';
import { setHumanColors } from './humanoidView.js';
import { pointBlockedAt } from './collision.js';
import { setWanted, clearWanted } from './wanted.js';
import { giveWeapon } from './combat.js';
import { on, emit } from './events.js';
import { saveGame } from './save.js';
import { rand } from './rng.js';

const M = G.mission;
let spawned = { car: -1, gang: [] };
let giverId = -1;
let timeLeft = 0, cp = 0, killsNeeded = 0, killsDone = 0, stepReady = false;

export const nextMission = () => MISSIONS.find((m) => !M.done.includes(m.id)) || null;
export const missionActive = () => M.active >= 0;

function setObjective(title, text, timer) {
  G.objective.title = title; G.objective.text = text; G.objective.timer = timer || '';
}
const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

function cleanup() {
  if (spawned.car >= 0) { const v = G.vehicles[spawned.car]; if (v) v.mission = false; }
  spawned.car = -1; spawned.gang.length = 0;
  for (const h of G.humans) if (h.active && h.mission) { h.mission = false; if (h.state !== S_DEAD) h.active = false; }
}

function currentMission() {
  return M.active >= 0 ? MISSIONS[M.active] : null;
}

export function startMission(idx) {
  const m = MISSIONS[idx];
  M.active = idx; M.step = -1; stepReady = false;
  setObjective(m.title, 'Listen up', '');
  say(m.intro, true, () => {
    if (m.giveWeapon) { giveWeapon(m.giveWeapon[0], m.giveWeapon[1]); toast('Hornet SMG acquired', 3); }
    beginStep(0);
  });
}

function findSpot(cx, cz, rMin, rMax) {
  for (let i = 0; i < 60; i++) {
    const a = rand() * 6.283, r = rMin + rand() * (rMax - rMin);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (pointBlockedAt(x, z, 1) < 0 && pointBlockedAt(x, z, 0.1) < 0 && x > 2 && z > 2 && x < 766 && z < 766) return { x, z };
  }
  return { x: cx, z: cz };
}

function beginStep(i) {
  const m = currentMission();
  M.step = i; stepReady = false;
  if (i >= m.steps.length) { completeMission(); return; }
  const s = m.steps[i];
  setObjective(m.title, s.text || '', '');
  if (s.t === 'steal') {
    const at = s.at();
    const v = spawnVehicle(s.type, at.x, at.z, s.heading, AI_NONE, s.paint);
    if (v) { v.mission = true; v.keep = true; spawned.car = v.id; }
  } else if (s.t === 'kill') {
    const c = s.around();
    killsNeeded = s.count; killsDone = 0; spawned.gang.length = 0;
    for (let k = 0; k < s.count; k++) {
      const pos = findSpot(c.x, c.z, 4, 17);
      for (const h of G.humans) {
        if (h.active) continue;
        resetHumanSlot(h, H_GANG);
        setHumanColors(h.id + 1, k % 2 ? 0xc9382f : 0x222831, 0x2d2f36, 0xb97a56, 0x111111);
        h.x = pos.x; h.z = pos.z; h.armed = true; h.state = S_IDLE; h.mission = true; h.hp = h.hpMax = 55; h.cash = 60;
        spawned.gang.push(h.id);
        break;
      }
    }
  } else if (s.t === 'collect') { cp = 0; timeLeft = s.time; }
  else if (s.t === 'lose') { if (G.wanted.level < s.level) setWanted(s.level); }
  else if (s.t === 'talk') { say(s.lines, true, () => beginStep(i + 1)); }
  stepReady = true;
}

function completeMission() {
  const m = currentMission();
  M.done.push(m.id);
  G.stats.missionsDone++;
  player.money += m.reward; player.xp += m.xp;
  cleanup();
  M.active = -1;
  setObjective('', '', '');
  toast('MISSION PASSED  +$' + m.reward.toLocaleString('en-US'), 4.5);
  emit('missionPassed');
  say(m.outro, false);
  saveGame();
}

export function failMission(reason) {
  if (M.active < 0) return;
  cleanup();
  M.active = -1;
  setObjective('', '', '');
  toast('MISSION FAILED - ' + reason, 4);
  emit('missionFailed');
}

on('playerDied', () => failMission('you were taken out'));
on('gangKilled', (id) => { if (spawned.gang.includes(id)) killsDone++; });

function inVehicle() { return player.veh >= 0; }
const near = (p, r) => Math.hypot(player.x - p.x, player.z - p.z) < r;

// Dessa waits at the diner whenever a story mission is on offer.
function keepGiverNpc(g) {
  let h = giverId >= 0 ? G.humans[giverId] : null;
  if (h && h.active && h.mission && h.state === S_IDLE) { h.h = Math.atan2(player.x - h.x, player.z - h.z); return; }
  for (const c of G.humans) {
    if (c.active) continue;
    resetHumanSlot(c, H_PED);
    setHumanColors(c.id + 1, 0xffd24a, 0xf2f2f2, 0x8a5a3c, 0x0e0b09);
    c.x = g.x + 1.2; c.z = g.z + 0.6; c.state = S_IDLE; c.mission = true; c.hp = c.hpMax = 999; c.cash = 0;
    giverId = c.id;
    return;
  }
}

export function stepMissions(dt) {
  clearMarkers();
  stepDialogue(dt);
  const m = currentMission();
  if (!m) {
    const nm = nextMission();
    if (!nm) { if (giverId >= 0) { G.humans[giverId].active = false; giverId = -1; } return; }
    if (dialogBusy()) return;
    const g = nm.giver();
    pushMarker(g.x, g.z, 0xffd24a, KIND_MISSION, true);
    keepGiverNpc(g);
    if (G.mode === 'play' && near(g, 3.3) && !G.dialog.active) startMission(MISSIONS.indexOf(nm));
    return;
  }
  if (M.step < 0) { const g = m.giver(); pushMarker(g.x, g.z, 0xffd24a, KIND_MISSION, true); }
  if (!stepReady || M.step < 0 || dialogBusy()) return;
  const s = m.steps[M.step];
  if (s.t === 'steal') {
    const v = G.vehicles[spawned.car];
    if (!v || v.wreck) { failMission('the car was destroyed'); return; }
    pushMarker(v.x, v.z, 0xffd24a, KIND_GOAL, true);
    if (player.veh === spawned.car) { if (s.wanted) setWanted(s.wanted); beginStep(M.step + 1); }
  } else if (s.t === 'drive') {
    const at = s.at();
    pushMarker(at.x, at.z, 0x38e8d0, KIND_GOAL, true);
    G.objective.text = inVehicle() ? s.text : 'Get back in a car';
    if (inVehicle() && near(at, s.r)) beginStep(M.step + 1);
  } else if (s.t === 'goto') {
    const at = s.at();
    pushMarker(at.x, at.z, 0x38e8d0, KIND_GOAL, true);
    if (near(at, s.r) && (s.vehicleOk || !inVehicle())) beginStep(M.step + 1);
  } else if (s.t === 'kill') {
    let left = 0;
    for (const id of spawned.gang) { const h = G.humans[id]; if (h.active && h.state !== S_DEAD) { left++; pushMarker(h.x, h.z, 0xff4a4a, KIND_ENEMY, false); } }
    G.objective.text = s.text + ' (' + (killsNeeded - left) + '/' + killsNeeded + ')';
    if (s.wanted && !s.alarm && left < killsNeeded) { s.alarm = true; setWanted(s.wanted); }
    if (left === 0) { s.alarm = false; beginStep(M.step + 1); }
  } else if (s.t === 'collect') {
    const pts = s.pts();
    const p = pts[cp];
    timeLeft -= dt;
    G.objective.timer = fmt(Math.max(0, timeLeft));
    G.objective.text = s.text + ' (' + cp + '/' + pts.length + ')';
    pushMarker(p.x, p.z, 0xffd24a, KIND_GOAL, true);
    if (cp + 1 < pts.length) pushMarker(pts[cp + 1].x, pts[cp + 1].z, 0x8a8f99, KIND_GOAL, false);
    if (near(p, 8)) { cp++; emit('pickup'); toast('Envelope collected', 1.5); if (cp >= pts.length) { G.objective.timer = ''; beginStep(M.step + 1); } }
    else if (timeLeft <= 0) failMission('time ran out');
  } else if (s.t === 'lose') {
    G.objective.text = G.wanted.level > 0 ? (G.wanted.seen ? s.text + ' - cops can see you' : 'Stay hidden until the stars clear') : s.text;
    if (G.wanted.level === 0) beginStep(M.step + 1);
  }
}

export function resetMissions(doneList) {
  cleanup();
  M.active = -1; M.step = 0; M.done = doneList ? doneList.slice() : [];
  setObjective('', '', '');
  void groundHeight; void clearWanted; void city;
}
