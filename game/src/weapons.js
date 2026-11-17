// weapons.js - the arsenal table: damage, fire rate, spread, pellets and shop prices for each original weapon.
export const WEAPONS = {
  fists: { name: 'Fists', dmg: 14, rate: 0.42, spread: 0, pellets: 1, range: 2.1, auto: false, price: 0, ammoPack: 0, snd: 'punch' },
  pistol: { name: 'Sidewinder .38', dmg: 28, rate: 0.28, spread: 0.012, pellets: 1, range: 90, auto: false, price: 0, ammoPack: 30, packPrice: 60, snd: 'pistol' },
  smg: { name: 'Hornet SMG', dmg: 15, rate: 0.085, spread: 0.045, pellets: 1, range: 80, auto: true, price: 700, ammoPack: 90, packPrice: 160, snd: 'smg' },
  shotgun: { name: 'Gavel 12ga', dmg: 13, rate: 0.85, spread: 0.1, pellets: 8, range: 45, auto: false, price: 950, ammoPack: 16, packPrice: 140, snd: 'shotgun' },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];
