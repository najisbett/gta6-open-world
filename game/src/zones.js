// zones.js - names the neighbourhood under a world point for the HUD place label.
import { C, N } from './config.js';
import { districtOf } from './cityLayout.js';

const NAMES = {
  downtown: 'Meridian Heights', mid: 'Coral Mile', resid: 'Palmetto Flats', industrial: 'Saltworks Yard', port: 'Harbor Nine', beach: 'Tideline Boardwalk', park: 'Marisol Park',
};
export function districtName(x, z) {
  const bi = Math.floor(x / C), bj = Math.floor(z / C);
  if (bi < 0 || bj < 0 || bi >= N || bj >= N) return z > 768 ? 'Tideline Pier' : 'City Limits';
  return NAMES[districtOf(bi, bj)];
}
