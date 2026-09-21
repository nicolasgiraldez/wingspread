import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSpeed, saveSpeed } from "./gameSpeed";
import { displayMs, holdMs, thinkMs } from "./pacing";

describe("velocidad guardada", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("sin nada guardado es normal, y lo elegido se recuerda", () => {
    expect(loadSpeed()).toBe("normal");
    saveSpeed("fast");
    expect(loadSpeed()).toBe("fast");
    saveSpeed("instant");
    expect(loadSpeed()).toBe("instant");
  });

  it("un valor raro guardado se ignora", () => {
    localStorage.setItem("wingspread.speed.v1", "warp");
    expect(loadSpeed()).toBe("normal");
  });

  it("con el almacenamiento bloqueado no falla: vale para la sesión y se vuelve a normal al recargar", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => saveSpeed("fast")).not.toThrow();
    expect(loadSpeed()).toBe("normal");
  });
});

describe("ritmo según la velocidad", () => {
  const short = { headline: "Jugó [Ave] en el Río.", details: [] };
  const long = { headline: "x".repeat(300), details: [] };

  it("normal es lo de siempre; rápida es la mitad; sin pausas no espera nada", () => {
    expect(thinkMs("normal")).toBe(800);
    expect(thinkMs("fast")).toBe(400);
    expect(thinkMs("instant")).toBe(0);
    expect(thinkMs()).toBe(800);

    expect(holdMs(short)).toBe(holdMs(short, "normal"));
    expect(holdMs(short, "fast")).toBe(Math.round(holdMs(short, "normal") / 2));
    expect(holdMs(long, "fast")).toBe(2250);
    expect(holdMs(short, "instant")).toBe(0);
  });

  it("sin pausas la acción no frena al rival pero queda a la vista un rato; a las otras velocidades se ve lo que se espera", () => {
    expect(displayMs(short, "instant")).toBe(2000);
    expect(displayMs(long, "instant")).toBe(2000);
    expect(displayMs(short, "normal")).toBe(holdMs(short, "normal"));
    expect(displayMs(short, "fast")).toBe(holdMs(short, "fast"));
  });
});
