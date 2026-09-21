import { describe, expect, it } from "vitest";
import { applyPlayerMove } from "./engine";
import { createInitialState } from "./setup";
import { withSeededRandom } from "./simulation";
import { applyMove, nextBotActor, runBots, stepBot } from "./turns";
import type { GameState } from "./types";

/** Solitaria en la ronda 1 después de que el humano terminó su preparación, sin haber jugado la IA. */
function afterHumanSetup(seed: number, firstPlayerId: "nico" | "bot"): GameState {
  return withSeededRandom(seed, () => {
    const state = createInitialState({ mode: "solo", firstPlayerId });
    return applyPlayerMove(state, "nico", {
      type: "chooseStart",
      keepCards: [],
      discardFood: [],
      bonusCardId: state.players.nico.pendingBonusChoice![0],
    });
  });
}

describe("stepBot", () => {
  it("primero resuelve la preparación pendiente de la IA y no anuncia turno hasta que ambos terminan", () => {
    const state = withSeededRandom(1, () => createInitialState({ mode: "solo", firstPlayerId: "nico" }));
    expect(nextBotActor(state)).toBe("bot");
    const step = stepBot(state)!;
    expect(step.botId).toBe("bot");
    expect(step.move.type).toBe("chooseStart");
    expect(step.state.players.bot.pendingStartingHand).toBeUndefined();
    // El humano todavía no terminó: la partida sigue en preparación.
    expect(step.state.phase).toBe("setup");
    expect(stepBot(step.state)).toBeNull();
  });

  it("devuelve null si le toca a un humano, sin tocar el estado", () => {
    const state = withSeededRandom(2, () => afterHumanSetup(2, "nico"));
    const settled = runBots(state);
    expect(settled.currentPlayerId).toBe("nico");
    expect(stepBot(settled)).toBeNull();
  });

  it("hace una sola jugada de la IA por llamada y no modifica el estado de partida", () => {
    const state = withSeededRandom(3, () => afterHumanSetup(3, "bot"));
    // La IA todavía tiene su preparación pendiente: se resuelve primero, después llega su turno.
    const ready = stepBot(state)!.state;
    const before = structuredClone(ready);
    const step = stepBot(ready)!;
    expect(step.botId).toBe("bot");
    expect(step.move.type).not.toBe("chooseStart");
    expect(step.state.players.bot.actionCubesAvailable).toBe(ready.players.bot.actionCubesAvailable - 1);
    expect(ready).toEqual(before);
  });

  it("encadenar stepBot llega al mismo estado que runBots", () => {
    const viaSteps = withSeededRandom(9, () => {
      let state = afterHumanSetup(9, "bot");
      for (let step = stepBot(state); step; step = stepBot(state)) state = step.state;
      return state;
    });
    const viaRun = withSeededRandom(9, () => runBots(afterHumanSetup(9, "bot")));
    expect(viaSteps.currentPlayerId).toBe(viaRun.currentPlayerId);
    expect(viaSteps.log.length).toBe(viaRun.log.length);
    expect(viaSteps.players.bot.actionCubesAvailable).toBe(viaRun.players.bot.actionCubesAvailable);
  });

  it("applyMove sigue haciendo jugar a la IA a continuación de la jugada del humano", () => {
    const state = withSeededRandom(4, () => runBots(afterHumanSetup(4, "nico")));
    const next = withSeededRandom(4, () => applyMove(state, "nico", { type: "gainFood", dieIndexes: [0] }));
    expect(next.currentPlayerId).toBe("nico");
    expect(next.players.bot.actionCubesAvailable).toBeLessThan(state.players.bot.actionCubesAvailable);
  });
});
