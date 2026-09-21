import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyPlayerMove, createInitialState, stepBot } from "../game";
import type { GameState } from "../game";
import { withSeededRandom } from "../game/simulation";
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

/** Solitaria en la ronda 1 con la preparación lista y el turno del rival, que todavía no jugó. */
function rivalToMove(): GameState {
  return withSeededRandom(11, () => {
    let state = createInitialState({
      mode: "solo",
      playerIds: ["nico", "bot"],
      customPlayerNames: { nico: "Lucía" },
      firstPlayerId: "bot",
    });
    state = stepBot(state)!.state; // la IA prepara su mano
    state = applyPlayerMove(state, "nico", {
      type: "chooseStart",
      keepCards: [],
      discardFood: [],
      bonusCardId: state.players.nico.pendingBonusChoice![0],
    });
    return state;
  });
}

const panel = () => screen.getByRole("status", { name: "Acción del rival" });
const topbarTurn = () => document.querySelector(".topbar__turn")!.textContent;

describe("turno del rival en solitario", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  async function resume() {
    saveGame({ kind: "solo", state: rivalToMove(), savedAt: Date.now() });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    return user;
  }

  it("primero se ve que el rival está jugando, sin que haya jugado todavía", async () => {
    await resume();
    expect(topbarTurn()).toContain("Turno de Rival (IA)");
    expect(screen.getByText(/Está jugando/)).toBeTruthy();
    expect(panel().querySelector("[data-rival-panel]")).toBeNull();
    expect(loadSavedGame()!.state.players.bot.actionCubesAvailable).toBe(rivalToMove().players.bot.actionCubesAvailable);
  });

  it("juega tras una pausa, cuenta qué hizo, devuelve el turno y libera el panel al leerse", async () => {
    await resume();
    await act(async () => void vi.advanceTimersByTime(THINK_MS + 50));

    const shown = panel().querySelector("[data-rival-panel]") as HTMLElement;
    expect(shown).toBeTruthy();
    expect(shown.textContent).toContain("Rival (IA)");
    expect(shown.querySelector(".rival-panel__headline")!.textContent).toMatch(/^(Jugó|Tomó|Relanzó|Puso|Robó)/);

    // El turno ya es del humano y el estado guardado incluye la jugada del rival.
    expect(topbarTurn()).toContain("Tu turno");
    expect(screen.queryByText(/Está jugando/)).toBeNull();
    expect(loadSavedGame()!.state.players.bot.actionCubesAvailable).toBe(rivalToMove().players.bot.actionCubesAvailable - 1);
    // Y no hay un aviso de "Es tu turno" que repita lo que el panel ya cuenta.
    expect(screen.queryByText("Es tu turno")).toBeNull();

    await act(async () => void vi.advanceTimersByTime(5000));
    expect(panel().querySelector("[data-rival-panel]")).toBeNull();
  });

  it("si el rival juega varias veces seguidas, cada jugada espera a que se lea la anterior", async () => {
    const state = rivalToMove();
    state.players.nico.actionCubesAvailable = 0; // el humano ya no tiene acciones: el turno no vuelve a él
    saveGame({ kind: "solo", state, savedAt: Date.now() });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    const bot = () => loadSavedGame()!.state.players.bot.actionCubesAvailable;
    const start = state.players.bot.actionCubesAvailable;

    await act(async () => void vi.advanceTimersByTime(THINK_MS + 50));
    expect(bot()).toBe(start - 1);
    expect(topbarTurn()).toContain("Turno de Rival (IA)");

    // Con la primera acción todavía en pantalla, la segunda no se hace.
    await act(async () => void vi.advanceTimersByTime(1000));
    expect(bot()).toBe(start - 1);
    expect(panel().querySelector("[data-rival-panel]")).toBeTruthy();

    // Al terminar de leerse (como máximo 4,5 s) desaparece; tras la pausa, juega la siguiente.
    await act(async () => void vi.advanceTimersByTime(4000));
    expect(panel().querySelector("[data-rival-panel]")).toBeNull();
    expect(bot()).toBe(start - 1);
    await act(async () => void vi.advanceTimersByTime(THINK_MS + 50));
    expect(bot()).toBe(start - 2);
  });

  it("el botón cierra el aviso", async () => {
    const user = await resume();
    await act(async () => void vi.advanceTimersByTime(THINK_MS + 50));
    await user.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(panel().querySelector("[data-rival-panel]")).toBeNull();
  });

  it("volver al inicio en medio del turno del rival lo cancela; al continuar, retoma desde donde estaba", async () => {
    const user = await resume();
    const cubesBefore = rivalToMove().players.bot.actionCubesAvailable;
    await user.click(screen.getByRole("button", { name: "Menú de la partida" }));
    await user.click(screen.getByRole("button", { name: "Volver al inicio" }));

    // Pasa de sobra el tiempo de la pausa: nada debe correr ni fallar con la partida cerrada.
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(screen.queryByRole("status", { name: "Acción del rival" })).toBeNull();
    expect(loadSavedGame()!.state.players.bot.actionCubesAvailable).toBe(cubesBefore);

    // La partida guardada seguía en el turno del rival: al continuarla, juega él.
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(topbarTurn()).toContain("Turno de Rival (IA)");
    await act(async () => void vi.advanceTimersByTime(THINK_MS + 50));
    expect(topbarTurn()).toContain("Tu turno");
  });
});
