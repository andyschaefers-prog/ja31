import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { normalizeRoomCode, validPlayerName } from './onlineLobby';
import { createLobby, joinLobby, loadPlayers, onlineConfigured, watchPlayers } from './onlineService';
import { loadLobby, startOnlineGame, watchLobby } from './onlineService';
import { dealLocalRound } from './gameEngine';
import OnlineGame from './OnlineGame';

const RED = '#e31b23';
const LOGO = require('../assets/ja-logo.png');

export default function OnlineLobby({ onExit }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [lobby, setLobby] = useState(null);
  const [players, setPlayers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh(current = lobby) {
    if (current) setPlayers(await loadPlayers(current.id));
  }

  useEffect(() => {
    if (!lobby || !onlineConfigured) return undefined;
    refresh(lobby);
    return watchPlayers(lobby.id, () => refresh(lobby));
  }, [lobby?.id]);
  useEffect(() => { if (!lobby) return undefined; return watchLobby(lobby.id, async () => setLobby(await loadLobby(lobby.id))); }, [lobby?.id]);

  async function startGame() {
    setBusy(true); setError('');
    try { const dealt=dealLocalRound(players.length); await startOnlineGame(lobby.id,{hands:dealt.hands,middle:dealt.middle,deck:dealt.deck}); }
    catch(reason){setError(reason.message);} finally{setBusy(false);}
  }

  if (lobby?.status === 'playing' || lobby?.status === 'round_end') return <OnlineGame initialLobby={lobby} players={players} onExit={onExit} />;

  async function run(action) {
    if (!validPlayerName(name)) { setError('Der Spielername braucht 2 bis 18 Zeichen.'); return; }
    setBusy(true); setError('');
    try { setLobby(await action()); } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }

  if (lobby) return <SafeAreaView style={styles.page}><View style={styles.wrap}>
    <Text style={styles.small}>DEIN RAUMCODE</Text><Text style={styles.code}>{lobby.code}</Text>
    <Text style={styles.hint}>Diesen Code an deine Mitspieler schicken.</Text>
    <View style={styles.playerBox}>{players.map((player) => <Text key={player.id} style={styles.player}>● {player.player_name}</Text>)}
      {Array.from({ length: Math.max(0, 4 - players.length) }, (_, i) => <Text key={i} style={styles.waiting}>○ Warte auf Spieler …</Text>)}
    </View>
    <TouchableOpacity onPress={startGame} disabled={players.length < 2 || busy} style={[styles.primary, players.length < 2 && styles.disabled]}><Text style={styles.buttonText}>SPIEL STARTEN</Text></TouchableOpacity>
    <TouchableOpacity style={styles.outline} onPress={onExit}><Text style={styles.buttonText}>RAUM VERLASSEN</Text></TouchableOpacity>
  </View></SafeAreaView>;

  return <SafeAreaView style={styles.page}><View style={styles.wrap}>
    <TouchableOpacity hitSlop={12} style={styles.backButton} onPress={onExit}><Text style={styles.back}>‹ HAUPTMENÜ</Text></TouchableOpacity>
    <Image source={LOGO} resizeMode="contain" style={styles.logo}/><Text style={styles.title}>ONLINE-LOBBY</Text><Text style={styles.subtitle}>Große Klappe kennt keine Entfernung.</Text>
    {!onlineConfigured && <View style={styles.notice}><Text style={styles.noticeTitle}>NOCH NICHT VERBUNDEN</Text><Text style={styles.noticeText}>Die Lobby ist fertig vorbereitet. Als Nächstes verbinden wir die Online-Datenbank.</Text></View>}
    <Text style={styles.label}>DEIN SPIELERNAME</Text><TextInput value={name} onChangeText={setName} placeholder="z. B. Andy" placeholderTextColor="#666" maxLength={18} style={styles.input} />
    <TouchableOpacity disabled={busy} style={styles.primary} onPress={() => run(() => createLobby(name.trim()))}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>NEUEN RAUM ERSTELLEN</Text>}</TouchableOpacity>
    <Text style={styles.or}>ODER MIT CODE BEITRETEN</Text><TextInput value={code} onChangeText={(value) => setCode(normalizeRoomCode(value))} placeholder="ABC123" placeholderTextColor="#666" autoCapitalize="characters" maxLength={6} style={[styles.input, styles.codeInput]} />
    <TouchableOpacity disabled={busy || code.length !== 6} style={[styles.outline, code.length !== 6 && styles.disabled]} onPress={() => run(() => joinLobby(code, name.trim()))}><Text style={styles.buttonText}>RAUM BEITRETEN</Text></TouchableOpacity>
    {!!error && <Text style={styles.error}>{error}</Text>}
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({page:{flex:1,backgroundColor:'#050505'},wrap:{flex:1,justifyContent:'center',paddingHorizontal:26,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||24)+18:26},back:{color:'#fff',fontWeight:'900'},backButton:{alignSelf:'flex-start',backgroundColor:'#171717',borderColor:'#444',borderWidth:1,paddingVertical:12,paddingHorizontal:15,marginBottom:8},logo:{width:145,height:145,alignSelf:'center',marginBottom:-20},title:{color:'#fff',fontSize:39,fontWeight:'900',fontStyle:'italic',textAlign:'center'},subtitle:{color:RED,textAlign:'center',fontWeight:'900',marginBottom:28},notice:{backgroundColor:'#17110e',borderLeftColor:'#f1bd36',borderLeftWidth:4,padding:13,marginBottom:18},noticeTitle:{color:'#f1bd36',fontWeight:'900'},noticeText:{color:'#aaa',marginTop:4,lineHeight:19},label:{color:'#777',fontSize:11,letterSpacing:2,marginBottom:7},input:{backgroundColor:'#111',borderColor:'#3a3a3a',borderWidth:1,color:'#fff',padding:15,borderRadius:2,fontSize:17},codeInput:{textAlign:'center',fontSize:25,fontWeight:'900',letterSpacing:6},primary:{backgroundColor:RED,padding:18,borderRadius:2,marginTop:12},outline:{backgroundColor:'#111',borderColor:'#555',borderWidth:1,padding:17,borderRadius:2,marginTop:12},disabled:{opacity:.35},buttonText:{color:'#fff',fontWeight:'900',textAlign:'center',letterSpacing:1},or:{color:'#666',textAlign:'center',marginVertical:19,fontSize:11,letterSpacing:2},error:{color:'#ff7378',textAlign:'center',marginTop:14},small:{color:'#777',textAlign:'center',letterSpacing:2},code:{color:'#fff',textAlign:'center',fontSize:52,fontWeight:'900',fontStyle:'italic',letterSpacing:8,marginVertical:8},hint:{color:'#888',textAlign:'center'},playerBox:{backgroundColor:'#111',borderTopColor:RED,borderTopWidth:3,padding:18,marginVertical:25},player:{color:'#fff',fontWeight:'900',paddingVertical:8},waiting:{color:'#555',paddingVertical:8}});
