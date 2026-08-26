import { automaCardsCatalog } from "./automaCards";
import { rollInitialFeeder } from "./setup";
import type {
  BoardSlot,
  BonusCard,
  CardId,
  DrawCardSelection,
  GameState,
  HabitatId,
  Move,
  PlayerId,
  PlayerState,
  Power,
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

export function isLegalMove(state: GameState, playerId: string, move: Move): boolean {
  if (state.phase !== "round" || state.currentPlayerId !== playerId) return false;
  const player = state.players[playerId];
  if (!player || player.actionCubesAvailable <= 0 || player.isAutoma) return false;

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
    return canPayResources(player, move.paidResources, card.cost);
  }

  if (move.type === "gainFood") {
    const allowance = getHabitatActionAllowance(player, "forest");
    let availableFeeder = [...state.feeder];

    if (move.rerollBefore) {
      if (!canRerollFeeder(state.feeder)) return false;
      availableFeeder = ["seed", "fruit", "insect", "fish", "rodent"];
    }

    const uniqueIndexes = new Set(move.dieIndexes);
    if (uniqueIndexes.size !== move.dieIndexes.length) return false;

    let allowedCount = allowance.baseAmount;
    if (move.tradeCardId) {
      if (!allowance.canTradeCard || !player.hand.includes(move.tradeCardId)) return false;
      allowedCount += 1;
    }

    if (move.dieIndexes.length === 0 || move.dieIndexes.length > allowedCount) return false;
    return move.dieIndexes.every((index) => index >= 0 && index < availableFeeder.length);
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
      const slot = player.board[ref.habitat][ref.slotIndex];
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
        if (state.deck.length === 0) return false;
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
          const cardDrawn = next.market.shift();
          actionDescriptions.push(`robó 1 carta del mercado`);
          const rep = next.deck.shift();
          if (rep) next.market.push(rep);
        }
      }
    } else if (act.type === "stashCardFromDeck") {
      for (let i = 0; i < act.count; i += 1) {
        const stashed = next.deck.shift();
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

  while (requiredWildCount > 0 && remainingPaid.length > 0) {
    remainingPaid.shift();
    requiredWildCount -= 1;
  }

  const totalUnsatisfiedCostUnits = unsatisfiedRequirements.length + requiredWildCount;
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
  const card = state.cards[move.cardId];
  spendResources(player, move.paidResources);
  spendEggs(player, move.paidEggsFrom);
  player.hand = player.hand.filter((cardId) => cardId !== move.cardId);
  player.board[move.habitat][move.slotIndex].cardId = move.cardId;

  for (const power of card.powers.filter((candidate) => candidate.timing === "onPlay")) {
    resolvePower(state, player, power, { habitat: move.habitat, slotIndex: move.slotIndex });
  }
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
    const resource = state.feeder[index];
    if (resource) {
      player.resources[resource] = (player.resources[resource] ?? 0) + 1;
      state.feeder.splice(index, 1);
    }
  }

  if (state.feeder.length === 0) {
    state.feeder = rollInitialFeeder(5);
  }

  activateHabitat(state, player, "forest");
}

function layEggs(state: GameState, player: PlayerState, move: Extract<Move, { type: "layEggs" }>) {
  if (move.tradeResource) {
    player.resources[move.tradeResource] = (player.resources[move.tradeResource] ?? 1) - 1;
  }

  for (const placement of move.eggPlacements) {
    const slot = player.board[placement.habitat][placement.slotIndex];
    slot.eggs += 1;
  }

  activateHabitat(state, player, "grassland");
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
      const drawn = state.deck.shift();
      if (drawn) player.hand.push(drawn);
    } else {
      const cardId = draw.marketCardId;
      player.hand.push(cardId);
      state.market = state.market.filter((id) => id !== cardId);
      const replacement = state.deck.shift();
      if (replacement) state.market.push(replacement);
    }
  }

  activateHabitat(state, player, "wetland");
}

function activateHabitat(state: GameState, player: PlayerState, habitat: HabitatId) {
  for (let slotIndex = player.board[habitat].length - 1; slotIndex >= 0; slotIndex -= 1) {
    const slot = player.board[habitat][slotIndex];
    if (!slot.cardId) continue;

    const card = state.cards[slot.cardId];
    if (!card) continue;

    for (const power of card.powers.filter((candidate) => candidate.timing === "onActivate")) {
      resolvePower(state, player, power, { habitat, slotIndex });
    }
  }
}

export function resolvePower(
  state: GameState,
  player: PlayerState,
  power: Power,
  source: SlotRef,
) {
  const currentSlot = player.board[source.habitat]?.[source.slotIndex];

  if (power.kind === "gainResource") {
    const res = power.resource ?? "seed";
    player.resources[res] = (player.resources[res] ?? 0) + power.amount;
    return;
  }

  if (power.kind === "drawCard") {
    for (let index = 0; index < power.amount; index += 1) {
      const drawn = state.deck.shift();
      if (drawn) player.hand.push(drawn);
    }
    if (power.thenDiscard && player.hand.length > 0) {
      const discarded = player.hand.pop();
      if (discarded) state.discard.push(discarded);
    }
    return;
  }

  if (power.kind === "layEgg") {
    const target = power.target === "self" ? source : findFirstEggSpace(state, player);
    if (!target) return;

    const slot = player.board[target.habitat][target.slotIndex];
    const card = slot.cardId ? state.cards[slot.cardId] : null;
    if (!card) return;
    slot.eggs = Math.min(slot.eggs + power.amount, card.eggCapacity);
    return;
  }

  if (power.kind === "tuckCard") {
    if (currentSlot) {
      if (power.source === "deck") {
        const drawn = state.deck.shift();
        if (drawn) currentSlot.tucked.push(drawn);
      } else if (power.source === "hand" && player.hand.length > 0) {
        const fromHand = player.hand.pop();
        if (fromHand) currentSlot.tucked.push(fromHand);
      }
      if (power.thenDraw) {
        const drawn = state.deck.shift();
        if (drawn) player.hand.push(drawn);
      }
    }
    return;
  }

  if (power.kind === "cacheFood") {
    if (currentSlot) {
      const res = power.resource ?? "seed";
      currentSlot.cached.push(res);
    }
    return;
  }

  if (power.kind === "huntPredator") {
    const revealed = state.deck.shift();
    if (revealed) {
      const revealedCard = state.cards[revealed];
      if (revealedCard && (revealedCard.wingspanCm ?? 999) <= power.maxWingspanCm) {
        currentSlot?.tucked.push(revealed);
      } else {
        if (power.onFailDrawCard) {
          player.hand.push(revealed);
        } else {
          state.discard.push(revealed);
        }
      }
    }
    return;
  }

  if (power.kind === "allPlayersGain") {
    const res = power.resource ?? "seed";
    for (const p of Object.values(state.players)) {
      if (!p.isAutoma) {
        p.resources[res] = (p.resources[res] ?? 0) + 1;
      }
    }
    return;
  }

  if (power.kind === "tradeResource") {
    if ((player.resources[power.costResource] ?? 0) >= 1) {
      player.resources[power.costResource] = (player.resources[power.costResource] ?? 1) - 1;
      player.resources[power.gainResource] = (player.resources[power.gainResource] ?? 0) + (power.amount ?? 1);
    }
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
  if (goal.type === "totalEggs") {
    let total = 0;
    for (const row of Object.values(player.board)) {
      total += row.reduce((sum, slot) => sum + slot.eggs, 0);
    }
    return total;
  }
  if (goal.type === "totalBirds") {
    let total = 0;
    for (const row of Object.values(player.board)) {
      total += row.filter((slot) => slot.cardId !== null).length;
    }
    return total;
  }
  if (goal.type === "birdsInNests" && goal.nestType) {
    let total = 0;
    for (const row of Object.values(player.board)) {
      for (const slot of row) {
        if (!slot.cardId) continue;
        const card = state.cards[slot.cardId];
        if (card && (card.nestType === goal.nestType || card.nestType === "wild")) {
          total += 1;
        }
      }
    }
    return total;
  }
  if (goal.type === "cachedFood") {
    let total = 0;
    for (const row of Object.values(player.board)) {
      total += row.reduce((sum, slot) => sum + slot.cached.length, 0);
    }
    return total;
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
  while (state.market.length < 3 && state.deck.length > 0) {
    const card = state.deck.shift();
    if (card) state.market.push(card);
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

export function calculateBonusPoints(
  player: PlayerState,
  state: GameState,
  bonus: BonusCard,
): number {
  let count = 0;
  for (const row of Object.values(player.board)) {
    for (const slot of row) {
      if (!slot.cardId) continue;
      const card = state.cards[slot.cardId];
      if (!card) continue;

      if (bonus.conditionType === "birdsInHabitat" && bonus.habitat) {
        if (card.habitats.includes(bonus.habitat)) count += 1;
      } else if (bonus.conditionType === "birdsWithFoodCost" && bonus.resourceCost) {
        if ((card.cost[bonus.resourceCost] ?? 0) > 0) count += 1;
      } else if (bonus.conditionType === "birdsWithNest" && bonus.nestType) {
        if (card.nestType === bonus.nestType || card.nestType === "wild") count += 1;
      } else if (bonus.conditionType === "totalEggs") {
        count += slot.eggs;
      } else if (bonus.conditionType === "tuckedCards") {
        count += slot.tucked.length;
      }
    }
  }

  const sortedTiers = [...bonus.tiers].sort((a, b) => b.threshold - a.threshold);
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

function tally(resources: ResourceFace[]) {
  return resources.reduce<Partial<Record<ResourceFace, number>>>((counts, resource) => {
    counts[resource] = (counts[resource] ?? 0) + 1;
    return counts;
  }, {});
}
