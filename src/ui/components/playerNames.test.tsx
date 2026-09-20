import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createInitialState } from "../../game";
import { GameOverModal } from "./GameOverModal";
import { RoundGoalsMat } from "./RoundGoalsMat";

/** Partida online con nombres elegidos por los jugadores (no los ids internos "nico"/"santi"). */
const state = createInitialState({
  mode: "online",
  playerIds: ["nico", "santi"],
  customPlayerNames: { nico: "Lucía", santi: "Mateo" },
});

describe("nombres de los jugadores en la interfaz", () => {
  it("la tabla final usa los nombres reales, no Nico/Santi", () => {
    render(<GameOverModal gameState={{ ...state, phase: "gameEnd" }} onRestart={() => {}} />);
    expect(screen.getByText("Lucía")).toBeTruthy();
    expect(screen.getByText("Mateo")).toBeTruthy();
    expect(screen.queryByText("Nico")).toBeNull();
    expect(screen.queryByText("Santi")).toBeNull();
  });

  it("los objetivos de ronda usan los nombres reales", () => {
    render(<RoundGoalsMat gameState={state} />);
    // En cada objetivo el nombre va solo en su propio elemento, junto al símbolo del jugador.
    expect(screen.getAllByText("Lucía").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mateo").length).toBeGreaterThan(0);
    expect(screen.queryByText("Nico")).toBeNull();
  });
});
