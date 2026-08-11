import test from 'node:test';
import assert from 'node:assert/strict';
import { dealLocalRound, localRoundResult, scoreHand } from './gameEngine.js';
const c = (suit, rank, value) => ({ id: `${suit}-${rank}`, suit, rank, value });

test('31 is scored correctly', () => {
  assert.equal(scoreHand([c('♥','A',11), c('♥','K',10), c('♥','10',10)]), 31);
});

test('a triple scores 30.5', () => {
  assert.equal(scoreHand([c('♥','9',9), c('♣','9',9), c('♠','9',9)]), 30.5);
});

test('only the strongest suit counts', () => {
  assert.equal(scoreHand([c('♥','A',11), c('♥','7',7), c('♠','K',10)]), 18);
});

test('local mode deals three cards to 2 through 4 players', () => {
  const round = dealLocalRound(4, () => 0.5);
  assert.equal(round.hands.length, 4);
  assert.ok(round.hands.every((hand) => hand.length === 3));
  assert.equal(round.middle.length, 3);
});

test('all players with the lowest score lose the round', () => {
  const result = localRoundResult([
    [c('♥','A',11), c('♥','K',10), c('♥','10',10)],
    [c('♣','7',7), c('♦','8',8), c('♠','9',9)],
    [c('♥','7',7), c('♦','8',8), c('♣','9',9)],
  ]);
  assert.deepEqual(result.winners, [0]);
  assert.deepEqual(result.losers, [1, 2]);
});
