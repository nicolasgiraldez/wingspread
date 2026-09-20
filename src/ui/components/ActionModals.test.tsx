import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "../../game";
import { GameOverModal } from "./GameOverModal";
import { LayEggsModal } from "./LayEggsModal";
import { PlayBirdModal } from "./PlayBirdModal";

const state = createInitialState({
  mode: "solo",
  playerIds: ["nico", "bot"],
  customPlayerNames: { nico: "Lucía", bot: "Rival (IA)" },
});

describe("LayEggsModal", () => {
  it("sin aves en el tablero explica qué hacer y solo ofrece cancelar", async () => {
    const onClose = vi.fn();
    render(
      <LayEggsModal player={state.players.nico} gameState={state} onConfirmLayEggs={() => {}} onClose={onClose} />,
    );
    const dialog = screen.getByRole("dialog", { name: "Poner Huevos (Acción de Pradera)" });
    expect(within(dialog).getByText("No tenés aves jugadas en tu tablero para poner huevos.")).toBeInTheDocument();
    expect(within(dialog).getByText("Primero tenés que jugar aves en cualquiera de tus hábitats.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Confirmar/ })).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("PlayBirdModal", () => {
  it("es un diálogo con los pasos numerados y un botón de confirmar que dice por qué está deshabilitado", () => {
    const card = state.cards[state.players.nico.hand[0]];
    render(
      <PlayBirdModal card={card} player={state.players.nico} gameState={state} onConfirmPlay={() => {}} onClose={() => {}} />,
    );
    const dialog = screen.getByRole("dialog", { name: `Jugar Ave: ${card.name}` });
    expect(within(dialog).getByText("1. Seleccioná el Hábitat")).toBeInTheDocument();
    expect(within(dialog).getByText("2. Pago de Alimentos")).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Confirmar y Jugar Ave" });
    if (confirm.getAttribute("aria-disabled") === "true") {
      expect(confirm).toHaveAccessibleDescription(/\S+/);
    }
  });
});

describe("GameOverModal", () => {
  it("es una tabla real con encabezados, el ganador en texto y el total de cada uno", () => {
    render(<GameOverModal gameState={{ ...state, phase: "gameEnd" }} onRestart={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /^¡(Victoria de .+|Empate)!$/ })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Puntuación final por categoría" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
    expect(within(table).getAllByRole("rowheader").length).toBeGreaterThanOrEqual(7);
    expect(within(table).getByRole("rowheader", { name: "Puntuación total" })).toBeInTheDocument();
  });

  it("Jugar otra partida llama al reinicio", async () => {
    const onRestart = vi.fn();
    render(<GameOverModal gameState={{ ...state, phase: "gameEnd" }} onRestart={onRestart} />);
    await userEvent.click(screen.getByRole("button", { name: "Jugar Otra Partida" }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
