// cameraRig.js - the third-person camera: mouse/arrow orbit on foot, over-the-shoulder zoom when aiming, a chase cam
// that follows the car's heading with speed FOV, wall pull-in, screen shake, and the slow orbit of the title screen.
import { G, player } from './state.js';
import { mouse, isDown } from './input.js';
import { pointBlockedAt } from './collision.js';
import { clamp, angleDiff, wrapAngle } from './mathUtil.js';

let aimBlend = 0;

function pullIn(tx, ty, tz, cx, cy, cz) {
  // shorten the arm so the camera never sits inside a wall
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    if (pointBlockedAt(tx + (cx - tx) * t, tz + (cz - tz) * t, ty + (cy - ty) * t) >= 0) return Math.max(0.12, t - 0.12);
  }
  return 1;
}

export function updateCamera(camera, dt) {
  const c = G.cam;
  if (G.mode === 'menu') {
    const a = G.t * 0.06;
    c.x = 384 + Math.cos(a) * 240; c.z = 330 + Math.sin(a) * 240; c.y = 70;
    camera.position.set(c.x, c.y, c.z); camera.fov = 60; camera.updateProjectionMatrix();
    camera.lookAt(384, 25, 330);
    return;
  }
  const inCar = player.veh >= 0;
  const v = inCar ? G.vehicles[player.veh] : null;
  const moved = mouse.dx !== 0 || mouse.dy !== 0;
  if (G.mode === 'play') {
    c.yaw -= mouse.dx * 0.0024; c.pitch += mouse.dy * 0.0021;
    if (isDown('ArrowLeft')) { c.yaw += 1.9 * dt; c.userT = 2; }
    if (isDown('ArrowRight')) { c.yaw -= 1.9 * dt; c.userT = 2; }
    if (isDown('ArrowUp')) c.pitch -= 1.2 * dt;
    if (isDown('ArrowDown')) c.pitch += 1.2 * dt;
    if (moved) c.userT = 2.2;
  }
  mouse.dx = 0; mouse.dy = 0;
  c.userT = Math.max(0, c.userT - dt);
  let dist, height, tx, ty, tz, fov;
  if (inCar) {
    if (c.userT <= 0) {
      // follow the heading, leaning toward the travel direction while sliding
      let want = v.h;
      if (Math.hypot(v.vx, v.vz) > 6) want = v.h + angleDiff(Math.atan2(v.vx, v.vz), v.h) * 0.45;
      c.yaw = wrapAngle(c.yaw + angleDiff(want, c.yaw) * (1 - Math.exp(-3.4 * dt)));
      c.pitch += (0.2 - c.pitch) * (1 - Math.exp(-2 * dt));
    }
    const sp = Math.abs(v.speed);
    dist = 7.6 + Math.min(3.5, sp * 0.08) + v.t.len * 0.15; height = 1.3;
    tx = v.x + Math.sin(v.h) * 2.2; ty = v.y + height; tz = v.z + Math.cos(v.h) * 2.2;
    fov = 63 + Math.min(16, sp * 0.3);
    aimBlend += (0 - aimBlend) * (1 - Math.exp(-8 * dt));
  } else {
    const want = player.aiming ? 1 : 0;
    aimBlend += (want - aimBlend) * (1 - Math.exp(-9 * dt));
    dist = 5.6 - aimBlend * 3.0; height = 1.62;
    tx = player.x + (-Math.cos(c.yaw)) * 0.75 * aimBlend; ty = player.y + height; tz = player.z + Math.sin(c.yaw) * 0.75 * aimBlend;
    fov = 66 - aimBlend * 12;
  }
  c.pitch = clamp(c.pitch, -0.2, 1.25);
  const cp = Math.cos(c.pitch), sp2 = Math.sin(c.pitch);
  const dx = -Math.sin(c.yaw) * cp, dz = -Math.cos(c.yaw) * cp, dy = sp2;
  let cx = tx + dx * dist, cy = ty + dy * dist, cz = tz + dz * dist;
  const k = pullIn(tx, ty, tz, cx, cy, cz);
  cx = tx + dx * dist * k; cy = ty + dy * dist * k; cz = tz + dz * dist * k;
  if (cy < 0.5) cy = 0.5;
  const shake = c.shake * c.shake;
  const sx = shake > 0.001 ? (Math.random() - 0.5) * shake * 0.5 : 0, sy = shake > 0.001 ? (Math.random() - 0.5) * shake * 0.4 : 0;
  c.x = cx; c.y = cy; c.z = cz; c.lookX = tx; c.lookY = ty; c.lookZ = tz;
  camera.position.set(cx + sx, cy + sy, cz + sx);
  camera.lookAt(tx, ty, tz);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-6 * dt)); camera.updateProjectionMatrix(); }
}

export function snapCameraFov(camera, fov) {
  camera.fov = fov; camera.updateProjectionMatrix();
}
