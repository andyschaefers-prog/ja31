import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { bestBotMove, dealRound, loserFromScores, scoreHand, swapOne } from './src/gameEngine';
import { applyRoundResult, STARTING_PROFILE, unlockedStakes, xpNeeded } from './src/progression';
import LocalGame from './src/LocalGame';
import OnlineLobby from './src/OnlineLobby';

const RED = '#e31b23';

function Card({ card, selected, hidden, onPress }) {
  if (hidden) return <View style={[styles.card, styles.cardBack]}><Text style={styles.backJA}>JA</Text></View>;
  const red = card.suit === '♥' || card.suit === '♦';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.card, selected && styles.selectedCard]}>
      <Text style={[styles.cardText, red && styles.redCard]}>{card.rank}</Text>
      <Text style={[styles.suit, red && styles.redCard]}>{card.suit}</Text>
    </TouchableOpacity>
  );
}

function Lives({ count }) {
  return <Text style={styles.lives}>{'● '.repeat(count)}<Text style={styles.dead}>{'● '.repeat(3 - count)}</Text></Text>;
}

export default function App() {
  const [screen, setScreen] = useState('menu');
  const [round, setRound] = useState(() => dealRound());
  const [playerLives, setPlayerLives] = useState(3);
  const [botLives, setBotLives] = useState(3);
  const [selectedHand, setSelectedHand] = useState(null);
  const [message, setMessage] = useState('Tausche eine Karte, alle drei – oder klopfe.');
  const [finished, setFinished] = useState(false);
  const [profile, setProfile] = useState({ ...STARTING_PROFILE });
  const [stake, setStake] = useState(50);

  const playerScore = useMemo(() => scoreHand(round.player), [round.player]);

  function resetMatch() {
    setRound(dealRound()); setPlayerLives(3); setBotLives(3); setFinished(false);
    setSelectedHand(null); setMessage('Neue Runde. Zeig dem Bot, wer hier die große Klappe hat.');
  }

  function botTurn(nextRound) {
    const move = bestBotMove(nextRound.bot, nextRound.middle);
    return { ...nextRound, bot: move.hand, middle: move.middle };
  }

  function exchangeOne(middleIndex) {
    if (selectedHand === null || finished) return;
    const move = swapOne(round.player, round.middle, selectedHand, middleIndex);
    setRound(botTurn({ ...round, player: move.hand, middle: move.middle }));
    setSelectedHand(null);
    setMessage('Getauscht. Der Bot hat ebenfalls gezogen.');
  }

  function exchangeAll() {
    if (finished) return;
    setRound(botTurn({ ...round, player: round.middle, middle: round.player }));
    setMessage('Alle drei getauscht. Mutig!');
  }

  function knock() {
    if (finished) return;
    const finalRound = botTurn(round);
    const p = scoreHand(finalRound.player); const b = scoreHand(finalRound.bot);
    const loser = loserFromScores(p, b);
    let nextPlayerLives = playerLives; let nextBotLives = botLives;
    if (loser === 'player') nextPlayerLives -= 1;
    if (loser === 'bot') nextBotLives -= 1;
    setPlayerLives(nextPlayerLives); setBotLives(nextBotLives);
    setRound(finalRound); setFinished(true);
    const result = loser === 'bot' ? 'win' : loser === 'player' ? 'loss' : 'draw';
    const nextProfile = applyRoundResult(profile, result, stake);
    setProfile(nextProfile);
    if (!unlockedStakes(nextProfile.level, nextProfile.coins).includes(stake)) {
      setStake(unlockedStakes(nextProfile.level, nextProfile.coins)[0] || 0);
    }
    setMessage(loser === 'draw' ? `Gleichstand: ${p} zu ${b}.` : loser === 'player' ? `Autsch: ${p} zu ${b}. Du verlierst ein Leben.` : `JA! ${p} zu ${b}. Der Bot verliert ein Leben.`);
  }

  function nextRound() {
    if (playerLives === 0 || botLives === 0) { resetMatch(); return; }
    setRound(dealRound()); setFinished(false); setSelectedHand(null);
    setMessage('Nächste Runde. Drei Leben – keine Ausreden.');
  }

  if (screen === 'menu') return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="light-content" />
      <View style={styles.menu}>
        <Text style={styles.crown}>♛</Text><Text style={styles.logo}>JA 31</Text>
        <Text style={styles.claim}>GROSSE KLAPPE. KLEINES BLATT.</Text>
        <View style={styles.profileBox}>
          <Text style={styles.profileLevel}>LEVEL {profile.level}</Text>
          <Text style={styles.coins}>◉ {profile.coins} JA-COINS</Text>
          <Text style={styles.xp}>XP {profile.xp} / {xpNeeded(profile.level)}</Text>
        </View>
        <TouchableOpacity style={styles.primary} onPress={() => setScreen('game')}><Text style={styles.buttonText}>GEGEN COMPUTER</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => setScreen('local')}><Text style={styles.buttonText}>LOKAL MIT FREUNDEN</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => setScreen('online')}><Text style={styles.buttonText}>ONLINE-LOBBY</Text></TouchableOpacity>
        <Text style={styles.ruleHint}>Beide Tauschvarianten · 3 Leben · 32 Karten</Text>
      </View>
    </SafeAreaView>
  );

  if (screen === 'local') return <LocalGame onExit={() => setScreen('menu')} />;
  if (screen === 'online') return <OnlineLobby onExit={() => setScreen('menu')} />;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.game}>
        <TouchableOpacity onPress={() => setScreen('menu')}><Text style={styles.back}>‹ MENÜ</Text></TouchableOpacity>
        <View style={styles.scoreRow}><View><Text style={styles.name}>BOT</Text><Lives count={botLives} /></View><Text style={styles.miniLogo}>JA 31</Text></View>
        <View style={styles.cards}>{round.bot.map((card) => <Card key={card.id} card={card} hidden={!finished} />)}</View>
        <Text style={styles.middleLabel}>KARTEN IN DER MITTE</Text>
        <View style={styles.cards}>{round.middle.map((card, i) => <Card key={card.id} card={card} onPress={() => exchangeOne(i)} />)}</View>
        <View style={styles.scoreRow}><View><Text style={styles.name}>DU · {playerScore} PUNKTE</Text><Lives count={playerLives} /></View></View>
        <View style={styles.cards}>{round.player.map((card, i) => <Card key={card.id} card={card} selected={selectedHand === i} onPress={() => !finished && setSelectedHand(i)} />)}</View>
        <Text style={styles.message}>{message}</Text>
        {!finished && <View><Text style={styles.stakeTitle}>DEIN EINSATZ</Text><View style={styles.stakes}>
          {unlockedStakes(profile.level, profile.coins).map((amount) => <TouchableOpacity key={amount} onPress={() => setStake(amount)} style={[styles.stake, stake === amount && styles.stakeActive]}><Text style={styles.stakeText}>◉ {amount}</Text></TouchableOpacity>)}
        </View></View>}
        {!finished ? <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryAction} onPress={exchangeAll}><Text style={styles.actionText}>ALLE 3 TAUSCHEN</Text></TouchableOpacity>
          <TouchableOpacity style={styles.primaryAction} onPress={knock}><Text style={styles.actionText}>KLOPFEN</Text></TouchableOpacity>
        </View> : <TouchableOpacity style={styles.primary} onPress={nextRound}><Text style={styles.buttonText}>{playerLives === 0 || botLives === 0 ? 'NEUES SPIEL' : 'NÄCHSTE RUNDE'}</Text></TouchableOpacity>}
        <Text style={styles.help}>Für Einzeltausch: Erst deine Karte, dann eine Karte in der Mitte antippen.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#080808' }, menu: { flex: 1, justifyContent: 'center', padding: 26 }, game: { padding: 20, paddingBottom: 40 },
  crown: { color: RED, fontSize: 52, textAlign: 'center', marginBottom: -12 }, logo: { color: '#fff', fontSize: 68, fontWeight: '900', textAlign: 'center', letterSpacing: -4 },
  claim: { color: RED, textAlign: 'center', fontWeight: '900', letterSpacing: 2, marginBottom: 46 }, primary: { backgroundColor: RED, padding: 18, marginTop: 12, borderRadius: 5 }, secondary: { borderColor: '#444', borderWidth: 1, padding: 18, marginTop: 12, borderRadius: 5 },
  profileBox: { backgroundColor: '#141414', borderLeftColor: RED, borderLeftWidth: 4, padding: 14, marginBottom: 18 }, profileLevel: { color: '#fff', fontSize: 20, fontWeight: '900' }, coins: { color: '#f1bd36', fontWeight: '900', marginTop: 4 }, xp: { color: '#777', marginTop: 4, fontSize: 12 },
  buttonText: { color: '#fff', fontWeight: '900', textAlign: 'center', letterSpacing: 1 }, ruleHint: { color: '#777', textAlign: 'center', marginTop: 28 }, back: { color: '#999', fontWeight: '800', marginBottom: 14 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 }, name: { color: '#fff', fontWeight: '900', fontSize: 16 }, lives: { color: RED, fontSize: 16 }, dead: { color: '#333' }, miniLogo: { color: RED, fontWeight: '900', fontSize: 22 },
  cards: { flexDirection: 'row', justifyContent: 'center', gap: 9, marginVertical: 10 }, card: { width: 88, height: 122, backgroundColor: '#f4f0e8', borderRadius: 8, padding: 9, borderWidth: 3, borderColor: '#f4f0e8', elevation: 5 }, selectedCard: { borderColor: RED, transform: [{ translateY: -8 }] },
  cardBack: { backgroundColor: '#151515', borderColor: RED, alignItems: 'center', justifyContent: 'center' }, backJA: { color: '#fff', fontSize: 28, fontWeight: '900' }, cardText: { color: '#111', fontWeight: '900', fontSize: 24 }, suit: { color: '#111', fontSize: 36, textAlign: 'center', marginTop: 10 }, redCard: { color: RED },
  middleLabel: { color: '#777', textAlign: 'center', fontSize: 11, letterSpacing: 2, marginTop: 6 }, message: { color: '#ddd', textAlign: 'center', minHeight: 42, marginTop: 10, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 }, secondaryAction: { flex: 1, borderColor: '#555', borderWidth: 1, padding: 15, borderRadius: 5 }, primaryAction: { flex: 1, backgroundColor: RED, padding: 16, borderRadius: 5 }, actionText: { color: '#fff', textAlign: 'center', fontWeight: '900', fontSize: 12 }, help: { color: '#666', fontSize: 11, textAlign: 'center', marginTop: 18 },
  stakeTitle: { color: '#777', textAlign: 'center', fontSize: 11, letterSpacing: 2, marginTop: 5 }, stakes: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 10, flexWrap: 'wrap' }, stake: { borderColor: '#444', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 20 }, stakeActive: { backgroundColor: RED, borderColor: RED }, stakeText: { color: '#fff', fontWeight: '900' },
});
