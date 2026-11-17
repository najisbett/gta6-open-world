// proceduralTextures.js - every texture of the game drawn at boot on 2D canvases (no image files, no network).
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { SIGN_NAMES } from './cityLayout.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTexture(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// 4x4 windows per tile (tile = 16 world units); the emissive twin lights a random half of them for night.
export function makeWindowTextures() {
  const rng = makeRng(77);
  const [c, g] = canvas(256, 256);
  const [e, h] = canvas(256, 256);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  h.fillStyle = '#000'; h.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
    const x = q * 64 + 10, y = r * 64 + 14;
    const grad = g.createLinearGradient(0, y, 0, y + 36);
    grad.addColorStop(0, '#2d4a63'); grad.addColorStop(0.5, '#89b4cf'); grad.addColorStop(1, '#27394d');
    g.fillStyle = '#9aa4ab'; g.fillRect(x - 2, y - 2, 48, 40);
    g.fillStyle = grad; g.fillRect(x, y, 44, 36);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 4, y + 3, 14, 3);
    if (rng() < 0.45) { h.fillStyle = rng() < 0.7 ? '#ffd88a' : '#9fd8ff'; h.fillRect(x, y, 44, 36); }
  }
  g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 60, 256, 4); g.fillRect(0, 124, 256, 4); g.fillRect(0, 188, 256, 4); g.fillRect(0, 252, 256, 4);
  return { map: toTexture(c, true), emissive: toTexture(e, true) };
}

// Asphalt strip: 16 units across (u) by 16 along (v), dashed centre line and edge lines.
export function makeRoadTexture() {
  const rng = makeRng(5);
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#585d66'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const v = 78 + rng() * 22; g.fillStyle = `rgb(${v},${v + 2},${v + 8})`; g.fillRect(rng() * 256, rng() * 256, 2, 2); }
  g.fillStyle = '#e9e4d2'; g.fillRect(6, 0, 4, 256); g.fillRect(246, 0, 4, 256);
  g.fillStyle = '#f2c94c'; g.fillRect(124, 0, 3, 256); g.fillRect(130, 0, 3, 256);
  g.fillStyle = '#e9e4d2';
  g.fillRect(63, 16, 3, 96); g.fillRect(190, 16, 3, 96);
  return toTexture(c, true);
}

export function makeIntersectionTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#5a5f68'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#ece8da';
  for (let i = 0; i < 9; i++) {
    const p = 24 + i * 26;
    g.fillRect(p, 2, 14, 30); g.fillRect(p, 224, 14, 30); g.fillRect(2, p, 30, 14); g.fillRect(224, p, 30, 14);
  }
  return toTexture(c, false);
}

export function makeSandTexture() {
  const rng = makeRng(9);
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#ecd9a8'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { g.fillStyle = rng() < 0.5 ? '#e2cd98' : '#f3e4bb'; g.fillRect(rng() * 128, rng() * 128, 2, 2); }
  return toTexture(c, true);
}

export function makeWaterTexture() {
  const rng = makeRng(11);
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#1b8fa3'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.05 + rng() * 0.12})`; g.lineWidth = 1 + rng() * 2;
    const x = rng() * 256, y = rng() * 256; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 12, y - 4, x + 28, y); g.stroke();
  }
  return toTexture(c, true);
}

// Atlas of neon signs: 4 columns x 6 rows, each cell 256x64.
export function makeSignAtlas() {
  const [c, g] = canvas(1024, 384);
  g.fillStyle = '#10131c'; g.fillRect(0, 0, 1024, 384);
  const cols = ['#ff5d8f', '#37e0c8', '#ffd24a', '#7ab8ff', '#ff9a3c', '#b693ff'];
  SIGN_NAMES.forEach((name, i) => {
    const x = (i % 4) * 256, y = Math.floor(i / 4) * 64;
    const col = cols[i % cols.length];
    g.fillStyle = '#171b27'; g.fillRect(x + 2, y + 2, 252, 60);
    g.strokeStyle = col; g.lineWidth = 3; g.strokeRect(x + 5, y + 5, 246, 54);
    g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 8;
    g.font = 'bold 24px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 24;
    while (g.measureText(name).width > 226 && size > 12) { size -= 2; g.font = `bold ${size}px Impact, Arial Black, sans-serif`; }
    g.fillText(name, x + 128, y + 34);
    g.shadowBlur = 0;
  });
  return toTexture(c, false);
}

export function signUv(idx) {
  const x = (idx % 4) / 4, y = 1 - (Math.floor(idx / 4) + 1) / 6;
  return [x + 0.004, y + 0.004, x + 0.246, y + 1 / 6 - 0.004];
}

export function makeParticleSprite() {
  const [c, g] = canvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
