import { describe, expect, it } from "vitest";
import { applyPlayerMove, createInitialState } from "../game";
import type { GameState, Move } from "../game";
import { describeRemoteStep } from "./remoteAnnouncement";

/** Partida online en la ronda 1 con el turno de Mateo ("santi"); Lucía ("nico") es quien mira. */
function onlineRound(): GameState {
  const state = createInitialState({
    mode: "online",
    playerIds: ["nico", "santi"],
    customPlayerNames: { nico: "Lucía", santi: "Mateo" },
    firstPlayerId: "santi",
  });
  state.phase = "round";
  state.currentPlayerId = "santi";
  for (const player of Object.values(state.players)) {
    player.pendingStartingHand = undefined;
    player.pendingBonusChoice = undefined;
  }
  state.feeder = ["seed", "fish", "insect", "fruit", "rodent"];
  return state;
}

/** Lo que ve Lucía cuando Mateo hace `move`: el estado de antes y el de después de su jugada real. */
function seenFromLucia(state: GameState, move: Move) {
  const after = applyPlayerMove(state, "santi", move);
  return { before: state, after, headline: describeRemoteStep(state, after, "nico")?.headline };
}

describe("describeRemoteStep", () => {
  it("tomar comida: dice qué dado sacó, también la cara comodín según lo que subió", () => {
    const state = onlineRound();
    expect(seenFromLucia(state, { type: "gainFood", dieIndexes: [1] }).headline).toBe("Tomó 1 pez del comedero.");

    const wild = onlineRound();
    wild.feeder = ["wild", "fish", "insect", "fruit", "rodent"];
    wild.players.santi.resources = { insect: 0, seed: 0 };
    expect(seenFromLucia(wild, { type: "gainFood", dieIndexes: [0], wildChoices: { 0: "seed" } }).headline).toBe(
      "Tomó 1 semilla del comedero.",
    );
  });

  it("si el último dado se repone, dice solo que tomó alimento", () => {
    const state = onlineRound();
    state.feeder = ["seed"];
    expect(seenFromLucia(state, { type: "gainFood", dieIndexes: [0] }).headline).toBe("Tomó alimento del comedero.");
  });

  it("robar cartas: nombra las del mercado y cuenta las del mazo sin mostrar cuáles son", () => {
    const state = onlineRound();
    const market = state.market[0];
    const name = state.cards[market].name;
    expect(seenFromLucia(state, { type: "drawBirdCards", draws: [{ source: "market", marketCardId: market }] }).headline).toBe(
      `Robó [${name}] del mercado.`,
    );
    expect(seenFromLucia(onlineRound(), { type: "drawBirdCards", draws: [{ source: "deck" }] }).headline).toBe("Robó 1 carta del mazo.");

    // Con aves en el río se roban 2: una del mercado y otra del mazo.
    const wetland = onlineRound();
    const [a, b] = wetland.players.santi.hand;
    wetland.players.santi.board.wetland[0].cardId = a;
    wetland.players.santi.board.wetland[1].cardId = b;
    const wetlandMarket = wetland.market[0];
    const both = seenFromLucia(wetland, {
      type: "drawBirdCards",
      draws: [{ source: "market", marketCardId: wetlandMarket }, { source: "deck" }],
    });
    expect(both.headline).toBe(`Robó [${wetland.cards[wetlandMarket].name}] del mercado y 1 carta del mazo.`);
  });

  it("relanzar el comedero", () => {
    const state = onlineRound();
    state.feeder = ["seed", "seed", "seed", "seed", "seed"];
    expect(seenFromLucia(state, { type: "rerollFeeder" }).headline).toBe("Relanzó los dados del comedero.");
  });

  it("jugar un ave dice cuál y dónde; poner huevos, cuántos y en quién", () => {
    const state = onlineRound();
    const card = Object.values(state.cards).find(
      (c) =>
        Object.keys(c.cost).length === 1 &&
        Object.values(c.cost)[0] === 1 &&
        !("wild" in c.cost) &&
        !c.costAnyOf?.length &&
        c.eggCapacity >= 2 &&
        c.powers.every((power) => power.timing !== "onPlay"),
    )!;
    const habitat = card.habitats[0];
    const [resource] = Object.keys(card.cost) as ("seed" | "fruit" | "insect" | "fish" | "rodent")[];
    state.players.santi.hand = [card.id];
    state.players.santi.resources = { [resource]: 2 };

    const played = seenFromLucia(state, {
      type: "playBird",
      cardId: card.id,
      habitat,
      slotIndex: 0,
      paidResources: [resource],
      paidEggsFrom: [],
    });
    expect(played.headline).toMatch(/^Jugó \[.+\] en (el|la) (Bosque|Pradera|Río)\.$/);
    expect(played.headline).toContain(`[${card.name}]`);

    // De nuevo el turno de Mateo: pone los huevos de su acción de pradera en esa ave.
    const again = structuredClone(played.after);
    again.currentPlayerId = "santi";
    again.players.santi.actionCubesAvailable = 5;
    const eggPlacements = [
      { habitat, slotIndex: 0 },
      { habitat, slotIndex: 0 },
    ];
    expect(seenFromLucia(again, { type: "layEggs", eggPlacements }).headline).toBe(`Puso 2 huevos en [${card.name}].`);
  });

  it("no cuenta nada si lo hizo el propio jugador, la IA, o no hubo jugada", () => {
    const state = onlineRound();
    const after = applyPlayerMove(state, "santi", { type: "gainFood", dieIndexes: [0] });
    expect(describeRemoteStep(state, after, "santi")).toBeNull();

    expect(describeRemoteStep(state, structuredClone(state), "nico")).toBeNull();

    const withBot = structuredClone(state);
    withBot.players.santi.botLevel = "normal";
    expect(describeRemoteStep(withBot, applyPlayerMove(withBot, "santi", { type: "gainFood", dieIndexes: [0] }), "nico")).toBeNull();

    const setup = structuredClone(state);
    setup.phase = "setup";
    expect(describeRemoteStep(setup, after, "nico")).toBeNull();
  });

  it("incluye los poderes y cazas que disparó la jugada", () => {
    const state = onlineRound();
    const after = applyPlayerMove(state, "santi", { type: "gainFood", dieIndexes: [0] });
    after.log.splice(after.log.length - 1, 0, { playerId: "santi", message: "Poder de [Carbonero]: tomó 1 seed del comedero." });
    const step = describeRemoteStep(state, after, "nico")!;
    expect(step.actorName).toBe("Mateo");
    expect(step.details).toEqual([{ kind: "power", bird: "Carbonero", text: "tomó 1 seed del comedero." }]);
  });
});
