// events.js - a tiny publish/subscribe hub so low-level systems (vehicles) can announce things (explosions, crashes,
// crimes) without importing the systems that react to them.
const handlers = Object.create(null);
export function on(name, fn) {
  (handlers[name] || (handlers[name] = [])).push(fn);
}
export function emit(name, a, b, c, d) {
  const list = handlers[name];
  if (!list) return;
  for (let i = 0; i < list.length; i++) list[i](a, b, c, d);
}
