import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomCode, normalizeRoomCode, validPlayerName } from './onlineLobby.js';

test('room codes are six easy-to-read characters', () => {
  assert.match(createRoomCode(() => 0.2), /^[A-Z2-9]{6}$/);
});

test('room input is normalized', () => {
  assert.equal(normalizeRoomCode('ab-c 12!'), 'ABC2');
});

test('player names need 2 through 18 characters', () => {
  assert.equal(validPlayerName('A'), false);
  assert.equal(validPlayerName('Andy'), true);
});
