import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyPlayerMove, createInitialState, stepBot } from "../game";
import type { GameState } from "../game";
import { withSeededRandom } from "../game/simulation";
import { saveGame } from "./savedGame";

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

/** Solitaria en la ronda 1, con la preparación lista y el turno del humano. */
function humanToMove(): GameState {
  return withSeededRandom(21, () => {
    let state = createInitialState({
      mode: "solo",
      playerIds: ["nico", "bot"],
      customPlayerNames: { nico: "Lucía" },
      firstPlayerId: "nico",
    });
    state = stepBot(state)!.state;
    state = applyPlayerMove(state, "nico", {
      type: "chooseStart",
      keepCards: [],
      discardFood: [],
      bonusCardId: state.players.nico.pendingBonusChoice![0],
    });
    state.feeder = ["seed", "fish", "insect", "fruit", "rodent"];
    return state;
  });
}

describe("animaciones de la mesa", () => {
  beforeEach(() => localStorage.clear());

  async function resume() {
    saveGame({ kind: "solo", state: humanToMove(), savedAt: Date.now() });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    return user;
  }

  it("al cargar la partida no se anima nada: solo lo que cambia con una jugada", async () => {
    await resume();
    expect(document.querySelector(".die-token--ghost, .die-token--rolled, .reserve__tile--bump, .slot--new, .bird-card-wrap--enter")).toBeNull();
  });

  it("al tomar un dado, ese dado se despide en su lugar y sube el alimento en la reserva", async () => {
    const user = await resume();
    const before = document.querySelectorAll(".feeder__dice button.die-token").length;
    await user.click(within(document.querySelector(".feeder__dice") as HTMLElement).getByRole("button", { name: "Semilla" }));

    expect(document.querySelectorAll(".die-token--ghost")).toHaveLength(1);
    expect(document.querySelectorAll(".feeder__dice button.die-token")).toHaveLength(before - 1);
    expect([...document.querySelectorAll(".reserve__tile--bump")].map((el) => el.getAttribute("title"))).toEqual(["semilla"]);
  });

  it("el banner de turno está siempre y cambia de texto sin cambiar de lugar", async () => {
    const user = await resume();
    const banner = () => document.querySelector(".banner--turn") as HTMLElement;
    expect(banner()).toHaveTextContent("Tu turno");
    await user.click(within(document.querySelector(".feeder__dice") as HTMLElement).getByRole("button", { name: "Semilla" }));
    expect(banner()).toHaveTextContent("Turno de Rival (IA)");
    expect(document.querySelectorAll(".banner--turn")).toHaveLength(1);
  });
});
