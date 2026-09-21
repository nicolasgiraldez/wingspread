import { describe, expect, it } from "vitest";
import { createInitialState } from "../game";
import type { GameState, Move } from "../game";
import { holdMs } from "./pacing";
import { describeStep } from "./stepAnnouncement";

function roundState(): GameState {
  const state = createInitialState({
    mode: "solo",
    playerIds: ["nico", "bot"],
    customPlayerNames: { nico: "Lucía", bot: "Rival (IA)" },
    firstPlayerId: "bot",
  });
  state.phase = "round";
  state.currentPlayerId = "bot";
  return state;
}

/** Estado de después: copia con el registro ampliado (la frase principal no depende del resto). */
function withLog(state: GameState, ...messages: string[]): GameState {
  const after = structuredClone(state);
  for (const message of messages) after.log.push({ playerId: "bot", message });
  return after;
}

describe("describeStep", () => {
  it("quién fue: nombre, posición en la mesa", () => {
    const before = roundState();
    const step = describeStep(before, withLog(before), { type: "rerollFeeder" }, "bot")!;
    expect(step).toMatchObject({ actorId: "bot", actorName: "Rival (IA)", actorIndex: 1 });
  });

  it("tomar comida cuenta lo que había en los dados elegidos, con plurales", () => {
    const before = roundState();
    before.feeder = ["seed", "seed", "fish", "wild", "rodent"];
    const after = withLog(before);
    const say = (move: Move) => describeStep(before, after, move, "bot")!.headline;

    expect(say({ type: "gainFood", dieIndexes: [2] })).toBe("Tomó 1 pez del comedero.");
    expect(say({ type: "gainFood", dieIndexes: [0, 1] })).toBe("Tomó 2 semillas del comedero.");
    expect(say({ type: "gainFood", dieIndexes: [0, 2] })).toBe("Tomó 1 semilla y 1 pez del comedero.");
    expect(say({ type: "gainFood", dieIndexes: [3], wildChoices: { 3: "insect" } })).toBe("Tomó 1 insecto del comedero.");
    expect(say({ type: "gainFood", dieIndexes: [4], rerollBefore: true })).toBe("Relanzó el comedero y tomó 1 roedor del comedero.");
  });

  it("jugar un ave dice cuál y en qué hábitat", () => {
    const before = roundState();
    const cardId = before.players.bot.hand[0];
    const name = before.cards[cardId].name;
    const move: Move = { type: "playBird", cardId, habitat: "wetland", slotIndex: 0, paidResources: [], paidEggsFrom: [] };
    expect(describeStep(before, withLog(before), move, "bot")!.headline).toBe(`Jugó [${name}] en el Río.`);
    expect(describeStep(before, withLog(before), { ...move, habitat: "grassland" }, "bot")!.headline).toContain("en la Pradera.");
  });

  it("poner huevos cuenta los huevos y nombra las aves que los recibieron", () => {
    const before = roundState();
    const [a, b, c] = before.players.bot.hand;
    before.players.bot.board.forest[0].cardId = a;
    before.players.bot.board.forest[1].cardId = b;
    before.players.bot.board.grassland[0].cardId = c;
    const at = (habitat: "forest" | "grassland", slotIndex: number) => ({ habitat, slotIndex });
    const name = (id: string) => before.cards[id].name;
    const say = (eggPlacements: ReturnType<typeof at>[]) =>
      describeStep(before, withLog(before), { type: "layEggs", eggPlacements }, "bot")!.headline;

    expect(say([at("forest", 0)])).toBe(`Puso 1 huevo en [${name(a)}].`);
    expect(say([at("forest", 0), at("forest", 0), at("forest", 1)])).toBe(`Puso 3 huevos en [${name(a)}] y [${name(b)}].`);
    expect(say([at("forest", 0), at("forest", 1), at("grassland", 0)])).toBe(`Puso 3 huevos en [${name(a)}], [${name(b)}] y 1 más.`);
  });

  it("robar cartas distingue las del mercado, con su nombre, de las del mazo", () => {
    const before = roundState();
    const market = before.market[0];
    const marketName = before.cards[market].name;
    const say = (draws: Extract<Move, { type: "drawBirdCards" }>["draws"]) =>
      describeStep(before, withLog(before), { type: "drawBirdCards", draws }, "bot")!.headline;

    expect(say([{ source: "deck" }])).toBe("Robó 1 carta del mazo.");
    expect(say([{ source: "deck" }, { source: "deck" }])).toBe("Robó 2 cartas del mazo.");
    expect(say([{ source: "market", marketCardId: market }, { source: "deck" }])).toBe(
      `Robó [${marketName}] del mercado y 1 carta del mazo.`,
    );
  });

  it("los poderes y cazas de la jugada salen del registro nuevo; lo demás no cuenta", () => {
    const before = roundState();
    before.log.push({ playerId: "bot", message: "Poder de [Viejo]: esto ya estaba en el registro." });
    const after = withLog(
      before,
      "Poder de [Carbonero]: tomó 1 semilla del comedero.",
      "Depredador [Halcón]: ¡Caza exitosa! Reveló a [Gorrión].",
      "Depredador [Búho]: Caza fallida. Descartada.",
      "Puso huevos.",
    );
    const step = describeStep(before, after, { type: "rerollFeeder" }, "bot")!;
    expect(step.details).toEqual([
      { kind: "power", bird: "Carbonero", text: "tomó 1 semilla del comedero." },
      { kind: "hunt", bird: "Halcón", text: "¡Caza exitosa! Reveló a [Gorrión]." },
      { kind: "miss", bird: "Búho", text: "Caza fallida. Descartada." },
    ]);
  });

  it("la preparación inicial y la bonificación no se anuncian", () => {
    const before = roundState();
    const after = withLog(before);
    expect(describeStep(before, after, { type: "chooseStart", keepCards: [], discardFood: [], bonusCardId: "x" }, "bot")).toBeNull();
    expect(describeStep(before, after, { type: "chooseBonusCard", bonusCardId: "x" }, "bot")).toBeNull();
  });
});

describe("holdMs", () => {
  const announcement = (headline: string, details: { bird: string; text: string }[] = []) => ({
    headline,
    details: details.map((d) => ({ kind: "power" as const, ...d })),
  });

  it("una frase corta se queda lo mínimo y una larga, más, con tope", () => {
    expect(holdMs(announcement("Ok"))).toBe(1800);
    expect(holdMs(announcement("Jugó [Ave] en el Río."))).toBeGreaterThan(holdMs(announcement("Robó 1 carta.")));
    expect(holdMs(announcement("x".repeat(500)))).toBe(4500);
  });

  it("cuenta también lo que hay que leer de cada poder", () => {
    const plain = holdMs(announcement("Jugó [Ave] en el Río."));
    const withPower = holdMs(announcement("Jugó [Ave] en el Río.", [{ bird: "Ave", text: "robó 1 carta del mazo." }]));
    expect(withPower).toBeGreaterThan(plain);
  });
});
