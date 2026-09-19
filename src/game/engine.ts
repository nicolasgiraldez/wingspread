import { automaCardsCatalog } from "./automaCards";
import { rollInitialFeeder, rollRandomDie, shuffle } from "./setup";
import type {
  BonusCard,
  CardId,
  GameState,
  HabitatId,
  Move,
  NestType,
  PlayerId,
  PlayerState,
  Power,
  PowerCardChoices,
  PowerEggChoices,
  PowerMoveChoices,
  PowerPlayBirdChoices,
  ResourceFace,
  RoundGoal,
  ScoreBreakdown,
  SlotRef,
  SpeciesCard,
} from "./types";

export const actionCountsByRound = {
  1: 8,
  2: 7,
  3: 6,
  4: 5,
} as const;

const moveLogLabels: Record<Move["type"], string> = {
  playBird: "Jugó un ave.",
  gainFood: "Obtuvo alimento del comedero.",
  layEggs: "Puso huevos.",
  drawBirdCards: "Robó cartas de ave.",
  rerollFeeder: "Relanzó los dados del comedero.",
  chooseBonusCard: "Eligió su carta de bonificación inicial.",
};

export function canRerollFeeder(feeder: ResourceFace[]): boolean {
  if (feeder.length === 0) return true;
  const first = feeder[0];
  return feeder.every((face) => face === first);
}

export function getHabitatActiveColumn(player: PlayerState, habitat: HabitatId): number {
  const index = player.board[habitat].findIndex((slot) => slot.cardId === null);
  return index === -1 ? 4 : index;
}

export function getHabitatActionAllowance(player: PlayerState, habitat: HabitatId) {
  const col = getHabitatActiveColumn(player, habitat);
  if (habitat === "forest") {
    const base = col >= 4 ? 3 : col >= 2 ? 2 : 1;
    const canTrade = col === 1 || col === 3;
    return { baseAmount: base, canTradeCard: canTrade, maxTotal: base + (canTrade ? 1 : 0) };
  }
  if (habitat === "grassland") {
    const base = col >= 4 ? 4 : col >= 2 ? 3 : 2;
    const canTrade = col === 1 || col === 3;
    return { baseAmount: base, canTradeFood: canTrade, maxTotal: base + (canTrade ? 1 : 0) };
  }
  const base = col >= 4 ? 3 : col >= 2 ? 2 : 1;
  const canTrade = col === 1 || col === 3;
  return { baseAmount: base, canTradeEgg: canTrade, maxTotal: base + (canTrade ? 1 : 0) };
}

/** Poderes "Al jugar" (blancos) de una carta: se ofrecen como opcionales al confirmar playBird. */
export function getOnPlayPowers(card: SpeciesCard): Power[] {
  return card.powers.filter((power) => power.timing === "onPlay");
}

export type ActivatablePower = { source: SlotRef; card: SpeciesCard; power: Power };

/**
 * Poderes "Al activar" (marrones) que se dispararían en un hábitat dado, en el mismo orden
 * derecha-a-izquierda en que `activateHabitat` los resolvería. Todos son opcionales.
 */
export function getActivatablePowers(
  state: GameState,
  player: PlayerState,
  habitat: HabitatId,
): ActivatablePower[] {
  const results: ActivatablePower[] = [];
  for (let slotIndex = player.board[habitat].length - 1; slotIndex >= 0; slotIndex -= 1) {
    const slot = player.board[habitat][slotIndex];
    if (!slot.cardId) continue;
    const card = state.cards[slot.cardId];
    if (!card) continue;
    for (const power of card.powers.filter((candidate) => candidate.timing === "onActivate")) {
      results.push({ source: { habitat, slotIndex }, card, power });
    }
  }
  return results;
}

const HABITAT_IDS: readonly unknown[] = ["forest", "grassland", "wetland"];
const RESOURCE_IDS: readonly unknown[] = ["seed", "fruit", "insect", "fish", "rodent", "wild"];

const FOOD_FACES: readonly unknown[] = ["seed", "fruit", "insect", "fish", "rodent"];
const isFoodFace = (value: unknown): value is ResourceFace => FOOD_FACES.includes(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isAbsent = (value: unknown) => value === undefined || value === null;
const isSlotRef = (value: unknown) =>
  isRecord(value) && HABITAT_IDS.includes(value.habitat) && Number.isInteger(value.slotIndex);
const isArrayOf = (value: unknown, check: (item: unknown) => boolean) =>
  Array.isArray(value) && value.every(check);
const isOptionalRecordOf = (value: unknown, check: (item: unknown) => boolean) =>
  isAbsent(value) || (isRecord(value) && Object.values(value).every(check));

/**
 * Comprueba que un movimiento tiene la FORMA correcta (tipos de cada campo) antes de mirar las
 * reglas del juego. Los movimientos del invitado online llegan por la red y no son de fiar:
 * sin esto, un campo con basura (p. ej. wildChoices: { 0: "fish" }) llegaría hasta el motor.
 */
function isWellFormedMove(move: unknown): move is Move {
  if (!isRecord(move) || typeof move.type !== "string") return false;

  const commonChoicesOk =
    (isAbsent(move.skipPowerIds) || isArrayOf(move.skipPowerIds, (id) => typeof id === "string")) &&
    isOptionalRecordOf(move.powerCardChoices, (id) => typeof id === "string") &&
    isOptionalRecordOf(move.powerEggChoices, isSlotRef) &&
    isOptionalRecordOf(move.powerMoveChoices, (habitat) => HABITAT_IDS.includes(habitat)) &&
    isOptionalRecordOf(
      move.powerPlayBirdChoices,
      (choice) =>
        isRecord(choice) &&
        typeof choice.cardId === "string" &&
        HABITAT_IDS.includes(choice.habitat) &&
        isArrayOf(choice.paidResources, (res) => RESOURCE_IDS.includes(res)) &&
        isArrayOf(choice.paidEggsFrom, isSlotRef) &&
        (isAbsent(choice.skipPowerIds) || isArrayOf(choice.skipPowerIds, (id) => typeof id === "string")),
    );
  if (!commonChoicesOk) return false;

  switch (move.type) {
    case "rerollFeeder":
      return true;
    case "chooseBonusCard":
      return typeof move.bonusCardId === "string";
    case "playBird":
      return (
        typeof move.cardId === "string" &&
        HABITAT_IDS.includes(move.habitat) &&
        Number.isInteger(move.slotIndex) &&
        isArrayOf(move.paidResources, (res) => RESOURCE_IDS.includes(res)) &&
        isArrayOf(move.paidEggsFrom, isSlotRef)
      );
    case "gainFood":
      return (
        isArrayOf(move.dieIndexes, Number.isInteger) &&
        isOptionalRecordOf(move.wildChoices, (choice) => choice === "insect" || choice === "seed") &&
        (isAbsent(move.rerollBefore) || typeof move.rerollBefore === "boolean") &&
        (isAbsent(move.tradeCardId) || typeof move.tradeCardId === "string")
      );
    case "layEggs":
      return (
        isArrayOf(move.eggPlacements, isSlotRef) &&
        (isAbsent(move.tradeResource) || RESOURCE_IDS.includes(move.tradeResource))
      );
    case "drawBirdCards":
      return (
        isArrayOf(
          move.draws,
          (draw) =>
            isRecord(draw) &&
            (draw.source === "deck" || (draw.source === "market" && typeof draw.marketCardId === "string")),
        ) &&
        (isAbsent(move.tradeEggFrom) || isSlotRef(move.tradeEggFrom))
      );
    default:
      return false;
  }
}

export function isLegalMove(state: GameState, playerId: string, move: Move): boolean {
  if (!isWellFormedMove(move)) return false;

  if (move.type === "chooseBonusCard") {
    const player = state.players[playerId];
    return !!player && !player.isAutoma && !!player.pendingBonusChoice?.includes(move.bonusCardId);
  }

  if (state.phase !== "round" || state.currentPlayerId !== playerId) return false;
  const player = state.players[playerId];
  if (!player || player.actionCubesAvailable <= 0 || player.isAutoma) return false;
  // Con una carta de bonificación por elegir no se puede hacer otra cosa hasta resolverla.
  if (player.pendingBonusChoice?.length) return false;

  if (move.type === "rerollFeeder") {
    return canRerollFeeder(state.feeder);
  }

  if (move.type === "playBird") {
    const card = state.cards[move.cardId];
    if (!card || !player.hand.includes(move.cardId)) return false;
    if (!card.habitats.includes(move.habitat)) return false;
    if (!player.board[move.habitat][move.slotIndex] || player.board[move.habitat][move.slotIndex].cardId) {
      return false;
    }
    if (!canPayEggCost(player, move.paidEggsFrom, eggCostForSlot(move.slotIndex))) {
      return false;
    }
    return canPayResources(player, move.paidResources, card.cost, card.costAnyOf);
  }

  if (move.type === "gainFood") {
    const allowance = getHabitatActionAllowance(player, "forest");
    let feederLength = state.feeder.length;

    if (move.rerollBefore) {
      if (!canRerollFeeder(state.feeder)) return false;
      feederLength = 5;
    }

    const uniqueIndexes = new Set(move.dieIndexes);
    if (uniqueIndexes.size !== move.dieIndexes.length) return false;

    let allowedCount = allowance.baseAmount;
    if (move.tradeCardId) {
      if (!allowance.canTradeCard || !player.hand.includes(move.tradeCardId)) return false;
      allowedCount += 1;
    }

    if (move.dieIndexes.length === 0 || move.dieIndexes.length > allowedCount) return false;
    return move.dieIndexes.every((index) => index >= 0 && index < feederLength);
  }

  if (move.type === "layEggs") {
    const allowance = getHabitatActionAllowance(player, "grassland");
    let allowedCount = allowance.baseAmount;

    if (move.tradeResource) {
      if (!allowance.canTradeFood || (player.resources[move.tradeResource] ?? 0) <= 0) {
        return false;
      }
      allowedCount += 1;
    }

    if (move.eggPlacements.length === 0 || move.eggPlacements.length > allowedCount) {
      return false;
    }

    const simulatedEggs: Record<string, number> = {};
    for (const ref of move.eggPlacements) {
      const key = `${ref.habitat}:${ref.slotIndex}`;
      simulatedEggs[key] = (simulatedEggs[key] ?? 0) + 1;
      const slot = player.board[ref.habitat]?.[ref.slotIndex];
      if (!slot?.cardId) return false;
      const card = state.cards[slot.cardId];
      if (slot.eggs + simulatedEggs[key] > card.eggCapacity) return false;
    }

    return true;
  }

  if (move.type === "drawBirdCards") {
    const allowance = getHabitatActionAllowance(player, "wetland");
    let allowedCount = allowance.baseAmount;

    if (move.tradeEggFrom) {
      if (!allowance.canTradeEgg) return false;
      const slot = player.board[move.tradeEggFrom.habitat]?.[move.tradeEggFrom.slotIndex];
      if (!slot || slot.eggs < 1) return false;
      allowedCount += 1;
    }

    if (move.draws.length === 0 || move.draws.length > allowedCount) return false;

    const remainingMarket = [...state.market];
    for (const draw of move.draws) {
      if (draw.source === "deck") {
        // Con el mazo vacío se baraja el descarte (ver drawCardFromDeck): solo es imposible sin ninguna carta.
        if (state.deck.length + state.discard.length === 0) return false;
      } else {
        const idx = remainingMarket.indexOf(draw.marketCardId);
        if (idx === -1) return false;
        remainingMarket.splice(idx, 1);
      }
    }

    return true;
  }

  return false;
}

export function applyMove(state: GameState, playerId: string, move: Move): GameState {
  if (!isLegalMove(state, playerId, move)) {
    throw new Error(`Movimiento ilegal: ${move.type}`);
  }

  let next = structuredClone(state) as GameState;
  const player = next.players[playerId];

  if (move.type === "chooseBonusCard") {
    resolveBonusCardChoice(next, player, move.bonusCardId);
    return next;
  }

  if (move.type === "rerollFeeder") {
    next.feeder = rollInitialFeeder(5);
    next.log.push({ playerId, message: moveLogLabels.rerollFeeder });
    return next;
  }

  if (move.type === "playBird") {
    playBird(next, player, move);
  } else if (move.type === "gainFood") {
    gainFood(next, player, move);
  } else if (move.type === "layEggs") {
    layEggs(next, player, move);
  } else if (move.type === "drawBirdCards") {
    drawBirdCards(next, player, move);
  }

  player.actionCubesAvailable -= 1;
  // Este turno propio cierra la ventana de "entre turnos": los poderes rosas del jugador
  // vuelven a estar disponibles para dispararse una vez durante la próxima ventana.
  player.pinkPowersUsed = [];
  next.log.push({
    playerId,
    message: moveLogLabels[move.type],
  });

  advanceTurn(next);

  // Auto execute Automa turn if next player is Automa
  while (
    next.phase === "round" &&
    next.currentPlayerId === "automa" &&
    next.players.automa?.actionCubesAvailable > 0
  ) {
    next = executeAutomaTurn(next);
  }

  return next;
}

/**
 * Resuelve la elección de una carta de bonificación ofrecida: conserva la elegida y descarta las
 * demás. Si era la elección inicial, arranca la Ronda 1 (fase "round") cuando todos los jugadores
 * humanos ya eligieron.
 */
function resolveBonusCardChoice(state: GameState, player: PlayerState, chosenId: string) {
  const offered = player.pendingBonusChoice ?? [];
  const discarded = offered.filter((id) => id !== chosenId);
  const chosen = state.bonusCardsCatalog?.[chosenId];
  if (chosen) player.bonusCards.push(chosen);
  state.bonusDiscard.push(...discarded);
  player.pendingBonusChoice = undefined;

  state.log.push({
    playerId: player.id,
    message:
      state.phase === "setup"
        ? `Eligió su carta de bonificación inicial: [${chosen?.name ?? chosenId}].`
        : `Conservó la carta de bonificación [${chosen?.name ?? chosenId}] y descartó ${discarded.length === 1 ? "la otra" : "las otras"}.`,
  });

  const stillPending = Object.values(state.players).some(
    (p) => !p.isAutoma && p.pendingBonusChoice && p.pendingBonusChoice.length > 0,
  );
  if (state.phase === "setup" && !stillPending) {
    state.phase = "round";
    state.log.push({ message: "¡Todos eligieron su carta de bonificación! Comienza la Ronda 1." });
  }
}

export function executeAutomaTurn(state: GameState): GameState {
  const next = structuredClone(state) as GameState;
  const automa = next.players.automa;
  if (!automa || !next.automaState || automa.actionCubesAvailable <= 0) {
    return next;
  }

  // Draw Automa card
  if (next.automaState.deck.length === 0) {
    next.automaState.deck = [...next.automaState.discard];
    next.automaState.discard = [];
  }

  const cardId = next.automaState.deck.shift() ?? Object.keys(automaCardsCatalog)[0];
  const automaCard = automaCardsCatalog[cardId];
  next.automaState.currentCard = automaCard;
  next.automaState.discard.push(cardId);

  const actions = automaCard.roundActions[next.round] ?? [];
  const actionDescriptions: string[] = [];

  for (const act of actions) {
    if (act.type === "gainFoodFromFeeder") {
      for (let i = 0; i < act.count; i += 1) {
        if (next.feeder.length > 0) {
          const removed = next.feeder.shift();
          actionDescriptions.push(`tomó 1 ${removed} del comedero`);
        }
      }
      if (next.feeder.length === 0) {
        next.feeder = rollInitialFeeder(5);
      }
    } else if (act.type === "drawMarketCard") {
      const count = act.count ?? 1;
      for (let i = 0; i < count; i += 1) {
        if (next.market.length > 0) {
          next.market.shift();
          actionDescriptions.push(`robó 1 carta del mercado`);
          const rep = drawCardFromDeck(next);
          if (rep) next.market.push(rep);
        }
      }
    } else if (act.type === "stashCardFromDeck") {
      for (let i = 0; i < act.count; i += 1) {
        const stashed = drawCardFromDeck(next);
        if (stashed) {
          next.automaState.stashedCardsCount += 1;
        }
      }
      actionDescriptions.push(`guardó ${act.count} ave(s) en su reserva`);
    } else if (act.type === "layEggs") {
      next.automaState.eggs += act.count;
      actionDescriptions.push(`acumuló ${act.count} huevo(s)`);
    } else if (act.type === "advanceGoal") {
      next.automaState.roundGoalMetric += act.metricBonus;
      actionDescriptions.push(`+${act.metricBonus} progreso en objetivo`);
    }
  }

  automa.actionCubesAvailable -= 1;
  next.log.push({
    playerId: "automa",
    message: `[${automaCard.name}]: ${actionDescriptions.join(", ")}.`,
  });

  advanceTurn(next);
  return next;
}

export function canPayResources(
  player: PlayerState,
  paidResources: ResourceFace[],
  cost: Partial<Record<ResourceFace, number>>,
  costAnyOf: ResourceFace[] = [],
): boolean {
  const tallyPaid = tally(paidResources);
  for (const [res, count] of Object.entries(tallyPaid)) {
    if ((player.resources[res as ResourceFace] ?? 0) < (count ?? 0)) {
      return false;
    }
  }

  const remainingPaid = [...paidResources];
  const requiredSpecific: ResourceFace[] = [];
  let requiredWildCount = cost.wild ?? 0;

  for (const [res, count] of Object.entries(cost)) {
    if (res === "wild") continue;
    for (let i = 0; i < (count ?? 0); i += 1) {
      requiredSpecific.push(res as ResourceFace);
    }
  }

  const unsatisfiedRequirements: ResourceFace[] = [];
  for (const req of requiredSpecific) {
    const idx = remainingPaid.indexOf(req);
    if (idx !== -1) {
      remainingPaid.splice(idx, 1);
    } else {
      unsatisfiedRequirements.push(req);
    }
  }

  // Costo "O": 1 unidad pagable con cualquiera de los tipos en costAnyOf (set restringido,
  // a diferencia de "wild" que acepta los 5 tipos). Si no hay un tipo aceptado entre lo
  // pagado, cae al mismo colchón de sustitución 2-por-1 que cualquier otro faltante.
  let anyOfUnsatisfied = 0;
  if (costAnyOf.length > 0) {
    const idx = remainingPaid.findIndex((res) => costAnyOf.includes(res));
    if (idx !== -1) {
      remainingPaid.splice(idx, 1);
    } else {
      anyOfUnsatisfied = 1;
    }
  }

  while (requiredWildCount > 0 && remainingPaid.length > 0) {
    remainingPaid.shift();
    requiredWildCount -= 1;
  }

  const totalUnsatisfiedCostUnits = unsatisfiedRequirements.length + requiredWildCount + anyOfUnsatisfied;
  if (remainingPaid.length !== totalUnsatisfiedCostUnits * 2) {
    return false;
  }

  return true;
}

function playBird(
  state: GameState,
  player: PlayerState,
  move: Extract<Move, { type: "playBird" }>,
) {
  placeBird(state, player, {
    cardId: move.cardId,
    habitat: move.habitat,
    slotIndex: move.slotIndex,
    paidResources: move.paidResources,
    paidEggsFrom: move.paidEggsFrom,
    skipPowerIds: move.skipPowerIds,
    cardChoices: move.powerCardChoices,
    playBirdChoices: move.powerPlayBirdChoices,
    eggChoices: move.powerEggChoices,
    moveChoices: move.powerMoveChoices,
  });
}

/**
 * Coloca un ave en el tablero y resuelve sus poderes "Al jugar". Extraído de `playBird` para
 * que también lo pueda invocar el poder "playSecondBird" (jugar una segunda ave como parte
 * de resolver otro poder), que arma un payload equivalente al de un movimiento normal.
 */
function placeBird(
  state: GameState,
  player: PlayerState,
  params: {
    cardId: CardId;
    habitat: HabitatId;
    slotIndex: number;
    paidResources: ResourceFace[];
    paidEggsFrom: SlotRef[];
    skipPowerIds?: string[];
    cardChoices?: PowerCardChoices;
    playBirdChoices?: PowerPlayBirdChoices;
    eggChoices?: PowerEggChoices;
    moveChoices?: PowerMoveChoices;
  },
) {
  const card = state.cards[params.cardId];
  spendResources(player, params.paidResources);
  spendEggs(player, params.paidEggsFrom);
  player.hand = player.hand.filter((id) => id !== params.cardId);
  player.board[params.habitat][params.slotIndex].cardId = params.cardId;

  const skipIds = new Set(params.skipPowerIds ?? []);
  for (const power of getOnPlayPowers(card)) {
    if (skipIds.has(power.id)) continue;
    resolvePower(
      state,
      player,
      power,
      { habitat: params.habitat, slotIndex: params.slotIndex },
      params.cardChoices,
      params.playBirdChoices,
      params.eggChoices,
      params.moveChoices,
    );
  }
  triggerPinkPowers(state, player.id, { type: "playBird", habitat: params.habitat });
}

function gainFood(state: GameState, player: PlayerState, move: Extract<Move, { type: "gainFood" }>) {
  if (move.rerollBefore && canRerollFeeder(state.feeder)) {
    state.feeder = rollInitialFeeder(5);
  }

  if (move.tradeCardId) {
    player.hand = player.hand.filter((id) => id !== move.tradeCardId);
    state.discard.push(move.tradeCardId);
  }

  const sortedIndexes = [...move.dieIndexes].sort((a, b) => b - a);
  for (const index of sortedIndexes) {
    const face = state.feeder[index];
    if (face) {
      // La cara "wild" representa insecto/semilla a elección del jugador
      const resource: ResourceFace =
        face === "wild"
          ? (move.wildChoices?.[index] ?? "insect")
          : face;
      player.resources[resource] = (player.resources[resource] ?? 0) + 1;
      state.feeder.splice(index, 1);
    }
  }

  if (state.feeder.length === 0) {
    state.feeder = rollInitialFeeder(5);
  }

  activateHabitat(
    state,
    player,
    "forest",
    new Set(move.skipPowerIds ?? []),
    move.powerCardChoices,
    undefined,
    move.powerEggChoices,
    move.powerMoveChoices,
  );
  triggerPinkPowers(state, player.id, { type: "gainFood" });
}

function layEggs(state: GameState, player: PlayerState, move: Extract<Move, { type: "layEggs" }>) {
  if (move.tradeResource) {
    player.resources[move.tradeResource] = (player.resources[move.tradeResource] ?? 1) - 1;
  }

  for (const placement of move.eggPlacements) {
    const slot = player.board[placement.habitat][placement.slotIndex];
    slot.eggs += 1;
  }

  activateHabitat(
    state,
    player,
    "grassland",
    new Set(move.skipPowerIds ?? []),
    move.powerCardChoices,
    undefined,
    move.powerEggChoices,
    move.powerMoveChoices,
  );
  triggerPinkPowers(state, player.id, { type: "layEggs" });
}

function drawCardFromDeck(state: GameState): string | undefined {
  if (state.deck.length === 0 && state.discard.length > 0) {
    state.deck = shuffle([...state.discard]);
    state.discard = [];
    state.log.push({ message: "El mazo se agotó. Se barajó la pila de descarte para formar un nuevo mazo." });
  }
  return state.deck.shift();
}

/**
 * Saca 1 dado del comedero y devuelve el recurso que da; si queda vacío, se relanzan los 5 dados
 * de inmediato (regla oficial). El dado comodín (insecto/semilla) se toma como insecto, igual que
 * en gainFood cuando el jugador no elige: estos poderes no ofrecen elección, y una cara "wild"
 * nunca debe llegar al inventario como si fuera un recurso.
 */
function takeDieFromFeeder(state: GameState): ResourceFace | undefined {
  if (state.feeder.length === 0) state.feeder = rollInitialFeeder(5);
  const die = state.feeder.shift();
  if (state.feeder.length === 0) state.feeder = rollInitialFeeder(5);
  return die === "wild" ? "insect" : die;
}

function drawBonusCardFromDeck(state: GameState): string | undefined {
  if (state.bonusDeck.length === 0 && state.bonusDiscard.length > 0) {
    state.bonusDeck = shuffle([...state.bonusDiscard]);
    state.bonusDiscard = [];
  }
  return state.bonusDeck.shift();
}

function drawBirdCards(
  state: GameState,
  player: PlayerState,
  move: Extract<Move, { type: "drawBirdCards" }>,
) {
  if (move.tradeEggFrom) {
    player.board[move.tradeEggFrom.habitat][move.tradeEggFrom.slotIndex].eggs -= 1;
  }

  for (const draw of move.draws) {
    if (draw.source === "deck") {
      const drawn = drawCardFromDeck(state);
      if (drawn) player.hand.push(drawn);
    } else {
      const cardId = draw.marketCardId;
      player.hand.push(cardId);
      state.market = state.market.filter((id) => id !== cardId);
      const replacement = drawCardFromDeck(state);
      if (replacement) state.market.push(replacement);
    }
  }

  activateHabitat(
    state,
    player,
    "wetland",
    new Set(move.skipPowerIds ?? []),
    move.powerCardChoices,
    undefined,
    move.powerEggChoices,
    move.powerMoveChoices,
  );
  triggerPinkPowers(state, player.id, { type: "drawBirdCards" });
}

function activateHabitat(
  state: GameState,
  player: PlayerState,
  habitat: HabitatId,
  skipIds: Set<string> = new Set(),
  cardChoices?: PowerCardChoices,
  playBirdChoices?: PowerPlayBirdChoices,
  eggChoices?: PowerEggChoices,
  moveChoices?: PowerMoveChoices,
) {
  for (const { source, power } of getActivatablePowers(state, player, habitat)) {
    if (skipIds.has(power.id)) continue;
    resolvePower(state, player, power, source, cardChoices, playBirdChoices, eggChoices, moveChoices);
  }
}

function triggerPinkPowers(
  state: GameState,
  actingPlayerId: PlayerId,
  event:
    | { type: "layEggs" }
    | { type: "playBird"; habitat: HabitatId }
    | { type: "predatorSuccess" }
    | { type: "gainFood" }
    | { type: "drawBirdCards" },
) {
  for (const [pId, otherPlayer] of Object.entries(state.players)) {
    if (pId === actingPlayerId || otherPlayer.isAutoma) continue;
    if (!otherPlayer.pinkPowersUsed) otherPlayer.pinkPowersUsed = [];

    for (const hab of ["forest", "grassland", "wetland"] as HabitatId[]) {
      otherPlayer.board[hab].forEach((slot, sIdx) => {
        if (!slot.cardId) return;
        const card = state.cards[slot.cardId];
        if (!card) return;

        for (const power of card.powers.filter((p) => p.timing === "onceBetweenTurns")) {
          // Regla: un poder rosa solo puede activarse 1 vez entre cada turno propio de su dueño.
          if (otherPlayer.pinkPowersUsed!.includes(power.id)) continue;

          let matched = false;
          if (event.type === "layEggs" && power.kind === "layEgg") {
            matched = true;
          } else if (
            event.type === "playBird" &&
            power.kind === "gainResource" &&
            power.from !== "feeder" &&
            (!power.habitat || power.habitat === event.habitat)
          ) {
            matched = true;
          } else if (
            event.type === "playBird" &&
            power.kind === "tuckCard" &&
            (!power.habitat || power.habitat === event.habitat)
          ) {
            matched = true;
          } else if (
            event.type === "predatorSuccess" &&
            power.kind === "gainResource" &&
            power.from === "feeder"
          ) {
            matched = true;
          } else if (
            event.type === "gainFood" &&
            power.kind === "gainResource" &&
            power.from !== "feeder" &&
            !power.habitat
          ) {
            matched = true;
          } else if (event.type === "gainFood" && power.kind === "cacheFood") {
            matched = true;
          } else if (event.type === "drawBirdCards" && power.kind === "drawCard") {
            matched = true;
          }

          if (matched) {
            resolvePower(state, otherPlayer, power, { habitat: hab, slotIndex: sIdx });
            otherPlayer.pinkPowersUsed!.push(power.id);
          }
        }
      });
    }
  }
}

export function resolvePower(
  state: GameState,
  player: PlayerState,
  power: Power,
  source: SlotRef,
  cardChoices?: PowerCardChoices,
  playBirdChoices?: PowerPlayBirdChoices,
  eggChoices?: PowerEggChoices,
  moveChoices?: PowerMoveChoices,
) {
  const currentSlot = player.board[source.habitat]?.[source.slotIndex];
  const birdCard = currentSlot?.cardId ? state.cards[currentSlot.cardId] : null;
  const birdName = birdCard?.name ?? "Ave";

  if (power.kind === "gainResource") {
    if (power.costsEgg) {
      const paid = tryPayEggCost(
        player,
        power.costsEgg,
        power.costEggExcludesSelf,
        source,
        eggChoices?.[power.id],
      );
      if (!paid) {
        state.log.push({
          playerId: player.id,
          message: `Poder de [${birdName}]: no tenía ningún huevo disponible para pagar este poder.`,
        });
        return;
      }
    }
    const eggNote = power.costsEgg ? " (descartando 1 huevo)" : "";
    if (power.from === "feeder" && power.anyDie) {
      const die = takeDieFromFeeder(state);
      if (die) {
        player.resources[die] = (player.resources[die] ?? 0) + power.amount;
        state.log.push({
          playerId: player.id,
          message: `Poder de [${birdName}]: tomó 1 ${die} del comedero${eggNote}.`,
        });
      }
      return;
    }
    if (power.from === "feeder") {
      // Si el tipo principal no está en el comedero, probamos con el alternativo (si existe).
      let res = power.resource ?? "seed";
      if (!state.feeder.includes(res) && power.resourceAlt && state.feeder.includes(power.resourceAlt)) {
        res = power.resourceAlt;
      }

      if (power.gainAllMatching) {
        let count = 0;
        while (state.feeder.includes(res)) {
          state.feeder.splice(state.feeder.indexOf(res), 1);
          count += 1;
        }
        if (count > 0) {
          player.resources[res] = (player.resources[res] ?? 0) + count;
          state.log.push({
            playerId: player.id,
            message: `Poder de [${birdName}]: tomó ${count} ${res} del comedero (todos los disponibles)${eggNote}.`,
          });
          if (state.feeder.length === 0) {
            state.feeder = rollInitialFeeder(5);
          }
        }
      } else {
        const dieIdx = state.feeder.indexOf(res);
        if (dieIdx !== -1) {
          state.feeder.splice(dieIdx, 1);
          player.resources[res] = (player.resources[res] ?? 0) + power.amount;
          state.log.push({
            playerId: player.id,
            message: `Poder de [${birdName}]: tomó 1 ${res} del comedero${eggNote}.`,
          });
          if (state.feeder.length === 0) {
            state.feeder = rollInitialFeeder(5);
          }
        }
      }
    } else {
      // "wild" acá significa "1 alimento a elección" (no un recurso): el jugador lo elige vía
      // cardChoices y, si no lo hace (o manda algo inválido), se toma insecto.
      const chosen = cardChoices?.[power.id];
      const res: ResourceFace =
        power.resource === "wild" ? (isFoodFace(chosen) ? chosen : "insect") : (power.resource ?? "seed");
      player.resources[res] = (player.resources[res] ?? 0) + power.amount;
      state.log.push({
        playerId: player.id,
        message: `Poder de [${birdName}]: obtuvo ${power.amount} ${res} de la reserva${eggNote}.`,
      });
    }
    return;
  }

  if (power.kind === "drawCard") {
    if (power.costsEgg) {
      const paid = tryPayEggCost(player, power.costsEgg, power.costEggExcludesSelf, source, eggChoices?.[power.id]);
      if (!paid) {
        state.log.push({
          playerId: player.id,
          message: `Poder de [${birdName}]: no tenía ningún huevo disponible para pagar este poder.`,
        });
        return;
      }
    }
    let drawnCount = 0;
    for (let index = 0; index < power.amount; index += 1) {
      const drawn = drawCardFromDeck(state);
      if (drawn) {
        player.hand.push(drawn);
        drawnCount += 1;
      }
    }
    let msg = `Poder de [${birdName}]: robó ${drawnCount} carta(s) del mazo.`;
    if (power.thenDiscard && player.hand.length > 0) {
      const discarded = takeCardFromHand(player, cardChoices?.[power.id]);
      if (discarded) {
        state.discard.push(discarded);
        const discardedCard = state.cards[discarded];
        msg += ` Y descartó 1 carta (${discardedCard?.name ?? "carta"}).`;
      }
    }
    state.log.push({ playerId: player.id, message: msg });
    return;
  }

  if (power.kind === "layEgg") {
    if (power.target === "self") {
      applyEggsToTarget(state, player, source, power.amount, birdName);
      return;
    }

    if (power.target === "eachNestType") {
      for (const hab of Object.keys(player.board) as HabitatId[]) {
        player.board[hab].forEach((slot, sIdx) => {
          if (!slot.cardId) return;
          const targetCard = state.cards[slot.cardId];
          if (targetCard && matchesNestType(targetCard.nestType, power.nestType)) {
            applyEggsToTarget(state, player, { habitat: hab, slotIndex: sIdx }, power.amount, birdName);
          }
        });
      }
      return;
    }

    if (power.target === "allPlayersNestType") {
      for (const p of Object.values(state.players)) {
        if (p.isAutoma) continue;
        const target = findEggTargetByNestType(state, p, power.nestType);
        if (target) applyEggsToTarget(state, p, target, 1, birdName);
      }
      if (power.activePlayerBonus) {
        const chosen = eggChoices?.[power.id];
        const target = isValidEggTarget(state, player, chosen, power.nestType)
          ? chosen!
          : findEggTargetByNestType(state, player, power.nestType);
        if (target) applyEggsToTarget(state, player, target, power.activePlayerBonus, birdName);
      }
      return;
    }

    // target "any" | "nestType": el jugador elige (o se autoselecciona el primero que califique).
    // "nestType" en este mazo siempre es el patrón rosa "otra ave", por eso excluye la propia carta.
    const chosen = eggChoices?.[power.id];
    const chosenValid = power.target === "nestType"
      ? isValidEggTarget(state, player, chosen, power.nestType)
      : isValidEggTarget(state, player, chosen);
    const target = chosenValid
      ? chosen!
      : power.target === "nestType"
        ? findEggTargetByNestType(state, player, power.nestType, source)
        : findFirstEggSpace(state, player);
    if (target) applyEggsToTarget(state, player, target, power.amount, birdName);
    return;
  }

  if (power.kind === "tuckCard") {
    if (currentSlot) {
      if (power.costResource) {
        const need = power.costAmount ?? 1;
        if ((player.resources[power.costResource] ?? 0) < need) {
          state.log.push({
            playerId: player.id,
            message: `Poder de [${birdName}]: no tenía suficiente ${power.costResource} para pagar este poder.`,
          });
          return;
        }
        player.resources[power.costResource] = (player.resources[power.costResource] ?? 0) - need;
      }

      const tuckedCards: string[] = [];
      if (power.source === "deck") {
        for (let i = 0; i < power.amount; i += 1) {
          const drawn = drawCardFromDeck(state);
          if (drawn) {
            currentSlot.tucked.push(drawn);
            tuckedCards.push(drawn);
          }
        }
      } else if (power.source === "hand" && player.hand.length > 0) {
        const fromHand = takeCardFromHand(player, cardChoices?.[power.id]);
        if (fromHand) {
          currentSlot.tucked.push(fromHand);
          tuckedCards.push(fromHand);
        }
      }

      if (tuckedCards.length > 0) {
        const names = tuckedCards.map((id) => state.cards[id]?.name ?? "carta").join(", ");
        const costNote = power.costResource ? ` (pagando ${power.costAmount ?? 1} ${power.costResource})` : "";
        let msg = `Poder de [${birdName}]: solapó ${tuckedCards.length} carta(s) (${names})${costNote}.`;
        if (power.thenDraw) {
          const newCard = drawCardFromDeck(state);
          if (newCard) {
            player.hand.push(newCard);
            msg += ` Y robó 1 carta del mazo.`;
          }
        }
        if (power.thenGainEgg) {
          if (birdCard && currentSlot.eggs < birdCard.eggCapacity) {
            currentSlot.eggs += 1;
            msg += ` Y puso 1 huevo en su nido.`;
          }
        }
        if (power.thenGainResource) {
          player.resources[power.thenGainResource] = (player.resources[power.thenGainResource] ?? 0) + 1;
          msg += ` Y ganó 1 ${power.thenGainResource} de la reserva.`;
        }
        state.log.push({ playerId: player.id, message: msg });
      }
    }
    return;
  }

  if (power.kind === "cacheFood") {
    if (currentSlot) {
      const res = power.resource ?? "seed";
      currentSlot.cached.push(res);
      state.log.push({
        playerId: player.id,
        message: `Poder de [${birdName}]: almacenó 1 ${res} en su carta.`,
      });
    }
    return;
  }

  if (power.kind === "huntPredator") {
    const revealed = drawCardFromDeck(state);
    if (revealed) {
      const revealedCard = state.cards[revealed];
      const wingspan = revealedCard?.wingspanCm ?? 999;
      if (wingspan <= power.maxWingspanCm) {
        currentSlot?.tucked.push(revealed);
        state.log.push({
          playerId: player.id,
          message: `Depredador [${birdName}]: ¡Caza exitosa! Reveló a [${revealedCard?.name ?? revealed}] (${wingspan} cm ≤ ${power.maxWingspanCm} cm) y la solapó debajo.`,
        });
        triggerPinkPowers(state, player.id, { type: "predatorSuccess" });
      } else {
        if (power.onFailDrawCard) {
          player.hand.push(revealed);
          state.log.push({
            playerId: player.id,
            message: `Poder de [${birdName}]: Reveló a [${revealedCard?.name ?? revealed}] (${wingspan} cm > ${power.maxWingspanCm} cm) y la sumó a su mano.`,
          });
        } else {
          state.discard.push(revealed);
          state.log.push({
            playerId: player.id,
            message: `Depredador [${birdName}]: Caza fallida. Reveló a [${revealedCard?.name ?? revealed}] (${wingspan} cm > ${power.maxWingspanCm} cm). Descartada.`,
          });
        }
      }
    }
    return;
  }

  if (power.kind === "diceHuntPredator") {
    // Relanza los dados que están fuera del comedero (los que los jugadores ya tomaron en
    // este ciclo). Si el comedero está lleno, no hay nada que relanzar: la caza falla sola.
    const diceOutside = Math.max(0, 5 - state.feeder.length);
    const rerolled = Array.from({ length: diceOutside }, () => rollRandomDie());
    const success = rerolled.includes(power.resource);

    if (success && currentSlot) {
      currentSlot.cached.push(power.resource);
      state.log.push({
        playerId: player.id,
        message: `Depredador [${birdName}]: ¡Caza exitosa! Relanzó ${diceOutside} dado(s) fuera del comedero y obtuvo ${power.resource}, que quedó cacheado en la carta.`,
      });
      triggerPinkPowers(state, player.id, { type: "predatorSuccess" });
    } else {
      state.log.push({
        playerId: player.id,
        message: `Depredador [${birdName}]: Caza fallida (relanzó ${diceOutside} dado(s) fuera del comedero, ninguno coincidió).`,
      });
    }
    return;
  }

  if (power.kind === "allPlayersGain") {
    if (power.benefitType === "card") {
      for (const p of Object.values(state.players)) {
        if (p.isAutoma) continue;
        const drawn = drawCardFromDeck(state);
        if (drawn) p.hand.push(drawn);
      }
      state.log.push({
        playerId: player.id,
        message: `Poder de [${birdName}]: todos los jugadores robaron 1 carta del mazo.`,
      });
      return;
    }

    const res = power.resource ?? "seed";
    for (const p of Object.values(state.players)) {
      if (!p.isAutoma) {
        p.resources[res] = (p.resources[res] ?? 0) + 1;
      }
    }
    state.log.push({
      playerId: player.id,
      message: `Poder de [${birdName}]: todos los jugadores obtuvieron 1 ${res} de la reserva.`,
    });
    return;
  }

  if (power.kind === "tradeResource") {
    const trade = resolveTrade(player, power, cardChoices?.[power.id]);
    if (trade) {
      player.resources[trade.pay] = (player.resources[trade.pay] ?? 1) - 1;
      player.resources[trade.gain] = (player.resources[trade.gain] ?? 0) + (power.amount ?? 1);
      state.log.push({
        playerId: player.id,
        message: `Poder de [${birdName}]: cambió 1 ${trade.pay} por ${power.amount ?? 1} ${trade.gain}.`,
      });
    }
    return;
  }

  if (power.kind === "gainBonusCard") {
    const drawn: string[] = [];
    for (let i = 0; i < power.drawCount; i += 1) {
      const bonusId = drawBonusCardFromDeck(state);
      if (bonusId) drawn.push(bonusId);
    }

    // Se ve qué cartas salieron y el jugador elige cuál conservar: quedan como oferta pendiente
    // (ver PlayerState.pendingBonusChoice) y se resuelven con un movimiento chooseBonusCard.
    // Solo se pregunta si hay algo que elegir y nada más pendiente; si no (o si de antemano se
    // indicó una carta por cardChoices y salió), se resuelve sola con la elegida o las primeras.
    const chosenId = cardChoices?.[power.id];
    const preChosen = !!chosenId && drawn.includes(chosenId);
    const canAsk =
      !preChosen && !player.isAutoma && power.keepCount === 1 && drawn.length > 1 && !player.pendingBonusChoice?.length;
    if (canAsk) {
      player.pendingBonusChoice = drawn;
      state.log.push({
        playerId: player.id,
        message: `Poder de [${birdName}]: reveló ${drawn.length} cartas de bonificación y debe elegir una.`,
      });
      return;
    }
    const kept = preChosen ? [chosenId] : drawn.slice(0, power.keepCount);
    const discarded = drawn.filter((id) => !kept.includes(id));

    for (const id of kept) {
      const bonus = state.bonusCardsCatalog?.[id];
      if (bonus) player.bonusCards.push(bonus);
    }
    state.bonusDiscard.push(...discarded);

    const keptNames = kept.map((id) => state.bonusCardsCatalog?.[id]?.name ?? id).join(", ");
    state.log.push({
      playerId: player.id,
      message: `Poder de [${birdName}]: reveló ${drawn.length} carta(s) de bonificación y conservó [${keptNames || "ninguna"}].`,
    });
    return;
  }

  if (power.kind === "playSecondBird") {
    const choice = playBirdChoices?.[power.id];
    if (!choice) return; // el jugador optó por no jugar una segunda ave

    const secondCard = state.cards[choice.cardId];
    const targetHabitat = choice.habitat;
    const slotIndex = getHabitatActiveColumn(player, targetHabitat);

    const isValid =
      secondCard &&
      player.hand.includes(choice.cardId) &&
      power.habitats.includes(targetHabitat) &&
      secondCard.habitats.includes(targetHabitat) &&
      player.board[targetHabitat]?.[slotIndex] &&
      !player.board[targetHabitat][slotIndex].cardId &&
      canPayEggCost(player, choice.paidEggsFrom, eggCostForSlot(slotIndex)) &&
      canPayResources(player, choice.paidResources, secondCard.cost, secondCard.costAnyOf);

    if (!isValid) {
      state.log.push({
        playerId: player.id,
        message: `Poder de [${birdName}]: no se pudo jugar una segunda ave (elección inválida).`,
      });
      return;
    }

    placeBird(state, player, {
      cardId: choice.cardId,
      habitat: targetHabitat,
      slotIndex,
      paidResources: choice.paidResources,
      paidEggsFrom: choice.paidEggsFrom,
      skipPowerIds: choice.skipPowerIds,
    });

    state.log.push({
      playerId: player.id,
      message: `Poder de [${birdName}]: jugó una segunda ave, [${secondCard.name}], en ${targetHabitat}.`,
    });
    return;
  }

  if (power.kind === "moveToHabitat") {
    if (!birdCard || !isRightmostInHabitat(player, source)) {
      state.log.push({
        playerId: player.id,
        message: `Poder de [${birdName}]: no está en la columna más a la derecha de su hábitat, no se puede mover.`,
      });
      return;
    }

    const hasOpenSlot = (h: HabitatId) => player.board[h].some((slot) => !slot.cardId);
    const candidateHabitats = birdCard.habitats.filter((h) => h !== source.habitat);
    const chosenHabitat = moveChoices?.[power.id];
    const targetHabitat =
      chosenHabitat && candidateHabitats.includes(chosenHabitat) && hasOpenSlot(chosenHabitat)
        ? chosenHabitat
        : candidateHabitats.find(hasOpenSlot);

    if (!targetHabitat) {
      state.log.push({
        playerId: player.id,
        message: `Poder de [${birdName}]: no hay otro hábitat con espacio libre para moverla.`,
      });
      return;
    }

    const targetSlotIndex = player.board[targetHabitat].findIndex((slot) => !slot.cardId);
    const movedSlot = { ...currentSlot! };
    player.board[source.habitat][source.slotIndex] = { cardId: null, eggs: 0, cached: [], tucked: [] };
    player.board[targetHabitat][targetSlotIndex] = movedSlot;

    state.log.push({
      playerId: player.id,
      message: `Poder de [${birdName}]: se movió de ${source.habitat} a ${targetHabitat}.`,
    });
    return;
  }

  if (power.kind === "repeatPower") {
    const candidates = getActivatablePowers(state, player, source.habitat).filter(({ source: s, power: p }) => {
      if (s.habitat === source.habitat && s.slotIndex === source.slotIndex) return false; // no a sí misma
      if (power.predatorOnly) return p.kind === "huntPredator" || p.kind === "diceHuntPredator";
      return true;
    });

    const chosen = eggChoices?.[power.id];
    const target =
      candidates.find(
        ({ source: s }) => chosen && s.habitat === chosen.habitat && s.slotIndex === chosen.slotIndex,
      ) ?? candidates[0];

    if (!target) {
      state.log.push({
        playerId: player.id,
        message: `Poder de [${birdName}]: no había otro poder ${power.predatorOnly ? "de caza " : ""}para repetir en este hábitat.`,
      });
      return;
    }

    state.log.push({
      playerId: player.id,
      message: `Poder de [${birdName}]: repite el poder de [${target.card.name}].`,
    });
    resolvePower(state, player, target.power, target.source, cardChoices, playBirdChoices, eggChoices, moveChoices);
    return;
  }

  if (power.kind === "fewestBirdsBenefit") {
    const counts = Object.values(state.players)
      .filter((p) => !p.isAutoma)
      .map((p) => ({ player: p, count: p.board[power.habitat].filter((s) => s.cardId).length }));
    if (counts.length === 0) return;

    const minCount = Math.min(...counts.map((c) => c.count));
    const winners = counts.filter((c) => c.count === minCount).map((c) => c.player);
    const winnerNames = winners.map((w) => w.name).join(", ");

    if (power.benefitType === "drawCard") {
      for (const winner of winners) {
        for (let i = 0; i < (power.amount ?? 1); i += 1) {
          const drawn = drawCardFromDeck(state);
          if (drawn) winner.hand.push(drawn);
        }
      }
      state.log.push({
        playerId: player.id,
        message: `Poder de [${birdName}]: [${winnerNames}] (menos aves en ${power.habitat}) robó(aron) ${power.amount ?? 1} carta(s).`,
      });
    } else {
      for (const winner of winners) {
        const die = takeDieFromFeeder(state);
        if (die) {
          winner.resources[die] = (winner.resources[die] ?? 0) + 1;
        }
      }
      state.log.push({
        playerId: player.id,
        message: `Poder de [${birdName}]: [${winnerNames}] (menos aves en ${power.habitat}) tomó(aron) 1 dado del comedero.`,
      });
    }
    return;
  }

  if (power.kind === "allPlayersGainDie") {
    const order = [player.id, ...state.playerOrder.filter((id) => id !== player.id)];
    for (const pId of order) {
      const p = state.players[pId];
      if (!p || p.isAutoma) continue;
      const die = takeDieFromFeeder(state);
      if (die) {
        p.resources[die] = (p.resources[die] ?? 0) + 1;
      }
    }
    state.log.push({
      playerId: player.id,
      message: `Poder de [${birdName}]: cada jugador tomó 1 dado del comedero, empezando por ${player.name}.`,
    });
  }
}

export function evaluateRoundGoalMetric(
  player: PlayerState,
  state: GameState,
  goal: RoundGoal,
): number {
  if (player.isAutoma && state.automaState) {
    return state.automaState.roundGoalMetric;
  }

  if (goal.type === "eggsInHabitat" && goal.habitat) {
    return player.board[goal.habitat].reduce((sum, slot) => sum + slot.eggs, 0);
  }
  if (goal.type === "birdsInHabitat" && goal.habitat) {
    return player.board[goal.habitat].filter((slot) => slot.cardId !== null).length;
  }
  if (goal.type === "totalBirds") {
    let total = 0;
    for (const row of Object.values(player.board)) {
      total += row.filter((slot) => slot.cardId !== null).length;
    }
    return total;
  }
  if (goal.type === "birdsWithEggsInNests" || goal.type === "eggsInNests") {
    let birds = 0;
    let eggs = 0;
    for (const row of Object.values(player.board)) {
      for (const slot of row) {
        if (!slot.cardId) continue;
        const card = state.cards[slot.cardId];
        if (!card || !matchesNestType(card.nestType, goal.nestType)) continue;
        eggs += slot.eggs;
        if (slot.eggs > 0) birds += 1;
      }
    }
    return goal.type === "birdsWithEggsInNests" ? birds : eggs;
  }
  if (goal.type === "eggSets") {
    const eggsIn = (habitat: HabitatId) => player.board[habitat].reduce((sum, slot) => sum + slot.eggs, 0);
    return Math.min(eggsIn("forest"), eggsIn("grassland"), eggsIn("wetland"));
  }
  return 0;
}

export function resolveRoundEnd(state: GameState) {
  const currentGoal = state.roundGoals[state.round - 1];
  const roundPointsTable = {
    1: [4, 1],
    2: [5, 2],
    3: [6, 3],
    4: [7, 4],
  } as const;

  const pointTiers = roundPointsTable[state.round];
  const scoresByPlayer: Record<PlayerId, number> = {};

  if (currentGoal) {
    const playerMetrics = state.playerOrder.map((id) => ({
      playerId: id,
      metric: evaluateRoundGoalMetric(state.players[id], state, currentGoal),
    }));

    playerMetrics.sort((a, b) => b.metric - a.metric);

    if (playerMetrics[0].metric > playerMetrics[1]?.metric) {
      scoresByPlayer[playerMetrics[0].playerId] = pointTiers[0];
      if (playerMetrics[1]) {
        scoresByPlayer[playerMetrics[1].playerId] = playerMetrics[1].metric > 0 ? pointTiers[1] : 0;
      }
    } else if (playerMetrics[0].metric > 0 && playerMetrics[0].metric === playerMetrics[1]?.metric) {
      const tiedPoints = Math.floor((pointTiers[0] + pointTiers[1]) / 2);
      scoresByPlayer[playerMetrics[0].playerId] = tiedPoints;
      scoresByPlayer[playerMetrics[1].playerId] = tiedPoints;
    } else {
      for (const p of playerMetrics) {
        scoresByPlayer[p.playerId] = 0;
      }
    }
  }

  if (!state.roundGoalResults) {
    state.roundGoalResults = {};
  }
  state.roundGoalResults[state.round] = scoresByPlayer;

  for (const [id, score] of Object.entries(scoresByPlayer)) {
    state.players[id].roundGoalScores.push(score);
  }

  if (state.automaState) {
    state.automaState.roundGoalMetric = 0;
  }

  // Refresh market
  state.discard.push(...state.market);
  state.market = [];
  while (state.market.length < 3) {
    const card = drawCardFromDeck(state);
    if (!card) break;
    state.market.push(card);
  }

  // Rotate first player
  const currentFirstIndex = state.playerOrder.indexOf(state.firstPlayerId);
  const nextFirstIndex = (currentFirstIndex + 1) % state.playerOrder.length;
  state.firstPlayerId = state.playerOrder[nextFirstIndex];
  state.currentPlayerId = state.firstPlayerId;

  if (state.round === 4) {
    state.phase = "gameEnd";
    state.log.push({ message: "Partida finalizada. ¡Fin de la ronda 4!" });
    return;
  }

  state.round = (state.round + 1) as GameState["round"];
  for (const p of Object.values(state.players)) {
    p.actionCubesAvailable = actionCountsByRound[state.round];
  }
  state.log.push({ message: `Comenzó la ronda ${state.round}.` });
}

function advanceTurn(state: GameState) {
  if (Object.values(state.players).every((player) => player.actionCubesAvailable === 0)) {
    resolveRoundEnd(state);
    return;
  }

  const startIndex = state.playerOrder.indexOf(state.currentPlayerId);
  for (let offset = 1; offset <= state.playerOrder.length; offset += 1) {
    const candidate = state.playerOrder[(startIndex + offset) % state.playerOrder.length];
    if (state.players[candidate].actionCubesAvailable > 0) {
      state.currentPlayerId = candidate;
      return;
    }
  }
}

/**
 * ¿El ave "come" este alimento? Cuenta los alimentos del costo fijo, los del costo "o"
 * (costAnyOf) y el comodín. Con `only`, además no puede comer ningún otro alimento.
 */
function eatsResource(card: SpeciesCard, resource: ResourceFace, only = false): boolean {
  const eaten = new Set<ResourceFace>(card.costAnyOf ?? []);
  for (const [res, amount] of Object.entries(card.cost)) if ((amount ?? 0) > 0) eaten.add(res as ResourceFace);
  return eaten.has(resource) && (!only || eaten.size === 1);
}

/** Rango numérico inclusivo; un extremo ausente no restringe ese lado. */
function withinRange(value: number | undefined, min: number | undefined, max: number | undefined): boolean {
  if (value === undefined) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/** Hábitat propio (forest/grassland/wetland) donde el jugador tiene menos aves jugadas. */
function findFewestBirdsHabitat(player: PlayerState): HabitatId {
  const habitats: HabitatId[] = ["forest", "grassland", "wetland"];
  let best = habitats[0];
  let bestCount = Infinity;
  for (const hab of habitats) {
    const count = player.board[hab].filter((slot) => slot.cardId).length;
    if (count < bestCount) {
      bestCount = count;
      best = hab;
    }
  }
  return best;
}

function countBonusQualifyingUnits(player: PlayerState, state: GameState, bonus: BonusCard): number {
  if (bonus.conditionType === "cardsInHand") {
    return player.hand.length;
  }

  const targetHabitat =
    bonus.conditionType === "birdsInFewestOwnHabitat" ? findFewestBirdsHabitat(player) : bonus.habitat;

  let count = 0;
  for (const row of Object.values(player.board)) {
    for (const slot of row) {
      if (!slot.cardId) continue;
      const card = state.cards[slot.cardId];
      if (!card) continue;

      switch (bonus.conditionType) {
        case "birdsInHabitat":
        case "birdsInFewestOwnHabitat":
          if (targetHabitat && card.habitats.includes(targetHabitat)) {
            if (!bonus.onlyHabitat || card.habitats.length === 1) count += 1;
          }
          break;
        case "birdsWithFoodCost":
          if (bonus.resourceCost && eatsResource(card, bonus.resourceCost, bonus.onlyResourceCost)) count += 1;
          break;
        case "birdsWithNest":
          if (bonus.nestType && (card.nestType === bonus.nestType || card.nestType === "wild")) count += 1;
          break;
        case "birdsWithWingspan":
          if (withinRange(card.wingspanCm, bonus.minWingspanCm, bonus.maxWingspanCm)) count += 1;
          break;
        case "birdsWithPoints":
          if (withinRange(card.points, bonus.minPoints, bonus.maxPoints)) count += 1;
          break;
        case "birdsWithMinEggs":
          if (bonus.minEggs !== undefined && slot.eggs >= bonus.minEggs) count += 1;
          break;
        case "birdsWithNameTag":
          if (bonus.nameTag && card.nameTags?.includes(bonus.nameTag)) count += 1;
          break;
        case "birdsWithPowerKind":
          if (bonus.powerKinds && card.powers.some((p) => bonus.powerKinds!.includes(p.kind))) count += 1;
          break;
        case "totalEggs":
          count += slot.eggs;
          break;
        case "tuckedCards":
          count += slot.tucked.length;
          break;
      }
    }
  }
  return count;
}

export function calculateBonusPoints(
  player: PlayerState,
  state: GameState,
  bonus: BonusCard,
): number {
  const count = countBonusQualifyingUnits(player, state, bonus);

  if (bonus.scoringMode === "perBird") {
    return count * (bonus.pointsPerBird ?? 0);
  }

  const sortedTiers = [...(bonus.tiers ?? [])].sort((a, b) => b.threshold - a.threshold);
  for (const tier of sortedTiers) {
    if (count >= tier.threshold) {
      return tier.points;
    }
  }
  return 0;
}

export function scorePlayerDetails(state: GameState, playerId: string): ScoreBreakdown {
  const player = state.players[playerId];

  if (playerId === "automa" && state.automaState) {
    const diffMultipliers = { easy: 3, normal: 4, hard: 5 };
    const diffBonus = { easy: 0, normal: 3, hard: 6 };
    const multiplier = diffMultipliers[state.automaState.difficulty] ?? 4;
    const birds = state.automaState.stashedCardsCount * multiplier;
    const eggs = state.automaState.eggs;
    const roundGoals = player.roundGoalScores.reduce((sum, v) => sum + v, 0);
    const bonusCards = diffBonus[state.automaState.difficulty] ?? 3;
    const total = birds + eggs + roundGoals + bonusCards;

    return {
      birds,
      eggs,
      cachedFood: 0,
      tuckedCards: 0,
      roundGoals,
      bonusCards,
      total,
    };
  }

  let birds = 0;
  let eggs = 0;
  let cachedFood = 0;
  let tuckedCards = 0;

  for (const row of Object.values(player.board)) {
    for (const slot of row) {
      if (!slot.cardId) continue;
      const card = state.cards[slot.cardId];
      birds += card?.points ?? 0;
      eggs += slot.eggs;
      cachedFood += slot.cached.length;
      tuckedCards += slot.tucked.length;
    }
  }

  const roundGoals = player.roundGoalScores.reduce((sum, value) => sum + value, 0);
  let bonusCards = 0;
  for (const bonus of player.bonusCards) {
    bonusCards += calculateBonusPoints(player, state, bonus);
  }

  const total = birds + eggs + cachedFood + tuckedCards + roundGoals + bonusCards;

  return {
    birds,
    eggs,
    cachedFood,
    tuckedCards,
    roundGoals,
    bonusCards,
    total,
  };
}

export function scorePlayer(state: GameState, playerId: string): number {
  return scorePlayerDetails(state, playerId).total;
}

function eggCostForSlot(slotIndex: number) {
  if (slotIndex <= 0) return 0;
  if (slotIndex <= 2) return 1;
  return 2;
}

function canPayEggCost(player: PlayerState, paidEggsFrom: SlotRef[], eggCost: number) {
  if (paidEggsFrom.length !== eggCost) return false;
  const counts = new Map<string, number>();
  for (const ref of paidEggsFrom) {
    const key = `${ref.habitat}:${ref.slotIndex}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const [key, count] of counts.entries()) {
    const [habitat, slotIndexText] = key.split(":");
    const slot = player.board[habitat as HabitatId]?.[Number(slotIndexText)];
    if (!slot || slot.eggs < count) return false;
  }

  return true;
}

/**
 * Quita 1 carta de la mano del jugador y la devuelve. Si `preferredId` está presente en la
 * mano, se usa esa (elección del jugador); si no, se toma la última como último recurso.
 */
function takeCardFromHand(player: PlayerState, preferredId?: CardId): CardId | undefined {
  if (preferredId) {
    const idx = player.hand.indexOf(preferredId);
    if (idx !== -1) {
      return player.hand.splice(idx, 1)[0];
    }
  }
  return player.hand.pop();
}

/**
 * Decide qué alimento se paga y cuál se recibe en un poder "cambia 1 alimento por otro".
 * Con costo comodín ("cualquier alimento") el jugador elige "pagado>recibido" (p. ej. "seed>fish"),
 * que debe ser válido: dos alimentos distintos y con al menos 1 del que paga. Si no elige (o
 * manda algo inválido), se paga el alimento que más tenga y se recibe el del poder.
 */
function resolveTrade(
  player: PlayerState,
  power: Extract<Power, { kind: "tradeResource" }>,
  choice: string | undefined,
): { pay: ResourceFace; gain: ResourceFace } | null {
  const has = (res: ResourceFace) => (player.resources[res] ?? 0) >= 1;
  if (power.costResource !== "wild") {
    return has(power.costResource) ? { pay: power.costResource, gain: power.gainResource } : null;
  }

  const [pay, gain] = (choice ?? "").split(">");
  if (isFoodFace(pay) && isFoodFace(gain) && pay !== gain && has(pay)) return { pay, gain };

  const defaultGain: ResourceFace = isFoodFace(power.gainResource) ? power.gainResource : "insect";
  const richest = (FOOD_FACES as ResourceFace[])
    .filter((res) => res !== defaultGain && has(res))
    .sort((a, b) => (player.resources[b] ?? 0) - (player.resources[a] ?? 0))[0];
  return richest ? { pay: richest, gain: defaultGain } : null;
}

function spendResources(player: PlayerState, paidResources: ResourceFace[]) {
  for (const resource of paidResources) {
    player.resources[resource] = (player.resources[resource] ?? 0) - 1;
  }
}

function spendEggs(player: PlayerState, paidEggsFrom: SlotRef[]) {
  for (const ref of paidEggsFrom) {
    player.board[ref.habitat][ref.slotIndex].eggs -= 1;
  }
}

function findFirstEggSpace(state: GameState, player: PlayerState): SlotRef | null {
  for (const habitat of Object.keys(player.board) as HabitatId[]) {
    for (let slotIndex = 0; slotIndex < player.board[habitat].length; slotIndex += 1) {
      const slot = player.board[habitat][slotIndex];
      if (slot?.cardId && slot.eggs < state.cards[slot.cardId].eggCapacity) {
        return { habitat, slotIndex };
      }
    }
  }

  return null;
}

/** Un nido "wild" (comodín) siempre coincide, como en `evaluateRoundGoalMetric`. */
function matchesNestType(cardNestType: NestType | undefined, wanted: NestType | undefined): boolean {
  if (!wanted) return true;
  return cardNestType === wanted || cardNestType === "wild";
}

function findEggTargetByNestType(
  state: GameState,
  player: PlayerState,
  nestType: NestType | undefined,
  excludeSlot?: SlotRef,
): SlotRef | null {
  for (const habitat of Object.keys(player.board) as HabitatId[]) {
    for (let slotIndex = 0; slotIndex < player.board[habitat].length; slotIndex += 1) {
      if (excludeSlot && excludeSlot.habitat === habitat && excludeSlot.slotIndex === slotIndex) continue;
      const slot = player.board[habitat][slotIndex];
      if (!slot?.cardId) continue;
      const card = state.cards[slot.cardId];
      if (card && matchesNestType(card.nestType, nestType) && slot.eggs < card.eggCapacity) {
        return { habitat, slotIndex };
      }
    }
  }
  return null;
}

/** Valida que una elección del jugador para un poder "layEgg" sea realmente jugable ahora mismo. */
function isValidEggTarget(
  state: GameState,
  player: PlayerState,
  target: SlotRef | undefined,
  nestType?: NestType,
): boolean {
  if (!target) return false;
  const slot = player.board[target.habitat]?.[target.slotIndex];
  if (!slot?.cardId) return false;
  const card = state.cards[slot.cardId];
  if (!card || slot.eggs >= card.eggCapacity) return false;
  return matchesNestType(card.nestType, nestType);
}

function applyEggsToTarget(
  state: GameState,
  player: PlayerState,
  target: SlotRef,
  amount: number,
  birdName: string,
) {
  const slot = player.board[target.habitat]?.[target.slotIndex];
  const targetCard = slot?.cardId ? state.cards[slot.cardId] : null;
  if (!slot || !targetCard || slot.eggs >= targetCard.eggCapacity) return;

  const eggsToAdd = Math.min(amount, targetCard.eggCapacity - slot.eggs);
  slot.eggs += eggsToAdd;
  state.log.push({
    playerId: player.id,
    message: `Poder de [${birdName}]: puso ${eggsToAdd} huevo(s) en [${targetCard.name}] (${player.name}).`,
  });
}

/** Busca cualquier ranura con al menos 1 huevo, opcionalmente ignorando una ranura dada. */
function findAnyEggSlot(player: PlayerState, excludeSlot?: SlotRef): SlotRef | null {
  for (const habitat of Object.keys(player.board) as HabitatId[]) {
    for (let slotIndex = 0; slotIndex < player.board[habitat].length; slotIndex += 1) {
      if (excludeSlot && excludeSlot.habitat === habitat && excludeSlot.slotIndex === slotIndex) continue;
      if (player.board[habitat][slotIndex].eggs > 0) return { habitat, slotIndex };
    }
  }
  return null;
}

/**
 * Intenta pagar el costo de 1 huevo de un poder (p. ej. "descartá 1 huevo para ganar X").
 * Usa la elección del jugador si es válida; si no, autoselecciona cualquier huevo disponible.
 * Devuelve false (sin cobrar nada) si no había ningún huevo pagable.
 */
function tryPayEggCost(
  player: PlayerState,
  costsEgg: boolean,
  excludesSelf: boolean | undefined,
  source: SlotRef,
  chosen: SlotRef | undefined,
): boolean {
  if (!costsEgg) return true;
  const excludeRef = excludesSelf ? source : undefined;
  const isExcluded = (ref: SlotRef) =>
    excludeRef !== undefined && ref.habitat === excludeRef.habitat && ref.slotIndex === excludeRef.slotIndex;
  const chosenValid =
    chosen && !isExcluded(chosen) && (player.board[chosen.habitat]?.[chosen.slotIndex]?.eggs ?? 0) > 0;

  const eggSlot = chosenValid ? chosen! : findAnyEggSlot(player, excludeRef);
  if (!eggSlot) return false;

  player.board[eggSlot.habitat][eggSlot.slotIndex].eggs -= 1;
  return true;
}

/** Verdadero si no hay ninguna otra ave del mismo jugador más a la derecha en ese hábitat. */
function isRightmostInHabitat(player: PlayerState, source: SlotRef): boolean {
  const row = player.board[source.habitat];
  for (let i = source.slotIndex + 1; i < row.length; i += 1) {
    if (row[i].cardId) return false;
  }
  return true;
}

function tally(resources: ResourceFace[]) {
  return resources.reduce<Partial<Record<ResourceFace, number>>>((counts, resource) => {
    counts[resource] = (counts[resource] ?? 0) + 1;
    return counts;
  }, {});
}
