import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyPlayerMove, createInitialState, stepBot } from "../game";
import type { GameState } from "../game";
import { withSeededRandom } from "../game/simulation";
import { loadSpeed } from "./gameSpeed";
import { THINK_MS } from "./pacing";
import { loadSavedGame, saveGame } from "./savedGame";

vi.mock("./network/peerManager", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./network/peerManager")>()),
  networkManager: {
    initHost: vi.fn(),
    initGuest: vi.fn(),
    cleanup: vi.fn(),
    sendMessage: vi.fn(() => true),
    isConnected: vi.fn(() => false),
  },
}));

import { App } from "./App";

/** Solitaria en la ronda 1 con el turno del rival; el humano ya no tiene cubos, así que el rival juega varias veces seguidas. */
function rivalPlaysSeveralTimes(): GameState {
  return withSeededRandom(11, () => {
    let state = createInitialState({
      mode: "solo",
      playerIds: ["nico", "bot"],
      customPlayerNames: { nico: "Lucía" },
      firstPlayerId: "bot",
    });
    state = stepBot(state)!.state;
    state = applyPlayerMove(state, "nico", {
      type: "chooseStart",
      keepCards: [],
      discardFood: [],
      bonusCardId: state.players.nico.pendingBonusChoice![0],
    });
    state.players.nico.actionCubesAvailable = 0;
    return state;
  });
}

const botCubes = () => loadSavedGame()!.state.players.bot.actionCubesAvailable;

describe("velocidad del juego", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  async function resume() {
    const state = rivalPlaysSeveralTimes();
    saveGame({ kind: "solo", state, savedAt: Date.now() });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    return { user, start: state.players.bot.actionCubesAvailable };
  }

  it("se elige desde el menú, se recuerda y la partida lo lleva en data-speed", async () => {
    const { user } = await resume();
    const game = document.querySelector(".game")!;
    expect(game).toHaveAttribute("data-speed", "normal");

    await user.click(screen.getByRole("button", { name: "Menú de la partida" }));
    await user.click(within(screen.getByRole("group", { name: "Velocidad del juego" })).getByRole("button", { name: "Rápida" }));
    expect(game).toHaveAttribute("data-speed", "fast");
    expect(loadSpeed()).toBe("fast");
  });

  it("una velocidad guardada se aplica al abrir la partida", async () => {
    localStorage.setItem("wingspread.speed.v1", "instant");
    await resume();
    expect(document.querySelector(".game")).toHaveAttribute("data-speed", "instant");
  });

  it("rápida: el rival espera la mitad antes de jugar", async () => {
    localStorage.setItem("wingspread.speed.v1", "fast");
    const { start } = await resume();
    await act(async () => void vi.advanceTimersByTime(THINK_MS / 2 - 50));
    expect(botCubes()).toBe(start);
    await act(async () => void vi.advanceTimersByTime(100));
    expect(botCubes()).toBe(start - 1);
  });

  it("sin pausas: el rival juega toda su racha enseguida, sin esperar a que se lea cada jugada", async () => {
    localStorage.setItem("wingspread.speed.v1", "instant");
    await resume();
    // A velocidad normal ocho jugadas seguidas del rival tardarían más de 30 s; sin pausas, un instante.
    for (let i = 0; i < 3; i += 1) await act(async () => void vi.advanceTimersByTime(10));
    expect(loadSavedGame()!.state.round).toBe(2);
    // La última acción sigue a la vista un rato para poder leerla.
    expect(document.querySelector("[data-rival-panel]")).not.toBeNull();
    await act(async () => void vi.advanceTimersByTime(2100));
    expect(document.querySelector("[data-rival-panel]")).toBeNull();
  });

  it("a velocidad normal, en cambio, el rival no se apura: tras 3 s sigue en su primera jugada", async () => {
    const { start } = await resume();
    await act(async () => void vi.advanceTimersByTime(3000));
    expect(loadSavedGame()!.state.round).toBe(1);
    expect(botCubes()).toBeGreaterThanOrEqual(start - 2);
  });
});
