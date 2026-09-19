import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { applyMove, createInitialState } from "../game";
import type { GameState } from "../game";
import { nextActor, randomMove, withSeededRandom } from "../game/simulation";
import { clearSavedGame, loadSavedGame, saveGame } from "./savedGame";

// La red se reemplaza por un doble: aquí solo interesa CÓMO la app la usa al reanudar.
const network = vi.hoisted(() => ({
  initHost: vi.fn(),
  initGuest: vi.fn(),
  cleanup: vi.fn(),
  sendMessage: vi.fn(() => true),
  isConnected: vi.fn(() => false),
}));
vi.mock("./network/peerManager", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./network/peerManager")>()),
  networkManager: network,
}));

import { App } from "./App";

function midGame(mode: "solo" | "online"): GameState {
  return withSeededRandom(3, () => {
    let state = createInitialState(
      mode === "solo"
        ? { mode: "solo", playerIds: ["nico", "bot"], customPlayerNames: { nico: "Lucía" } }
        : { mode: "online", playerIds: ["nico", "santi"], customPlayerNames: { nico: "Lucía", santi: "Mateo" } },
    );
    for (let i = 0; i < 8; i += 1) {
      const actor = nextActor(state)!;
      state = applyMove(state, actor, randomMove(state, actor)!);
    }
    return state;
  });
}

describe("reanudar una partida guardada", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("sin partida guardada no se ofrece continuar", () => {
    render(<App />);
    expect(screen.queryByText("Partida en curso")).toBeNull();
  });

  it("ofrece continuar una partida solitaria y la retoma tal como estaba", async () => {
    const state = midGame("solo");
    saveGame({ kind: "solo", state, savedAt: Date.now() - 5 * 60_000 });
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText("Partida en curso")).toBeTruthy();
    expect(screen.getByText(/Modo solitario/)).toBeTruthy();
    expect(screen.getByText(/hace 5 min/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Mercado de Aves")).toBeTruthy();
    expect(network.initHost).not.toHaveBeenCalled();
    expect(loadSavedGame()!.state.round).toBe(state.round);
    // Y sigue guardando: el efecto de guardado se ejecutó de nuevo al retomarla.
    expect(Date.now() - loadSavedGame()!.savedAt).toBeLessThan(60_000);
  });

  it("reanuda la sala del anfitrión reabriéndola con el mismo código", async () => {
    saveGame({ kind: "online-host", state: midGame("online"), roomCode: "halcon-482", savedAt: Date.now() });
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText(/Sala halcon-482/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Mercado de Aves")).toBeTruthy();
    expect(network.initHost).toHaveBeenCalledTimes(1);
    expect(network.initHost).toHaveBeenCalledWith("halcon-482", expect.any(Object), { resume: true });
  });

  it("descartar borra la partida guardada y oculta la tarjeta", async () => {
    saveGame({ kind: "solo", state: midGame("solo"), savedAt: Date.now() });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTitle("Borrar la partida guardada"));

    expect(screen.queryByText("Partida en curso")).toBeNull();
    expect(loadSavedGame()).toBeNull();
  });

  it("una partida guardada corrupta se ignora sin romper la pantalla de inicio", () => {
    localStorage.setItem("wingspread.savedGame.v2", "{roto");
    render(<App />);
    expect(screen.queryByText("Partida en curso")).toBeNull();
    expect(screen.getByText("Wingspread")).toBeTruthy();
    clearSavedGame();
  });
});
