/**
 * Generación de jugadas válidas para un jugador (con sus elecciones de poderes). La usa el rival de
 * la IA para proponer candidatas y el simulador de partidas para jugar al azar.
 */
import {
  canPayResources,
  canRerollFeeder,
  getActivatablePowers,
  getHabitatActionAllowance,
  getOnPlayPowers,
  tuckGainChoiceKey,
} from "./engine";
import type {
  BoardSlot,
  CardId,
  DrawCardSelection,
  GameState,
  HabitatId,
  Move,
  Power,
  PowerCardChoices,
  PowerEggChoices,
  PowerMoveChoices,
  PowerPlayBirdChoices,
  PlayerId,
  PlayerState,
  ResourceFace,
  SlotRef,
  SpeciesCard,
} from "./types";

export const HABITATS: HabitatId[] = ["forest", "grassland", "wetland"];
export const FOODS: ResourceFace[] = ["seed", "fruit", "insect", "fish", "rodent"];

const chance = (probability: number) => Math.random() < probability;
export const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

export function sample<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}

/** Regla del reglamento, repetida a propósito: el oráculo no debe depender del motor. */
function eggCostForSlot(slotIndex: number): number {
  if (slotIndex <= 0) return 0;
  return slotIndex <= 2 ? 1 : 2;
}

export function slotRefs(player: PlayerState, filter: (slot: BoardSlot) => boolean): SlotRef[] {
  const refs: SlotRef[] = [];
  for (const habitat of HABITATS) {
    player.board[habitat].forEach((slot, slotIndex) => {
      if (filter(slot)) refs.push({ habitat, slotIndex });
    });
  }
  return refs;
}

export const occupiedSlots = (player: PlayerState) => slotRefs(player, (slot) => slot.cardId !== null);
const slotsWithEggs = (player: PlayerState) => slotRefs(player, (slot) => slot.eggs > 0);

function availableFoods(player: PlayerState): ResourceFace[] {
  return FOODS.filter((food) => (player.resources[food] ?? 0) > 0);
}

const stock = (player: PlayerState, food: ResourceFace) => player.resources[food] ?? 0;

/** El alimento del que el jugador tiene menos (el primero en caso de empate). */
function leastOwnedFood(player: PlayerState): ResourceFace {
  return [...FOODS].sort((a, b) => stock(player, a) - stock(player, b))[0];
}

/** El alimento del que el jugador tiene más, o null si no tiene nada. */
function mostOwnedFood(player: PlayerState): ResourceFace | null {
  const best = [...FOODS].sort((a, b) => stock(player, b) - stock(player, a))[0];
  return stock(player, best) > 0 ? best : null;
}

/** Arma un pago válido para `card`: lo exacto primero y, si falta, 2 recursos cualesquiera por 1. */
function findPayment(player: PlayerState, card: SpeciesCard): ResourceFace[] | null {
  const pool: Partial<Record<ResourceFace, number>> = { ...player.resources };
  const paid: ResourceFace[] = [];
  const has = (food: ResourceFace) => (pool[food] ?? 0) > 0;
  const take = (food: ResourceFace) => {
    pool[food] = (pool[food] ?? 0) - 1;
    paid.push(food);
  };
  let missing = 0;

  for (const [food, count] of Object.entries(card.cost)) {
    if (food === "wild") continue;
    for (let i = 0; i < (count ?? 0); i += 1) {
      if (has(food as ResourceFace)) take(food as ResourceFace);
      else missing += 1;
    }
  }
  if (card.costAnyOf && card.costAnyOf.length > 0) {
    const options = card.costAnyOf.filter(has);
    if (options.length > 0) take(pick(options));
    else missing += 1;
  }
  for (let i = 0; i < (card.cost.wild ?? 0); i += 1) {
    const options = FOODS.filter(has);
    if (options.length > 0) take(pick(options));
    else missing += 1;
  }
  for (let i = 0; i < missing; i += 1) {
    const remaining = FOODS.filter(has);
    const total = remaining.reduce((sum, food) => sum + (pool[food] ?? 0), 0);
    if (total < 2) return null;
    take(pick(remaining));
    take(pick(FOODS.filter(has)));
  }

  return canPayResources(player, paid, card.cost, card.costAnyOf) ? paid : null;
}

function findEggPayment(player: PlayerState, cost: number): SlotRef[] | null {
  const eggs = slotRefs(player, (slot) => slot.eggs > 0).flatMap((ref) =>
    Array<SlotRef>(player.board[ref.habitat][ref.slotIndex].eggs).fill(ref),
  );
  return eggs.length >= cost ? sample(eggs, cost) : null;
}

export type BirdPlay = {
  cardId: CardId;
  habitat: HabitatId;
  slotIndex: number;
  paidResources: ResourceFace[];
  paidEggsFrom: SlotRef[];
};

/** Todas las formas en que el jugador puede jugar un ave de su mano en este momento. */
export function planBirdPlays(
  state: GameState,
  player: PlayerState,
  allowedHabitats: readonly HabitatId[] = HABITATS,
): BirdPlay[] {
  const plays: BirdPlay[] = [];
  for (const cardId of player.hand) {
    const card = state.cards[cardId];
    for (const habitat of card.habitats) {
      if (!allowedHabitats.includes(habitat)) continue;
      const slotIndex = player.board[habitat].findIndex((slot) => slot.cardId === null);
      if (slotIndex === -1) continue;
      const paidResources = findPayment(player, card);
      const paidEggsFrom = findEggPayment(player, eggCostForSlot(slotIndex));
      if (paidResources && paidEggsFrom) plays.push({ cardId, habitat, slotIndex, paidResources, paidEggsFrom });
    }
  }
  return plays;
}

/** El jugador tal como quedaría tras jugar `play`, para planear una segunda ave encima. */
function afterPlaying(player: PlayerState, play: BirdPlay): PlayerState {
  const next = structuredClone(player);
  next.hand = next.hand.filter((id) => id !== play.cardId);
  next.board[play.habitat][play.slotIndex].cardId = play.cardId;
  for (const food of play.paidResources) next.resources[food] = (next.resources[food] ?? 0) - 1;
  for (const ref of play.paidEggsFrom) next.board[ref.habitat][ref.slotIndex].eggs -= 1;
  return next;
}

type PowerChoiceFields = {
  skipPowerIds: string[];
  powerCardChoices: PowerCardChoices;
  powerEggChoices: PowerEggChoices;
  powerMoveChoices: PowerMoveChoices;
};

export type ChoiceOptions = {
  /** Probabilidad de saltarse un poder opcional (el simulador lo hace a propósito; la IA nunca). */
  skipChance: number;
  /**
   * true = elecciones al azar (incluso inválidas o "a ciegas", para estresar el motor);
   * false = solo elecciones sensatas y sin información oculta (lo que haría un jugador).
   */
  chaotic: boolean;
};

const CHAOTIC_CHOICES: ChoiceOptions = { skipChance: 0.15, chaotic: true };
export const SENSIBLE_CHOICES: ChoiceOptions = { skipChance: 0, chaotic: false };

/** Decide, poder por poder, si se salta y qué elecciones opcionales (carta/ave/hábitat) se hacen. */
function buildPowerChoices(
  state: GameState,
  player: PlayerState,
  powers: Power[],
  options: ChoiceOptions = CHAOTIC_CHOICES,
): PowerChoiceFields {
  const fields: PowerChoiceFields = {
    skipPowerIds: [],
    powerCardChoices: {},
    powerEggChoices: {},
    powerMoveChoices: {},
  };
  const occupied = occupiedSlots(player);

  for (const power of powers) {
    if (options.skipChance > 0 && chance(options.skipChance)) {
      fields.skipPowerIds.push(power.id);
      continue;
    }
    if (!options.chaotic) {
      if (power.kind === "gainResource" && power.resource === "wild") {
        // "1 alimento a elección": el que menos tiene.
        fields.powerCardChoices[power.id] = leastOwnedFood(player);
      } else if (power.kind === "tradeResource" && power.costResource === "wild") {
        const richest = mostOwnedFood(player);
        const poorest = leastOwnedFood(player);
        if (richest && richest !== poorest) fields.powerCardChoices[power.id] = `${richest}>${poorest}`;
      } else if (power.kind === "tuckCard" && power.thenGainResource && power.thenGainResourceAlt) {
        // "Ganá X o Y": el que menos tiene.
        const [a, b] = [power.thenGainResource, power.thenGainResourceAlt];
        fields.powerCardChoices[tuckGainChoiceKey(power.id)] =
          (player.resources[a] ?? 0) <= (player.resources[b] ?? 0) ? a : b;
      }
      continue;
    }
    if (power.kind === "tuckCard" && power.thenGainResource && power.thenGainResourceAlt && chance(0.7)) {
      fields.powerCardChoices[tuckGainChoiceKey(power.id)] = pick([power.thenGainResource, power.thenGainResourceAlt]);
    }
    if (power.kind === "tradeResource" && power.costResource === "wild") {
      // "pagado>recibido": un alimento que tenga y otro distinto.
      const owned = availableFoods(player);
      if (owned.length > 0 && chance(0.7)) {
        const pay = pick(owned);
        fields.powerCardChoices[power.id] = `${pay}>${pick(FOODS.filter((food) => food !== pay))}`;
      }
    } else if (power.kind === "gainResource" && power.resource === "wild") {
      // "1 alimento a elección": la elección viaja en powerCardChoices, como las de cartas.
      if (chance(0.7)) fields.powerCardChoices[power.id] = pick(FOODS);
    } else if (power.kind === "gainBonusCard") {
      // Las cartas reveladas salen del frente del mazo de bonificación.
      const revealed = state.bonusDeck.slice(0, power.drawCount);
      if (revealed.length > 0 && chance(0.7)) fields.powerCardChoices[power.id] = pick(revealed);
    } else if (player.hand.length > 0 && chance(0.7)) {
      fields.powerCardChoices[power.id] = pick(player.hand);
    }
    if (occupied.length > 0 && chance(0.7)) fields.powerEggChoices[power.id] = pick(occupied);
    if (chance(0.7)) fields.powerMoveChoices[power.id] = pick(HABITATS);
  }
  return fields;
}

function randomPlayBird(state: GameState, player: PlayerState, options: ChoiceOptions): Move | null {
  const plays = planBirdPlays(state, player);
  return plays.length === 0 ? null : playBirdMove(state, player, pick(plays), options);
}

/** Arma el movimiento playBird de una jugada concreta (con las elecciones de sus poderes). */
function playBirdMove(state: GameState, player: PlayerState, play: BirdPlay, options: ChoiceOptions): Move {
  const card = state.cards[play.cardId];
  const powers = getOnPlayPowers(card);

  const choices = buildPowerChoices(state, { ...player, hand: player.hand.filter((id) => id !== play.cardId) }, powers, options);
  const powerPlayBirdChoices: PowerPlayBirdChoices = {};
  const afterFirstBird = afterPlaying(player, play);
  for (const power of powers) {
    if (power.kind !== "playSecondBird" || choices.skipPowerIds.includes(power.id) || chance(0.4)) continue;
    const second = planBirdPlays(state, afterFirstBird, power.habitats);
    if (second.length > 0) powerPlayBirdChoices[power.id] = pick(second);
  }

  return { type: "playBird", ...play, ...choices, powerPlayBirdChoices };
}

function randomGainFood(state: GameState, player: PlayerState, options: ChoiceOptions = CHAOTIC_CHOICES): Move {
  const allowance = getHabitatActionAllowance(player, "forest");
  const rerollBefore = canRerollFeeder(state.feeder) && chance(0.3);
  const feederSize = rerollBefore ? 5 : state.feeder.length;
  const tradeCardId = allowance.canTradeCard && player.hand.length > 0 && chance(0.4) ? pick(player.hand) : undefined;
  const maxDice = allowance.baseAmount + (tradeCardId ? 1 : 0);
  const count = Math.min(randomInt(1, maxDice), feederSize);
  const dieIndexes = sample(Array.from({ length: feederSize }, (_, index) => index), count);
  const wildChoices: Record<number, "insect" | "seed"> = {};
  for (const index of dieIndexes) wildChoices[index] = pick(["insect", "seed"] as const);

  const powers = getActivatablePowers(state, player, "forest").map(({ power }) => power);
  return {
    type: "gainFood",
    dieIndexes,
    wildChoices,
    rerollBefore,
    tradeCardId,
    ...buildPowerChoices(state, player, powers, options),
  };
}

function randomLayEggs(state: GameState, player: PlayerState, options: ChoiceOptions = CHAOTIC_CHOICES): Move | null {
  const allowance = getHabitatActionAllowance(player, "grassland");
  const spaces = occupiedSlots(player).flatMap((ref) => {
    const slot = player.board[ref.habitat][ref.slotIndex];
    return Array<SlotRef>(Math.max(0, state.cards[slot.cardId!].eggCapacity - slot.eggs)).fill(ref);
  });
  if (spaces.length === 0) return null;

  const foods = availableFoods(player);
  const tradeResource = allowance.canTradeFood && foods.length > 0 && chance(0.4) ? pick(foods) : undefined;
  const maxEggs = allowance.baseAmount + (tradeResource ? 1 : 0);
  const eggPlacements = sample(spaces, randomInt(1, maxEggs));

  const powers = getActivatablePowers(state, player, "grassland").map(({ power }) => power);
  return { type: "layEggs", eggPlacements, tradeResource, ...buildPowerChoices(state, player, powers, options) };
}

function randomDrawBirdCards(state: GameState, player: PlayerState, options: ChoiceOptions = CHAOTIC_CHOICES): Move | null {
  const allowance = getHabitatActionAllowance(player, "wetland");
  const eggSlots = slotsWithEggs(player);
  const tradeEggFrom = allowance.canTradeEgg && eggSlots.length > 0 && chance(0.4) ? pick(eggSlots) : undefined;
  const maxDraws = allowance.baseAmount + (tradeEggFrom ? 1 : 0);

  const marketLeft = [...state.market];
  const draws: DrawCardSelection[] = [];
  for (let i = 0; i < randomInt(1, maxDraws); i += 1) {
    const canDrawDeck = state.deck.length > 0;
    if (marketLeft.length > 0 && (!canDrawDeck || chance(0.5))) {
      draws.push({ source: "market", marketCardId: marketLeft.splice(Math.floor(Math.random() * marketLeft.length), 1)[0] });
    } else if (canDrawDeck) {
      draws.push({ source: "deck" });
    }
  }
  if (draws.length === 0) return null;

  const powers = getActivatablePowers(state, player, "wetland").map(({ power }) => power);
  return { type: "drawBirdCards", draws, tradeEggFrom, ...buildPowerChoices(state, player, powers, options) };
}

/** Preparación inicial al azar: conserva k aves, descarta k alimentos y elige una bonificación. */
function randomStartMove(player: PlayerState): Move {
  const keepCount = randomInt(0, player.hand.length);
  return {
    type: "chooseStart",
    keepCards: sample(player.hand, keepCount),
    discardFood: sample(availableFoods(player), keepCount),
    bonusCardId: pick(player.pendingBonusChoice ?? []),
  };
}

/** Un movimiento válido elegido al azar entre todas las acciones que el jugador puede hacer. */
export function randomMove(state: GameState, playerId: PlayerId, options: ChoiceOptions = CHAOTIC_CHOICES): Move | null {
  const player = state.players[playerId];
  if (player.pendingStartingHand) return randomStartMove(player);
  if (player.pendingBonusChoice?.length) return { type: "chooseBonusCard", bonusCardId: pick(player.pendingBonusChoice) };
  if (state.phase !== "round") return null;

  const candidates: Move[] = [randomGainFood(state, player, options)];
  const playBird = randomPlayBird(state, player, options);
  const layEggs = randomLayEggs(state, player, options);
  const drawBirdCards = randomDrawBirdCards(state, player, options);
  // Jugar aves y poner huevos pesa más: son las acciones que hacen crecer el tablero.
  if (playBird) candidates.push(playBird, playBird);
  if (layEggs) candidates.push(layEggs);
  if (drawBirdCards) candidates.push(drawBirdCards);
  if (canRerollFeeder(state.feeder) && chance(0.25)) candidates.push({ type: "rerollFeeder" });
  return pick(candidates);
}

/**
 * Conjunto de jugadas candidatas del turno: todas las formas de jugar un ave y `perType` variantes
 * de cada una de las demás acciones. Las usa la IA para compararlas antes de decidir.
 */
export function candidateMoves(state: GameState, playerId: PlayerId, perType: number, options: ChoiceOptions): Move[] {
  const player = state.players[playerId];
  const moves: Move[] = [];
  for (let i = 0; i < perType; i += 1) {
    moves.push(randomGainFood(state, player, options));
    const layEggs = randomLayEggs(state, player, options);
    if (layEggs) moves.push(layEggs);
    const drawBirdCards = randomDrawBirdCards(state, player, options);
    if (drawBirdCards) moves.push(drawBirdCards);
  }
  for (const play of planBirdPlays(state, player)) moves.push(playBirdMove(state, player, play, options));
  if (canRerollFeeder(state.feeder)) moves.push({ type: "rerollFeeder" });
  return moves;
}
