import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRoundResult, claimDailyTask, openDailyCrate, recordDailyRound, STARTING_PROFILE, unlockedStakes, xpNeeded } from './progression.js';

test('new players start with only the 50 coin stake', () => {
  assert.deepEqual(unlockedStakes(1, 1000), [50]);
});

test('a win adds the stake and experience', () => {
  const profile = applyRoundResult(STARTING_PROFILE, 'win', 50);
  assert.equal(profile.coins, 1050);
  assert.equal(profile.xp, 35);
  assert.equal(profile.wins, 1);
});

test('experience carries into the next level', () => {
  const profile = applyRoundResult({ ...STARTING_PROFILE, xp: xpNeeded(1) - 10 }, 'win', 50);
  assert.equal(profile.level, 2);
  assert.equal(profile.xp, 25);
  assert.deepEqual(unlockedStakes(profile.level, profile.coins), [50, 100]);
});

test('a comeback bonus prevents an empty account', () => {
  const profile = applyRoundResult({ ...STARTING_PROFILE, coins: 50 }, 'loss', 50);
  assert.equal(profile.coins, 100);
  assert.equal(profile.lastBonus, 100);
});

test('consecutive wins build a streak and award a bonus', () => {
  const first = applyRoundResult({ ...STARTING_PROFILE }, 'win', 50);
  const second = applyRoundResult(first, 'win', 50);
  assert.equal(second.currentStreak, 2);
  assert.equal(second.bestStreak, 2);
  assert.equal(second.streakBonus, 10);
});

test('daily task can be claimed after its goal', () => {
  let profile = recordDailyRound(STARTING_PROFILE, 'win', 31, Date.UTC(2026, 7, 12));
  profile = claimDailyTask(profile, 'win1', Date.UTC(2026, 7, 12));
  assert.equal(profile.coins, 1100);
});

test('daily crate can only be opened once per 24 hours', () => {
  const first = openDailyCrate(STARTING_PROFILE, () => 0.9, 100000000);
  assert.equal(first.reward, 500);
  assert.equal(openDailyCrate(first.profile, () => 0.9, 100000001).reward, null);
});
