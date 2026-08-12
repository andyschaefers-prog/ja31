const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['7', '8', '9', '10', 'B', 'D', 'K', 'A'];

export function createDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({
    id: `${suit}-${rank}`,
    suit,
    rank,
    value: rank === 'A' ? 11 : ['B', 'D', 'K'].includes(rank) ? 10 : Number(rank),
  })));
}

export function shuffle(cards, random = Math.random) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function scoreHand(hand) {
  if (hand.length !== 3) return 0;
  if (hand.every((card) => card.rank === hand[0].rank)) return 30.5;
  return Math.max(...SUITS.map((suit) => hand
    .filter((card) => card.suit === suit)
    .reduce((sum, card) => sum + card.value, 0)));
}

export function dealRound(random = Math.random) {
  const deck = shuffle(createDeck(), random);
  return {
    player: deck.splice(0, 3),
    bot: deck.splice(0, 3),
    middle: deck.splice(0, 3),
    deck,
  };
}

export function dealLocalRound(playerCount, random = Math.random) {
  if (playerCount < 2 || playerCount > 4) throw new Error('Es sind 2 bis 4 Spieler erlaubt');
  const deck = shuffle(createDeck(), random);
  const hands = Array.from({ length: playerCount }, () => deck.splice(0, 3));
  return { hands, middle: deck.splice(0, 3), deck };
}

export function localRoundResult(hands) {
  const scores = hands.map(scoreHand);
  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);
  return {
    scores,
    winners: scores.map((score, index) => score === highest ? index : -1).filter((index) => index >= 0),
    losers: highest === lowest ? [] : scores.map((score, index) => score === lowest ? index : -1).filter((index) => index >= 0),
  };
}

export function swapOne(hand, middle, handIndex, middleIndex) {
  const nextHand = [...hand];
  const nextMiddle = [...middle];
  [nextHand[handIndex], nextMiddle[middleIndex]] = [nextMiddle[middleIndex], nextHand[handIndex]];
  return { hand: nextHand, middle: nextMiddle };
}

export function bestBotMove(hand, middle) {
  let best = { type: 'pass', hand, middle, score: scoreHand(hand) };
  const allScore = scoreHand(middle);
  if (allScore > best.score) best = { type: 'all', hand: middle, middle: hand, score: allScore };

  hand.forEach((_, handIndex) => middle.forEach((__, middleIndex) => {
    const move = swapOne(hand, middle, handIndex, middleIndex);
    const score = scoreHand(move.hand);
    if (score > best.score) best = { type: 'one', ...move, score };
  }));
  return best;
}

export function shouldBotKnock(hand, botTurns = 0) {
  const score = scoreHand(hand);
  if (score >= 31) return true;
  if (score >= 29 && botTurns >= 1) return true;
  if (score >= 27 && botTurns >= 3) return true;
  return botTurns >= 6;
}

export function loserFromScores(playerScore, botScore) {
  if (playerScore === botScore) return 'draw';
  return playerScore < botScore ? 'player' : 'bot';
}
