// markers.js - the shared list of map/world markers (mission goals, shops, pickups) rebuilt every step by the systems
// that own them, and read by both the minimap and the 3D beam renderer.
export const MAXM = 64;
export const markers = { n: 0, x: new Float32Array(MAXM), z: new Float32Array(MAXM), color: new Array(MAXM).fill('#fff'), hex: new Uint32Array(MAXM), kind: new Uint8Array(MAXM), beam: new Uint8Array(MAXM) };
export const KIND_GOAL = 0, KIND_SHOP = 1, KIND_PICKUP = 2, KIND_MISSION = 3, KIND_ENEMY = 4;

const hexCache = new Map();
// the single current mission objective; read by the 3D beacon (markerView) and the minimap arrow. Hidden when !active.
export const waypoint = { active: false, x: 0, z: 0, hex: 0xffd24a };
export function setWaypoint(x, z, hex) { waypoint.active = true; waypoint.x = x; waypoint.z = z; waypoint.hex = hex; }
export function clearMarkers() {
  markers.n = 0;
  waypoint.active = false;
}
export function pushMarker(x, z, hex, kind, beam) {
  if (markers.n >= MAXM) return;
  const i = markers.n++;
  markers.x[i] = x; markers.z[i] = z; markers.hex[i] = hex; markers.kind[i] = kind; markers.beam[i] = beam ? 1 : 0;
  let c = hexCache.get(hex);
  if (!c) { c = '#' + hex.toString(16).padStart(6, '0'); hexCache.set(hex, c); }
  markers.color[i] = c;
}
