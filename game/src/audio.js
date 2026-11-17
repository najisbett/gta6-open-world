// audio.js - all sound is synthesised with WebAudio at run time (no audio files): engine drone, tyre squeal, police
// siren, rain, gunshots, impacts, explosions, UI chimes and a looping synthwave radio track.
import { G, player, AI_POLICE } from './state.js';
import { on } from './events.js';

let ctx = null, master = null, musicGain = null, sfxGain = null;
let eng = null, skid = null, siren = null, rainSrc = null, noiseBuf = null;
let musicOn = true, nextBeat = 0, beat = 0;

const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // engine
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
  o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = 500; g.gain.value = 0;
  o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(sfxGain); o1.start(); o2.start();
  eng = { o1, o2, lp, g };
  // tyre squeal and rain: filtered noise loops
  skid = loopNoise('bandpass', 1900, 0.0); rainSrc = loopNoise('highpass', 3500, 0.0);
  // siren
  const so = ctx.createOscillator(), sg = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  so.type = 'triangle'; so.frequency.value = 800; lfo.frequency.value = 0.9; lg.gain.value = 170; sg.gain.value = 0;
  lfo.connect(lg); lg.connect(so.frequency); so.connect(sg); sg.connect(sfxGain); so.start(); lfo.start();
  siren = { sg };
  nextBeat = ctx.currentTime + 0.1;
  setInterval(scheduleMusic, 30);
}

function loopNoise(type, freq, gain) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 2;
  const g = ctx.createGain(); g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(sfxGain); s.start();
  return g;
}

function tone(freq, dur, type, vol, slideTo, when, dest) {
  if (!ctx) return;
  const t = when || ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(dest || sfxGain); o.start(t); o.stop(t + dur + 0.02);
}

function burst(dur, freq, vol, type, when, dest) {
  if (!ctx) return;
  const t = when || ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || sfxGain); s.start(t, Math.random()); s.stop(t + dur + 0.02);
}

function scheduleMusic() {
  if (!ctx || !musicOn || ctx.state !== 'running') { if (ctx) nextBeat = Math.max(nextBeat, ctx.currentTime); return; }
  const spb = 60 / 104 / 2; // eighth notes
  while (nextBeat < ctx.currentTime + 0.25) {
    const step = beat % 8, bar = Math.floor(beat / 16) % 4, ch = CHORDS[bar];
    if (beat % 4 === 0) { tone(110, 0.16, 'sine', 0.55, 45, nextBeat, musicGain); }
    if (beat % 2 === 1) burst(0.04, 9000, 0.14, 'highpass', nextBeat, musicGain);
    if (beat % 8 === 4) burst(0.16, 2400, 0.28, 'bandpass', nextBeat, musicGain);
    const bassNote = ch[0] - 24 + (step === 3 || step === 6 ? 7 : 0);
    tone(mtof(bassNote), spb * 0.95, 'sawtooth', 0.2, null, nextBeat, musicGain);
    const arp = ch[(step * 3 + bar) % 3] + 12 * (step % 2 ? 1 : 0);
    tone(mtof(arp), spb * 0.8, 'square', 0.06, null, nextBeat, musicGain);
    if (step === 0) for (const n of ch) tone(mtof(n), spb * 7.6, 'triangle', 0.05, null, nextBeat, musicGain);
    nextBeat += spb; beat++;
  }
}

export function setMusic(on) {
  musicOn = on;
  if (musicGain) musicGain.gain.value = on ? 0.16 : 0;
}
export const musicEnabled = () => musicOn;

// per-frame: engine pitch, squeal, siren distance and rain
export function updateAudio() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const inCar = player.veh >= 0 && G.mode === 'play';
  if (inCar) {
    const v = G.vehicles[player.veh];
    const sp = Math.abs(v.speed), top = v.t.top;
    const gear = Math.min(4, Math.floor(sp / (top / 5)));
    const rpm = (sp - gear * (top / 5)) / (top / 5);
    const f = 48 + rpm * 70 + gear * 14 + v.throttle * 14;
    eng.o1.frequency.setTargetAtTime(f, t, 0.05); eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    eng.lp.frequency.setTargetAtTime(380 + sp * 18 + v.throttle * 250, t, 0.08);
    eng.g.gain.setTargetAtTime(0.1 + v.throttle * 0.05, t, 0.1);
    skid.gain.setTargetAtTime(v.slip > 3.2 && sp > 5 ? Math.min(0.18, v.slip * 0.018) : 0, t, 0.05);
  } else { eng.g.gain.setTargetAtTime(0, t, 0.1); skid.gain.setTargetAtTime(0, t, 0.05); }
  let near = 9999;
  for (const v of G.vehicles) if (v.active && v.ai === AI_POLICE && !v.wreck) { const d = Math.hypot(v.x - player.x, v.z - player.z); if (d < near) near = d; }
  siren.sg.gain.setTargetAtTime(near < 140 ? 0.05 * (1 - near / 140) : 0, t, 0.1);
  rainSrc.gain.setTargetAtTime(G.rain * 0.05, t, 0.5);
}

export function sfx(name) {
  if (!ctx) return;
  if (name === 'pistol') { burst(0.12, 3200, 0.5, 'lowpass'); tone(260, 0.1, 'square', 0.25, 70); }
  else if (name === 'smg') { burst(0.08, 3600, 0.4, 'lowpass'); tone(300, 0.06, 'square', 0.15, 90); }
  else if (name === 'shotgun') { burst(0.35, 1800, 0.8, 'lowpass'); tone(120, 0.3, 'sawtooth', 0.35, 40); }
  else if (name === 'punch') { burst(0.1, 600, 0.5, 'lowpass'); tone(110, 0.1, 'sine', 0.4, 50); }
  else if (name === 'crash') { burst(0.35, 1200, 0.7, 'lowpass'); tone(90, 0.3, 'sawtooth', 0.3, 40); }
  else if (name === 'explosion') { burst(1.4, 600, 1.0, 'lowpass'); tone(70, 1.1, 'sawtooth', 0.6, 28); }
  else if (name === 'pickup') { tone(880, 0.1, 'triangle', 0.3); tone(1320, 0.16, 'triangle', 0.3, null, ctx.currentTime + 0.08); }
  else if (name === 'pass') { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, 'triangle', 0.3, null, ctx.currentTime + i * 0.11)); }
  else if (name === 'fail') { [330, 262, 196].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.2, null, ctx.currentTime + i * 0.2)); }
  else if (name === 'hurt') { burst(0.12, 900, 0.4, 'lowpass'); tone(180, 0.15, 'square', 0.15, 90); }
  else if (name === 'ui') tone(660, 0.06, 'square', 0.12);
  else if (name === 'buy') { tone(1000, 0.07, 'square', 0.15); tone(1500, 0.1, 'square', 0.15, null, ctx.currentTime + 0.06); }
}

export function bindAudioEvents() {
  on('gunshot', (x, z, snd) => { const d = Math.hypot(x - player.x, z - player.z); if (d < 70) sfx(snd); });
  on('crash', () => sfx('crash'));
  on('carCrash', () => sfx('crash'));
  on('explosion', () => sfx('explosion'));
  on('pickup', () => sfx('pickup'));
  on('missionPassed', () => sfx('pass'));
  on('missionFailed', () => sfx('fail'));
  on('playerHurt', () => sfx('hurt'));
  on('punch', () => sfx('punch'));
  on('purchase', () => sfx('buy'));
}
