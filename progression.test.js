import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRoundResult, STARTING_PROFILE, unlockedStakes, xpNeeded } from './progression.js';

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
