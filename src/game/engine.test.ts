import { describe, expect, it } from "vitest";
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
});
