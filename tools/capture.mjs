// capture.mjs - headless Chrome over CDP: serves game/, opens ?shot=<name> for each requested shot, waits for
// window.__shotReady, and saves a JPEG. Prints console errors. Usage: node tools/capture.mjs cover chase hud mission
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const CHROME = process.env.CHROME || '/root/.hermes/tools/chromium-1208/chrome-linux64/chrome';
const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const outDir = process.env.SHOT_DIR || join(root, 'screenshots');
const quality = Number(process.env.SHOT_QUALITY || 82);

function freePort() {
  return new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const httpPort = await freePort(), dbgPort = await freePort();
const server = spawn('node', [join(root, 'serve.ts'), '--port', String(httpPort)], { stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', `--remote-debugging-port=${dbgPort}`, '--window-size=1280,800', '--user-data-dir=/tmp/shotprofile-' + dbgPort, 'about:blank'], { stdio: 'ignore' });
let targets;
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${dbgPort}/json`)).json(); if (targets.length) break; } catch {}
  await sleep(250);
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  else if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) logs.push(d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
  else if (d.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
});
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
mkdirSync(outDir, { recursive: true });
let code = 0;
for (const name of names) {
  const [file, shot] = name.includes('=') ? name.split('=') : [name, name];
  await send('Page.navigate', { url: 'about:blank' }); await sleep(400);
  await send('Page.navigate', { url: `http://127.0.0.1:${httpPort}/index.html?shot=${shot}` });
  let ok = false;
  for (let i = 0; i < 240; i++) {
    const r = await send('Runtime.evaluate', { expression: 'JSON.stringify({r: !!window.__shotReady, e: window.__bootError || null})', returnByValue: true });
    const v = JSON.parse(r.result.result.value || '{}');
    if (v.e) { console.log('BOOT ERROR', v.e); break; }
    if (v.r) { ok = true; break; }
    await sleep(500);
  }
  if (!ok) { console.log('shot not ready:', shot); code = 1; continue; }
  await sleep(300);
  const shotData = await send('Page.captureScreenshot', { format: 'jpeg', quality });
  const path = join(outDir, file.endsWith('.jpg') ? file : file + '.jpg');
  writeFileSync(path, Buffer.from(shotData.result.data, 'base64'));
  console.log('wrote', path, Buffer.from(shotData.result.data, 'base64').length, 'bytes');
}
for (const l of logs.slice(0, 30)) console.log(l);
ws.close(); chrome.kill(); server.kill();
process.exit(code);
