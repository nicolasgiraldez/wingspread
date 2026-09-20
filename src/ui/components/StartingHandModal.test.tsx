import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "../../game";
import { ChooseBonusCardModal } from "./ChooseBonusCardModal";
import { StartingHandModal } from "./StartingHandModal";

function setup() {
  const state = createInitialState({
    mode: "solo",
    playerIds: ["nico", "bot"],
    customPlayerNames: { nico: "Lucía" },
  });
  const onConfirm = vi.fn();
  render(<StartingHandModal player={state.players.nico} gameState={state} onConfirm={onConfirm} />);
  return { state, onConfirm, user: userEvent.setup() };
}

describe("StartingHandModal", () => {
  it("es un diálogo obligatorio: tiene nombre, no tiene botón de cerrar y Esc no lo cierra", async () => {
    const { user } = setup();
    expect(screen.getByRole("dialog", { name: "Lucía, prepará tu mano inicial" })).toHaveAttribute("aria-modal", "true");
    expect(screen.queryByRole("button", { name: "Cerrar" })).toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sin bonificación elegida el botón dice por qué no avanza y no confirma", async () => {
    const { user, onConfirm } = setup();
    const confirm = screen.getByRole("button", { name: "Confirmar mano inicial" });
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(confirm).toHaveAccessibleDescription("Elegí una carta de bonificación.");
    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("por cada ave que se conserva hay que descartar una ficha, y cada estado se dice en texto", async () => {
    const { user, state, onConfirm } = setup();
    const birds = screen.getAllByRole("button", { pressed: false }).filter((b) => b.classList.contains("bird-card"));
    expect(birds).toHaveLength(5);
    expect(screen.getAllByText("Se descarta")).toHaveLength(5);

    await user.click(birds[0]);
    expect(screen.getByText("Se conserva", { selector: ".pick__status" })).toBeInTheDocument();
    expect(screen.getByText("1. Aves que conservás (1 de 5)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar mano inicial" })).toHaveAccessibleDescription(
      "Elegí 1 ficha de alimento más para descartar.",
    );

    await user.click(screen.getByRole("button", { name: /Fruta/ }));
    expect(screen.getByRole("button", { name: /Fruta/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("button", { name: /Fruta/ })).getByText("Se descarta")).toBeInTheDocument();

    // Con todas las fichas elegidas, las demás no admiten más descartes.
    await user.click(screen.getByRole("button", { name: /Pez/ }));
    expect(screen.getByRole("button", { name: /Pez/ })).toHaveAttribute("aria-pressed", "false");

    const options = screen.getAllByRole("button", { name: "Elegir esta" });
    expect(options).toHaveLength(2);
    await user.click(options[1]);
    expect(screen.getByRole("button", { name: "Elegida" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Confirmar mano inicial" }));
    expect(onConfirm).toHaveBeenCalledWith({
      type: "chooseStart",
      keepCards: [state.players.nico.hand[0]],
      discardFood: ["fruit"],
      bonusCardId: state.players.nico.pendingBonusChoice![1],
    });
  });
});

describe("ChooseBonusCardModal", () => {
  it("la espera es un diálogo con ícono, título y texto, sin controles ni cierre", () => {
    render(
      <ChooseBonusCardModal
        playerName="Lucía"
        options={[]}
        onChoose={() => {}}
        waiting={{ title: "Preparación lista", text: "Esperando al resto..." }}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Preparación lista" });
    expect(dialog).toHaveTextContent("Esperando al resto...");
    expect(within(dialog).queryAllByRole("button")).toHaveLength(0);
  });
});
