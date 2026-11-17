// state.js - the one home of mutable game state G. Pools are allocated once; systems mutate them in place.
import { MAX_VEHICLES, MAX_HUMANS } from './config.js';

export const AI_NONE = 0, AI_TRAFFIC = 1, AI_POLICE = 2, AI_PARKED = 3;
export const H_PED = 0, H_COP = 1, H_GANG = 2;
export const S_WALK = 0, S_FLEE = 1, S_ATTACK = 2, S_DEAD = 3, S_IDLE = 4;

function makeVehicle(i) {
  return {
    id: i, active: false, type: 'marlin', t: null, paint: 0, x: 0, y: 0, z: 0, h: 0, vx: 0, vz: 0, yaw: 0, pitch: 0, roll: 0,
    steer: 0, throttle: 0, brake: 0, hb: 0, hp: 100, ai: AI_NONE, driver: 0, ni: 0, nj: 0, dir: 0, stuck: 0, reverse: 0,
    slip: 0, speed: 0, fire: 0, wreck: false, keep: false, tune: 0, lastHit: 0, tmx: 0, tmz: 0, cruise: 0, mission: false,
    wasOnKerb: false, owned: false, siren: false, boom: 0, tireMarkX: 0, tireMarkZ: 0, hasMark: false, spawnT: 0,
  };
}
function makeHuman(i) {
  return {
    id: i, active: false, kind: 0, state: 0, x: 0, y: 0, z: 0, h: 0, vx: 0, vz: 0, hp: 40, hpMax: 40, bi: 0, bj: 0, corner: 0, cdir: 1,
    off: 0, speed: 1.4, timer: 0, cool: 0, walk: 0, shirt: 0, pants: 0, skin: 0, hair: 0, panic: 0, armed: false, fadeT: 0,
    fx: 0, fz: 0, tx: 0, tz: 0, mission: false, cash: 0, seenPlayer: false, crossing: false, vehId: -1,
  };
}

export const G = {
  mode: 'menu', // menu | play | pause | dead | shop | cutscene
  shot: null,
  t: 0, hour: 16.2, rain: 0, rainTarget: 0, weatherTimer: 0,
  player: {
    x: 0, y: 0, z: 0, h: 0, vy: 0, hp: 100, armor: 0, money: 500, veh: -1, weapon: 1, fireCd: 0, walk: 0, speed: 0, aiming: false, grounded: true,
    invuln: 0, xp: 0, kills: 0, deaths: 0, punchT: 0, enterCd: 0, recoil: 0, hurtT: 0, vxm: 0, vzm: 0, camYaw: 0,
  },
  weapons: [
    { id: 'fists', owned: true, ammo: 0 }, { id: 'pistol', owned: true, ammo: 60 }, { id: 'smg', owned: false, ammo: 0 }, { id: 'shotgun', owned: false, ammo: 0 },
  ],
  vehicles: Array.from({ length: MAX_VEHICLES }, (_, i) => makeVehicle(i)),
  humans: Array.from({ length: MAX_HUMANS }, (_, i) => makeHuman(i)),
  wanted: { level: 0, heat: 0, evade: 0, seen: false, flash: 0, copCount: 0, bust: 0 },
  mission: { active: -1, step: 0, stepT: 0, done: [], timer: 0, fail: '', collected: 0, kills: 0, started: false },
  garage: { type: 'vesper', paint: 3, tune: 0, saved: false },
  pickups: [],
  packages: [],
  race: { active: false, cp: 0, time: 0, best: 0 },
  stats: { playTime: 0, carsStolen: 0, pedsHit: 0, copsKilled: 0, missionsDone: 0, distance: 0 },
  cam: { yaw: 0, pitch: 0.25, x: 0, y: 5, z: -8, dist: 6, shake: 0, fov: 66, userT: 0, lookX: 0, lookY: 0, lookZ: 0 },
  toast: { text: '', t: 0 },
  objective: { title: '', text: '', timer: '' },
  dialog: { lines: [], idx: 0, active: false, blocking: false, timer: 0 },
  menu: { screen: 'title', hasSave: false, music: true },
  nearVeh: -1, nearPlace: null, prompt: '',
};

export const player = G.player;
export function toast(text, secs = 3) {
  G.toast.text = text;
  G.toast.t = secs;
}
