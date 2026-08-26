import { describe, expect, it } from "vitest";
import {
  applyMove,
  calculateBonusPoints,
  canPayResources,
  canRerollFeeder,
  createInitialState,
  evaluateRoundGoalMetric,
  isLegalMove,
  resolveRoundEnd,
  scorePlayer,
  scorePlayerDetails,
} from ".";
import type { Move, SpeciesCard } from "./types";

describe("motor de reglas expandido de wingspread", () => {
  it("crea una partida para Nico y Santi con comedero, mercado y cartas iniciales", () => {
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

    // Cost is 1 seed -> can be paid with 2 fruits
    const cost = { seed: 1 };
    expect(canPayResources(player, ["fruit", "fruit"], cost)).toBe(true);
    expect(canPayResources(player, ["fruit"], cost)).toBe(false);

    // Wild cost: can be paid with 1 single food or 2 other foods
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
    // Place acornJay (Arrendajo Bellotero) in forest
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
    expect(next.deck.length).toBe(initialDeckCount - 2); // 1 drawn to hand + 1 tucked
  });

  it("ejecuta el poder de caza depredador (huntPredator)", () => {
    const state = createInitialState(["nico", "santi"]);
    state.players.nico.board.forest[0].cardId = "redTailedHawk"; // maxWingspan 65
    // Force top of deck to be marshWren (wingspan 15 <= 65)
    state.deck.unshift("marshWren");

    const move: Move = { type: "gainFood", dieIndexes: [0] };
    const next = applyMove(state, "nico", move);

    const slot = next.players.nico.board.forest[0];
    expect(slot.tucked).toContain("marshWren");
  });

  it("evalúa y puntúa los objetivos de fin de ronda y reinicia cubos de acción", () => {
    const state = createInitialState(["nico", "santi"]);
    // Goal for round 1: eggsInGrassland
    state.players.nico.board.grassland[0].cardId = "meadowSparrow";
    state.players.nico.board.grassland[0].eggs = 3;
    state.players.santi.board.grassland[0].cardId = "cliffSwallow";
    state.players.santi.board.grassland[0].eggs = 1;

    // Evaluate metric
    const nicoEggs = evaluateRoundGoalMetric(state.players.nico, state, state.roundGoals[0]);
    const santiEggs = evaluateRoundGoalMetric(state.players.santi, state, state.roundGoals[0]);
    expect(nicoEggs).toBe(3);
    expect(santiEggs).toBe(1);

    // End round 1
    resolveRoundEnd(state);
    expect(state.round).toBe(2);
    expect(state.players.nico.roundGoalScores[0]).toBe(4); // 1st place in round 1
    expect(state.players.santi.roundGoalScores[0]).toBe(1); // 2nd place in round 1
    expect(state.players.nico.actionCubesAvailable).toBe(7); // Round 2 has 7 cubes
    expect(state.firstPlayerId).toBe("santi"); // Rotated first player
    expect(state.currentPlayerId).toBe("santi");
  });

  it("calcula la puntuación detallada incluyendo bonificaciones, huevos y cartas solapadas", () => {
    const state = createInitialState(["nico", "santi"]);
    const slot = state.players.nico.board.wetland[0];
    slot.cardId = "riverHeron"; // 5 points
    slot.eggs = 2;              // 2 points
    slot.cached = ["fish"];     // 1 point
    slot.tucked = ["marshWren"];// 1 point
    state.players.nico.roundGoalScores = [4, 5]; // 9 points

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
});
