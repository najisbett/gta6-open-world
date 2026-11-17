// probe.mjs - opens the normal game page (no shot) in headless Chrome and evaluates JS snippets in it, printing the
// JSON results and any console errors: a scripted play-test. Usage: node tools/probe.mjs 'expr1' 'expr2' ...
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const CHROME = process.env.CHROME || '/root/.hermes/tools/chromium-1208/chrome-linux64/chrome';
const exprs = process.argv.slice(2);
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const httpPort = await freePort(), dbgPort = await freePort();
const server = spawn('node', [join(root, 'serve.ts'), '--port', String(httpPort)], { stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', `--remote-debugging-port=${dbgPort}`, '--window-size=1280,800', '--user-data-dir=/tmp/probeprofile-' + dbgPort, 'about:blank'], { stdio: 'ignore' });
let targets;
for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${dbgPort}/json`)).json(); if (targets.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  else if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'log'].includes(d.params.type)) logs.push(d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
  else if (d.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
});
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${httpPort}/index.html${process.env.PROBE_QUERY || ''}` });
for (let i = 0; i < 80; i++) { const r = await send('Runtime.evaluate', { expression: '!!window.__game || !!window.__shotReady', returnByValue: true }); if (r.result.result.value) break; await sleep(250); }
for (const e of exprs) {
  if (e.startsWith('shot:')) { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); writeFileSync(e.slice(5), Buffer.from(r.result.data, 'base64')); console.log('shot', e.slice(5)); continue; }
  const r = await send('Runtime.evaluate', { expression: `(async()=>{ ${e} })()`, awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(r.result.result.value ?? r.result.exceptionDetails ?? r.result));
}
for (const l of logs.slice(0, 25)) console.log(l);
ws.close(); chrome.kill(); server.kill(); process.exit(0);
