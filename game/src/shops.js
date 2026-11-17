// shops.js - the places you spend money: Brass Pelican Guns (weapons, ammo, armour), Quickshine Garage (respray that
// clears the heat, repairs, engine tuning) and the Gull Street Safehouse (save, store the car, sleep). Also detects
// when the player stands at one and offers the E prompt.
import { G, player, toast } from './state.js';
import { city } from './cityLayout.js';
import { pushMarker, KIND_SHOP } from './markers.js';
import { consume } from './input.js';
import { giveWeapon } from './combat.js';
import { clearWanted } from './wanted.js';
import { saveGame } from './save.js';
import { rankFor } from './progression.js';
import { removeVehicle } from './vehicles.js';
import { exitVehicle } from './player.js';
import { emit } from './events.js';
import { PAINTS } from './vehicleTypes.js';

export const SHOPS = [
  { id: 'guns', place: 'guns', title: 'BRASS PELICAN GUNS', color: 0xff7a2a, radius: 3 },
  { id: 'garage', place: 'garage', title: 'QUICKSHINE GARAGE', color: 0x38e8d0, radius: 8 },
  { id: 'safehouse', place: 'safehouse', title: 'GULL STREET SAFEHOUSE', color: 0xb693ff, radius: 4 },
];

const curCar = () => (player.veh >= 0 ? G.vehicles[player.veh] : null);
const rank = () => rankFor(player.xp).index;

// Each item: label, price, note, ok() -> '' or the reason it cannot be bought, buy()
export function shopItems(id) {
  if (id === 'guns') {
    const sm = G.weapons[2], sg = G.weapons[3];
    return [
      { label: 'Sidewinder ammo x30', price: 60, ok: () => '', buy: () => giveWeapon('pistol', 30) },
      sm.owned ? { label: 'Hornet SMG ammo x90', price: 160, ok: () => '', buy: () => giveWeapon('smg', 90) }
        : { label: 'Hornet SMG + 90 rounds', price: 700, ok: () => '', buy: () => giveWeapon('smg', 90) },
      sg.owned ? { label: 'Gavel shotgun shells x16', price: 140, ok: () => '', buy: () => giveWeapon('shotgun', 16) }
        : { label: 'Gavel 12ga + 16 shells', price: 950, ok: () => (rank() >= 2 ? '' : 'needs rank WHEELMAN'), buy: () => giveWeapon('shotgun', 16) },
      { label: 'Body armor', price: 300, ok: () => (player.armor >= 100 ? 'already full' : ''), buy: () => { player.armor = 100; } },
      { label: 'Medkit', price: 100, ok: () => (player.hp >= 100 ? 'already healthy' : ''), buy: () => { player.hp = 100; } },
    ];
  }
  if (id === 'garage') {
    const v = curCar();
    const need = () => (v ? '' : 'drive in with a car');
    return [
      { label: 'Respray + new plates (clears the heat)', price: 250, ok: need, buy: () => { v.paint = (v.paint + 1 + Math.floor(Math.random() * 8)) % PAINTS.length; clearWanted('Fresh paint - the cops lost you'); } },
      { label: 'Repair body', price: 100, ok: () => (!v ? need() : v.hp >= v.t.hp ? 'no damage' : ''), buy: () => { v.hp = v.t.hp; } },
      { label: v ? 'Engine tune ' + (v.tune + 1) + '/3' : 'Engine tune', price: 600, ok: () => (!v ? need() : v.tune >= 3 ? 'maxed' : ''), buy: () => { v.tune++; } },
    ];
  }
  const v = curCar();
  return [
    { label: 'Save game', price: 0, ok: () => '', buy: () => { saveGame(); toast('Game saved', 2); } },
    { label: 'Store this car in the garage', price: 0, ok: () => (v ? '' : 'drive in with a car'), buy: () => { G.garage = { type: v.type, paint: v.paint, tune: v.tune, saved: true }; exitVehicle(); removeVehicle(v); toast(v.t.name + ' stored', 2.5); } },
    { label: 'Sleep until morning (heal)', price: 0, ok: () => '', buy: () => { player.hp = 100; G.hour = 7; toast('Good morning, Port Halcyon', 2.5); } },
  ];
}

export function tryBuy(item) {
  const why = item.ok();
  if (why) { toast("Can't buy: " + why, 1.6); return false; }
  if (player.money < item.price) { toast('Not enough money', 1.6); return false; }
  player.money -= item.price;
  item.buy();
  emit('purchase');
  return true;
}

export function stepShops() {
  G.prompt = '';
  G.nearPlace = null;
  if (G.mode !== 'play') return;
  for (const s of SHOPS) {
    const p = city.places[s.place];
    pushMarker(p.x, p.z, s.color, KIND_SHOP, true);
    const d = Math.hypot(player.x - p.x, player.z - p.z);
    const reach = player.veh >= 0 ? s.radius + 2 : s.radius;
    if (d < reach) {
      G.nearPlace = s;
      G.prompt = '<b>E</b> ' + s.title;
      if (consume('KeyE')) emit('openShop', s.id);
    }
  }
  if (!G.nearPlace && G.nearVeh >= 0 && player.veh < 0) G.prompt = '<b>E</b> Enter vehicle';
  else if (!G.nearPlace && player.veh >= 0 && Math.abs(G.vehicles[player.veh].speed) < 14) G.prompt = '<b>E</b> Exit';
}
