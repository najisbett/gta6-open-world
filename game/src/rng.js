// rng.js - seedable random numbers (mulberry32) so shot mode and the city layout are deterministic.
let s = 123456789;
export function seed(n) {
  s = n >>> 0;
}
export function rand() {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function randRange(a, b) {
  return a + (b - a) * rand();
}
export function randInt(n) {
  return Math.floor(rand() * n);
}
export function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}
// An independent generator for world building, so the city never depends on play history.
export function makeRng(seedValue) {
  let a = seedValue >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
