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

const habitatWords: Record<HabitatId, string> = { forest: "el bosque", grassland: "la pradera", wetland: "el río" };
const nestWords: Record<"bowl" | "cavity" | "ground" | "platform", string> = {
  bowl: "de copa",
  cavity: "en cavidad",
  ground: "en el suelo",
  platform: "de plataforma",
};
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Los 16 objetivos de fin de ronda del juego base. En cada partida se sortean 4 (uno por ronda).
 * Los tipos de nido cuentan también las aves con nido comodín.
 */
export const roundGoalPool: RoundGoal[] = [
  ...(Object.keys(habitatWords) as HabitatId[]).map((habitat): RoundGoal => ({
    id: `birdsIn${capitalize(habitat)}`,
    name: `Aves en ${habitatWords[habitat]}`,
    description: `Cantidad de aves jugadas en ${habitatWords[habitat]}.`,
    type: "birdsInHabitat",
    habitat,
  })),
  ...(Object.keys(habitatWords) as HabitatId[]).map((habitat): RoundGoal => ({
    id: `eggsIn${capitalize(habitat)}`,
    name: `Huevos en ${habitatWords[habitat]}`,
    description: `Total de huevos sobre las aves de ${habitatWords[habitat]}.`,
    type: "eggsInHabitat",
    habitat,
  })),
  ...(Object.keys(nestWords) as (keyof typeof nestWords)[]).map((nestType): RoundGoal => ({
    id: `${nestType}NestsWithEggs`,
    name: `Aves con nido ${nestWords[nestType]} y huevos`,
    description: `Aves con nido ${nestWords[nestType]} que tengan al menos 1 huevo (el nido comodín cuenta).`,
    type: "birdsWithEggsInNests",
    nestType,
  })),
  ...(Object.keys(nestWords) as (keyof typeof nestWords)[]).map((nestType): RoundGoal => ({
    id: `eggsIn${capitalize(nestType)}Nests`,
    name: `Huevos en nidos ${nestWords[nestType]}`,
    description: `Total de huevos sobre aves con nido ${nestWords[nestType]} (el nido comodín cuenta).`,
    type: "eggsInNests",
    nestType,
  })),
  {
    id: "eggSets",
    name: "Conjuntos de huevos",
    description: "Cada conjunto es 1 huevo en el bosque, 1 en la pradera y 1 en el río.",
    type: "eggSets",
  },
  {
    id: "totalBirds",
    name: "Aves totales",
    description: "Total de aves jugadas en todo el tablero.",
    type: "totalBirds",
  },
];

/** Sortea los objetivos de una partida: 4 distintos, uno por ronda. */
export function pickRoundGoals(count = 4): RoundGoal[] {
  return shuffle([...roundGoalPool]).slice(0, count);
}

export interface CreateGameOptions {
  mode?: GameMode;
  automaDifficulty?: AutomaDifficulty;
  playerIds?: PlayerId[];
  customPlayerNames?: Record<PlayerId, string>;
  /** Objetivos de ronda fijos (por defecto se sortean 4 entre los 16 del juego base). */
  roundGoals?: RoundGoal[];
}

export function createInitialState(
  optionsOrPlayerIds: CreateGameOptions | PlayerId[] = { mode: "solo", automaDifficulty: "normal" },
): GameState {
  let mode: GameMode = "solo";
  let automaDifficulty: AutomaDifficulty = "normal";
  let playerIds: PlayerId[] = ["nico", "automa"];
  let customNames: Record<PlayerId, string> = {};
  let fixedRoundGoals: RoundGoal[] | undefined;

  if (Array.isArray(optionsOrPlayerIds)) {
    playerIds = optionsOrPlayerIds;
    mode = playerIds.includes("automa") ? "solo" : "online";
  } else if (typeof optionsOrPlayerIds === "object") {
    mode = optionsOrPlayerIds.mode ?? "solo";
    automaDifficulty = optionsOrPlayerIds.automaDifficulty ?? "normal";
    playerIds = optionsOrPlayerIds.playerIds ?? (mode === "solo" ? ["nico", "automa"] : ["nico", "santi"]);
    customNames = optionsOrPlayerIds.customPlayerNames ?? {};
    fixedRoundGoals = optionsOrPlayerIds.roundGoals;
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
      // Cada jugador humano recibe 2 cartas de bonificación al azar y elige 1 para conservar
      // (pendingBonusChoice); la partida no empieza a jugarse hasta que todos hayan elegido.
      const pendingBonusChoice = isAutoma ? [] : bonusDeck.splice(0, 2);
      const name = customNames[id] || defaultNames[id] || id;
      return [id, createPlayer(id, name, hand, pendingBonusChoice, isAutoma)];
    }),
  );

  const hasPendingBonusChoice = Object.values(players).some(
    (p) => !p.isAutoma && p.pendingBonusChoice && p.pendingBonusChoice.length > 0,
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
    phase: hasPendingBonusChoice ? "setup" : "round",
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
    roundGoals: fixedRoundGoals ?? pickRoundGoals(),
    roundGoalResults: {},
    // Copias del catálogo: cada partida debe poder personalizar sus propias cartas (usado por
    // los tests para sobreescribir poderes puntuales) sin filtrar cambios a otras partidas.
    cards: { ...speciesCards },
    bonusCardsCatalog: { ...bonusCardsCatalog },
    bonusDeck,
    bonusDiscard: [],
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
  pendingBonusChoice: string[] = [],
  isAutoma = false,
): PlayerState {
  return {
    id,
    name,
    hand,
    bonusCards: [],
    pendingBonusChoice: pendingBonusChoice.length > 0 ? pendingBonusChoice : undefined,
    resources: isAutoma ? {} : { seed: 1, fruit: 1, insect: 1 },
    board: Object.fromEntries(
      habitats.map((habitat) => [habitat, makeSlots()]),
    ) as Record<HabitatId, BoardSlot[]>,
    actionCubesAvailable: 8,
    roundGoalScores: [],
    isAutoma,
    pinkPowersUsed: [],
  };
}
