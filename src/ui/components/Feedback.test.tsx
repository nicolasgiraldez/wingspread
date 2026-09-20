import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyLog } from "../logEvents";
import { isSaveBlocked, saveGame } from "../savedGame";
import { createInitialState } from "../../game";
import { ConnectionStatusBar } from "./ConnectionStatusBar";
import { ToastRegion } from "./Toast";
import type { ToastData } from "./Toast";

describe("classifyLog", () => {
  it("reconoce poderes, caza, huevos y mensajes del sistema", () => {
    expect(classifyLog({ playerId: "nico", message: "Poder de [Vireo de Bell]: reveló 2 cartas." })).toMatchObject({
      kind: "power",
      bird: "Vireo de Bell",
      text: "reveló 2 cartas.",
    });
    expect(classifyLog({ playerId: "bot", message: "Depredador [Búho Barrado]: ¡Caza exitosa! Reveló a [X]." }).kind).toBe("hunt");
    expect(classifyLog({ playerId: "bot", message: "Depredador [Fumarel Negro]: Caza fallida (nada)." }).kind).toBe("miss");
    expect(classifyLog({ playerId: "nico", message: "Puso 2 huevos." }).kind).toBe("eggs");
    expect(classifyLog({ message: "Partida iniciada." }).kind).toBe("system");
    expect(classifyLog({ playerId: "nico", message: "Jugó un ave." }).kind).toBe("move");
  });
});

const toast = (over: Partial<ToastData>): ToastData => ({ id: 1, kind: "turn", title: "Es tu turno", ...over });

describe("ToastRegion", () => {
  afterEach(() => vi.useRealTimers());

  it("los avisos son status, se cierran solos a los 5 s y no roban el foco", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<ToastRegion toasts={[toast({ text: "Tomá una acción" })]} onDismiss={onDismiss} />);
    expect(screen.getByRole("status")).toHaveTextContent("Es tu turno");
    expect(document.activeElement).toBe(document.body);
    act(() => vi.advanceTimersByTime(4900));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(onDismiss).toHaveBeenCalledWith(1);
  });

  it("los errores son alert, no se cierran solos y traen su acción", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onDismiss = vi.fn();
    const retry = vi.fn();
    render(
      <ToastRegion
        toasts={[toast({ kind: "err", title: "Sin conexión con el anfitrión", action: { label: "Reintentar", onClick: retry } })]}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Sin conexión con el anfitrión");
    act(() => vi.advanceTimersByTime(20_000));
    expect(onDismiss).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("muestra como máximo 3 avisos y cada uno se puede cerrar", async () => {
    const onDismiss = vi.fn();
    const toasts = [4, 3, 2, 1].map((id) => toast({ id, title: `Aviso ${id}` }));
    render(<ToastRegion toasts={toasts} onDismiss={onDismiss} />);
    expect(screen.getAllByRole("status")).toHaveLength(3);
    const close = screen.getAllByRole("button", { name: "Cerrar aviso" })[0];
    await userEvent.click(close);
    expect(onDismiss).toHaveBeenCalledWith(4);
  });
});

describe("ConnectionStatusBar", () => {
  const bar = (status: Parameters<typeof ConnectionStatusBar>[0]["status"]) => (
    <ConnectionStatusBar roomCode="halcon-428" isHost status={status} localPlayerName="Nico" />
  );

  it.each([
    ["connected", "Conectado en vivo"],
    ["waiting_for_opponent", "Esperando oponente..."],
    ["connecting", "Conectando..."],
    ["error", "Desconectado"],
  ] as const)("el estado %s se dice con texto", (status, text) => {
    render(bar(status));
    expect(screen.getByRole("status")).toHaveTextContent(text);
    expect(screen.getByText("halcon-428").tagName).toBe("STRONG");
    expect(screen.getByText("Nico (Host)")).toBeInTheDocument();
  });

  it("si no se puede copiar el enlace, ofrece un campo de solo lectura para copiarlo a mano", async () => {
    const user = userEvent.setup();
    render(bar("connected"));
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denegado"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await user.click(screen.getByRole("button", { name: "Copiar enlace de sala" }));
    const field = await screen.findByLabelText("No se pudo copiar el enlace. Copialo a mano:");
    expect(field).toHaveAttribute("readonly");
    expect((field as HTMLInputElement).value).toContain("?room=halcon-428");
  });
});

describe("guardado bloqueado", () => {
  afterEach(() => vi.restoreAllMocks());

  it("saveGame avisa cuando el navegador no deja guardar y se recupera cuando vuelve a poder", () => {
    const state = createInitialState({ mode: "solo", playerIds: ["nico", "bot"] });
    const game = { kind: "solo" as const, state, savedAt: Date.now() };
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(saveGame(game)).toBe(false);
    expect(isSaveBlocked()).toBe(true);
    spy.mockRestore();
    expect(saveGame(game)).toBe(true);
    expect(isSaveBlocked()).toBe(false);
  });
});
