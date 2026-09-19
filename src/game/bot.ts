/**
 * Rival controlado por la IA. Juega exactamente con las reglas y el motor de un jugador humano
 * (mismo tablero, mano, alimento, poderes y puntuación): no hay trucos ni reglas especiales.
 *
 * En cada turno propone jugadas candidatas (moveGen), simula cada una con el propio motor y se
 * queda con la que deja mejor el estado según una valoración sencilla (puntos actuales + valor del
 * alimento, las cartas y las aves que aún rendirán + carrera por el objetivo de la ronda).
 * La dificultad cambia cuánto explora y con cuánto ruido decide:
 *   - easy:   jugada válida al azar, sin mirar el resultado (como un principiante).
 *   - normal: compara pocas candidatas y decide con algo de ruido.
 *   - hard:   compara muchas candidatas, sin ruido, y valora más el objetivo de la ronda.
 */
import {
  actionCountsByRound,
  applyPlayerMove,
  calculateBonusPoints,
  countBonusQualifyingUnits,
  evaluateRoundGoalMetric,
  scorePlayerDetails,
} from "./engine";
import {
  candidateMoves,
  FOODS,
  HABITATS,
  randomMove,
  SENSIBLE_CHOICES,
  randomInt,
  sample,
} from "./moveGen";
import type { BotDifficulty, GameState, Move, PlayerId, PlayerState, ResourceFace, SpeciesCard } from "./types";

const TOTAL_ACTIONS = Object.values(actionCountsByRound).reduce((sum, n) => sum + n, 0);
const ROUND_GOAL_POINTS: Record<number, [number, number]> = { 1: [4, 1], 2: [5, 2], 3: [6, 3], 4: [7, 4] };

const settings: Record<Exclude<BotDifficulty, "easy">, { perType: number; noise: number; goalWeight: number; lookahead: number }> = {
  normal: { perType: 1, noise: 7, goalWeight: 0.4, lookahead: 0 },
  hard: { perType: 10, noise: 0, goalWeight: 1.2, lookahead: 4 },
};

// ── Valoración ───────────────────────────────────────────────────────────────

function birdsOnBoard(player: PlayerState): number {
  return HABITATS.reduce((sum, habitat) => sum + player.board[habitat].filter((slot) => slot.cardId).length, 0);
}

/** Cuánto vale el estado para `botId`: mayor es mejor. */
function evaluate(state: GameState, botId: PlayerId, goalWeight: number): number {
  const me = state.players[botId];
  let remaining = me.actionCubesAvailable;
  for (let round = state.round + 1; round <= 4; round += 1) remaining += actionCountsByRound[round as 1 | 2 | 3 | 4];
  const horizon = state.phase === "gameEnd" ? 0 : Math.min(1, remaining / TOTAL_ACTIONS);

  const food = Object.values(me.resources).reduce((sum, amount) => sum + (amount ?? 0), 0);
  let value = scorePlayerDetails(state, botId).total;
  // Lo que aún se puede convertir en puntos: alimento, cartas y aves en juego (motor de acciones).
  value += horizon * (0.5 * Math.min(food, 8) + 0.8 * Math.min(me.hand.length, 6) + 1.5 * birdsOnBoard(me));

  const goal = state.roundGoals[state.round - 1];
  if (goal && state.phase === "round") {
    const mine = evaluateRoundGoalMetric(me, state, goal);
    const theirs = Math.max(
      0,
      ...state.playerOrder.filter((id) => id !== botId).map((id) => evaluateRoundGoalMetric(state.players[id], state, goal)),
    );
    const [first, second] = ROUND_GOAL_POINTS[state.round];
    const winning = 1 / (1 + Math.exp(-(mine - theirs) * 0.9));
    const expected = winning * first + (1 - winning) * (mine > 0 ? second : 0);
    const roundProgress = 1 - me.actionCubesAvailable / actionCountsByRound[state.round];
    value += goalWeight * expected * (0.6 + 0.4 * roundProgress);
  }
  return value;
}

// ── Elecciones puntuales ─────────────────────────────────────────────────────

/** Puntos de bonificación que aportaría ya `bonusId` sumados a lo que el jugador tiene. */
function bonusScore(state: GameState, player: PlayerState, bonusId: string): number {
  const bonus = state.bonusCardsCatalog?.[bonusId];
  if (!bonus) return 0;
  const withBonus = { ...player, bonusCards: [...player.bonusCards, bonus] };
  return calculateBonusPoints(withBonus, state, bonus) + 0.7 * countBonusQualifyingUnits(withBonus, state, bonus);
}

/** Cartas de bonificación reveladas por un poder: se queda con la que más le sirve con sus aves. */
function chooseOfferedBonus(state: GameState, player: PlayerState): Move {
  const offered = player.pendingBonusChoice ?? [];
  const best = [...offered].sort((a, b) => bonusScore(state, player, b) - bonusScore(state, player, a))[0];
  return { type: "chooseBonusCard", bonusCardId: best };
}

function costUnits(card: SpeciesCard): number {
  const fixed = Object.values(card.cost).reduce((sum, amount) => sum + (amount ?? 0), 0);
  return fixed + (card.costAnyOf?.length ? 1 : 0);
}

/** Cuánto interesa conservar un ave en la mano inicial: puntos y nido, menos lo que cuesta. */
function startingCardValue(card: SpeciesCard): number {
  return card.points + 0.25 * card.eggCapacity + (card.powers.length > 0 ? 1 : 0) - 1.1 * costUnits(card);
}

/** Alimento que necesitan las aves elegidas, por tipo (el costo "o" cuenta como 1 del primer tipo). */
function foodNeeds(cards: SpeciesCard[]): Record<ResourceFace, number> {
  const needs: Record<ResourceFace, number> = { seed: 0, fruit: 0, insect: 0, fish: 0, rodent: 0, wild: 0 };
  for (const card of cards) {
    for (const [food, amount] of Object.entries(card.cost)) needs[food as ResourceFace] += amount ?? 0;
    if (card.costAnyOf?.length) needs[card.costAnyOf[0]] += 1;
  }
  return needs;
}

/**
 * Cuánto del costo de un ave cubren las fichas disponibles (0 a 1), gastándolas del inventario `stock`.
 * Un ave con costo 0 siempre está cubierta.
 */
function payableFraction(card: SpeciesCard, stock: Record<ResourceFace, number>): number {
  const units = costUnits(card) + (card.cost.wild ?? 0);
  if (units === 0) return 1;
  let covered = 0;
  const take = (food: ResourceFace) => {
    if (stock[food] > 0) {
      stock[food] -= 1;
      covered += 1;
    }
  };
  for (const [food, amount] of Object.entries(card.cost)) {
    if (food === "wild") continue;
    for (let i = 0; i < (amount ?? 0); i += 1) take(food as ResourceFace);
  }
  if (card.costAnyOf?.length) {
    const option = card.costAnyOf.find((food) => stock[food] > 0);
    if (option) take(option);
  }
  for (let i = 0; i < (card.cost.wild ?? 0); i += 1) {
    const any = FOODS.find((food) => stock[food] > 0);
    if (any) take(any);
  }
  return covered / units;
}

/**
 * Preparación inicial: elige cuántas aves conservar (cada una cuesta 1 ficha de alimento), cuáles y
 * qué alimento guardar para poder jugarlas, y la bonificación que mejor encaja con esas aves. Un ave
 * que no se podría pagar con el alimento que queda vale poco, así que no conviene llevarse de más.
 */
function chooseStartingHand(state: GameState, player: PlayerState, level: BotDifficulty): Move {
  const ranked = [...player.hand].sort(
    (a, b) => startingCardValue(state.cards[b]) - startingCardValue(state.cards[a]),
  );

  const plan = (keep: number) => {
    const cards = ranked.slice(0, keep).map((id) => state.cards[id]);
    const needs = foodNeeds(cards);
    // Se guardan las fichas que más piden las aves elegidas; el resto se descarta.
    const keptFoods = [...FOODS].sort((a, b) => needs[b] - needs[a]).slice(0, FOODS.length - keep);
    const stock: Record<ResourceFace, number> = { seed: 0, fruit: 0, insect: 0, fish: 0, rodent: 0, wild: 0 };
    for (const food of keptFoods) stock[food] = 1;
    let value = 0;
    let playable = 0;
    for (const card of cards) {
      const fraction = payableFraction(card, stock);
      if (fraction === 1) playable += 1;
      value += startingCardValue(card) * (0.35 + 0.65 * fraction);
    }
    value += 3 * Math.min(playable, 2); // poder jugar un ave en el primer turno vale mucho
    value += 0.3 * FOODS.reduce((sum, food) => sum + stock[food], 0); // fichas que sobran: flexibilidad
    return { keep, value, discard: FOODS.filter((food) => !keptFoods.includes(food)) };
  };

  const options = Array.from({ length: ranked.length + 1 }, (_, keep) => plan(keep));
  // Un principiante se conforma con cualquier número razonable de aves; el resto elige el mejor plan.
  const chosen =
    level === "easy"
      ? options[randomInt(1, Math.min(4, ranked.length))]
      : options.reduce((best, option) => (option.value > best.value ? option : best));

  const keepCards = ranked.slice(0, chosen.keep);
  const keptBirds = keepCards.map((id) => state.cards[id]);
  const offered = player.pendingBonusChoice ?? [];
  const bonusAffinity = (bonusId: string) => {
    const bonus = state.bonusCardsCatalog?.[bonusId];
    if (!bonus) return 0;
    return keptBirds.reduce((sum, card) => {
      const habitat = card.habitats[0];
      const board = Object.fromEntries(
        HABITATS.map((h) => [h, player.board[h].map((slot, i) => (h === habitat && i === 0 ? { ...slot, cardId: card.id } : slot))]),
      ) as PlayerState["board"];
      return sum + countBonusQualifyingUnits({ ...player, board }, { ...state, cards: { ...state.cards, [card.id]: card } }, bonus);
    }, 0);
  };
  const bonusCardId =
    level === "easy"
      ? sample(offered, 1)[0]
      : [...offered].sort((a, b) => bonusAffinity(b) - bonusAffinity(a) + (Math.random() - 0.5) * 0.4)[0];

  return { type: "chooseStart", keepCards, discardFood: chosen.discard.slice(0, keepCards.length), bonusCardId };
}

// ── Decisión del turno ───────────────────────────────────────────────────────

/**
 * Estado tras aplicar `move`, o null si el motor lo rechaza. Si la jugada deja una bonificación por
 * elegir, se resuelve ya con la mejor opción para poder valorar el resultado completo.
 */
function tryMove(state: GameState, botId: PlayerId, move: Move): GameState | null {
  try {
    let next = applyPlayerMove(state, botId, move);
    if (next.players[botId].pendingBonusChoice?.length) {
      next = applyPlayerMove(next, botId, chooseOfferedBonus(next, next.players[botId]));
    }
    return next;
  } catch {
    return null;
  }
}

/** Lo mejor que valdría el estado tras otra acción propia (como si volviera a tocarle enseguida). */
function bestFollowUp(after: GameState, botId: PlayerId, goalWeight: number, fallback: number): number {
  if (after.phase !== "round" || after.players[botId].actionCubesAvailable <= 0) return fallback;
  const resumed: GameState = { ...after, currentPlayerId: botId };
  let best = -Infinity;
  for (const move of candidateMoves(resumed, botId, 2, SENSIBLE_CHOICES)) {
    const next = tryMove(resumed, botId, move);
    if (next) best = Math.max(best, evaluate(next, botId, goalWeight));
  }
  return best === -Infinity ? fallback : best;
}

/** Jugada segura si algo falla: toma un dado (siempre legal) o, en la preparación, no conserva nada. */
export function fallbackMove(state: GameState, playerId: PlayerId): Move {
  const player = state.players[playerId];
  if (player.pendingStartingHand) {
    return { type: "chooseStart", keepCards: [], discardFood: [], bonusCardId: (player.pendingBonusChoice ?? [])[0] };
  }
  if (player.pendingBonusChoice?.length) return { type: "chooseBonusCard", bonusCardId: player.pendingBonusChoice[0] };
  return { type: "gainFood", dieIndexes: [0] };
}

/** La jugada que hace `botId` ahora, o null si no le toca hacer nada. */
export function chooseBotMove(state: GameState, botId: PlayerId): Move | null {
  const player = state.players[botId];
  const level = player?.botLevel;
  if (!player || !level) return null;

  if (player.pendingStartingHand) return chooseStartingHand(state, player, level);
  if (player.pendingBonusChoice?.length) return chooseOfferedBonus(state, player);
  if (state.phase !== "round" || state.currentPlayerId !== botId || player.actionCubesAvailable <= 0) return null;

  if (level === "easy") return randomMove(state, botId, { skipChance: 0.1, chaotic: false });

  const { perType, noise, goalWeight, lookahead } = settings[level];
  const scored: { move: Move; next: GameState; value: number }[] = [];
  for (const move of candidateMoves(state, botId, perType, SENSIBLE_CHOICES)) {
    const next = tryMove(state, botId, move);
    if (!next) continue; // una candidata que el motor rechaza simplemente se descarta
    scored.push({ move, next, value: evaluate(next, botId, goalWeight) + (noise ? (Math.random() - 0.5) * noise : 0) });
  }
  scored.sort((a, b) => b.value - a.value);

  // Mirada de dos jugadas (solo difícil): entre las mejores, se valora también lo mejor que podría
  // hacer con su siguiente acción ("tomar comida y luego jugar el ave").
  let best = scored[0] ?? null;
  if (lookahead > 0) {
    let bestValue = -Infinity;
    for (const option of scored.slice(0, lookahead)) {
      const value = 0.4 * option.value + 0.6 * bestFollowUp(option.next, botId, goalWeight, option.value);
      if (value > bestValue) {
        bestValue = value;
        best = option;
      }
    }
  }
  return best?.move ?? fallbackMove(state, botId);
}
