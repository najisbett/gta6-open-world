// progression.js - street reputation: XP from crimes, kills and missions maps to a rank title that gates the shop.
export const RANKS = [
  { name: 'NEWCOMER', xp: 0 }, { name: 'RUNNER', xp: 100 }, { name: 'WHEELMAN', xp: 400 }, { name: 'ENFORCER', xp: 1000 }, { name: 'FIXER', xp: 2200 }, { name: 'LEGEND', xp: 4500 },
];
export function rankFor(xp) {
  let r = RANKS[0], idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) { r = RANKS[i]; idx = i; }
  return { name: r.name, index: idx, next: RANKS[Math.min(idx + 1, RANKS.length - 1)].xp };
}
