import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { Field } from "./Field";
import { Icon } from "./Icon";
import { ICON_NAMES } from "./iconNames";
import { Modal } from "./Modal";
import { RichText } from "./RichText";
import { plainText } from "./richTextParts";

describe("Icon", () => {
  it.each(ICON_NAMES)("existe el SVG de %s", (name) => {
    const { container } = render(<Icon name={name} size={20} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("width", "20");
    expect(svg).toHaveAttribute("height", "20");
  });

  it("es decorativo sin label y expone el nombre con label", () => {
    const { container, rerender } = render(<Icon name="seed" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    rerender(<Icon name="seed" label />);
    expect(screen.getByRole("img", { name: "Semilla" })).toBeInTheDocument();
    rerender(<Icon name="seed" label="Comida" />);
    expect(screen.getByRole("img", { name: "Comida" })).toBeInTheDocument();
  });

  it("toma el color del contorno de ink", () => {
    const { container } = render(<Icon name="check" ink="var(--c-petroleo)" />);
    expect(container.querySelector(".icon")).toHaveStyle({ color: "var(--c-petroleo)" });
  });
});

describe("RichText", () => {
  it("dibuja los marcadores como íconos con nombre accesible", () => {
    render(<RichText text="Obtené 1 {seed} o {fruit}" />);
    expect(screen.getAllByRole("img").map((el) => el.getAttribute("aria-label"))).toEqual(["Semilla", "Fruta"]);
  });

  it("plainText reemplaza los marcadores por palabras", () => {
    expect(plainText("Obtené 1 {seed}", { seed: "semilla" })).toBe("Obtené 1 semilla");
  });
});

describe("Button", () => {
  it("deshabilitado bloquea el clic, sigue enfocable y muestra el motivo", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" disabled disabledText="Sin alimento suficiente" onClick={onClick}>
        Jugar esta ave
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Sin alimento suficiente" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("habilitado dispara onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Continuar</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Field", () => {
  it("enlaza etiqueta, ayuda y error con el input", () => {
    render(<Field label="Tu nombre" hint="Como te ven los demás" error="Escribí tu nombre" />);
    const input = screen.getByLabelText("Tu nombre");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Como te ven los demás Escribí tu nombre");
    expect(screen.getByRole("alert")).toHaveTextContent("Escribí tu nombre");
  });
});

describe("Banner", () => {
  it("error es alert y el resto status", () => {
    render(
      <>
        <Banner tone="error" title="Error">
          Sin conexión
        </Banner>
        <Banner tone="info">Esperando al anfitrión...</Banner>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Sin conexión");
    expect(screen.getByRole("status")).toHaveTextContent("Esperando al anfitrión...");
  });
});

describe("Modal", () => {
  function Harness({ required = false }: { required?: boolean }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Abrir</button>
        {open && (
          <Modal title="Jugar Ave" onClose={required ? undefined : () => setOpen(false)} footer={<button>Confirmar</button>}>
            <button>Primero</button>
            <button>Segundo</button>
          </Modal>
        )}
      </>
    );
  }

  it("es un diálogo modal con nombre, foco inicial en el primer control y foco atrapado", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const dialog = screen.getByRole("dialog", { name: "Jugar Ave" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Primero" })).toHaveFocus();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("Esc lo cierra y devuelve el foco al disparador", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Abrir" });
    await user.click(opener);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("un modal obligatorio no se cierra con Esc ni tiene botón de cerrar", async () => {
    const user = userEvent.setup();
    render(<Harness required />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar" })).toBeNull();
  });
});
