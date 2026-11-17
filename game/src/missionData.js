// missionData.js - the story of SALT & NEON as data: six missions in a chain, each a list of steps (talk, goto, steal,
// drive, kill, collect, lose-the-cops) with dialogue and rewards. The characters and places are our own invention.
import { city } from './cityLayout.js';
import { C } from './config.js';

const P = () => city.places;
const road = (i, j, dx = 0, dz = 0) => ({ x: i * C + dx, z: j * C + dz });

export const MISSIONS = [
  {
    id: 'welcome', title: 'Welcome to Halcyon', giver: () => P().diner, reward: 600, xp: 120,
    intro: [
      { who: 'Dessa Okoye', text: "You made the ferry. Good. I'm Dessa - I run errands for people who don't use banks." },
      { who: 'Juno Reyes', text: 'Juno. I need rent money and a reason to stay out of Ostrander County.' },
      { who: 'Dessa Okoye', text: "Then borrow the white Vesper two blocks east - it's registered to nobody - and drive it to Quickshine Garage. Don't scratch it." },
    ],
    steps: [
      { t: 'steal', text: 'Steal the white Vesper GT', at: () => P().carSpot, type: 'vesper', paint: 3, heading: 0 },
      { t: 'drive', text: 'Take the car to Quickshine Garage', at: () => P().garage, r: 7 },
    ],
    outro: [{ who: 'Dessa Okoye', text: 'Smooth. A new coat of paint and nobody will ever know it was ours. Come back to the diner.' }],
  },
  {
    id: 'envelopes', title: 'Envelope Season', giver: () => P().diner, reward: 900, xp: 160,
    intro: [
      { who: 'Dessa Okoye', text: 'Four shops owe the Pelicans a tithe. Collect the envelopes before the lunch rush ends.' },
      { who: 'Juno Reyes', text: 'Four stops, one car, a clock. Easy.' },
      { who: 'Dessa Okoye', text: "Cops hate envelopes, so keep the speedo honest. I won't bail you out." },
    ],
    steps: [
      { t: 'collect', text: 'Collect the envelopes', time: 150, pts: () => [road(7, 6, 0, 22), road(9, 8, 22, 0), road(4, 8, 0, -22), road(3, 5, -22, 0)], needCar: true },
    ],
    outro: [{ who: 'Dessa Okoye', text: 'Thin envelopes, fat tips. You have a future in logistics.' }],
  },
  {
    id: 'hotcargo', title: 'Hot Cargo', giver: () => P().diner, reward: 1400, xp: 220,
    intro: [
      { who: 'Dessa Okoye', text: "There's a refrigerated Hauler at Harbor Nine with something in the back that belongs to us." },
      { who: 'Juno Reyes', text: "Belongs to us how, exactly?" },
      { who: 'Dessa Okoye', text: "Ask fewer questions. The yard has an alarm. Take the van, shake the cops, then bring it to Warehouse Nine." },
    ],
    steps: [
      { t: 'steal', text: 'Steal the Hauler van at Harbor Nine', at: () => P().vanSpot, type: 'hauler', paint: 3, heading: 0, wanted: 2 },
      { t: 'lose', text: 'Lose the police - break line of sight', level: 2 },
      { t: 'drive', text: 'Deliver the van to Warehouse Nine', at: () => P().docks, r: 8 },
    ],
    outro: [{ who: 'Dessa Okoye', text: "Cold, quiet and intact. Ostrander will like that. He's the one who signs the checks." }],
  },
  {
    id: 'saltkings', title: "Salt Kings Don't Swim", giver: () => P().diner, reward: 2000, xp: 300, giveWeapon: ['smg', 90],
    intro: [
      { who: 'Dessa Okoye', text: 'The Salt Kings hit our courier. Their crew sits in the old salt yard in the north-west. Take this Hornet and clear it.' },
      { who: 'Juno Reyes', text: "Six of them, one of me. That's practically fair." },
    ],
    steps: [
      { t: 'goto', text: 'Go to the Salt Kings Yard', at: () => P().yard, r: 30, vehicleOk: true },
      { t: 'kill', text: 'Take out the Salt Kings', count: 6, around: () => P().yard },
    ],
    outro: [{ who: 'Dessa Okoye', text: 'That is how you answer a telegram. Rest. Tomorrow we visit the tower.' }],
  },
  {
    id: 'tower', title: 'Last Call at the Tower', giver: () => P().diner, reward: 4000, xp: 420,
    intro: [
      { who: 'Dessa Okoye', text: "Ostrander sold us out. He's in his tower with four guards and a lot of glass." },
      { who: 'Juno Reyes', text: 'Then we make some noise on the ground floor.' },
      { who: 'Dessa Okoye', text: "Clear the lobby. When the alarm goes you'll have a four-star welcome. Run for the pier." },
    ],
    steps: [
      { t: 'goto', text: 'Go to Ostrander Tower', at: () => P().tower, r: 26, vehicleOk: true },
      { t: 'kill', text: "Clear Ostrander's guards", count: 5, around: () => P().tower, wanted: 4 },
      { t: 'lose', text: 'Escape the police', level: 4 },
    ],
    outro: [{ who: 'Dessa Okoye', text: 'Quiet city tonight. Meet me where the road ends - Tideline Pier.' }],
  },
  {
    id: 'sunsetrun', title: 'Sunset Run', giver: () => P().diner, reward: 7500, xp: 600,
    intro: [
      { who: 'Dessa Okoye', text: 'One last drive. Pier at sunset. I told the ferry captain to wait for two.' },
    ],
    steps: [
      { t: 'drive', text: 'Drive to the end of Tideline Pier', at: () => P().pier, r: 8 },
      { t: 'talk', lines: [
        { who: 'Dessa Okoye', text: 'Port Halcyon looks different from the water. Quieter.' },
        { who: 'Juno Reyes', text: "Funny. From the dock it looks like a place you'd want to stay." },
        { who: 'Dessa Okoye', text: "Then stay. The city's yours, Juno - there are packages to find, races to win and cops to outrun." },
      ] },
    ],
    outro: [{ who: 'NARRATOR', text: 'STORY COMPLETE. The streets of Port Halcyon are yours - keep playing for packages, races and bigger heat.' }],
  },
];

export const RACE = {
  name: 'Coastal Dash', start: () => road(2, 11, 0, 0), time: 55, reward: 1200,
  pts: () => [road(2, 11), road(5, 11), road(8, 11), road(8, 8), road(5, 8), road(2, 8), road(2, 11, 0, -6)],
};
