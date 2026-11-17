// collision.js - static world colliders (axis-aligned boxes with heights) in a uniform grid, plus circle push-out,
// line-of-sight and 3D ray queries. Everything is allocation-free after boot.
const CELL = 16;
const OFF = 96;
const DIM = 64;
const MAXB = 6000;
const bx0 = new Float32Array(MAXB), bz0 = new Float32Array(MAXB), bx1 = new Float32Array(MAXB), bz1 = new Float32Array(MAXB), bh = new Float32Array(MAXB);
const stampOf = new Int32Array(MAXB);
const cells = [];
for (let i = 0; i < DIM * DIM; i++) cells.push([]);
let count = 0;
let stamp = 1;
const scratch = new Int32Array(512);
export const COL = { nx: 0, nz: 0, pen: 0, box: -1 };

const cellIdx = (v) => Math.min(DIM - 1, Math.max(0, Math.floor((v + OFF) / CELL)));

export function addBox(x0, z0, x1, z1, h) {
  const i = count++;
  bx0[i] = x0; bz0[i] = z0; bx1[i] = x1; bz1[i] = z1; bh[i] = h;
  for (let cz = cellIdx(z0); cz <= cellIdx(z1); cz++) for (let cx = cellIdx(x0); cx <= cellIdx(x1); cx++) cells[cz * DIM + cx].push(i);
  return i;
}
export const boxCount = () => count;
export const boxHeight = (i) => bh[i];

function gather(x, z, r) {
  stamp++;
  let n = 0;
  const cx0 = cellIdx(x - r), cx1 = cellIdx(x + r), cz0 = cellIdx(z - r), cz1 = cellIdx(z + r);
  for (let cz = cz0; cz <= cz1; cz++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const c = cells[cz * DIM + cx];
      for (let k = 0; k < c.length; k++) {
        const b = c[k];
        if (stampOf[b] !== stamp && n < 512) {
          stampOf[b] = stamp;
          scratch[n++] = b;
        }
      }
    }
  }
  return n;
}

// Push the circle (o.x, o.z, r) out of every box it overlaps. Returns the deepest penetration found (0 if none)
// and leaves the contact normal of that hit in COL.
export function pushOutCircle(o, r) {
  const n = gather(o.x, o.z, r + 1);
  let worst = 0;
  for (let k = 0; k < n; k++) {
    const b = scratch[k];
    const px = o.x < bx0[b] ? bx0[b] : o.x > bx1[b] ? bx1[b] : o.x;
    const pz = o.z < bz0[b] ? bz0[b] : o.z > bz1[b] ? bz1[b] : o.z;
    let dx = o.x - px, dz = o.z - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    let nx, nz, pen;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      nx = dx / d; nz = dz / d; pen = r - d;
    } else {
      const l = o.x - bx0[b], rr = bx1[b] - o.x, t = o.z - bz0[b], bt = bz1[b] - o.z;
      const m = Math.min(l, rr, t, bt);
      if (m === l) { nx = -1; nz = 0; } else if (m === rr) { nx = 1; nz = 0; } else if (m === t) { nx = 0; nz = -1; } else { nx = 0; nz = 1; }
      pen = m + r;
    }
    o.x += nx * pen;
    o.z += nz * pen;
    if (pen > worst) { worst = pen; COL.nx = nx; COL.nz = nz; COL.pen = pen; COL.box = b; }
  }
  return worst;
}

export function pointBlockedAt(x, z, y) {
  const n = gather(x, z, 0.1);
  for (let k = 0; k < n; k++) {
    const b = scratch[k];
    if (x >= bx0[b] && x <= bx1[b] && z >= bz0[b] && z <= bz1[b] && y < bh[b]) return b;
  }
  return -1;
}

// True when a wall stands between two ground points (used for police line of sight and camera pull-in).
export function segmentBlocked(ax, az, bx, bz, y) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.sqrt(dx * dx + dz * dz);
  const steps = Math.ceil(len / 2.5);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointBlockedAt(ax + dx * t, az + dz * t, y) >= 0) return true;
  }
  return false;
}

// March a 3D ray; returns distance to the first solid surface within maxT, or maxT when it flies free.
export function rayWorld(ox, oy, oz, dx, dy, dz, maxT) {
  const step = 0.8;
  for (let t = step; t < maxT; t += step) {
    const y = oy + dy * t;
    if (y < 0) return t - step + step * (oy + dy * (t - step)) / Math.max(0.0001, (oy + dy * (t - step)) - y);
    if (pointBlockedAt(ox + dx * t, oz + dz * t, y) >= 0) return t;
  }
  return maxT;
}
