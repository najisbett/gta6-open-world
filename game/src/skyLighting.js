// skyLighting.js - the sky dome, sun, hemisphere light, fog and shadows, all driven by the in-game hour.
// Night turns on window glow, lamp heads and neon; rain greys the light.
import * as THREE from 'three';
import { clamp, smooth } from './mathUtil.js';
import { cityView } from './cityRender.js';
import { decor } from './streetDecor.js';
import { updateWet } from './weather.js';

// hour, sky top, horizon, sun colour, sun intensity, hemisphere sky, hemisphere ground, hemisphere intensity
const KEYS = [
  [0, 0x050818, 0x16213a, 0x6d86c9, 0.25, 0x1b2748, 0x0c0f18, 0.55],
  [5, 0x0c1530, 0x3a3f66, 0x8e8fc9, 0.3, 0x2a3358, 0x14161f, 0.5],
  [6.5, 0x3f6ea8, 0xf7b27a, 0xffb36b, 1.4, 0xa4b8dc, 0x7b6a5f, 1.0],
  [9, 0x2f7fd1, 0xa9d6f0, 0xffdca8, 2.8, 0xbfdcf8, 0xa8967a, 1.45],
  [13, 0x2878d6, 0x9fd3ee, 0xffe8c0, 3.1, 0xc4e0fa, 0xb0a084, 1.6],
  [17, 0x3279c9, 0xf3c48a, 0xffb878, 3.0, 0xd3d6ee, 0xb89878, 1.45],
  [19, 0x4a4f92, 0xff8a5c, 0xff8f5a, 1.6, 0xb09ac8, 0x7b6464, 1.0],
  [20.5, 0x141a44, 0x55467a, 0x8580c8, 0.45, 0x2f3764, 0x1a1a2a, 0.55],
  [24, 0x050818, 0x16213a, 0x6d86c9, 0.25, 0x1b2748, 0x0c0f18, 0.55],
];
const cA = new THREE.Color(), cB = new THREE.Color();
const out = { top: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), sunI: 0, hs: new THREE.Color(), hg: new THREE.Color(), hi: 0 };

function sample(hour) {
  let i = 0;
  while (i < KEYS.length - 2 && hour > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = clamp((hour - a[0]) / (b[0] - a[0]), 0, 1);
  const mix = (dst, ia) => { cA.setHex(a[ia]); cB.setHex(b[ia]); dst.copy(cA).lerp(cB, t); };
  mix(out.top, 1); mix(out.hor, 2); mix(out.sun, 3); mix(out.hs, 5); mix(out.hg, 6);
  out.sunI = a[4] + (b[4] - a[4]) * t;
  out.hi = a[7] + (b[7] - a[7]) * t;
}

const SKY_VS = 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const SKY_FS = `
varying vec3 vDir; uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night;
float hash(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 c = mix(hor, top, pow(h, 0.55));
  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
  c += sunCol * (pow(s, 600.0) * 3.0 + pow(s, 14.0) * 0.35);
  vec3 q = floor(vDir*180.0);
  c += vec3(step(0.9965, hash(q))) * night * smoothstep(0.05, 0.4, h);
  gl_FragColor = vec4(c, 1.0);
}`;

export const sky = { sunDir: new THREE.Vector3(), night: 0, hemi: null, sun: null, dome: null, fog: null, uniforms: null };

export function createSky(scene, renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  sky.uniforms = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, night: { value: 0 } };
  sky.dome = new THREE.Mesh(new THREE.SphereGeometry(1800, 24, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: sky.uniforms, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.dome.renderOrder = -10;
  scene.add(sky.dome);
  sky.hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 1);
  scene.add(sky.hemi);
  sky.sun = new THREE.DirectionalLight(0xffffff, 2);
  sky.sun.castShadow = true;
  sky.sun.shadow.mapSize.set(2048, 2048);
  const sc = sky.sun.shadow.camera;
  sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 10; sc.far = 500;
  sky.sun.shadow.bias = -0.0004; sky.sun.shadow.normalBias = 0.6;
  scene.add(sky.sun, sky.sun.target);
  sky.fog = new THREE.Fog(0xaadcf0, 90, 760);
  scene.fog = sky.fog;
}

// hour in 0..24, focus is where the shadow box centres, rain 0..1
export function updateSky(camera, hour, fx, fz, rain) {
  sample(hour);
  const grey = rain * 0.55;
  const az = (hour / 24) * Math.PI * 2 + 0.6;
  const elev = Math.max(0.12, Math.sin(((hour - 6) / 12) * Math.PI)) * 0.8;
  const day = hour > 6 && hour < 19;
  sky.sunDir.set(Math.cos(az) * 0.7, day ? elev : 0.55, Math.sin(az) * 0.7).normalize();
  sky.night = clamp(hour < 12 ? (6.2 - hour) / 1.8 : (hour - 19.2) / 1.6, 0, 1);
  const U = sky.uniforms;
  U.top.value.copy(out.top).lerp(cB.setHex(0x8a949c), grey);
  U.hor.value.copy(out.hor).lerp(cB.setHex(0x9aa4a8), grey);
  U.sunDir.value.copy(sky.sunDir);
  U.sunCol.value.copy(out.sun);
  U.night.value = sky.night * (1 - rain);
  sky.dome.position.copy(camera.position);
  sky.sun.color.copy(out.sun);
  sky.sun.intensity = out.sunI * 1.05 * (1 - grey * 0.8);
  const step = 6;
  sky.sun.target.position.set(Math.round(fx / step) * step, 0, Math.round(fz / step) * step);
  sky.sun.position.copy(sky.sun.target.position).addScaledVector(sky.sunDir, 220);
  sky.hemi.color.copy(out.hs); sky.hemi.groundColor.copy(out.hg); sky.hemi.intensity = out.hi * 1.05 * (1 + grey * 0.3);
  sky.fog.color.copy(out.hor).lerp(cB.setHex(0x9aa4a8), grey);
  sky.fog.far = 760 - rain * 380;
  const n = sky.night;
  cityView.buildingMat.emissiveIntensity = smooth(n) * 1.0 + rain * 0.1 * smooth(clamp((hour - 17) / 3, 0, 1));
  cityView.lampMat.color.setRGB(0.35 + n * 0.65, 0.35 + n * 0.55, 0.3 + n * 0.1);
  if (decor.neonMat) decor.neonMat.color.setRGB(0.82 + n * 0.18, 0.82 + n * 0.18, 0.82 + n * 0.18);
  cityView.signMat.color.setRGB(0.75 + n * 0.25, 0.75 + n * 0.25, 0.75 + n * 0.25);
  updateWet(rain, n, sky.fog.color);
  if (cityView.waterTex) { cityView.waterTex.offset.x = (hour * 60) % 1; cityView.water.material.color.copy(out.hor).lerp(cB.setHex(0x1aa3b8), 0.6); }
}
