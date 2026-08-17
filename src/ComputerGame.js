import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { bestBotMove, canKnock, dealLocalRound, localRoundResult, scoreHand, shouldBotKnock, swapOne } from './gameEngine';
import { applyRoundResult, recordDailyRound } from './progression';

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

function TableAvatar({ avatar, botFace, small = false }) {
  const data = avatar || { face: botFace || '😎', hair: '', outfit: '🖤', extra: '', flag: '' };
  return <View style={[styles.tableAvatar, small && styles.tableAvatarSmall]}>
    <Text style={[styles.tableAvatarFace, small && styles.tableAvatarFaceSmall]}>{data.face || botFace}</Text>
    {!!data.hair && <Text style={[styles.tableAvatarHair, small && styles.tableAvatarPartSmall]}>{data.hair}</Text>}
    {!!data.extra && <Text style={[styles.tableAvatarExtra, small && styles.tableAvatarPartSmall]}>{data.extra}</Text>}
    <View style={styles.tableAvatarBase}><Text style={[styles.tableAvatarOutfit, small && styles.tableAvatarBaseSmall]}>{data.outfit || '🖤'}</Text><Text style={[styles.tableAvatarFlag, small && styles.tableAvatarBaseSmall]}>{data.flag || ''}</Text></View>
  </View>;
}

function Card({ card, hidden, selected, onPress, small = false }) {
  if (hidden) return <View style={[styles.card, small && styles.cardSmall, styles.cardBack]}><View style={styles.backInset}><Text style={[styles.backCrown, small && styles.backCrownSmall]}>♛</Text><Text style={[styles.cardJA, small && styles.cardJASmall]}>JA</Text></View></View>;
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
  const moveAnim = useRef(new Animated.Value(0)).current;

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
    setLives(Array(totalPlayers).fill(3));
    setRound(dealLocalRound(totalPlayers));
    setStarted(true); setFinished(false); setResult(null); setSelected(null); setTurns(0);
    setKnock(null);
    setMessage(`${totalPlayers - 1} Computergegner. Einer bleibt übrig.`);
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
    setProfile((current) => recordDailyRound(applyRoundResult(current, humanWon ? 'win' : humanLost ? 'loss' : 'draw', stake), humanWon ? 'win' : humanLost ? 'loss' : 'draw', scoreHand(nextRound.hands[0])));
    Haptics.notificationAsync(humanWon ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
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
      setMessage(`${BOTS[index - 1].name} ist am Zug …`);
      setRound({ ...nextRound, hands: [...hands], middle: [...middle] });
      Haptics.selectionAsync();
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setMessage(`✊ ${nextKnock.name} KLOPFT! DU HAST JETZT GENAU EINEN LETZTEN ZUG.`);
    }
    else { setRound(updated); setMessage('Dein Zug – welche Karte holst du dir?'); }
  }

  function finishHumanMove(nextRound) {
    if (knock) runBots(nextRound, { finalAfterHuman: true });
    else runBots(nextRound);
  }

  function swapMiddle(middleIndex) {
    if (selected === null || finished || botsPlaying) return;
    const move = swapOne(round.hands[0], round.middle, selected, middleIndex);
    const hands = [...round.hands]; hands[0] = move.hand;
    setSelected(null); Haptics.selectionAsync(); finishHumanMove({ ...round, hands, middle: move.middle });
  }

  function swapAll() {
    if (finished || botsPlaying) return;
    const hands = [...round.hands]; const old = hands[0]; hands[0] = round.middle;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); finishHumanMove({ ...round, hands, middle: old });
  }

  function passTurn() {
    if (finished || botsPlaying) return;
    setSelected(null);
    Haptics.selectionAsync();
    finishHumanMove(round);
  }

  function knockNow() {
    if (finished || botsPlaying || knock || !canKnock(turns)) return;
    setKnock({ by: 0, name: profile.playerName || 'DU' });
    setSelected(null);
    setMessage('✊ DU KLOPFST! JEDER GEGNER HAT NUR NOCH EINEN LETZTEN ZUG.');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    runBots(round, { humanKnocked: true });
  }

  function nextRound() {
    const alive = lives.map((life, index) => life > 0 ? index : -1).filter((index) => index >= 0);
    if (alive.length <= 1) { setStarted(false); setRound(null); return; }
    setRound(dealLocalRound(totalPlayers)); setFinished(false); setResult(null); setSelected(null); setTurns(0);
    setKnock(null);
    setMessage('Neue Runde. Neue Karten. Keine Ausreden.');
  }

  if (!started) return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.setup}>
    <TouchableOpacity style={styles.back} onPress={onExit}><Text style={styles.white}>‹ HAUPTMENÜ</Text></TouchableOpacity>
    <Text style={styles.kicker}>JA 31 · COMPUTER-ARENA</Text><Text style={styles.title}>WIE VIELE{`\n`}GEGNER?</Text>
    <Text style={styles.subtitle}>DU + BIS ZU DREI COMPUTER. MAXIMAL VIER AM TISCH.</Text>
    <View style={styles.countRow}>{[1, 2, 3].map((count) => <TouchableOpacity key={count} onPress={() => setTotalPlayers(count + 1)} style={[styles.count, totalPlayers === count + 1 && styles.countActive]}><Text style={styles.countBig}>{count}</Text><Text style={styles.countLabel}>{count === 1 ? 'GEGNER' : 'GEGNER'}</Text></TouchableOpacity>)}</View>
    <Text style={styles.chooseTitle}>SCHWIERIGKEIT</Text><View style={styles.difficultyRow}>{Object.entries(DIFFICULTIES).map(([key,value])=><TouchableOpacity key={key} onPress={()=>setDifficulty(key)} style={[styles.difficulty,difficulty===key&&styles.difficultyActive]}><Text style={styles.difficultyTitle}>{value.title}</Text><Text style={styles.difficultySub}>{value.subtitle}</Text></TouchableOpacity>)}</View>
    <View style={styles.roster}>{BOTS.slice(0, totalPlayers - 1).map((bot) => <View key={bot.name} style={styles.rosterItem}><Text style={styles.face}>{bot.face}</Text><View style={{flex:1}}><View style={styles.botTitleRow}><Text style={styles.botName}>{bot.name}</Text><Text style={styles.botStyle}>{bot.style}</Text></View><Text style={styles.botLine}>{bot.line}</Text></View></View>)}</View>
    <TouchableOpacity style={styles.primary} onPress={startGame}><Text style={styles.primaryText}>ARENA STARTEN 🔥</Text></TouchableOpacity>
  </ScrollView></SafeAreaView>;

  const alive = lives.filter((value) => value > 0).length;
  const matchWinner = alive <= 1;
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.game}>
    <View style={styles.top}><TouchableOpacity style={styles.back} onPress={onExit}><Text style={styles.white}>‹ MENÜ</Text></TouchableOpacity><View><Text style={styles.arena}>JA-ARENA</Text><Text style={styles.pot}>EINSATZ ◉ {stake}</Text></View></View>
    <View style={styles.alert}><Text style={styles.alertText}>{finished ? 'RUNDE ENTSCHIEDEN!' : knock ? `✊ ${knock.name} HAT GEKLOPFT – LETZTE ZÜGE!` : botsPlaying ? '🤖 COMPUTERZUG – GENAU HINSCHAUEN!' : '⚡ DU BIST DRAN – KEINE ZEIT VERLIEREN!'}</Text></View>
    {knock && !finished && <View style={styles.knockBanner}><Text style={styles.knockFist}>✊</Text><View style={{flex:1}}><Text style={styles.knockTitle}>KLOPF! KLOPF!</Text><Text style={styles.knockText}>{knock.by === 0 ? 'Die Gegner spielen jetzt genau einmal.' : 'Das ist dein letzter Zug – danach wird aufgedeckt!'}</Text></View></View>}
    <View style={styles.tableRail}><View style={styles.table}>
      <View style={styles.tableRing} />
      <View style={styles.tableGlow} />
      <View style={styles.tableMark}><Text style={styles.tableCrown}>♛</Text><Text style={styles.tableJA}>JA</Text><Text style={styles.table31}>31</Text></View>
      <View style={styles.opponents}>{BOTS.slice(0, totalPlayers - 1).map((bot, index) => <View key={bot.name} style={[styles.seat, lives[index + 1] === 0 && styles.out]}><TableAvatar botFace={bot.face} small /><Text numberOfLines={1} style={styles.seatName}>{bot.name}</Text><Text style={styles.life}>{dots(lives[index + 1])}</Text><View style={styles.miniCards}>{round.hands[index + 1].map((card) => <Card key={card.id} card={card} hidden={!finished} small />)}</View>{finished && <Text style={styles.botScore}>{scoreHand(round.hands[index + 1])}</Text>}</View>)}</View>
      <View style={styles.center}><Text style={styles.centerTitle}>TAUSCH-KARTEN</Text><View style={styles.cards}>{round.middle.map((card, index) => <Card key={card.id} card={card} onPress={!botsPlaying ? () => swapMiddle(index) : undefined} />)}</View></View>
      {botAction && <Animated.View style={[styles.moveOverlay,{opacity:moveAnim,transform:[{translateY:moveAnim.interpolate({inputRange:[0,1],outputRange:[-35,0]})},{scale:moveAnim.interpolate({inputRange:[0,1],outputRange:[.82,1]})}]}]}><Text style={styles.moveFace}>{botAction.bot.face}</Text><View style={styles.moveCopy}><Text style={styles.moveName}>{botAction.bot.name}</Text><Text style={styles.moveType}>{botAction.type}</Text>{botAction.taken && <Text style={styles.moveCards}>NIMMT <Text style={styles.moveHot}>{cardLabel(botAction.taken)}</Text>  ·  LEGT <Text style={styles.moveHot}>{cardLabel(botAction.discarded)}</Text></Text>}{botAction.cards && <Text style={styles.moveCards}>{botAction.cards.map(cardLabel).join('  ')}</Text>}</View></Animated.View>}
      <View style={styles.you}><TableAvatar avatar={profile.avatar} /><View style={styles.youCopy}><Text style={styles.youName}>{profile.playerName || 'DU'} · {playerScore} PUNKTE</Text><Text style={styles.life}>{dots(lives[0])}</Text></View><Text style={styles.youBadge}>JA</Text></View>
      <View style={styles.cards}>{round.hands[0].map((card, index) => <Card key={card.id} card={card} selected={selected === index} onPress={() => !finished && !botsPlaying && setSelected(index)} />)}</View>
    </View></View>
    {result && <View style={[styles.result, result.winners.includes(0) ? styles.win : styles.loss]}><Text style={styles.resultBurst}>{result.winners.includes(0) ? (playerScore === 31 ? '⚡ 31! ⚡' : '👑 JA! 👑') : '💥'}</Text><Text style={styles.resultTitle}>{matchWinner ? (lives[0] > 0 ? 'DU BIST DER LETZTE!' : 'RAUSGEFLOGEN!') : result.winners.includes(0) ? 'VOLLTREFFER!' : 'AUTSCH!'}</Text><Text style={styles.resultSub}>{message}</Text>{result.nextStreak > 1 && <Text style={styles.streak}>🔥 SIEGESSERIE x{result.nextStreak} · BONUS +{Math.min(100,(result.nextStreak-1)*10)} COINS</Text>}</View>}
    {!finished ? <View><Text style={styles.message}>{message}</Text><View style={styles.actions}><TouchableOpacity disabled={botsPlaying} style={[styles.outline,botsPlaying&&styles.disabled]} onPress={swapAll}><Text style={styles.actionText}>↻ ALLE 3{`\n`}TAUSCHEN</Text></TouchableOpacity><TouchableOpacity disabled={botsPlaying} style={[styles.passAction,botsPlaying&&styles.disabled]} onPress={passTurn}><Text style={styles.actionText}>→ SCHIEBEN</Text></TouchableOpacity></View><TouchableOpacity disabled={botsPlaying || Boolean(knock) || !canKnock(turns)} style={[styles.primaryAction,styles.knockAction,(botsPlaying || Boolean(knock) || !canKnock(turns))&&styles.disabled]} onPress={knockNow}><Text style={styles.actionText}>{knock ? '✊ ES WURDE GEKLOPFT' : canKnock(turns) ? '✊ AUF DEN TISCH – JETZT KLOPFEN!' : '🔒 KLOPFEN AB DER 2. RUNDE'}</Text></TouchableOpacity></View> : <TouchableOpacity style={styles.primary} onPress={nextRound}><Text style={styles.primaryText}>{matchWinner ? 'NEUES MATCH' : 'NÄCHSTE RUNDE'}</Text></TouchableOpacity>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:'#050505'},setup:{flex:1,paddingHorizontal:20,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||24)+18:28,paddingBottom:24},game:{paddingHorizontal:12,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||24)+12:20,paddingBottom:35},white:{color:'#fff',fontWeight:'900'},back:{alignSelf:'flex-start',backgroundColor:'#171717',borderColor:'#444',borderWidth:1,paddingVertical:12,paddingHorizontal:15},kicker:{color:RED,fontWeight:'900',letterSpacing:2,textAlign:'center',marginTop:28},title:{color:'#fff',fontSize:42,lineHeight:42,fontWeight:'900',fontStyle:'italic',textAlign:'center',marginTop:8},subtitle:{color:'#888',fontSize:10,fontWeight:'900',textAlign:'center',letterSpacing:1,marginTop:12},countRow:{flexDirection:'row',gap:10,marginTop:24},count:{flex:1,height:92,backgroundColor:'#111',borderColor:'#3b3b3b',borderWidth:2,alignItems:'center',justifyContent:'center'},countActive:{backgroundColor:'#350609',borderColor:RED,transform:[{rotate:'-2deg'}]},countBig:{color:'#fff',fontSize:35,fontWeight:'900'},countLabel:{color:RED,fontSize:9,fontWeight:'900'},chooseTitle:{color:GOLD,fontWeight:'900',fontSize:10,letterSpacing:2,marginTop:20,marginBottom:7},difficultyRow:{flexDirection:'row',gap:6},difficulty:{flex:1,backgroundColor:'#111',borderColor:'#333',borderWidth:1,paddingVertical:10,paddingHorizontal:5,minHeight:72},difficultyActive:{backgroundColor:'#3b070a',borderColor:RED,borderWidth:2},difficultyTitle:{color:'#fff',fontWeight:'900',fontSize:11,textAlign:'center'},difficultySub:{color:'#777',fontSize:7,lineHeight:10,textAlign:'center',marginTop:5},roster:{marginTop:14,gap:7},rosterItem:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#111',borderLeftColor:RED,borderLeftWidth:4,padding:10},face:{fontSize:30},botTitleRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},botName:{color:'#fff',fontWeight:'900'},botStyle:{color:GOLD,fontSize:7,fontWeight:'900',borderColor:'#5d4811',borderWidth:1,paddingHorizontal:5,paddingVertical:2},botLine:{color:'#777',fontSize:9,fontStyle:'italic'},primary:{backgroundColor:RED,padding:17,marginTop:18,transform:[{rotate:'-.5deg'}]},primaryText:{color:'#fff',textAlign:'center',fontWeight:'900',letterSpacing:1},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},arena:{color:'#fff',fontSize:20,fontWeight:'900',fontStyle:'italic',textAlign:'right'},pot:{color:GOLD,fontSize:10,fontWeight:'900',textAlign:'right'},alert:{backgroundColor:RED,padding:9,marginTop:9,transform:[{rotate:'-.5deg'}]},alertText:{color:'#fff',textAlign:'center',fontWeight:'900',fontSize:10},
  tableRail:{backgroundColor:'#080808',borderColor:'#3b3b3b',borderWidth:3,borderRadius:92,padding:8,marginTop:12,shadowColor:RED,shadowOpacity:.8,shadowRadius:24,elevation:18},table:{position:'relative',overflow:'hidden',backgroundColor:'#15070a',borderColor:RED,borderWidth:3,borderRadius:82,paddingHorizontal:8,paddingVertical:18,minHeight:510},tableRing:{position:'absolute',left:8,right:8,top:8,bottom:8,borderColor:'#5b1a20',borderWidth:2,borderRadius:72},tableGlow:{position:'absolute',left:'18%',right:'18%',top:'24%',bottom:'24%',backgroundColor:'#26080d',borderColor:'#7e1a22',borderWidth:1,borderRadius:150,opacity:.8},tableMark:{position:'absolute',left:0,right:0,top:205,alignItems:'center',opacity:.13},tableCrown:{color:GOLD,fontSize:30,lineHeight:31},tableJA:{color:'#fff',fontSize:56,lineHeight:52,fontWeight:'900',fontStyle:'italic'},table31:{color:RED,fontSize:20,fontWeight:'900',letterSpacing:7},opponents:{flexDirection:'row',justifyContent:'space-around',minHeight:120,paddingTop:4,zIndex:2},seat:{width:'32%',alignItems:'center',backgroundColor:'rgba(0,0,0,.52)',borderColor:'#411015',borderWidth:1,borderRadius:16,paddingVertical:6},out:{opacity:.25},faceSmall:{fontSize:27},seatName:{color:'#fff',fontWeight:'900',fontSize:8,maxWidth:100},life:{color:RED,fontWeight:'900',letterSpacing:1,fontSize:12},miniCards:{flexDirection:'row',gap:-13,marginTop:5},botScore:{position:'absolute',right:3,top:3,color:GOLD,fontSize:19,fontWeight:'900'},center:{alignItems:'center',paddingVertical:8,backgroundColor:'rgba(0,0,0,.28)',borderTopWidth:1,borderBottomWidth:1,borderColor:'rgba(227,27,35,.35)',zIndex:2},centerTitle:{color:GOLD,fontSize:9,fontWeight:'900',letterSpacing:2},cards:{flexDirection:'row',justifyContent:'center',gap:8,marginVertical:10,zIndex:3},card:{position:'relative',width:78,height:112,backgroundColor:'#fffdf7',borderColor:'#fff',borderWidth:2,borderRadius:10,padding:6,elevation:9,shadowColor:'#000',shadowOpacity:.7,shadowRadius:5,shadowOffset:{width:0,height:4}},cardSmall:{width:31,height:44,padding:2,borderWidth:1,borderRadius:5},cardBack:{backgroundColor:'#080808',borderColor:RED,alignItems:'center',justifyContent:'center',padding:4},backInset:{width:'100%',height:'100%',borderColor:'#5d151a',borderWidth:2,borderRadius:6,alignItems:'center',justifyContent:'center',backgroundColor:'#130406'},backCrown:{color:GOLD,fontSize:22,lineHeight:22},backCrownSmall:{fontSize:8,lineHeight:8},cardJA:{color:'#fff',fontWeight:'900',fontStyle:'italic',fontSize:19,lineHeight:20},cardJASmall:{fontSize:7,lineHeight:8},selected:{borderColor:GOLD,borderWidth:4,transform:[{translateY:-10},{rotate:'-3deg'}],shadowColor:GOLD,shadowOpacity:1,shadowRadius:9},corner:{position:'absolute',left:6,top:4,alignItems:'center'},cornerBottom:{position:'absolute',right:6,bottom:4,alignItems:'center',transform:[{rotate:'180deg'}]},rank:{color:'#0b0b0b',fontSize:20,lineHeight:21,fontWeight:'900'},rankSmall:{fontSize:8,lineHeight:9},cornerSuit:{color:'#0b0b0b',fontSize:13,lineHeight:14},cornerSuitSmall:{fontSize:6,lineHeight:7},suit:{color:'#0b0b0b',fontSize:39,textAlign:'center',marginTop:27},suitSmall:{fontSize:13,marginTop:12},red:{color:RED},you:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:25,marginTop:12,zIndex:2},youName:{color:'#fff',fontWeight:'900',fontSize:15},youBadge:{width:42,height:42,borderRadius:21,backgroundColor:RED,color:'#fff',textAlign:'center',textAlignVertical:'center',fontWeight:'900',fontStyle:'italic'},moveOverlay:{position:'absolute',zIndex:20,left:16,right:16,top:174,backgroundColor:'#080808',borderColor:GOLD,borderWidth:2,borderLeftColor:RED,borderLeftWidth:7,padding:13,flexDirection:'row',alignItems:'center',gap:11,elevation:20},moveFace:{fontSize:38},moveCopy:{flex:1},moveName:{color:'#fff',fontWeight:'900',fontSize:13},moveType:{color:GOLD,fontWeight:'900',fontSize:20,fontStyle:'italic'},moveCards:{color:'#bbb',fontWeight:'800',fontSize:11,marginTop:3},moveHot:{color:RED,fontSize:17,fontWeight:'900'},message:{color:'#ddd',textAlign:'center',marginVertical:12,minHeight:20},actions:{flexDirection:'row',gap:9},outline:{flex:1,backgroundColor:'#151515',borderColor:'#555',borderWidth:1,padding:14},primaryAction:{flex:1,backgroundColor:RED,padding:14,transform:[{rotate:'-1deg'}]},disabled:{opacity:.35},actionText:{color:'#fff',fontWeight:'900',textAlign:'center',lineHeight:17},result:{marginTop:12,borderWidth:2,padding:13,alignItems:'center'},win:{backgroundColor:'#3b070a',borderColor:RED},loss:{backgroundColor:'#171717',borderColor:'#555'},resultBurst:{fontSize:34,marginBottom:2},resultTitle:{color:'#fff',fontSize:23,fontWeight:'900',fontStyle:'italic'},resultSub:{color:GOLD,textAlign:'center',marginTop:4,fontSize:11},streak:{color:'#fff',backgroundColor:RED,fontSize:10,fontWeight:'900',paddingHorizontal:9,paddingVertical:5,marginTop:9},
  knockBanner:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#3b070a',borderColor:GOLD,borderWidth:2,borderLeftColor:RED,borderLeftWidth:8,padding:12,marginTop:10,shadowColor:RED,shadowOpacity:.9,shadowRadius:12,elevation:16},
  knockFist:{fontSize:42},
  knockTitle:{color:'#fff',fontSize:21,fontWeight:'900',fontStyle:'italic',letterSpacing:1},
  knockText:{color:GOLD,fontSize:10,fontWeight:'800',marginTop:2},
  passAction:{flex:1,backgroundColor:'#2b2b2b',borderColor:GOLD,borderWidth:1,padding:14,justifyContent:'center'},
  knockAction:{marginTop:9,borderColor:GOLD,borderWidth:2},
  tableAvatar:{width:54,height:54,borderRadius:27,backgroundColor:'#202020',borderColor:RED,borderWidth:3,alignItems:'center',justifyContent:'center',position:'relative',shadowColor:RED,shadowOpacity:.65,shadowRadius:7,elevation:8},
  tableAvatarSmall:{width:43,height:43,borderRadius:22,borderWidth:2},
  tableAvatarFace:{fontSize:28},tableAvatarFaceSmall:{fontSize:23},
  tableAvatarHair:{position:'absolute',top:-12,left:-8,fontSize:21},tableAvatarExtra:{position:'absolute',top:-13,right:-8,fontSize:21},tableAvatarPartSmall:{fontSize:16,top:-10},
  tableAvatarBase:{position:'absolute',bottom:-9,left:-4,right:-4,flexDirection:'row',justifyContent:'space-between'},tableAvatarOutfit:{fontSize:16},tableAvatarFlag:{fontSize:15},tableAvatarBaseSmall:{fontSize:11},
  youCopy:{flex:1,marginLeft:10},
});
