// minimap.js - the circular rotating radar: a pre-rendered city map, then live blips for the player, mission markers,
// shops, pickups and police (flashing red/blue), with off-screen markers pinned to the rim.
import { C, N, WORLD, HALF_ROAD } from './config.js';
import { city } from './cityLayout.js';
import { G, player, AI_POLICE, H_COP, H_GANG, S_DEAD } from './state.js';
import { markers, KIND_SHOP, KIND_PICKUP } from './markers.js';

const SIZE = 440, R = SIZE / 2, MARGIN = 60, PX = 2;
let mapCanvas = null, ctx = null;
const SCALE = 1.9; // canvas pixels per world unit on screen (radius ~115 units)

const DISTRICT_COL = { downtown: '#5b6f8f', mid: '#53698a', resid: '#4b6479', industrial: '#58606b', port: '#56606f', beach: '#d7c28c', park: '#3f8a5a' };

function buildMap() {
  const W = (WORLD + MARGIN * 2) * PX;
  mapCanvas = document.createElement('canvas'); mapCanvas.width = mapCanvas.height = W;
  const g = mapCanvas.getContext('2d');
  g.scale(PX, PX); g.translate(MARGIN, MARGIN);
  g.fillStyle = '#1d6f86'; g.fillRect(-MARGIN, -MARGIN, WORLD + MARGIN * 2, WORLD + MARGIN * 2);
  g.fillStyle = '#e1cf9f'; g.fillRect(-MARGIN, -MARGIN, WORLD + MARGIN * 2, WORLD + MARGIN + 20);
  g.fillStyle = '#3e4a5e'; g.fillRect(-MARGIN, -MARGIN, WORLD + MARGIN * 2, MARGIN + 0);
  g.fillStyle = '#34425a'; g.fillRect(-12, -12, WORLD + 24, WORLD + 24);
  for (let bi = 0; bi < N; bi++) for (let bj = 0; bj < N; bj++) {
    const b = city.blocks[bi][bj];
    g.fillStyle = DISTRICT_COL[b.type]; g.fillRect(b.x0 - 1, b.z0 - 1, 50, 50);
  }
  g.fillStyle = '#c9c1ac';
  for (let i = 0; i <= N; i++) { g.fillRect(i * C - HALF_ROAD + 1.5, -HALF_ROAD, HALF_ROAD * 2 - 3, WORLD + 16); g.fillRect(-HALF_ROAD, i * C - HALF_ROAD + 1.5, WORLD + 16, HALF_ROAD * 2 - 3); }
  g.fillStyle = '#9a7a55'; g.fillRect(396, WORLD + 8, 8, 80);
  g.fillStyle = '#d9d3c0'; // building footprints for landmark feel
  for (const b of city.buildings) { if (b.h > 60) { g.fillStyle = '#8fb4d6'; g.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0); } }
}

function toLocal(x, z, out) {
  // world offset from the player, rotated into the camera-up frame
  const a = G.cam.yaw - Math.PI, c = Math.cos(a), s = Math.sin(a);
  const dx = x - player.x, dz = z - player.z;
  out.x = (dx * c - dz * s) * SCALE; out.y = (dx * s + dz * c) * SCALE;
}
const _l = { x: 0, y: 0 };

function blip(g, x, z, color, r, pin) {
  toLocal(x, z, _l);
  let bx = _l.x, by = _l.y;
  const d = Math.hypot(bx, by);
  const lim = R - 14;
  let outside = false;
  if (d > lim) { if (!pin) return; bx = bx / d * lim; by = by / d * lim; outside = true; }
  g.fillStyle = '#000'; g.beginPath(); g.arc(R + bx, R + by, r + 3, 0, 7); g.fill();
  g.fillStyle = color;
  if (outside) { g.beginPath(); g.arc(R + bx, R + by, r, 0, 7); g.fill(); } else { g.beginPath(); g.arc(R + bx, R + by, r, 0, 7); g.fill(); }
}

export function drawMinimap(canvas) {
  if (!mapCanvas) { buildMap(); ctx = canvas.getContext('2d'); }
  const g = ctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#16253a'; g.fillRect(0, 0, SIZE, SIZE);
  g.save();
  g.translate(R, R);
  g.rotate(G.cam.yaw - Math.PI);
  g.scale(SCALE / PX * PX, SCALE / PX * PX);
  g.drawImage(mapCanvas, -(player.x + MARGIN), -(player.z + MARGIN), WORLD + MARGIN * 2, WORLD + MARGIN * 2);
  g.restore();
  // markers
  for (let i = 0; i < markers.n; i++) {
    const k = markers.kind[i];
    blip(g, markers.x[i], markers.z[i], markers.color[i], k === KIND_PICKUP ? 5 : k === KIND_SHOP ? 8 : 10, k !== KIND_PICKUP);
  }
  // police
  const flash = Math.floor(G.t * 4) % 2 === 0;
  for (const v of G.vehicles) if (v.active && v.ai === AI_POLICE && !v.wreck) blip(g, v.x, v.z, flash ? '#ff3040' : '#3a6dff', 8, false);
  for (const h of G.humans) if (h.active && h.state !== S_DEAD && (h.kind === H_COP || h.kind === H_GANG)) blip(g, h.x, h.z, h.kind === H_COP ? (flash ? '#ff3040' : '#3a6dff') : '#ff7a2a', 6, false);
  // player arrow
  g.save();
  g.translate(R, R); g.rotate(G.cam.yaw - player.h);
  g.fillStyle = '#000'; g.beginPath(); g.moveTo(0, -17); g.lineTo(13, 13); g.lineTo(0, 7); g.lineTo(-13, 13); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -13); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.fill();
  g.restore();
}
