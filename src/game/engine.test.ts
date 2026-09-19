import { describe, expect, it, vi } from "vitest";
import {
  applyMove,
  calculateBonusPoints,
  canPayResources,
  canRerollFeeder,
  createInitialState,
  evaluateRoundGoalMetric,
  executeAutomaTurn,
  isLegalMove,
  resolveRoundEnd,
  rollInitialFeeder,
  scorePlayer,
  scorePlayerDetails,
  shuffle,
  standardDieFaces,
} from ".";
import type { BonusCard, Move, SpeciesCard } from "./types";

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
  // Resuelve automáticamente la elección de carta de bonificación inicial (primera opción
  // ofrecida) para que los tests de mecánica arranquen directo en fase "round", como antes de
  // que existiera este paso de setup. Los tests que sí quieren cubrir el paso de elección usan
  // createInitialState directamente.
  for (const player of Object.values(state.players)) {
    if (!player.isAutoma && player.pendingBonusChoice && player.pendingBonusChoice.length > 0) {
      state = applyMove(state, player.id, {
        type: "chooseBonusCard",
        bonusCardId: player.pendingBonusChoice[0],
      });
    }
  }
  return state;
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

  // Tests para Modo Solitario con Automa
  it("inicializa correctamente el modo solitario contra el Automa", () => {
    const state = createTestState({ mode: "solo", automaDifficulty: "hard" });

    expect(state.gameMode).toBe("solo");
    expect(state.players.nico).toBeDefined();
    expect(state.players.automa).toBeDefined();
    expect(state.players.automa.isAutoma).toBe(true);
    expect(state.automaState).toBeDefined();
    expect(state.automaState?.difficulty).toBe("hard");
    expect(state.automaState?.deck.length).toBeGreaterThanOrEqual(10);
  });

  it("ejecuta el turno del Automa tras la jugada del jugador humano", () => {
    const state = createTestState({ mode: "solo", automaDifficulty: "normal" });
    state.feeder = ["seed", "fruit", "insect", "fish", "rodent"];
    const move: Move = { type: "gainFood", dieIndexes: [0] };

    const next = applyMove(state, "nico", move);
    expect(next.players.nico.actionCubesAvailable).toBe(7);
    expect(next.players.automa.actionCubesAvailable).toBe(7);
    expect(next.automaState?.currentCard).toBeDefined();
    expect(next.currentPlayerId).toBe("nico");
  });

  it("calcula la puntuación del Automa según su dificultad", () => {
    const state = createTestState({ mode: "solo", automaDifficulty: "hard" });
    if (state.automaState) {
      state.automaState.stashedCardsCount = 4;
      state.automaState.eggs = 5;
    }
    state.players.automa.roundGoalScores = [4, 5];

    const breakdown = scorePlayerDetails(state, "automa");
    expect(breakdown.birds).toBe(20);
    expect(breakdown.eggs).toBe(5);
    expect(breakdown.roundGoals).toBe(9);
    expect(breakdown.bonusCards).toBe(6);
    expect(breakdown.total).toBe(40);
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
    it("revela N cartas de bonificación y conserva la(s) primera(s) por defecto", () => {
      const state = createTestState({ mode: "solo" });
      state.players.nico.hand = ["acornJay"];
      state.players.nico.resources = { seed: 1, fruit: 1 };
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [
          { id: "test.bonus", timing: "onPlay", kind: "gainBonusCard", drawCount: 2, keepCount: 1 },
        ],
      };
      state.bonusDeck = ["forester", "wetlandScientist", "visionaryLeader"];
      // El setup ya descartó 1 de las 2 cartas repartidas al crear la partida; lo limpiamos para
      // que la aserción de abajo sobre bonusDiscard sea determinista.
      state.bonusDiscard = [];
      const bonusCountBefore = state.players.nico.bonusCards.length;

      const move: Move = {
        type: "playBird",
        cardId: "acornJay",
        habitat: "forest",
        slotIndex: 0,
        paidResources: ["seed", "fruit"],
        paidEggsFrom: [],
      };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.bonusCards.length).toBe(bonusCountBefore + 1);
      expect(next.players.nico.bonusCards.map((b) => b.id)).toContain("forester");
      expect(next.bonusDeck).toEqual(["visionaryLeader"]);
      expect(next.bonusDiscard).toEqual(["wetlandScientist"]);
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
      // Evita que el Automa juegue su turno automáticamente después del de Nico dentro del
      // mismo applyMove (podría tocar el comedero y volver no determinística la aserción).
      state.players.automa.actionCubesAvailable = 0;

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
    it("todos los jugadores no-automa roban 1 carta del mazo", () => {
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
    it("cada jugador no-automa toma 1 dado del comedero", () => {
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

  describe("elección de carta de bonificación inicial (fase setup)", () => {
    it("reparte 2 cartas de bonificación por jugador humano y arranca en fase 'setup'", () => {
      const state = createInitialState(["nico", "santi"]);

      expect(state.phase).toBe("setup");
      expect(state.players.nico.pendingBonusChoice).toHaveLength(2);
      expect(state.players.santi.pendingBonusChoice).toHaveLength(2);
      expect(state.players.nico.bonusCards).toHaveLength(0);
      expect(state.players.santi.bonusCards).toHaveLength(0);
    });

    it("no reparte cartas de bonificación al Automa (modo solo)", () => {
      const state = createInitialState({ mode: "solo" });
      expect(state.players.automa.pendingBonusChoice ?? []).toHaveLength(0);
    });

    it("ningún movimiento de juego es legal mientras la fase siga en 'setup'", () => {
      const state = createInitialState({ mode: "solo" });
      expect(state.phase).toBe("setup");
      expect(isLegalMove(state, "nico", { type: "gainFood", dieIndexes: [0] })).toBe(false);
    });

    it("chooseBonusCard conserva la elegida, descarta la otra, y pasa a fase 'round' (modo solo)", () => {
      const state = createInitialState({ mode: "solo" });
      const [chosenId, otherId] = state.players.nico.pendingBonusChoice!;

      expect(isLegalMove(state, "nico", { type: "chooseBonusCard", bonusCardId: chosenId })).toBe(true);
      const next = applyMove(state, "nico", { type: "chooseBonusCard", bonusCardId: chosenId });

      expect(next.players.nico.bonusCards.map((b) => b.id)).toEqual([chosenId]);
      expect(next.players.nico.pendingBonusChoice).toBeUndefined();
      expect(next.bonusDiscard).toContain(otherId);
      // Único jugador humano en modo solo: al elegir, la partida arranca sola.
      expect(next.phase).toBe("round");
    });

    it("en modo online, la fase permanece en 'setup' hasta que TODOS los jugadores eligieron", () => {
      const state = createInitialState({ mode: "online", playerIds: ["nico", "santi"] });
      const nicoChoice = state.players.nico.pendingBonusChoice![0];
      const santiChoice = state.players.santi.pendingBonusChoice![0];

      const afterNico = applyMove(state, "nico", { type: "chooseBonusCard", bonusCardId: nicoChoice });
      expect(afterNico.phase).toBe("setup"); // santi todavía no eligió
      expect(afterNico.players.nico.pendingBonusChoice).toBeUndefined();

      const afterSanti = applyMove(afterNico, "santi", { type: "chooseBonusCard", bonusCardId: santiChoice });
      expect(afterSanti.phase).toBe("round");
    });

    it("chooseBonusCard no depende de currentPlayerId (elección simultánea, no por turnos)", () => {
      const state = createInitialState({ mode: "online", playerIds: ["nico", "santi"] });
      expect(state.currentPlayerId).toBe("nico");
      const santiChoice = state.players.santi.pendingBonusChoice![0];
      // Santi puede elegir aunque currentPlayerId sea "nico": la elección inicial es simultánea.
      expect(isLegalMove(state, "santi", { type: "chooseBonusCard", bonusCardId: santiChoice })).toBe(true);
    });

    it("chooseBonusCard es ilegal con un id no ofrecido, fuera de fase 'setup', o para el Automa", () => {
      const state = createInitialState({ mode: "solo" });
      const [chosenId] = state.players.nico.pendingBonusChoice!;

      expect(isLegalMove(state, "nico", { type: "chooseBonusCard", bonusCardId: "not-offered" })).toBe(false);
      expect(isLegalMove(state, "automa", { type: "chooseBonusCard", bonusCardId: chosenId })).toBe(false);

      const resolved = applyMove(state, "nico", { type: "chooseBonusCard", bonusCardId: chosenId });
      expect(resolved.phase).toBe("round");
      expect(isLegalMove(resolved, "nico", { type: "chooseBonusCard", bonusCardId: chosenId })).toBe(false);
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
});
