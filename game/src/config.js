// config.js - fixed numbers shared by every system of Salt & Neon (grid size, road widths, pool sizes).
export const C = 64; // grid cell pitch: distance between road centre lines
export const HALF_ROAD = 8; // road half width
export const N = 12; // cells per side
export const WORLD = C * N; // 768 world units square
export const SIDEWALK = 3;
export const KERB_H = 0.22;
export const STEP = 1 / 60; // fixed simulation step
export const LANE = 3.8; // lane centre offset from the road centre line
export const MAX_VEHICLES = 64;
export const MAX_HUMANS = 96;
export const GAME_TITLE = 'SALT & NEON';
export const CITY_NAME = 'Port Halcyon';
export const SAVE_KEY = 'saltAndNeon.save.v1';
export const DX = [1, 0, -1, 0]; // direction table: 0 +x, 1 +z, 2 -x, 3 -z
export const DZ = [0, 1, 0, -1];
