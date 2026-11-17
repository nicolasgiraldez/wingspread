import { applyMove, isLegalMove } from "../../game";
import type { GameState, Move, PlayerId } from "../../game";

/**
 * Asientos de una partida online, en orden: el anfitrión juega como "nico" y los invitados ocupan
 * los siguientes a medida que se conectan ("santi" es el primer invitado). Son ids internos: en
 * pantalla siempre se muestra el nombre que eligió cada persona.
 */
export const SEAT_IDS: readonly PlayerId[] = ["nico", "santi", "p3", "p4", "p5"];
export const HOST_PLAYER_ID: PlayerId = SEAT_IDS[0];
export const GUEST_PLAYER_ID: PlayerId = SEAT_IDS[1];

export const MIN_ONLINE_PLAYERS = 2;
export const MAX_ONLINE_PLAYERS = SEAT_IDS.length;

/** Los asientos de una sala de `playerCount` jugadores (entre 2 y 5; fuera de rango se ajusta). */
export function seatsFor(playerCount: number): PlayerId[] {
  const count = Math.min(MAX_ONLINE_PLAYERS, Math.max(MIN_ONLINE_PLAYERS, Math.floor(playerCount) || MIN_ONLINE_PLAYERS));
  return SEAT_IDS.slice(0, count);
}

/** Nombre provisorio de un asiento hasta que su jugador se conecta y dice cómo se llama. */
export function defaultSeatName(seatIndex: number): string {
  return `Jugador ${seatIndex + 1}`;
}

/** Asientos que ocupan los invitados en una partida: todos menos el del anfitrión (y los de la IA). */
export function guestSeatsOf(state: GameState): PlayerId[] {
  return state.playerOrder.filter((id) => id !== HOST_PLAYER_ID && !state.players[id]?.botLevel);
}

export type GuestMoveResult = { ok: true; state: GameState } | { ok: false; reason: string };

function looksLikeMove(value: unknown): value is Move {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

/**
 * Valida y aplica un movimiento recibido de un invitado. El jugador que mueve lo decide el
 * anfitrión (el asiento de la conexión por la que llegó), nunca el mensaje: si no, un invitado
 * podría jugar por otro. Cualquier cosa rara se rechaza sin lanzar excepciones.
 */
export function applyGuestMove(state: GameState, move: unknown, playerId: PlayerId = GUEST_PLAYER_ID): GuestMoveResult {
  if (!looksLikeMove(move)) return { ok: false, reason: "movimiento mal formado" };
  if (!guestSeatsOf(state).includes(playerId)) return { ok: false, reason: "asiento desconocido" };
  try {
    if (!isLegalMove(state, playerId, move)) return { ok: false, reason: "movimiento ilegal" };
    return { ok: true, state: applyMove(state, playerId, move) };
  } catch (error) {
    return { ok: false, reason: `error al aplicar el movimiento: ${String(error)}` };
  }
}
