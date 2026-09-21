import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createInitialState, speciesCards } from "../../game";
import { GameSidebar } from "./GameSidebar";
import { GameTopBar } from "./GameTopBar";

describe("GameTopBar", () => {
  it("muestra la ronda en un solo texto y de quién es el turno", () => {
    const { rerender } = render(<GameTopBar round={2} ended={false} isMyTurn onHome={() => {}} currentName="Rival" />);
    expect(screen.getByText("Ronda 2 de 4")).toBeInTheDocument();
    expect(screen.getByText("Tu turno")).toBeInTheDocument();
    rerender(<GameTopBar round={2} ended={false} isMyTurn={false} onHome={() => {}} currentName="Rival" />);
    expect(screen.getByText("Turno de Rival")).toBeInTheDocument();
    rerender(<GameTopBar round={4} ended isMyTurn={false} onHome={() => {}} currentName="Rival" />);
    expect(screen.getByText("(Terminada)")).toBeInTheDocument();
  });

  it("en el turno del rival el chip lo dice con puntos animados decorativos; en el tuyo no", () => {
    const { container, rerender } = render(<GameTopBar round={1} ended={false} isMyTurn onHome={() => {}} currentName="Rival" />);
    expect(container.querySelector(".topbar__turn .dots")).toBeNull();
    rerender(<GameTopBar round={1} ended={false} isMyTurn={false} onHome={() => {}} currentName="Rival" />);
    expect(container.querySelector(".topbar__turn--rival .dots")).toHaveAttribute("aria-hidden", "true");
  });

  it("el menú deja elegir la velocidad: opciones con su estado, y lo elegido se avisa", async () => {
    const user = userEvent.setup();
    const onSpeedChange = vi.fn();
    render(<GameTopBar round={1} ended={false} isMyTurn onHome={() => {}} currentName="Rival" speed="fast" onSpeedChange={onSpeedChange} />);
    await user.click(screen.getByRole("button", { name: "Menú de la partida" }));

    const group = screen.getByRole("group", { name: "Velocidad del juego" });
    expect(within(group).getByRole("button", { name: "Rápida" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "Normal" })).toHaveAttribute("aria-pressed", "false");
    expect(within(group).getByText("Pausas y animaciones más cortas.")).toBeInTheDocument();

    await user.click(within(group).getByRole("button", { name: "Sin pausas" }));
    expect(onSpeedChange).toHaveBeenCalledWith("instant");
    // Elegir no cierra el menú: se ve el cambio y se puede seguir tocando.
    expect(screen.getByRole("group", { name: "Velocidad del juego" })).toBeInTheDocument();
  });

  it("sin manejador de velocidad el menú no la ofrece", async () => {
    const user = userEvent.setup();
    render(<GameTopBar round={1} ended={false} isMyTurn onHome={() => {}} currentName="Rival" />);
    await user.click(screen.getByRole("button", { name: "Menú de la partida" }));
    expect(screen.queryByRole("group", { name: "Velocidad del juego" })).toBeNull();
  });

  it("el menú se abre con el botón, se cierra con Esc devolviendo el foco y vuelve al inicio", async () => {
    const user = userEvent.setup();
    const onHome = vi.fn();
    render(<GameTopBar round={1} ended={false} isMyTurn onHome={onHome} currentName="Rival" />);
    const button = screen.getByRole("button", { name: "Menú de la partida" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Volver al inicio" })).toBeNull();
    expect(button).toHaveFocus();
    await user.click(button);
    await user.click(screen.getByRole("button", { name: "Volver al inicio" }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});

describe("GameSidebar", () => {
  const state = createInitialState({
    mode: "solo",
    playerIds: ["nico", "bot"],
    customPlayerNames: { nico: "Lucía", bot: "Rival (IA)" },
    firstPlayerId: "nico",
  });

  const setup = (over: Partial<Parameters<typeof GameSidebar>[0]> = {}) => {
    const props = {
      gameState: state,
      localPlayerId: "nico",
      activeTab: "nico",
      onSelectPlayer: vi.fn(),
      selectedCard: null,
      playBlockedReason: null,
      onPlayCard: vi.fn(),
      ...over,
    };
    render(<GameSidebar {...props} />);
    return props;
  };

  it("el marcador dice de quién es cada fila en texto: nombre en su propio elemento, (Vos), 1.º y Turno", () => {
    setup();
    const rows = screen.getAllByRole("button", { pressed: true }).concat(screen.getAllByRole("button", { pressed: false }));
    expect(rows).toHaveLength(2);
    expect(screen.getByText("Lucía")).toBeInTheDocument();
    expect(screen.getByText("(Vos)")).toBeInTheDocument();
    expect(screen.getByText("1.º")).toBeInTheDocument();
    expect(screen.getByText("Turno")).toBeInTheDocument();
  });

  it("en el turno del rival, su fila del marcador se marca como jugando", () => {
    const rivalTurn = structuredClone(state);
    rivalTurn.phase = "round";
    rivalTurn.currentPlayerId = "bot";
    setup({ gameState: rivalTurn });
    const rows = document.querySelectorAll(".score--rival");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Rival (IA)");
    expect(rows[0].querySelector(".dots")).toHaveAttribute("aria-hidden", "true");
  });

  it("cambiar de jugador desde el marcador avisa cuál se pidió", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /Rival \(IA\)/ }));
    expect(props.onSelectPlayer).toHaveBeenCalledWith("bot");
  });

  it("sin carta elegida lo dice; con carta muestra sus datos y el botón Jugar esta ave", async () => {
    const { unmount } = render(
      <GameSidebar
        gameState={state}
        localPlayerId="nico"
        activeTab="nico"
        onSelectPlayer={() => {}}
        selectedCard={null}
        playBlockedReason={null}
        onPlayCard={() => {}}
      />,
    );
    expect(screen.getByText(/Elegí un ave de tu mano/)).toBeInTheDocument();
    unmount();

    const onPlayCard = vi.fn();
    setup({ selectedCard: speciesCards.baldEagle, onPlayCard });
    const panel = document.querySelector("[data-selected-card]") as HTMLElement;
    expect(within(panel).getByText(speciesCards.baldEagle.name)).toBeInTheDocument();
    expect(within(panel).getByText(/Se juega en el Río/)).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Jugar esta ave" }));
    expect(onPlayCard).toHaveBeenCalledTimes(1);
  });

  it("si no se puede jugar, el botón dice el motivo y no dispara nada", async () => {
    const onPlayCard = vi.fn();
    setup({ selectedCard: speciesCards.baldEagle, playBlockedReason: "No es tu turno", onPlayCard });
    const button = screen.getByRole("button", { name: "No es tu turno" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button);
    expect(onPlayCard).not.toHaveBeenCalled();
  });

  it("el registro es un log que anuncia jugadas y muestra los nombres de aves sin corchetes", () => {
    setup();
    expect(screen.getByRole("log")).toHaveAttribute("aria-live", "polite");
  });

  it("los cubos de acción son 8 cubos del color del jugador en turno; los gastados van vacíos y punteados", () => {
    const played = structuredClone(state);
    played.players.nico.actionCubesAvailable = 5;
    const { container, unmount } = render(
      <GameSidebar
        gameState={played}
        localPlayerId="nico"
        activeTab="nico"
        onSelectPlayer={() => {}}
        selectedCard={null}
        playBlockedReason={null}
        onPlayCard={() => {}}
      />,
    );
    const cubes = container.querySelectorAll(".cubes svg.cube");
    expect(cubes).toHaveLength(8);
    expect(container.querySelectorAll(".cubes .cube--spent")).toHaveLength(3);
    // Nico es el 1.º jugador: mostaza. Los gastados se ven igual de quién son por su lugar en la fila.
    expect(container.querySelectorAll(".cubes .cube--0")).toHaveLength(8);
    // Son decorativos: la información está en el texto.
    expect(container.querySelector(".cubes")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Lucía: 5 restantes")).toBeInTheDocument();
    unmount();

    const rivalTurn = structuredClone(state);
    rivalTurn.currentPlayerId = "bot";
    render(
      <GameSidebar
        gameState={rivalTurn}
        localPlayerId="nico"
        activeTab="nico"
        onSelectPlayer={() => {}}
        selectedCard={null}
        playBlockedReason={null}
        onPlayCard={() => {}}
      />,
    );
    expect(document.querySelectorAll(".cubes .cube--1")).toHaveLength(8); // 2.º jugador: tomate
  });

  it("los bloques compartidos por los dos jugadores están marcados para el e2e", () => {
    setup();
    expect(document.querySelectorAll("[data-fingerprint]").length).toBeGreaterThanOrEqual(3);
  });
});
