// meshBuilder.js - merges many coloured boxes and quads into one BufferGeometry (vertex colours, optional wall UVs),
// so a whole city or a whole car costs a single draw call.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _v = new THREE.Vector3();
const _c = new THREE.Color();
// face: normal, u axis, v axis (u x v = normal)
const FACES = [
  [1, 0, 0, 0, 1, 0, 0, 0, 1], [-1, 0, 0, 0, 0, 1, 0, 1, 0], [0, 1, 0, 0, 0, 1, 1, 0, 0],
  [0, -1, 0, 1, 0, 0, 0, 0, 1], [0, 0, 1, 1, 0, 0, 0, 1, 0], [0, 0, -1, 0, 1, 0, 1, 0, 0],
];

export class MeshBuilder {
  constructor() {
    this.pos = []; this.nor = []; this.col = []; this.uv = []; this.idx = [];
  }

  // o: { rx, ry, rz } euler rotation about the box centre; tile: wall texture tile size (world units) for UVs
  box(cx, cy, cz, sx, sy, sz, color, o) {
    _c.setHex(color);
    const rot = o && (o.rx || o.ry || o.rz);
    if (rot) { _e.set(o.rx || 0, o.ry || 0, o.rz || 0); _m.makeRotationFromEuler(_e); }
    const h = [sx / 2, sy / 2, sz / 2];
    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      const base = this.pos.length / 3;
      for (let k = 0; k < 4; k++) {
        const su = k === 0 || k === 3 ? -1 : 1, sv = k < 2 ? -1 : 1;
        let lx = F[0] * h[0] + F[3] * h[0] * su + F[6] * h[0] * sv;
        let ly = F[1] * h[1] + F[4] * h[1] * su + F[7] * h[1] * sv;
        let lz = F[2] * h[2] + F[5] * h[2] * su + F[8] * h[2] * sv;
        let nx = F[0], ny = F[1], nz = F[2];
        if (rot) {
          _v.set(lx, ly, lz).applyMatrix4(_m); lx = _v.x; ly = _v.y; lz = _v.z;
          _v.set(nx, ny, nz).applyMatrix4(_m); nx = _v.x; ny = _v.y; nz = _v.z;
        }
        const wx = cx + lx, wy = cy + ly, wz = cz + lz;
        this.pos.push(wx, wy, wz); this.nor.push(nx, ny, nz); this.col.push(_c.r, _c.g, _c.b);
        if (o && o.tile) {
          if (f === 2 || f === 3) this.uv.push(0.02, 0.02);
          else this.uv.push((f < 2 ? wz : wx) / o.tile, wy / o.tile);
        } else this.uv.push(0, 0);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  // A vertical quad facing (nx,nz), e.g. a sign; uv rectangle u0,v0,u1,v1 into an atlas.
  signQuad(cx, cy, cz, nx, nz, w, h, color, u0, v0, u1, v1) {
    _c.setHex(color);
    const rx = nz, rz = -nx;
    const base = this.pos.length / 3;
    const pts = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]];
    for (const p of pts) {
      this.pos.push(cx + rx * p[0] * w / 2, cy + p[1] * h / 2, cz + rz * p[0] * w / 2);
      this.nor.push(nx, 0, nz); this.col.push(_c.r, _c.g, _c.b); this.uv.push(p[2], p[3]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // A flat horizontal quad (x0,z0)-(x1,z1) at height y facing up; uvs stretched u0..u1 / v0..v1.
  floorQuad(x0, z0, x1, z1, y, color, u0, v0, u1, v1) {
    _c.setHex(color);
    const base = this.pos.length / 3;
    const pts = [[x0, z1, u0, v0], [x1, z1, u1, v0], [x1, z0, u1, v1], [x0, z0, u0, v1]];
    for (const p of pts) {
      this.pos.push(p[0], y, p[1]); this.nor.push(0, 1, 0); this.col.push(_c.r, _c.g, _c.b); this.uv.push(p[2], p[3]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx.length > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}
