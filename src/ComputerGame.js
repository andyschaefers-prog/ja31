import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { bestBotMove, canKnock, dealLocalRound, localRoundResult, scoreHand, shouldBotKnock, swapOne } from './gameEngine';
import { ACHIEVEMENTS, applyRoundResult, DECKS, recordBattleEvent, recordDailyRound, STARTING_PROFILE, TABLES } from './progression';

const RED = '#e31b23';
const GOLD = '#f1bd36';
const BOTS = [
  { name: 'KARTEN-KALLE', face: '😎', line: 'Vorsichtig. Wartet auf seine Chance.', style: 'TAKTIKER' },
  { name: 'ROTE KÖNIGIN', face: '😈', line: 'Klopft früh. Null Mitleid.', style: 'AGGRESSIV' },
  { name: 'DER SCHÄFER', face: '🤠', line: 'Liest den Tisch und kennt jeden Trick.', style: 'PROFI' },
];
const DIFFICULTIES = {
  locker: { title: 'LOCKER', subtitle: 'Mehr Fehler · spätes Klopfen', bestChance: .55 },
  frech: { title: 'FRECH', subtitle: 'Ausgeglichen · volle Action', bestChance: .85 },
  brutal: { title: 'BRUTAL', subtitle: 'Kaum Fehler · frühes Klopfen', bestChance: 1 },
};
const MODES = {
  classic: { title: 'KLASSISCH', subtitle: '3 Leben · normaler Einsatz', lives: 3 },
  quick: { title: 'SCHNELLSPIEL', subtitle: '1 Leben · sofortige Entscheidung', lives: 1 },
  survival: { title: 'ÜBERLEBEN', subtitle: 'Du gegen 3 · letzter Spieler gewinnt', lives: 3 },
  risk: { title: 'RISIKO', subtitle: 'Doppelter Gewinn oder Verlust', lives: 3 },
  training: { title: 'TRAINING', subtitle: 'Ohne Coin-Verlust', lives: 3 },
};
const TAUNTS = {
  'KARTEN-KALLE': ['Ich warte nur auf deinen Fehler.', 'Das Blatt wird langsam heiß.', 'Klopfen? Traust du dich doch nicht.'],
  'ROTE KÖNIGIN': ['Drei Karten. Null Mitleid.', 'Klopf, wenn du dich traust!', 'Das wird gleich teuer für dich.'],
  'DER SCHÄFER': ['Deine Karten verraten dich.', 'Ich kenne jeden Trick.', 'Am Ende bleibt nur einer stehen.'],
};

function TableAvatar({ avatar, botFace, small = false }) {
  const data = avatar || { face: botFace || '😎', hair: '', outfit: '🖤', extra: '', flag: '' };
  return <View style={[styles.tableAvatar, small && styles.tableAvatarSmall]}>
    <Text style={[styles.tableAvatarFace, small && styles.tableAvatarFaceSmall]}>{data.face || botFace}</Text>
    {!!data.hair && <Text style={[styles.tableAvatarHair, small && styles.tableAvatarPartSmall]}>{data.hair}</Text>}
    {!!data.extra && <Text style={[styles.tableAvatarExtra, small && styles.tableAvatarPartSmall]}>{data.extra}</Text>}
    <View style={styles.tableAvatarBase}><Text style={[styles.tableAvatarOutfit, small && styles.tableAvatarBaseSmall]}>{data.outfit || '🖤'}</Text><Text style={[styles.tableAvatarFlag, small && styles.tableAvatarBaseSmall]}>{data.flag || ''}</Text></View>
  </View>;
}

function Card({ card, hidden, selected, onPress, small = false, deck = 'classic' }) {
  const deckStyle = deck === 'legend' ? styles.deckLegend : deck === 'skull' ? styles.deckSkull : deck === 'grunge' ? styles.deckGrunge : null;
  if (hidden) return <View style={[styles.card, small && styles.cardSmall, styles.cardBack, deckStyle]}><View style={styles.backInset}><Text style={[styles.backCrown, small && styles.backCrownSmall]}>{deck === 'skull' ? '💀' : deck === 'grunge' ? '⚡' : '♛'}</Text><Text style={[styles.cardJA, small && styles.cardJASmall]}>JA</Text></View></View>;
  const red = card.suit === '♥' || card.suit === '♦';
  return <TouchableOpacity disabled={!onPress} onPress={onPress} style={[styles.card, small && styles.cardSmall, selected && styles.selected]}>
    <View style={styles.corner}><Text style={[styles.rank, small && styles.rankSmall, red && styles.red]}>{card.rank}</Text><Text style={[styles.cornerSuit, small && styles.cornerSuitSmall, red && styles.red]}>{card.suit}</Text></View>
    <Text style={[styles.suit, small && styles.suitSmall, red && styles.red]}>{card.suit}</Text>
    {!small && <View style={styles.cornerBottom}><Text style={[styles.rank, red && styles.red]}>{card.rank}</Text><Text style={[styles.cornerSuit, red && styles.red]}>{card.suit}</Text></View>}
  </TouchableOpacity>;
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const cardLabel = (card) => `${card.rank}${card.suit}`;

const dots = (lives) => `${'●'.repeat(lives)}${'○'.repeat(3 - lives)}`;

export default function ComputerGame({ profile, setProfile, stake, onExit }) {
  const [totalPlayers, setTotalPlayers] = useState(2);
  const [difficulty, setDifficulty] = useState('frech');
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(null);
  const [lives, setLives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState(null);
  const [turns, setTurns] = useState(0);
  const [message, setMessage] = useState('Du bist dran. Mach Krach!');
  const [botsPlaying, setBotsPlaying] = useState(false);
  const [botAction, setBotAction] = useState(null);
  const [knock, setKnock] = useState(null);
  const [mode, setMode] = useState('classic');
  const [reaction, setReaction] = useState('🔥 BEREIT');
  const [taunt, setTaunt] = useState('Heute gibt es keine Ausreden.');
  const [showBattleProfile, setShowBattleProfile] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [flyingCard, setFlyingCard] = useState(null);
  const moveAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const flightAnim = useRef(new Animated.Value(0)).current;
  const knockPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!knock) { knockPulse.stopAnimation(); knockPulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(knockPulse,{toValue:1.012,duration:260,useNativeDriver:true}),
      Animated.timing(knockPulse,{toValue:1,duration:260,useNativeDriver:true}),
    ]));
    loop.start();
    return () => loop.stop();
  }, [knock, knockPulse]);

  useEffect(() => {
    if (!round) return;
    cardAnim.setValue(0);
    Animated.spring(cardAnim, { toValue: 1, friction: 7, tension: 95, useNativeDriver: true }).start();
  }, [round, cardAnim]);

  useEffect(() => {
    if (!botAction) return;
    moveAnim.setValue(0);
    Animated.sequence([
      Animated.spring(moveAnim, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(moveAnim, { toValue: .96, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [botAction, moveAnim]);

  const playerScore = useMemo(() => round ? scoreHand(round.hands[0]) : 0, [round]);

  function startGame() {
    const players = mode === 'survival' ? 4 : totalPlayers;
    setTotalPlayers(players);
    setLives(Array(players).fill(MODES[mode].lives));
    setRound(dealLocalRound(players));
    setStarted(true); setFinished(false); setResult(null); setSelected(null); setTurns(0);
    setKnock(null);
    setReaction('⚡ LOS GEHT’S');
    setMessage(`${MODES[mode].title}: ${players - 1} Computergegner. Einer bleibt übrig.`);
  }

  function haptic(type = 'selection') {
    if (profile.settings?.vibration === false) return;
    if (type === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    else Haptics.selectionAsync();
  }

  function botTaunt(bot) {
    const lines = TAUNTS[bot.name] || ['Keine Ausreden.'];
    setTaunt(lines[Math.floor(Math.random() * lines.length)]);
  }

  function animateCardFlight(label, direction = 'down') {
    setFlyingCard({ label, direction });
    flightAnim.setValue(0);
    Animated.timing(flightAnim,{toValue:1,duration:520,useNativeDriver:true}).start(()=>setFlyingCard(null));
  }

  function decide(nextRound, reason = 'Du hast geklopft!') {
    const activeIndexes = lives.map((life, index) => life > 0 ? index : -1).filter((index) => index >= 0);
    const activeOutcome = localRoundResult(activeIndexes.map((index) => nextRound.hands[index]));
    const outcome = {
      scores: nextRound.hands.map(scoreHand),
      winners: activeOutcome.winners.map((index) => activeIndexes[index]),
      losers: activeOutcome.losers.map((index) => activeIndexes[index]),
    };
    const nextLives = lives.map((value, index) => Math.max(0, value - (outcome.losers.includes(index) ? 1 : 0)));
    const humanWon = outcome.winners.includes(0);
    const humanLost = outcome.losers.includes(0);
    setLives(nextLives); setRound(nextRound); setFinished(true); setResult({ ...outcome, nextStreak: humanWon ? (profile.currentStreak || 0) + 1 : 0 });
    setProfile((current) => {
      const roundResult = humanWon ? 'win' : humanLost ? 'loss' : 'draw';
      let updated = applyRoundResult(current, roundResult, stake);
      if (mode === 'training') updated = { ...updated, coins: current.coins };
      if (mode === 'risk') updated = { ...updated, coins: Math.max(0, updated.coins + (humanWon ? stake : humanLost ? -stake : 0)) };
      updated = recordDailyRound(updated, roundResult, scoreHand(nextRound.hands[0]));
      if (scoreHand(nextRound.hands[0]) === 31) updated = recordBattleEvent(updated, 'score31');
      return recordBattleEvent(updated, 'round');
    });
    if (profile.settings?.vibration !== false) Haptics.notificationAsync(humanWon ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    setReaction(humanWon ? (scoreHand(nextRound.hands[0]) === 31 ? '⚡ PERFEKTE 31!' : '👑 RUNDE GEHÖRT DIR') : humanLost ? '💥 AUTSCH!' : '🤝 GLEICHSTAND');
    setMessage(`${reason} ${outcome.losers.includes(0) ? 'Autsch – du verlierst ein Leben.' : 'JA! Du bleibst stehen.'}`);
  }

  async function runBots(nextRound, options = {}) {
    const { finalAfterHuman = false, humanKnocked = false } = options;
    setBotsPlaying(true);
    const hands = [...nextRound.hands];
    let middle = nextRound.middle;
    let botKnocker = null;
    for (let index = 1; index < totalPlayers; index += 1) {
      if (lives[index] <= 0) continue;
      if (finalAfterHuman && knock?.by === index) continue;
      const oldHand = hands[index];
      const oldMiddle = middle;
      const idealMove = bestBotMove(hands[index], middle);
      const personalityBoost = index === 3 ? .12 : index === 2 ? .05 : 0;
      const usesBestMove = Math.random() < Math.min(1, DIFFICULTIES[difficulty].bestChance + personalityBoost);
      const move = usesBestMove ? idealMove : { type: 'pass', hand: hands[index], middle, score: scoreHand(hands[index]) };
      hands[index] = move.hand; middle = move.middle;
      let action;
      if (move.type === 'one') {
        const taken = move.hand.find((card) => !oldHand.some((old) => old.id === card.id));
        const discarded = move.middle.find((card) => !oldMiddle.some((old) => old.id === card.id));
        action = { bot: BOTS[index - 1], type: 'TAUSCHT', taken, discarded };
      } else if (move.type === 'all') {
        action = { bot: BOTS[index - 1], type: 'NIMMT ALLE 3', cards: oldMiddle };
      } else {
        action = { bot: BOTS[index - 1], type: 'PASST' };
      }
      setBotAction(action);
      botTaunt(BOTS[index - 1]);
      setMessage(`${BOTS[index - 1].name} ist am Zug …`);
      setRound({ ...nextRound, hands: [...hands], middle: [...middle] });
      haptic();
      await wait(900);
      const score = scoreHand(hands[index]);
      const aggressiveKnock = index === 2 && score >= (difficulty === 'locker' ? 29 : 27);
      const normalKnock = shouldBotKnock(hands[index], turns + (difficulty === 'brutal' ? 2 : difficulty === 'locker' ? -1 : 1));
      if (!finalAfterHuman && !humanKnocked && canKnock(turns) && botKnocker === null && (aggressiveKnock || normalKnock)) botKnocker = index;
    }
    const updated = { ...nextRound, hands, middle };
    setTurns((value) => value + 1);
    setBotAction(null);
    setBotsPlaying(false);
    if (humanKnocked) decide(updated, 'DU HAST GEKLOPFT! Jeder Gegner hatte seinen letzten Zug.');
    else if (finalAfterHuman) decide(updated, `${knock.name} HAT GEKLOPFT! Alle letzten Züge sind vorbei.`);
    else if (botKnocker !== null) {
      const nextKnock = { by: botKnocker, name: BOTS[botKnocker - 1].name };
      setKnock(nextKnock);
      setCountdown(1);
      if (profile.settings?.vibration !== false) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setMessage(`✊ ${nextKnock.name} KLOPFT! DU HAST JETZT GENAU EINEN LETZTEN ZUG.`);
    }
    else { setRound(updated); setMessage('Dein Zug – welche Karte holst du dir?'); }
  }

  function finishHumanMove(nextRound) {
    if (knock) { setCountdown(null); runBots(nextRound, { finalAfterHuman: true }); }
    else runBots(nextRound);
  }

  function swapMiddle(middleIndex) {
    if (selected === null || finished || botsPlaying) return;
    const move = swapOne(round.hands[0], round.middle, selected, middleIndex);
    const hands = [...round.hands]; hands[0] = move.hand;
    animateCardFlight(cardLabel(round.middle[middleIndex]), 'down');
    setSelected(null); haptic(); setReaction('🃏 KARTE GETAUSCHT'); finishHumanMove({ ...round, hands, middle: move.middle });
  }

  function swapAll() {
    if (finished || botsPlaying) return;
    const hands = [...round.hands]; const old = hands[0]; hands[0] = round.middle;
    animateCardFlight('3×', 'down'); haptic('heavy'); setReaction('🔥 ALLE DREI GETAUSCHT'); finishHumanMove({ ...round, hands, middle: old });
  }

  function passTurn() {
    if (finished || botsPlaying) return;
    setSelected(null);
    haptic(); setReaction('😏 GESCHOBEN');
    finishHumanMove(round);
  }

  async function knockNow() {
    if (finished || botsPlaying || knock || !canKnock(turns)) return;
    setKnock({ by: 0, name: profile.playerName || 'DU' });
    setSelected(null);
    setMessage('✊ DU KLOPFST! JEDER GEGNER HAT NUR NOCH EINEN LETZTEN ZUG.');
    setProfile((current) => recordBattleEvent(current, 'knock'));
    haptic('heavy'); setReaction('✊ DU HAST GEKLOPFT!');
    setBotsPlaying(true);
    for (let value = 3; value >= 1; value -= 1) { setCountdown(value); await wait(560); }
    setCountdown(null);
    runBots(round, { humanKnocked: true });
  }

  function nextRound() {
    const alive = lives.map((life, index) => life > 0 ? index : -1).filter((index) => index >= 0);
    if (alive.length <= 1) { setStarted(false); setRound(null); return; }
    setRound(dealLocalRound(totalPlayers)); setFinished(false); setResult(null); setSelected(null); setTurns(0);
    setKnock(null);
    setCountdown(null);
    setMessage('Neue Runde. Neue Karten. Keine Ausreden.');
    setReaction('🔥 NEUE RUNDE');
  }

  if (!started) return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.setup}>
    <TouchableOpacity style={styles.back} onPress={onExit}><Text style={styles.white}>‹ HAUPTMENÜ</Text></TouchableOpacity>
    <Text style={styles.kicker}>JA 31 · COMPUTER-ARENA</Text><Text style={styles.title}>WIE VIELE{`\n`}GEGNER?</Text>
    <Text style={styles.subtitle}>DU + BIS ZU DREI COMPUTER. MAXIMAL VIER AM TISCH.</Text>
    <View style={styles.countRow}>{[1, 2, 3].map((count) => <TouchableOpacity key={count} onPress={() => setTotalPlayers(count + 1)} style={[styles.count, totalPlayers === count + 1 && styles.countActive]}><Text style={styles.countBig}>{count}</Text><Text style={styles.countLabel}>{count === 1 ? 'GEGNER' : 'GEGNER'}</Text></TouchableOpacity>)}</View>
    <Text style={styles.chooseTitle}>SCHWIERIGKEIT</Text><View style={styles.difficultyRow}>{Object.entries(DIFFICULTIES).map(([key,value])=><TouchableOpacity key={key} onPress={()=>setDifficulty(key)} style={[styles.difficulty,difficulty===key&&styles.difficultyActive]}><Text style={styles.difficultyTitle}>{value.title}</Text><Text style={styles.difficultySub}>{value.subtitle}</Text></TouchableOpacity>)}</View>
    <Text style={styles.chooseTitle}>SPIELMODUS</Text><View style={styles.modeGrid}>{Object.entries(MODES).map(([key,value])=><TouchableOpacity key={key} onPress={()=>setMode(key)} style={[styles.modeTile,mode===key&&styles.modeTileActive]}><Text style={styles.modeTitle}>{value.title}</Text><Text style={styles.modeSub}>{value.subtitle}</Text></TouchableOpacity>)}</View>
    <TouchableOpacity style={styles.battleProfileButton} onPress={()=>setShowBattleProfile(value=>!value)}><Text style={styles.white}>{showBattleProfile?'BATTLE-PROFIL SCHLIESSEN':'🏆 BATTLE-PROFIL · DESIGNS · EINSTELLUNGEN'}</Text></TouchableOpacity>
    {showBattleProfile && <View style={styles.battlePanel}>
      <Text style={styles.panelHeadline}>DEINE STATISTIK</Text><View style={styles.statsGrid}>{[['SPIELE',profile.stats?.games||0],['SIEGE',profile.stats?.wins||profile.wins||0],['31ER',profile.stats?.score31||0],['KLOPFER',profile.stats?.knocks||0],['REKORD',profile.bestStreak||0],['COINS GEWONNEN',profile.stats?.coinsWon||0]].map(([label,value])=><View key={label} style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}</View>
      <Text style={styles.panelHeadline}>KARTENRÜCKSEITE</Text><View style={styles.unlockRow}>{DECKS.map(item=>{const open=(profile.unlockedDecks||['classic']).includes(item.id);return <TouchableOpacity key={item.id} disabled={!open} onPress={()=>setProfile(current=>({...current,selectedDeck:item.id}))} style={[styles.unlockTile,profile.selectedDeck===item.id&&styles.unlockActive,!open&&styles.disabled]}><Text style={styles.unlockIcon}>{item.id==='legend'?'♛':item.id==='skull'?'💀':item.id==='grunge'?'⚡':'JA'}</Text><Text style={styles.unlockText}>{open?item.title:`LEVEL ${item.unlock}`}</Text></TouchableOpacity>})}</View>
      <Text style={styles.panelHeadline}>TISCH</Text><View style={styles.unlockRow}>{TABLES.map(item=>{const open=(profile.unlockedTables||['arena']).includes(item.id);return <TouchableOpacity key={item.id} disabled={!open} onPress={()=>setProfile(current=>({...current,selectedTable:item.id}))} style={[styles.unlockTile,profile.selectedTable===item.id&&styles.unlockActive,!open&&styles.disabled]}><Text style={styles.unlockIcon}>◉</Text><Text style={styles.unlockText}>{open?item.title:`LEVEL ${item.unlock}`}</Text></TouchableOpacity>})}</View>
      <View style={styles.settingRow}><Text style={styles.white}>TON</Text><TouchableOpacity onPress={()=>setProfile(current=>({...current,settings:{...(current.settings||STARTING_PROFILE.settings),sound:current.settings?.sound===false}}))} style={styles.settingButton}><Text style={styles.white}>{profile.settings?.sound===false?'AUS':'AN'}</Text></TouchableOpacity><Text style={styles.white}>VIBRATION</Text><TouchableOpacity onPress={()=>setProfile(current=>({...current,settings:{...(current.settings||STARTING_PROFILE.settings),vibration:current.settings?.vibration===false}}))} style={styles.settingButton}><Text style={styles.white}>{profile.settings?.vibration===false?'AUS':'AN'}</Text></TouchableOpacity></View>
      <Text style={styles.panelHeadline}>ERFOLGE</Text>{ACHIEVEMENTS.map(item=><View key={item.id} style={styles.achievement}><Text style={styles.achievementState}>{(profile.achievements||[]).includes(item.id)?'✓':'○'}</Text><View style={{flex:1}}><Text style={styles.white}>{item.title}</Text><Text style={styles.achievementText}>{item.description} · ◉ {item.reward}</Text></View></View>)}
    </View>}
    <View style={styles.roster}>{BOTS.slice(0, (mode==='survival'?4:totalPlayers) - 1).map((bot) => <View key={bot.name} style={styles.rosterItem}><Text style={styles.face}>{bot.face}</Text><View style={{flex:1}}><View style={styles.botTitleRow}><Text style={styles.botName}>{bot.name}</Text><Text style={styles.botStyle}>{bot.style}</Text></View><Text style={styles.botLine}>{bot.line}</Text></View></View>)}</View>
    <TouchableOpacity style={styles.primary} onPress={startGame}><Text style={styles.primaryText}>ARENA STARTEN 🔥</Text></TouchableOpacity>
  </ScrollView></SafeAreaView>;

  const alive = lives.filter((value) => value > 0).length;
  const matchWinner = alive <= 1;
  return <SafeAreaView style={styles.page}><View style={styles.game}>
    <View style={styles.top}><TouchableOpacity style={styles.back} onPress={onExit}><Text style={styles.white}>‹ MENÜ</Text></TouchableOpacity><View><Text style={styles.arena}>JA-ARENA</Text><Text style={styles.pot}>{DIFFICULTIES[difficulty].title} · EINSATZ ◉ {stake}</Text></View></View>
    <View style={styles.alert}><Text style={styles.alertText}>{finished ? 'RUNDE ENTSCHIEDEN!' : knock ? `✊ ${knock.name} HAT GEKLOPFT – LETZTE ZÜGE!` : botsPlaying ? '🤖 COMPUTERZUG – GENAU HINSCHAUEN!' : '⚡ DU BIST DRAN – KEINE ZEIT VERLIEREN!'}</Text></View>
    {countdown>1 && <View style={styles.countdownOverlay}><Text style={styles.countdownKicker}>LETZTE ZÜGE STARTEN IN</Text><Text style={styles.countdownNumber}>{countdown}</Text></View>}
    <View style={styles.arenaBody}>
    <Animated.View style={[styles.tableRail,profile.selectedTable==='crown'&&styles.tableCrownTheme,profile.selectedTable==='underground'&&styles.tableUnderground,knock&&styles.tableKnock,{transform:[{scale:knockPulse}]}]}><View style={styles.table}>
      <View style={styles.tableRing} />
      <View style={styles.tableGlow} />
      <View style={styles.tableMark}><Text style={styles.tableCrown}>♛</Text><Text style={styles.tableJA}>JA</Text><Text style={styles.table31}>31</Text></View>
      {flyingCard && <Animated.View pointerEvents="none" style={[styles.flyingCard,{opacity:flightAnim.interpolate({inputRange:[0,.1,.85,1],outputRange:[0,1,1,0]}),transform:[{translateY:flightAnim.interpolate({inputRange:[0,1],outputRange:flyingCard.direction==='down'?[-75,105]:[90,-80]})},{rotate:flightAnim.interpolate({inputRange:[0,1],outputRange:['-12deg','8deg']})},{scale:flightAnim.interpolate({inputRange:[0,1],outputRange:[.7,1.08]})}]}]}><Text style={styles.flyingCardText}>{flyingCard.label}</Text></Animated.View>}
      <View style={styles.opponents}>{BOTS.slice(0, totalPlayers - 1).map((bot, index) => <View key={bot.name} style={[styles.seat, lives[index + 1] === 0 && styles.out]}><TableAvatar botFace={bot.face} small /><Text style={styles.reactionBubble}>{finished?(result?.winners.includes(index+1)?'👑':'💥'):botAction?.bot.name===bot.name?'⚡':'😏'}</Text><Text numberOfLines={1} style={styles.seatName}>{bot.name}</Text><Text style={styles.life}>{dots(lives[index + 1])}</Text><View style={styles.miniCards}>{round.hands[index + 1].map((card) => <Card key={card.id} card={card} hidden={!finished} small deck={profile.selectedDeck} />)}</View>{finished && <Text style={styles.botScore}>{scoreHand(round.hands[index + 1])}</Text>}</View>)}</View>
      <View style={styles.center}><Text style={styles.centerTitle}>TAUSCH-KARTEN · {MODES[mode].title}</Text><Animated.View style={[styles.cards,{opacity:cardAnim,transform:[{translateX:cardAnim.interpolate({inputRange:[0,1],outputRange:[38,0]})},{scale:cardAnim.interpolate({inputRange:[0,1],outputRange:[.9,1]})}]}]}>{round.middle.map((card, index) => <Card key={card.id} card={card} onPress={!botsPlaying ? () => swapMiddle(index) : undefined} deck={profile.selectedDeck} />)}</Animated.View><Text style={styles.tauntBubble}>💬 {taunt}</Text></View>
      {botAction && <Animated.View style={[styles.moveOverlay,{opacity:moveAnim,transform:[{translateY:moveAnim.interpolate({inputRange:[0,1],outputRange:[-35,0]})},{scale:moveAnim.interpolate({inputRange:[0,1],outputRange:[.82,1]})}]}]}><Text style={styles.moveFace}>{botAction.bot.face}</Text><View style={styles.moveCopy}><Text style={styles.moveName}>{botAction.bot.name}</Text><Text style={styles.moveType}>{botAction.type}</Text>{botAction.taken && <Text style={styles.moveCards}>NIMMT <Text style={styles.moveHot}>{cardLabel(botAction.taken)}</Text>  ·  LEGT <Text style={styles.moveHot}>{cardLabel(botAction.discarded)}</Text></Text>}{botAction.cards && <Text style={styles.moveCards}>{botAction.cards.map(cardLabel).join('  ')}</Text>}</View></Animated.View>}
      <View style={styles.you}><TableAvatar avatar={profile.avatar} small /><View style={styles.youCopy}><Text style={styles.youName}>{profile.playerName || 'DU'} · {playerScore} PUNKTE</Text><Text style={styles.life}>{dots(lives[0])}</Text><Text style={styles.playerReaction}>{reaction}</Text></View><Text style={styles.youBadge}>{finished&&result?.winners.includes(0)?'👑':'JA'}</Text></View>
      <Animated.View style={[styles.cards,{opacity:cardAnim,transform:[{translateY:cardAnim.interpolate({inputRange:[0,1],outputRange:[26,0]})}]}]}>{round.hands[0].map((card, index) => <Card key={card.id} card={card} selected={selected === index} onPress={() => !finished && !botsPlaying && setSelected(index)} deck={profile.selectedDeck} />)}</Animated.View>
    </View></Animated.View>
    <View style={styles.controlPanel}>
    {knock && !finished && <View style={styles.knockBanner}><Text style={styles.knockFist}>✊</Text><View style={{flex:1}}><Text style={styles.knockTitle}>KLOPF!</Text><Text style={styles.knockText}>{knock.by === 0 ? 'Letzte Züge laufen.' : 'Du hast noch einen Zug!'}</Text></View><View style={styles.finalTurnBadge}><Text style={styles.finalTurnNumber}>{countdown||'!'}</Text><Text style={styles.finalTurnText}>{knock.by===0?'START':'ZUG'}</Text></View></View>}
    {result && <View style={[styles.result, result.winners.includes(0) ? styles.win : styles.loss]}><Text style={styles.resultBurst}>{result.winners.includes(0) ? (playerScore === 31 ? '⚡ 31! ⚡' : '👑 JA! 👑') : '💥'}</Text><Text style={styles.resultTitle}>{matchWinner ? (lives[0] > 0 ? 'DU BIST DER LETZTE!' : 'RAUSGEFLOGEN!') : result.winners.includes(0) ? 'VOLLTREFFER!' : 'AUTSCH!'}</Text><Text style={styles.resultSub}>{message}</Text>{result.nextStreak > 1 && <Text style={styles.streak}>🔥 SIEGESSERIE x{result.nextStreak} · BONUS +{Math.min(100,(result.nextStreak-1)*10)} COINS</Text>}</View>}
    {!finished ? <View><Text style={styles.message}>{message}</Text><View style={styles.actions}><TouchableOpacity disabled={botsPlaying} style={[styles.outline,botsPlaying&&styles.disabled]} onPress={swapAll}><Text style={styles.actionText}>↻ ALLE 3{`\n`}TAUSCHEN</Text></TouchableOpacity><TouchableOpacity disabled={botsPlaying} style={[styles.passAction,botsPlaying&&styles.disabled]} onPress={passTurn}><Text style={styles.actionText}>→ SCHIEBEN</Text></TouchableOpacity></View><TouchableOpacity disabled={botsPlaying || Boolean(knock) || !canKnock(turns)} style={[styles.primaryAction,styles.knockAction,(botsPlaying || Boolean(knock) || !canKnock(turns))&&styles.disabled]} onPress={knockNow}><Text style={styles.actionText}>{knock ? '✊ ES WURDE GEKLOPFT' : canKnock(turns) ? '✊ AUF DEN TISCH – JETZT KLOPFEN!' : '🔒 KLOPFEN AB DER 2. RUNDE'}</Text></TouchableOpacity></View> : <View style={styles.replayGrid}><TouchableOpacity style={styles.replayPrimary} onPress={nextRound}><Text style={styles.actionText}>{matchWinner?'NOCH MAL':'NÄCHSTE RUNDE'}</Text></TouchableOpacity><TouchableOpacity style={styles.replayButton} onPress={()=>{setStarted(false);setFinished(false)}}><Text style={styles.actionText}>ANDERE GEGNER</Text></TouchableOpacity><TouchableOpacity style={styles.replayButton} onPress={()=>{setStarted(false);setFinished(false);setShowBattleProfile(true)}}><Text style={styles.actionText}>EINSATZ · MODUS · DESIGN</Text></TouchableOpacity><TouchableOpacity style={styles.replayButton} onPress={onExit}><Text style={styles.actionText}>HAUPTMENÜ</Text></TouchableOpacity></View>}
    </View></View>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:'#050505'},setup:{flex:1,paddingHorizontal:20,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||24)+18:28,paddingBottom:24},game:{paddingHorizontal:12,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||24)+12:20,paddingBottom:35},white:{color:'#fff',fontWeight:'900'},back:{alignSelf:'flex-start',backgroundColor:'#171717',borderColor:'#444',borderWidth:1,paddingVertical:12,paddingHorizontal:15},kicker:{color:RED,fontWeight:'900',letterSpacing:2,textAlign:'center',marginTop:28},title:{color:'#fff',fontSize:42,lineHeight:42,fontWeight:'900',fontStyle:'italic',textAlign:'center',marginTop:8},subtitle:{color:'#888',fontSize:10,fontWeight:'900',textAlign:'center',letterSpacing:1,marginTop:12},countRow:{flexDirection:'row',gap:10,marginTop:24},count:{flex:1,height:92,backgroundColor:'#111',borderColor:'#3b3b3b',borderWidth:2,alignItems:'center',justifyContent:'center'},countActive:{backgroundColor:'#350609',borderColor:RED,transform:[{rotate:'-2deg'}]},countBig:{color:'#fff',fontSize:35,fontWeight:'900'},countLabel:{color:RED,fontSize:9,fontWeight:'900'},chooseTitle:{color:GOLD,fontWeight:'900',fontSize:10,letterSpacing:2,marginTop:20,marginBottom:7},difficultyRow:{flexDirection:'row',gap:6},difficulty:{flex:1,backgroundColor:'#111',borderColor:'#333',borderWidth:1,paddingVertical:10,paddingHorizontal:5,minHeight:72},difficultyActive:{backgroundColor:'#3b070a',borderColor:RED,borderWidth:2},difficultyTitle:{color:'#fff',fontWeight:'900',fontSize:11,textAlign:'center'},difficultySub:{color:'#777',fontSize:7,lineHeight:10,textAlign:'center',marginTop:5},roster:{marginTop:14,gap:7},rosterItem:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#111',borderLeftColor:RED,borderLeftWidth:4,padding:10},face:{fontSize:30},botTitleRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},botName:{color:'#fff',fontWeight:'900'},botStyle:{color:GOLD,fontSize:7,fontWeight:'900',borderColor:'#5d4811',borderWidth:1,paddingHorizontal:5,paddingVertical:2},botLine:{color:'#777',fontSize:9,fontStyle:'italic'},primary:{backgroundColor:RED,padding:17,marginTop:18,transform:[{rotate:'-.5deg'}]},primaryText:{color:'#fff',textAlign:'center',fontWeight:'900',letterSpacing:1},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},arena:{color:'#fff',fontSize:20,fontWeight:'900',fontStyle:'italic',textAlign:'right'},pot:{color:GOLD,fontSize:10,fontWeight:'900',textAlign:'right'},alert:{backgroundColor:RED,padding:9,marginTop:9,transform:[{rotate:'-.5deg'}]},alertText:{color:'#fff',textAlign:'center',fontWeight:'900',fontSize:10},
  tableRail:{backgroundColor:'#080808',borderColor:'#3b3b3b',borderWidth:3,borderRadius:92,padding:8,marginTop:12,shadowColor:RED,shadowOpacity:.8,shadowRadius:24,elevation:18},table:{position:'relative',overflow:'hidden',backgroundColor:'#15070a',borderColor:RED,borderWidth:3,borderRadius:82,paddingHorizontal:8,paddingVertical:18,minHeight:510},tableRing:{position:'absolute',left:8,right:8,top:8,bottom:8,borderColor:'#5b1a20',borderWidth:2,borderRadius:72},tableGlow:{position:'absolute',left:'18%',right:'18%',top:'24%',bottom:'24%',backgroundColor:'#26080d',borderColor:'#7e1a22',borderWidth:1,borderRadius:150,opacity:.8},tableMark:{position:'absolute',left:0,right:0,top:205,alignItems:'center',opacity:.13},tableCrown:{color:GOLD,fontSize:30,lineHeight:31},tableJA:{color:'#fff',fontSize:56,lineHeight:52,fontWeight:'900',fontStyle:'italic'},table31:{color:RED,fontSize:20,fontWeight:'900',letterSpacing:7},opponents:{flexDirection:'row',justifyContent:'space-around',minHeight:120,paddingTop:4,zIndex:2},seat:{width:'32%',alignItems:'center',backgroundColor:'rgba(0,0,0,.52)',borderColor:'#411015',borderWidth:1,borderRadius:16,paddingVertical:6},out:{opacity:.25},faceSmall:{fontSize:27},seatName:{color:'#fff',fontWeight:'900',fontSize:8,maxWidth:100},life:{color:RED,fontWeight:'900',letterSpacing:1,fontSize:12},miniCards:{flexDirection:'row',gap:-13,marginTop:5},botScore:{position:'absolute',right:3,top:3,color:GOLD,fontSize:19,fontWeight:'900'},center:{alignItems:'center',paddingVertical:8,backgroundColor:'rgba(0,0,0,.28)',borderTopWidth:1,borderBottomWidth:1,borderColor:'rgba(227,27,35,.35)',zIndex:2},centerTitle:{color:GOLD,fontSize:9,fontWeight:'900',letterSpacing:2},cards:{flexDirection:'row',justifyContent:'center',gap:8,marginVertical:10,zIndex:3},card:{position:'relative',width:78,height:112,backgroundColor:'#fffdf7',borderColor:'#fff',borderWidth:2,borderRadius:10,padding:6,elevation:9,shadowColor:'#000',shadowOpacity:.7,shadowRadius:5,shadowOffset:{width:0,height:4}},cardSmall:{width:31,height:44,padding:2,borderWidth:1,borderRadius:5},cardBack:{backgroundColor:'#080808',borderColor:RED,alignItems:'center',justifyContent:'center',padding:4},backInset:{width:'100%',height:'100%',borderColor:'#5d151a',borderWidth:2,borderRadius:6,alignItems:'center',justifyContent:'center',backgroundColor:'#130406'},backCrown:{color:GOLD,fontSize:22,lineHeight:22},backCrownSmall:{fontSize:8,lineHeight:8},cardJA:{color:'#fff',fontWeight:'900',fontStyle:'italic',fontSize:19,lineHeight:20},cardJASmall:{fontSize:7,lineHeight:8},selected:{borderColor:GOLD,borderWidth:4,transform:[{translateY:-10},{rotate:'-3deg'}],shadowColor:GOLD,shadowOpacity:1,shadowRadius:9},corner:{position:'absolute',left:6,top:4,alignItems:'center'},cornerBottom:{position:'absolute',right:6,bottom:4,alignItems:'center',transform:[{rotate:'180deg'}]},rank:{color:'#0b0b0b',fontSize:20,lineHeight:21,fontWeight:'900'},rankSmall:{fontSize:8,lineHeight:9},cornerSuit:{color:'#0b0b0b',fontSize:13,lineHeight:14},cornerSuitSmall:{fontSize:6,lineHeight:7},suit:{color:'#0b0b0b',fontSize:39,textAlign:'center',marginTop:27},suitSmall:{fontSize:13,marginTop:12},red:{color:RED},you:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:25,marginTop:12,zIndex:2},youName:{color:'#fff',fontWeight:'900',fontSize:15},youBadge:{width:42,height:42,borderRadius:21,backgroundColor:RED,color:'#fff',textAlign:'center',textAlignVertical:'center',fontWeight:'900',fontStyle:'italic'},moveOverlay:{position:'absolute',zIndex:20,left:16,right:16,top:174,backgroundColor:'#080808',borderColor:GOLD,borderWidth:2,borderLeftColor:RED,borderLeftWidth:7,padding:13,flexDirection:'row',alignItems:'center',gap:11,elevation:20},moveFace:{fontSize:38},moveCopy:{flex:1},moveName:{color:'#fff',fontWeight:'900',fontSize:13},moveType:{color:GOLD,fontWeight:'900',fontSize:20,fontStyle:'italic'},moveCards:{color:'#bbb',fontWeight:'800',fontSize:11,marginTop:3},moveHot:{color:RED,fontSize:17,fontWeight:'900'},message:{color:'#ddd',textAlign:'center',marginVertical:12,minHeight:20},actions:{flexDirection:'row',gap:9},outline:{flex:1,backgroundColor:'#151515',borderColor:'#555',borderWidth:1,padding:14},primaryAction:{flex:1,backgroundColor:RED,padding:14,transform:[{rotate:'-1deg'}]},disabled:{opacity:.35},actionText:{color:'#fff',fontWeight:'900',textAlign:'center',lineHeight:17},result:{marginTop:12,borderWidth:2,padding:13,alignItems:'center'},win:{backgroundColor:'#3b070a',borderColor:RED},loss:{backgroundColor:'#171717',borderColor:'#555'},resultBurst:{fontSize:34,marginBottom:2},resultTitle:{color:'#fff',fontSize:23,fontWeight:'900',fontStyle:'italic'},resultSub:{color:GOLD,textAlign:'center',marginTop:4,fontSize:11},streak:{color:'#fff',backgroundColor:RED,fontSize:10,fontWeight:'900',paddingHorizontal:9,paddingVertical:5,marginTop:9},
  knockBanner:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#3b070a',borderColor:GOLD,borderWidth:2,borderLeftColor:RED,borderLeftWidth:8,padding:12,marginTop:10,shadowColor:RED,shadowOpacity:.9,shadowRadius:12,elevation:16},
  knockFist:{fontSize:42},
  knockTitle:{color:'#fff',fontSize:21,fontWeight:'900',fontStyle:'italic',letterSpacing:1},
  knockText:{color:GOLD,fontSize:10,fontWeight:'800',marginTop:2},
  finalTurnBadge:{width:50,height:50,borderRadius:25,backgroundColor:RED,borderColor:'#fff',borderWidth:2,alignItems:'center',justifyContent:'center'},finalTurnNumber:{color:'#fff',fontSize:21,fontWeight:'900',lineHeight:22},finalTurnText:{color:GOLD,fontSize:6,fontWeight:'900'},
  countdownOverlay:{position:'absolute',top:96,left:'38%',right:'38%',zIndex:50,backgroundColor:'#090909',borderColor:GOLD,borderWidth:3,padding:8,alignItems:'center',shadowColor:RED,shadowOpacity:1,shadowRadius:22,elevation:35},countdownKicker:{color:'#fff',fontSize:7,fontWeight:'900',letterSpacing:1},countdownNumber:{color:RED,fontSize:42,lineHeight:44,fontWeight:'900'},
  passAction:{flex:1,backgroundColor:'#2b2b2b',borderColor:GOLD,borderWidth:1,padding:14,justifyContent:'center'},
  knockAction:{marginTop:9,borderColor:GOLD,borderWidth:2},
  tableAvatar:{width:54,height:54,borderRadius:27,backgroundColor:'#202020',borderColor:RED,borderWidth:3,alignItems:'center',justifyContent:'center',position:'relative',shadowColor:RED,shadowOpacity:.65,shadowRadius:7,elevation:8},
  tableAvatarSmall:{width:43,height:43,borderRadius:22,borderWidth:2},
  tableAvatarFace:{fontSize:28},tableAvatarFaceSmall:{fontSize:23},
  tableAvatarHair:{position:'absolute',top:-12,left:-8,fontSize:21},tableAvatarExtra:{position:'absolute',top:-13,right:-8,fontSize:21},tableAvatarPartSmall:{fontSize:16,top:-10},
  tableAvatarBase:{position:'absolute',bottom:-9,left:-4,right:-4,flexDirection:'row',justifyContent:'space-between'},tableAvatarOutfit:{fontSize:16},tableAvatarFlag:{fontSize:15},tableAvatarBaseSmall:{fontSize:11},
  youCopy:{flex:1,marginLeft:10},
  // Querformat-Arena: spaetere Schluessel ueberschreiben gezielt das bisherige Hochformat.
  setup:{flexGrow:1,paddingHorizontal:30,paddingTop:Platform.OS==='android'?12:18,paddingBottom:24},
  game:{paddingHorizontal:18,paddingTop:Platform.OS==='android'?8:14,paddingBottom:28},
  back:{alignSelf:'flex-start',backgroundColor:'#171717',borderColor:'#444',borderWidth:1,paddingVertical:8,paddingHorizontal:14},
  kicker:{color:RED,fontWeight:'900',letterSpacing:2,textAlign:'center',marginTop:8},
  title:{color:'#fff',fontSize:34,lineHeight:34,fontWeight:'900',fontStyle:'italic',textAlign:'center',marginTop:3},
  subtitle:{color:'#888',fontSize:10,fontWeight:'900',textAlign:'center',letterSpacing:1,marginTop:5},
  countRow:{flexDirection:'row',gap:10,marginTop:10},count:{flex:1,height:68,backgroundColor:'#111',borderColor:'#3b3b3b',borderWidth:2,alignItems:'center',justifyContent:'center'},
  countBig:{color:'#fff',fontSize:28,fontWeight:'900'},chooseTitle:{color:GOLD,fontWeight:'900',fontSize:10,letterSpacing:2,marginTop:10,marginBottom:5},
  difficulty:{flex:1,backgroundColor:'#111',borderColor:'#333',borderWidth:1,paddingVertical:7,paddingHorizontal:5,minHeight:52},
  roster:{marginTop:8,gap:5},rosterItem:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#111',borderLeftColor:RED,borderLeftWidth:4,padding:7},
  primary:{backgroundColor:RED,padding:13,marginTop:10,transform:[{rotate:'-.5deg'}]},
  arena:{color:'#fff',fontSize:18,fontWeight:'900',fontStyle:'italic',textAlign:'right'},alert:{backgroundColor:RED,padding:6,marginTop:4},
  tableRail:{backgroundColor:'#090909',borderColor:RED,borderWidth:5,borderRadius:190,padding:8,marginTop:6,shadowColor:RED,shadowOpacity:.75,shadowRadius:18,elevation:18},
  table:{position:'relative',overflow:'hidden',backgroundColor:'#16191b',borderColor:'#050505',borderWidth:5,borderRadius:180,paddingHorizontal:28,paddingVertical:9,minHeight:386},
  tableRing:{position:'absolute',left:10,right:10,top:10,bottom:10,borderColor:GOLD,borderWidth:1,borderRadius:170,opacity:.55},
  tableGlow:{position:'absolute',left:'25%',right:'25%',top:'24%',bottom:'24%',backgroundColor:'#25070a',borderColor:RED,borderWidth:1,borderRadius:160,opacity:.32},
  tableMark:{position:'absolute',left:0,right:0,top:140,alignItems:'center',opacity:.09},
  tableCrown:{color:GOLD,fontSize:25,lineHeight:25},tableJA:{color:'#fff',fontSize:48,lineHeight:44,fontWeight:'900',fontStyle:'italic'},table31:{color:RED,fontSize:17,fontWeight:'900',letterSpacing:7},
  opponents:{flexDirection:'row',justifyContent:'space-around',minHeight:86,paddingTop:1,zIndex:2},
  seat:{width:'28%',alignItems:'center',backgroundColor:'transparent',paddingVertical:2},
  seatName:{color:'#fff',fontWeight:'900',fontSize:8,maxWidth:110,backgroundColor:'#080808',paddingHorizontal:6,paddingVertical:2,borderRadius:8},
  miniCards:{flexDirection:'row',gap:-11,marginTop:2},
  center:{alignItems:'center',paddingVertical:2,backgroundColor:'rgba(0,0,0,.18)',borderTopWidth:1,borderBottomWidth:1,borderColor:'rgba(241,189,54,.22)',zIndex:2},
  centerTitle:{color:GOLD,fontSize:8,fontWeight:'900',letterSpacing:2},cards:{flexDirection:'row',justifyContent:'center',gap:10,marginVertical:4,zIndex:3},
  card:{position:'relative',width:68,height:94,backgroundColor:'#fffdf7',borderColor:'#fff',borderWidth:2,borderRadius:10,padding:6,elevation:9,shadowColor:'#000',shadowOpacity:.7,shadowRadius:5,shadowOffset:{width:0,height:4}},
  cardSmall:{width:29,height:40,padding:2,borderWidth:1,borderRadius:5},
  selected:{borderColor:GOLD,borderWidth:4,transform:[{translateY:-7},{rotate:'-3deg'}],shadowColor:GOLD,shadowOpacity:1,shadowRadius:9},
  rank:{color:'#0b0b0b',fontSize:18,lineHeight:19,fontWeight:'900'},cornerSuit:{color:'#0b0b0b',fontSize:12,lineHeight:13},suit:{color:'#0b0b0b',fontSize:34,textAlign:'center',marginTop:23},
  you:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:90,marginTop:4,zIndex:2},youName:{color:'#fff',fontWeight:'900',fontSize:14},
  moveOverlay:{position:'absolute',zIndex:20,left:'23%',right:'23%',top:126,backgroundColor:'#080808',borderColor:GOLD,borderWidth:2,borderLeftColor:RED,borderLeftWidth:7,padding:10,flexDirection:'row',alignItems:'center',gap:11,elevation:20},
  modeGrid:{flexDirection:'row',flexWrap:'wrap',gap:6},modeTile:{width:'32%',minHeight:48,backgroundColor:'#111',borderColor:'#333',borderWidth:1,padding:6,justifyContent:'center'},modeTileActive:{backgroundColor:'#3b070a',borderColor:RED,borderWidth:2},modeTitle:{color:'#fff',fontSize:10,fontWeight:'900',textAlign:'center'},modeSub:{color:'#888',fontSize:7,textAlign:'center',marginTop:2},
  battleProfileButton:{backgroundColor:'#191919',borderColor:GOLD,borderWidth:1,padding:10,marginTop:9,alignItems:'center'},battlePanel:{backgroundColor:'#0c0c0c',borderColor:'#333',borderWidth:1,padding:10,marginTop:6},panelHeadline:{color:GOLD,fontSize:9,fontWeight:'900',letterSpacing:2,marginTop:7,marginBottom:5},statsGrid:{flexDirection:'row',flexWrap:'wrap',gap:5},stat:{width:'16%',minWidth:74,backgroundColor:'#171717',padding:6,alignItems:'center'},statValue:{color:RED,fontSize:18,fontWeight:'900'},statLabel:{color:'#888',fontSize:6,fontWeight:'900',textAlign:'center'},unlockRow:{flexDirection:'row',gap:6,flexWrap:'wrap'},unlockTile:{minWidth:105,flex:1,backgroundColor:'#171717',borderColor:'#333',borderWidth:1,padding:7,alignItems:'center'},unlockActive:{backgroundColor:'#3b070a',borderColor:RED,borderWidth:2},unlockIcon:{color:GOLD,fontSize:18,fontWeight:'900'},unlockText:{color:'#fff',fontSize:7,fontWeight:'900',textAlign:'center'},settingRow:{flexDirection:'row',alignItems:'center',gap:10,marginTop:10},settingButton:{backgroundColor:RED,paddingVertical:6,paddingHorizontal:15},achievement:{flexDirection:'row',alignItems:'center',gap:9,backgroundColor:'#151515',padding:7,marginBottom:4},achievementState:{color:RED,fontSize:20,fontWeight:'900'},achievementText:{color:'#888',fontSize:8},
  reactionBubble:{position:'absolute',right:12,top:0,color:GOLD,fontSize:16},tauntBubble:{color:'#ddd',backgroundColor:'#080808',borderColor:'#333',borderWidth:1,paddingHorizontal:9,paddingVertical:3,fontSize:8,fontStyle:'italic',marginTop:1},playerReaction:{color:GOLD,fontSize:8,fontWeight:'900',marginTop:2},
  tableCrownTheme:{borderColor:GOLD,shadowColor:GOLD},tableUnderground:{borderColor:'#777',shadowColor:'#fff'},tableKnock:{borderColor:GOLD,shadowColor:RED,shadowOpacity:1,shadowRadius:30,elevation:28},deckLegend:{backgroundColor:'#201803',borderColor:GOLD},deckSkull:{backgroundColor:'#171717',borderColor:'#aaa'},deckGrunge:{backgroundColor:'#240507',borderColor:RED},
  replayGrid:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:8},replayPrimary:{width:'49%',backgroundColor:RED,borderColor:GOLD,borderWidth:2,padding:12,justifyContent:'center'},replayButton:{width:'49%',backgroundColor:'#171717',borderColor:'#444',borderWidth:1,padding:12,justifyContent:'center'},
  flyingCard:{position:'absolute',left:'47%',top:'43%',zIndex:45,width:58,height:80,borderRadius:8,backgroundColor:'#fffdf7',borderColor:GOLD,borderWidth:3,alignItems:'center',justifyContent:'center',shadowColor:RED,shadowOpacity:1,shadowRadius:16,elevation:30},flyingCardText:{color:'#111',fontSize:18,fontWeight:'900'},
  // Spielfeld 1.8: feste Querformat-Ansicht ohne Scrollen.
  game:{flex:1,paddingHorizontal:8,paddingTop:Platform.OS==='android'?4:7,paddingBottom:6},
  top:{height:34,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},back:{alignSelf:'center',backgroundColor:'#171717',borderColor:'#444',borderWidth:1,paddingVertical:6,paddingHorizontal:11},arena:{color:'#fff',fontSize:15,fontWeight:'900',fontStyle:'italic',textAlign:'right'},pot:{color:GOLD,fontSize:8,fontWeight:'900',textAlign:'right'},
  alert:{height:23,backgroundColor:RED,paddingVertical:4,marginTop:2,justifyContent:'center'},alertText:{color:'#fff',textAlign:'center',fontWeight:'900',fontSize:8},
  arenaBody:{flex:1,flexDirection:'row',gap:8,minHeight:0,paddingTop:4},controlPanel:{width:'29%',backgroundColor:'#0b0b0b',borderColor:'#2d2d2d',borderWidth:1,padding:6,justifyContent:'center'},
  tableRail:{flex:1,backgroundColor:'#090909',borderColor:RED,borderWidth:4,borderRadius:150,padding:5,marginTop:0,shadowColor:RED,shadowOpacity:.65,shadowRadius:12,elevation:15},table:{flex:1,minHeight:0,position:'relative',overflow:'hidden',backgroundColor:'#16191b',borderColor:'#050505',borderWidth:4,borderRadius:145,paddingHorizontal:18,paddingVertical:4},
  tableRing:{position:'absolute',left:7,right:7,top:7,bottom:7,borderColor:GOLD,borderWidth:1,borderRadius:140,opacity:.5},tableMark:{position:'absolute',left:0,right:0,top:'35%',alignItems:'center',opacity:.07},tableCrown:{color:GOLD,fontSize:18,lineHeight:18},tableJA:{color:'#fff',fontSize:35,lineHeight:33,fontWeight:'900',fontStyle:'italic'},table31:{color:RED,fontSize:12,fontWeight:'900',letterSpacing:5},
  opponents:{flexDirection:'row',justifyContent:'space-around',height:57,minHeight:0,paddingTop:0,zIndex:2},seat:{width:'28%',alignItems:'center',backgroundColor:'transparent',paddingVertical:0},tableAvatarSmall:{width:34,height:34,borderRadius:17,borderWidth:2},tableAvatarFaceSmall:{fontSize:18},tableAvatarPartSmall:{fontSize:12,top:-8},tableAvatarBaseSmall:{fontSize:8},seatName:{color:'#fff',fontWeight:'900',fontSize:6,maxWidth:95,backgroundColor:'#080808',paddingHorizontal:4,paddingVertical:1,borderRadius:6},life:{color:RED,fontWeight:'900',letterSpacing:1,fontSize:8},miniCards:{flexDirection:'row',gap:-9,marginTop:1},cardSmall:{width:22,height:29,padding:1,borderWidth:1,borderRadius:4},
  center:{flex:1,minHeight:78,alignItems:'center',justifyContent:'center',paddingVertical:0,backgroundColor:'rgba(0,0,0,.16)',borderTopWidth:1,borderBottomWidth:1,borderColor:'rgba(241,189,54,.22)',zIndex:2},centerTitle:{color:GOLD,fontSize:6,fontWeight:'900',letterSpacing:1},cards:{flexDirection:'row',justifyContent:'center',gap:6,marginVertical:2,zIndex:3},card:{position:'relative',width:50,height:68,backgroundColor:'#fffdf7',borderColor:'#fff',borderWidth:2,borderRadius:7,padding:4,elevation:7,shadowColor:'#000',shadowOpacity:.7,shadowRadius:4},rank:{color:'#0b0b0b',fontSize:13,lineHeight:14,fontWeight:'900'},cornerSuit:{color:'#0b0b0b',fontSize:8,lineHeight:9},suit:{color:'#0b0b0b',fontSize:24,textAlign:'center',marginTop:17},selected:{borderColor:GOLD,borderWidth:3,transform:[{translateY:-4},{rotate:'-3deg'}]},
  you:{height:38,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:58,marginTop:1,zIndex:2},youName:{color:'#fff',fontWeight:'900',fontSize:10},youBadge:{width:28,height:28,borderRadius:14,backgroundColor:RED,color:'#fff',textAlign:'center',textAlignVertical:'center',fontWeight:'900',fontSize:9},playerReaction:{color:GOLD,fontSize:6,fontWeight:'900',marginTop:0},tauntBubble:{color:'#ddd',backgroundColor:'#080808',borderColor:'#333',borderWidth:1,paddingHorizontal:6,paddingVertical:1,fontSize:6,fontStyle:'italic',marginTop:0},
  moveOverlay:{position:'absolute',zIndex:20,left:'22%',right:'22%',top:'34%',backgroundColor:'#080808',borderColor:GOLD,borderWidth:2,borderLeftColor:RED,borderLeftWidth:5,padding:6,flexDirection:'row',alignItems:'center',gap:7,elevation:20},moveFace:{fontSize:24},moveName:{color:'#fff',fontWeight:'900',fontSize:9},moveType:{color:GOLD,fontWeight:'900',fontSize:13,fontStyle:'italic'},moveCards:{color:'#bbb',fontWeight:'800',fontSize:7,marginTop:1},moveHot:{color:RED,fontSize:11,fontWeight:'900'},
  message:{color:'#ddd',textAlign:'center',marginVertical:5,minHeight:28,fontSize:9,lineHeight:13},actions:{flexDirection:'column',gap:5},outline:{backgroundColor:'#151515',borderColor:'#555',borderWidth:1,padding:8},passAction:{backgroundColor:'#2b2b2b',borderColor:GOLD,borderWidth:1,padding:8,justifyContent:'center'},primaryAction:{backgroundColor:RED,padding:8,transform:[{rotate:'-1deg'}]},knockAction:{marginTop:5,borderColor:GOLD,borderWidth:2},actionText:{color:'#fff',fontWeight:'900',textAlign:'center',lineHeight:12,fontSize:8},
  knockBanner:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#3b070a',borderColor:GOLD,borderWidth:1,borderLeftColor:RED,borderLeftWidth:4,padding:5,marginBottom:3},knockFist:{fontSize:20},knockTitle:{color:'#fff',fontSize:11,fontWeight:'900',fontStyle:'italic'},knockText:{color:GOLD,fontSize:7,fontWeight:'800'},finalTurnBadge:{width:31,height:31,borderRadius:16,backgroundColor:RED,borderColor:'#fff',borderWidth:1,alignItems:'center',justifyContent:'center'},finalTurnNumber:{color:'#fff',fontSize:13,fontWeight:'900',lineHeight:14},
  result:{marginTop:0,borderWidth:2,padding:7,alignItems:'center'},resultBurst:{fontSize:18,marginBottom:0},resultTitle:{color:'#fff',fontSize:14,fontWeight:'900',fontStyle:'italic'},resultSub:{color:GOLD,textAlign:'center',marginTop:2,fontSize:7},streak:{color:'#fff',backgroundColor:RED,fontSize:7,fontWeight:'900',paddingHorizontal:5,paddingVertical:3,marginTop:4},replayGrid:{gap:4,marginTop:4},replayPrimary:{width:'100%',backgroundColor:RED,borderColor:GOLD,borderWidth:2,padding:7,justifyContent:'center'},replayButton:{width:'100%',backgroundColor:'#171717',borderColor:'#444',borderWidth:1,padding:6,justifyContent:'center'},
});
