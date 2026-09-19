import { describe, expect, it, vi } from "vitest";
import {
  applyMove as applyMoveWithBots,
  applyPlayerMove,
  calculateBonusPoints,
  canPayResources,
  canRerollFeeder,
  createInitialState,
  evaluateRoundGoalMetric,
  isLegalMove,
  resolvePower,
  resolveRoundEnd,
  pickRoundGoals,
  rankPlayers,
  rollInitialFeeder,
  roundGoalPool,
  scorePlayer,
  scorePlayerDetails,
  shuffle,
  standardDieFaces,
} from ".";
import type { BonusCard, GameState, Move, SpeciesCard } from "./types";

/**
 * Aves ficticias de prueba con poderes simples y deterministas, independientes del catálogo
 * real de Wingspan (que puede volver a cambiar). Se inyectan en cada test vía createTestState
 * para que las aserciones no dependan de qué poder tenga hoy tal o cual especie real.
 */
const TEST_CARDS: Record<string, SpeciesCard> = {
  meadowSparrow: {
    id: "meadowSparrow",
    name: "Gorrión de Pradera (prueba)",
    habitats: ["grassland"],
    cost: { seed: 1 },
    points: 2,
    eggCapacity: 4,
    nestType: "bowl",
    wingspanCm: 20,
    powers: [{ id: "meadowSparrow.grassland.draw", timing: "onActivate", kind: "drawCard", amount: 1 }],
  },
  riverHeron: {
    id: "riverHeron",
    name: "Garza de Río (prueba)",
    habitats: ["wetland"],
    cost: { fish: 1, insect: 1 },
    points: 5,
    eggCapacity: 2,
    nestType: "platform",
    wingspanCm: 100,
    powers: [{ id: "riverHeron.wetland.fish", timing: "onActivate", kind: "gainResource", resource: "fish", amount: 1 }],
  },
  orchardFinch: {
    id: "orchardFinch",
    name: "Pinzón de Huerto (prueba)",
    habitats: ["forest", "grassland"],
    cost: { fruit: 1 },
    points: 3,
    eggCapacity: 3,
    nestType: "bowl",
    wingspanCm: 22,
    powers: [{ id: "orchardFinch.play.egg", timing: "onPlay", kind: "layEgg", amount: 1, target: "self" }],
  },
  marshWren: {
    id: "marshWren",
    name: "Ratona de Juncal (prueba)",
    habitats: ["wetland"],
    cost: { insect: 1 },
    points: 1,
    eggCapacity: 5,
    nestType: "cavity",
    wingspanCm: 15,
    powers: [{ id: "marshWren.wetland.filter", timing: "onActivate", kind: "drawCard", amount: 1, thenDiscard: true }],
  },
  cliffSwallow: {
    id: "cliffSwallow",
    name: "Golondrina de Acantilado (prueba)",
    habitats: ["grassland", "wetland"],
    cost: { insect: 1, seed: 1 },
    points: 4,
    eggCapacity: 4,
    nestType: "bowl",
    wingspanCm: 28,
    powers: [{ id: "cliffSwallow.grassland.egg", timing: "onActivate", kind: "layEgg", amount: 1, target: "self" }],
  },
  kelpGull: {
    id: "kelpGull",
    name: "Gaviota de Algas (prueba)",
    habitats: ["wetland"],
    cost: { fish: 1 },
    points: 2,
    eggCapacity: 3,
    nestType: "ground",
    wingspanCm: 120,
    powers: [{ id: "kelpGull.wetland.tuck", timing: "onActivate", kind: "tuckCard", amount: 1, source: "hand", thenDraw: true }],
  },
  acornJay: {
    id: "acornJay",
    name: "Arrendajo Bellotero (prueba)",
    habitats: ["forest"],
    cost: { seed: 1, fruit: 1 },
    points: 4,
    eggCapacity: 2,
    nestType: "cavity",
    wingspanCm: 35,
    powers: [{ id: "acornJay.forest.seed", timing: "onActivate", kind: "cacheFood", resource: "seed", amount: 1, source: "supply" }],
  },
  pineGrosbeak: {
    id: "pineGrosbeak",
    name: "Picogrueso de Pinar (prueba)",
    habitats: ["forest"],
    cost: { fruit: 2 },
    points: 5,
    eggCapacity: 3,
    nestType: "bowl",
    wingspanCm: 30,
    powers: [{ id: "pineGrosbeak.forest.fruit", timing: "onActivate", kind: "gainResource", resource: "fruit", amount: 1 }],
  },
  redTailedHawk: {
    id: "redTailedHawk",
    name: "Aguilucho Colirrojo (prueba)",
    habitats: ["forest", "grassland"],
    cost: { rodent: 2 },
    points: 7,
    eggCapacity: 2,
    nestType: "platform",
    wingspanCm: 125,
    powers: [{ id: "redTailedHawk.hunt", timing: "onActivate", kind: "huntPredator", maxWingspanCm: 65 }],
  },
  barnOwl: {
    id: "barnOwl",
    name: "Lechuza Común (prueba)",
    habitats: ["forest", "grassland"],
    cost: { rodent: 1, wild: 1 },
    points: 6,
    eggCapacity: 3,
    nestType: "cavity",
    wingspanCm: 110,
    powers: [{ id: "barnOwl.hunt", timing: "onActivate", kind: "huntPredator", maxWingspanCm: 50 }],
  },
  americanRobin: {
    id: "americanRobin",
    name: "Mirlo Primavera (prueba)",
    habitats: ["forest", "grassland"],
    cost: { insect: 1, fruit: 1 },
    points: 3,
    eggCapacity: 4,
    nestType: "bowl",
    wingspanCm: 38,
    powers: [{ id: "americanRobin.allGain", timing: "onActivate", kind: "allPlayersGain", resource: "insect", benefitType: "resource" }],
  },
  tuftedTitmouse: {
    id: "tuftedTitmouse",
    name: "Herrerillo Bicolor (prueba)",
    habitats: ["forest"],
    cost: { seed: 1 },
    points: 2,
    eggCapacity: 4,
    nestType: "cavity",
    wingspanCm: 24,
    powers: [{ id: "tuftedTitmouse.cache", timing: "onActivate", kind: "cacheFood", resource: "seed", amount: 1, source: "supply" }],
  },
  mallard: {
    id: "mallard",
    name: "Ánade Real (prueba)",
    habitats: ["wetland"],
    cost: { seed: 1, insect: 1 },
    points: 3,
    eggCapacity: 5,
    nestType: "ground",
    wingspanCm: 90,
    powers: [{ id: "mallard.tuckDeck", timing: "onActivate", kind: "tuckCard", amount: 1, source: "deck", thenDraw: false }],
  },
  rubyThroatedHummingbird: {
    id: "rubyThroatedHummingbird",
    name: "Colibrí Gorgirrubí (prueba)",
    habitats: ["forest", "grassland", "wetland"],
    cost: { fruit: 1 },
    points: 2,
    eggCapacity: 2,
    nestType: "bowl",
    wingspanCm: 10,
    powers: [{ id: "rubyThroatedHummingbird.allGainFruit", timing: "onActivate", kind: "allPlayersGain", resource: "fruit", benefitType: "resource" }],
  },
};

function createTestState(...args: Parameters<typeof createInitialState>): ReturnType<typeof createInitialState> {
  let state = createInitialState(...args);
  Object.assign(state.cards, TEST_CARDS);
  // Resuelve la preparación inicial de todos los jugadores para que los tests de mecánica arranquen
  // directo en fase "round". Cada uno conserva sus 2 primeras aves y las fichas de semilla, fruta e
  // insecto (descarta pez y roedor): la mano y el alimento con los que se escribieron estos tests.
  // Los tests que sí cubren la preparación usan createInitialState directamente.
  for (const player of Object.values(state.players)) {
    state = applyPlayerMove(state, player.id, {
      type: "chooseStart",
      keepCards: player.hand.slice(0, 2),
      discardFood: ["fish", "rodent"],
      bonusCardId: player.pendingBonusChoice![0],
    });
  }
  return state;
}

/**
 * Aplica un movimiento SIN la IA real: si después le toca a un rival de la IA hace un movimiento
 * mínimo (tomar el primer dado) para devolver el turno al humano. Así los tests de mecánica son
 * deterministas; el juego real de la IA se prueba en bot.test.ts.
 */
function applyMove(state: GameState, playerId: string, move: Move): GameState {
  let next = applyPlayerMove(state, playerId, move);
  while (
    next.phase === "round" &&
    next.players[next.currentPlayerId]?.botLevel &&
    next.players[next.currentPlayerId].actionCubesAvailable > 0
  ) {
    next = applyPlayerMove(next, next.currentPlayerId, { type: "gainFood", dieIndexes: [0] });
  }
  return next;
}

describe("motor de reglas expandido de wingspread", () => {
  it("crea una partida para Nico y Santi con comedero de 5 dados aleatorios y mazo barajado", () => {
    const state = createTestState(["nico", "santi"]);

    expect(state.phase).toBe("round");
    expect(state.round).toBe(1);
    expect(state.currentPlayerId).toBe("nico");
    expect(state.firstPlayerId).toBe("nico");
    expect(state.market).toHaveLength(3);
    expect(state.feeder).toHaveLength(5);
    expect(state.players.nico.actionCubesAvailable).toBe(8);
    expect(state.players.santi.actionCubesAvailable).toBe(8);
    expect(state.players.nico.bonusCards.length).toBeGreaterThanOrEqual(1);

    // Todos los dados del comedero deben ser caras válidas de las 6 caras estándar
    for (const face of state.feeder) {
      expect(standardDieFaces).toContain(face);
    }
  });

  it("garantiza que rollInitialFeeder genera 5 dados de 6 caras", () => {
    const feeder = rollInitialFeeder(5);
    expect(feeder).toHaveLength(5);
    expect(standardDieFaces).toContain("wild");
    for (const die of feeder) {
      expect(standardDieFaces).toContain(die);
    }
  });

  it("baraja elementos correctamente con shuffle", () => {
    const original = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const shuffled = shuffle(original);
    expect(shuffled).toHaveLength(original.length);
    for (const item of original) {
      expect(shuffled).toContain(item);
    }
  });

  it("permite que Nico obtenga alimento del comedero y reduce los dados disponibles", () => {
    const state = createTestState(["nico", "santi"]);
    state.feeder = ["seed", "fruit", "insect", "fish", "rodent"];
    const move: Move = { type: "gainFood", dieIndexes: [0] };

    expect(isLegalMove(state, "nico", move)).toBe(true);

    const next = applyMove(state, "nico", move);
    expect(next.players.nico.resources.seed).toBe(2);
    expect(next.feeder).toHaveLength(4);
    expect(next.players.nico.actionCubesAvailable).toBe(7);
    expect(next.currentPlayerId).toBe("santi");
  });

  it("permite la regla de sustitución 2:1 para pagar costes de alimento", () => {
    const state = createTestState(["nico", "santi"]);
    const player = state.players.nico;
    player.resources = { fruit: 2, insect: 0, seed: 0 };

    const cost = { seed: 1 };
    expect(canPayResources(player, ["fruit", "fruit"], cost)).toBe(true);
    expect(canPayResources(player, ["fruit"], cost)).toBe(false);

    const wildCost = { wild: 1 };
    expect(canPayResources(player, ["fruit"], wildCost)).toBe(true);
  });

  it("permite relanzar el comedero cuando todos los dados muestran la misma cara", () => {
    expect(canRerollFeeder(["seed", "seed", "seed"])).toBe(true);
    expect(canRerollFeeder([])).toBe(true);
    expect(canRerollFeeder(["seed", "fruit"])).toBe(false);

    const state = createTestState(["nico", "santi"]);
    state.feeder = ["seed", "seed", "seed"];
    const move: Move = { type: "rerollFeeder" };

    expect(isLegalMove(state, "nico", move)).toBe(true);
    const next = applyMove(state, "nico", move);
    expect(next.feeder).toHaveLength(5);
  });

  it("ejecuta el poder de almacenar alimento (caching) al activar el bosque", () => {
    const state = createTestState(["nico", "santi"]);
    state.players.nico.board.forest[0].cardId = "acornJay";

    const move: Move = { type: "gainFood", dieIndexes: [0] };
    const next = applyMove(state, "nico", move);

    const slot = next.players.nico.board.forest[0];
    expect(slot.cached).toContain("seed");
    expect(slot.cached.length).toBe(1);
  });

  it("ejecuta el poder de solapar cartas (tucking) al activar el río/humedal", () => {
    const state = createTestState(["nico", "santi"]);
    state.players.nico.board.wetland[0].cardId = "mallard";
    const initialDeckCount = state.deck.length;

    const move: Move = {
      type: "drawBirdCards",
      draws: [{ source: "deck" }],
    };

    const next = applyMove(state, "nico", move);
    const slot = next.players.nico.board.wetland[0];
    expect(slot.tucked.length).toBe(1);
    expect(next.deck.length).toBe(initialDeckCount - 2);
  });

  it("ejecuta el poder de caza depredador (huntPredator)", () => {
    const state = createTestState(["nico", "santi"]);
    state.players.nico.board.forest[0].cardId = "redTailedHawk";
    state.deck.unshift("marshWren");

    const move: Move = { type: "gainFood", dieIndexes: [0] };
    const next = applyMove(state, "nico", move);

    const slot = next.players.nico.board.forest[0];
    expect(slot.tucked).toContain("marshWren");
  });

  it("evalúa y puntúa los objetivos de fin de ronda y reinicia cubos de acción", () => {
    const state = createTestState(["nico", "santi"]);
    // Los objetivos se sortean en cada partida: este test fija el de la ronda 1.
    state.roundGoals[0] = roundGoalPool.find((goal) => goal.id === "eggsInGrassland")!;
    state.players.nico.board.grassland[0].cardId = "meadowSparrow";
    state.players.nico.board.grassland[0].eggs = 3;
    state.players.santi.board.grassland[0].cardId = "cliffSwallow";
    state.players.santi.board.grassland[0].eggs = 1;

    const nicoEggs = evaluateRoundGoalMetric(state.players.nico, state, state.roundGoals[0]);
    const santiEggs = evaluateRoundGoalMetric(state.players.santi, state, state.roundGoals[0]);
    expect(nicoEggs).toBe(3);
    expect(santiEggs).toBe(1);

    resolveRoundEnd(state);
    expect(state.round).toBe(2);
    expect(state.players.nico.roundGoalScores[0]).toBe(4);
    expect(state.players.santi.roundGoalScores[0]).toBe(1);
    expect(state.players.nico.actionCubesAvailable).toBe(7);
    expect(state.firstPlayerId).toBe("santi");
    expect(state.currentPlayerId).toBe("santi");
  });

  it("calcula la puntuación detallada incluyendo bonificaciones, huevos y cartas solapadas", () => {
    const state = createTestState(["nico", "santi"]);
    const slot = state.players.nico.board.wetland[0];
    slot.cardId = "riverHeron";
    slot.eggs = 2;
    slot.cached = ["fish"];
    slot.tucked = ["marshWren"];
    state.players.nico.roundGoalScores = [4, 5];

    state.players.nico.bonusCards = [
      {
        id: "wetlandBonus",
        name: "Ecólogo de Humedales",
        description: "Aves en humedal",
        conditionType: "birdsInHabitat",
        habitat: "wetland",
        tiers: [{ threshold: 1, points: 3 }],
      },
    ];

    const breakdown = scorePlayerDetails(state, "nico");
    expect(breakdown.birds).toBe(5);
    expect(breakdown.eggs).toBe(2);
    expect(breakdown.cachedFood).toBe(1);
    expect(breakdown.tuckedCards).toBe(1);
    expect(breakdown.roundGoals).toBe(9);
    expect(breakdown.bonusCards).toBe(3);
    expect(breakdown.total).toBe(21);
    expect(scorePlayer(state, "nico")).toBe(21);
  });

  // Modo solitario: un rival de la IA que es un jugador más, con tablero y reglas normales.
  it("inicializa el modo solitario con un rival de la IA como un jugador más", () => {
    const state = createTestState({ mode: "solo", botDifficulty: "hard" });

    expect(state.gameMode).toBe("solo");
    expect(state.playerOrder).toEqual(["nico", "bot"]);
    expect(state.players.nico.botLevel).toBeUndefined();
    expect(state.players.bot.botLevel).toBe("hard");
    // El rival tiene tablero, mano, alimento y acciones como cualquiera.
    expect(state.players.bot.actionCubesAvailable).toBe(8);
    expect(state.players.bot.hand).toHaveLength(2);
    expect(Object.keys(state.players.bot.board)).toEqual(["forest", "grassland", "wetland"]);
  });

  it("tras la jugada del humano juega el rival de la IA con las reglas normales y devuelve el turno", () => {
    const state = createInitialState({ mode: "solo", botDifficulty: "normal" });
    const chosen = state.players.nico.pendingBonusChoice![0];
    const ready = applyMoveWithBots(state, "nico", { type: "chooseStart", keepCards: [], discardFood: [], bonusCardId: chosen });
    expect(ready.phase).toBe("round");
    expect(ready.currentPlayerId).toBe("nico");

    const next = applyMoveWithBots(ready, "nico", { type: "gainFood", dieIndexes: [0] });
    expect(next.players.nico.actionCubesAvailable).toBe(7);
    expect(next.players.bot.actionCubesAvailable).toBe(7); // el rival gastó una acción real
    expect(next.currentPlayerId).toBe("nico");
    expect(next.log.some((entry) => entry.playerId === "bot")).toBe(true);
  });

  it("permite elegir entre insecto o trigo al tomar un dado con cara comodín", () => {
    const state = createTestState({ mode: "solo" });
    state.feeder = ["wild", "fruit", "fish"];
    const initialInsects = state.players.nico.resources.insect ?? 0;
    const initialSeeds = state.players.nico.resources.seed ?? 0;

    // Elegir insecto (gusano)
    const moveInsect: Move = {
      type: "gainFood",
      dieIndexes: [0],
      wildChoices: { 0: "insect" },
    };
    const nextWithInsect = applyMove(state, "nico", moveInsect);
    expect(nextWithInsect.players.nico.resources.insect).toBe(initialInsects + 1);
    expect(nextWithInsect.players.nico.resources.seed).toBe(initialSeeds);

    // Elegir semilla (trigo)
    const state2 = createTestState({ mode: "solo" });
    state2.feeder = ["wild", "fruit", "fish"];
    const moveSeed: Move = {
      type: "gainFood",
      dieIndexes: [0],
      wildChoices: { 0: "seed" },
    };
    const nextWithSeed = applyMove(state2, "nico", moveSeed);
    expect(nextWithSeed.players.nico.resources.seed).toBe(initialSeeds + 1);
    expect(nextWithSeed.players.nico.resources.insect).toBe(initialInsects);
  });

  it("permite distribuir la cantidad de huevos asignada entre varias aves de distintos hábitats respetando sus límites", () => {
    const state = createTestState({ mode: "solo" });
    // Jugar un ave en bosque (capacidad 4) y un ave en pradera (capacidad 2)
    state.players.nico.board.forest[0].cardId = "acornJay"; // eggCapacity: 4
    state.players.nico.board.grassland[0].cardId = "meadowSparrow"; // eggCapacity: 3

    // La cuota de pradera con 1 ave es 2 huevos (columna 1)
    const move: Move = {
      type: "layEggs",
      eggPlacements: [
        { habitat: "forest", slotIndex: 0 },
        { habitat: "grassland", slotIndex: 0 },
      ],
    };

    expect(isLegalMove(state, "nico", move)).toBe(true);

    const next = applyMove(state, "nico", move);
    expect(next.players.nico.board.forest[0].eggs).toBe(1);
    expect(next.players.nico.board.grassland[0].eggs).toBe(1);

    // No debe permitir exceder la capacidad del ave
    next.players.nico.board.forest[0].eggs = 4; // Lleno
    const illegalMove: Move = {
      type: "layEggs",
      eggPlacements: [{ habitat: "forest", slotIndex: 0 }],
    };
    expect(isLegalMove(next, "nico", illegalMove)).toBe(false);
  });

  it("registra detalladamente la activación de poderes en el registro de la partida", () => {
    const state = createTestState({ mode: "solo" });
    // Colocar un ave con poder marrón de robar cartas en bosque
    state.players.nico.board.forest[0].cardId = "acornJay"; // cacheFood seed
    state.feeder = ["seed", "fruit", "fish"];

    const move: Move = {
      type: "gainFood",
      dieIndexes: [0],
    };

    const next = applyMove(state, "nico", move);
    // Debe haber registrado la activación del poder de acornJay
    const powerLogs = next.log.filter((l) => l.message.includes("Arrendajo Bellotero"));
    expect(powerLogs.length).toBeGreaterThan(0);
    expect(powerLogs[0].message).toContain("almacenó 1 seed");
  });

  it("activa poderes rosas (entre turnos) del oponente cuando se detona la acción correspondiente", () => {
    const state = createTestState({ mode: "online", playerIds: ["nico", "santi"] });
    // Dar a Santi un ave con poder rosa: cuando otro jugador pone huevos, Santi pone 1 huevo
    state.players.santi.board.grassland[0].cardId = "cliffSwallow"; // layEgg
    state.cards.cliffSwallow.powers = [
      {
        id: "cliffSwallow.pink",
        timing: "onceBetweenTurns",
        kind: "layEgg",
        amount: 1,
        target: "self",
      },
    ];

    // Nico pone huevos en su gorrión
    state.players.nico.board.grassland[0].cardId = "meadowSparrow";
    const move: Move = {
      type: "layEggs",
      eggPlacements: [{ habitat: "grassland", slotIndex: 0 }],
    };

    const next = applyMove(state, "nico", move);
    // El ave rosa de Santi debió haber puesto 1 huevo en su nido automáticamente
    expect(next.players.santi.board.grassland[0].eggs).toBe(1);
    const pinkLogs = next.log.filter((l) => l.playerId === "santi" && l.message.includes("Golondrina de Acantilado"));
    expect(pinkLogs.length).toBeGreaterThan(0);
  });

  it("un poder rosa solo se activa 1 vez entre los turnos propios de su dueño", () => {
    const state = createTestState({ mode: "online", playerIds: ["nico", "santi"] });
    state.players.santi.board.grassland[0].cardId = "cliffSwallow";
    state.cards.cliffSwallow.powers = [
      {
        id: "cliffSwallow.pink",
        timing: "onceBetweenTurns",
        kind: "layEgg",
        amount: 1,
        target: "self",
      },
    ];
    state.players.nico.board.grassland[0].cardId = "meadowSparrow";
    state.players.nico.board.grassland[1].cardId = "meadowSparrow";

    // Nico pone huevos dos veces seguidas (Santi no tiene cubos, así que el turno vuelve a Nico)
    state.players.santi.actionCubesAvailable = 0;

    const first = applyMove(state, "nico", {
      type: "layEggs",
      eggPlacements: [{ habitat: "grassland", slotIndex: 0 }],
    });
    expect(first.players.santi.board.grassland[0].eggs).toBe(1);

    const second = applyMove(first, "nico", {
      type: "layEggs",
      eggPlacements: [{ habitat: "grassland", slotIndex: 1 }],
    });
    // La segunda vez, dentro de la misma ventana (Santi no tuvo turno propio en el medio),
    // el poder rosa NO debe volver a activarse.
    expect(second.players.santi.board.grassland[0].eggs).toBe(1);
  });

  it("permite saltear un poder onPlay opcional mediante skipPowerIds", () => {
    const state = createTestState({ mode: "solo" });
    state.players.nico.hand = ["orchardFinch"];
    state.players.nico.resources = { fruit: 1 };

    const move: Move = {
      type: "playBird",
      cardId: "orchardFinch",
      habitat: "grassland",
      slotIndex: 0,
      paidResources: ["fruit"],
      paidEggsFrom: [],
      skipPowerIds: ["orchardFinch.play.egg"],
    };

    const next = applyMove(state, "nico", move);
    expect(next.players.nico.board.grassland[0].eggs).toBe(0);
  });

  it("permite saltear un poder onActivate opcional mediante skipPowerIds", () => {
    const state = createTestState({ mode: "solo" });
    state.players.nico.board.forest[0].cardId = "acornJay"; // cacheFood seed
    state.feeder = ["seed", "fruit", "fish"];

    const move: Move = {
      type: "gainFood",
      dieIndexes: [0],
      skipPowerIds: ["acornJay.forest.seed"],
    };

    const next = applyMove(state, "nico", move);
    const slot = next.players.nico.board.forest[0];
    expect(slot.cached).toHaveLength(0);
  });

  it("respeta la elección del jugador al descartar tras un poder de robar+descartar", () => {
    const state = createTestState({ mode: "solo" });
    state.players.nico.board.wetland[0].cardId = "marshWren"; // draw 1, thenDiscard
    state.players.nico.hand = ["kelpGull"];
    state.deck = ["mallard", ...state.deck.filter((id) => id !== "mallard")];

    const move: Move = {
      type: "drawBirdCards",
      draws: [{ source: "deck" }],
      powerCardChoices: { "marshWren.wetland.filter": "kelpGull" },
    };

    const next = applyMove(state, "nico", move);
    // Se descartó la carta elegida (kelpGull), no la recién robada (mallard)
    expect(next.discard).toContain("kelpGull");
    expect(next.players.nico.hand).toContain("mallard");
  });

  it("respeta la elección del jugador al solapar una carta de la mano", () => {
    const state = createTestState({ mode: "solo" });
    state.players.nico.board.wetland[0].cardId = "kelpGull"; // tuckCard from hand
    state.players.nico.hand = ["mallard", "marshWren"];

    const move: Move = {
      type: "drawBirdCards",
      draws: [{ source: "deck" }],
      powerCardChoices: { "kelpGull.wetland.tuck": "mallard" },
    };

    const next = applyMove(state, "nico", move);
    expect(next.players.nico.board.wetland[0].tucked).toContain("mallard");
    expect(next.players.nico.hand).toContain("marshWren");
  });

  describe("costo 'O' (costAnyOf)", () => {
    it("permite pagar con cualquiera de los tipos listados en costAnyOf", () => {
      const state = createTestState({ mode: "solo" });
      const player = state.players.nico;
      player.resources = { insect: 1 };
      // Pagando con "insect", que es uno de los dos tipos aceptados por costAnyOf
      expect(canPayResources(player, ["insect"], {}, ["insect", "fruit"])).toBe(true);
    });

    it("rechaza el pago si no se aportó ningún tipo del set restringido ni sustitución 2x1", () => {
      const state = createTestState({ mode: "solo" });
      const player = state.players.nico;
      player.resources = { seed: 1 };
      // "seed" no está en el set {insect, fruit} y solo hay 1 unidad pagada (no alcanza para 2x1)
      expect(canPayResources(player, ["seed"], {}, ["insect", "fruit"])).toBe(false);
    });

    it("acepta la sustitución 2x1 cuando no se tiene ninguno de los tipos aceptados", () => {
      const state = createTestState({ mode: "solo" });
      const player = state.players.nico;
      player.resources = { seed: 2 };
      expect(canPayResources(player, ["seed", "seed"], {}, ["insect", "fruit"])).toBe(true);
    });

    it("permite jugar un ave cuyo costo combina costAnyOf con un requisito fijo", () => {
      const state = createTestState({ mode: "solo" });
      state.cards.testAnyOf = {
        id: "testAnyOf",
        name: "Ave de prueba",
        habitats: ["forest"],
        cost: { seed: 1 },
        costAnyOf: ["insect", "fruit"],
        points: 1,
        eggCapacity: 1,
        powers: [],
      };
      state.players.nico.hand = ["testAnyOf"];
      state.players.nico.resources = { seed: 1, fruit: 1 };

      const move: Move = {
        type: "playBird",
        cardId: "testAnyOf",
        habitat: "forest",
        slotIndex: 0,
        paidResources: ["seed", "fruit"],
        paidEggsFrom: [],
      };
      expect(isLegalMove(state, "nico", move)).toBe(true);
      const next = applyMove(state, "nico", move);
      expect(next.players.nico.board.forest[0].cardId).toBe("testAnyOf");
    });
  });

  describe("poder gainBonusCard", () => {
    /** Estado con una ave "al jugar" que revela 2 cartas de bonificación (conserva 1). */
    const withBonusBird = (mode: "solo" | "online" = "solo") => {
      const state =
        mode === "solo"
          ? createTestState({ mode: "solo" })
          : createTestState({ mode: "online", playerIds: ["nico", "santi"] });
      state.players.nico.hand = ["acornJay"];
      state.players.nico.resources = { seed: 1, fruit: 1 };
      state.players.nico.bonusCards = [];
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [{ id: "test.bonus", timing: "onPlay", kind: "gainBonusCard", drawCount: 2, keepCount: 1 }],
      };
      state.bonusDeck = ["forester", "wetlandScientist", "visionaryLeader"];
      state.bonusDiscard = [];
      return state;
    };
    const playBonusBird: Move = {
      type: "playBird",
      cardId: "acornJay",
      habitat: "forest",
      slotIndex: 0,
      paidResources: ["seed", "fruit"],
      paidEggsFrom: [],
    };

    it("revela las cartas y deja la elección pendiente: el jugador ve cuáles salieron y elige", () => {
      const state = withBonusBird("online");
      const cubesBefore = state.players.nico.actionCubesAvailable;

      const next = applyMove(state, "nico", playBonusBird);

      expect(next.players.nico.pendingBonusChoice).toEqual(["forester", "wetlandScientist"]);
      expect(next.players.nico.bonusCards).toEqual([]);
      expect(next.bonusDeck).toEqual(["visionaryLeader"]);
      expect(next.bonusDiscard).toEqual([]);
      expect(next.players.nico.actionCubesAvailable).toBe(cubesBefore - 1);
    });

    it("elegir la carta pendiente no gasta acción ni exige ser tu turno, y descarta las demás", () => {
      const played = applyMove(withBonusBird("online"), "nico", playBonusBird);
      expect(played.currentPlayerId).toBe("santi");
      const cubes = played.players.nico.actionCubesAvailable;

      const choose: Move = { type: "chooseBonusCard", bonusCardId: "wetlandScientist" };
      expect(isLegalMove(played, "nico", choose)).toBe(true);
      const next = applyMove(played, "nico", choose);

      expect(next.players.nico.bonusCards.map((b) => b.id)).toEqual(["wetlandScientist"]);
      expect(next.players.nico.pendingBonusChoice).toBeUndefined();
      expect(next.bonusDiscard).toEqual(["forester"]);
      expect(next.players.nico.actionCubesAvailable).toBe(cubes);
      expect(next.currentPlayerId).toBe("santi");
      expect(next.phase).toBe("round");
    });

    it("no deja elegir una carta que no se ofreció, ni a quien no tiene nada pendiente", () => {
      const played = applyMove(withBonusBird("online"), "nico", playBonusBird);
      expect(isLegalMove(played, "nico", { type: "chooseBonusCard", bonusCardId: "visionaryLeader" })).toBe(false);
      expect(isLegalMove(played, "santi", { type: "chooseBonusCard", bonusCardId: "forester" })).toBe(false);
    });

    it("con una carta de bonificación por elegir no se puede hacer otra acción", () => {
      const state = withBonusBird();
      const played = applyMove(state, "nico", playBonusBird);
      expect(played.currentPlayerId).toBe("nico"); // el rival de la IA ya jugó su turno

      expect(isLegalMove(played, "nico", { type: "gainFood", dieIndexes: [0] })).toBe(false);
      expect(isLegalMove(played, "nico", { type: "rerollFeeder" })).toBe(false);
      expect(isLegalMove(played, "nico", { type: "chooseBonusCard", bonusCardId: "forester" })).toBe(true);
    });

    it("si ya hay una oferta pendiente, un segundo poder resuelve solo: se queda con la primera", () => {
      const state = withBonusBird();
      const player = state.players.nico;
      player.pendingBonusChoice = ["forester", "wetlandScientist"];
      state.bonusDeck = ["prairieManager", "anatomist", "historian"];

      resolvePower(state, player, { id: "test.bonus2", timing: "onPlay", kind: "gainBonusCard", drawCount: 2, keepCount: 1 }, {
        habitat: "forest",
        slotIndex: 0,
      });

      expect(player.pendingBonusChoice).toEqual(["forester", "wetlandScientist"]);
      expect(player.bonusCards.map((b) => b.id)).toEqual(["prairieManager"]);
      expect(state.bonusDiscard).toEqual(["anatomist"]);
    });

    it("si solo queda 1 carta de bonificación no hay nada que elegir y se la queda", () => {
      const state = withBonusBird();
      state.bonusDeck = ["forester"];
      const next = applyMove(state, "nico", playBonusBird);

      expect(next.players.nico.pendingBonusChoice).toBeUndefined();
      expect(next.players.nico.bonusCards.map((b) => b.id)).toEqual(["forester"]);
    });

    it("tras la última acción de la partida se puede elegir y el conteo final la incluye", () => {
      const state = withBonusBird("online");
      state.round = 4;
      state.players.nico.actionCubesAvailable = 1;
      state.players.santi.actionCubesAvailable = 0;

      const ended = applyMove(state, "nico", playBonusBird);
      expect(ended.phase).toBe("gameEnd");
      expect(ended.players.nico.pendingBonusChoice).toEqual(["forester", "wetlandScientist"]);

      const choose: Move = { type: "chooseBonusCard", bonusCardId: "forester" };
      expect(isLegalMove(ended, "nico", choose)).toBe(true);
      const final = applyMove(ended, "nico", choose);
      expect(final.players.nico.bonusCards.map((b) => b.id)).toEqual(["forester"]);
      expect(final.players.nico.pendingBonusChoice).toBeUndefined();
    });

    it("respeta la elección del jugador sobre cuál carta de bonificación conservar", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.hand = ["acornJay"];
      state.players.nico.resources = { seed: 1, fruit: 1 };
      // El setup reparte 2 cartas de bonificación al azar y ya se resolvió 1 elección (createTestState);
      // los limpiamos para que las aserciones de abajo no dependan de esa asignación aleatoria.
      state.players.nico.bonusCards = [];
      state.bonusDiscard = [];
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [
          { id: "test.bonus", timing: "onPlay", kind: "gainBonusCard", drawCount: 2, keepCount: 1 },
        ],
      };
      state.bonusDeck = ["forester", "wetlandScientist", "visionaryLeader"];

      const move: Move = {
        type: "playBird",
        cardId: "acornJay",
        habitat: "forest",
        slotIndex: 0,
        paidResources: ["seed", "fruit"],
        paidEggsFrom: [],
        powerCardChoices: { "test.bonus": "wetlandScientist" },
      };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.bonusCards.map((b) => b.id)).toContain("wetlandScientist");
      expect(next.players.nico.bonusCards.map((b) => b.id)).not.toContain("forester");
      expect(next.bonusDiscard).toEqual(["forester"]);
    });
  });

  describe("poder layEgg: objetivos reales (any / nestType / eachNestType / allPlayersNestType)", () => {
    it("target 'nestType' (rosa) filtra por tipo de nido real y excluye a la propia carta", () => {
      const state = createTestState({ mode: "online", playerIds: ["nico", "santi"] });
      state.players.santi.board.grassland[0].cardId = "meadowSparrow"; // nido "bowl"
      state.players.santi.board.grassland[1].cardId = "barnOwl"; // nido "cavity"
      state.players.santi.board.grassland[2].cardId = "cliffSwallow"; // nido "bowl"; será el poder rosa
      state.cards.cliffSwallow.powers = [
        {
          id: "test.pinkNest",
          timing: "onceBetweenTurns",
          kind: "layEgg",
          amount: 1,
          target: "nestType",
          nestType: "cavity",
        },
      ];
      state.players.nico.board.grassland[0].cardId = "meadowSparrow";

      const move: Move = { type: "layEggs", eggPlacements: [{ habitat: "grassland", slotIndex: 0 }] };
      const next = applyMove(state, "nico", move);

      expect(next.players.santi.board.grassland[1].eggs).toBe(1); // barnOwl (cavity)
      expect(next.players.santi.board.grassland[0].eggs).toBe(0); // meadowSparrow (cup) no califica
    });

    it("target 'any' respeta la elección del jugador de a qué ave apuntar", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.players.nico.board.grassland[0].cardId = "meadowSparrow";
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [{ id: "test.any", timing: "onActivate", kind: "layEgg", amount: 1, target: "any" }],
      };
      state.feeder = ["seed", "fruit", "insect"];

      const move: Move = {
        type: "gainFood",
        dieIndexes: [0],
        powerEggChoices: { "test.any": { habitat: "grassland", slotIndex: 0 } },
      };
      const next = applyMove(state, "nico", move);
      expect(next.players.nico.board.grassland[0].eggs).toBe(1);
      expect(next.players.nico.board.forest[0].eggs).toBe(0);
    });

    it("target 'any' sin elección cae al primer espacio disponible (comportamiento previo)", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [{ id: "test.any2", timing: "onActivate", kind: "layEgg", amount: 1, target: "any" }],
      };
      state.feeder = ["seed", "fruit", "insect"];
      const move: Move = { type: "gainFood", dieIndexes: [0] };
      const next = applyMove(state, "nico", move);
      expect(next.players.nico.board.forest[0].eggs).toBe(1);
    });

    it("target 'eachNestType' pone huevos en TODAS las aves propias con ese nido", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay"; // cavity
      state.players.nico.board.forest[1].cardId = "tuftedTitmouse"; // cavity
      state.players.nico.board.forest[2].cardId = "pineGrosbeak"; // cup, no debería recibir
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [
          { id: "test.each", timing: "onActivate", kind: "layEgg", amount: 1, target: "eachNestType", nestType: "cavity" },
        ],
      };
      state.feeder = ["seed", "fruit", "insect"];
      const move: Move = { type: "gainFood", dieIndexes: [0] };
      const next = applyMove(state, "nico", move);
      expect(next.players.nico.board.forest[0].eggs).toBe(1);
      expect(next.players.nico.board.forest[1].eggs).toBe(1);
      expect(next.players.nico.board.forest[2].eggs).toBe(0);
    });

    it("target 'allPlayersNestType' pone 1 huevo base por jugador y un extra solo para el activo", () => {
      const state = createTestState({ mode: "online", playerIds: ["nico", "santi"] });
      state.players.nico.board.forest[0].cardId = "acornJay"; // cavity, jugador activo
      state.players.santi.board.forest[0].cardId = "tuftedTitmouse"; // cavity
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [
          {
            id: "test.allPlayers",
            timing: "onActivate",
            kind: "layEgg",
            amount: 1,
            target: "allPlayersNestType",
            nestType: "cavity",
            activePlayerBonus: 1,
          },
        ],
      };
      state.feeder = ["seed", "fruit", "insect"];
      const move: Move = { type: "gainFood", dieIndexes: [0] };
      const next = applyMove(state, "nico", move);
      expect(next.players.santi.board.forest[0].eggs).toBe(1);
      expect(next.players.nico.board.forest[0].eggs).toBe(2);
    });
  });

  describe("poder gainResource: gainAllMatching y resourceAlt", () => {
    it("gainAllMatching toma TODOS los dados que coincidan, no solo 1", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [
          {
            id: "test.gainAll",
            timing: "onActivate",
            kind: "gainResource",
            resource: "fish",
            amount: 1,
            from: "feeder",
            gainAllMatching: true,
          },
        ],
      };
      state.feeder = ["fish", "seed", "fish", "fruit", "fish"];
      // Evita que el rival de la IA juegue su turno después del de Nico (podría tocar el comedero
      // y volver no determinística la aserción).
      state.players.bot.actionCubesAvailable = 0;

      const move: Move = { type: "gainFood", dieIndexes: [1] }; // toma "seed", deja 3 fish + fruit
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.resources.fish).toBe(3);
      expect(next.feeder.filter((f) => f === "fish")).toHaveLength(0);
    });

    it("resourceAlt se usa cuando el recurso principal no está en el comedero", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [
          {
            id: "test.gainAlt",
            timing: "onActivate",
            kind: "gainResource",
            resource: "fish",
            resourceAlt: "insect",
            amount: 1,
            from: "feeder",
          },
        ],
      };
      state.feeder = ["insect", "seed", "fruit"]; // sin "fish"

      const move: Move = { type: "gainFood", dieIndexes: [1] };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.resources.insect).toBe(2); // 1 inicial + 1 del poder
    });
  });

  describe("poder allPlayersGain con benefitType 'card'", () => {
    it("todos los jugadores roban 1 carta del mazo", () => {
      const state = createTestState({ mode: "online", playerIds: ["nico", "santi"] });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [{ id: "test.allCard", timing: "onActivate", kind: "allPlayersGain", benefitType: "card" }],
      };
      const nicoBefore = state.players.nico.hand.length;
      const santiBefore = state.players.santi.hand.length;
      state.feeder = ["seed", "fruit", "insect"];

      const move: Move = { type: "gainFood", dieIndexes: [0] };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.hand.length).toBe(nicoBefore + 1);
      expect(next.players.santi.hand.length).toBe(santiBefore + 1);
    });
  });

  describe("poder repeatPower (repetir un poder de otra ave en el hábitat)", () => {
    it("repite el poder marrón de otra ave en el mismo hábitat", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay"; // cacheFood seed, onActivate
      state.players.nico.board.forest[1].cardId = "pineGrosbeak";
      state.cards.pineGrosbeak = {
        ...state.cards.pineGrosbeak,
        powers: [{ id: "test.repeat", timing: "onActivate", kind: "repeatPower" }],
      };
      state.feeder = ["seed", "fruit", "insect"];

      const move: Move = { type: "gainFood", dieIndexes: [0] };
      const next = applyMove(state, "nico", move);

      // acornJay se activa 2 veces: 1 por el repeatPower de pineGrosbeak (que se resuelve
      // primero, derecha a izquierda) y 1 por su propia activación normal.
      expect(next.players.nico.board.forest[0].cached).toHaveLength(2);
    });

    it("predatorOnly no repite un poder no-depredador aunque exista otro poder marrón", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay"; // cacheFood, no depredador
      state.players.nico.board.forest[1].cardId = "pineGrosbeak";
      state.cards.pineGrosbeak = {
        ...state.cards.pineGrosbeak,
        powers: [{ id: "test.repeatPredOnly", timing: "onActivate", kind: "repeatPower", predatorOnly: true }],
      };
      state.feeder = ["seed", "fruit", "insect"];

      const move: Move = { type: "gainFood", dieIndexes: [0] };
      const next = applyMove(state, "nico", move);

      // Sin ningún poder de caza disponible, repeatPower no hace nada: acornJay solo se
      // activa por su propia cuenta (1 vez), no 2.
      expect(next.players.nico.board.forest[0].cached).toHaveLength(1);
    });
  });

  describe("poder fewestBirdsBenefit (jugador(es) con menos aves)", () => {
    it("benefitType drawCard: solo el/los jugador(es) con menos aves en el hábitat indicado roban carta", () => {
      const state = createTestState({ mode: "online", playerIds: ["nico", "santi"] });
      state.players.santi.board.wetland[0].cardId = "riverHeron"; // santi tiene 1 ave en río
      // nico tiene 0 aves en río: debería ganar el beneficio
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [
          { id: "test.fewest", timing: "onActivate", kind: "fewestBirdsBenefit", habitat: "wetland", benefitType: "drawCard", amount: 1 },
        ],
      };
      const nicoBefore = state.players.nico.hand.length;
      const santiBefore = state.players.santi.hand.length;
      state.feeder = ["seed", "fruit", "insect"];

      const move: Move = { type: "gainFood", dieIndexes: [0] };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.hand.length).toBe(nicoBefore + 1);
      expect(next.players.santi.hand.length).toBe(santiBefore); // no tiene menos aves, no gana
    });

    it("benefitType gainDieFromFeeder: el/los jugador(es) con menos aves ganan 1 dado del comedero", () => {
      const state = createTestState({ mode: "online", playerIds: ["nico", "santi"] });
      state.players.santi.board.forest[0].cardId = "acornJay";
      // nico tiene 0 aves en bosque: gana el dado
      state.players.nico.board.grassland[0].cardId = "meadowSparrow";
      state.cards.meadowSparrow = {
        ...state.cards.meadowSparrow,
        powers: [
          { id: "test.fewestDie", timing: "onActivate", kind: "fewestBirdsBenefit", habitat: "forest", benefitType: "gainDieFromFeeder" },
        ],
      };
      state.players.nico.resources = {};
      state.feeder = ["seed", "fruit", "insect", "fish", "rodent"];

      const move: Move = { type: "layEggs", eggPlacements: [{ habitat: "grassland", slotIndex: 0 }] };
      const next = applyMove(state, "nico", move);

      const totalNicoResources = Object.values(next.players.nico.resources).reduce((a, b) => a + (b ?? 0), 0);
      expect(totalNicoResources).toBe(1);
    });
  });

  describe("poder allPlayersGainDie", () => {
    it("cada jugador toma 1 dado del comedero", () => {
      const state = createTestState({ mode: "online", playerIds: ["nico", "santi"] });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [{ id: "test.allDie", timing: "onActivate", kind: "allPlayersGainDie" }],
      };
      state.players.nico.resources = {};
      state.players.santi.resources = {};
      state.feeder = ["seed", "fruit", "insect", "fish", "rodent"];

      const move: Move = { type: "gainFood", dieIndexes: [0] };
      const next = applyMove(state, "nico", move);

      const totalNico = Object.values(next.players.nico.resources).reduce((a, b) => a + (b ?? 0), 0);
      const totalSanti = Object.values(next.players.santi.resources).reduce((a, b) => a + (b ?? 0), 0);
      // nico ya tomó 1 seed del dado elegido (dieIndexes:[0]); el poder le suma 1 más + 1 a santi.
      expect(totalNico).toBe(2);
      expect(totalSanti).toBe(1);
    });
  });

  describe("poder tuckCard: costo en comida, ganar recurso extra y filtro rosa por hábitat", () => {
    it("solapa varias cartas del mazo pagando el costo en comida indicado", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.wetland[0].cardId = "kelpGull";
      state.players.nico.resources = { fish: 1 };
      state.cards.kelpGull = {
        ...state.cards.kelpGull,
        powers: [
          {
            id: "test.tuckCost",
            timing: "onActivate",
            kind: "tuckCard",
            amount: 2,
            source: "deck",
            costResource: "fish",
            costAmount: 1,
          },
        ],
      };
      state.players.nico.hand = [];

      const move: Move = { type: "drawBirdCards", draws: [{ source: "deck" }] };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.resources.fish).toBe(0);
      expect(next.players.nico.board.wetland[0].tucked).toHaveLength(2);
    });

    it("no solapa nada si no alcanza el recurso para pagar el costo", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.wetland[0].cardId = "kelpGull";
      state.players.nico.resources = {};
      state.cards.kelpGull = {
        ...state.cards.kelpGull,
        powers: [
          {
            id: "test.tuckCostFail",
            timing: "onActivate",
            kind: "tuckCard",
            amount: 2,
            source: "deck",
            costResource: "fish",
            costAmount: 1,
          },
        ],
      };
      state.players.nico.hand = [];

      const move: Move = { type: "drawBirdCards", draws: [{ source: "deck" }] };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.board.wetland[0].tucked).toHaveLength(0);
    });

    it("thenGainResource otorga 1 recurso de la reserva al solapar con éxito", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.wetland[0].cardId = "kelpGull";
      state.players.nico.hand = ["mallard"];
      state.cards.kelpGull = {
        ...state.cards.kelpGull,
        powers: [
          {
            id: "test.tuckGain",
            timing: "onActivate",
            kind: "tuckCard",
            amount: 1,
            source: "hand",
            thenGainResource: "fruit",
          },
        ],
      };

      // La acción "robar cartas" agrega 1 carta más a la mano antes de activar el poder;
      // elegimos explícitamente "mallard" para no depender de qué carta cayó del mazo.
      const move: Move = {
        type: "drawBirdCards",
        draws: [{ source: "deck" }],
        powerCardChoices: { "test.tuckGain": "mallard" },
      };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.board.wetland[0].tucked).toContain("mallard");
      expect(next.players.nico.resources.fruit).toBe(2); // 1 inicial + 1 del poder
    });

    it("el poder rosa de tuckCard con hábitat solo se activa cuando el ave jugada es de ese hábitat", () => {
      const state = createTestState({ mode: "online", playerIds: ["nico", "santi"] });
      state.players.santi.board.grassland[0].cardId = "cliffSwallow";
      state.cards.cliffSwallow.powers = [
        {
          id: "test.pinkTuckHabitat",
          timing: "onceBetweenTurns",
          kind: "tuckCard",
          amount: 1,
          source: "hand",
          habitat: "grassland",
        },
      ];
      state.players.santi.hand = ["mallard"];
      state.players.nico.hand = ["riverHeron"]; // wetland, no grassland
      state.players.nico.resources = { fish: 1, insect: 1 };

      const move: Move = {
        type: "playBird",
        cardId: "riverHeron",
        habitat: "wetland",
        slotIndex: 0,
        paidResources: ["fish", "insect"],
        paidEggsFrom: [],
      };
      const next = applyMove(state, "nico", move);

      // Santi's pink power should NOT trigger: nico played a wetland bird, not grassland
      expect(next.players.santi.board.grassland[0].tucked).toHaveLength(0);
      expect(next.players.santi.hand).toContain("mallard");
    });
  });

  describe("poder moveToHabitat (mover ave entre hábitats)", () => {
    it("mueve el ave a otro hábitat cuando está en la columna más a la derecha, y los huevos viajan con ella", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "americanRobin"; // forest + grassland
      state.players.nico.board.forest[0].eggs = 1;
      state.cards.americanRobin = {
        ...state.cards.americanRobin,
        powers: [{ id: "test.move", timing: "onActivate", kind: "moveToHabitat" }],
      };
      state.feeder = ["seed", "fruit", "insect"];

      const move: Move = { type: "gainFood", dieIndexes: [0] };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.board.forest[0].cardId).toBeNull();
      expect(next.players.nico.board.grassland[0].cardId).toBe("americanRobin");
      expect(next.players.nico.board.grassland[0].eggs).toBe(1);
    });

    it("no mueve el ave si NO está en la columna más a la derecha ocupada de su hábitat", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "americanRobin";
      state.players.nico.board.forest[1].cardId = "acornJay"; // ocupa la columna siguiente
      state.cards.americanRobin = {
        ...state.cards.americanRobin,
        powers: [{ id: "test.move2", timing: "onActivate", kind: "moveToHabitat" }],
      };
      state.feeder = ["seed", "fruit", "insect"];

      const move: Move = { type: "gainFood", dieIndexes: [0] };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.board.forest[0].cardId).toBe("americanRobin");
      expect(next.players.nico.board.grassland[0].cardId).toBeNull();
    });

    it("respeta la elección del jugador de hábitat de destino cuando hay más de una opción", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "rubyThroatedHummingbird"; // forest+grassland+wetland
      state.cards.rubyThroatedHummingbird = {
        ...state.cards.rubyThroatedHummingbird,
        powers: [{ id: "test.move3", timing: "onActivate", kind: "moveToHabitat" }],
      };
      state.feeder = ["seed", "fruit", "insect"];

      const move: Move = {
        type: "gainFood",
        dieIndexes: [0],
        powerMoveChoices: { "test.move3": "wetland" },
      };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.board.wetland[0].cardId).toBe("rubyThroatedHummingbird");
      expect(next.players.nico.board.grassland[0].cardId).toBeNull();
    });
  });

  describe("poderes con costo en huevo (gainResource/drawCard costsEgg)", () => {
    it("gainResource con costsEgg descuenta 1 huevo de OTRA ave (costEggExcludesSelf) y otorga el recurso", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.players.nico.board.forest[1].cardId = "tuftedTitmouse";
      state.players.nico.board.forest[1].eggs = 1;
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [
          {
            id: "test.eggCost",
            timing: "onActivate",
            kind: "gainResource",
            resource: "seed",
            amount: 1,
            costsEgg: true,
            costEggExcludesSelf: true,
          },
        ],
      };
      state.feeder = ["seed", "fruit", "insect"];

      const move: Move = { type: "gainFood", dieIndexes: [0] };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.board.forest[1].eggs).toBe(0);
      expect(next.players.nico.resources.seed).toBe(3); // 1 inicial + 1 del dado + 1 del poder
    });

    it("gainResource con costsEgg no hace nada si no hay ningún huevo disponible para pagarlo", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [
          { id: "test.eggCostFail", timing: "onActivate", kind: "gainResource", resource: "fruit", amount: 5, costsEgg: true },
        ],
      };
      state.feeder = ["seed", "fruit", "insect"];

      const move: Move = { type: "gainFood", dieIndexes: [0] };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.resources.fruit).toBe(1); // sin cambios: el poder no se pudo pagar
    });

    it("drawCard con costsEgg descuenta 1 huevo antes de robar", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.hand = [];
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.players.nico.board.forest[0].eggs = 1;
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [{ id: "test.drawEggCost", timing: "onActivate", kind: "drawCard", amount: 2, costsEgg: true }],
      };
      state.feeder = ["seed", "fruit", "insect"];

      const move: Move = { type: "gainFood", dieIndexes: [0] };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.board.forest[0].eggs).toBe(0);
      expect(next.players.nico.hand.length).toBe(2);
    });
  });

  describe("poder diceHuntPredator (caza por dados)", () => {
    it("falla automáticamente si el comedero está lleno (no hay dados fuera para relanzar)", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.grassland[0].cardId = "acornJay";
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [{ id: "test.dice", timing: "onActivate", kind: "diceHuntPredator", resource: "rodent" }],
      };
      state.feeder = ["seed", "fruit", "insect", "fish", "rodent"]; // 5 = comedero lleno

      const move: Move = {
        type: "layEggs",
        eggPlacements: [{ habitat: "grassland", slotIndex: 0 }],
      };
      const next = applyMove(state, "nico", move);
      expect(next.players.nico.board.grassland[0].cached).toHaveLength(0);
    });

    it("cachea el recurso cuando el relanzamiento de los dados fuera del comedero coincide", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.grassland[0].cardId = "acornJay";
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [{ id: "test.dice", timing: "onActivate", kind: "diceHuntPredator", resource: "rodent" }],
      };
      state.feeder = ["seed"]; // 1 en el comedero → 4 dados "fuera" para relanzar

      // standardDieFaces = [seed, fruit, insect, fish, rodent, wild]; floor(0.7*6) = 4 -> "rodent"
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.7);
      const move: Move = {
        type: "layEggs",
        eggPlacements: [{ habitat: "grassland", slotIndex: 0 }],
      };
      const next = applyMove(state, "nico", move);
      randomSpy.mockRestore();

      expect(next.players.nico.board.grassland[0].cached).toContain("rodent");
      // El poder cachea directamente (como cacheFood): no se suma a la reserva general.
      expect(next.players.nico.resources.rodent ?? 0).toBe(0);
    });
  });

  describe("poder playSecondBird (jugar una segunda ave)", () => {
    it("juega una segunda ave del mismo jugador como parte de resolver el poder", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.hand = ["orchardFinch", "meadowSparrow"];
      state.players.nico.resources = { seed: 2, fruit: 1 };
      state.cards.orchardFinch = {
        ...state.cards.orchardFinch,
        powers: [
          ...state.cards.orchardFinch.powers,
          { id: "test.secondBird", timing: "onPlay", kind: "playSecondBird", habitats: ["grassland"] },
        ],
      };

      const move: Move = {
        // orchardFinch se juega en bosque para dejar la pradera vacía: así la segunda ave
        // (meadowSparrow) cae en la columna 1 de pradera, sin costo en huevos.
        type: "playBird",
        cardId: "orchardFinch",
        habitat: "forest",
        slotIndex: 0,
        paidResources: ["fruit"],
        paidEggsFrom: [],
        powerPlayBirdChoices: {
          "test.secondBird": {
            cardId: "meadowSparrow",
            habitat: "grassland",
            paidResources: ["seed"],
            paidEggsFrom: [],
          },
        },
      };

      const next = applyMove(state, "nico", move);
      expect(next.players.nico.board.forest[0].cardId).toBe("orchardFinch");
      expect(next.players.nico.board.grassland[0].cardId).toBe("meadowSparrow");
      expect(next.players.nico.hand).toHaveLength(0);
    });

    it("no rompe el movimiento si la elección de segunda ave es inválida (no alcanza a pagarla)", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.hand = ["orchardFinch", "meadowSparrow"];
      state.players.nico.resources = { fruit: 1 }; // no tiene semilla para meadowSparrow
      state.cards.orchardFinch = {
        ...state.cards.orchardFinch,
        powers: [
          ...state.cards.orchardFinch.powers,
          { id: "test.secondBird", timing: "onPlay", kind: "playSecondBird", habitats: ["grassland"] },
        ],
      };

      const move: Move = {
        type: "playBird",
        cardId: "orchardFinch",
        habitat: "grassland",
        slotIndex: 0,
        paidResources: ["fruit"],
        paidEggsFrom: [],
        powerPlayBirdChoices: {
          "test.secondBird": {
            cardId: "meadowSparrow",
            habitat: "grassland",
            paidResources: [],
            paidEggsFrom: [],
          },
        },
      };

      const next = applyMove(state, "nico", move);
      expect(next.players.nico.board.grassland[0].cardId).toBe("orchardFinch");
      expect(next.players.nico.board.grassland[1].cardId).toBeNull();
      expect(next.players.nico.hand).toContain("meadowSparrow");
    });
  });

  describe("cartas de bonificación: nuevos conditionType y scoringMode", () => {
    it("scoringMode 'perBird' puntúa linealmente sin techo de umbrales", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.players.nico.board.forest[1].cardId = "pineGrosbeak";
      state.players.nico.board.forest[2].cardId = "tuftedTitmouse";
      const bonus: BonusCard = {
        id: "test.perBird",
        name: "Test PerBird",
        description: "",
        conditionType: "birdsInHabitat",
        habitat: "forest",
        scoringMode: "perBird",
        pointsPerBird: 2,
      };
      expect(calculateBonusPoints(state.players.nico, state, bonus)).toBe(6); // 3 aves × 2
    });

    it("onlyHabitat exige aves ESPECIALISTAS (viven solo en ese hábitat), no multi-hábitat", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay"; // vive solo en bosque
      state.players.nico.board.forest[1].cardId = "americanRobin"; // bosque + pradera

      const exclusiveHighThreshold: BonusCard = {
        id: "test.only",
        name: "",
        description: "",
        conditionType: "birdsInHabitat",
        habitat: "forest",
        onlyHabitat: true,
        tiers: [{ threshold: 2, points: 9 }],
      };
      // Solo acornJay es especialista: nunca llega al umbral de 2.
      expect(calculateBonusPoints(state.players.nico, state, exclusiveHighThreshold)).toBe(0);

      const inclusive: BonusCard = { ...exclusiveHighThreshold, onlyHabitat: false };
      // Sin la exigencia, ambas aves cuentan y sí llega al umbral de 2.
      expect(calculateBonusPoints(state.players.nico, state, inclusive)).toBe(9);
    });

    it("birdsWithMinEggs cuenta AVES con al menos N huevos (no la suma total de huevos)", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.players.nico.board.forest[0].eggs = 2; // no llega a 4
      state.players.nico.board.forest[1].cardId = "pineGrosbeak";
      state.players.nico.board.forest[1].eggs = 1; // sí llega a ≥1

      const min4: BonusCard = {
        id: "test.min4",
        name: "",
        description: "",
        conditionType: "birdsWithMinEggs",
        minEggs: 4,
        scoringMode: "perBird",
        pointsPerBird: 1,
      };
      expect(calculateBonusPoints(state.players.nico, state, min4)).toBe(0);

      const min1: BonusCard = { ...min4, minEggs: 1 };
      expect(calculateBonusPoints(state.players.nico, state, min1)).toBe(2); // 2 aves × 1
    });

    it("birdsWithPoints filtra por puntos de victoria impresos en la carta", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay"; // 4 pts
      state.players.nico.board.forest[1].cardId = "tuftedTitmouse"; // 2 pts

      const bonus: BonusCard = {
        id: "test.points",
        name: "",
        description: "",
        conditionType: "birdsWithPoints",
        maxPoints: 3,
        scoringMode: "perBird",
        pointsPerBird: 3,
      };
      expect(calculateBonusPoints(state.players.nico, state, bonus)).toBe(3); // solo tuftedTitmouse
    });

    it("birdsWithWingspan (antes sin implementar: siempre puntuaba 0) filtra por envergadura", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay"; // 35cm
      state.players.nico.board.wetland[0].cardId = "riverHeron"; // 100cm

      const bonus: BonusCard = {
        id: "test.wingspan",
        name: "",
        description: "",
        conditionType: "birdsWithWingspan",
        maxWingspanCm: 50,
        scoringMode: "perBird",
        pointsPerBird: 2,
      };
      expect(calculateBonusPoints(state.players.nico, state, bonus)).toBe(2); // solo acornJay
    });

    it("birdsWithNameTag cuenta aves taggeadas con la categoría de nombre indicada", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.cards.acornJay = { ...state.cards.acornJay, nameTags: ["color"] };
      state.players.nico.board.forest[1].cardId = "pineGrosbeak"; // sin tag

      const bonus: BonusCard = {
        id: "test.nameTag",
        name: "",
        description: "",
        conditionType: "birdsWithNameTag",
        nameTag: "color",
        scoringMode: "perBird",
        pointsPerBird: 3,
      };
      expect(calculateBonusPoints(state.players.nico, state, bonus)).toBe(3);
    });

    it("birdsWithPowerKind cuenta aves con un poder de cierto tipo (ej. depredador)", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "redTailedHawk"; // huntPredator
      state.players.nico.board.forest[1].cardId = "acornJay"; // cacheFood, no depredador

      const bonus: BonusCard = {
        id: "test.predator",
        name: "",
        description: "",
        conditionType: "birdsWithPowerKind",
        powerKinds: ["huntPredator", "diceHuntPredator"],
        scoringMode: "perBird",
        pointsPerBird: 2,
      };
      expect(calculateBonusPoints(state.players.nico, state, bonus)).toBe(2);
    });

    it("birdsInFewestOwnHabitat puntúa el hábitat propio con menos aves jugadas", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.players.nico.board.forest[1].cardId = "pineGrosbeak"; // bosque: 2 aves
      state.players.nico.board.grassland[0].cardId = "meadowSparrow"; // pradera: 1 ave (la menor)
      state.players.nico.board.wetland[0].cardId = "riverHeron";
      state.players.nico.board.wetland[1].cardId = "kelpGull";
      state.players.nico.board.wetland[2].cardId = "mallard"; // río: 3 aves

      const bonus: BonusCard = {
        id: "test.fewest",
        name: "",
        description: "",
        conditionType: "birdsInFewestOwnHabitat",
        scoringMode: "perBird",
        pointsPerBird: 2,
      };
      expect(calculateBonusPoints(state.players.nico, state, bonus)).toBe(2); // pradera: 1 ave × 2
    });

    it("cardsInHand puntúa según cartas restantes en la mano, no en el tablero", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.hand = ["acornJay", "pineGrosbeak", "tuftedTitmouse"];

      const bonus: BonusCard = {
        id: "test.hand",
        name: "",
        description: "",
        conditionType: "cardsInHand",
        tiers: [
          { threshold: 2, points: 4 },
          { threshold: 3, points: 7 },
        ],
      };
      expect(calculateBonusPoints(state.players.nico, state, bonus)).toBe(7);
    });
  });

  describe("cartas de bonificación reales (bonusCardsCatalog: las 20 del juego base)", () => {
    // Usa createInitialState directo (no createTestState): estos tests validan el catálogo real
    // tal cual, y varios ids reales (redTailedHawk, tuftedTitmouse, etc.) están sobreescritos por
    // TEST_CARDS en createTestState, así que se evitan esos ids acá.
    it("largeBirdSpecialist (minWingspanCm) puntúa aves reales con envergadura > 65cm", () => {
      const state = createInitialState({ mode: "solo" });
      state.players.nico.board.wetland[0].cardId = "baldEagle"; // 203cm
      state.players.nico.board.wetland[1].cardId = "osprey"; // 160cm
      state.players.nico.board.forest[0].cardId = "greatHornedOwl"; // 112cm
      state.players.nico.board.forest[1].cardId = "redShoulderedHawk"; // 102cm
      state.players.nico.board.forest[2].cardId = "acornWoodpecker"; // 46cm, no califica

      const bonus = state.bonusCardsCatalog!.largeBirdSpecialist;
      expect(bonus).toBeDefined();
      // 4 aves ≥66cm alcanzan el primer umbral (4 aves → 3 pts); acornWoodpecker no suma.
      expect(calculateBonusPoints(state.players.nico, state, bonus)).toBe(3);
    });

    it("forester (onlyHabitat) puntúa solo aves reales que viven EXCLUSIVAMENTE en bosque", () => {
      const state = createInitialState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornWoodpecker"; // solo bosque
      state.players.nico.board.forest[1].cardId = "downyWoodpecker"; // solo bosque
      state.players.nico.board.forest[2].cardId = "redBelliedWoodpecker"; // solo bosque
      state.players.nico.board.forest[3].cardId = "americanCrow"; // bosque+pradera+humedal, no califica

      const bonus = state.bonusCardsCatalog!.forester;
      expect(calculateBonusPoints(state.players.nico, state, bonus)).toBe(4); // 3 especialistas → primer umbral
    });

    it("anatomist (nameTag bodyPart) puntúa aves reales con parte del cuerpo en el nombre", () => {
      const state = createInitialState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "redShoulderedHawk"; // "Shouldered"
      state.players.nico.board.forest[1].cardId = "greatHornedOwl"; // "Horned"
      state.players.nico.board.forest[2].cardId = "acornWoodpecker"; // sin tag

      const bonus = state.bonusCardsCatalog!.anatomist;
      expect(calculateBonusPoints(state.players.nico, state, bonus)).toBe(3); // 2 aves → primer umbral
    });

    it("falconer (birdsWithPowerKind) puntúa por ave depredadora usando el catálogo real", () => {
      const state = createInitialState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "redShoulderedHawk"; // huntPredator
      state.players.nico.board.forest[1].cardId = "greatHornedOwl"; // huntPredator
      state.players.nico.board.forest[2].cardId = "acornWoodpecker"; // no depredador

      const bonus = state.bonusCardsCatalog!.falconer;
      expect(calculateBonusPoints(state.players.nico, state, bonus)).toBe(4); // 2 aves × 2 pts
    });
  });

  describe("preparación inicial (fase setup)", () => {
    const FOODS = ["seed", "fruit", "insect", "fish", "rodent"] as const;
    const start = (state: GameState, id: string, keep: number, bonusIndex = 0): Move => ({
      type: "chooseStart",
      keepCards: state.players[id].hand.slice(0, keep),
      discardFood: FOODS.slice(0, keep) as (typeof FOODS)[number][],
      bonusCardId: state.players[id].pendingBonusChoice![bonusIndex],
    });

    it("reparte 5 aves, 5 fichas de alimento (1 de cada tipo) y 2 bonificaciones a cada jugador", () => {
      const state = createInitialState(["nico", "santi"]);

      expect(state.phase).toBe("setup");
      for (const id of ["nico", "santi"]) {
        const player = state.players[id];
        expect(player.hand).toHaveLength(5);
        expect(player.resources).toEqual({ seed: 1, fruit: 1, insect: 1, fish: 1, rodent: 1 });
        expect(player.pendingBonusChoice).toHaveLength(2);
        expect(player.pendingStartingHand).toBe(true);
        expect(player.bonusCards).toHaveLength(0);
      }
      // El mercado son 3 aves boca arriba y el comedero 5 dados.
      expect(state.market).toHaveLength(3);
      expect(state.feeder).toHaveLength(5);
    });

    it("nadie puede jugar acciones mientras la fase siga en 'setup'", () => {
      const state = createInitialState({ mode: "solo" });
      expect(isLegalMove(state, "nico", { type: "gainFood", dieIndexes: [0] })).toBe(false);
    });

    it("chooseStart conserva las aves elegidas, descarta las demás, gasta 1 alimento por ave y guarda la bonificación", () => {
      const state = createInitialState(["nico", "santi"]);
      const [keepA, keepB, ...dropped] = state.players.nico.hand;
      const [chosenBonus, otherBonus] = state.players.nico.pendingBonusChoice!;

      const next = applyPlayerMove(state, "nico", {
        type: "chooseStart",
        keepCards: [keepA, keepB],
        discardFood: ["fish", "rodent"],
        bonusCardId: chosenBonus,
      });

      expect(next.players.nico.hand).toEqual([keepA, keepB]);
      expect(next.discard).toEqual(expect.arrayContaining(dropped));
      expect(next.players.nico.resources).toEqual({ seed: 1, fruit: 1, insect: 1, fish: 0, rodent: 0 });
      expect(next.players.nico.bonusCards.map((b) => b.id)).toEqual([chosenBonus]);
      expect(next.bonusDiscard).toContain(otherBonus);
      expect(next.players.nico.pendingBonusChoice).toBeUndefined();
      expect(next.players.nico.pendingStartingHand).toBeUndefined();
    });

    it("conservar las 5 aves cuesta todo el alimento y conservar 0 no cuesta nada", () => {
      const state = createInitialState(["nico", "santi"]);
      const all = applyPlayerMove(state, "nico", start(state, "nico", 5));
      expect(all.players.nico.hand).toHaveLength(5);
      expect(Object.values(all.players.nico.resources).every((n) => n === 0)).toBe(true);

      const none = applyPlayerMove(state, "santi", start(state, "santi", 0));
      expect(none.players.santi.hand).toHaveLength(0);
      expect(none.players.santi.resources).toEqual({ seed: 1, fruit: 1, insect: 1, fish: 1, rodent: 1 });
    });

    it("es ilegal descartar distinta cantidad de alimento que aves conservadas, o alimento repetido o inexistente", () => {
      const state = createInitialState(["nico", "santi"]);
      const hand = state.players.nico.hand;
      const bonusCardId = state.players.nico.pendingBonusChoice![0];
      const legal = (keepCards: string[], discardFood: string[]) =>
        isLegalMove(state, "nico", { type: "chooseStart", keepCards, discardFood, bonusCardId } as Move);

      expect(legal([hand[0], hand[1]], ["fish", "rodent"])).toBe(true);
      expect(legal([hand[0], hand[1]], ["fish"])).toBe(false); // falta 1 alimento por descartar
      expect(legal([hand[0]], ["fish", "rodent"])).toBe(false); // sobra alimento
      expect(legal([hand[0], hand[1]], ["fish", "fish"])).toBe(false); // repetido
      expect(legal([hand[0]], ["wild"])).toBe(false); // no es un alimento
    });

    it("es ilegal conservar aves que no se tienen o repetidas, o una bonificación que no se ofreció", () => {
      const state = createInitialState(["nico", "santi"]);
      const hand = state.players.nico.hand;
      const bonusCardId = state.players.nico.pendingBonusChoice![0];
      const legal = (keepCards: string[], bonus = bonusCardId) =>
        isLegalMove(state, "nico", { type: "chooseStart", keepCards, discardFood: ["fish", "rodent"].slice(0, keepCards.length), bonusCardId: bonus } as Move);

      expect(legal([hand[0]])).toBe(true);
      expect(legal(["noEsMia"])).toBe(false);
      expect(legal([hand[0], hand[0]])).toBe(false);
      expect(legal([hand[0]], "no-ofrecida")).toBe(false);
      // La mano del rival no vale.
      expect(legal([state.players.santi.hand[0]])).toBe(false);
    });

    it("la partida arranca cuando TODOS terminaron la preparación, sin depender del turno", () => {
      const state = createInitialState({ mode: "online", playerIds: ["nico", "santi"] });
      expect(state.currentPlayerId).toBe("nico");

      // Santi puede terminar antes aunque el turno sea de nico: la preparación es simultánea.
      const afterSanti = applyPlayerMove(state, "santi", start(state, "santi", 2));
      expect(afterSanti.phase).toBe("setup");

      const afterNico = applyPlayerMove(afterSanti, "nico", start(afterSanti, "nico", 3));
      expect(afterNico.phase).toBe("round");
      expect(afterNico.log[afterNico.log.length - 1].message).toContain("Comienza la Ronda 1");
    });

    it("no se puede repetir la preparación ni usar chooseBonusCard durante ella", () => {
      const state = createInitialState(["nico", "santi"]);
      const offered = state.players.nico.pendingBonusChoice![0];
      expect(isLegalMove(state, "nico", { type: "chooseBonusCard", bonusCardId: offered })).toBe(false);

      const done = applyPlayerMove(state, "nico", start(state, "nico", 1));
      expect(isLegalMove(done, "nico", start(state, "nico", 1))).toBe(false);
    });

    it("puede empezar cualquiera de los jugadores", () => {
      const state = createInitialState({ mode: "online", playerIds: ["nico", "santi"], firstPlayerId: "santi" });
      expect(state.firstPlayerId).toBe("santi");
      expect(state.currentPlayerId).toBe("santi");
    });

    it("en solitario, cuando el humano termina la preparación el rival de la IA hace la suya y arranca la partida", () => {
      const state = createInitialState({ mode: "solo", botDifficulty: "hard" });
      expect(state.players.bot.pendingStartingHand).toBe(true);

      const next = applyMoveWithBots(state, "nico", start(state, "nico", 2));

      expect(next.players.bot.pendingStartingHand).toBeUndefined();
      expect(next.players.bot.pendingBonusChoice).toBeUndefined();
      expect(next.players.bot.bonusCards).toHaveLength(1);
      expect(next.phase).toBe("round");
    });

    it("si el rival de la IA empieza, juega su primer turno en cuanto termina la preparación", () => {
      const state = createInitialState({ mode: "solo", botDifficulty: "normal", firstPlayerId: "bot" });
      const next = applyMoveWithBots(state, "nico", start(state, "nico", 2));

      expect(next.phase).toBe("round");
      expect(next.players.bot.actionCubesAvailable).toBe(7);
      expect(next.currentPlayerId).toBe("nico");
    });
  });

  describe("desempate y ganador", () => {
    const withScores = (nicoEggs: number, santiEggs: number, nicoFood: number, santiFood: number) => {
      const state = createTestState({ mode: "online", playerIds: ["nico", "santi"] });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.players.nico.board.forest[0].eggs = nicoEggs;
      state.players.santi.board.forest[0].cardId = "acornJay";
      state.players.santi.board.forest[0].eggs = santiEggs;
      state.players.nico.resources = { seed: nicoFood };
      state.players.santi.resources = { seed: santiFood };
      return state;
    };

    it("gana quien tiene más puntos", () => {
      const ranking = rankPlayers(withScores(3, 1, 0, 5));
      expect(ranking.winnerIds).toEqual(["nico"]);
      expect(ranking.decidedByFood).toBe(false);
      expect(ranking.standings.map((s) => s.playerId)).toEqual(["nico", "santi"]);
    });

    it("con los mismos puntos gana quien tiene más alimento sin usar", () => {
      const ranking = rankPlayers(withScores(2, 2, 1, 4));
      expect(ranking.winnerIds).toEqual(["santi"]);
      expect(ranking.decidedByFood).toBe(true);
      expect(ranking.standings[0]).toMatchObject({ playerId: "santi", unusedFood: 4 });
    });

    it("con los mismos puntos y el mismo alimento es empate", () => {
      const ranking = rankPlayers(withScores(2, 2, 3, 3));
      expect(ranking.winnerIds).toEqual(["nico", "santi"]);
      expect(ranking.decidedByFood).toBe(false);
    });
  });

  describe("bonificaciones dependientes del nombre (Fotógrafo/Anatomista/Cartógrafo/Historiador)", () => {
    const tagsOf = (state: ReturnType<typeof createInitialState>, id: string) => state.cards[id].nameTags ?? [];

    it("la elegibilidad viene de nameTags curados y no del nombre español mostrado", () => {
      const state = createInitialState({ mode: "solo" });
      // "Tordo Sargento" (Red-winged Blackbird) no contiene ningún color en español, pero cuenta.
      expect(state.cards.redWingedBlackbird.name).toBe("Tordo Sargento");
      expect(tagsOf(state, "redWingedBlackbird")).toEqual(expect.arrayContaining(["color", "bodyPart"]));
      // "Cardenal Rojo" (Northern Cardinal) sí dice "Rojo" en español, pero en inglés no hay color: no cuenta.
      expect(state.cards.northernCardinal.name).toBe("Cardenal Rojo");
      expect(tagsOf(state, "northernCardinal")).toEqual(["geographic"]);
      // "Chara Crestada" (Steller's Jay) es homenaje a una persona aunque el nombre español no es posesivo.
      expect(tagsOf(state, "stellersJay")).toContain("possessive");
    });

    it("cambiar el nombre mostrado no altera el puntaje de la bonificación", () => {
      const state = createInitialState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "redWingedBlackbird";
      state.players.nico.board.forest[1].cardId = "blueJay";
      const bonus = state.bonusCardsCatalog!.photographer;
      const before = calculateBonusPoints(state.players.nico, state, bonus);

      state.cards.redWingedBlackbird = { ...state.cards.redWingedBlackbird, name: "Nombre cualquiera" };
      state.cards.blueJay = { ...state.cards.blueJay, name: "Otro nombre" };
      expect(calculateBonusPoints(state.players.nico, state, bonus)).toBe(before);
      expect(before).toBe(3);
    });

    it("coincidencias de texto accidentales no crean elegibilidad de Anatomista", () => {
      const state = createInitialState({ mode: "solo" });
      // Grosbeak contiene "beak" y Burrowing contiene "wing", pero ninguno es un término anatómico.
      expect(tagsOf(state, "blueGrosbeak")).not.toContain("bodyPart");
      expect(tagsOf(state, "burrowingOwl")).not.toContain("bodyPart");
    });

    it("colores poco comunes cuentan para Fotógrafo (ash, ferruginous, lazuli, ruddy, snowy)", () => {
      const state = createInitialState({ mode: "solo" });
      for (const id of ["ashThroatedFlycatcher", "ferruginousHawk", "lazuliBunting", "ruddyDuck", "snowyEgret"]) {
        expect(tagsOf(state, id), id).toContain("color");
      }
    });

    it("Sandhill Crane cuenta para Cartógrafo y Chestnut-collared Longspur para Anatomista", () => {
      const state = createInitialState({ mode: "solo" });
      expect(tagsOf(state, "sandhillCrane")).toContain("geographic");
      expect(tagsOf(state, "chestnutCollaredLongspur")).toEqual(expect.arrayContaining(["color", "bodyPart"]));
    });

    it("Historiador cubre exactamente las 19 aves nombradas por una persona del juego base", () => {
      const state = createInitialState({ mode: "solo" });
      const historians = Object.values(state.cards)
        .filter((c) => c.nameTags?.includes("possessive"))
        .map((c) => c.id)
        .sort();
      expect(historians).toEqual(
        [
          "annasHummingbird", "bairdsSparrow", "barrowsGoldeneye", "bellsVireo", "bewicksWren",
          "brewersBlackbird", "cassinsFinch", "cassinsSparrow", "clarksGrebe", "clarksNutcracker",
          "coopersHawk", "forstersTern", "franklinsGull", "lincolnsSparrow", "saysPhoebe",
          "spraguesPipit", "stellersJay", "swainsonsHawk", "wilsonsSnipe",
        ].sort(),
      );
    });

    it("las 170 aves del catálogo tienen nameTags válidos y sin duplicados", () => {
      const state = createInitialState({ mode: "solo" });
      const valid = new Set(["bodyPart", "geographic", "color", "possessive"]);
      const birds = Object.values(state.cards).filter((c) => !c.id.startsWith("test"));
      expect(birds.length).toBeGreaterThanOrEqual(170);
      for (const bird of birds) {
        const tags = bird.nameTags ?? [];
        expect(new Set(tags).size, bird.id).toBe(tags.length);
        for (const tag of tags) expect(valid.has(tag), `${bird.id}:${tag}`).toBe(true);
      }
    });

    it("Fotógrafo, Anatomista y Cartógrafo: 2–3 aves → 3 PV, 4+ aves → 7 PV", () => {
      const cases: [string, string[]][] = [
        ["photographer", ["blueJay", "grayCatbird", "greenHeron", "indigoBunting"]],
        ["anatomist", ["redTailedHawk", "redEyedVireo", "whiteBreastedNuthatch", "blackNeckedStilt"]],
        ["cartographer", ["americanRobin", "canadaGoose", "northernFlicker", "westernTanager"]],
      ];
      for (const [bonusId, ids] of cases) {
        const state = createInitialState({ mode: "solo" });
        const bonus = state.bonusCardsCatalog![bonusId];
        const slots = state.players.nico.board.forest;
        const score = (n: number) => {
          slots.forEach((s, i) => (s.cardId = i < n ? ids[i] : null));
          return calculateBonusPoints(state.players.nico, state, bonus);
        };
        expect(score(1), `${bonusId} 1`).toBe(0);
        expect(score(2), `${bonusId} 2`).toBe(3);
        expect(score(3), `${bonusId} 3`).toBe(3);
        expect(score(4), `${bonusId} 4`).toBe(7);
      }
    });

    it("Historiador puntúa 2 PV por ave sin techo", () => {
      const state = createInitialState({ mode: "solo" });
      const slots = state.players.nico.board.forest;
      ["stellersJay", "coopersHawk", "saysPhoebe"].forEach((id, i) => (slots[i].cardId = id));
      slots[3].cardId = "acornWoodpecker"; // no es homenaje a una persona
      expect(calculateBonusPoints(state.players.nico, state, state.bonusCardsCatalog!.historian)).toBe(6);
    });
  });

  describe("regresiones halladas por la simulación de partidas", () => {
    it("un poder que toma el último dado del comedero lo relanza de inmediato", () => {
      const state = createTestState({ mode: "online", playerIds: ["nico", "santi"] });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [{ id: "test.allDie", timing: "onActivate", kind: "allPlayersGainDie" }],
      };
      // nico toma 1 dado, y luego el poder le da 1 a nico y 1 a santi: el comedero se vacía.
      state.feeder = ["seed", "fruit", "insect"];

      const next = applyMove(state, "nico", { type: "gainFood", dieIndexes: [0] });

      expect(next.feeder).toHaveLength(5);
    });

    it("al cerrar la ronda el mercado se repone reciclando el descarte si el mazo se agotó", () => {
      const state = createTestState({ mode: "online", playerIds: ["nico", "santi"] });
      state.deck = [];
      state.discard = ["meadowSparrow", "riverHeron"];
      state.market = ["orchardFinch", "marshWren", "cliffSwallow"];

      resolveRoundEnd(state);

      expect(state.market).toHaveLength(3);
      const allCards = [...state.market, ...state.deck, ...state.discard];
      expect(new Set(allCards).size).toBe(5);
    });

    it("se puede robar del mazo si está vacío pero hay descarte para barajar", () => {
      const state = createTestState({ mode: "solo" });
      state.deck = [];
      state.discard = ["meadowSparrow"];
      state.market = [];
      state.players.nico.hand = [];

      const move: Move = { type: "drawBirdCards", draws: [{ source: "deck" }] };
      expect(isLegalMove(state, "nico", move)).toBe(true);

      const next = applyMove(state, "nico", move);
      expect(next.players.nico.hand).toEqual(["meadowSparrow"]);
    });

    it("el Chivirín Saltapared real permite jugar una segunda ave al jugarlo", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.hand = ["houseWren", "meadowSparrow"];
      state.players.nico.resources = { insect: 1, seed: 1 };

      const next = applyMove(state, "nico", {
        type: "playBird",
        cardId: "houseWren",
        habitat: "forest",
        slotIndex: 0,
        paidResources: ["insect"],
        paidEggsFrom: [],
        powerPlayBirdChoices: {
          "houseWren.power1": { cardId: "meadowSparrow", habitat: "grassland", paidResources: ["seed"], paidEggsFrom: [] },
        },
      });

      expect(next.players.nico.board.forest[0].cardId).toBe("houseWren");
      expect(next.players.nico.board.grassland[0].cardId).toBe("meadowSparrow");
      expect(next.players.nico.hand).toEqual([]);
      expect(next.players.nico.resources).toEqual({ insect: 0, seed: 0 });
      // Una sola acción gastada: la segunda ave es parte del poder, no otra acción.
      expect(next.players.nico.actionCubesAvailable).toBe(state.players.nico.actionCubesAvailable - 1);
    });

    it.each([
      ["fish", "fish"],
      ["seed", "seed"],
      ["wild", "insect"],
      ["no-es-comida", "insect"],
      [undefined, "insect"],
    ])("un poder de \"1 alimento a elección\" con la elección %j da %s (nunca un recurso wild)", (choice, expected) => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [{ id: "test.anyFood", timing: "onActivate", kind: "gainResource", resource: "wild", amount: 1 }],
      };
      state.players.nico.resources = {};
      state.feeder = ["seed", "seed", "seed", "seed", "seed"];

      const next = applyMove(state, "nico", {
        type: "gainFood",
        dieIndexes: [0],
        ...(choice ? { powerCardChoices: { "test.anyFood": choice } } : {}),
      });

      expect(next.players.nico.resources).toEqual({ seed: 1, [expected]: expect.any(Number) });
      expect(next.players.nico.resources[expected as "fish"]).toBe(expected === "seed" ? 2 : 1);
      expect(Object.keys(next.players.nico.resources)).not.toContain("wild");
    });

    it("un poder que toma cualquier dado y saca uno comodín lo convierte en insecto", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.board.forest[0].cardId = "acornJay";
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [{ id: "test.anyDie", timing: "onActivate", kind: "gainResource", from: "feeder", anyDie: true, amount: 1 }],
      };
      state.players.nico.resources = {};
      state.feeder = ["wild", "seed", "seed", "seed", "seed"];

      const next = applyMove(state, "nico", { type: "gainFood", dieIndexes: [1] });

      expect(next.players.nico.resources).toEqual({ seed: 1, insect: 1 });
    });

    it("isLegalMove rechaza campos con basura en un movimiento (p. ej. un comodín convertido en pescado)", () => {
      const state = createTestState({ mode: "solo" });
      state.feeder = ["wild", "seed", "seed", "seed", "seed"];
      const bad = [
        { type: "gainFood", dieIndexes: [0], wildChoices: { 0: "fish" } },
        { type: "gainFood", dieIndexes: [1.5] },
        { type: "gainFood", dieIndexes: "0" },
        { type: "layEggs", eggPlacements: [{ habitat: "forest", slotIndex: "0" }] },
        { type: "drawBirdCards", draws: [{ source: "sky" }] },
        { type: "gainFood", dieIndexes: [0], powerEggChoices: { x: { habitat: "moon", slotIndex: 0 } } },
      ] as unknown as Move[];

      for (const move of bad) expect(isLegalMove(state, "nico", move), JSON.stringify(move)).toBe(false);
    });

    it("el Ostrero Americano da 2 cartas a quien lo juega y 1 al rival (roba jugadores+1 y cada uno elige)", () => {
      const state = createTestState({ mode: "online", playerIds: ["nico", "santi"] });
      state.players.nico.hand = ["americanOystercatcher"];
      state.players.nico.resources = { insect: 5, seed: 5, fish: 5 };
      state.players.santi.hand = [];
      const oystercatcher = state.cards.americanOystercatcher;
      const paid = Object.entries(oystercatcher.cost).flatMap(([res, n]) => Array(n).fill(res));

      const next = applyMove(state, "nico", {
        type: "playBird",
        cardId: "americanOystercatcher",
        habitat: oystercatcher.habitats[0],
        slotIndex: 0,
        paidResources: paid,
        paidEggsFrom: [],
      });

      expect(next.players.nico.hand).toHaveLength(2);
      expect(next.players.santi.hand).toHaveLength(1);
    });

    describe("Garcita Verde: cambia 1 alimento por cualquier otro", () => {
      const setup = (resources: Record<string, number>) => {
        const state = createTestState({ mode: "solo" });
        state.players.nico.board.wetland[0].cardId = "greenHeron";
        state.players.nico.resources = resources;
        return state;
      };
      const draw = (choice?: string): Move => ({
        type: "drawBirdCards",
        draws: [{ source: "deck" }],
        ...(choice ? { powerCardChoices: { "greenHeron.power1": choice } } : {}),
      });

      it("respeta el par pagado>recibido que elige el jugador", () => {
        const next = applyMove(setup({ seed: 2, rodent: 1 }), "nico", draw("seed>fruit"));
        expect(next.players.nico.resources).toEqual({ seed: 1, rodent: 1, fruit: 1 });
      });

      it("sin elección paga el alimento que más tiene y recibe pescado", () => {
        const next = applyMove(setup({ seed: 3, rodent: 1 }), "nico", draw());
        expect(next.players.nico.resources).toEqual({ seed: 2, rodent: 1, fish: 1 });
      });

      it.each(["fish>fish", "fruit>seed", "seed>wild", "seed>", "basura"])(
        "con la elección inválida %j cae al automático",
        (choice) => {
          const next = applyMove(setup({ seed: 3 }), "nico", draw(choice));
          expect(next.players.nico.resources).toEqual({ seed: 2, fish: 1 });
        },
      );

      it("no hace nada si no tiene alimento para cambiar", () => {
        const next = applyMove(setup({}), "nico", draw("seed>fish"));
        expect(next.players.nico.resources).toEqual({});
      });
    });

    it("isLegalMove rechaza (sin lanzar) huevos en un hábitat inexistente", () => {
      const state = createTestState({ mode: "solo" });
      const move = { type: "layEggs", eggPlacements: [{ habitat: "moon", slotIndex: 0 }] } as unknown as Move;

      expect(isLegalMove(state, "nico", move)).toBe(false);
    });
  });

  describe("bonificaciones de alimento (aves que comen X)", () => {
    const withBirds = (cards: Partial<SpeciesCard>[]) => {
      const state = createInitialState({ mode: "solo" });
      cards.forEach((card, i) => {
        state.cards[`bonusTest${i}`] = {
          ...state.cards.acornWoodpecker,
          id: `bonusTest${i}`,
          cost: {},
          costAnyOf: undefined,
          ...card,
        };
        state.players.nico.board.forest[i].cardId = `bonusTest${i}`;
      });
      return state;
    };
    const points = (state: ReturnType<typeof createInitialState>, id: string) =>
      calculateBonusPoints(state.players.nico, state, state.bonusCardsCatalog![id]);

    it("cuentan el costo fijo y el costo \"o\" (costAnyOf), pero no el comodín ni otros alimentos", () => {
      const state = withBirds([
        { cost: { seed: 1 } },
        { costAnyOf: ["insect", "seed"] },
        { cost: { seed: 2, fruit: 1 } },
        { cost: { wild: 1 } },
        { cost: { fish: 1 } },
      ]);
      expect(points(state, "birdFeeder")).toBe(0); // 3 aves comen semilla: no alcanza el mínimo de 5
      state.cards.bonusTest3.cost = { seed: 1 };
      state.cards.bonusTest4.cost = { seed: 1 };
      expect(points(state, "birdFeeder")).toBe(3); // 5 aves
    });

    it("\"solo invertebrados\" excluye a las aves que comen algo más o tienen costo \"o\"", () => {
      const state = withBirds([
        { cost: { insect: 2 } },
        { cost: { insect: 1 } },
        { cost: { insect: 1, seed: 1 } },
        { costAnyOf: ["insect", "seed"] },
        { cost: {} },
      ]);
      expect(points(state, "foodWebExpert")).toBe(4); // 2 aves x 2 puntos
    });

    it("el Omnívoro cuenta el costo comodín y el Rodentólogo los roedores", () => {
      const state = withBirds([
        { cost: { wild: 1 } },
        { cost: { wild: 2 } },
        { cost: { rodent: 1 } },
        { cost: { rodent: 2 } },
        { cost: { seed: 1 } },
      ]);
      expect(points(state, "omnivoreSpecialist")).toBe(4);
      expect(points(state, "rodentologist")).toBe(4);
    });

    it("Gestor de Pesquerías y Viticultor puntúan por tramos", () => {
      const fish = withBirds([{ cost: { fish: 1 } }, { cost: { fish: 1 } }]);
      expect(points(fish, "fisheryManager")).toBe(3);
      const fruit = withBirds([
        { cost: { fruit: 1 } },
        { cost: { fruit: 1 } },
        { cost: { fruit: 1 } },
        { costAnyOf: ["fruit", "seed"] },
      ]);
      expect(points(fruit, "viticulturalist")).toBe(7);
    });
  });

  describe("objetivos de fin de ronda (los 16 del juego base, 4 por partida)", () => {
    const goal = (id: string) => roundGoalPool.find((g) => g.id === id)!;
    const boardWith = (slots: { habitat: "forest" | "grassland" | "wetland"; card: string; eggs: number }[]) => {
      const state = createTestState({ mode: "solo" });
      slots.forEach((slot) => {
        const column = state.players.nico.board[slot.habitat].findIndex((s) => s.cardId === null);
        state.players.nico.board[slot.habitat][column].cardId = slot.card;
        state.players.nico.board[slot.habitat][column].eggs = slot.eggs;
      });
      return state;
    };
    const metric = (state: ReturnType<typeof createTestState>, id: string) =>
      evaluateRoundGoalMetric(state.players.nico, state, goal(id));

    it("el conjunto de objetivos tiene los 16 del juego base, todos distintos", () => {
      expect(roundGoalPool).toHaveLength(16);
      expect(new Set(roundGoalPool.map((g) => g.id)).size).toBe(16);
      const byType = (type: string) => roundGoalPool.filter((g) => g.type === type).length;
      expect(byType("birdsInHabitat")).toBe(3);
      expect(byType("eggsInHabitat")).toBe(3);
      expect(byType("birdsWithEggsInNests")).toBe(4);
      expect(byType("eggsInNests")).toBe(4);
      expect(byType("eggSets")).toBe(1);
      expect(byType("totalBirds")).toBe(1);
    });

    it("cada partida sortea 4 objetivos distintos y distintas partidas no repiten siempre los mismos", () => {
      const seen = new Set<string>();
      for (let i = 0; i < 30; i += 1) {
        const goals = createInitialState({ mode: "solo" }).roundGoals;
        expect(goals).toHaveLength(4);
        expect(new Set(goals.map((g) => g.id)).size).toBe(4);
        seen.add(goals.map((g) => g.id).join());
      }
      expect(seen.size).toBeGreaterThan(5);
      expect(pickRoundGoals(2)).toHaveLength(2);
    });

    it("se pueden fijar los objetivos al crear la partida", () => {
      const fixed = [goal("eggSets"), goal("totalBirds"), goal("birdsInForest"), goal("eggsInWetland")];
      expect(createInitialState({ mode: "solo", roundGoals: fixed }).roundGoals).toEqual(fixed);
    });

    it("aves con nido X y huevos: solo cuentan las que tienen al menos 1 huevo, y el nido comodín vale", () => {
      const state = boardWith([
        { habitat: "forest", card: "orchardFinch", eggs: 2 }, // nido de copa, con huevos
        { habitat: "forest", card: "acornJay", eggs: 0 }, // sin huevos: no cuenta
        { habitat: "grassland", card: "meadowSparrow", eggs: 1 }, // nido de copa, con huevo
      ]);
      state.cards.acornJay = { ...state.cards.acornJay, nestType: "bowl" };
      expect(metric(state, "bowlNestsWithEggs")).toBe(2);
      expect(metric(state, "cavityNestsWithEggs")).toBe(0);

      state.cards.meadowSparrow = { ...state.cards.meadowSparrow, nestType: "wild" };
      expect(metric(state, "cavityNestsWithEggs")).toBe(1); // el comodín cuenta como cavidad
    });

    it("huevos en nidos X: suma todos los huevos de las aves con ese nido", () => {
      const state = boardWith([
        { habitat: "forest", card: "orchardFinch", eggs: 3 },
        { habitat: "grassland", card: "meadowSparrow", eggs: 2 },
        { habitat: "wetland", card: "riverHeron", eggs: 2 }, // nido de plataforma
      ]);
      expect(metric(state, "eggsInBowlNests")).toBe(5);
      expect(metric(state, "eggsInPlatformNests")).toBe(2);
      expect(metric(state, "eggsInGroundNests")).toBe(0);
    });

    it("conjuntos de huevos: 1 huevo en cada hábitat por conjunto (mínimo de las tres filas)", () => {
      const state = boardWith([
        { habitat: "forest", card: "orchardFinch", eggs: 3 },
        { habitat: "grassland", card: "meadowSparrow", eggs: 2 },
      ]);
      expect(metric(state, "eggSets")).toBe(0); // falta el río
      const column = state.players.nico.board.wetland.findIndex((s) => s.cardId === null);
      state.players.nico.board.wetland[column].cardId = "riverHeron";
      state.players.nico.board.wetland[column].eggs = 1;
      expect(metric(state, "eggSets")).toBe(1);
      state.players.nico.board.wetland[column].eggs = 2;
      expect(metric(state, "eggSets")).toBe(2);
    });

    it("aves por hábitat, huevos por hábitat y aves totales", () => {
      const state = boardWith([
        { habitat: "forest", card: "orchardFinch", eggs: 1 },
        { habitat: "forest", card: "acornJay", eggs: 2 },
        { habitat: "wetland", card: "riverHeron", eggs: 0 },
      ]);
      expect(metric(state, "birdsInForest")).toBe(2);
      expect(metric(state, "birdsInWetland")).toBe(1);
      expect(metric(state, "birdsInGrassland")).toBe(0);
      expect(metric(state, "eggsInForest")).toBe(3);
      expect(metric(state, "totalBirds")).toBe(3);
    });
  });
});
