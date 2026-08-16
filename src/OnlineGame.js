import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { canKnock, localRoundResult, scoreHand, swapOne } from './gameEngine';
import { currentUserId, loadLobby, saveOnlineTurn, watchLobby } from './onlineService';

const RED='#e31b23';
const Card=({card,onPress,selected})=><TouchableOpacity onPress={onPress} style={[s.card,selected&&s.sel]}><Text style={[s.rank,(card.suit==='♥'||card.suit==='♦')&&s.red]}>{card.rank}</Text><Text style={[s.suit,(card.suit==='♥'||card.suit==='♦')&&s.red]}>{card.suit}</Text></TouchableOpacity>;

export default function OnlineGame({ initialLobby, players, onExit }) {
  const [lobby,setLobby]=useState(initialLobby); const [uid,setUid]=useState(null); const [selected,setSelected]=useState(null); const [error,setError]=useState('');
  const me=players.find(p=>p.user_id===uid); const seat=me?.seat; const state=lobby.game_state;
  useEffect(()=>{currentUserId().then(setUid); return watchLobby(lobby.id,async()=>setLobby(await loadLobby(lobby.id)));},[]);
  const myHand=seat===undefined?[]:state.hands[seat]; const active=lobby.current_seat===seat;
  const status=useMemo(()=>lobby.status==='round_end'?localRoundResult(state.hands):null,[lobby.status,state]);
  const tableRounds=Math.floor((state.turnCount||0)/Math.max(players.length,1));
  const knockActive=lobby.knocker_seat!==null&&lobby.knocker_seat!==undefined;
  async function commit(nextState,extra={}){try{
    const game_state={...nextState,turnCount:(state.turnCount||0)+1};
    const changes={game_state,current_seat:(lobby.current_seat+1)%players.length,...extra};
    if(knockActive){
      const remaining=Math.max(0,(lobby.final_turns||0)-1);
      changes.final_turns=remaining;
      if(remaining===0)changes.status='round_end';
    }
    await saveOnlineTurn(lobby.id,changes);setSelected(null);
  }catch(e){setError(e.message);}}
  function one(mi){if(!active||selected===null)return;const m=swapOne(myHand,state.middle,selected,mi);const hands=[...state.hands];hands[seat]=m.hand;commit({...state,hands,middle:m.middle});}
  function all(){if(!active)return;const hands=[...state.hands];const old=hands[seat];hands[seat]=state.middle;commit({...state,hands,middle:old});}
  function pass(){if(active)commit(state);}
  async function knock(){
    if(!active||knockActive||!canKnock(tableRounds))return;
    try{await saveOnlineTurn(lobby.id,{game_state:state,knocker_seat:seat,final_turns:players.length-1,current_seat:(seat+1)%players.length});setSelected(null);}
    catch(e){setError(e.message);}
  }
  if(status)return <SafeAreaView style={s.page}><View style={s.wrap}><Text style={s.title}>RUNDE VORBEI</Text>{players.map((p,i)=><Text key={p.id} style={s.line}>{p.player_name}: {status.scores[i]} {status.winners.includes(i)?'🏆':''}</Text>)}<TouchableOpacity style={s.primary} onPress={onExit}><Text style={s.btn}>ZURÜCK ZUR LOBBY</Text></TouchableOpacity></View></SafeAreaView>;
  return <SafeAreaView style={s.page}><View style={s.wrap}><Text style={s.logo}>JA 31 ONLINE</Text>{knockActive&&<View style={s.knockBanner}><Text style={s.knockTitle}>✊ ES WURDE GEKLOPFT!</Text><Text style={s.knockText}>Jeder andere Spieler hat jetzt genau einen letzten Zug.</Text></View>}<Text style={s.info}>{active?'DU BIST DRAN':'Warte auf '+players.find(p=>p.seat===lobby.current_seat)?.player_name}</Text><Text style={s.label}>MITTE</Text><View style={s.cards}>{state.middle.map((c,i)=><Card key={c.id} card={c} onPress={()=>one(i)}/>)}</View><Text style={s.label}>DEINE HAND · {scoreHand(myHand)} PUNKTE</Text><View style={s.cards}>{myHand.map((c,i)=><Card key={c.id} card={c} selected={selected===i} onPress={()=>active&&setSelected(i)}/>)}</View><TouchableOpacity style={s.outline} onPress={all}><Text style={s.btn}>ALLE 3 TAUSCHEN</Text></TouchableOpacity><TouchableOpacity style={s.outline} onPress={pass}><Text style={s.btn}>SCHIEBEN</Text></TouchableOpacity>{!knockActive&&<TouchableOpacity disabled={!active||!canKnock(tableRounds)} style={[s.primary,(!active||!canKnock(tableRounds))&&s.disabled]} onPress={knock}><Text style={s.btn}>{canKnock(tableRounds)?'✊ KLOPFEN':'🔒 KLOPFEN AB RUNDE 2'}</Text></TouchableOpacity>}{!!error&&<Text style={s.error}>{error}</Text>}</View></SafeAreaView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:'#080808'},wrap:{flex:1,justifyContent:'center',padding:22},title:{color:'#fff',fontSize:36,fontWeight:'900',textAlign:'center'},logo:{color:RED,fontSize:28,fontWeight:'900',textAlign:'center'},info:{color:'#fff',textAlign:'center',fontWeight:'900',margin:16},knockBanner:{backgroundColor:'#2b090b',borderColor:RED,borderWidth:2,padding:12,marginTop:12},knockTitle:{color:'#fff',fontSize:20,fontWeight:'900',textAlign:'center'},knockText:{color:'#f1bd36',fontWeight:'800',textAlign:'center',marginTop:4},label:{color:'#777',textAlign:'center',letterSpacing:2,marginTop:16},cards:{flexDirection:'row',justifyContent:'center',gap:8,marginVertical:12},card:{width:86,height:120,backgroundColor:'#f4f0e8',borderRadius:8,padding:8,borderWidth:3,borderColor:'#f4f0e8'},sel:{borderColor:RED,transform:[{translateY:-7}]},rank:{fontSize:23,fontWeight:'900'},suit:{fontSize:35,textAlign:'center',marginTop:10},red:{color:RED},primary:{backgroundColor:RED,padding:17,marginTop:10},disabled:{opacity:.35},outline:{borderColor:'#555',borderWidth:1,padding:16,marginTop:10},btn:{color:'#fff',fontWeight:'900',textAlign:'center'},line:{color:'#fff',backgroundColor:'#151515',padding:14,marginTop:8},error:{color:'#ff7378',textAlign:'center',marginTop:10}});
