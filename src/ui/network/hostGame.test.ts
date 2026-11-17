import { describe, expect, it } from "vitest";
import { applyMove, createInitialState } from "../../game";
import type { GameState, Move } from "../../game";
import { checkInvariants, nextActor, randomMove, withSeededRandom } from "../../game/simulation";
import { applyGuestMove, defaultSeatName, GUEST_PLAYER_ID, guestSeatsOf, HOST_PLAYER_ID, seatsFor } from "./hostGame";

/** Partida online recién empezada: ambos ya eligieron su bonificación y es el turno del anfitrión. */
function onlineState(): GameState {
  let state = createInitialState({ mode: "online", playerIds: [HOST_PLAYER_ID, GUEST_PLAYER_ID] });
  for (const id of [HOST_PLAYER_ID, GUEST_PLAYER_ID]) {
    state = applyMove(state, id, {
      type: "chooseStart",
      keepCards: state.players[id].hand.slice(0, 2),
      discardFood: ["fish", "rodent"],
      bonusCardId: state.players[id].pendingBonusChoice![0],
    });
  }
  return state;
}

const totalFood = (state: GameState, id: string) =>
  Object.values(state.players[id].resources).reduce((sum, amount) => sum + (amount ?? 0), 0);

describe("applyGuestMove: el anfitrión valida lo que manda el invitado", () => {
  it("rechaza movimientos mal formados sin lanzar", () => {
    const state = onlineState();
    for (const garbage of [null, undefined, 42, "gainFood", [], {}, { type: 7 }]) {
      const result = applyGuestMove(state, garbage);
      expect(result.ok, JSON.stringify(garbage)).toBe(false);
    }
  });

  it("no deja que el invitado juegue en el turno del anfitrión", () => {
    const state = onlineState();
    expect(state.currentPlayerId).toBe(HOST_PLAYER_ID);
    const result = applyGuestMove(state, { type: "gainFood", dieIndexes: [0] });
    expect(result).toEqual({ ok: false, reason: "movimiento ilegal" });
  });

  it("aplica el movimiento como el invitado, sea cual sea el jugador que diga ser", () => {
    let state = onlineState();
    // Pasa el turno al invitado con una jugada del anfitrión.
    state = applyMove(state, HOST_PLAYER_ID, { type: "gainFood", dieIndexes: [0] });
    expect(state.currentPlayerId).toBe(GUEST_PLAYER_ID);

    const result = applyGuestMove(state, { type: "gainFood", dieIndexes: [0], playerId: HOST_PLAYER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(totalFood(result.state, GUEST_PLAYER_ID)).toBeGreaterThan(totalFood(state, GUEST_PLAYER_ID));
      expect(totalFood(result.state, HOST_PLAYER_ID)).toBe(totalFood(state, HOST_PLAYER_ID));
    }
  });
});

describe("salas de 2 a 5 jugadores", () => {
  /** Partida de N jugadores ya en la ronda 1, con el turno del anfitrión. */
  function tableOf(count: number): GameState {
    const seats = seatsFor(count);
    let state = createInitialState({ mode: "online", playerIds: seats, firstPlayerId: HOST_PLAYER_ID });
    for (const id of seats) {
      state = applyMove(state, id, {
        type: "chooseStart",
        keepCards: [],
        discardFood: [],
        bonusCardId: state.players[id].pendingBonusChoice![0],
      });
    }
    return state;
  }

  it("reparte los asientos en orden y acota la cantidad a entre 2 y 5", () => {
    expect(seatsFor(2)).toEqual(["nico", "santi"]);
    expect(seatsFor(5)).toEqual(["nico", "santi", "p3", "p4", "p5"]);
    expect(seatsFor(1)).toHaveLength(2);
    expect(seatsFor(9)).toHaveLength(5);
    expect(seatsFor(Number.NaN)).toHaveLength(2);
    expect(guestSeatsOf(tableOf(4))).toEqual(["santi", "p3", "p4"]);
    expect(defaultSeatName(2)).toBe("Jugador 3");
  });

  it("cada invitado solo juega por su asiento y en su turno", () => {
    let state = tableOf(4);
    const die: Move = { type: "gainFood", dieIndexes: [0] };

    // Turno del anfitrión: ningún invitado puede mover.
    for (const seat of ["santi", "p3", "p4"]) expect(applyGuestMove(state, die, seat).ok).toBe(false);

    state = applyMove(state, HOST_PLAYER_ID, die);
    expect(state.currentPlayerId).toBe("santi");
    // Le toca a "santi": los otros asientos no pueden jugar por él.
    expect(applyGuestMove(state, die, "p3")).toEqual({ ok: false, reason: "movimiento ilegal" });
    const result = applyGuestMove(state, die, "santi");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentPlayerId).toBe("p3");
  });

  it("rechaza asientos que no son de invitados", () => {
    const state = tableOf(3);
    const die: Move = { type: "gainFood", dieIndexes: [0] };
    // Aunque sea el turno del anfitrión, nadie puede jugar por él desde la red.
    expect(applyGuestMove(state, die, HOST_PLAYER_ID)).toEqual({ ok: false, reason: "asiento desconocido" });
    expect(applyGuestMove(state, die, "p5")).toEqual({ ok: false, reason: "asiento desconocido" });
    expect(applyGuestMove(state, die, "__proto__")).toEqual({ ok: false, reason: "asiento desconocido" });
  });
});

describe("un dado comodín solo puede convertirse en insecto o semilla", () => {
  it.each(["fish", "rodent", "wild", "__proto__", 7, null])("rechaza o normaliza la elección %j", (choice) => {
    let state = onlineState();
    state = applyMove(state, HOST_PLAYER_ID, { type: "gainFood", dieIndexes: [0] });
    state.feeder = ["wild", "wild", "wild", "wild", "wild"];
    state.players[GUEST_PLAYER_ID].resources = {};

    const result = applyGuestMove(state, { type: "gainFood", dieIndexes: [0], wildChoices: { 0: choice } });

    if (result.ok) {
      expect(Object.keys(result.state.players[GUEST_PLAYER_ID].resources).filter((food) => food !== "insect" && food !== "seed")).toEqual([]);
      expect(checkInvariants(result.state)).toEqual([]);
    }
  });
});

describe("fuzz: un invitado malicioso no puede corromper la partida", () => {
  const GARBAGE: unknown[] = [null, "x", -1, 1.5, 99, Number.NaN, {}, [], { habitat: "moon", slotIndex: 0 }, "__proto__", "fish", "wild", true];

  /** Reemplaza campos de un movimiento legal por basura, como haría un cliente adversario. */
  function corrupt(move: Move): Move {
    const copy = structuredClone(move) as Record<string, unknown>;
    const fields = ["dieIndexes", "wildChoices", "tradeCardId", "skipPowerIds", "powerCardChoices", "powerEggChoices", "powerMoveChoices", "powerPlayBirdChoices", "eggPlacements", "tradeResource", "draws", "tradeEggFrom", "paidResources", "paidEggsFrom"];
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i += 1) {
      const field = fields[Math.floor(Math.random() * fields.length)];
      const garbage = GARBAGE[Math.floor(Math.random() * GARBAGE.length)];
      copy[field] = Math.random() < 0.5 ? garbage : { [String(Math.floor(Math.random() * 5))]: garbage, "any.power": garbage };
    }
    return copy as unknown as Move;
  }

  it("nunca lanza, y si acepta un movimiento el estado sigue siendo válido", () => {
    const problems: string[] = [];
    let accepted = 0;
    for (let seed = 0; seed < 40; seed += 1) {
      withSeededRandom(seed, () => {
        let state = onlineState();
        for (let step = 0; step < 40 && state.phase === "round"; step += 1) {
          const actor = nextActor(state)!;
          const legal = randomMove(state, actor)!;
          if (actor === GUEST_PLAYER_ID) {
            for (let attempt = 0; attempt < 6; attempt += 1) {
              const attack = corrupt(legal);
              const result = applyGuestMove(state, attack);
              if (!result.ok) continue;
              accepted += 1;
              const errors = checkInvariants(result.state);
              if (errors.length > 0) problems.push(`[semilla ${seed}] ${errors[0]} tras ${JSON.stringify(attack)}`);
            }
          }
          state = applyMove(state, actor, legal);
        }
      });
    }
    expect(problems.slice(0, 5)).toEqual([]);
    expect(accepted).toBeGreaterThan(0);
  }, 60_000);
});
