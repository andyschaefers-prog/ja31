import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { bestBotMove, dealRound, loserFromScores, scoreHand, shouldBotKnock, swapOne } from './src/gameEngine';
import { applyRoundResult, canOpenDailyCrates, claimDailyTask, DAILY_TASKS, ensureDaily, recordDailyRound, spinDailyWheel, STARTING_PROFILE, unlockedStakes, WHEEL_REWARDS, xpNeeded } from './src/progression';
import LocalGame from './src/LocalGame';
import OnlineLobby from './src/OnlineLobby';
import ComputerGame from './src/ComputerGame';

const RED = '#e31b23';
const GOLD = '#f1bd36';
const LOGO = require('./assets/ja-logo.png');
const PROFILE_KEY = 'ja31.profile.v1';
const OPPONENTS = [
  { level: 1, name: 'DER ANFÄNGER', line: 'Na los – überrasche mich.' },
  { level: 2, name: 'KARTEN-KALLE', line: 'Ich tausche schneller als du denkst.' },
  { level: 3, name: 'DIE ROTE KÖNIGIN', line: 'Drei Karten. Null Mitleid.' },
  { level: 5, name: 'GROSSE KLAPPE', line: 'War das schon alles?' },
  { level: 10, name: 'DER SCHÄFER', line: 'Endstation. Zeig, was du kannst.' },
];
const AVATAR_OPTIONS = {
  face: ['😎','😁','🤪','😈','🤠','🤓'],
  hair: ['🧢','🎩','🪖','🎓','👒',''],
  outfit: ['🖤','❤️','🤍','🔥','⚡','💀'],
  extra: ['👑','🎸','🕶️','🦅','💥',''],
  flag: ['🇩🇪','🇪🇺','🇹🇷','🇮🇹','🇪🇸','🏴‍☠️'],
};
const FUN_LINES = [
  'Karten-Kalle behauptet, er habe nur wegen der Sonne verloren. Drinnen.',
  'Die Rote Königin lächelt. Das ist meistens kein gutes Zeichen.',
  'Drei Karten, drei Leben und mindestens eine richtig schlechte Ausrede.',
  'Wer klopft, muss auch mit dem Echo klarkommen.',
  'Heute wird nicht gemeckert. Heute wird JA gesagt und gewonnen!',
];

function PlayerAvatar({ profile, large = false }) {
  const avatar = profile.avatar || STARTING_PROFILE.avatar;
  return <View style={[styles.avatar,large&&styles.avatarLarge]}>
    <Text style={[styles.avatarFace,large&&styles.avatarFaceLarge]}>{avatar.face}</Text>
    <Text style={styles.avatarHair}>{avatar.hair}</Text><Text style={styles.avatarExtra}>{avatar.extra}</Text>
    <View style={styles.avatarBase}><Text style={styles.avatarOutfit}>{avatar.outfit}</Text><Text style={styles.avatarFlag}>{avatar.flag}</Text></View>
  </View>;
}

function BrandBackground() {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={styles.redGlow} /><View style={styles.slashOne} /><View style={styles.slashTwo} /><Text style={styles.bgCardOne}>♥</Text><Text style={styles.bgCardTwo}>♣</Text><Text style={styles.bgSpark}>✨</Text>
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
  const [botTurns, setBotTurns] = useState(0);
  const [dailyReward, setDailyReward] = useState(null);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelTarget, setWheelTarget] = useState(0);
  const [funIndex, setFunIndex] = useState(0);
  const actionPulse = useRef(new Animated.Value(1)).current;
  const wheelTurn = useRef(new Animated.Value(0)).current;
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
    setSelectedHand(null); setRoundResult(null); setBotTurns(0); setMessage(`Neue Runde gegen ${opponent.name}. Große Klappe – jetzt Karten zeigen.`);
  }

  function botTurn(nextRound) {
    const move = bestBotMove(nextRound.bot, nextRound.middle);
    return { round: { ...nextRound, bot: move.hand, middle: move.middle }, move };
  }

  function decideRound(finalRound, endedBy = 'player') {
    const p = scoreHand(finalRound.player); const b = scoreHand(finalRound.bot);
    const loser = loserFromScores(p, b);
    let nextPlayerLives = playerLives; let nextBotLives = botLives;
    if (loser === 'player') nextPlayerLives -= 1;
    if (loser === 'bot') nextBotLives -= 1;
    setPlayerLives(nextPlayerLives); setBotLives(nextBotLives); setRound(finalRound); setFinished(true);
    const result = loser === 'bot' ? 'win' : loser === 'player' ? 'loss' : 'draw';
    let nextProfile = applyRoundResult(profile, result, stake);
    nextProfile = recordDailyRound(nextProfile, result, p);
    setProfile(nextProfile); setRoundResult({ result, player: p, bot: b, endedBy });
    if (result === 'win') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (result === 'loss') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setMessage(`${endedBy === 'bot' ? `${opponent.name} hat geklopft! ` : ''}${loser === 'draw' ? `Gleichstand: ${p} zu ${b}.` : loser === 'player' ? `Autsch: ${p} zu ${b}.` : `JA! ${p} zu ${b}.`}`);
  }

  function finishBotTurn(nextRound) {
    const botAction = botTurn(nextRound);
    const turns = botTurns + 1;
    setBotTurns(turns);
    if (shouldBotKnock(botAction.round.bot, turns)) decideRound(botAction.round, 'bot');
    else setRound(botAction.round);
  }

  function exchangeOne(middleIndex) {
    if (selectedHand === null || finished) return;
    const move = swapOne(round.player, round.middle, selectedHand, middleIndex);
    finishBotTurn({ ...round, player: move.hand, middle: move.middle });
    Haptics.selectionAsync(); animateAction();
    setSelectedHand(null);
    setMessage('Getauscht. Der Bot hat ebenfalls gezogen.');
  }

  function exchangeAll() {
    if (finished) return;
    finishBotTurn({ ...round, player: round.middle, middle: round.player });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); animateAction();
    setMessage('Alle drei getauscht. Mutig!');
  }

  function knock() {
    if (finished) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); animateAction();
    decideRound(botTurn(round).round, 'player');
  }

  function nextRound() {
    if (playerLives === 0 || botLives === 0) { resetMatch(); return; }
    setRound(dealRound()); setFinished(false); setSelectedHand(null); setRoundResult(null); setBotTurns(0);
    setMessage('Nächste Runde. Drei Leben – keine Ausreden.'); animateAction();
  }

  function collectTask(taskId) { setProfile((current) => claimDailyTask(current, taskId)); }
  function spinWheel() {
    if (wheelSpinning) return;
    const opened = spinDailyWheel(profile);
    if (opened.reward === null) return;
    setWheelSpinning(true); setDailyReward(null); setWheelTarget(opened.index); wheelTurn.setValue(0);
    Animated.timing(wheelTurn,{toValue:1,duration:2600,useNativeDriver:true}).start(()=>{
      setProfile(opened.profile); setDailyReward(opened.reward); setWheelSpinning(false);
      Haptics.notificationAsync(opened.reward >= 250 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    });
  }

  if (screen === 'menu') return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="light-content" />
      <BrandBackground />
      <View style={styles.menu}>
        <View style={styles.menuMain}>
        <View style={styles.menuWelcome}>
        <View style={styles.menuBrandRow}><BrandMark compact /><View style={{flex:1}}><Text style={styles.welcomeSmall}>SCHÖN, DASS DU DA BIST!</Text><Text style={styles.welcomeTitle}>HALLO {profile.playerName||'JA-SPIELER'} 👋</Text><Text style={styles.welcomeSub}>Bereit für eine freche Runde 31?</Text></View></View>
        <TouchableOpacity onPress={()=>{setFunIndex(value=>(value+1)%FUN_LINES.length);Haptics.selectionAsync()}} style={styles.funBubble}><Text style={styles.funFace}>😄</Text><View style={{flex:1}}><Text style={styles.funLabel}>KARTEN-KALLES SPRUCH</Text><Text style={styles.funText}>{FUN_LINES[funIndex]}</Text></View><Text style={styles.funNext}>↻</Text></TouchableOpacity>
        <View style={styles.profileBox}>
          <View style={styles.profileTop}><TouchableOpacity style={styles.profileIdentity} onPress={()=>setScreen('profile')}><PlayerAvatar profile={profile}/><View><Text style={styles.eyebrow}>DEIN SPIELERPROFIL · BEARBEITEN</Text><Text style={styles.profileName}>{profile.playerName||STARTING_PROFILE.playerName}</Text><Text style={styles.profileLevel}>LEVEL {profile.level}</Text></View></TouchableOpacity><Text style={styles.coins}>● {profile.coins}</Text></View>
          <View style={styles.xpTrack}><View style={[styles.xpFill,{width:`${Math.min(100,(profile.xp/xpNeeded(profile.level))*100)}%`}]} /></View>
          <Text style={styles.xp}>{profile.xp} / {xpNeeded(profile.level)} XP BIS ZUM NÄCHSTEN LEVEL</Text>
          <View style={styles.streakRow}><Text style={styles.streakNow}>🔥 AKTUELLE SERIE: {profile.currentStreak||0}</Text><Text style={styles.streakBest}>REKORD: {profile.bestStreak||0}</Text></View>
        </View>
        </View>
        <View style={styles.menuGames}><Text style={styles.playKicker}>SUCH DIR DEIN CHAOS AUS</Text><Text style={styles.playTitle}>WAS SPIELEN WIR?</Text>
        <TouchableOpacity style={[styles.gameChoice,styles.gameChoiceHot]} onPress={() => setScreen('computer')}><Text style={styles.gameEmoji}>🤖</Text><View style={{flex:1}}><Text style={styles.gameTitle}>COMPUTER-ARENA</Text><Text style={styles.gameSub}>1–3 freche Gegner · mehrere Modi</Text></View><Text style={styles.gameArrow}>›</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.gameChoice,styles.gameChoiceGold]} onPress={() => setScreen('local')}><Text style={styles.gameEmoji}>👨‍👩‍👧‍👦</Text><View style={{flex:1}}><Text style={styles.gameTitle}>FREUNDE AM HANDY</Text><Text style={styles.gameSub}>Zusammen spielen und weitergeben</Text></View><Text style={styles.gameArrow}>›</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.gameChoice,styles.gameChoiceBlue]} onPress={() => setScreen('online')}><Text style={styles.gameEmoji}>🌍</Text><View style={{flex:1}}><Text style={styles.gameTitle}>ONLINE-LOBBY</Text><Text style={styles.gameSub}>Raum erstellen oder Freunden beitreten</Text></View><Text style={styles.gameArrow}>›</Text></TouchableOpacity>
        <TouchableOpacity style={styles.surpriseButton} onPress={()=>{setFunIndex(value=>(value+1)%FUN_LINES.length);setScreen('computer')}}><Text style={styles.surpriseText}>🎲 ÜBERRASCH MICH!</Text></TouchableOpacity>
        </View></View>
        <View style={styles.quickRow}>
          <TouchableOpacity style={[styles.quickTile,styles.quickCoins]} onPress={() => setScreen('rooms')}><Text style={styles.quickIcon}>🪙</Text><View><Text style={styles.quickText}>EINSATZ-RÄUME</Text><Text style={styles.quickSub}>Mehr Risiko, mehr Beute</Text></View></TouchableOpacity>
          <TouchableOpacity style={[styles.quickTile,styles.quickTask]} onPress={() => setScreen('tasks')}><Text style={styles.quickIcon}>🎯</Text><View><Text style={styles.quickText}>TAGESMISSIONEN</Text><Text style={styles.quickSub}>Belohnungen abholen</Text></View></TouchableOpacity>
          <TouchableOpacity style={[styles.quickTile,styles.quickWheel,canOpenDailyCrates(profile)&&styles.quickReady]} onPress={() => {setDailyReward(null);setScreen('wheel')}}><Text style={styles.quickIcon}>🎡</Text><View><Text style={styles.quickText}>GLÜCKSRAD</Text><Text style={styles.quickSub}>{canOpenDailyCrates(profile)?'Dein Dreh ist bereit!':'Morgen wieder drehen'}</Text></View>{canOpenDailyCrates(profile)&&<Text style={styles.readyBadge}>BEREIT</Text>}</TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );

  if (screen === 'profile') return <SafeAreaView style={styles.page}><BrandBackground/><ScrollView contentContainerStyle={styles.panelPage}><TouchableOpacity style={styles.backButton} onPress={()=>setScreen('menu')}><Text style={styles.back}>‹ HAUPTMENÜ</Text></TouchableOpacity><Text style={styles.panelTitle}>DEIN JA-PROFIL</Text><Text style={styles.panelSub}>ZEIG, WER AM TISCH SITZT.</Text><PlayerAvatar profile={profile} large/><Text style={styles.editorLabel}>SPIELERNAME</Text><TextInput maxLength={18} value={profile.playerName||''} onChangeText={(playerName)=>setProfile(current=>({...current,playerName}))} placeholder="Dein Name" placeholderTextColor="#666" style={styles.nameInput}/>{Object.entries(AVATAR_OPTIONS).map(([part,options])=><View key={part}><Text style={styles.editorLabel}>{({face:'GESICHT',hair:'KOPF',outfit:'JA-OUTFIT',extra:'EXTRA',flag:'FLAGGE'})[part]}</Text><View style={styles.optionRow}>{options.map((option,index)=><TouchableOpacity key={`${part}-${index}`} onPress={()=>setProfile(current=>({...current,avatar:{...(current.avatar||STARTING_PROFILE.avatar),[part]:option}}))} style={[styles.avatarOption,(profile.avatar||STARTING_PROFILE.avatar)[part]===option&&styles.avatarOptionActive]}><Text style={styles.optionEmoji}>{option||'×'}</Text></TouchableOpacity>)}</View></View>)}<TouchableOpacity style={styles.primary} onPress={()=>setScreen('menu')}><Text style={styles.buttonText}>PROFIL SPEICHERN</Text></TouchableOpacity></ScrollView></SafeAreaView>;

  if (screen === 'rooms') return <SafeAreaView style={styles.page}><BrandBackground/><ScrollView contentContainerStyle={styles.panelPage}><TouchableOpacity style={styles.backButton} onPress={() => setScreen('menu')}><Text style={styles.back}>‹ HAUPTMENÜ</Text></TouchableOpacity><Text style={styles.panelTitle}>EINSATZ-RÄUME</Text><Text style={styles.panelSub}>MEHR RISIKO. MEHR BEUTE.</Text><View style={styles.roomGrid}>{[50,100,250,500,1000].map((amount,index)=><TouchableOpacity key={amount} disabled={!unlockedStakes(profile.level,profile.coins).includes(amount)} onPress={()=>{setStake(amount);setScreen('game')}} style={[styles.room,!unlockedStakes(profile.level,profile.coins).includes(amount)&&styles.locked]}><Text style={styles.roomLevel}>RAUM {index+1}</Text><Text style={styles.roomStake}>◉ {amount}</Text><Text style={styles.roomMeta}>{profile.level >= [1,2,3,5,10][index]?'JETZT SPIELEN':`AB LEVEL ${[1,2,3,5,10][index]}`}</Text></TouchableOpacity>)}</View></ScrollView></SafeAreaView>;

  if (screen === 'tasks') { const ready=ensureDaily(profile); const progress={play3:ready.daily.played,win1:ready.daily.won,score31:ready.daily.score31}; return <SafeAreaView style={styles.page}><BrandBackground/><ScrollView contentContainerStyle={styles.panelPage}><TouchableOpacity style={styles.backButton} onPress={()=>setScreen('menu')}><Text style={styles.back}>‹ HAUPTMENÜ</Text></TouchableOpacity><Text style={styles.panelTitle}>TAGESAUFGABEN</Text><Text style={styles.panelSub}>JEDEN TAG NEUE BEUTE.</Text>{DAILY_TASKS.map(task=>{const done=progress[task.id]>=task.goal;const claimed=ready.daily.claimed.includes(task.id);return <View key={task.id} style={styles.task}><View style={styles.taskBadge}><Text style={styles.taskBadgeText}>{done?'✓':'JA'}</Text></View><View style={{flex:1}}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskProgress}>{Math.min(progress[task.id],task.goal)} / {task.goal} · ◉ {task.reward}</Text></View><TouchableOpacity disabled={!done||claimed} onPress={()=>collectTask(task.id)} style={[styles.claim,(!done||claimed)&&styles.locked]}><Text style={styles.claimText}>{claimed?'GEHOLT':done?'HOLEN':'OFFEN'}</Text></TouchableOpacity></View>})}</ScrollView></SafeAreaView> }

  if (screen === 'wheel') return <SafeAreaView style={styles.page}><BrandBackground/><View style={styles.panelPage}><TouchableOpacity style={styles.backButton} onPress={()=>setScreen('menu')}><Text style={styles.back}>‹ HAUPTMENÜ</Text></TouchableOpacity><Text style={styles.panelTitle}>JA-GLÜCKSRAD</Text><Text style={styles.panelSub}>EIN DREH ALLE 24 STUNDEN.</Text><Text style={styles.wheelPointer}>▼</Text><Animated.View style={[styles.wheel,{transform:[{rotate:wheelTurn.interpolate({inputRange:[0,1],outputRange:['0deg',`${1800+((8-wheelTarget)%8)*45}deg`]})}]}]}>{WHEEL_REWARDS.map((reward,index)=><View key={`${reward}-${index}`} style={[styles.wheelSegment,{transform:[{rotate:`${index*45}deg`},{translateY:-73}]}]}><Text style={styles.wheelValue}>{reward===0?'NEIN':reward}</Text></View>)}<View style={styles.wheelHub}><Text style={styles.wheelJA}>JA</Text></View></Animated.View><Text style={styles.crateHint}>{wheelSpinning?'DAS RAD DREHT …':dailyReward===null?'Dreh das Rad und hol dir deine Tagesbeute!':dailyReward===0?'NEIN! Morgen gibt es die nächste Chance.':`VOLLTREFFER! +${dailyReward} COINS`}</Text><TouchableOpacity disabled={!canOpenDailyCrates(profile)||wheelSpinning} onPress={spinWheel} style={[styles.wheelButton,(!canOpenDailyCrates(profile)||wheelSpinning)&&styles.locked]}><Text style={styles.buttonText}>{wheelSpinning?'LÄUFT …':canOpenDailyCrates(profile)?'JETZT DREHEN':'MORGEN WIEDER'}</Text></TouchableOpacity></View></SafeAreaView>;

  if (screen === 'local') return <LocalGame onExit={() => setScreen('menu')} />;
  if (screen === 'online') return <OnlineLobby onExit={() => setScreen('menu')} />;
  if (screen === 'computer') return <ComputerGame profile={profile} setProfile={setProfile} stake={stake} onExit={() => setScreen('menu')} />;

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
        <View style={styles.scoreRow}><View style={styles.playerAtTable}><PlayerAvatar profile={profile}/><View><Text style={styles.name}>{profile.playerName||'DU'} · {playerScore} PUNKTE</Text><Lives count={playerLives} /></View></View></View>
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
  page: { flex: 1, backgroundColor: '#050505' }, menu: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||24)+10:20,paddingBottom:28 }, game: { paddingHorizontal:16,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||24)+16:20, paddingBottom: 40 },
  redGlow:{position:'absolute',width:380,height:380,borderRadius:190,backgroundColor:'#430006',opacity:.38,top:-190,right:-150},slashOne:{position:'absolute',width:520,height:2,backgroundColor:RED,opacity:.18,transform:[{rotate:'-24deg'}],top:260,left:-100},slashTwo:{position:'absolute',width:520,height:1,backgroundColor:'#fff',opacity:.07,transform:[{rotate:'-24deg'}],top:274,left:-100},
  brandMark:{height:190,alignItems:'center',justifyContent:'center',marginBottom:-8},brandLogo:{width:210,height:210},brandMarkCompact:{height:62,width:92,marginBottom:0},brandLogoCompact:{width:72,height:72},numberBadge:{position:'absolute',right:'18%',bottom:22,backgroundColor:'#fff',borderColor:RED,borderWidth:3,paddingHorizontal:9,paddingVertical:2,transform:[{rotate:'-7deg'}]},numberText:{color:'#090909',fontSize:24,fontWeight:'900',fontStyle:'italic'},numberTextCompact:{fontSize:12},
  claim: { color: RED, textAlign: 'center', fontSize:20,fontWeight: '900', letterSpacing: 3 },claimWhite:{color:'#fff',textAlign:'center',fontSize:20,fontWeight:'900',letterSpacing:3,marginBottom:24}, primary: { backgroundColor: RED, minHeight:58,padding: 16, marginTop: 10, borderRadius: 2,flexDirection:'row',alignItems:'center' }, secondary: { backgroundColor:'#111',borderColor: '#383838', borderWidth: 1, minHeight:58,padding: 16, marginTop: 10, borderRadius: 2,flexDirection:'row',alignItems:'center' },
  profileBox: { backgroundColor: '#101010', borderTopColor: RED, borderTopWidth: 3, padding: 15, marginBottom: 14 },profileTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},eyebrow:{color:'#777',fontSize:9,fontWeight:'900',letterSpacing:2}, profileLevel: { color: '#fff', fontSize: 23, fontWeight: '900',fontStyle:'italic' }, coins: { color: '#f1bd36', fontWeight: '900',fontSize:18 }, xp: { color: '#777', marginTop: 6, fontSize: 9,fontWeight:'800' },xpTrack:{height:6,backgroundColor:'#292929',marginTop:12},xpFill:{height:6,backgroundColor:RED},streakRow:{flexDirection:'row',justifyContent:'space-between',marginTop:10,borderTopColor:'#292929',borderTopWidth:1,paddingTop:8},streakNow:{color:'#fff',fontSize:9,fontWeight:'900'},streakBest:{color:'#f1bd36',fontSize:9,fontWeight:'900'},
  profileIdentity:{flexDirection:'row',alignItems:'center',gap:10,flex:1},profileName:{color:RED,fontSize:13,fontWeight:'900'},avatar:{width:52,height:52,borderRadius:26,backgroundColor:'#292929',borderColor:RED,borderWidth:2,alignItems:'center',justifyContent:'center',position:'relative'},avatarLarge:{width:112,height:112,borderRadius:56,alignSelf:'center',marginVertical:10,borderWidth:4},avatarFace:{fontSize:27},avatarFaceLarge:{fontSize:58},avatarHair:{position:'absolute',top:-13,left:-7,fontSize:22},avatarExtra:{position:'absolute',top:-16,right:-7,fontSize:22},avatarBase:{position:'absolute',bottom:-9,left:-3,right:-3,flexDirection:'row',justifyContent:'space-between'},avatarOutfit:{fontSize:16},avatarFlag:{fontSize:15},playerAtTable:{flexDirection:'row',alignItems:'center',gap:9},
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
  quickRow:{flexDirection:'row',gap:7,marginBottom:7},quickTile:{flex:1,minHeight:68,backgroundColor:'#111',borderColor:'#333',borderWidth:1,alignItems:'center',justifyContent:'center',padding:5},quickReady:{borderColor:RED,shadowColor:RED,shadowOpacity:.45,shadowRadius:7,elevation:5},quickIcon:{color:RED,fontSize:21,fontWeight:'900'},quickText:{color:'#fff',fontSize:8,fontWeight:'900',textAlign:'center',marginTop:4},
  panelPage:{flexGrow:1,paddingHorizontal:20,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||24)+18:28,paddingBottom:40},panelTitle:{color:'#fff',fontSize:34,fontWeight:'900',fontStyle:'italic',textAlign:'center',marginTop:28},panelSub:{color:RED,fontWeight:'900',textAlign:'center',letterSpacing:2,marginBottom:24},roomGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,justifyContent:'center'},room:{width:'47%',minHeight:120,backgroundColor:'#17110f',borderColor:RED,borderWidth:2,padding:14,justifyContent:'center'},roomLevel:{color:'#888',fontSize:10,fontWeight:'900',letterSpacing:1},roomStake:{color:'#f1bd36',fontSize:25,fontWeight:'900',marginVertical:5},roomMeta:{color:'#fff',fontSize:9,fontWeight:'900'},locked:{opacity:.35},
  task:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#111',borderLeftColor:RED,borderLeftWidth:4,padding:14,marginBottom:10},taskBadge:{width:46,height:46,borderRadius:23,backgroundColor:RED,alignItems:'center',justifyContent:'center'},taskBadgeText:{color:'#fff',fontWeight:'900'},taskTitle:{color:'#fff',fontWeight:'900',fontSize:15},taskProgress:{color:'#f1bd36',marginTop:4,fontSize:11},claim:{backgroundColor:RED,paddingVertical:9,paddingHorizontal:10},claimText:{color:'#fff',fontSize:9,fontWeight:'900'},
  crateHint:{color:'#ddd',textAlign:'center',fontSize:15,lineHeight:22,marginVertical:18},wheelPointer:{color:'#fff',fontSize:32,textAlign:'center',zIndex:3,marginBottom:-13},wheel:{width:220,height:220,borderRadius:110,backgroundColor:'#250609',borderColor:RED,borderWidth:8,alignSelf:'center',alignItems:'center',justifyContent:'center',shadowColor:RED,shadowOpacity:.8,shadowRadius:20,elevation:15},wheelSegment:{position:'absolute',height:36,width:54,alignItems:'center',justifyContent:'center',backgroundColor:'#111',borderColor:GOLD,borderWidth:1,borderRadius:5},wheelValue:{color:'#fff',fontWeight:'900',fontSize:10},wheelHub:{width:70,height:70,borderRadius:35,backgroundColor:RED,borderColor:GOLD,borderWidth:4,alignItems:'center',justifyContent:'center'},wheelJA:{color:'#fff',fontSize:24,fontWeight:'900',fontStyle:'italic'},wheelButton:{backgroundColor:RED,padding:17,alignSelf:'center',minWidth:220,flexDirection:'row'},
  editorLabel:{color:'#888',fontSize:10,fontWeight:'900',letterSpacing:2,marginTop:18,marginBottom:8},nameInput:{backgroundColor:'#111',borderColor:'#444',borderWidth:1,color:'#fff',fontSize:18,fontWeight:'900',paddingHorizontal:15,paddingVertical:13},optionRow:{flexDirection:'row',gap:7,flexWrap:'wrap'},avatarOption:{width:48,height:48,backgroundColor:'#111',borderColor:'#333',borderWidth:1,alignItems:'center',justifyContent:'center'},avatarOptionActive:{borderColor:RED,borderWidth:3,backgroundColor:'#280608'},optionEmoji:{fontSize:23,color:'#fff'},
  // Freundliches Querformat-Hauptmenü 1.9
  menu:{flex:1,paddingHorizontal:12,paddingTop:Platform.OS==='android'?6:10,paddingBottom:7},menuMain:{flex:1,flexDirection:'row',gap:10,minHeight:0},menuWelcome:{width:'43%',justifyContent:'center'},menuGames:{flex:1,justifyContent:'center',backgroundColor:'rgba(12,12,12,.82)',borderColor:'#292929',borderWidth:1,borderRadius:16,padding:10},
  menuBrandRow:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:3},welcomeSmall:{color:GOLD,fontSize:7,fontWeight:'900',letterSpacing:1.3},welcomeTitle:{color:'#fff',fontSize:18,fontWeight:'900',fontStyle:'italic'},welcomeSub:{color:'#a5a5a5',fontSize:9,marginTop:2},
  funBubble:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#211703',borderColor:GOLD,borderWidth:1,borderRadius:12,paddingVertical:6,paddingHorizontal:8,marginBottom:6},funFace:{fontSize:24},funLabel:{color:GOLD,fontSize:6,fontWeight:'900',letterSpacing:1},funText:{color:'#fff',fontSize:8,lineHeight:11,marginTop:1},funNext:{color:GOLD,fontSize:18,fontWeight:'900'},
  profileBox:{backgroundColor:'#101820',borderColor:'#263747',borderWidth:1,borderLeftColor:RED,borderLeftWidth:4,borderRadius:12,padding:9,marginBottom:0},profileTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},profileIdentity:{flexDirection:'row',alignItems:'center',gap:8,flex:1},profileName:{color:'#fff',fontSize:11,fontWeight:'900'},profileLevel:{color:'#58d5c9',fontSize:15,fontWeight:'900',fontStyle:'italic'},coins:{color:GOLD,fontWeight:'900',fontSize:15},eyebrow:{color:'#8ca0af',fontSize:6,fontWeight:'900',letterSpacing:1},xpTrack:{height:5,backgroundColor:'#29343d',marginTop:7,borderRadius:3},xpFill:{height:5,backgroundColor:'#58d5c9',borderRadius:3},xp:{color:'#8ca0af',marginTop:3,fontSize:6,fontWeight:'800'},streakRow:{flexDirection:'row',justifyContent:'space-between',marginTop:5,borderTopColor:'#29343d',borderTopWidth:1,paddingTop:4},streakNow:{color:'#fff',fontSize:7,fontWeight:'900'},streakBest:{color:GOLD,fontSize:7,fontWeight:'900'},
  playKicker:{color:'#58d5c9',fontSize:7,fontWeight:'900',letterSpacing:1.5,textAlign:'center'},playTitle:{color:'#fff',fontSize:20,fontWeight:'900',fontStyle:'italic',textAlign:'center',marginBottom:5},gameChoice:{minHeight:49,flexDirection:'row',alignItems:'center',gap:8,borderWidth:2,borderRadius:12,paddingHorizontal:9,paddingVertical:5,marginBottom:5},gameChoiceHot:{backgroundColor:'#3a090d',borderColor:RED},gameChoiceGold:{backgroundColor:'#302305',borderColor:GOLD},gameChoiceBlue:{backgroundColor:'#09252d',borderColor:'#38bfd0'},gameEmoji:{fontSize:24},gameTitle:{color:'#fff',fontSize:11,fontWeight:'900'},gameSub:{color:'#d0d0d0',fontSize:7,marginTop:1},gameArrow:{color:'#fff',fontSize:24,fontWeight:'900'},surpriseButton:{backgroundColor:'#6c28a2',borderColor:'#be75f2',borderWidth:1,borderRadius:16,paddingVertical:7,alignItems:'center',marginTop:1},surpriseText:{color:'#fff',fontWeight:'900',fontSize:9,letterSpacing:.8},
  quickRow:{height:58,flexDirection:'row',gap:7,marginTop:7,marginBottom:0},quickTile:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'flex-start',gap:7,minHeight:0,borderWidth:1,borderRadius:12,paddingHorizontal:9,paddingVertical:5},quickCoins:{backgroundColor:'#2b2005',borderColor:GOLD},quickTask:{backgroundColor:'#092826',borderColor:'#58d5c9'},quickWheel:{backgroundColor:'#2c0b20',borderColor:'#e455ac'},quickReady:{borderWidth:2,shadowColor:'#e455ac',shadowOpacity:.65,shadowRadius:8,elevation:6},quickIcon:{color:'#fff',fontSize:22,fontWeight:'900'},quickText:{color:'#fff',fontSize:8,fontWeight:'900',textAlign:'left',marginTop:0},quickSub:{color:'#c5c5c5',fontSize:6,marginTop:2},readyBadge:{position:'absolute',right:6,top:5,color:'#fff',backgroundColor:RED,fontSize:6,fontWeight:'900',paddingHorizontal:5,paddingVertical:2,borderRadius:6},
  bgCardOne:{position:'absolute',left:'3%',top:'8%',fontSize:70,color:RED,opacity:.08,transform:[{rotate:'-18deg'}]},bgCardTwo:{position:'absolute',right:'4%',bottom:'12%',fontSize:82,color:'#58d5c9',opacity:.07,transform:[{rotate:'15deg'}]},bgSpark:{position:'absolute',left:'47%',top:'5%',fontSize:24,opacity:.32},
});
