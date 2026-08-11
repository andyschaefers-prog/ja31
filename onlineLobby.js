const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createRoomCode(random = Math.random) {
  return Array.from({ length: 6 }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join('');
}

export function normalizeRoomCode(value = '') {
  return value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

export function validPlayerName(value = '') {
  const name = value.trim();
  return name.length >= 2 && name.length <= 18;
}
