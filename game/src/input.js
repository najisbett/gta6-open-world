// input.js - keyboard and mouse state, sampled once per simulation step into the controls object K.
export const K = {
  fwd: 0, right: 0, sprint: false, jump: false, handbrake: false,
  fire: false, aim: false, brake: 0, throttle: 0, steer: 0,
};
const down = Object.create(null);
const pressedKeys = Object.create(null);
export const mouse = { dx: 0, dy: 0, left: false, right: false, wheel: 0, locked: false };

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    down[e.code] = true;
    pressedKeys[e.code] = true;
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => {
    down[e.code] = false;
  });
  addEventListener('blur', () => {
    for (const k in down) down[k] = false;
    mouse.left = mouse.right = false;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.left = true;
    if (e.button === 2) mouse.right = true;
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      mouse.dx += e.movementX;
      mouse.dy += e.movementY;
    }
  });
  addEventListener('wheel', (e) => {
    mouse.wheel += Math.sign(e.deltaY);
  });
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === canvas;
  });
}

export const isDown = (code) => down[code] === true;
export function consume(code) {
  if (pressedKeys[code]) {
    pressedKeys[code] = false;
    return true;
  }
  return false;
}
export function clearPressed() {
  for (const k in pressedKeys) pressedKeys[k] = false;
}

// Turn raw keys into per-step controls. Shot scripts may overwrite K afterwards.
export function sampleControls() {
  K.fwd = (isDown('KeyW') ? 1 : 0) - (isDown('KeyS') ? 1 : 0);
  K.right = (isDown('KeyD') ? 1 : 0) - (isDown('KeyA') ? 1 : 0);
  K.sprint = isDown('ShiftLeft') || isDown('ShiftRight');
  K.jump = isDown('Space');
  K.handbrake = isDown('Space');
  K.fire = mouse.left;
  K.aim = mouse.right;
  K.throttle = K.fwd > 0 ? K.fwd : 0;
  K.brake = K.fwd < 0 ? -K.fwd : 0;
  K.steer = K.right;
}
