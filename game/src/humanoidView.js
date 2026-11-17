// humanoidView.js - draws the player and every pedestrian, cop and gunman as articulated blocky people using seven
// instanced meshes (legs, torso, head, hair, arms, gun). One matrix write per part per person per frame.
import * as THREE from 'three';
import { MAX_HUMANS } from './config.js';
import { G, S_DEAD, S_ATTACK, S_FLEE } from './state.js';
import { WEAPONS } from './weapons.js';

const SLOTS = MAX_HUMANS + 1;
const mk = (sx, sy, sz) => {
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshLambertMaterial(), SLOTS);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.castShadow = true;
  return m;
};
const parts = {};
const _base = new THREE.Matrix4(), _loc = new THREE.Matrix4(), _m = new THREE.Matrix4();
const _pos = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const _c = new THREE.Color();

export function createHumanoidViews(scene) {
  parts.leg = [mk(0.2, 0.85, 0.22), mk(0.2, 0.85, 0.22)];
  parts.torso = mk(0.46, 0.6, 0.26);
  parts.head = mk(0.24, 0.26, 0.24);
  parts.hair = mk(0.27, 0.1, 0.27);
  parts.arm = [mk(0.13, 0.6, 0.15), mk(0.13, 0.6, 0.15)];
  parts.gun = mk(0.07, 0.12, 0.38);
  for (const k of ['torso', 'head', 'hair', 'gun']) scene.add(parts[k]);
  scene.add(...parts.leg, ...parts.arm);
  for (let i = 0; i < SLOTS; i++) setHumanColors(i, 0x888888, 0x334455, 0xd9a07a, 0x2a1d14);
  setHumanColors(0, 0x1f9a8f, 0x2c3a56, 0xc98f67, 0xf08a24);
  parts.gun.setColorAt(0, _c.setHex(0x1b1b1f));
  for (let i = 0; i < SLOTS; i++) parts.gun.setColorAt(i, _c.setHex(0x1b1b1f));
  parts.gun.instanceColor.needsUpdate = true;
}

export function setHumanColors(slot, shirt, pants, skin, hair) {
  parts.torso.setColorAt(slot, _c.setHex(shirt)); parts.leg[0].setColorAt(slot, _c.setHex(pants)); parts.leg[1].setColorAt(slot, _c.setHex(pants));
  parts.head.setColorAt(slot, _c.setHex(skin)); parts.arm[0].setColorAt(slot, _c.setHex(skin)); parts.arm[1].setColorAt(slot, _c.setHex(skin));
  parts.hair.setColorAt(slot, _c.setHex(hair));
  for (const m of [parts.torso, parts.leg[0], parts.leg[1], parts.head, parts.arm[0], parts.arm[1], parts.hair]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
}

function put(mesh, slot, px, py, pz, ang = 0) {
  // place a part relative to the person's base matrix, rotated by ang about its X axis
  _pos.set(px, py, pz);
  _q.setFromEuler(_e.set(ang, 0, 0));
  _loc.compose(_pos, _q, _s);
  _m.multiplyMatrices(_base, _loc);
  mesh.setMatrixAt(slot, _m);
}

function limb(mesh, slot, px, pivotY, len, ang) {
  put(mesh, slot, px, pivotY - Math.cos(ang) * len / 2, -Math.sin(ang) * len / 2, ang);
}

function drawPerson(slot, x, y, z, h, walk, swing, armed, aiming, dead) {
  _pos.set(x, y + (dead ? 0.14 : 0), z);
  _q.setFromEuler(_e.set(dead ? -Math.PI / 2 : 0, h, 0, 'YXZ'));
  _base.compose(_pos, _q, _s);
  const a = Math.sin(walk) * swing;
  limb(parts.leg[0], slot, -0.11, 0.85, 0.85, a);
  limb(parts.leg[1], slot, 0.11, 0.85, 0.85, -a);
  put(parts.torso, slot, 0, 1.18, 0);
  put(parts.head, slot, 0, 1.68, 0);
  put(parts.hair, slot, 0, 1.84, 0);
  const aimA = -Math.PI / 2 + 0.05;
  if (armed && aiming) {
    limb(parts.arm[0], slot, -0.3, 1.45, 0.6, aimA + 0.1);
    limb(parts.arm[1], slot, 0.3, 1.45, 0.6, aimA);
    put(parts.gun, slot, 0.3, 1.45, 0.75);
  } else if (armed) {
    limb(parts.arm[0], slot, -0.3, 1.45, 0.6, -a * 0.6);
    limb(parts.arm[1], slot, 0.3, 1.45, 0.6, -0.9);
    put(parts.gun, slot, 0.3, 1.2, 0.35);
  } else {
    limb(parts.arm[0], slot, -0.3, 1.45, 0.6, -a);
    limb(parts.arm[1], slot, 0.3, 1.45, 0.6, a);
    parts.gun.setMatrixAt(slot, _zero);
  }
}

function hide(slot) {
  parts.leg[0].setMatrixAt(slot, _zero); parts.leg[1].setMatrixAt(slot, _zero); parts.torso.setMatrixAt(slot, _zero); parts.head.setMatrixAt(slot, _zero);
  parts.hair.setMatrixAt(slot, _zero); parts.arm[0].setMatrixAt(slot, _zero); parts.arm[1].setMatrixAt(slot, _zero); parts.gun.setMatrixAt(slot, _zero);
}

export function syncHumanViews() {
  const p = G.player;
  if (p.veh >= 0 || G.mode === 'menu') hide(0);
  else {
    const w = WEAPONS[G.weapons[p.weapon].id];
    drawPerson(0, p.x, p.y, p.z, p.h, p.walk, Math.min(0.9, p.speed * 0.16), p.weapon > 0, p.aiming || p.fireCd > w.rate * 0.6 && w.rate > 0.2 || p.aiming, G.mode === 'dead');
  }
  for (let i = 0; i < MAX_HUMANS; i++) {
    const h = G.humans[i];
    if (!h.active) { hide(i + 1); continue; }
    const dead = h.state === S_DEAD;
    drawPerson(i + 1, h.x, h.y, h.z, h.h, h.walk, dead ? 0 : h.state === S_FLEE ? 0.9 : 0.55, h.armed, h.state === S_ATTACK, dead);
  }
  for (const m of [parts.torso, parts.head, parts.hair, parts.gun, parts.leg[0], parts.leg[1], parts.arm[0], parts.arm[1]]) m.instanceMatrix.needsUpdate = true;
}
