// weather.js - deterministic weather and time-of-day extras. The rain schedule is a pure function of the simulation clock
// (a fixed-seed table, no Math.random / Date), so the same play time always gives the same sky. Also holds the
// `?shot=` presets that force a distinct phase of day and rain per screenshot, the DOM colour-grade overlay, and the
// wet-road shader patch (sky reflection plus neon smears that appear when it rains).
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { G } from './state.js';
import { clamp, smooth } from './mathUtil.js';

export const WEATHER_SEED = 20260;
const SEG = 150; // seconds of simulation time per weather segment
const NSEG = 96;
const TABLE = (() => {
  const r = makeRng(WEATHER_SEED), t = [];
  for (let i = 0; i < NSEG; i++) { const wet = r() < 0.38; const amt = 0.4 + r() * 0.6; t.push(i === 0 ? 0 : wet ? amt : 0); }
  return t;
})();

// rain intensity 0..1 at simulation time `clock` (seconds): eases in over the first fifth of each segment
export function rainAt(clock) {
  const k = Math.max(0, clock) / SEG, i = Math.floor(k), u = k - i;
  const a = TABLE[(i + NSEG - 1) % NSEG], b = TABLE[i % NSEG];
  return a + (b - a) * smooth(clamp(u / 0.2, 0, 1));
}

// Screenshot presets: each shot gets its own hour of day and rain so the four captures differ at a glance.
export const SHOT_WEATHER = {
  cover: { hour: 18.15, rain: 0 },    // golden hour, clear, low orange sun
  chase: { hour: 21.9, rain: 0.9 },   // night, heavy rain, wet neon road
  hud: { hour: 11.6, rain: 0 },       // bright late morning
  mission: { hour: 6.35, rain: 0.28 }, // pale dawn with a light drizzle
};
export function applyShotWeather(name) {
  const w = SHOT_WEATHER[name] || SHOT_WEATHER.cover;
  G.hour = w.hour; G.rain = w.rain; G.rainTarget = w.rain;
}

// advance the clock and the rain by one simulation step (not used while a ?shot= preset is active)
export function stepWeather(dt) {
  G.hour = (G.hour + dt / 36) % 24;
  G.rain = rainAt(G.t);
  G.rainTarget = G.rain;
}

// ---- colour grade: a fullscreen tint plus vignette over the canvas, below the HUD
// hour, r, g, b, alpha
const GRADE = [
  [0, 20, 35, 90, 0.26], [5, 30, 45, 100, 0.2], [6.4, 255, 160, 110, 0.15], [8, 255, 215, 170, 0.05], [12, 255, 255, 255, 0],
  [16, 255, 228, 175, 0.04], [17.6, 255, 170, 70, 0.17], [19, 255, 105, 70, 0.17], [20.6, 40, 50, 130, 0.22], [24, 20, 35, 90, 0.26],
];
let gradeEl = null, lastGrade = '';
export function initGrade() {
  gradeEl = document.createElement('div');
  gradeEl.id = 'grade';
  document.body.insertBefore(gradeEl, document.getElementById('hud'));
}
export function updateGrade(hour, rain) {
  if (!gradeEl) return;
  let i = 0;
  while (i < GRADE.length - 2 && hour > GRADE[i + 1][0]) i++;
  const a = GRADE[i], b = GRADE[i + 1], t = clamp((hour - a[0]) / (b[0] - a[0]), 0, 1);
  const m = (k) => a[k] + (b[k] - a[k]) * t;
  const w = rain * 0.45;
  const r = Math.round(m(1) * (1 - w) + 70 * w), g = Math.round(m(2) * (1 - w) + 92 * w), bl = Math.round(m(3) * (1 - w) + 112 * w);
  const al = (m(4) + rain * 0.12).toFixed(3), vig = (0.22 + rain * 0.16 + (1 - clamp(Math.abs(hour - 12) / 7, 0, 1)) * -0.06).toFixed(3);
  const css = `radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 52%, rgba(6,10,24,${vig}) 100%), rgba(${r},${g},${bl},${al})`;
  if (css !== lastGrade) { lastGrade = css; gradeEl.style.background = css; }
}

// ---- wet roads: MeshPhongMaterial patched with a sky/neon reflection term driven by shared uniforms
export const wetU = { uWet: { value: 0 }, uSky: { value: new THREE.Color(0x8899aa) }, uNight: { value: 0 } };
const wetMats = [];
const NOISE = `
varying vec3 vWPos; uniform float uWet; uniform vec3 uSky; uniform float uNight;
float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1.0, 0.0)), f.x), mix(wh(i + vec2(0.0, 1.0)), wh(i + vec2(1.0, 1.0)), f.x), f.y); }`;
export function makeWetRoad(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, wetU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>' + NOISE)
      .replace('#include <opaque_fragment>', `
      {
        float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.5);
        float pud = smoothstep(0.38, 0.62, wn(vWPos.xz * 0.11) * 0.7 + wn(vWPos.xz * 0.37) * 0.3);
        float m = uWet * (0.4 + 0.6 * pud);
        outgoingLight += uSky * m * (0.1 + 0.9 * fres) * 0.9;
        float sx = wn(vec2(vWPos.x * 0.55, vWPos.z * 0.045)), sz = wn(vec2(vWPos.x * 0.045, vWPos.z * 0.55));
        float s = smoothstep(0.62, 0.92, max(sx, sz));
        vec3 neon = mix(vec3(1.0, 0.18, 0.5), vec3(0.1, 0.8, 1.0), step(0.5, wn(floor(vWPos.xz * 0.05) + 3.7)));
        outgoingLight += neon * s * m * uNight * (0.25 + 0.75 * fres) * 1.3;
      }
      #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'wetroad';
  wetMats.push(mat);
  return mat;
}

// per frame: wetness follows rain; roads darken and turn glossy
export function updateWet(rain, night, horizon) {
  const wet = clamp(rain * 3, 0, 1);
  wetU.uWet.value = wet; wetU.uNight.value = night; wetU.uSky.value.copy(horizon);
  for (const m of wetMats) {
    m.color.setScalar(1 - 0.4 * wet);
    m.shininess = 14 + wet * 90;
    m.specular.setScalar(0.08 + wet * 0.55);
  }
}
