/**
 * Herramientas para simular partidas completas con un jugador aleatorio (pero que solo arma
 * movimientos válidos, como lo haría la UI) y verificar invariantes del estado después de
 * cada movimiento. Sirve para cazar bugs del motor que los tests puntuales no ven.
 *
 * Todo es reproducible: `playGame({ seed })` reemplaza `Math.random` por un generador con
 * semilla, así que una partida que falla se puede repetir exactamente con la misma semilla.
 */
import { actionCountsByRound, applyPlayerMove, canRerollFeeder, isLegalMove, scorePlayerDetails } from "./engine";
import { FOODS, HABITATS, occupiedSlots, randomMove, slotRefs } from "./moveGen";
import { createInitialState, standardDieFaces } from "./setup";
import { chooseBotMove, fallbackMove } from "./bot";
import { nextBotActor } from "./turns";
import type { BotDifficulty, CardId, GameState, HabitatId, Move, PlayerId, ResourceFace, SlotRef } from "./types";

/** Tope de movimientos por partida: una partida real tiene a lo sumo 26 por jugador. */
const MAX_STEPS = 400;

// ── Aleatoriedad reproducible ────────────────────────────────────────────────

/** mulberry32: generador pequeño y rápido, suficiente para tests. */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function withSeededRandom<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  Math.random = createRng(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

// ── Movimientos inválidos ────────────────────────────────────────────────────

type CorruptMove = { label: string; playerId: PlayerId; move: Move };

/**
 * Variantes de `move` que el motor JAMÁS debería aceptar. Sirven para comprobar que
 * `isLegalMove` rechaza (sin lanzar) lo que enviaría un cliente con errores o malicioso.
 */
function corruptMoves(state: GameState, playerId: PlayerId, move: Move): CorruptMove[] {
  const bad: CorruptMove[] = [];
  const add = (label: string, corrupted: Move, actor: PlayerId = playerId) =>
    bad.push({ label, playerId: actor, move: corrupted });
  const player = state.players[playerId];
  const outsider = state.playerOrder.find((id) => id !== playerId);
  const badSlot = { habitat: "moon" as HabitatId, slotIndex: 0 };

  if (outsider && state.phase === "round") add("turno ajeno", move, outsider);
  add("jugador inexistente", move, "__nadie__");

  switch (move.type) {
    case "playBird": {
      const card = state.cards[move.cardId];
      add("ave que no está en la mano", { ...move, cardId: "__no_existe__" });
      add("hábitat inexistente", { ...move, habitat: "moon" as HabitatId });
      add("columna fuera de rango", { ...move, slotIndex: 99 });
      add("recursos que no tiene", { ...move, paidResources: [...move.paidResources, ...Array<ResourceFace>(50).fill("rodent")] });
      add("un huevo de más", { ...move, paidEggsFrom: [...move.paidEggsFrom, { habitat: "forest", slotIndex: 0 }] });
      add("huevo de una ranura inexistente", { ...move, paidEggsFrom: [badSlot] });
      const occupiedIndex = player.board[move.habitat].findIndex((slot) => slot.cardId !== null);
      if (occupiedIndex !== -1) add("columna ocupada", { ...move, slotIndex: occupiedIndex });
      if (Object.keys(card.cost).length > 0 || card.costAnyOf) add("sin pagar", { ...move, paidResources: [] });
      break;
    }
    case "gainFood":
      add("sin dados", { ...move, dieIndexes: [] });
      add("dado fuera de rango", { ...move, dieIndexes: [99] });
      add("dado negativo", { ...move, dieIndexes: [-1] });
      add("dado repetido", { ...move, dieIndexes: [0, 0] });
      add("dado no numérico", { ...move, dieIndexes: [Number.NaN] });
      add("cambio por una carta ajena", { ...move, tradeCardId: "__no_existe__" });
      break;
    case "layEggs": {
      add("sin huevos", { ...move, eggPlacements: [] });
      add("ranura de hábitat inexistente", { ...move, eggPlacements: [badSlot] });
      add("ranura fuera de rango", { ...move, eggPlacements: [{ habitat: "forest", slotIndex: 99 }] });
      const empty = slotRefs(player, (slot) => slot.cardId === null)[0];
      if (empty) add("ranura sin ave", { ...move, eggPlacements: [empty] });
      const full = occupiedSlots(player)[0];
      if (full) {
        const slot = player.board[full.habitat][full.slotIndex];
        const overflow = state.cards[slot.cardId!].eggCapacity - slot.eggs + 1;
        add("más huevos que la capacidad", { ...move, eggPlacements: Array<SlotRef>(overflow).fill(full) });
      }
      const missingFood = FOODS.find((food) => (player.resources[food] ?? 0) === 0);
      if (missingFood) add("cambio con comida que no tiene", { ...move, tradeResource: missingFood });
      break;
    }
    case "drawBirdCards":
      add("sin robar", { ...move, draws: [] });
      add("carta que no está en el mercado", { ...move, draws: [{ source: "market", marketCardId: "__no_existe__" }] });
      add("cambio de huevo inexistente", { ...move, tradeEggFrom: badSlot });
      break;
    case "rerollFeeder":
      break;
    case "chooseBonusCard":
      add("carta de bonificación no ofrecida", { type: "chooseBonusCard", bonusCardId: "__no_existe__" });
      break;
  }

  if (state.phase === "round" && !canRerollFeeder(state.feeder)) {
    add("relanzar sin dados iguales", { type: "rerollFeeder" });
  }
  return bad;
}

// ── Invariantes ──────────────────────────────────────────────────────────────

const validDieFaces = new Set<ResourceFace>(standardDieFaces);

/** Devuelve las reglas del estado que se violan (vacío = estado sano). */
export function checkInvariants(state: GameState): string[] {
  const errors: string[] = [];

  // Cada carta de ave existe en un solo lugar.
  const cardPlaces = new Map<CardId, string>();
  const trackCard = (id: CardId, place: string) => {
    if (!state.cards[id]) errors.push(`carta desconocida "${id}" en ${place}`);
    else if (cardPlaces.has(id)) errors.push(`carta "${id}" duplicada: ${cardPlaces.get(id)} y ${place}`);
    else cardPlaces.set(id, place);
  };
  state.deck.forEach((id) => trackCard(id, "mazo"));
  state.discard.forEach((id) => trackCard(id, "descarte"));
  state.market.forEach((id) => trackCard(id, "mercado"));

  // Idem con las cartas de bonificación.
  const bonusPlaces = new Map<string, string>();
  const trackBonus = (id: string, place: string) => {
    if (!state.bonusCardsCatalog?.[id]) errors.push(`bonificación desconocida "${id}" en ${place}`);
    else if (bonusPlaces.has(id)) errors.push(`bonificación "${id}" duplicada: ${bonusPlaces.get(id)} y ${place}`);
    else bonusPlaces.set(id, place);
  };
  state.bonusDeck.forEach((id) => trackBonus(id, "mazo de bonificación"));
  state.bonusDiscard.forEach((id) => trackBonus(id, "descarte de bonificación"));

  for (const [playerId, player] of Object.entries(state.players)) {
    player.hand.forEach((id) => trackCard(id, `mano de ${playerId}`));
    player.bonusCards.forEach((bonus) => trackBonus(bonus.id, `bonificaciones de ${playerId}`));
    player.pendingBonusChoice?.forEach((id) => trackBonus(id, `oferta inicial de ${playerId}`));

    for (const [food, amount] of Object.entries(player.resources)) {
      if (!FOODS.includes(food as ResourceFace)) errors.push(`${playerId} tiene un recurso inválido "${food}"`);
      if (!Number.isInteger(amount) || amount < 0) errors.push(`${playerId} tiene ${amount} de ${food}`);
    }
    const cubes = player.actionCubesAvailable;
    if (!Number.isInteger(cubes) || cubes < 0 || cubes > actionCountsByRound[state.round]) {
      errors.push(`${playerId} tiene ${cubes} acciones en la ronda ${state.round}`);
    }

    for (const habitat of HABITATS) {
      const row = player.board[habitat];
      if (row.length !== 5) errors.push(`${playerId}: la fila ${habitat} tiene ${row.length} columnas`);
      let gap = false;
      row.forEach((slot, index) => {
        const place = `${playerId} ${habitat}[${index}]`;
        if (!slot.cardId) {
          gap = true;
          if (slot.eggs !== 0 || slot.cached.length > 0 || slot.tucked.length > 0) {
            errors.push(`${place} está vacía pero tiene huevos, comida o cartas`);
          }
          return;
        }
        if (gap) errors.push(`${place} tiene un ave después de una columna vacía`);
        trackCard(slot.cardId, place);
        slot.tucked.forEach((id) => trackCard(id, `${place} (solapada)`));
        const card = state.cards[slot.cardId];
        if (!card) return;
        if (!card.habitats.includes(habitat)) errors.push(`${place}: ${card.id} no vive en ${habitat}`);
        if (!Number.isInteger(slot.eggs) || slot.eggs < 0 || slot.eggs > card.eggCapacity) {
          errors.push(`${place}: ${slot.eggs} huevos con capacidad ${card.eggCapacity}`);
        }
        if (slot.cached.some((food) => !FOODS.includes(food))) {
          errors.push(`${place}: comida almacenada inválida (${slot.cached.join(",")})`);
        }
      });
    }
  }

  // Comedero y mercado.
  if (state.phase === "round" || state.phase === "setup") {
    if (state.feeder.length < 1 || state.feeder.length > 5) errors.push(`el comedero tiene ${state.feeder.length} dados`);
  }
  if (state.feeder.some((face) => !validDieFaces.has(face))) errors.push(`comedero con caras inválidas: ${state.feeder.join(",")}`);
  if (state.market.length > 3) errors.push(`el mercado tiene ${state.market.length} cartas`);

  // Objetivos de ronda: 4 distintos, uno por ronda.
  if (state.roundGoals.length !== 4 || new Set(state.roundGoals.map((goal) => goal.id)).size !== 4) {
    errors.push(`objetivos de ronda inválidos: ${state.roundGoals.map((goal) => goal.id).join(",")}`);
  }

  // Turnos.
  if (state.phase === "round") {
    for (const player of Object.values(state.players)) {
      if (player.pendingStartingHand) errors.push(`${player.id} sigue sin elegir su mano inicial con la ronda en marcha`);
    }
    const current = state.players[state.currentPlayerId];
    if (!current) errors.push(`el turno es de un jugador inexistente (${state.currentPlayerId})`);
    else if (current.actionCubesAvailable <= 0) errors.push(`el turno es de ${current.id}, que no tiene acciones`);
  }

  // Mensajes del log rotos por una plantilla mal armada.
  for (const entry of state.log) {
    if (/undefined|NaN|\[object/.test(entry.message)) errors.push(`log sospechoso: "${entry.message}"`);
  }

  if (state.phase === "gameEnd") {
    for (const id of state.playerOrder) {
      const player = state.players[id];
      if (player.roundGoalScores.length !== 4) errors.push(`${id} tiene ${player.roundGoalScores.length} puntajes de objetivos (esperados 4)`);
      const score = scorePlayerDetails(state, id);
      const parts = [score.birds, score.eggs, score.cachedFood, score.tuckedCards, score.roundGoals, score.bonusCards];
      if (parts.some((part) => !Number.isFinite(part) || part < 0)) errors.push(`puntaje de ${id} inválido: ${JSON.stringify(score)}`);
      if (parts.reduce((sum, part) => sum + part, 0) !== score.total) errors.push(`el total de ${id} no suma sus partes: ${JSON.stringify(score)}`);
    }
  }

  return errors;
}

/**
 * Reglas que solo valen justo después de cerrar una ronda: el mercado se repone a 3 cartas
 * (reciclando el descarte si hace falta) salvo que ya no quede ninguna carta en el juego.
 * Durante la ronda puede quedar corto legítimamente: solo se repone al sacarle una carta.
 */
function checkRoundTransition(state: GameState): string[] {
  if (state.market.length < 3 && state.deck.length + state.discard.length > 0) {
    return [
      `mercado con ${state.market.length} cartas tras cerrar la ronda, habiendo mazo (${state.deck.length}) y descarte (${state.discard.length})`,
    ];
  }
  return [];
}

// ── Partida completa ─────────────────────────────────────────────────────────

/**
 * Quién de los jugadores HUMANOS debe mover ahora: primero quien tenga una elección pendiente
 * (mano inicial o carta de bonificación; no exige turno) y si no, el jugador del turno. Los rivales
 * de la IA juegan solos dentro de `applyMove`, así que nunca se los devuelve aquí.
 */
export function nextActor(state: GameState): PlayerId | null {
  const isHuman = (id: PlayerId) => !state.players[id].botLevel;
  const choosing = state.playerOrder.find(
    (id) => isHuman(id) && (state.players[id].pendingStartingHand || (state.players[id].pendingBonusChoice?.length ?? 0) > 0),
  );
  if (choosing) return choosing;
  return state.phase === "round" && isHuman(state.currentPlayerId) ? state.currentPlayerId : null;
}

export { randomMove };

export type SimulationOptions = {
  seed: number;
  mode: "solo" | "online";
  /** Nivel del rival de la IA en el modo "solo". */
  difficulty?: BotDifficulty;
  /** Recorta el mazo inicial para forzar que se agote (y se barajen los descartes) durante la partida. */
  deckSize?: number;
};

export type SimulationResult = {
  seed: number;
  mode: SimulationOptions["mode"];
  steps: number;
  finished: boolean;
  /** Errores encontrados, cada uno con la semilla y el paso para poder reproducirlo. */
  problems: string[];
  finalState: GameState;
  scores: Record<PlayerId, number>;
};

const showMove = (move: Move) => JSON.stringify(move);

export type BotMatchResult = {
  scores: Record<PlayerId, number>;
  finalState: GameState;
  problems: string[];
};

/**
 * Partida entre rivales de la IA (cada uno con su nivel), paso a paso y comprobando los invariantes
 * tras cada movimiento. Sirve para probar que la IA juega sin romper nada y para comparar niveles.
 */
export function playBotMatch(seed: number, levels: Record<PlayerId, BotDifficulty>): BotMatchResult {
  return withSeededRandom(seed, () => {
    let state = createInitialState({ mode: "solo", playerIds: Object.keys(levels), bots: levels });
    const problems: string[] = [];
    for (let steps = 1; steps <= MAX_STEPS && problems.length === 0; steps += 1) {
      const actor = nextBotActor(state);
      if (!actor) break;
      const move = chooseBotMove(state, actor) ?? fallbackMove(state, actor);
      try {
        state = applyPlayerMove(state, actor, move);
      } catch (error) {
        problems.push(`[semilla ${seed}, paso ${steps}] la IA (${actor}) armó una jugada que el motor rechaza: ${String(error)} ${showMove(move)}`);
        break;
      }
      for (const error of checkInvariants(state)) problems.push(`[semilla ${seed}, paso ${steps}] ${error}\n    tras ${showMove(move)}`);
    }
    if (state.phase !== "gameEnd" && problems.length === 0) problems.push(`[semilla ${seed}] la partida entre IAs no terminó`);
    return {
      scores: Object.fromEntries(state.playerOrder.map((id) => [id, scorePlayerDetails(state, id).total])),
      finalState: state,
      problems,
    };
  });
}

export function playGame({ seed, mode, difficulty = "normal", deckSize }: SimulationOptions): SimulationResult {
  return withSeededRandom(seed, () => {
    let state = createInitialState(
      mode === "solo"
        ? { mode: "solo", botDifficulty: difficulty, playerIds: ["nico", "bot"] }
        : { mode: "online", playerIds: ["nico", "santi"] },
    );
    if (deckSize !== undefined) state = { ...state, deck: state.deck.slice(0, deckSize) };
    const problems: string[] = [];
    let steps = 0;
    const report = (message: string) => problems.push(`[${mode} semilla ${seed}, paso ${steps}] ${message}`);
    checkInvariants(state).forEach(report);

    /** Aplica UN movimiento y comprueba que no modifica la entrada y que el estado resultante es sano. */
    const applyChecked = (actor: PlayerId, move: Move): boolean => {
      const previous = state;
      // El catálogo de cartas (pesado) se compara aparte, en el test de catálogos compartidos.
      const snapshot = JSON.stringify({ ...previous, cards: null });
      try {
        state = applyPlayerMove(previous, actor, move);
      } catch (error) {
        report(`applyPlayerMove lanzó con un movimiento de ${actor}: ${String(error)}\n    ${showMove(move)}`);
        return false;
      }
      if (JSON.stringify({ ...previous, cards: null }) !== snapshot) {
        report(`applyPlayerMove modificó el estado de entrada: ${showMove(move)}`);
      }
      const errors = checkInvariants(state);
      if (state.round !== previous.round || (state.phase === "gameEnd" && previous.phase !== "gameEnd")) {
        errors.push(...checkRoundTransition(state));
      }
      errors.forEach((error) => report(`${error}\n    tras ${actor}: ${showMove(move)}`));
      return true;
    };

    // Tras la última acción puede quedar una carta de bonificación por elegir: se juega hasta resolverla.
    while ((state.phase !== "gameEnd" || nextActor(state) !== null) && problems.length === 0) {
      steps += 1;
      if (steps > MAX_STEPS) {
        report(`la partida no termina tras ${MAX_STEPS} movimientos`);
        break;
      }

      const actor = nextActor(state);
      const move = actor && randomMove(state, actor);
      if (!actor || !move) {
        report(`nadie puede mover (fase ${state.phase}, turno de ${state.currentPlayerId})`);
        break;
      }

      if (!isLegalMove(state, actor, move)) {
        report(`el generador armó un movimiento que el motor rechaza: ${showMove(move)}`);
        break;
      }

      for (const { label, playerId, move: bad } of corruptMoves(state, actor, move)) {
        try {
          if (isLegalMove(state, playerId, bad)) report(`se aceptó un movimiento inválido (${label}): ${showMove(bad)}`);
        } catch (error) {
          report(`isLegalMove lanzó ante un movimiento inválido (${label}): ${String(error)}`);
        }
      }

      // La jugada del humano y, a continuación, una a una las de los rivales de la IA (lo que hace
      // applyMove), comprobando los invariantes tras CADA jugada y no solo al final de la cadena.
      if (!applyChecked(actor, move)) break;
      for (let bot = nextBotActor(state); bot && problems.length === 0; bot = nextBotActor(state)) {
        steps += 1;
        if (steps > MAX_STEPS) {
          report(`la partida no termina tras ${MAX_STEPS} movimientos`);
          break;
        }
        if (!applyChecked(bot, chooseBotMove(state, bot) ?? fallbackMove(state, bot))) break;
      }
    }

    const finished = state.phase === "gameEnd";
    if (!finished && problems.length === 0) report(`la partida terminó en fase ${state.phase}`);

    return {
      seed,
      mode,
      steps,
      finished,
      problems,
      finalState: state,
      scores: Object.fromEntries(state.playerOrder.map((id) => [id, scorePlayerDetails(state, id).total])),
    };
  });
}
