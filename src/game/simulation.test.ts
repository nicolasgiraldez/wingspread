import { describe, expect, it } from "vitest";
import { bonusCardsCatalog, speciesCards } from "./cards";
import { playGame, type SimulationOptions } from "./simulation";
import type { BotDifficulty } from "./types";

// Partidas por modo. Subir para una pasada exhaustiva: VITE_SIM_GAMES=1000 npx vitest run simulation
const GAMES = Number(import.meta.env.VITE_SIM_GAMES ?? 40);
// Cada partida tarda ~50 ms; el margen evita falsos timeouts en corridas grandes.
const TIMEOUT = 30_000 + GAMES * 150;
const difficulties: BotDifficulty[] = ["easy", "normal", "hard"];
const modes: SimulationOptions["mode"][] = ["solo", "online"];

function runGames(mode: SimulationOptions["mode"], games = GAMES, deckSize?: number) {
  return Array.from({ length: games }, (_, seed) =>
    playGame({ seed, mode, deckSize, difficulty: difficulties[seed % difficulties.length] }),
  );
}

/** Muestra hasta 5 partidas con problemas, con la semilla para reproducirlas. */
function failures(results: ReturnType<typeof runGames>) {
  return results.filter((result) => result.problems.length > 0).slice(0, 5).map((result) => result.problems[0]);
}

describe("simulación de partidas completas con jugador aleatorio", () => {
  it("modo solitario vs la IA: todas las partidas terminan sin violar invariantes", () => {
    const results = runGames("solo");
    expect(failures(results)).toEqual([]);
    expect(results.every((result) => result.finished)).toBe(true);
  }, TIMEOUT);

  it("modo online (2 humanos): todas las partidas terminan sin violar invariantes", () => {
    const results = runGames("online");
    expect(failures(results)).toEqual([]);
    expect(results.every((result) => result.finished)).toBe(true);
  }, TIMEOUT);

  it("con el mazo casi agotado (se baraja el descarte) tampoco se rompe nada", () => {
    for (const mode of modes) {
      for (const deckSize of [4, 12, 25]) {
        const results = runGames(mode, Math.ceil(GAMES / 4), deckSize);
        expect(failures(results), `${mode}, mazo de ${deckSize}`).toEqual([]);
        expect(results.every((result) => result.finished)).toBe(true);
      }
    }
  }, TIMEOUT);

  it("es reproducible: la misma semilla produce exactamente la misma partida", () => {
    for (const mode of modes) {
      const first = playGame({ seed: 7, mode });
      const second = playGame({ seed: 7, mode });
      expect(second.finalState).toEqual(first.finalState);
      expect(second.scores).toEqual(first.scores);
    }
  });

  it("jugar partidas no modifica los catálogos compartidos de cartas", () => {
    const species = JSON.stringify(speciesCards);
    const bonus = JSON.stringify(bonusCardsCatalog);
    runGames("solo", 10);
    runGames("online", 10);
    expect(JSON.stringify(speciesCards)).toBe(species);
    expect(JSON.stringify(bonusCardsCatalog)).toBe(bonus);
  });
});

describe("consistencia del catálogo con el motor", () => {
  // En Wingspan "jugar una segunda ave" es un poder blanco (al jugar). El motor solo lo resuelve
  // dentro de un movimiento playBird (Move.powerPlayBirdChoices), así que con otro timing la carta
  // parecería tener un poder que nunca se ejecuta.
  it("los poderes playSecondBird de las cartas reales tienen timing onPlay (los únicos resolubles)", () => {
    const unresolvable = Object.values(speciesCards)
      .filter((card) => card.powers.some((power) => power.kind === "playSecondBird" && power.timing !== "onPlay"))
      .map((card) => card.id);
    expect(unresolvable).toEqual([]);
  });
});
