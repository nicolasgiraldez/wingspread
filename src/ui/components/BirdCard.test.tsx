import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { speciesCards } from "../../game";
import type { SpeciesCard } from "../../game";
import { BirdCard } from "./BirdCard";
import { CARD_MODES } from "./cardModes";
import { HabitatScene } from "./HabitatScene";

const card = (over: Partial<SpeciesCard>): SpeciesCard => ({
  id: "sinImagen",
  name: "Ave de prueba",
  habitats: ["forest"],
  cost: {},
  points: 3,
  eggCapacity: 2,
  nestType: "bowl",
  powers: [],
  ...over,
});

describe("BirdCard", () => {
  it("tiene un nombre accesible con nombre, puntos, coste y poder", () => {
    const eagle = speciesCards.baldEagle;
    render(<BirdCard card={eagle} mode="full" />);
    const group = screen.getByRole("group");
    const label = group.getAttribute("aria-label") ?? "";
    expect(label).toContain(eagle.name);
    expect(label).toContain(`${eagle.points} puntos`);
    expect(label).toContain("Coste:");
    expect(label).toContain("Al jugar");
  });

  it("sin coste muestra el chip Gratis; con alternativas las separa con /", () => {
    const { rerender, container } = render(<BirdCard card={card({})} mode="full" />);
    expect(screen.getByText("Gratis")).toBeInTheDocument();
    rerender(<BirdCard card={card({ cost: { insect: 1 }, costAnyOf: ["seed", "fish"] })} mode="full" />);
    expect(screen.queryByText("Gratis")).toBeNull();
    const cost = container.querySelector(".bird-card__cost")!;
    expect(cost.querySelectorAll("svg")).toHaveLength(3);
    expect(cost.textContent?.replace(/\s+/g, "")).toBe("+/");
  });

  it("board y mini ocultan el coste salvo showCost", () => {
    const c = card({ cost: { fruit: 2 } });
    const { container, rerender } = render(<BirdCard card={c} mode="board" />);
    expect(container.querySelector(".bird-card__cost")).toBeNull();
    rerender(<BirdCard card={c} mode="board" showCost />);
    expect(container.querySelector(".bird-card__cost")).not.toBeNull();
    rerender(<BirdCard card={c} mode="hand" />);
    expect(container.querySelector(".bird-card__cost")).not.toBeNull();
  });

  it("sin poder muestra la banda neutra; con poder, la etiqueta del timing en texto", () => {
    const { rerender } = render(<BirdCard card={card({})} mode="hand" />);
    expect(screen.getByText("Sin poder")).toBeInTheDocument();
    rerender(
      <BirdCard
        card={card({ powers: [{ id: "p1", timing: "onceBetweenTurns", kind: "layEgg", target: "self", amount: 1 } as never] })}
        mode="hand"
      />,
    );
    expect(screen.getByText("Entre turnos")).toBeInTheDocument();
  });

  it("sin ilustración usa la silueta y, solo en full, el texto 'Ilustración pendiente'", () => {
    const { rerender, container } = render(<BirdCard card={card({})} mode="full" />);
    expect(container.querySelector(".bird-card__silhouette")).not.toBeNull();
    expect(screen.getByText("Ilustración pendiente")).toBeInTheDocument();
    rerender(<BirdCard card={card({})} mode="hand" />);
    expect(screen.queryByText("Ilustración pendiente")).toBeNull();
  });

  it("con ilustración usa el nombre del ave como alt", () => {
    render(<BirdCard card={speciesCards.baldEagle} mode="hand" />);
    expect(screen.getByAltText(speciesCards.baldEagle.name)).toBeInTheDocument();
  });

  it("dibuja un huevo por unidad de capacidad, llenos los puestos y vacíos el resto", () => {
    const { container } = render(<BirdCard card={card({ eggCapacity: 4 })} mode="hand" eggs={1} />);
    const eggs = container.querySelector(".bird-card__eggs")!;
    expect(eggs.querySelectorAll("svg")).toHaveLength(4);
    expect(eggs.querySelectorAll(".icon")[0]).not.toHaveStyle({ "--egg-fill": "var(--c-crema-2)" });
    expect(eggs.querySelectorAll(".icon")[1]).toHaveStyle({ "--egg-fill": "var(--c-crema-2)" });
    expect(eggs).toHaveAttribute("title", "Capacidad: 4 huevos");
  });

  it("es un botón con aria-pressed cuando se puede elegir, y marca el anillo al seleccionarse", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<BirdCard card={card({})} mode="full" selected={false} onClick={onClick} />);
    const button = screen.getByRole("button", { name: /Ave de prueba/ });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<BirdCard card={card({})} mode="full" selected onClick={onClick} />);
    expect(screen.getByRole("button", { name: /Ave de prueba/ })).toHaveClass("is-selected");
  });

  it("el botón de acción es independiente de la carta", async () => {
    const onAction = vi.fn();
    render(<BirdCard card={card({})} mode="hand" actionLabel="Jugar esta ave" onAction={onAction} />);
    await userEvent.click(screen.getByRole("button", { name: "Jugar esta ave" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("marca con una palabra las aves que cuentan para tu bonificación", () => {
    render(<BirdCard card={card({ nameTags: ["color"] })} mode="hand" highlightNameTags={["color"]} />);
    expect(screen.getByText("Fotógrafo")).toBeInTheDocument();
  });

  it("las medidas de cada modo son las del diseño", () => {
    expect(CARD_MODES.full).toMatchObject({ w: 264, h: 400, win: 196 });
    expect(CARD_MODES.hand).toMatchObject({ w: 192, h: 290, win: 146 });
    expect(CARD_MODES.board).toMatchObject({ w: 132, h: 200, win: 108 });
    expect(CARD_MODES.mini).toMatchObject({ w: 114, h: 160, win: 80 });
  });
});

describe("HabitatScene", () => {
  it("un hábitat no usa recortes; dos y tres usan un clipPath por franja con id propio", () => {
    const { container, rerender } = render(<HabitatScene habitats={["forest"]} width={260} height={194} />);
    expect(container.querySelectorAll("clipPath")).toHaveLength(0);
    rerender(<HabitatScene habitats={["forest", "grassland"]} width={260} height={194} />);
    expect(container.querySelectorAll("clipPath")).toHaveLength(2);
    rerender(<HabitatScene habitats={["forest", "grassland", "wetland"]} width={260} height={194} />);
    const ids = Array.from(container.querySelectorAll("clipPath")).map((el) => el.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it("dos cartas con el mismo hábitat no comparten ids de recorte", () => {
    const { container } = render(
      <>
        <HabitatScene habitats={["forest", "wetland"]} width={260} height={194} />
        <HabitatScene habitats={["forest", "wetland"]} width={260} height={194} />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("clipPath")).map((el) => el.id);
    expect(new Set(ids).size).toBe(4);
  });

  it("no usa colores literales: todo sale de tokens", () => {
    const { container } = render(<HabitatScene habitats={["forest", "grassland", "wetland"]} width={260} height={194} />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
