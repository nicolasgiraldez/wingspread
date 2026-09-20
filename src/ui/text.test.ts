import { afterEach, describe, expect, it, vi } from "vitest";
import { speciesCards } from "../game";
import type { Power } from "../game";
import { describePower, describePowerText } from "./labels";
import { countOf, plural, pressVerb } from "./text";

describe("plural", () => {
  it("usa el singular solo con 1", () => {
    expect(plural(1, "carta", "cartas")).toBe("carta");
    expect(plural(0, "carta", "cartas")).toBe("cartas");
    expect(plural(2, "carta", "cartas")).toBe("cartas");
    expect(countOf(1, "huevo", "huevos")).toBe("1 huevo");
    expect(countOf(3, "huevo", "huevos")).toBe("3 huevos");
  });
});

describe("pressVerb", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("dice 'Hacé clic en' con mouse y 'Tocá' en pantallas táctiles", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(pressVerb()).toBe("Hacé clic en");
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(pressVerb()).toBe("Tocá");
  });

  it("sin matchMedia (tests, SSR) cae en escritorio", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(pressVerb()).toBe("Hacé clic en");
  });
});

const p = (extra: object) => ({ id: "p", timing: "onActivate", ...extra }) as Power;

describe("describePower en voseo, con plurales correctos", () => {
  it("huevos", () => {
    expect(describePower(p({ kind: "layEgg", target: "self", amount: 1 }))).toBe("Poné 1 huevo en este nido");
    expect(describePower(p({ kind: "layEgg", target: "any", amount: 2 }))).toBe("Poné 2 huevos en cualquier ave");
    expect(describePower(p({ kind: "layEgg", target: "nestType", nestType: "cavity", amount: 1 }))).toBe(
      "Poné 1 huevo en otra ave con nido Nido en cavidad",
    );
  });

  it("cartas", () => {
    expect(describePower(p({ kind: "drawCard", amount: 1 }))).toBe("Robá 1 carta");
    expect(describePower(p({ kind: "drawCard", amount: 2, thenDiscard: true }))).toBe("Robá 2 cartas y descartá 1");
    expect(describePower(p({ kind: "tuckCard", amount: 1, source: "hand", thenDraw: true }))).toBe(
      "Solapá 1 carta de tu mano y robá 1",
    );
    expect(describePower(p({ kind: "gainBonusCard", drawCount: 2, keepCount: 1 }))).toBe(
      "Revelá 2 cartas de bonificación y conservá 1",
    );
  });

  it("alimento", () => {
    expect(describePowerText(p({ kind: "cacheFood", resource: "seed" }))).toBe("Almacená 1 semilla en esta carta");
  });

  it("mover de hábitat ya tiene texto", () => {
    expect(describePower(p({ kind: "moveToHabitat" }))).toBe("Mové esta ave a otro hábitat");
  });

  it("ningún poder del catálogo queda vacío ni en tuteo ni con (s)", () => {
    // \b no sirve con acentos ("Poné" tiene un límite de palabra justo después de "Pon"): letras Unicode.
    const tuteo = /(?<![\p{L}])(Obtén|Pon|Roba|Solapa|Almacena|Cambia|Revela|Descarta|Mueve|haz|puedes|tienes)(?![\p{L}])/u;
    for (const card of Object.values(speciesCards)) {
      for (const power of card.powers) {
        const text = describePowerText(power);
        expect(text, `${card.id}/${power.id}`).not.toBe("");
        expect(text, `${card.id}/${power.id}`).not.toMatch(tuteo);
        // "Jugador(es)… roba(n)" es el texto del diseño para los poderes de quien tiene menos aves.
        if (power.kind !== "fewestBirdsBenefit") expect(text).not.toMatch(/\(s\)|\(es\)/);
      }
    }
  });
});
