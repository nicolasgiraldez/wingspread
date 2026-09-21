import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyPlayerMove, createInitialState } from "../game";
import type { GameState } from "../game";
import { useRemoteAction } from "./useRemoteAction";

function online(): GameState {
  const state = createInitialState({
    mode: "online",
    playerIds: ["nico", "santi"],
    customPlayerNames: { nico: "Lucía", santi: "Mateo" },
    firstPlayerId: "santi",
  });
  state.phase = "round";
  state.currentPlayerId = "santi";
  for (const player of Object.values(state.players)) {
    player.pendingStartingHand = undefined;
    player.pendingBonusChoice = undefined;
  }
  state.feeder = ["seed", "fish", "insect", "fruit", "rodent"];
  return state;
}

const mateoTakesADie = (state: GameState) => applyPlayerMove(state, "santi", { type: "gainFood", dieIndexes: [0] });

describe("useRemoteAction", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (state: GameState, local = "nico", speed: "normal" | "instant" = "normal") =>
    renderHook(({ s }) => useRemoteAction(s, local, speed), { initialProps: { s: state as GameState | null } });

  it("anuncia la jugada del oponente cuando llega su estado y la quita al leerse", () => {
    const before = online();
    const { result, rerender } = setup(before);
    expect(result.current.action).toBeNull();

    rerender({ s: mateoTakesADie(before) });
    expect(result.current.action).toMatchObject({ actorName: "Mateo", headline: "Tomó 1 semilla del comedero." });
    const hold = result.current.action!.holdMs;

    act(() => void vi.advanceTimersByTime(hold - 50));
    expect(result.current.action).not.toBeNull();
    act(() => void vi.advanceTimersByTime(100));
    expect(result.current.action).toBeNull();
  });

  it("no anuncia lo que hace el propio jugador ni el primer estado que llega", () => {
    const before = online();
    const { result, rerender } = setup(before, "santi");
    rerender({ s: mateoTakesADie(before) });
    expect(result.current.action).toBeNull();

    const fresh = setup(mateoTakesADie(before), "nico");
    expect(fresh.result.current.action).toBeNull();
  });

  it("una jugada nueva reemplaza a la anterior; cerrar la quita; sin pausas queda 2 s", () => {
    const first = online();
    const second = mateoTakesADie(first);
    second.currentPlayerId = "santi"; // Mateo vuelve a jugar (Lucía sin cubos)
    const third = applyPlayerMove(second, "santi", { type: "gainFood", dieIndexes: [0] });

    const { result, rerender } = setup(first, "nico", "instant");
    rerender({ s: second });
    const id = result.current.action!.id;
    expect(result.current.action!.holdMs).toBe(2000);
    rerender({ s: third });
    expect(result.current.action!.id).toBe(id + 1);

    act(() => result.current.dismiss());
    expect(result.current.action).toBeNull();
  });

  it("en solitario no hace nada (la IA la anuncia useBotTurns) y al cerrar la partida se limpia", () => {
    const solo = createInitialState({ mode: "solo", playerIds: ["nico", "bot"], firstPlayerId: "nico" });
    const { result, rerender } = setup(solo);
    const next = structuredClone(solo);
    next.log.push({ playerId: "bot", message: "Obtuvo alimento del comedero." });
    rerender({ s: next });
    expect(result.current.action).toBeNull();

    const before = online();
    const other = setup(before);
    other.rerender({ s: mateoTakesADie(before) });
    expect(other.result.current.action).not.toBeNull();
    other.rerender({ s: null });
    expect(other.result.current.action).toBeNull();
  });
});
