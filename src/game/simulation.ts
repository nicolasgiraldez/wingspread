/**
 * Herramientas para simular partidas completas con un jugador aleatorio (pero que solo arma
 * movimientos válidos, como lo haría la UI) y verificar invariantes del estado después de
 * cada movimiento. Sirve para cazar bugs del motor que los tests puntuales no ven.
 *
 * Todo es reproducible: `playGame({ seed })` reemplaza `Math.random` por un generador con
 * semilla, así que una partida que falla se puede repetir exactamente con la misma semilla.
 */
import {
  actionCountsByRound,
  applyMove,
  canPayResources,
  canRerollFeeder,
  getActivatablePowers,
  getHabitatActionAllowance,
  getOnPlayPowers,
  isLegalMove,
  scorePlayerDetails,
} from "./engine";
import { createInitialState, standardDieFaces } from "./setup";
import type {
  AutomaDifficulty,
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

const HABITATS: HabitatId[] = ["forest", "grassland", "wetland"];
const FOODS: ResourceFace[] = ["seed", "fruit", "insect", "fish", "rodent"];
/** Tope de movimientos por partida: una partida real tiene a lo sumo 26 por jugador. */
const MAX_STEPS = 400;

// ── Aleatoriedad reproducible ────────────────────────────────────────────────

/** mulberry32: generador pequeño y rápido, suficiente para tests. */
export function createRng(seed: number): () => number {
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

const chance = (probability: number) => Math.random() < probability;
const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

function sample<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}

// ── Generación de movimientos ────────────────────────────────────────────────

/** Regla del reglamento, repetida a propósito: el oráculo no debe depender del motor. */
function eggCostForSlot(slotIndex: number): number {
  if (slotIndex <= 0) return 0;
  return slotIndex <= 2 ? 1 : 2;
}

function slotRefs(player: PlayerState, filter: (slot: BoardSlot) => boolean): SlotRef[] {
  const refs: SlotRef[] = [];
  for (const habitat of HABITATS) {
    player.board[habitat].forEach((slot, slotIndex) => {
      if (filter(slot)) refs.push({ habitat, slotIndex });
    });
  }
  return refs;
}

const occupiedSlots = (player: PlayerState) => slotRefs(player, (slot) => slot.cardId !== null);
const slotsWithEggs = (player: PlayerState) => slotRefs(player, (slot) => slot.eggs > 0);

function availableFoods(player: PlayerState): ResourceFace[] {
  return FOODS.filter((food) => (player.resources[food] ?? 0) > 0);
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

type BirdPlay = {
  cardId: CardId;
  habitat: HabitatId;
  slotIndex: number;
  paidResources: ResourceFace[];
  paidEggsFrom: SlotRef[];
};

/** Todas las formas en que el jugador puede jugar un ave de su mano en este momento. */
function planBirdPlays(
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

/** Decide, poder por poder, si se salta y qué elecciones opcionales (carta/ave/hábitat) se hacen. */
function buildPowerChoices(state: GameState, player: PlayerState, powers: Power[]): PowerChoiceFields {
  const fields: PowerChoiceFields = {
    skipPowerIds: [],
    powerCardChoices: {},
    powerEggChoices: {},
    powerMoveChoices: {},
  };
  const occupied = occupiedSlots(player);

  for (const power of powers) {
    if (chance(0.15)) {
      fields.skipPowerIds.push(power.id);
      continue;
    }
    if (power.kind === "gainResource" && power.resource === "wild") {
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

function randomPlayBird(state: GameState, player: PlayerState): Move | null {
  const plays = planBirdPlays(state, player);
  if (plays.length === 0) return null;
  const play = pick(plays);
  const card = state.cards[play.cardId];
  const powers = getOnPlayPowers(card);

  const choices = buildPowerChoices(state, { ...player, hand: player.hand.filter((id) => id !== play.cardId) }, powers);
  const powerPlayBirdChoices: PowerPlayBirdChoices = {};
  const afterFirstBird = afterPlaying(player, play);
  for (const power of powers) {
    if (power.kind !== "playSecondBird" || choices.skipPowerIds.includes(power.id) || chance(0.4)) continue;
    const second = planBirdPlays(state, afterFirstBird, power.habitats);
    if (second.length > 0) powerPlayBirdChoices[power.id] = pick(second);
  }

  return { type: "playBird", ...play, ...choices, powerPlayBirdChoices };
}

function randomGainFood(state: GameState, player: PlayerState): Move {
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
    ...buildPowerChoices(state, player, powers),
  };
}

function randomLayEggs(state: GameState, player: PlayerState): Move | null {
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
  return { type: "layEggs", eggPlacements, tradeResource, ...buildPowerChoices(state, player, powers) };
}

function randomDrawBirdCards(state: GameState, player: PlayerState): Move | null {
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
  return { type: "drawBirdCards", draws, tradeEggFrom, ...buildPowerChoices(state, player, powers) };
}

/** Quién debe mover ahora: en "setup" el primer humano que aún no eligió su carta de bonificación. */
export function nextActor(state: GameState): PlayerId | null {
  if (state.phase === "setup") {
    return (
      state.playerOrder.find((id) => (state.players[id].pendingBonusChoice?.length ?? 0) > 0 && !state.players[id].isAutoma) ??
      null
    );
  }
  return state.phase === "round" ? state.currentPlayerId : null;
}

/** Un movimiento válido elegido al azar entre todas las acciones que el jugador puede hacer. */
export function randomMove(state: GameState, playerId: PlayerId): Move | null {
  const player = state.players[playerId];
  if (state.phase === "setup") {
    const offered = player.pendingBonusChoice;
    return offered && offered.length > 0 ? { type: "chooseBonusCard", bonusCardId: pick(offered) } : null;
  }

  const candidates: Move[] = [randomGainFood(state, player)];
  const playBird = randomPlayBird(state, player);
  const layEggs = randomLayEggs(state, player);
  const drawBirdCards = randomDrawBirdCards(state, player);
  // Jugar aves y poner huevos pesa más: son las acciones que hacen crecer el tablero.
  if (playBird) candidates.push(playBird, playBird);
  if (layEggs) candidates.push(layEggs);
  if (drawBirdCards) candidates.push(drawBirdCards);
  if (canRerollFeeder(state.feeder) && chance(0.25)) candidates.push({ type: "rerollFeeder" });
  return pick(candidates);
}

// ── Movimientos inválidos ────────────────────────────────────────────────────

export type CorruptMove = { label: string; playerId: PlayerId; move: Move };

/**
 * Variantes de `move` que el motor JAMÁS debería aceptar. Sirven para comprobar que
 * `isLegalMove` rechaza (sin lanzar) lo que enviaría un cliente con errores o malicioso.
 */
export function corruptMoves(state: GameState, playerId: PlayerId, move: Move): CorruptMove[] {
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

  // Turnos.
  if (state.phase === "round") {
    const current = state.players[state.currentPlayerId];
    if (!current) errors.push(`el turno es de un jugador inexistente (${state.currentPlayerId})`);
    else if (current.isAutoma) errors.push("quedó el turno en el Automa: debería haber jugado solo");
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
export function checkRoundTransition(state: GameState): string[] {
  if (state.market.length < 3 && state.deck.length + state.discard.length > 0) {
    return [
      `mercado con ${state.market.length} cartas tras cerrar la ronda, habiendo mazo (${state.deck.length}) y descarte (${state.discard.length})`,
    ];
  }
  return [];
}

// ── Partida completa ─────────────────────────────────────────────────────────

export type SimulationOptions = {
  seed: number;
  mode: "solo" | "online";
  difficulty?: AutomaDifficulty;
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

export function playGame({ seed, mode, difficulty = "normal", deckSize }: SimulationOptions): SimulationResult {
  return withSeededRandom(seed, () => {
    let state = createInitialState(
      mode === "solo"
        ? { mode: "solo", automaDifficulty: difficulty, playerIds: ["nico", "automa"] }
        : { mode: "online", playerIds: ["nico", "santi"] },
    );
    if (deckSize !== undefined) state = { ...state, deck: state.deck.slice(0, deckSize) };
    const problems: string[] = [];
    let steps = 0;
    const report = (message: string) => problems.push(`[${mode} semilla ${seed}, paso ${steps}] ${message}`);
    checkInvariants(state).forEach(report);

    while (state.phase !== "gameEnd" && problems.length === 0) {
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

      const previous = state;
      // El catálogo de cartas (pesado) se compara aparte, en el test de catálogos compartidos.
      const snapshot = JSON.stringify({ ...previous, cards: null });
      try {
        state = applyMove(previous, actor, move);
      } catch (error) {
        report(`applyMove lanzó con un movimiento legal: ${String(error)}\n    ${showMove(move)}`);
        break;
      }
      if (JSON.stringify({ ...previous, cards: null }) !== snapshot) report(`applyMove modificó el estado de entrada: ${showMove(move)}`);

      const errors = checkInvariants(state);
      if (state.round !== previous.round || (state.phase === "gameEnd" && previous.phase !== "gameEnd")) {
        errors.push(...checkRoundTransition(state));
      }
      errors.forEach((error) => report(`${error}\n    tras ${showMove(move)}`));
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
