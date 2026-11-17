// activities.js - optional side content: the Coastal Dash street race (timed checkpoints along the boardwalk and
// back streets). Drive into the blue ring in any car to start; beat the clock for cash and a saved best time.
import { G, player, toast } from './state.js';
import { RACE } from './missionData.js';
import { pushMarker, KIND_GOAL, KIND_SHOP } from './markers.js';
import { emit } from './events.js';
import { missionActive } from './missions.js';

const R = G.race;
let pts = null;

export function stepActivities(dt) {
  if (G.mode !== 'play') return;
  if (!pts) pts = RACE.pts();
  if (!R.active) {
    if (missionActive()) return;
    const s = RACE.start();
    pushMarker(s.x, s.z, 0x4aa8ff, KIND_SHOP, true);
    if (player.veh >= 0 && Math.hypot(player.x - s.x, player.z - s.z) < 7 && G.wanted.level === 0) {
      R.active = true; R.cp = 1; R.time = RACE.time;
      toast('COASTAL DASH - GO!', 2.5);
      emit('raceStart');
    }
    return;
  }
  R.time -= dt;
  const p = pts[R.cp];
  pushMarker(p.x, p.z, 0x4aa8ff, KIND_GOAL, true);
  if (R.cp + 1 < pts.length) pushMarker(pts[R.cp + 1].x, pts[R.cp + 1].z, 0x7b8794, KIND_GOAL, false);
  G.objective.title = RACE.name; G.objective.text = 'Checkpoint ' + R.cp + '/' + (pts.length - 1);
  G.objective.timer = Math.max(0, Math.ceil(R.time)) + 's';
  if (player.veh < 0 || R.time <= 0) { endRace(false); return; }
  if (Math.hypot(player.x - p.x, player.z - p.z) < 9) {
    R.cp++; emit('pickup');
    if (R.cp >= pts.length) endRace(true);
  }
}

function endRace(won) {
  const used = RACE.time - R.time;
  R.active = false;
  G.objective.title = ''; G.objective.text = ''; G.objective.timer = '';
  if (won) {
    const best = R.best === 0 || used < R.best;
    if (best) R.best = used;
    player.money += RACE.reward; player.xp += 150;
    toast('RACE WON ' + used.toFixed(1) + 's  +$' + RACE.reward + (best ? '  NEW BEST' : ''), 4);
    emit('missionPassed');
  } else toast(player.veh < 0 ? 'Race abandoned' : 'Out of time', 2.5);
}
