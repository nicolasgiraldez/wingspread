import { describe, expect, it } from "vitest";
import type { Power } from "../game";
import { describePower, describePowerText, resourceIcons } from "./labels";

const base = { id: "p", timing: "onActivate" } as const;

describe("describePower", () => {
  it("incrusta los alimentos como marcadores de ícono, sin emoji", () => {
    const power = { ...base, kind: "gainResource", resource: "seed", amount: 2, from: "feeder" } as Power;
    expect(describePower(power)).toBe("Obtené 2 {seed} del comedero");
  });

  it("con alternativa lleva dos marcadores", () => {
    const power = { ...base, kind: "gainResource", resource: "insect", resourceAlt: "seed", amount: 1 } as Power;
    expect(describePower(power)).toBe("Obtené 1 {insect} o {seed}");
  });

  it("describePowerText pasa los marcadores a palabras", () => {
    const power = { ...base, kind: "gainResource", resource: "fish", gainAllMatching: true } as Power;
    expect(describePowerText(power)).toBe("Obtené TODOS los pez que haya en el comedero");
  });

  it("ningún texto de poder contiene emoji", () => {
    const power = { ...base, kind: "tradeResource", costResource: "seed", gainResource: "fruit", amount: 2 } as Power;
    expect(describePower(power)).toBe("Cambiá 1 {seed} por 2 {fruit}");
    expect(describePower(power)).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("resourceIcons", () => {
  it("mapea cada alimento a un ícono propio, incluido el comodín de coste", () => {
    expect(resourceIcons).toEqual({
      seed: "seed",
      fruit: "fruit",
      insect: "insect",
      fish: "fish",
      rodent: "rodent",
      wild: "wild",
    });
  });
});
