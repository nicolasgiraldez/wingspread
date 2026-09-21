import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialState, speciesCards } from "../../game";
import type { GameState } from "../../game";
import { NO_CHANGES, resourceKey, slotKey } from "../boardChanges";
import type { BoardChanges } from "../boardChanges";
import { BoardChangesContext } from "../useBoardChanges";
import { BirdCard } from "./BirdCard";
import { BirdFeeder } from "./BirdFeeder";
import { BirdMarket } from "./BirdMarket";
import { GameSidebar } from "./GameSidebar";
import { PlayerBoard } from "./PlayerBoard";
import { CountUp } from "./ui/CountUp";

const changing = (over: Partial<BoardChanges>): BoardChanges => ({ ...NO_CHANGES, id: 1, active: true, ...over });

const inChanges = (changes: BoardChanges, ui: React.ReactNode) => (
  <BoardChangesContext.Provider value={changes}>{ui}</BoardChangesContext.Provider>
);

function soloState(): GameState {
  const state = createInitialState({
    mode: "solo",
    playerIds: ["nico", "bot"],
    customPlayerNames: { nico: "Lucía", bot: "Rival (IA)" },
    firstPlayerId: "nico",
  });
  state.phase = "round";
  return state;
}

describe("comedero", () => {
  const feederProps = { onTakeDie: vi.fn(), onReroll: vi.fn() };

  it("sin cambios dibuja solo los dados, sin ningún dado que se despide", () => {
    const { container } = render(<BirdFeeder feeder={["seed", "fish"]} {...feederProps} />);
    expect(container.querySelectorAll("button.die-token")).toHaveLength(2);
    expect(container.querySelector(".die-token--ghost")).toBeNull();
    expect(container.querySelector(".die-token--rolled")).toBeNull();
  });

  it("el dado que salió se dibuja en su lugar de antes, decorativo y sin poder tocarse", () => {
    const changes = changing({ feeder: { taken: [{ index: 1, face: "fish" }], rolled: false } });
    const { container } = render(inChanges(changes, <BirdFeeder feeder={["seed", "insect"]} {...feederProps} />));
    const cells = [...container.querySelectorAll(".feeder__dice > .die-token")];
    expect(cells.map((c) => c.tagName)).toEqual(["BUTTON", "SPAN", "BUTTON"]);
    expect(cells[1]).toHaveClass("die-token--ghost");
    expect(cells[1]).toHaveAttribute("aria-hidden", "true");
    // Los botones reales siguen siendo los de los dados que quedan, con sus posiciones de ahora.
    expect(screen.getAllByRole("button").map((b) => b.textContent?.trim())).toEqual(["Semilla", "Insecto"]);
  });

  it("tocar un dado después de un dado que salió toma el dado correcto", async () => {
    const onTakeDie = vi.fn();
    const changes = changing({ feeder: { taken: [{ index: 0, face: "seed" }], rolled: false } });
    render(inChanges(changes, <BirdFeeder feeder={["fish", "insect"]} onTakeDie={onTakeDie} onReroll={vi.fn()} />));
    screen.getByRole("button", { name: "Insecto" }).click();
    expect(onTakeDie).toHaveBeenCalledWith(1);
  });

  it("con los dados relanzados, todos llevan su animación escalonada", () => {
    const changes = changing({ feeder: { taken: [], rolled: true } });
    const { container } = render(inChanges(changes, <BirdFeeder feeder={["seed", "fish", "insect"]} {...feederProps} />));
    const rolled = container.querySelectorAll<HTMLElement>("button.die-token--rolled");
    expect(rolled).toHaveLength(3);
    expect(rolled[2].style.getPropertyValue("--i")).toBe("2");
  });
});

describe("cartas", () => {
  const card = speciesCards.baldEagle;

  it("los huevos nuevos son los últimos de los puestos, no todos", () => {
    const { container } = render(<BirdCard card={{ ...card, eggCapacity: 5 }} mode="board" eggs={3} newEggs={2} />);
    const eggs = [...container.querySelectorAll(".bird-card__eggs .icon")];
    expect(eggs).toHaveLength(5);
    expect(eggs.map((e) => e.classList.contains("egg-pop"))).toEqual([false, true, true, false, false]);
  });

  it("una carta que llega entra con animación; sin llegar, no", () => {
    const { container, rerender } = render(<BirdCard card={card} mode="hand" />);
    expect(container.querySelector(".bird-card-wrap--enter")).toBeNull();
    rerender(<BirdCard card={card} mode="hand" entering />);
    expect(container.querySelector(".bird-card-wrap--enter")).not.toBeNull();
  });

  it("solo entran las cartas del mercado que llegaron en la última jugada", () => {
    const state = soloState();
    const [first, second] = state.market;
    const changes = changing({ cards: new Set([second]) });
    const { container } = render(
      inChanges(
        changes,
        <BirdMarket
          marketCardIds={[first, second]}
          cardsCatalog={state.cards}
          deckCount={10}
          onDrawMarketCard={vi.fn()}
          onDrawFromDeck={vi.fn()}
        />,
      ),
    );
    const wraps = [...container.querySelectorAll(".market .bird-card-wrap")];
    expect(wraps.map((w) => w.classList.contains("bird-card-wrap--enter"))).toEqual([false, true]);
  });
});

describe("tablero", () => {
  it("el ave nueva y sus huevos se marcan solo en la ranura que cambió", () => {
    const state = soloState();
    const [a, b] = state.players.nico.hand;
    state.players.nico.board.forest[0] = { cardId: a, eggs: 1, cached: [], tucked: [] };
    state.players.nico.board.forest[1] = { cardId: b, eggs: 1, cached: [], tucked: [] };
    const changes = changing({
      birds: new Set([slotKey("nico", "forest", 0)]),
      eggs: new Map([[slotKey("nico", "forest", 1), 1]]),
    });
    const { container } = render(inChanges(changes, <PlayerBoard player={state.players.nico} gameState={state} isCurrentPlayerTurn />));
    const slots = [...container.querySelectorAll(".habitat-row--forest .slot--filled")];
    expect(slots.map((s) => s.classList.contains("slot--new"))).toEqual([true, false]);
    expect(container.querySelectorAll(".egg-pop")).toHaveLength(1);
    expect(slots[1].querySelector(".egg-pop")).not.toBeNull();
  });
});

describe("lateral", () => {
  const props = (state: GameState, activeTab = "nico") => ({
    gameState: state,
    localPlayerId: "nico",
    activeTab,
    onSelectPlayer: () => {},
    selectedCard: null,
    playBlockedReason: null,
    onPlayCard: () => {},
  });

  it("la reserva marca el alimento que subió y los huevos puestos, del jugador que se está viendo", () => {
    const state = soloState();
    const changes = changing({
      resources: new Set([resourceKey("nico", "fish")]),
      eggs: new Map([[slotKey("nico", "grassland", 0), 2]]),
    });
    const { container } = render(inChanges(changes, <GameSidebar {...props(state)} />));
    const bumped = [...container.querySelectorAll(".reserve__tile--bump")].map((el) => el.getAttribute("title"));
    expect(bumped).toEqual(["pez", "Huevos en el tablero"]);
  });

  it("no marca la reserva de un jugador distinto del que se ve", () => {
    const state = soloState();
    const changes = changing({ resources: new Set([resourceKey("bot", "seed")]) });
    const { container } = render(inChanges(changes, <GameSidebar {...props(state)} />));
    expect(container.querySelector(".reserve__tile--bump")).toBeNull();
  });

  it("el cubo que se acaba de gastar es el de su posición, y solo si sigue siendo su turno", () => {
    const state = soloState();
    state.players.nico.actionCubesAvailable = 5;
    const changes = changing({ spentCube: { playerId: "nico", index: 5 } });
    const { container, unmount } = render(inChanges(changes, <GameSidebar {...props(state)} />));
    const cubes = [...container.querySelectorAll(".cubes .cube")];
    expect(cubes.map((c) => c.classList.contains("cube--just-spent"))).toEqual([false, false, false, false, false, true, false, false]);
    unmount();

    const rivalTurn = structuredClone(state);
    rivalTurn.currentPlayerId = "bot";
    const other = render(inChanges(changes, <GameSidebar {...props(rivalTurn)} />));
    expect(other.container.querySelector(".cube--just-spent")).toBeNull();
  });
});

describe("CountUp", () => {
  it("al montarse muestra el valor sin animar, y lee siempre el valor final", () => {
    const { container } = render(<CountUp value={7} />);
    expect(container.querySelector("[aria-hidden]")).toHaveTextContent("7");
    expect(container.querySelector(".sr-only")).toHaveTextContent("7");
  });

  it("cuenta hacia el valor nuevo hasta llegar", async () => {
    const { container, rerender } = render(<CountUp value={2} />);
    rerender(<CountUp value={11} />);
    // El lector de pantalla ya tiene el valor final; el visible lo alcanza al terminar.
    expect(container.querySelector(".sr-only")).toHaveTextContent("11");
    await waitFor(() => expect(container.querySelector("[aria-hidden]")).toHaveTextContent("11"), { timeout: 2000 });
  });
});
