import React, { useMemo, useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { bestBotMove, dealLocalRound, localRoundResult, scoreHand, shouldBotKnock, swapOne } from './gameEngine';
import { applyRoundResult, recordDailyRound } from './progression';

const RED = '#e31b23';
const GOLD = '#f1bd36';
const BOTS = [
  { name: 'KARTEN-KALLE', face: '😎', line: 'Ich rieche schlechte Karten.' },
  { name: 'ROTE KÖNIGIN', face: '😈', line: 'Null Mitleid. Volles Risiko.' },
  { name: 'DER SCHÄFER', face: '🤠', line: 'Jetzt wird abgerechnet.' },
];

function Card({ card, hidden, selected, onPress, small = false }) {
  if (hidden) return <View style={[styles.card, small && styles.cardSmall, styles.cardBack]}><Text style={styles.cardJA}>JA</Text></View>;
  const red = card.suit === '♥' || card.suit === '♦';
  return <TouchableOpacity disabled={!onPress} onPress={onPress} style={[styles.card, small && styles.cardSmall, selected && styles.selected]}>
    <Text style={[styles.rank, small && styles.rankSmall, red && styles.red]}>{card.rank}</Text>
    <Text style={[styles.suit, small && styles.suitSmall, red && styles.red]}>{card.suit}</Text>
  </TouchableOpacity>;
}

const dots = (lives) => `${'●'.repeat(lives)}${'○'.repeat(3 - lives)}`;

export default function ComputerGame({ profile, setProfile, stake, onExit }) {
  const [totalPlayers, setTotalPlayers] = useState(2);
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(null);
  const [lives, setLives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState(null);
  const [turns, setTurns] = useState(0);
  const [message, setMessage] = useState('Du bist dran. Mach Krach!');

  const playerScore = useMemo(() => round ? scoreHand(round.hands[0]) : 0, [round]);

  function startGame() {
    setLives(Array(totalPlayers).fill(3));
    setRound(dealLocalRound(totalPlayers));
    setStarted(true); setFinished(false); setResult(null); setSelected(null); setTurns(0);
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
    setLives(nextLives); setRound(nextRound); setFinished(true); setResult(outcome);
    setProfile((current) => recordDailyRound(applyRoundResult(current, humanWon ? 'win' : humanLost ? 'loss' : 'draw', stake), humanWon ? 'win' : humanLost ? 'loss' : 'draw', scoreHand(nextRound.hands[0])));
    Haptics.notificationAsync(humanWon ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    setMessage(`${reason} ${outcome.losers.includes(0) ? 'Autsch – du verlierst ein Leben.' : 'JA! Du bleibst stehen.'}`);
  }

  function runBots(nextRound) {
    const hands = [...nextRound.hands];
    let middle = nextRound.middle;
    let botKnocker = null;
    for (let index = 1; index < totalPlayers; index += 1) {
      if (lives[index] <= 0) continue;
      const move = bestBotMove(hands[index], middle);
      hands[index] = move.hand; middle = move.middle;
      if (botKnocker === null && shouldBotKnock(hands[index], turns + 1)) botKnocker = index;
    }
    const updated = { ...nextRound, hands, middle };
    setTurns((value) => value + 1);
    if (botKnocker !== null) decide(updated, `${BOTS[botKnocker - 1].name} KLOPFT!`);
    else { setRound(updated); setMessage('Die Computer haben gezogen. Du bist sofort wieder dran!'); }
  }

  function swapMiddle(middleIndex) {
    if (selected === null || finished) return;
    const move = swapOne(round.hands[0], round.middle, selected, middleIndex);
    const hands = [...round.hands]; hands[0] = move.hand;
    setSelected(null); Haptics.selectionAsync(); runBots({ ...round, hands, middle: move.middle });
  }

  function swapAll() {
    if (finished) return;
    const hands = [...round.hands]; const old = hands[0]; hands[0] = round.middle;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); runBots({ ...round, hands, middle: old });
  }

  function nextRound() {
    const alive = lives.map((life, index) => life > 0 ? index : -1).filter((index) => index >= 0);
    if (alive.length <= 1) { setStarted(false); setRound(null); return; }
    setRound(dealLocalRound(totalPlayers)); setFinished(false); setResult(null); setSelected(null); setTurns(0);
    setMessage('Neue Runde. Neue Karten. Keine Ausreden.');
  }

  if (!started) return <SafeAreaView style={styles.page}><View style={styles.setup}>
    <TouchableOpacity style={styles.back} onPress={onExit}><Text style={styles.white}>‹ HAUPTMENÜ</Text></TouchableOpacity>
    <Text style={styles.kicker}>JA 31 · COMPUTER-ARENA</Text><Text style={styles.title}>WIE VIELE{`\n`}GEGNER?</Text>
    <Text style={styles.subtitle}>DU + BIS ZU DREI COMPUTER. MAXIMAL VIER AM TISCH.</Text>
    <View style={styles.countRow}>{[1, 2, 3].map((count) => <TouchableOpacity key={count} onPress={() => setTotalPlayers(count + 1)} style={[styles.count, totalPlayers === count + 1 && styles.countActive]}><Text style={styles.countBig}>{count}</Text><Text style={styles.countLabel}>{count === 1 ? 'GEGNER' : 'GEGNER'}</Text></TouchableOpacity>)}</View>
    <View style={styles.roster}>{BOTS.slice(0, totalPlayers - 1).map((bot) => <View key={bot.name} style={styles.rosterItem}><Text style={styles.face}>{bot.face}</Text><View><Text style={styles.botName}>{bot.name}</Text><Text style={styles.botLine}>{bot.line}</Text></View></View>)}</View>
    <TouchableOpacity style={styles.primary} onPress={startGame}><Text style={styles.primaryText}>ARENA STARTEN 🔥</Text></TouchableOpacity>
  </View></SafeAreaView>;

  const alive = lives.filter((value) => value > 0).length;
  const matchWinner = alive <= 1;
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.game}>
    <View style={styles.top}><TouchableOpacity style={styles.back} onPress={onExit}><Text style={styles.white}>‹ MENÜ</Text></TouchableOpacity><View><Text style={styles.arena}>JA-ARENA</Text><Text style={styles.pot}>EINSATZ ◉ {stake}</Text></View></View>
    <View style={styles.alert}><Text style={styles.alertText}>{finished ? 'RUNDE ENTSCHIEDEN!' : '⚡ DU BIST DRAN – KEINE ZEIT VERLIEREN!'}</Text></View>
    <View style={styles.table}>
      <View style={styles.tableRing} />
      <View style={styles.opponents}>{BOTS.slice(0, totalPlayers - 1).map((bot, index) => <View key={bot.name} style={[styles.seat, lives[index + 1] === 0 && styles.out]}><Text style={styles.faceSmall}>{bot.face}</Text><Text numberOfLines={1} style={styles.seatName}>{bot.name}</Text><Text style={styles.life}>{dots(lives[index + 1])}</Text><View style={styles.miniCards}>{round.hands[index + 1].map((card) => <Card key={card.id} card={card} hidden={!finished} small />)}</View>{finished && <Text style={styles.botScore}>{scoreHand(round.hands[index + 1])}</Text>}</View>)}</View>
      <View style={styles.center}><Text style={styles.centerTitle}>MITTE</Text><View style={styles.cards}>{round.middle.map((card, index) => <Card key={card.id} card={card} onPress={() => swapMiddle(index)} />)}</View></View>
      <View style={styles.you}><View><Text style={styles.youName}>{profile.playerName || 'DU'} · {playerScore}</Text><Text style={styles.life}>{dots(lives[0])}</Text></View><Text style={styles.youBadge}>JA</Text></View>
      <View style={styles.cards}>{round.hands[0].map((card, index) => <Card key={card.id} card={card} selected={selected === index} onPress={() => !finished && setSelected(index)} />)}</View>
    </View>
    {result && <View style={[styles.result, result.winners.includes(0) ? styles.win : styles.loss]}><Text style={styles.resultTitle}>{matchWinner ? (lives[0] > 0 ? 'DU BIST DER LETZTE!' : 'RAUSGEFLOGEN!') : result.winners.includes(0) ? 'VOLLTREFFER!' : 'AUTSCH!'}</Text><Text style={styles.resultSub}>{message}</Text></View>}
    {!finished ? <View><Text style={styles.message}>{message}</Text><View style={styles.actions}><TouchableOpacity style={styles.outline} onPress={swapAll}><Text style={styles.actionText}>↻ ALLE 3{`\n`}TAUSCHEN</Text></TouchableOpacity><TouchableOpacity style={styles.primaryAction} onPress={() => decide(round, 'DU KLOPFST!')}><Text style={styles.actionText}>✊ JETZT{`\n`}KLOPFEN!</Text></TouchableOpacity></View></View> : <TouchableOpacity style={styles.primary} onPress={nextRound}><Text style={styles.primaryText}>{matchWinner ? 'NEUES MATCH' : 'NÄCHSTE RUNDE'}</Text></TouchableOpacity>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:'#050505'},setup:{flex:1,paddingHorizontal:20,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||24)+18:28,paddingBottom:24},game:{paddingHorizontal:12,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||24)+12:20,paddingBottom:35},white:{color:'#fff',fontWeight:'900'},back:{alignSelf:'flex-start',backgroundColor:'#171717',borderColor:'#444',borderWidth:1,paddingVertical:12,paddingHorizontal:15},kicker:{color:RED,fontWeight:'900',letterSpacing:2,textAlign:'center',marginTop:28},title:{color:'#fff',fontSize:42,lineHeight:42,fontWeight:'900',fontStyle:'italic',textAlign:'center',marginTop:8},subtitle:{color:'#888',fontSize:10,fontWeight:'900',textAlign:'center',letterSpacing:1,marginTop:12},countRow:{flexDirection:'row',gap:10,marginTop:24},count:{flex:1,height:92,backgroundColor:'#111',borderColor:'#3b3b3b',borderWidth:2,alignItems:'center',justifyContent:'center'},countActive:{backgroundColor:'#350609',borderColor:RED,transform:[{rotate:'-2deg'}]},countBig:{color:'#fff',fontSize:35,fontWeight:'900'},countLabel:{color:RED,fontSize:9,fontWeight:'900'},roster:{marginTop:18,gap:7},rosterItem:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#111',borderLeftColor:RED,borderLeftWidth:4,padding:10},face:{fontSize:30},botName:{color:'#fff',fontWeight:'900'},botLine:{color:'#777',fontSize:9,fontStyle:'italic'},primary:{backgroundColor:RED,padding:17,marginTop:18,transform:[{rotate:'-.5deg'}]},primaryText:{color:'#fff',textAlign:'center',fontWeight:'900',letterSpacing:1},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},arena:{color:'#fff',fontSize:20,fontWeight:'900',fontStyle:'italic',textAlign:'right'},pot:{color:GOLD,fontSize:10,fontWeight:'900',textAlign:'right'},alert:{backgroundColor:RED,padding:9,marginTop:9,transform:[{rotate:'-.5deg'}]},alertText:{color:'#fff',textAlign:'center',fontWeight:'900',fontSize:10},table:{position:'relative',overflow:'hidden',backgroundColor:'#102217',borderColor:'#561014',borderWidth:4,borderRadius:120,paddingHorizontal:8,paddingVertical:16,marginTop:10,shadowColor:RED,shadowOpacity:.55,shadowRadius:18,elevation:12},tableRing:{position:'absolute',left:8,right:8,top:8,bottom:8,borderColor:'#8d2226',borderWidth:2,borderRadius:115,opacity:.7},opponents:{flexDirection:'row',justifyContent:'space-around',minHeight:114},seat:{width:'32%',alignItems:'center'},out:{opacity:.25},faceSmall:{fontSize:27},seatName:{color:'#fff',fontWeight:'900',fontSize:8,maxWidth:100},life:{color:RED,fontWeight:'900',letterSpacing:1,fontSize:12},miniCards:{flexDirection:'row',gap:-13,marginTop:5},botScore:{position:'absolute',right:3,top:3,color:GOLD,fontSize:19,fontWeight:'900'},center:{alignItems:'center',paddingVertical:2},centerTitle:{color:'#a19a91',fontSize:9,fontWeight:'900',letterSpacing:2},cards:{flexDirection:'row',justifyContent:'center',gap:7,marginVertical:7},card:{width:78,height:108,backgroundColor:'#faf5e9',borderColor:'#d6cec0',borderWidth:2,borderRadius:6,padding:6,elevation:5},cardSmall:{width:30,height:42,padding:2,borderWidth:1},cardBack:{backgroundColor:'#090909',borderColor:RED,alignItems:'center',justifyContent:'center'},cardJA:{color:RED,fontWeight:'900',fontSize:10},selected:{borderColor:RED,borderWidth:4,transform:[{translateY:-8},{rotate:'-3deg'}]},rank:{color:'#111',fontSize:22,fontWeight:'900'},rankSmall:{fontSize:8},suit:{color:'#111',fontSize:31,textAlign:'center',marginTop:8},suitSmall:{fontSize:11,marginTop:1},red:{color:RED},you:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:25,marginTop:3},youName:{color:'#fff',fontWeight:'900',fontSize:15},youBadge:{width:42,height:42,borderRadius:21,backgroundColor:RED,color:'#fff',textAlign:'center',textAlignVertical:'center',fontWeight:'900',fontStyle:'italic'},message:{color:'#ddd',textAlign:'center',marginVertical:12,minHeight:20},actions:{flexDirection:'row',gap:9},outline:{flex:1,backgroundColor:'#151515',borderColor:'#555',borderWidth:1,padding:14},primaryAction:{flex:1,backgroundColor:RED,padding:14,transform:[{rotate:'-1deg'}]},actionText:{color:'#fff',fontWeight:'900',textAlign:'center',lineHeight:17},result:{marginTop:12,borderWidth:2,padding:13,alignItems:'center'},win:{backgroundColor:'#3b070a',borderColor:RED},loss:{backgroundColor:'#171717',borderColor:'#555'},resultTitle:{color:'#fff',fontSize:23,fontWeight:'900',fontStyle:'italic'},resultSub:{color:GOLD,textAlign:'center',marginTop:4,fontSize:11},
});
