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

/** Una jugada de la IA ya aplicada: el estado resultante, quién movió y qué hizo. */
export interface BotStep {
  state: GameState;
  botId: PlayerId;
  move: Move;
}

/**
 * Hace jugar UN movimiento a la IA a quien le toque (ver `nextBotActor`), o devuelve null si a ninguna
 * le toca. La interfaz lo usa para mostrar cada jugada del rival por separado; `runBots` las encadena.
 */
export function stepBot(state: GameState): BotStep | null {
  const botId = nextBotActor(state);
  if (!botId) return null;
  const move = chooseBotMove(state, botId);
  if (!move) return null;
  try {
    return { state: applyPlayerMove(state, botId, move), botId, move };
  } catch {
    const fallback = fallbackMove(state, botId);
    return { state: applyPlayerMove(state, botId, fallback), botId, move: fallback };
  }
}

/** Hace jugar a los rivales de la IA hasta que le toque a un humano (o la partida termine). */
export function runBots(state: GameState): GameState {
  let next = state;
  // Tope de seguridad: una partida entera son a lo sumo unos 60 movimientos entre todos.
  for (let guard = 0; guard < 300; guard += 1) {
    const step = stepBot(next);
    if (!step) return next;
    next = step.state;
  }
  return next;
}

/**
 * Aplica el movimiento de un jugador y, a continuación, hace jugar a los rivales de la IA. Es lo que
 * usan los tests y el anfitrión de una sala; `applyPlayerMove` (engine.ts) aplica un solo movimiento
 * sin bots y es lo que usa la interfaz solitaria, que avanza a la IA jugada por jugada con `stepBot`.
 */
export function applyMove(state: GameState, playerId: PlayerId, move: Move): GameState {
  return runBots(applyPlayerMove(state, playerId, move));
}
