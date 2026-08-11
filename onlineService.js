import { createClient } from '@supabase/supabase-js';
import { createRoomCode } from './onlineLobby';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const onlineConfigured = Boolean(url && anonKey);
const client = onlineConfigured ? createClient(url, anonKey) : null;

async function userId() {
  const { data: session } = await client.auth.getSession();
  if (session.session?.user?.id) return session.session.user.id;
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return data.user.id;
}

export async function createLobby(playerName) {
  if (!client) throw new Error('Online-Verbindung ist noch nicht eingerichtet.');
  const ownerId = await userId();
  let lobby;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createRoomCode();
    const response = await client.from('lobbies').insert({ code, owner_id: ownerId }).select().single();
    if (!response.error) { lobby = response.data; break; }
    if (response.error.code !== '23505') throw response.error;
  }
  if (!lobby) throw new Error('Raumcode konnte nicht erstellt werden.');
  const { error } = await client.from('lobby_players').insert({ lobby_id: lobby.id, user_id: ownerId, player_name: playerName, seat: 0 });
  if (error) throw error;
  return lobby;
}

export async function joinLobby(code, playerName) {
  if (!client) throw new Error('Online-Verbindung ist noch nicht eingerichtet.');
  const ownerId = await userId();
  const { data: lobby, error: lobbyError } = await client.from('lobbies').select('*').eq('code', code).eq('status', 'waiting').single();
  if (lobbyError) throw new Error('Raum nicht gefunden oder bereits gestartet.');
  const { count } = await client.from('lobby_players').select('*', { count: 'exact', head: true }).eq('lobby_id', lobby.id);
  if (count >= 4) throw new Error('Dieser Raum ist bereits voll.');
  const { error } = await client.from('lobby_players').insert({ lobby_id: lobby.id, user_id: ownerId, player_name: playerName, seat: count });
  if (error) throw error;
  return lobby;
}

export async function loadPlayers(lobbyId) {
  const { data, error } = await client.from('lobby_players').select('*').eq('lobby_id', lobbyId).order('seat');
  if (error) throw error;
  return data;
}

export async function currentUserId() {
  return userId();
}

export async function loadLobby(lobbyId) {
  const { data, error } = await client.from('lobbies').select('*').eq('id', lobbyId).single();
  if (error) throw error;
  return data;
}

export async function startOnlineGame(lobbyId, gameState) {
  const { error } = await client.from('lobbies').update({ status: 'playing', game_state: gameState, current_seat: 0, knocker_seat: null, final_turns: 0 }).eq('id', lobbyId);
  if (error) throw error;
}

export async function saveOnlineTurn(lobbyId, changes) {
  const { error } = await client.from('lobbies').update(changes).eq('id', lobbyId);
  if (error) throw error;
}

export function watchLobby(lobbyId, onChange) {
  const channel = client.channel(`game:${lobbyId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` }, onChange).subscribe();
  return () => client.removeChannel(channel);
}

export function watchPlayers(lobbyId, onChange) {
  const channel = client.channel(`lobby:${lobbyId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_players', filter: `lobby_id=eq.${lobbyId}` }, onChange).subscribe();
  return () => client.removeChannel(channel);
}
