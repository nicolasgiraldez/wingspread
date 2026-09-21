import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyPlayerMove, createInitialState } from "../game";
import type { GameState, NetworkMessage } from "../game";

// El invitado se conecta por PeerJS: aquí se reemplaza la red por un doble que deja "enviarle" mensajes.
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

/** Partida online en la ronda 1 con el turno de Lucía (anfitriona, "nico"). Mateo es el invitado ("santi"). */
function hostToMove(): GameState {
  const state = createInitialState({
    mode: "online",
    playerIds: ["nico", "santi"],
    customPlayerNames: { nico: "Lucía", santi: "Mateo" },
    firstPlayerId: "nico",
  });
  state.phase = "round";
  state.currentPlayerId = "nico";
  for (const player of Object.values(state.players)) {
    player.pendingStartingHand = undefined;
    player.pendingBonusChoice = undefined;
  }
  state.feeder = ["seed", "fish", "insect", "fruit", "rodent"];
  return state;
}

describe("invitado en una partida online", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  /** Se une a una sala y deja listo el envío de estados del anfitrión. */
  async function joinAsMateo() {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText("Escribí tu nombre..."), "Mateo");
    await user.click(screen.getByRole("button", { name: /Multijugador Online/ }));
    await user.click(screen.getByPlaceholderText(/ej\. halcon-428/));
    await user.paste("halcon-482");
    await user.click(screen.getByRole("button", { name: /Unirse/ }));

    const handlers = network.initGuest.mock.calls[0][1] as { onMessage: (msg: NetworkMessage) => void };
    const hostSends = (state: GameState) => act(() => handlers.onMessage({ type: "SYNC_STATE", state }));
    return { hostSends };
  }

  it("cuando llega la jugada de la anfitriona, un panel cuenta qué hizo y no hay avisos repetidos", async () => {
    const { hostSends } = await joinAsMateo();
    const before = hostToMove();
    await hostSends(before);
    // Al entrar no se anuncia nada de lo que ya pasó.
    expect(document.querySelector("[data-rival-panel]")).toBeNull();
    expect(document.querySelector(".banner--turn")).toHaveTextContent("Turno de Lucía");

    // Lucía toma un dado y le llega el estado nuevo al invitado.
    await hostSends(applyPlayerMove(before, "nico", { type: "gainFood", dieIndexes: [0] }));

    const panel = document.querySelector("[data-rival-panel]") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.querySelector(".rival-panel__who")).toHaveTextContent("Lucía");
    expect(panel.querySelector(".rival-panel__headline")).toHaveTextContent("Tomó 1 semilla del comedero.");

    // Ahora le toca a Mateo: el banner lo dice y no hay un aviso de "Es tu turno" que repita el panel.
    expect(document.querySelector(".banner--turn")).toHaveTextContent("Tu turno");
    expect(screen.queryByText("Es tu turno")).toBeNull();
    // Y el dado que salió se despide en el comedero.
    expect(document.querySelectorAll(".die-token--ghost")).toHaveLength(1);
  });

  it("los poderes de la anfitriona salen en el panel y no como avisos aparte", async () => {
    const { hostSends } = await joinAsMateo();
    const before = hostToMove();
    await hostSends(before);

    const after = applyPlayerMove(before, "nico", { type: "gainFood", dieIndexes: [0] });
    after.log.splice(after.log.length - 1, 0, { playerId: "nico", message: "Poder de [Carbonero]: tomó 1 semilla del comedero." });
    await hostSends(after);

    expect(document.querySelector(".rival-panel__details")).toHaveTextContent("Poder de Carbonero: tomó 1 semilla del comedero.");
    expect(screen.queryByText("Poder de Carbonero")).toBeNull(); // el título de un aviso, si hubiera salido
  });

  it("lo que hace el propio invitado no se anuncia, y sus propios poderes sí salen como aviso", async () => {
    const { hostSends } = await joinAsMateo();
    const start = hostToMove();
    start.currentPlayerId = "santi";
    await hostSends(start);

    const mine = applyPlayerMove(start, "santi", { type: "gainFood", dieIndexes: [0] });
    mine.log.splice(mine.log.length - 1, 0, { playerId: "santi", message: "Poder de [Vireo]: robó 1 carta del mazo." });
    await hostSends(mine);

    expect(document.querySelector("[data-rival-panel]")).toBeNull();
    expect(screen.getByText("Poder de Vireo")).toBeInTheDocument();
  });
});
