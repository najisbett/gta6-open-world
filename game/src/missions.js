// missions.js - mission state machine (placeholder for stage A: only publishes the first mission's start marker).
import { city } from './cityLayout.js';
import { clearMarkers, pushMarker, KIND_MISSION } from './markers.js';

export function stepMissions() {
  clearMarkers();
  const d = city.places.diner;
  pushMarker(d.x, d.z, 0xffd24a, KIND_MISSION, true);
}
