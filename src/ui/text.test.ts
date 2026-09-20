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
      "Poné 1 huevo en otra ave con nido en cavidad (o con nido comodín)",
    );
  });

  it("cartas", () => {
    expect(describePower(p({ kind: "drawCard", amount: 1 }))).toBe("Robá 1 carta");
    expect(describePower(p({ kind: "drawCard", amount: 2, thenDiscard: true }))).toBe("Robá 2 cartas y descartá 1");
    expect(describePower(p({ kind: "tuckCard", amount: 1, source: "hand", thenDraw: true }))).toBe(
      "Solapá 1 carta de tu mano; si lo hacés, robá 1 carta",
    );
    expect(describePower(p({ kind: "gainBonusCard", drawCount: 2, keepCount: 1 }))).toBe(
      "Revelá 2 cartas de bonificación y conservá 1",
    );
  });

  it("alimento", () => {
    expect(describePowerText(p({ kind: "cacheFood", resource: "seed" }))).toBe("Almacená 1 semilla en esta carta");
  });

  it("mover de hábitat ya tiene texto", () => {
    expect(describePower(p({ kind: "moveToHabitat" }))).toMatch(/columna más a la derecha de su hábitat/);
  });

  it("ningún poder del catálogo queda vacío ni en tuteo ni con (s)", () => {
    // \b no sirve con acentos ("Poné" tiene un límite de palabra justo después de "Pon"): letras Unicode.
    const tuteo = /(?<![\p{L}])(Obtén|Pon|Roba|Solapa|Almacena|Cambia|Revela|Descarta|Mueve|haz|puedes|tienes)(?![\p{L}])/u;
    for (const card of Object.values(speciesCards)) {
      for (const power of card.powers) {
        const text = describePowerText(power);
        expect(text, `${card.id}/${power.id}`).not.toBe("");
        expect(text, `${card.id}/${power.id}`).not.toMatch(tuteo);
        expect(text).not.toMatch(/\(s\)|\(es\)|\(n\)/);
      }
    }
  });
});

describe("los poderes dicen todas sus condiciones (no solo el efecto)", () => {
  const all = Object.values(speciesCards).flatMap((card) => card.powers.map((power) => ({ card, power })));

  it("Cuervo Pescador aclara que hay que descartar un huevo de otra ave", () => {
    const text = describePowerText(speciesCards.fishCrow.powers[0]);
    expect(text).toBe("Descartá 1 huevo de otra ave para obtener 1 alimento a elección");
  });

  it("todo poder que cuesta un huevo lo dice, y si el huevo puede ser de la propia ave o tiene que ser de otra", () => {
    const paid = all.filter(({ power }) => "costsEgg" in power && power.costsEgg);
    expect(paid.length).toBeGreaterThan(0);
    for (const { card, power } of paid) {
      const text = describePowerText(power);
      expect(text, card.id).toMatch(/^Descartá 1 huevo de (otra ave|una de tus aves) para /);
      const excludes = "costEggExcludesSelf" in power && power.costEggExcludesSelf;
      expect(text, card.id).toContain(excludes ? "de otra ave" : "de una de tus aves");
    }
  });

  it("todo poder rosa dice cuándo se dispara", () => {
    const pink = all.filter(({ power }) => power.timing === "onceBetweenTurns");
    expect(pink.length).toBeGreaterThan(0);
    for (const { card, power } of pink) {
      expect(describePowerText(power), card.id).toMatch(/^Cuando (otro jugador|la caza de otro jugador) /);
    }
  });

  it("los poderes que toman del comedero dicen que dependen de que haya el dado", () => {
    const feeder = all.filter(
      ({ power }) =>
        power.kind === "gainResource" && power.from === "feeder" && !power.anyDie && !power.gainAllMatching,
    );
    expect(feeder.length).toBeGreaterThan(0);
    for (const { card, power } of feeder) {
      expect(describePowerText(power), card.id).toMatch(/\(si hay\)|si no hay/);
    }
  });

  it("solapar y después ganar algo: lo posterior solo pasa si se solapó", () => {
    const chained = all.filter(
      ({ power }) => power.kind === "tuckCard" && (power.thenDraw || power.thenGainEgg || power.thenGainResource),
    );
    expect(chained.length).toBeGreaterThan(0);
    for (const { card, power } of chained) {
      expect(describePowerText(power), card.id).toContain("; si lo hacés, ");
    }
  });

  it("la caza cuenta qué pasa si falla y las de dados qué se almacena", () => {
    for (const { card, power } of all.filter(({ power }) => power.kind === "huntPredator")) {
      expect(describePowerText(power), card.id).toMatch(/revelá la carta superior del mazo.*; si no, /);
    }
    for (const { card, power } of all.filter(({ power }) => power.kind === "diceHuntPredator")) {
      expect(describePowerText(power), card.id).toMatch(/relanzá los dados que estén fuera del comedero.*almacená 1 .* en esta carta/);
    }
  });

  it("los poderes de nido dicen que el nido comodín también sirve", () => {
    for (const { card, power } of all.filter(
      ({ power }) => power.kind === "layEgg" && (power.target === "eachNestType" || power.target === "nestType"),
    )) {
      expect(describePowerText(power), card.id).toContain("(o con nido comodín)");
    }
  });
});
