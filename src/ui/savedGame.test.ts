import { beforeEach, describe, expect, it } from "vitest";
import { applyMove, createInitialState } from "../game";
import type { GameState } from "../game";
import { checkInvariants, nextActor, randomMove, withSeededRandom } from "../game/simulation";
import {
  clearSavedGame,
  formatSavedAgo,
  loadSavedGame,
  restoreGame,
  saveGame,
  summarizeSavedGame,
} from "./savedGame";

const STORAGE_KEY = "wingspread.savedGame.v2";
const LEGACY_STORAGE_KEY = "wingspread.savedGame.v1";

/** Partida a medio jugar (reproducible): `moves` movimientos aleatorios desde el inicio. */
function midGame(mode: "solo" | "online", moves: number): GameState {
  return withSeededRandom(11, () => {
    let state = createInitialState(
      mode === "solo"
        ? { mode: "solo", playerIds: ["nico", "bot"] }
        : { mode: "online", playerIds: ["nico", "santi"] },
    );
    for (let i = 0; i < moves && state.phase !== "gameEnd"; i += 1) {
      const actor = nextActor(state)!;
      state = applyMove(state, actor, randomMove(state, actor)!);
    }
    return state;
  });
}

describe("partida guardada", () => {
  beforeEach(() => localStorage.clear());

  it("guarda y recupera una partida solitaria idéntica", () => {
    const state = midGame("solo", 25);
    saveGame({ kind: "solo", state, savedAt: 1000 });

    const loaded = loadSavedGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.kind).toBe("solo");
    expect(loaded!.savedAt).toBe(1000);
    expect(loaded!.state).toEqual(state);
  });

  it("guarda y recupera una sala del anfitrión con su código", () => {
    const state = midGame("online", 20);
    saveGame({ kind: "online-host", state, roomCode: "halcon-482", savedAt: 2000 });

    const loaded = loadSavedGame();
    expect(loaded).toMatchObject({ kind: "online-host", roomCode: "halcon-482" });
    expect(loaded!.state).toEqual(state);
  });

  it("no guarda los catálogos de cartas (son estáticos y pesados)", () => {
    saveGame({ kind: "solo", state: midGame("solo", 10), savedAt: 1 });
    const raw = localStorage.getItem(STORAGE_KEY)!;
    expect(raw).not.toContain("scientificName");
    expect(raw.length).toBeLessThan(30_000);
  });

  it("al cargar usa los catálogos de la versión actual, no los guardados", () => {
    const state = midGame("solo", 10);
    saveGame({ kind: "solo", state, savedAt: 1 });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    stored.state.cards = { houseWren: { id: "houseWren", name: "VIEJA", powers: [] } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    expect(loadSavedGame()!.state.cards.houseWren.name).not.toBe("VIEJA");
  });

  it("una partida recuperada se puede seguir jugando hasta el final sin romper nada", () => {
    saveGame({ kind: "solo", state: midGame("solo", 14), savedAt: 1 });
    let state = loadSavedGame()!.state;
    expect(checkInvariants(state)).toEqual([]);

    withSeededRandom(99, () => {
      for (let steps = 0; state.phase !== "gameEnd" && steps < 400; steps += 1) {
        const actor = nextActor(state)!;
        state = applyMove(state, actor, randomMove(state, actor)!);
        expect(checkInvariants(state)).toEqual([]);
      }
    });
    expect(state.phase).toBe("gameEnd");
  });

  it("ignora y borra las partidas guardadas por la versión anterior (con el Automa)", () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ kind: "solo", savedAt: 1, state: { players: { automa: { isAutoma: true } } } }));
    expect(loadSavedGame()).toBeNull();
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });

  it("rechaza una partida solitaria sin rival de la IA", () => {
    saveGame({ kind: "solo", state: midGame("solo", 8), savedAt: 1 });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    delete stored.state.players.bot.botLevel;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    expect(loadSavedGame()).toBeNull();
  });

  it("clearSavedGame la borra", () => {
    saveGame({ kind: "solo", state: midGame("solo", 5), savedAt: 1 });
    clearSavedGame();
    expect(loadSavedGame()).toBeNull();
  });

  describe("descarta lo que no es fiable (y lo borra)", () => {
    const valid = () => {
      saveGame({ kind: "solo", state: midGame("solo", 10), savedAt: 1 });
      return JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    };
    const store = (value: unknown) => localStorage.setItem(STORAGE_KEY, typeof value === "string" ? value : JSON.stringify(value));

    it.each([
      ["JSON roto", () => store("{no es json")],
      ["un valor que no es un objeto", () => store("42")],
      ["un tipo de partida desconocido", () => store({ ...valid(), kind: "otra" })],
      ["una sala sin código", () => store({ ...valid(), kind: "online-host" })],
      ["un tipo que no coincide con el modo de la partida", () => store({ ...valid(), kind: "online-host", roomCode: "x-1" })],
      ["sin fecha de guardado", () => store({ ...valid(), savedAt: undefined })],
      ["una partida ya terminada", () => { const v = valid(); v.state.phase = "gameEnd"; store(v); }],
      ["una ronda inválida", () => { const v = valid(); v.state.round = 9; store(v); }],
      ["el turno de un jugador inexistente", () => { const v = valid(); v.state.currentPlayerId = "fantasma"; store(v); }],
      ["un mazo que no es una lista", () => { const v = valid(); v.state.deck = "abc"; store(v); }],
      ["una carta de ave que ya no existe", () => { const v = valid(); v.state.deck.push("avePerdida"); store(v); }],
      ["un tablero con columnas de menos", () => { const v = valid(); v.state.players.nico.board.forest.pop(); store(v); }],
      ["una bonificación que ya no existe", () => { const v = valid(); v.state.players.nico.bonusCards = [{ id: "bonusPerdida" }]; store(v); }],
    ])("rechaza %s", (_name, corrupt) => {
      corrupt();
      expect(loadSavedGame()).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("restoreGame no acepta basura de ningún tipo", () => {
      for (const junk of [null, undefined, 0, "x", [], {}, { kind: "solo" }]) expect(restoreGame(junk)).toBeNull();
    });
  });
});

describe("resumen para la pantalla de inicio", () => {
  it("resume una partida solitaria y una sala", () => {
    const state = midGame("solo", 3);
    expect(summarizeSavedGame({ kind: "solo", state, savedAt: 5 })).toEqual({
      kind: "solo",
      roomCode: undefined,
      round: 1,
      savedAt: 5,
    });
    expect(summarizeSavedGame({ kind: "online-host", state: midGame("online", 3), roomCode: "garza-100", savedAt: 6 })).toMatchObject({
      kind: "online-host",
      roomCode: "garza-100",
    });
  });

  it("formatea hace cuánto se guardó", () => {
    const now = 10_000_000_000;
    expect(formatSavedAgo(now, now)).toBe("hace un momento");
    expect(formatSavedAgo(now - 5 * 60_000, now)).toBe("hace 5 min");
    expect(formatSavedAgo(now - 3 * 3_600_000, now)).toBe("hace 3 h");
    expect(formatSavedAgo(now - 24 * 3_600_000, now)).toBe("hace 1 día");
    expect(formatSavedAgo(now - 49 * 3_600_000, now)).toBe("hace 2 días");
    expect(formatSavedAgo(now + 60_000, now)).toBe("hace un momento");
  });
});
