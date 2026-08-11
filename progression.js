export const STARTING_PROFILE = Object.freeze({ level: 1, xp: 0, coins: 1000, wins: 0 });

const STAKE_UNLOCKS = [
  { level: 1, stake: 50 },
  { level: 2, stake: 100 },
  { level: 3, stake: 250 },
  { level: 5, stake: 500 },
  { level: 10, stake: 1000 },
];

export function xpNeeded(level) {
  return 100 + ((level - 1) * 50);
}

export function unlockedStakes(level, coins = Infinity) {
  return STAKE_UNLOCKS.filter((item) => item.level <= level && item.stake <= coins)
    .map((item) => item.stake);
}

export function applyRoundResult(profile, result, stake) {
  if (!['win', 'loss', 'draw'].includes(result)) throw new Error('Ungültiges Ergebnis');
  if (!unlockedStakes(profile.level, profile.coins).includes(stake)) throw new Error('Einsatz nicht verfügbar');

  const coinChange = result === 'win' ? stake : result === 'loss' ? -stake : 0;
  const earnedXp = result === 'win' ? 35 : result === 'loss' ? 15 : 20;
  let level = profile.level;
  let xp = profile.xp + earnedXp;
  while (xp >= xpNeeded(level)) {
    xp -= xpNeeded(level);
    level += 1;
  }
  const balance = Math.max(0, profile.coins + coinChange);
  const comebackBonus = balance < 50 ? 100 : 0;
  return {
    ...profile,
    level,
    xp,
    coins: balance + comebackBonus,
    wins: profile.wins + (result === 'win' ? 1 : 0),
    lastBonus: comebackBonus,
  };
}
