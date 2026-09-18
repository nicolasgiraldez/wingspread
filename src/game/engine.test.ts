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
import type { Move, SpeciesCard } from "./types";

describe("motor de reglas expandido de wingspread", () => {
  it("crea una partida para Nico y Santi con comedero de 5 dados aleatorios y mazo barajado", () => {
    const state = createInitialState(["nico", "santi"]);

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
    const state = createInitialState(["nico", "santi"]);
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
    const state = createInitialState(["nico", "santi"]);
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

    const state = createInitialState(["nico", "santi"]);
    state.feeder = ["seed", "seed", "seed"];
    const move: Move = { type: "rerollFeeder" };

    expect(isLegalMove(state, "nico", move)).toBe(true);
    const next = applyMove(state, "nico", move);
    expect(next.feeder).toHaveLength(5);
  });

  it("ejecuta el poder de almacenar alimento (caching) al activar el bosque", () => {
    const state = createInitialState(["nico", "santi"]);
    state.players.nico.board.forest[0].cardId = "acornJay";

    const move: Move = { type: "gainFood", dieIndexes: [0] };
    const next = applyMove(state, "nico", move);

    const slot = next.players.nico.board.forest[0];
    expect(slot.cached).toContain("seed");
    expect(slot.cached.length).toBe(1);
  });

  it("ejecuta el poder de solapar cartas (tucking) al activar el río/humedal", () => {
    const state = createInitialState(["nico", "santi"]);
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
    const state = createInitialState(["nico", "santi"]);
    state.players.nico.board.forest[0].cardId = "redTailedHawk";
    state.deck.unshift("marshWren");

    const move: Move = { type: "gainFood", dieIndexes: [0] };
    const next = applyMove(state, "nico", move);

    const slot = next.players.nico.board.forest[0];
    expect(slot.tucked).toContain("marshWren");
  });

  it("evalúa y puntúa los objetivos de fin de ronda y reinicia cubos de acción", () => {
    const state = createInitialState(["nico", "santi"]);
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
    const state = createInitialState(["nico", "santi"]);
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
    const state = createInitialState({ mode: "solo", automaDifficulty: "hard" });

    expect(state.gameMode).toBe("solo");
    expect(state.players.nico).toBeDefined();
    expect(state.players.automa).toBeDefined();
    expect(state.players.automa.isAutoma).toBe(true);
    expect(state.automaState).toBeDefined();
    expect(state.automaState?.difficulty).toBe("hard");
    expect(state.automaState?.deck.length).toBeGreaterThanOrEqual(10);
  });

  it("ejecuta el turno del Automa tras la jugada del jugador humano", () => {
    const state = createInitialState({ mode: "solo", automaDifficulty: "normal" });
    state.feeder = ["seed", "fruit", "insect", "fish", "rodent"];
    const move: Move = { type: "gainFood", dieIndexes: [0] };

    const next = applyMove(state, "nico", move);
    expect(next.players.nico.actionCubesAvailable).toBe(7);
    expect(next.players.automa.actionCubesAvailable).toBe(7);
    expect(next.automaState?.currentCard).toBeDefined();
    expect(next.currentPlayerId).toBe("nico");
  });

  it("calcula la puntuación del Automa según su dificultad", () => {
    const state = createInitialState({ mode: "solo", automaDifficulty: "hard" });
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
    const state = createInitialState({ mode: "solo" });
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
    const state2 = createInitialState({ mode: "solo" });
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
    const state = createInitialState({ mode: "solo" });
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
    const state = createInitialState({ mode: "solo" });
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
    const state = createInitialState({ mode: "online", playerIds: ["nico", "santi"] });
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
    const state = createInitialState({ mode: "online", playerIds: ["nico", "santi"] });
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
    const state = createInitialState({ mode: "solo" });
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
    const state = createInitialState({ mode: "solo" });
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
    const state = createInitialState({ mode: "solo" });
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
    const state = createInitialState({ mode: "solo" });
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
      const state = createInitialState({ mode: "solo" });
      const player = state.players.nico;
      player.resources = { insect: 1 };
      // Pagando con "insect", que es uno de los dos tipos aceptados por costAnyOf
      expect(canPayResources(player, ["insect"], {}, ["insect", "fruit"])).toBe(true);
    });

    it("rechaza el pago si no se aportó ningún tipo del set restringido ni sustitución 2x1", () => {
      const state = createInitialState({ mode: "solo" });
      const player = state.players.nico;
      player.resources = { seed: 1 };
      // "seed" no está en el set {insect, fruit} y solo hay 1 unidad pagada (no alcanza para 2x1)
      expect(canPayResources(player, ["seed"], {}, ["insect", "fruit"])).toBe(false);
    });

    it("acepta la sustitución 2x1 cuando no se tiene ninguno de los tipos aceptados", () => {
      const state = createInitialState({ mode: "solo" });
      const player = state.players.nico;
      player.resources = { seed: 2 };
      expect(canPayResources(player, ["seed", "seed"], {}, ["insect", "fruit"])).toBe(true);
    });

    it("permite jugar un ave cuyo costo combina costAnyOf con un requisito fijo", () => {
      const state = createInitialState({ mode: "solo" });
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
      const state = createInitialState({ mode: "solo" });
      state.players.nico.hand = ["acornJay"];
      state.players.nico.resources = { seed: 1, fruit: 1 };
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [
          { id: "test.bonus", timing: "onPlay", kind: "gainBonusCard", drawCount: 2, keepCount: 1 },
        ],
      };
      state.bonusDeck = ["forestGuardian", "wetlandEcologist", "largeBroods"];
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
      expect(next.players.nico.bonusCards.map((b) => b.id)).toContain("forestGuardian");
      expect(next.bonusDeck).toEqual(["largeBroods"]);
      expect(next.bonusDiscard).toEqual(["wetlandEcologist"]);
    });

    it("respeta la elección del jugador sobre cuál carta de bonificación conservar", () => {
      const state = createInitialState({ mode: "solo" });
      state.players.nico.hand = ["acornJay"];
      state.players.nico.resources = { seed: 1, fruit: 1 };
      // El setup reparte una carta de bonificación inicial al azar; la limpiamos para que la
      // aserción "not.toContain forestGuardian" no dependa de esa asignación aleatoria.
      state.players.nico.bonusCards = [];
      state.cards.acornJay = {
        ...state.cards.acornJay,
        powers: [
          { id: "test.bonus", timing: "onPlay", kind: "gainBonusCard", drawCount: 2, keepCount: 1 },
        ],
      };
      state.bonusDeck = ["forestGuardian", "wetlandEcologist", "largeBroods"];

      const move: Move = {
        type: "playBird",
        cardId: "acornJay",
        habitat: "forest",
        slotIndex: 0,
        paidResources: ["seed", "fruit"],
        paidEggsFrom: [],
        powerCardChoices: { "test.bonus": "wetlandEcologist" },
      };
      const next = applyMove(state, "nico", move);

      expect(next.players.nico.bonusCards.map((b) => b.id)).toContain("wetlandEcologist");
      expect(next.players.nico.bonusCards.map((b) => b.id)).not.toContain("forestGuardian");
      expect(next.bonusDiscard).toEqual(["forestGuardian"]);
    });
  });

  describe("poder layEgg: objetivos reales (any / nestType / eachNestType / allPlayersNestType)", () => {
    it("target 'nestType' (rosa) filtra por tipo de nido real y excluye a la propia carta", () => {
      const state = createInitialState({ mode: "online", playerIds: ["nico", "santi"] });
      state.players.santi.board.grassland[0].cardId = "meadowSparrow"; // nido "cup"
      state.players.santi.board.grassland[1].cardId = "barnOwl"; // nido "cavity"
      state.players.santi.board.grassland[2].cardId = "cliffSwallow"; // nido "cup"; será el poder rosa
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
      const state = createInitialState({ mode: "solo" });
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
      const state = createInitialState({ mode: "solo" });
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
      const state = createInitialState({ mode: "solo" });
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
      const state = createInitialState({ mode: "online", playerIds: ["nico", "santi"] });
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

  describe("poder moveToHabitat (mover ave entre hábitats)", () => {
    it("mueve el ave a otro hábitat cuando está en la columna más a la derecha, y los huevos viajan con ella", () => {
      const state = createInitialState({ mode: "solo" });
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
      const state = createInitialState({ mode: "solo" });
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
      const state = createInitialState({ mode: "solo" });
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
      const state = createInitialState({ mode: "solo" });
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
      const state = createInitialState({ mode: "solo" });
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
      const state = createInitialState({ mode: "solo" });
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
      const state = createInitialState({ mode: "solo" });
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
      const state = createInitialState({ mode: "solo" });
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
      const state = createInitialState({ mode: "solo" });
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
      const state = createInitialState({ mode: "solo" });
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
});



