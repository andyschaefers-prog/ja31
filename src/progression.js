export const STARTING_PROFILE = Object.freeze({
  level: 1, xp: 0, coins: 1000, wins: 0,
  playerName: 'JA-SPIELER',
  avatar: { face: '😎', hair: '🧢', outfit: '🖤', extra: '👑', flag: '🇩🇪' },
});

export const DAILY_TASKS = [
  { id: 'play3', title: 'Spiele 3 Runden', goal: 3, reward: 75 },
  { id: 'win1', title: 'Gewinne eine Runde', goal: 1, reward: 100 },
  { id: 'score31', title: 'Erreiche genau 31', goal: 1, reward: 150 },
];

export function dayKey(timestamp = Date.now()) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function ensureDaily(profile, timestamp = Date.now()) {
  const today = dayKey(timestamp);
  if (profile.daily?.day === today) return profile;
  return { ...profile, daily: { day: today, played: 0, won: 0, score31: 0, claimed: [] } };
}

export function recordDailyRound(profile, result, playerScore, timestamp = Date.now()) {
  const current = ensureDaily(profile, timestamp);
  return { ...current, daily: {
    ...current.daily,
    played: current.daily.played + 1,
    won: current.daily.won + (result === 'win' ? 1 : 0),
    score31: current.daily.score31 + (playerScore === 31 ? 1 : 0),
  } };
}

export function claimDailyTask(profile, taskId, timestamp = Date.now()) {
  const current = ensureDaily(profile, timestamp);
  const task = DAILY_TASKS.find((item) => item.id === taskId);
  if (!task || current.daily.claimed.includes(taskId)) return current;
  const progress = taskId === 'play3' ? current.daily.played : taskId === 'win1' ? current.daily.won : current.daily.score31;
  if (progress < task.goal) return current;
  return { ...current, coins: current.coins + task.reward, daily: { ...current.daily, claimed: [...current.daily.claimed, taskId] } };
}

export function canOpenDailyCrates(profile, timestamp = Date.now()) {
  return !profile.lastCrateAt || timestamp - profile.lastCrateAt >= 24 * 60 * 60 * 1000;
}

export function openDailyCrate(profile, random = Math.random, timestamp = Date.now()) {
  if (!canOpenDailyCrates(profile, timestamp)) return { profile, reward: null };
  const rewards = [0, 50, 500];
  const reward = rewards[Math.floor(random() * rewards.length)];
  return { profile: { ...profile, coins: profile.coins + reward, lastCrateAt: timestamp }, reward };
}

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
