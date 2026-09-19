import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { applyMove, createInitialState } from "../game";
import type { GameState } from "../game";
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

/** Partida solitaria en la ronda 1 en la que un poder acaba de revelar 2 cartas de bonificación. */
function gameWithPendingBonus(): GameState {
  let state = createInitialState({
    mode: "solo",
    playerIds: ["nico", "automa"],
    customPlayerNames: { nico: "Lucía" },
  });
  state = applyMove(state, "nico", { type: "chooseBonusCard", bonusCardId: state.players.nico.pendingBonusChoice![0] });
  const offered = ["forester", "wetlandScientist"];
  state.bonusDeck = state.bonusDeck.filter((id) => !offered.includes(id));
  state.players.nico.pendingBonusChoice = offered;
  return state;
}

describe("elegir una carta de bonificación tras un poder de ave", () => {
  beforeEach(() => localStorage.clear());

  it("muestra las cartas reveladas (sin el texto de elección inicial) y se resuelve al elegir", async () => {
    saveGame({ kind: "solo", state: gameWithPendingBonus(), savedAt: Date.now() });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText(/Lucía, elegí tu carta de bonificación$/)).toBeTruthy();
    expect(screen.queryByText(/elegí tu carta de bonificación inicial/)).toBeNull();
    expect(screen.getByText(/Se revelaron 2 cartas/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Elegir esta" })).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Elegir esta" })[1]);

    expect(screen.queryByText(/elegí tu carta de bonificación/)).toBeNull();
    const saved = loadSavedGame()!.state.players.nico;
    expect(saved.pendingBonusChoice).toBeUndefined();
    expect(saved.bonusCards.map((bonus) => bonus.id)).toContain("wetlandScientist");
  });
});
