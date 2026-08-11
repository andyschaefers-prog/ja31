import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { bestBotMove, dealRound, loserFromScores, scoreHand, swapOne } from './src/gameEngine';
import { applyRoundResult, STARTING_PROFILE, unlockedStakes, xpNeeded } from './src/progression';
import LocalGame from './src/LocalGame';
import OnlineLobby from './src/OnlineLobby';

const RED = '#e31b23';
const LOGO = require('./assets/ja-logo.png');
const PROFILE_KEY = 'ja31.profile.v1';
const OPPONENTS = [
  { level: 1, name: 'DER ANFÄNGER', line: 'Na los – überrasche mich.' },
  { level: 2, name: 'KARTEN-KALLE', line: 'Ich tausche schneller als du denkst.' },
  { level: 3, name: 'DIE ROTE KÖNIGIN', line: 'Drei Karten. Null Mitleid.' },
  { level: 5, name: 'GROSSE KLAPPE', line: 'War das schon alles?' },
  { level: 10, name: 'DER SCHÄFER', line: 'Endstation. Zeig, was du kannst.' },
];

function BrandBackground() {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={styles.redGlow} /><View style={styles.slashOne} /><View style={styles.slashTwo} />
  </View>;
}

function BrandMark({ compact = false }) {
  return <View style={[styles.brandMark, compact && styles.brandMarkCompact]}>
    <Image source={LOGO} resizeMode="contain" style={[styles.brandLogo, compact && styles.brandLogoCompact]} />
    <View style={styles.numberBadge}><Text style={[styles.numberText, compact && styles.numberTextCompact]}>31</Text></View>
  </View>;
}

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
  const [profileReady, setProfileReady] = useState(false);
  const [roundResult, setRoundResult] = useState(null);
  const actionPulse = useRef(new Animated.Value(1)).current;
  const opponent = [...OPPONENTS].reverse().find((entry) => profile.level >= entry.level) || OPPONENTS[0];

  useEffect(() => { AsyncStorage.getItem(PROFILE_KEY).then((saved) => { if (saved) setProfile(JSON.parse(saved)); }).finally(() => setProfileReady(true)); }, []);
  useEffect(() => { if (profileReady) AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }, [profile, profileReady]);

  function animateAction() {
    actionPulse.setValue(.97);
    Animated.spring(actionPulse, { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }).start();
  }

  const playerScore = useMemo(() => scoreHand(round.player), [round.player]);

  function resetMatch() {
    setRound(dealRound()); setPlayerLives(3); setBotLives(3); setFinished(false);
    setSelectedHand(null); setRoundResult(null); setMessage(`Neue Runde gegen ${opponent.name}. Große Klappe – jetzt Karten zeigen.`);
  }

  function botTurn(nextRound) {
    const move = bestBotMove(nextRound.bot, nextRound.middle);
    return { ...nextRound, bot: move.hand, middle: move.middle };
  }

  function exchangeOne(middleIndex) {
    if (selectedHand === null || finished) return;
    const move = swapOne(round.player, round.middle, selectedHand, middleIndex);
    setRound(botTurn({ ...round, player: move.hand, middle: move.middle }));
    Haptics.selectionAsync(); animateAction();
    setSelectedHand(null);
    setMessage('Getauscht. Der Bot hat ebenfalls gezogen.');
  }

  function exchangeAll() {
    if (finished) return;
    setRound(botTurn({ ...round, player: round.middle, middle: round.player }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); animateAction();
    setMessage('Alle drei getauscht. Mutig!');
  }

  function knock() {
    if (finished) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); animateAction();
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
    setRoundResult({ result, player: p, bot: b });
    if (result === 'win') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (result === 'loss') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (!unlockedStakes(nextProfile.level, nextProfile.coins).includes(stake)) {
      setStake(unlockedStakes(nextProfile.level, nextProfile.coins)[0] || 0);
    }
    setMessage(loser === 'draw' ? `Gleichstand: ${p} zu ${b}. Keiner kriegt dich klein.` : loser === 'player' ? `Autsch: ${p} zu ${b}. ${opponent.name}: „${opponent.line}“` : `JA! ${p} zu ${b}. Setz dich wieder hin, ${opponent.name}!`);
  }

  function nextRound() {
    if (playerLives === 0 || botLives === 0) { resetMatch(); return; }
    setRound(dealRound()); setFinished(false); setSelectedHand(null); setRoundResult(null);
    setMessage('Nächste Runde. Drei Leben – keine Ausreden.'); animateAction();
  }

  if (screen === 'menu') return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="light-content" />
      <BrandBackground />
      <View style={styles.menu}>
        <BrandMark />
        <Text style={styles.claim}>GROSSE KLAPPE.</Text><Text style={styles.claimWhite}>KLEINES BLATT.</Text>
        <View style={styles.profileBox}>
          <View style={styles.profileTop}><View><Text style={styles.eyebrow}>DEIN SPIELERPROFIL</Text><Text style={styles.profileLevel}>LEVEL {profile.level}</Text></View><Text style={styles.coins}>● {profile.coins}</Text></View>
          <View style={styles.xpTrack}><View style={[styles.xpFill,{width:`${Math.min(100,(profile.xp/xpNeeded(profile.level))*100)}%`}]} /></View>
          <Text style={styles.xp}>{profile.xp} / {xpNeeded(profile.level)} XP BIS ZUM NÄCHSTEN LEVEL</Text>
        </View>
        <TouchableOpacity style={styles.primary} onPress={() => setScreen('game')}><Text style={styles.modeNo}>01</Text><Text style={styles.buttonText}>GEGEN COMPUTER</Text><Text style={styles.arrow}>›</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => setScreen('local')}><Text style={styles.modeNo}>02</Text><Text style={styles.buttonText}>LOKAL MIT FREUNDEN</Text><Text style={styles.arrow}>›</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => setScreen('online')}><Text style={styles.modeNo}>03</Text><Text style={styles.buttonText}>ONLINE-LOBBY</Text><Text style={styles.arrow}>›</Text></TouchableOpacity>
        <Text style={styles.ruleHint}>Beide Tauschvarianten · 3 Leben · 32 Karten</Text>
      </View>
    </SafeAreaView>
  );

  if (screen === 'local') return <LocalGame onExit={() => setScreen('menu')} />;
  if (screen === 'online') return <OnlineLobby onExit={() => setScreen('menu')} />;

  return (
    <SafeAreaView style={styles.page}>
      <BrandBackground />
      <ScrollView contentContainerStyle={styles.game}>
        <View style={styles.gameHeader}><TouchableOpacity hitSlop={12} style={styles.backButton} onPress={() => setScreen('menu')}><Text style={styles.back}>‹ MENÜ</Text></TouchableOpacity><BrandMark compact /></View>
        <View style={styles.turnBanner}><Text style={styles.turnDot}>●</Text><Text style={styles.turnText}>{finished ? 'RUNDE ENTSCHIEDEN' : 'DU BIST DRAN – ZEIG, WAS DU HAST!'}</Text></View>
        <Animated.View style={[styles.table,{transform:[{scale:actionPulse}]}]}>
        <View style={styles.tableShine} />
        <View style={styles.scoreRow}><View><Text style={styles.eyebrow}>DEIN GEGNER · LEVEL {opponent.level}</Text><Text style={styles.name}>{opponent.name}</Text><Lives count={botLives} /></View><Text style={styles.taunt}>„{opponent.line}“</Text></View>
        <View style={styles.cards}>{round.bot.map((card) => <Card key={card.id} card={card} hidden={!finished} />)}</View>
        <Text style={styles.middleLabel}>KARTEN IN DER MITTE</Text>
        <View style={styles.cards}>{round.middle.map((card, i) => <Card key={card.id} card={card} onPress={() => exchangeOne(i)} />)}</View>
        <View style={styles.scoreRow}><View><Text style={styles.name}>DU · {playerScore} PUNKTE</Text><Lives count={playerLives} /></View></View>
        <View style={styles.cards}>{round.player.map((card, i) => <Card key={card.id} card={card} selected={selectedHand === i} onPress={() => !finished && setSelectedHand(i)} />)}</View>
        </Animated.View>
        {roundResult && <View style={[styles.resultSplash,roundResult.result==='win'?styles.resultWin:roundResult.result==='loss'?styles.resultLoss:styles.resultDraw]}>
          <Text style={styles.resultKicker}>{roundResult.result==='win'?'VOLLTREFFER!':roundResult.result==='loss'?'AUTSCH!':'GLEICHSTAND'}</Text>
          <Text style={styles.resultBig}>{roundResult.player} : {roundResult.bot}</Text>
          <Text style={styles.resultReward}>{roundResult.result==='win'?`+${stake} COINS · XP GESAMMELT`:roundResult.result==='loss'?'EIN LEBEN WENIGER':'KEINER GIBT NACH'}</Text>
        </View>}
        <Text style={styles.message}>{message}</Text>
        {!finished && <View><Text style={styles.stakeTitle}>DEIN EINSATZ</Text><View style={styles.stakes}>
          {unlockedStakes(profile.level, profile.coins).map((amount) => <TouchableOpacity key={amount} onPress={() => setStake(amount)} style={[styles.stake, stake === amount && styles.stakeActive]}><Text style={styles.stakeText}>◉ {amount}</Text></TouchableOpacity>)}
        </View></View>}
        {!finished ? <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryAction} onPress={exchangeAll}><Text style={styles.actionIcon}>↻</Text><Text style={styles.actionText}>ALLE 3{`\n`}TAUSCHEN</Text></TouchableOpacity>
          <TouchableOpacity style={styles.primaryAction} onPress={knock}><Text style={styles.actionIcon}>✊</Text><Text style={styles.actionText}>JETZT{`\n`}KLOPFEN!</Text></TouchableOpacity>
        </View> : <TouchableOpacity style={styles.primary} onPress={nextRound}><Text style={styles.buttonText}>{playerLives === 0 || botLives === 0 ? 'NEUES SPIEL' : 'NÄCHSTE RUNDE'}</Text></TouchableOpacity>}
        <Text style={styles.help}>Für Einzeltausch: Erst deine Karte, dann eine Karte in der Mitte antippen.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#050505' }, menu: { flex: 1, justifyContent: 'center', padding: 24 }, game: { paddingHorizontal:16,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||24)+16:20, paddingBottom: 40 },
  redGlow:{position:'absolute',width:380,height:380,borderRadius:190,backgroundColor:'#430006',opacity:.38,top:-190,right:-150},slashOne:{position:'absolute',width:520,height:2,backgroundColor:RED,opacity:.18,transform:[{rotate:'-24deg'}],top:260,left:-100},slashTwo:{position:'absolute',width:520,height:1,backgroundColor:'#fff',opacity:.07,transform:[{rotate:'-24deg'}],top:274,left:-100},
  brandMark:{height:190,alignItems:'center',justifyContent:'center',marginBottom:-8},brandLogo:{width:210,height:210},brandMarkCompact:{height:62,width:92,marginBottom:0},brandLogoCompact:{width:72,height:72},numberBadge:{position:'absolute',right:'18%',bottom:22,backgroundColor:'#fff',borderColor:RED,borderWidth:3,paddingHorizontal:9,paddingVertical:2,transform:[{rotate:'-7deg'}]},numberText:{color:'#090909',fontSize:24,fontWeight:'900',fontStyle:'italic'},numberTextCompact:{fontSize:12},
  claim: { color: RED, textAlign: 'center', fontSize:20,fontWeight: '900', letterSpacing: 3 },claimWhite:{color:'#fff',textAlign:'center',fontSize:20,fontWeight:'900',letterSpacing:3,marginBottom:24}, primary: { backgroundColor: RED, minHeight:58,padding: 16, marginTop: 10, borderRadius: 2,flexDirection:'row',alignItems:'center' }, secondary: { backgroundColor:'#111',borderColor: '#383838', borderWidth: 1, minHeight:58,padding: 16, marginTop: 10, borderRadius: 2,flexDirection:'row',alignItems:'center' },
  profileBox: { backgroundColor: '#101010', borderTopColor: RED, borderTopWidth: 3, padding: 15, marginBottom: 14 },profileTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},eyebrow:{color:'#777',fontSize:9,fontWeight:'900',letterSpacing:2}, profileLevel: { color: '#fff', fontSize: 23, fontWeight: '900',fontStyle:'italic' }, coins: { color: '#f1bd36', fontWeight: '900',fontSize:18 }, xp: { color: '#777', marginTop: 6, fontSize: 9,fontWeight:'800' },xpTrack:{height:6,backgroundColor:'#292929',marginTop:12},xpFill:{height:6,backgroundColor:RED},
  buttonText: { flex:1,color: '#fff', fontWeight: '900', textAlign: 'center', letterSpacing: 1 },modeNo:{color:'rgba(255,255,255,.45)',fontWeight:'900',fontStyle:'italic'},arrow:{color:'#fff',fontSize:26,fontWeight:'300'}, ruleHint: { color: '#666', textAlign: 'center', marginTop: 20,fontSize:11 }, back: { color: '#fff', fontWeight: '900',fontSize:13 },backButton:{backgroundColor:'#171717',borderColor:'#444',borderWidth:1,paddingVertical:12,paddingHorizontal:15,minWidth:82},gameHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10},
  turnBanner:{backgroundColor:RED,flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:9,marginBottom:10,transform:[{rotate:'-.6deg'}]},turnDot:{color:'#fff',marginRight:8,fontSize:9},turnText:{color:'#fff',fontSize:11,fontWeight:'900',fontStyle:'italic',letterSpacing:.7},
  table:{position:'relative',overflow:'hidden',backgroundColor:'#17110f',borderColor:'#6e1013',borderWidth:3,borderRadius:22,paddingHorizontal:10,paddingVertical:12,shadowColor:RED,shadowOpacity:.35,shadowRadius:16,elevation:10},tableShine:{position:'absolute',width:'140%',height:90,top:'42%',left:'-20%',backgroundColor:'#3a0b0d',opacity:.28,transform:[{rotate:'-8deg'}]},
  taunt:{color:'#8f7d79',fontSize:9,fontStyle:'italic',maxWidth:125,textAlign:'right'},resultSplash:{marginTop:12,borderWidth:2,paddingVertical:12,paddingHorizontal:14,alignItems:'center',transform:[{rotate:'-.7deg'}]},resultWin:{backgroundColor:'#3d090c',borderColor:RED},resultLoss:{backgroundColor:'#181818',borderColor:'#555'},resultDraw:{backgroundColor:'#19150a',borderColor:'#b48617'},resultKicker:{color:'#fff',fontSize:20,fontWeight:'900',fontStyle:'italic',letterSpacing:2},resultBig:{color:'#fff',fontSize:32,fontWeight:'900'},resultReward:{color:'#f1bd36',fontSize:10,fontWeight:'900',letterSpacing:1},
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 }, name: { color: '#fff', fontWeight: '900', fontSize: 16 }, lives: { color: RED, fontSize: 16 }, dead: { color: '#333' }, miniLogo: { color: RED, fontWeight: '900', fontSize: 22 },
  cards: { flexDirection: 'row', justifyContent: 'center', gap: 9, marginVertical: 10 }, card: { width: 88, height: 122, backgroundColor: '#f6f1e6', borderRadius: 4, padding: 9, borderWidth: 3, borderColor: '#d8d1c5', elevation: 7 }, selectedCard: { borderColor: RED, transform: [{ translateY: -8 },{rotate:'-2deg'}] },
  cardBack: { backgroundColor: '#111', borderColor: RED, alignItems: 'center', justifyContent: 'center' }, backJA: { color: RED, fontSize: 28, fontWeight: '900',fontStyle:'italic' }, cardText: { color: '#111', fontWeight: '900', fontSize: 24 }, suit: { color: '#111', fontSize: 36, textAlign: 'center', marginTop: 10 }, redCard: { color: RED },
  middleLabel: { color: '#777', textAlign: 'center', fontSize: 11, letterSpacing: 2, marginTop: 6 }, message: { color: '#ddd', textAlign: 'center', minHeight: 42, marginTop: 10, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 }, secondaryAction: { flex: 1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#151515',borderColor: '#555', borderWidth: 1, padding: 13, borderRadius: 2 }, primaryAction: { flex: 1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor: RED, padding: 13, borderRadius: 2,transform:[{rotate:'-1deg'}] },actionIcon:{fontSize:24,color:'#fff'}, actionText: { color: '#fff', textAlign: 'center', fontWeight: '900', fontSize: 11,lineHeight:15 }, help: { color: '#666', fontSize: 11, textAlign: 'center', marginTop: 18 },
  stakeTitle: { color: '#777', textAlign: 'center', fontSize: 11, letterSpacing: 2, marginTop: 5 }, stakes: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 10, flexWrap: 'wrap' }, stake: { borderColor: '#444', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 20 }, stakeActive: { backgroundColor: RED, borderColor: RED }, stakeText: { color: '#fff', fontWeight: '900' },
});
