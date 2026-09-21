import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../game";
import type { GameState } from "../game";
import { useBoardChangeTracker } from "./useBoardChanges";

function base(): GameState {
  const state = createInitialState({ mode: "solo", playerIds: ["nico", "bot"], firstPlayerId: "nico" });
  state.phase = "round";
  state.feeder = ["seed", "fish", "insect", "fruit", "rodent"];
  return state;
}

function afterTaking(state: GameState): GameState {
  const next = structuredClone(state);
  next.feeder = next.feeder.slice(1);
  next.log.push({ playerId: "nico", message: "Obtuvo alimento del comedero." });
  return next;
}

describe("useBoardChangeTracker", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("no marca nada al cargar el primer estado, marca la jugada siguiente y lo suelta a los 3 s", () => {
    const first = base();
    const { result, rerender } = renderHook(({ state }) => useBoardChangeTracker(state), { initialProps: { state: first as GameState | null } });
    expect(result.current.active).toBe(false);

    rerender({ state: afterTaking(first) });
    expect(result.current.active).toBe(true);
    expect(result.current.id).toBe(1);
    expect(result.current.feeder.taken).toEqual([{ index: 0, face: "seed" }]);

    act(() => void vi.advanceTimersByTime(2900));
    expect(result.current.active).toBe(true);
    act(() => void vi.advanceTimersByTime(200));
    expect(result.current.active).toBe(false);
    expect(result.current.feeder.taken).toEqual([]);
    // El contador no vuelve atrás: la próxima jugada reinicia sus animaciones.
    expect(result.current.id).toBe(1);
  });

  it("cada jugada nueva reemplaza a la anterior y reinicia el tiempo", () => {
    const first = base();
    const second = afterTaking(first);
    const third = afterTaking(second);
    const { result, rerender } = renderHook(({ state }) => useBoardChangeTracker(state), { initialProps: { state: first as GameState | null } });

    rerender({ state: second });
    act(() => void vi.advanceTimersByTime(2000));
    rerender({ state: third });
    expect(result.current.id).toBe(2);
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current.active).toBe(true);
    act(() => void vi.advanceTimersByTime(1100));
    expect(result.current.active).toBe(false);
  });

  it("al volver al inicio se limpia y una partida nueva no se compara con la vieja", () => {
    const first = base();
    const { result, rerender } = renderHook(({ state }) => useBoardChangeTracker(state), { initialProps: { state: first as GameState | null } });
    rerender({ state: afterTaking(first) });
    expect(result.current.active).toBe(true);

    rerender({ state: null });
    expect(result.current.active).toBe(false);
    rerender({ state: base() });
    expect(result.current.active).toBe(false);
  });
});
