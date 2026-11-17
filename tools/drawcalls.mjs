// drawcalls.mjs - renders each deterministic shot scene once and prints renderer.info draw calls and triangles,
// plus the average frame time of 20 extra renders. Usage: node tools/drawcalls.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const probe = fileURLToPath(new URL('./probe.mjs', import.meta.url));
const expr = `const g = window.__game; const out = {};
  g.renderFrame(1/60);
  const i = g.renderer.info;
  out.calls = i.render.calls; out.tris = i.render.triangles; out.geoms = i.memory.geometries;
  const t0 = performance.now(); for (let k = 0; k < 20; k++) g.renderFrame(1/60);
  out.ms = +((performance.now() - t0) / 20).toFixed(1);
  return out;`;
for (const scene of ['cover', 'chase', 'hud', 'mission']) {
  const r = spawnSync('node', [probe, expr], { env: { ...process.env, PROBE_QUERY: '?shot=' + scene }, encoding: 'utf8' });
  const line = r.stdout.split('\n').find((l) => l.startsWith('{')) || ('NO RESULT ' + r.stdout + r.stderr);
  console.log(scene.padEnd(8), line);
}
