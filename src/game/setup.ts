import { bonusCardsCatalog, speciesCards } from "./cards";
import type {
  BoardSlot,
  GameState,
  HabitatId,
  PlayerId,
  PlayerState,
  ResourceFace,
  RoundGoal,
} from "./types";

const habitats: HabitatId[] = ["forest", "grassland", "wetland"];

const defaultDieFaces: ResourceFace[] = [
  "seed",
  "fruit",
  "insect",
  "fish",
  "rodent",
];

export const makeSlots = (): BoardSlot[] =>
  Array.from({ length: 5 }, () => ({
    cardId: null,
    eggs: 0,
    cached: [],
    tucked: [],
  }));

export function rollRandomDie(): ResourceFace {
  const index = Math.floor(Math.random() * defaultDieFaces.length);
  return defaultDieFaces[index];
}

export function rollInitialFeeder(count: number = 5): ResourceFace[] {
  return Array.from({ length: count }, () => rollRandomDie());
}

export const defaultRoundGoals: RoundGoal[] = [
  {
    id: "eggsInGrassland",
    name: "Huevos en la pradera",
    description: "Total de huevos en ranuras de pradera.",
    type: "eggsInHabitat",
    habitat: "grassland",
  },
  {
    id: "birdsInForest",
    name: "Aves en el bosque",
    description: "Cantidad de aves jugadas en el bosque.",
    type: "birdsInHabitat",
    habitat: "forest",
  },
  {
    id: "birdsInWetland",
    name: "Aves en el río",
    description: "Cantidad de aves jugadas en el río/humedal.",
    type: "birdsInHabitat",
    habitat: "wetland",
  },
  {
    id: "totalEggs",
    name: "Huevos totales",
    description: "Total de huevos en todo el tablero.",
    type: "totalEggs",
  },
];

export function createInitialState(playerIds: PlayerId[] = ["nico", "santi"]): GameState {
  if (playerIds.length < 2) {
    throw new Error("Wingspread requiere al menos 2 jugadores.");
  }

  const deck = Object.keys(speciesCards);
  const bonusDeck = Object.keys(bonusCardsCatalog);

  const players: Record<PlayerId, PlayerState> = Object.fromEntries(
    playerIds.map((id) => {
      const hand = deck.splice(0, 2);
      const bonusIds = bonusDeck.splice(0, 1);
      const bonusCards = bonusIds.map((bId) => bonusCardsCatalog[bId]);
      return [id, createPlayer(id, hand, bonusCards)];
    }),
  );

  return {
    phase: "round",
    round: 1,
    currentPlayerId: playerIds[0],
    firstPlayerId: playerIds[0],
    players,
    playerOrder: playerIds,
    deck,
    discard: [],
    market: deck.splice(0, 3),
    feeder: ["seed", "fruit", "insect", "fish", "rodent"],
    roundGoals: defaultRoundGoals,
    roundGoalResults: {},
    cards: speciesCards,
    bonusCardsCatalog,
    log: [{ message: "Partida iniciada." }],
  };
}

function createPlayer(id: PlayerId, hand: string[], bonusCards = [] as PlayerState["bonusCards"]): PlayerState {
  return {
    id,
    hand,
    bonusCards,
    resources: { seed: 1, fruit: 1, insect: 1 },
    board: Object.fromEntries(
      habitats.map((habitat) => [habitat, makeSlots()]),
    ) as Record<HabitatId, BoardSlot[]>,
    actionCubesAvailable: 8,
    roundGoalScores: [],
  };
}
