import { describe, expect, it } from "vitest";
import { applyPlayerMove, createInitialState } from "../game";
import type { GameState } from "../game";
import { diffBoard, resourceKey, slotKey } from "./boardChanges";

function roundState(): GameState {
  const state = createInitialState({ mode: "solo", playerIds: ["nico", "bot"], firstPlayerId: "nico" });
  state.phase = "round";
  state.currentPlayerId = "nico";
  for (const player of Object.values(state.players)) {
    player.pendingStartingHand = undefined;
    player.pendingBonusChoice = undefined;
  }
  state.feeder = ["seed", "fish", "fish", "insect", "fruit"];
  return state;
}

/** Copia con una entrada más en el registro: lo que hace un estado "posterior" de la misma partida. */
function later(state: GameState, edit: (next: GameState) => void = () => {}): GameState {
  const next = structuredClone(state);
  edit(next);
  next.log.push({ playerId: "nico", message: "Algo pasó." });
  return next;
}

describe("diffBoard", () => {
  it("una jugada real de tomar comida: sale el dado, sube el alimento y se gasta un cubo", () => {
    const before = roundState();
    const after = applyPlayerMove(before, "nico", { type: "gainFood", dieIndexes: [0] });
    const diff = diffBoard(before, after)!;

    expect(diff.feeder).toEqual({ taken: [{ index: 0, face: "seed" }], rolled: false });
    expect(diff.resources).toEqual(new Set([resourceKey("nico", "seed")]));
    expect(diff.spentCube).toEqual({ playerId: "nico", index: after.players.nico.actionCubesAvailable });
    expect(diff.birds.size).toBe(0);
    expect(diff.eggs.size).toBe(0);
  });

  it("relanzar el comedero marca todos los dados como nuevos, sin dados que salen", () => {
    const before = roundState();
    const changed = later(before, (next) => (next.feeder = ["wild", "wild", "rodent", "rodent", "fruit"]));
    expect(diffBoard(before, changed)!.feeder).toEqual({ taken: [], rolled: true });
  });

  it("varios dados que salen, cada uno con su posición y cara de antes", () => {
    const before = roundState();
    const after = later(before, (next) => (next.feeder = ["fish", "insect"]));
    expect(diffBoard(before, after)!.feeder).toEqual({
      taken: [
        { index: 0, face: "seed" },
        { index: 2, face: "fish" },
        { index: 4, face: "fruit" },
      ],
      rolled: false,
    });
  });

  it("un ave nueva, los huevos puestos y las cartas que llegan a la mano y al mercado", () => {
    const before = roundState();
    const [played, kept] = before.players.nico.hand;
    const withBird = later(before, (next) => {
      next.players.nico.hand = next.players.nico.hand.filter((id) => id !== played);
      next.players.nico.board.forest[0].cardId = played;
    });
    expect(diffBoard(before, withBird)!.birds).toEqual(new Set([slotKey("nico", "forest", 0)]));

    const withEggs = later(withBird, (next) => (next.players.nico.board.forest[0].eggs = 2));
    const eggs = diffBoard(withBird, withEggs)!;
    expect(eggs.eggs).toEqual(new Map([[slotKey("nico", "forest", 0), 2]]));
    expect(eggs.birds.size).toBe(0);

    const drew = later(withEggs, (next) => {
      const fromMarket = next.market[0];
      next.players.nico.hand.push(fromMarket, next.deck[0]);
      next.market = [next.deck[1], ...next.market.slice(1)];
    });
    const cards = diffBoard(withEggs, drew)!.cards;
    expect(cards).toEqual(new Set([withEggs.market[0], withEggs.deck[0], withEggs.deck[1]]));
    expect(cards.has(kept)).toBe(false);
  });

  it("una jugada que no cambia nada visible, o dos estados que no son consecutivos, no anima nada", () => {
    const before = roundState();
    expect(diffBoard(before, later(before))).toBeNull();

    // El registro no creció: es otro estado (otra partida, o el mismo).
    expect(diffBoard(before, structuredClone(before))).toBeNull();
    const otherGame = later(before, (next) => (next.playerOrder = ["nico", "santi"]));
    expect(diffBoard(before, otherGame)).toBeNull();
  });

  it("no cuenta como cubo gastado el reinicio de cubos de una ronda nueva", () => {
    const before = roundState();
    before.players.nico.actionCubesAvailable = 9;
    const after = later(before, (next) => {
      next.round = 2;
      next.players.nico.actionCubesAvailable = 8;
      next.feeder = ["seed", "seed"];
    });
    expect(diffBoard(before, after)!.spentCube).toBeNull();
  });
});
