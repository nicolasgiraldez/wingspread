import { automaCardsCatalog } from "./automaCards";
import { bonusCardsCatalog, speciesCards } from "./cards";
import type {
  AutomaDifficulty,
  AutomaState,
  BoardSlot,
  GameMode,
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

export interface CreateGameOptions {
  mode?: GameMode;
  automaDifficulty?: AutomaDifficulty;
  playerIds?: PlayerId[];
}

export function createInitialState(
  optionsOrPlayerIds: CreateGameOptions | PlayerId[] = ["nico", "santi"],
): GameState {
  let mode: GameMode = "local2p";
  let automaDifficulty: AutomaDifficulty = "normal";
  let playerIds: PlayerId[] = ["nico", "santi"];

  if (Array.isArray(optionsOrPlayerIds)) {
    playerIds = optionsOrPlayerIds;
    if (playerIds.includes("automa")) {
      mode = "solo";
    }
  } else if (typeof optionsOrPlayerIds === "object") {
    mode = optionsOrPlayerIds.mode ?? "local2p";
    automaDifficulty = optionsOrPlayerIds.automaDifficulty ?? "normal";
    playerIds = optionsOrPlayerIds.playerIds ?? (mode === "solo" ? ["nico", "automa"] : ["nico", "santi"]);
  }

  if (playerIds.length < 2) {
    throw new Error("Wingspread requiere al menos 2 jugadores.");
  }

  const deck = Object.keys(speciesCards);
  const bonusDeck = Object.keys(bonusCardsCatalog);

  const players: Record<PlayerId, PlayerState> = Object.fromEntries(
    playerIds.map((id) => {
      const isAutoma = id === "automa";
      const hand = isAutoma ? [] : deck.splice(0, 2);
      const bonusIds = isAutoma ? [] : bonusDeck.splice(0, 1);
      const bonusCards = bonusIds.map((bId) => bonusCardsCatalog[bId]);
      return [id, createPlayer(id, hand, bonusCards, isAutoma)];
    }),
  );

  let automaState: AutomaState | undefined;
  if (mode === "solo" || playerIds.includes("automa")) {
    const automaDeck = Object.keys(automaCardsCatalog);
    automaState = {
      difficulty: automaDifficulty,
      deck: [...automaDeck],
      discard: [],
      currentCard: null,
      stashedCardsCount: 0,
      eggs: 0,
      roundGoalMetric: 0,
    };
  }

  return {
    gameMode: mode,
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
    automaState,
    log: [{ message: `Partida iniciada (${mode === "solo" ? `Modo Solitario vs Automa [${automaDifficulty}]` : "Modo 2 Jugadores Local"}).` }],
  };
}

function createPlayer(
  id: PlayerId,
  hand: string[],
  bonusCards = [] as PlayerState["bonusCards"],
  isAutoma = false,
): PlayerState {
  return {
    id,
    hand,
    bonusCards,
    resources: isAutoma ? {} : { seed: 1, fruit: 1, insect: 1 },
    board: Object.fromEntries(
      habitats.map((habitat) => [habitat, makeSlots()]),
    ) as Record<HabitatId, BoardSlot[]>,
    actionCubesAvailable: 8,
    roundGoalScores: [],
    isAutoma,
  };
}
