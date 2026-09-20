import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";

describe("HomePage", () => {
  it("sin nombre los modos avisan por qué no avanzan y no empiezan nada", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<HomePage onStart={onStart} />);

    const solo = screen.getByRole("button", { name: /Modo Solitario/ });
    expect(solo).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Ingresá tu nombre para comenzar")).toBeInTheDocument();

    await user.click(solo);
    expect(screen.getByRole("alert")).toHaveTextContent("Escribí tu nombre para poder jugar.");
    expect(screen.getByLabelText("¿Cómo te llamás?")).toHaveAttribute("aria-invalid", "true");
    expect(onStart).not.toHaveBeenCalled();
  });

  it("con nombre empieza una partida solitaria con la dificultad elegida", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<HomePage onStart={onStart} />);

    await user.type(screen.getByPlaceholderText("Escribí tu nombre..."), "  Nico ");
    await user.click(screen.getByRole("button", { name: /Modo Solitario/ }));

    // La dificultad es un grupo de radios reales con "Normal" elegido por defecto.
    const group = screen.getByRole("group", { name: "Dificultad del rival" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Normal (Águila)" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Difícil (Halcón)" }));

    await user.click(screen.getByRole("button", { name: "Comenzar Partida Solitaria" }));
    expect(onStart).toHaveBeenCalledWith({ mode: "solo", playerName: "Nico", botDifficulty: "hard" });
  });

  it("crear sala usa el nombre y el oponente opcional", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<HomePage onStart={onStart} />);
    await user.type(screen.getByPlaceholderText("Escribí tu nombre..."), "Lucía");
    await user.click(screen.getByRole("button", { name: /Multijugador Online/ }));
    await user.type(screen.getByPlaceholderText(/Nombre de tu amigo/), "Mateo");
    await user.click(screen.getByRole("button", { name: /Crear Sala/ }));
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "online-host", playerName: "Lucía", opponentName: "Mateo" }),
    );
  });

  it("unirse reconoce el enlace de invitación completo y muestra la sala detectada", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<HomePage onStart={onStart} defaultJoinCode="" />);
    await user.type(screen.getByPlaceholderText("Escribí tu nombre..."), "Mateo");
    await user.click(screen.getByRole("button", { name: /Multijugador Online/ }));

    await user.click(screen.getByPlaceholderText(/ej\. halcon-428/));
    await user.paste("https://wingspread.vercel.app/?room=halcon-482");
    expect(screen.getByText(/Te vas a unir a la sala:/)).toHaveTextContent("halcon-482");

    await user.click(screen.getByRole("button", { name: /Unirse/ }));
    expect(onStart).toHaveBeenCalledWith({ mode: "online-join", playerName: "Mateo", roomCode: "halcon-482" });
  });

  it("unirse sin código muestra el error como alerta", async () => {
    const user = userEvent.setup();
    render(<HomePage onStart={vi.fn()} defaultJoinCode="x" />);
    await user.type(screen.getByPlaceholderText("Tu nombre..."), "Mateo");
    await user.clear(screen.getByPlaceholderText(/ej\. halcon-428/));
    await user.click(screen.getByRole("button", { name: /Unirse/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Ingresá un código de sala.");
  });

  it("la portada tiene un único h1 y una ilustración decorativa oculta a lectores de pantalla", () => {
    const { container } = render(<HomePage onStart={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Wingspread" })).toBeInTheDocument();
    expect(container.querySelector(".welcome__art")).toHaveAttribute("aria-hidden", "true");
  });
});
