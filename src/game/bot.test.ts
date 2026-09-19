import { describe, expect, it } from "vitest";
import { chooseBotMove } from "./bot";
import { applyPlayerMove, isLegalMove } from "./engine";
import { planBirdPlays } from "./moveGen";
import { createInitialState } from "./setup";
import { playBotMatch, withSeededRandom } from "./simulation";
import { applyMove } from "./turns";
import type { BotDifficulty, GameState } from "./types";

const LEVELS: BotDifficulty[] = ["easy", "normal", "hard"];
/** Los duelos entre niveles juegan decenas de partidas completas. */
const SLOW = 120_000;

/** Partida en la que el humano hace siempre "tomar un dado", contra un rival de la IA. */
function playAgainstHumanTakingDice(seed: number, level: BotDifficulty): GameState {
  return withSeededRandom(seed, () => {
    let state = createInitialState({ mode: "solo", botDifficulty: level });
    state = applyMove(state, "nico", {
      type: "chooseStart",
      keepCards: [],
      discardFood: [],
      bonusCardId: state.players.nico.pendingBonusChoice![0],
    });
    for (let step = 0; step < 100 && state.phase === "round"; step += 1) {
      if (state.currentPlayerId !== "nico") throw new Error("el turno debería volver al humano tras jugar la IA");
      state = applyMove(state, "nico", { type: "gainFood", dieIndexes: [0] });
    }
    return state;
  });
}

describe("rival de la IA", () => {
  it.each(LEVELS)("nivel %s: juega partidas enteras sin jugadas ilegales ni estados rotos", (level) => {
    const problems = Array.from({ length: 8 }, (_, seed) => playBotMatch(seed, { nico: level, bot: level }).problems).flat();
    expect(problems.slice(0, 3)).toEqual([]);
  });

  it.each(LEVELS)("nivel %s: contra un humano, la IA juega su turno y lo devuelve, hasta el final", (level) => {
    const end = playAgainstHumanTakingDice(3, level);
    expect(end.phase).toBe("gameEnd");
    // La IA gastó las mismas acciones que el humano: es un jugador más.
    expect(end.players.bot.actionCubesAvailable).toBe(0);
    expect(end.players.nico.actionCubesAvailable).toBe(0);
    expect(end.log.filter((entry) => entry.playerId === "bot").length).toBeGreaterThan(20);
  });

  it("juega con las mismas reglas: construye un tablero real y puntúa como cualquier jugador", () => {
    let birds = 0;
    let eggs = 0;
    for (let seed = 0; seed < 6; seed += 1) {
      const { finalState } = playBotMatch(seed, { nico: "hard", bot: "hard" });
      for (const id of ["nico", "bot"]) {
        const slots = Object.values(finalState.players[id].board).flat();
        birds += slots.filter((slot) => slot.cardId).length;
        eggs += slots.reduce((sum, slot) => sum + slot.eggs, 0);
      }
    }
    expect(birds / 12).toBeGreaterThan(3); // aves por jugador y partida
    expect(eggs / 12).toBeGreaterThan(3);
  });

  it("todas sus decisiones son jugadas legales que deciden sin modificar el estado", () => {
    for (const level of LEVELS) {
      withSeededRandom(11, () => {
        const state = createInitialState({ mode: "solo", botDifficulty: level });
        const before = JSON.stringify({ ...state, cards: null });
        const move = chooseBotMove(state, "bot");
        expect(move, level).not.toBeNull();
        expect(isLegalMove(state, "bot", move!), level).toBe(true);
        expect(JSON.stringify({ ...state, cards: null })).toBe(before);
      });
    }
  });

  it("no mueve por un humano ni fuera de su turno", () => {
    const state = createInitialState({ mode: "solo" });
    expect(chooseBotMove(state, "nico")).toBeNull(); // el humano no es de la IA
    const started = applyMove(state, "nico", {
      type: "chooseStart",
      keepCards: [],
      discardFood: [],
      bonusCardId: state.players.nico.pendingBonusChoice![0],
    });
    expect(started.currentPlayerId).toBe("nico");
    expect(chooseBotMove(started, "bot")).toBeNull(); // no es su turno
  });

  describe("preparación inicial", () => {
    it.each(LEVELS)("nivel %s: elige una preparación legal", (level) => {
      for (let seed = 0; seed < 20; seed += 1) {
        withSeededRandom(seed, () => {
          const state = createInitialState({ mode: "solo", botDifficulty: level });
          const move = chooseBotMove(state, "bot")!;
          expect(move.type).toBe("chooseStart");
          expect(isLegalMove(state, "bot", move), `${level} semilla ${seed}`).toBe(true);
        });
      }
    });

    it("elige una mano con la que puede jugar un ave en su primer turno (casi siempre)", () => {
      let playable = 0;
      let kept = 0;
      const games = 30;
      for (let seed = 0; seed < games; seed += 1) {
        withSeededRandom(seed, () => {
          const state = createInitialState({ mode: "solo", botDifficulty: "hard" });
          const move = chooseBotMove(state, "bot")!;
          if (move.type !== "chooseStart") throw new Error("se esperaba chooseStart");
          kept += move.keepCards.length;
          const ready = applyPlayerMove(state, "bot", move);
          if (planBirdPlays(ready, ready.players.bot).length > 0) playable += 1;
        });
      }
      expect(playable).toBeGreaterThanOrEqual(games * 0.7);
      expect(kept / games).toBeGreaterThan(1); // no tira todas las aves
    });
  });

  describe("niveles", () => {
    /** Victorias de `strong` contra `weak` alternando quién empieza. */
    const duel = (strong: BotDifficulty, weak: BotDifficulty, games: number) => {
      let strongWins = 0;
      let weakWins = 0;
      let strongPoints = 0;
      let weakPoints = 0;
      for (let seed = 0; seed < games; seed += 1) {
        const swap = seed % 2 === 1;
        const { scores, problems } = playBotMatch(300 + seed, swap ? { nico: weak, bot: strong } : { nico: strong, bot: weak });
        expect(problems).toEqual([]);
        const s = swap ? scores.bot : scores.nico;
        const w = swap ? scores.nico : scores.bot;
        strongPoints += s;
        weakPoints += w;
        if (s > w) strongWins += 1;
        else if (w > s) weakWins += 1;
      }
      return { strongWins, weakWins, strongAvg: strongPoints / games, weakAvg: weakPoints / games };
    };

    it("normal gana claramente a fácil", () => {
      const result = duel("normal", "easy", 24);
      expect(result.strongWins).toBeGreaterThan(result.weakWins * 1.5);
      expect(result.strongAvg).toBeGreaterThan(result.weakAvg + 4);
    }, SLOW);

    it("difícil gana a normal (más victorias y más puntos) y arrasa a fácil", () => {
      const vsNormal = duel("hard", "normal", 40);
      expect(vsNormal.strongWins).toBeGreaterThan(vsNormal.weakWins);
      expect(vsNormal.strongAvg).toBeGreaterThan(vsNormal.weakAvg);
      const vsEasy = duel("hard", "easy", 24);
      expect(vsEasy.strongWins).toBeGreaterThan(vsEasy.weakWins * 2);
    }, SLOW);

    it("sus puntuaciones son las de una partida normal (ni triviales ni imposibles)", () => {
      const scores = Array.from({ length: 10 }, (_, seed) => Object.values(playBotMatch(500 + seed, { nico: "hard", bot: "normal" }).scores)).flat();
      const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
      expect(average).toBeGreaterThan(35);
      expect(average).toBeLessThan(80);
      expect(Math.max(...scores)).toBeLessThan(120);
    }, SLOW);
  });
});
