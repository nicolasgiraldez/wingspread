import { bonusCardsCatalog, speciesCards } from "./cards";
import type {
  BoardSlot,
  BotDifficulty,
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

const makeSlots = (): BoardSlot[] =>
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
  /** Nivel del rival "bot" en el modo solitario (por defecto "normal"). */
  botDifficulty?: BotDifficulty;
  /** Jugadores controlados por la IA y su nivel (por defecto, en solitario, el jugador "bot"). */
  bots?: Record<PlayerId, BotDifficulty>;
  playerIds?: PlayerId[];
  /** Quién empieza (por defecto el primero de playerIds). */
  firstPlayerId?: PlayerId;
  customPlayerNames?: Record<PlayerId, string>;
  /** Objetivos de ronda fijos (por defecto se sortean 4 entre los 16 del juego base). */
  roundGoals?: RoundGoal[];
}

export function createInitialState(
  optionsOrPlayerIds: CreateGameOptions | PlayerId[] = { mode: "solo" },
): GameState {
  let mode: GameMode = "solo";
  let botDifficulty: BotDifficulty = "normal";
  let playerIds: PlayerId[] = ["nico", "bot"];
  let customNames: Record<PlayerId, string> = {};
  let fixedRoundGoals: RoundGoal[] | undefined;
  let bots: Record<PlayerId, BotDifficulty> | undefined;
  let firstPlayerId: PlayerId | undefined;

  if (Array.isArray(optionsOrPlayerIds)) {
    playerIds = optionsOrPlayerIds;
    mode = playerIds.includes("bot") ? "solo" : "online";
  } else if (typeof optionsOrPlayerIds === "object") {
    mode = optionsOrPlayerIds.mode ?? "solo";
    botDifficulty = optionsOrPlayerIds.botDifficulty ?? "normal";
    playerIds = optionsOrPlayerIds.playerIds ?? (mode === "solo" ? ["nico", "bot"] : ["nico", "santi"]);
    customNames = optionsOrPlayerIds.customPlayerNames ?? {};
    fixedRoundGoals = optionsOrPlayerIds.roundGoals;
    bots = optionsOrPlayerIds.bots;
    firstPlayerId = optionsOrPlayerIds.firstPlayerId;
  }
  const botLevels: Record<PlayerId, BotDifficulty> =
    bots ?? (playerIds.includes("bot") ? { bot: botDifficulty } : {});

  if (playerIds.length < 2) {
    throw new Error("Wingspread requiere al menos 2 jugadores.");
  }

  const defaultNames: Record<string, string> = {
    nico: "Nico",
    santi: "Santi",
    bot: "Rival (IA)",
  };

  const deck = shuffle(Object.keys(speciesCards));
  const bonusDeck = shuffle(Object.keys(bonusCardsCatalog));

  // Preparación estándar: cada jugador recibe 5 aves, 5 fichas de alimento (1 de cada tipo) y 2 cartas
  // de bonificación al azar. Antes de empezar elige (chooseStart) qué aves conserva —descartando 1
  // alimento por cada una— y con qué bonificación se queda.
  const players: Record<PlayerId, PlayerState> = Object.fromEntries(
    playerIds.map((id) => {
      const hand = deck.splice(0, 5);
      const bonusOffer = bonusDeck.splice(0, 2);
      const name = customNames[id] || defaultNames[id] || id;
      return [id, createPlayer(id, name, hand, bonusOffer, botLevels[id])];
    }),
  );

  const first = firstPlayerId && playerIds.includes(firstPlayerId) ? firstPlayerId : playerIds[0];

  return {
    gameMode: mode,
    phase: "setup",
    round: 1,
    currentPlayerId: first,
    firstPlayerId: first,
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
    log: [{
      message: mode === "solo" ? `Partida iniciada contra un rival de la IA (${botDifficulty}).` : "Partida Multijugador Online iniciada.",
    }],
  };
}

function createPlayer(
  id: PlayerId,
  name: string,
  hand: string[],
  pendingBonusChoice: string[] = [],
  botLevel?: BotDifficulty,
): PlayerState {
  return {
    id,
    name,
    hand,
    bonusCards: [],
    pendingBonusChoice: pendingBonusChoice.length > 0 ? pendingBonusChoice : undefined,
    resources: { seed: 1, fruit: 1, insect: 1, fish: 1, rodent: 1 },
    board: Object.fromEntries(
      habitats.map((habitat) => [habitat, makeSlots()]),
    ) as Record<HabitatId, BoardSlot[]>,
    actionCubesAvailable: 8,
    roundGoalScores: [],
    botLevel,
    pendingStartingHand: true,
    pinkPowersUsed: [],
  };
}
