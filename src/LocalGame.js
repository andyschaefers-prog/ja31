import React, { useState } from 'react';
import { Image, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { dealLocalRound, localRoundResult, scoreHand, swapOne } from './gameEngine';
import { applyRoundResult, STARTING_PROFILE } from './progression';

const RED = '#e31b23';
const STAKE = 50;
const LOGO = require('../assets/ja-logo.png');
const BrandLogo=({small=false})=><Image source={LOGO} resizeMode="contain" style={small?styles.logoSmall:styles.logoImage}/>;

function Card({ card, selected, onPress }) {
  const red = card.suit === '♥' || card.suit === '♦';
  return <TouchableOpacity onPress={onPress} style={[styles.card, selected && styles.selected]}>
    <Text style={[styles.rank, red && styles.red]}>{card.rank}</Text>
    <Text style={[styles.suit, red && styles.red]}>{card.suit}</Text>
  </TouchableOpacity>;
}

const newPlayers = (count) => Array.from({ length: count }, (_, index) => ({
  name: `SPIELER ${index + 1}`, lives: 3, ...STARTING_PROFILE,
}));

export default function LocalGame({ onExit }) {
  const [count, setCount] = useState(2);
  const [players, setPlayers] = useState([]);
  const [round, setRound] = useState(null);
  const [active, setActive] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [knocker, setKnocker] = useState(null);
  const [finalTurns, setFinalTurns] = useState(0);
  const [result, setResult] = useState(null);

  function startMatch() {
    setPlayers(newPlayers(count));
    setRound(dealLocalRound(count));
    setActive(0); setRevealed(false); setKnocker(null); setFinalTurns(0); setResult(null);
  }

  function finishRound(nextRound = round) {
    const outcome = localRoundResult(nextRound.hands);
    setPlayers((current) => current.map((player, index) => {
      const won = outcome.winners.includes(index);
      const lost = outcome.losers.includes(index);
      const profile = applyRoundResult(player, won ? 'win' : lost ? 'loss' : 'draw', STAKE);
      return { ...profile, name: player.name, lives: Math.max(0, player.lives - (lost ? 1 : 0)) };
    }));
    setRound(nextRound); setResult(outcome); setRevealed(true);
  }

  function completeTurn(nextRound) {
    if (knocker !== null) {
      if (finalTurns <= 1) { finishRound(nextRound); return; }
      setFinalTurns(finalTurns - 1);
    }
    setRound(nextRound); setActive((active + 1) % players.length); setSelected(null); setRevealed(false);
  }

  function swapMiddle(middleIndex) {
    if (selected === null) return;
    const move = swapOne(round.hands[active], round.middle, selected, middleIndex);
    const hands = [...round.hands]; hands[active] = move.hand;
    completeTurn({ ...round, hands, middle: move.middle });
  }

  function swapAll() {
    const hands = [...round.hands]; const oldHand = hands[active]; hands[active] = round.middle;
    completeTurn({ ...round, hands, middle: oldHand });
  }

  function knock() {
    setKnocker(active); setFinalTurns(players.length - 1);
    setActive((active + 1) % players.length); setSelected(null); setRevealed(false);
  }

  function nextRound() {
    const alive = players.filter((player) => player.lives > 0);
    if (alive.length <= 1) { setPlayers([]); setRound(null); setResult(null); return; }
    setRound(dealLocalRound(players.length)); setActive(0); setRevealed(false);
    setSelected(null); setKnocker(null); setFinalTurns(0); setResult(null);
  }

  if (!round) return <SafeAreaView style={styles.page}><View style={styles.setup}>
    <TouchableOpacity hitSlop={12} style={styles.backButton} onPress={onExit}><Text style={styles.back}>‹ HAUPTMENÜ</Text></TouchableOpacity>
    <BrandLogo/><Text style={styles.title}>LOKALE RUNDE</Text><Text style={styles.subtitle}>Ein Handy. Bis zu vier große Klappen.</Text>
    <Text style={styles.label}>WIE VIELE SPIELER?</Text>
    <View style={styles.countRow}>{[2,3,4].map((number) => <TouchableOpacity key={number} onPress={() => setCount(number)} style={[styles.count, count === number && styles.active]}><Text style={styles.countText}>{number}</Text></TouchableOpacity>)}</View>
    <Text style={styles.info}>Jeder startet mit 3 Leben und 1.000 Coins. Einsatz: ◉ {STAKE}</Text>
    <TouchableOpacity style={styles.primary} onPress={startMatch}><Text style={styles.buttonText}>SPIEL STARTEN</Text></TouchableOpacity>
  </View></SafeAreaView>;

  if (result) return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.setup}>
    <Text style={styles.title}>RUNDE VORBEI</Text>
    {players.map((player, index) => <View key={player.name} style={[styles.resultRow, result.winners.includes(index) && styles.winner]}>
      <View><Text style={styles.player}>{player.name}</Text><Text style={styles.meta}>Level {player.level} · ◉ {player.coins} · {'●'.repeat(player.lives)}</Text></View>
      <Text style={styles.score}>{result.scores[index]}</Text>
    </View>)}
    <Text style={styles.info}>{result.losers.length ? 'Der niedrigste Wert verliert ein Leben.' : 'Gleichstand – niemand verliert ein Leben.'}</Text>
    <TouchableOpacity style={styles.primary} onPress={nextRound}><Text style={styles.buttonText}>{players.filter((p) => p.lives > 0).length <= 1 ? 'NEUES SPIEL' : 'NÄCHSTE RUNDE'}</Text></TouchableOpacity>
  </ScrollView></SafeAreaView>;

  if (!revealed) return <SafeAreaView style={styles.page}><View style={styles.pass}>
    <BrandLogo/><Text style={styles.passSmall}>HANDY WEITERGEBEN AN</Text><Text style={styles.passName}>{players[active].name}</Text>
    <Text style={styles.info}>Die anderen schauen weg. Ehrensache.</Text>
    <TouchableOpacity style={styles.primary} onPress={() => setRevealed(true)}><Text style={styles.buttonText}>MEINE KARTEN ANSEHEN</Text></TouchableOpacity>
  </View></SafeAreaView>;

  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.game}>
    <View style={styles.top}><View><Text style={styles.player}>{players[active].name}</Text><Text style={styles.meta}>Level {players[active].level} · ◉ {players[active].coins} · {'●'.repeat(players[active].lives)}</Text></View><BrandLogo small/></View>
    {knocker !== null && <Text style={styles.warning}>{players[knocker].name} HAT GEKLOPFT · LETZTER ZUG</Text>}
    <View style={styles.turnBanner}><Text style={styles.turnText}>● {players[active].name} IST DRAN!</Text></View><View style={styles.table}><Text style={styles.label}>MITTE</Text><View style={styles.cards}>{round.middle.map((card, index) => <Card key={card.id} card={card} onPress={() => swapMiddle(index)} />)}</View>
    <Text style={styles.label}>DEINE HAND · {scoreHand(round.hands[active])} PUNKTE</Text><View style={styles.cards}>{round.hands[active].map((card, index) => <Card key={card.id} card={card} selected={selected === index} onPress={() => setSelected(index)} />)}</View>
    </View>
    <Text style={styles.info}>Einzeltausch: Erst deine Karte, dann eine Karte aus der Mitte.</Text>
    <TouchableOpacity style={styles.outline} onPress={swapAll}><Text style={styles.buttonText}>ALLE 3 TAUSCHEN</Text></TouchableOpacity>
    {knocker === null && <TouchableOpacity style={styles.primary} onPress={knock}><Text style={styles.buttonText}>KLOPFEN</Text></TouchableOpacity>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:'#050505'},setup:{flexGrow:1,justifyContent:'center',paddingHorizontal:26,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||24)+18:26},game:{paddingHorizontal:16,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||24)+16:20,paddingBottom:40},pass:{flex:1,justifyContent:'center',padding:28},back:{color:'#fff',fontWeight:'900'},backButton:{alignSelf:'flex-start',backgroundColor:'#171717',borderColor:'#444',borderWidth:1,paddingVertical:12,paddingHorizontal:15,marginBottom:16},logoImage:{width:150,height:150,alignSelf:'center',marginBottom:-18},logoSmall:{width:72,height:72},title:{color:'#fff',fontSize:38,fontWeight:'900',fontStyle:'italic',textAlign:'center'},subtitle:{color:RED,textAlign:'center',fontWeight:'900',marginBottom:32},label:{color:'#918582',textAlign:'center',fontSize:11,letterSpacing:2,marginTop:12},countRow:{flexDirection:'row',justifyContent:'center',gap:12,marginVertical:18},count:{width:64,height:64,borderRadius:3,borderColor:'#444',borderWidth:1,alignItems:'center',justifyContent:'center',backgroundColor:'#111'},active:{backgroundColor:RED,borderColor:RED,transform:[{rotate:'-3deg'}]},countText:{color:'#fff',fontSize:24,fontWeight:'900'},info:{color:'#888',textAlign:'center',marginVertical:18,lineHeight:20},primary:{backgroundColor:RED,padding:18,borderRadius:2,marginTop:12},outline:{borderColor:'#555',backgroundColor:'#111',borderWidth:1,padding:17,borderRadius:2,marginTop:12},buttonText:{color:'#fff',fontWeight:'900',textAlign:'center',letterSpacing:1},passSmall:{color:'#777',textAlign:'center',letterSpacing:2},passName:{color:'#fff',textAlign:'center',fontSize:42,fontStyle:'italic',fontWeight:'900',marginTop:8},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},player:{color:'#fff',fontSize:17,fontWeight:'900'},meta:{color:'#f1bd36',marginTop:4},warning:{color:'#fff',backgroundColor:RED,textAlign:'center',fontWeight:'900',padding:10,marginTop:20},turnBanner:{backgroundColor:RED,padding:9,marginVertical:8,transform:[{rotate:'-.6deg'}]},turnText:{color:'#fff',textAlign:'center',fontWeight:'900',fontStyle:'italic'},table:{backgroundColor:'#17110f',borderColor:'#6e1013',borderWidth:3,borderRadius:22,paddingHorizontal:8,paddingBottom:12},cards:{flexDirection:'row',justifyContent:'center',gap:9,marginVertical:12},card:{width:88,height:122,backgroundColor:'#f6f1e6',borderRadius:4,padding:9,borderWidth:3,borderColor:'#d8d1c5'},selected:{borderColor:RED,transform:[{translateY:-8},{rotate:'-2deg'}]},rank:{color:'#111',fontSize:24,fontWeight:'900'},suit:{color:'#111',fontSize:36,textAlign:'center',marginTop:10},red:{color:RED},resultRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',backgroundColor:'#111',padding:15,marginTop:10,borderLeftColor:'#444',borderLeftWidth:4},winner:{borderLeftColor:RED},score:{color:'#fff',fontWeight:'900',fontSize:28},
});
