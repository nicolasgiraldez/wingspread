import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState, NetworkMessage } from "../game";

// La red se reemplaza por un doble: aquí interesa cómo la anfitriona reparte asientos, nombres y estado.
const network = vi.hoisted(() => {
  const connected: string[] = [];
  return {
    connected,
    initHost: vi.fn(),
    initGuest: vi.fn(),
    cleanup: vi.fn(),
    sendMessage: vi.fn(() => true),
    sendTo: vi.fn((seat: string, message: unknown) => {
      void seat;
      void message;
      return true;
    }),
    connectedSeats: vi.fn(() => [...connected]),
    getSeatTokens: vi.fn((): Record<string, string> => ({})),
    isConnected: vi.fn(() => false),
  };
});
vi.mock("./network/peerManager", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./network/peerManager")>()),
  networkManager: network,
}));

import { App } from "./App";
import { loadSavedGame } from "./savedGame";

type HostHandlers = {
  onMessage: (msg: NetworkMessage, from?: string) => void;
  onPeersChange: (seats: string[]) => void;
};
type Sync = Extract<NetworkMessage, { type: "SYNC_STATE" }>;

describe("anfitriona de una sala de varios jugadores", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    network.connected.length = 0;
  });

  async function hostRoomOf(count: number) {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText("Escribí tu nombre..."), "Lucía");
    await user.click(screen.getByRole("button", { name: /Multijugador Online/ }));
    await user.click(screen.getByRole("radio", { name: `${count} jugadores` }));
    await user.click(screen.getByRole("button", { name: /Crear Sala/ }));

    const handlers = network.initHost.mock.calls[0][1] as HostHandlers;
    const connect = (seat: string) =>
      act(() => {
        network.connected.push(seat);
        handlers.onPeersChange([...network.connected]);
      });
    const lastSyncTo = (seat: string) =>
      network.sendTo.mock.calls.filter(([to]) => to === seat).map(([, message]) => message as Sync).pop();
    return { user, handlers, connect, lastSyncTo };
  }

  it("crea la partida con un asiento por jugador y abre la sala para todos los invitados", async () => {
    await hostRoomOf(5);

    expect(network.initHost).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-z]+-\d{3}$/),
      expect.any(Object),
      expect.objectContaining({ resume: false, guestSeats: ["santi", "p3", "p4", "p5"] }),
    );
    const names = [...document.querySelectorAll(".score-list .score__name > span:first-child")].map((el) => el.textContent);
    expect(names).toEqual(["Lucía", "Jugador 2", "Jugador 3", "Jugador 4", "Jugador 5"]);
    // Todavía no llegó nadie: los cuatro invitados figuran sin conexión.
    expect(screen.getAllByText("Sin conexión")).toHaveLength(4);
    expect(screen.getByText("1 de 5")).toBeInTheDocument();
    expect(loadSavedGame()?.state.playerOrder).toHaveLength(5);
  });

  it("cada invitado que entra recibe el estado con su asiento, y su nombre llega a todos", async () => {
    const { handlers, connect, lastSyncTo } = await hostRoomOf(3);

    await connect("santi");
    expect(lastSyncTo("santi")).toMatchObject({ yourPlayerId: "santi", connectedPlayerIds: ["nico", "santi"] });
    expect(screen.getAllByText("Sin conexión")).toHaveLength(1);

    await connect("p3");
    expect(lastSyncTo("p3")).toMatchObject({ yourPlayerId: "p3", connectedPlayerIds: ["nico", "santi", "p3"] });
    expect(lastSyncTo("santi")).toMatchObject({ yourPlayerId: "santi", connectedPlayerIds: ["nico", "santi", "p3"] });
    expect(screen.queryByText("Sin conexión")).toBeNull();

    await act(() => handlers.onMessage({ type: "GUEST_JOIN", guestName: "  Mateo  " }, "p3"));
    expect(lastSyncTo("santi")!.state.players.p3.name).toBe("Mateo");
    expect(lastSyncTo("santi")!.state.players.santi.name).toBe("Jugador 2");
    expect(screen.getAllByText("Mateo").length).toBeGreaterThan(0);

    // Un mensaje sin asiento (no vino de un invitado sentado) se ignora.
    const sent = network.sendTo.mock.calls.length;
    await act(() => handlers.onMessage({ type: "GUEST_JOIN", guestName: "Intruso" }));
    expect(network.sendTo.mock.calls.length).toBe(sent);
  });

  it("aplica la jugada de un invitado como SU asiento y reparte el resultado; las ilegales solo se le devuelven a él", async () => {
    const { handlers, connect, lastSyncTo } = await hostRoomOf(3);
    await connect("santi");
    await connect("p3");
    const before = lastSyncTo("p3")!.state as GameState;

    // p3 termina su preparación: vale aunque diga ser otro jugador.
    await act(() =>
      handlers.onMessage(
        {
          type: "APPLY_MOVE",
          playerId: "nico",
          move: { type: "chooseStart", keepCards: [], discardFood: [], bonusCardId: before.players.p3.pendingBonusChoice![0] },
        },
        "p3",
      ),
    );
    for (const seat of ["santi", "p3"]) {
      const state = lastSyncTo(seat)!.state;
      expect(state.players.p3.pendingStartingHand).toBeFalsy();
      expect(state.players.nico.pendingStartingHand).toBe(true);
      expect(state.players.santi.pendingStartingHand).toBe(true);
    }

    // Una jugada ilegal (todavía es la preparación): no cambia nada y solo se le reenvía el estado a quien la mandó.
    const toSanti = network.sendTo.mock.calls.filter(([to]) => to === "santi").length;
    const toP3 = network.sendTo.mock.calls.filter(([to]) => to === "p3").length;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await act(() => handlers.onMessage({ type: "APPLY_MOVE", playerId: "p3", move: { type: "rerollFeeder" } }, "p3"));
    expect(network.sendTo.mock.calls.filter(([to]) => to === "santi")).toHaveLength(toSanti);
    expect(network.sendTo.mock.calls.filter(([to]) => to === "p3")).toHaveLength(toP3 + 1);
  });
});
