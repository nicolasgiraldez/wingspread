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

export const standardDieFaces: ResourceFace[] = [
  "seed",
  "fruit",
  "insect",
  "fish",
  "rodent",
  "wild",
];

export const makeSlots = (): BoardSlot[] =>
  Array.from({ length: 5 }, () => ({
    cardId: null,
    eggs: 0,
    cached: [],
    tucked: [],
  }));

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function rollRandomDie(): ResourceFace {
  const index = Math.floor(Math.random() * standardDieFaces.length);
  return standardDieFaces[index];
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
  customPlayerNames?: Record<PlayerId, string>;
}

export function createInitialState(
  optionsOrPlayerIds: CreateGameOptions | PlayerId[] = { mode: "solo", automaDifficulty: "normal" },
): GameState {
  let mode: GameMode = "solo";
  let automaDifficulty: AutomaDifficulty = "normal";
  let playerIds: PlayerId[] = ["nico", "automa"];
  let customNames: Record<PlayerId, string> = {};

  if (Array.isArray(optionsOrPlayerIds)) {
    playerIds = optionsOrPlayerIds;
    mode = playerIds.includes("automa") ? "solo" : "online";
  } else if (typeof optionsOrPlayerIds === "object") {
    mode = optionsOrPlayerIds.mode ?? "solo";
    automaDifficulty = optionsOrPlayerIds.automaDifficulty ?? "normal";
    playerIds = optionsOrPlayerIds.playerIds ?? (mode === "solo" ? ["nico", "automa"] : ["nico", "santi"]);
    customNames = optionsOrPlayerIds.customPlayerNames ?? {};
  }

  if (playerIds.length < 2) {
    throw new Error("Wingspread requiere al menos 2 jugadores.");
  }

  const defaultNames: Record<string, string> = {
    nico: "Nico",
    santi: "Santi",
    automa: "Automa (IA)",
  };

  const deck = shuffle(Object.keys(speciesCards));
  const bonusDeck = shuffle(Object.keys(bonusCardsCatalog));

  const players: Record<PlayerId, PlayerState> = Object.fromEntries(
    playerIds.map((id) => {
      const isAutoma = id === "automa";
      const hand = isAutoma ? [] : deck.splice(0, 2);
      const bonusIds = isAutoma ? [] : bonusDeck.splice(0, 1);
      const bonusCards = bonusIds.map((bId) => bonusCardsCatalog[bId]);
      const name = customNames[id] || defaultNames[id] || id;
      return [id, createPlayer(id, name, hand, bonusCards, isAutoma)];
    }),
  );

  let automaState: AutomaState | undefined;
  if (mode === "solo" || playerIds.includes("automa")) {
    const automaDeck = shuffle(Object.keys(automaCardsCatalog));
    automaState = {
      difficulty: automaDifficulty,
      deck: automaDeck,
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
    customPlayerNames: customNames,
    deck,
    discard: [],
    market: deck.splice(0, 3),
    feeder: rollInitialFeeder(5),
    roundGoals: defaultRoundGoals,
    roundGoalResults: {},
    cards: speciesCards,
    bonusCardsCatalog,
    automaState,
    log: [{
      message: mode === "solo"
        ? `Partida iniciada en Modo Solitario vs Automa [${automaDifficulty}].`
        : "Partida Multijugador Online iniciada.",
    }],
  };
}

function createPlayer(
  id: PlayerId,
  name: string,
  hand: string[],
  bonusCards = [] as PlayerState["bonusCards"],
  isAutoma = false,
): PlayerState {
  return {
    id,
    name,
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
