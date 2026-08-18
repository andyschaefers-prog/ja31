export const STARTING_PROFILE = Object.freeze({
  level: 1, xp: 0, coins: 1000, wins: 0, currentStreak: 0, bestStreak: 0,
  playerName: 'JA-SPIELER',
  avatar: { face: '😎', hair: '🧢', outfit: '🖤', extra: '👑', flag: '🇩🇪' },
  stats: { games: 0, wins: 0, losses: 0, draws: 0, score31: 0, knocks: 0, coinsWon: 0 },
  achievements: [],
  unlockedDecks: ['classic'],
  unlockedTables: ['arena'],
  selectedDeck: 'classic',
  selectedTable: 'arena',
  settings: { sound: true, vibration: true },
});

export const ACHIEVEMENTS = [
  { id: 'first31', title: 'ERSTE 31', description: 'Erreiche genau 31 Punkte.', reward: 150, check: (s) => s.score31 >= 1 },
  { id: 'knock10', title: 'KLOPFKÖNIG', description: 'Klopfe zehnmal.', reward: 200, check: (s) => s.knocks >= 10 },
  { id: 'streak3', title: 'DREIFACH JA', description: 'Gewinne dreimal in Folge.', reward: 250, check: (s, p) => (p.bestStreak || 0) >= 3 },
  { id: 'games25', title: 'STAMMSPIELER', description: 'Spiele 25 Runden.', reward: 300, check: (s) => s.games >= 25 },
];

export const DECKS = [
  { id: 'classic', title: 'JA CLASSIC', unlock: 1 },
  { id: 'grunge', title: 'ROTES GRUNGE', unlock: 3 },
  { id: 'skull', title: 'TOTENKOPF', unlock: 6 },
  { id: 'legend', title: 'GOLDENE LEGENDE', unlock: 10 },
];

export const TABLES = [
  { id: 'arena', title: 'JA ARENA', unlock: 1 },
  { id: 'underground', title: 'UNDERGROUND', unlock: 4 },
  { id: 'crown', title: 'KRONENTISCH', unlock: 8 },
];

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

export const WHEEL_REWARDS = [0, 25, 50, 75, 100, 250, 500, 50];

export function spinDailyWheel(profile, random = Math.random, timestamp = Date.now()) {
  if (!canOpenDailyCrates(profile, timestamp)) return { profile, reward: null, index: null };
  const index = Math.min(WHEEL_REWARDS.length - 1, Math.floor(random() * WHEEL_REWARDS.length));
  const reward = WHEEL_REWARDS[index];
  return { profile: { ...profile, coins: profile.coins + reward, lastCrateAt: timestamp }, reward, index };
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
  const currentStreak = result === 'win' ? (profile.currentStreak || 0) + 1 : result === 'loss' ? 0 : (profile.currentStreak || 0);
  const streakBonus = result === 'win' && currentStreak > 1 ? Math.min(100, (currentStreak - 1) * 10) : 0;
  const stats = profile.stats || STARTING_PROFILE.stats;
  const nextStats = {
    ...stats,
    games: stats.games + 1,
    wins: stats.wins + (result === 'win' ? 1 : 0),
    losses: stats.losses + (result === 'loss' ? 1 : 0),
    draws: stats.draws + (result === 'draw' ? 1 : 0),
    coinsWon: stats.coinsWon + (result === 'win' ? stake : 0),
  };
  const unlockedDecks = DECKS.filter((item) => item.unlock <= level).map((item) => item.id);
  const unlockedTables = TABLES.filter((item) => item.unlock <= level).map((item) => item.id);
  return {
    ...profile,
    level,
    xp,
    coins: balance + comebackBonus + streakBonus,
    wins: profile.wins + (result === 'win' ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(profile.bestStreak || 0, currentStreak),
    streakBonus,
    lastBonus: comebackBonus,
    stats: nextStats,
    unlockedDecks,
    unlockedTables,
  };
}

export function recordBattleEvent(profile, event) {
  const stats = profile.stats || STARTING_PROFILE.stats;
  const nextStats = {
    ...stats,
    score31: stats.score31 + (event === 'score31' ? 1 : 0),
    knocks: stats.knocks + (event === 'knock' ? 1 : 0),
  };
  const owned = profile.achievements || [];
  const newlyUnlocked = ACHIEVEMENTS.filter((item) => !owned.includes(item.id) && item.check(nextStats, profile));
  return {
    ...profile,
    stats: nextStats,
    achievements: [...owned, ...newlyUnlocked.map((item) => item.id)],
    coins: profile.coins + newlyUnlocked.reduce((sum, item) => sum + item.reward, 0),
    lastAchievements: newlyUnlocked.map((item) => item.id),
  };
}
