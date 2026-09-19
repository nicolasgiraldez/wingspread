import { chooseBotMove, fallbackMove } from "./bot";
import { applyPlayerMove } from "./engine";
import type { GameState, Move, PlayerId } from "./types";

/**
 * Quién de la IA debe mover ahora: primero quien tenga una elección pendiente (preparación inicial o
 * carta de bonificación de un poder; no exige turno) y si no, el jugador del turno si es de la IA.
 */
export function nextBotActor(state: GameState): PlayerId | null {
  for (const id of state.playerOrder) {
    const player = state.players[id];
    if (player.botLevel && (player.pendingStartingHand || player.pendingBonusChoice?.length)) return id;
  }
  if (state.phase !== "round") return null;
  const current = state.players[state.currentPlayerId];
  return current?.botLevel && current.actionCubesAvailable > 0 ? current.id : null;
}

/** Hace jugar a los rivales de la IA hasta que le toque a un humano (o la partida termine). */
export function runBots(state: GameState): GameState {
  let next = state;
  // Tope de seguridad: una partida entera son a lo sumo unos 60 movimientos entre todos.
  for (let guard = 0; guard < 300; guard += 1) {
    const botId = nextBotActor(next);
    if (!botId) return next;
    const move = chooseBotMove(next, botId);
    if (!move) return next;
    try {
      next = applyPlayerMove(next, botId, move);
    } catch {
      next = applyPlayerMove(next, botId, fallbackMove(next, botId));
    }
  }
  return next;
}

/**
 * Aplica el movimiento de un jugador y, a continuación, hace jugar a los rivales de la IA. Es lo que
 * usan la interfaz y los tests; `applyPlayerMove` (engine.ts) aplica un solo movimiento sin bots.
 */
export function applyMove(state: GameState, playerId: PlayerId, move: Move): GameState {
  return runBots(applyPlayerMove(state, playerId, move));
}
