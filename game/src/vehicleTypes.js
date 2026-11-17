// vehicleTypes.js - the car catalogue of Port Halcyon: invented models with handling numbers and body dimensions.
export const PAINTS = [0xd94f3d, 0x2d7fc4, 0xf2c14e, 0xf4f1e8, 0x2f2f36, 0x3fa37a, 0xe8794a, 0x8e5bd0, 0xb9c2c9, 0xe0488e];

// accel m/s^2, top speed m/s, grip = lateral damping per second, steer = max steer angle (rad), hp = health
export const VTYPES = {
  marlin: { name: 'Marlin Sedan', len: 4.6, wid: 1.9, accel: 14, top: 34, grip: 7.5, steer: 0.55, hp: 100, mass: 1.0, h: 1.35 },
  vesper: { name: 'Vesper GT', len: 4.4, wid: 1.95, accel: 24, top: 52, grip: 6.0, steer: 0.5, hp: 90, mass: 0.9, h: 1.2 },
  dune: { name: 'Dune SUV', len: 4.9, wid: 2.05, accel: 15, top: 36, grip: 6.6, steer: 0.5, hp: 140, mass: 1.5, h: 1.8 },
  hauler: { name: 'Hauler Van', len: 5.3, wid: 2.1, accel: 11, top: 30, grip: 6.2, steer: 0.48, hp: 150, mass: 1.7, h: 2.3 },
  taxi: { name: 'Sunbird Cab', len: 4.6, wid: 1.9, accel: 14, top: 35, grip: 7.5, steer: 0.55, hp: 100, mass: 1.0, h: 1.4 },
  kestrel: { name: 'Kestrel Cruiser', len: 4.8, wid: 1.95, accel: 21, top: 47, grip: 7.0, steer: 0.52, hp: 130, mass: 1.3, h: 1.4 },
};
export const TRAFFIC_TYPES = ['marlin', 'marlin', 'marlin', 'dune', 'hauler', 'taxi', 'vesper'];
export const TYPE_ORDER = ['marlin', 'vesper', 'dune', 'hauler', 'taxi', 'kestrel'];
