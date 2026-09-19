import { applyMove, isLegalMove } from "../../game";
import type { GameState, Move, PlayerId } from "../../game";

/** Asientos fijos de una partida online: el anfitrión juega como "nico" y el invitado como "santi". */
export const HOST_PLAYER_ID: PlayerId = "nico";
export const GUEST_PLAYER_ID: PlayerId = "santi";

export type GuestMoveResult = { ok: true; state: GameState } | { ok: false; reason: string };

function looksLikeMove(value: unknown): value is Move {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

/**
 * Valida y aplica un movimiento recibido del invitado. El jugador que mueve lo decide el
 * anfitrión (siempre el asiento del invitado), nunca el mensaje: si no, el invitado podría
 * jugar por el anfitrión. Cualquier cosa rara se rechaza sin lanzar excepciones.
 */
export function applyGuestMove(state: GameState, move: unknown): GuestMoveResult {
  if (!looksLikeMove(move)) return { ok: false, reason: "movimiento mal formado" };
  try {
    if (!isLegalMove(state, GUEST_PLAYER_ID, move)) return { ok: false, reason: "movimiento ilegal" };
    return { ok: true, state: applyMove(state, GUEST_PLAYER_ID, move) };
  } catch (error) {
    return { ok: false, reason: `error al aplicar el movimiento: ${String(error)}` };
  }
}
