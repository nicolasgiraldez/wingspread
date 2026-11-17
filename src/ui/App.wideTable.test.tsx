import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { applyMove, createInitialState } from "../game";
import type { GameState } from "../game";
import { nextActor, randomMove, withSeededRandom } from "../game/simulation";
import { saveGame } from "./savedGame";
import { App } from "./App";

/** Simula una pantalla de escritorio: la media query de la mesa ancha (y la de alto, si se pide) se cumplen. */
function stubScreen({ wide, tall = false }: { wide: boolean; tall?: boolean }) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width: 1280px") ? wide : query.includes("min-height: 1000px") ? tall : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** Partida solitaria ya empezada (preparación terminada), con aves en la mano y el turno del jugador. */
function gameOnMyTurn(): GameState {
  return withSeededRandom(5, () => {
    let state = createInitialState({ mode: "solo", playerIds: ["nico", "bot"], customPlayerNames: { nico: "Lucía" }, firstPlayerId: "nico" });
    for (let i = 0; i < 4 && state.phase === "setup"; i += 1) {
      const actor = nextActor(state);
      if (!actor) break;
      state = applyMove(state, actor, randomMove(state, actor)!);
    }
    // Siempre con aves en la mano (la preparación al azar puede no conservar ninguna).
    const drawn = state.deck.slice(0, 2);
    const nico = state.players.nico;
    return {
      ...state,
      deck: state.deck.slice(2),
      players: { ...state.players, nico: { ...nico, hand: [...nico.hand, ...drawn] } },
    };
  });
}

async function openSavedGame(state: GameState) {
  saveGame({ kind: "solo", state, savedAt: Date.now() });
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByText("Mercado de Aves");
  return user;
}

describe("mesa ancha de escritorio", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("pone el comedero y el mercado en una columna aparte y la mano fija abajo", async () => {
    stubScreen({ wide: true });
    const state = gameOnMyTurn();
    await openSavedGame(state);

    const supply = screen.getByRole("complementary", { name: "Comedero y mercado" });
    expect(within(supply).getByRole("heading", { name: "Comedero de Aves" })).toBeInTheDocument();
    expect(within(supply).getByRole("heading", { name: "Mercado de Aves" })).toBeInTheDocument();
    expect(document.querySelector(".game--wide")).not.toBeNull();
    expect(document.querySelector(".hand--dock")).not.toBeNull();
    // El banner de turno sobra: la barra superior ya dice de quién es el turno.
    expect(document.querySelector(".banner--turn")).toBeNull();
  });

  it("el objetivo de la ronda va plegado y se despliega con sus 4 rondas", async () => {
    stubScreen({ wide: true });
    const state = gameOnMyTurn();
    const user = await openSavedGame(state);

    const strip = screen.getByRole("region", { name: /Objetivo · Ronda 1/ });
    expect(within(strip).getByText(state.roundGoals[0].name)).toBeInTheDocument();
    const toggle = within(strip).getByRole("button", { name: "Ver los 4 objetivos" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(strip).queryByText("Ronda 4")).toBeNull();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(strip).getByText("Ronda 4")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(within(strip).queryByText("Ronda 4")).toBeNull();
  });

  it("las cartas compactas muestran el texto del poder en una vista previa al pasar el puntero", async () => {
    stubScreen({ wide: true });
    const state = gameOnMyTurn();
    await openSavedGame(state);

    const handCards = document.querySelectorAll(".hand--dock .peek");
    expect(handCards.length).toBe(state.players.nico.hand.length);
    expect(handCards.length).toBeGreaterThan(0);
    expect(document.querySelector(".card-peek")).toBeNull();

    act(() => {
      fireEvent.mouseEnter(handCards[0]);
    });
    const peek = document.querySelector(".card-peek");
    expect(peek).not.toBeNull();
    expect(peek).toHaveAttribute("aria-hidden", "true");
    expect(peek!.querySelector(".bird-card--hand")).not.toBeNull();

    act(() => {
      fireEvent.mouseLeave(handCards[0]);
    });
    expect(document.querySelector(".card-peek")).toBeNull();
  });

  it("con la ventana angosta sigue la mesa apilada de siempre", async () => {
    stubScreen({ wide: false });
    await openSavedGame(gameOnMyTurn());
    expect(screen.queryByRole("complementary", { name: "Comedero y mercado" })).toBeNull();
    expect(document.querySelector(".game--wide")).toBeNull();
    expect(screen.getByRole("heading", { name: "Objetivos de Ronda" })).toBeInTheDocument();
  });
});
