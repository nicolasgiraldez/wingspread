import type { CardId, GameState, Move, PlayerId, SlotRef } from "../game";
import { diffBoard } from "./boardChanges";
import { describeStep } from "./stepAnnouncement";
import type { StepAnnouncement } from "./stepAnnouncement";

/**
 * Reconstruye lo que hizo `actorId` a partir del estado de antes y el de después, para las partidas
 * online, donde el oponente humano manda su jugada al anfitrión y a nosotros solo nos llega el estado.
 * La jugada se reconoce por la última línea del registro ("Jugó un ave.", "Puso huevos."…) y los
 * detalles salen de lo que cambió en la mesa. Devuelve null si no se reconoce.
 */
export function inferMove(before: GameState, after: GameState, actorId: PlayerId): Move | null {
  const summary = after.log
    .slice(before.log.length)
    .reverse()
    .find((entry) => entry.playerId === actorId && !/^(Poder de|Depredador) \[/.test(entry.message));
  if (!summary) return null;

  const changes = diffBoard(before, after);
  const actor = after.players[actorId];
  const prefix = `${actorId}:`;

  if (/^Jugó un ave/.test(summary.message)) {
    const key = [...(changes?.birds ?? [])].find((k) => k.startsWith(prefix));
    const [, habitat, slot] = key?.split(":") ?? [];
    const cardId = habitat ? actor.board[habitat as SlotRef["habitat"]][Number(slot)]?.cardId : null;
    if (!cardId) return null;
    return {
      type: "playBird",
      cardId,
      habitat: habitat as SlotRef["habitat"],
      slotIndex: Number(slot),
      paidResources: [],
      paidEggsFrom: [],
    };
  }

  if (/^Obtuvo alimento/.test(summary.message)) {
    const taken = changes?.feeder.taken ?? [];
    // La cara comodín vale insecto o semilla: se dice la que efectivamente subió en la reserva.
    const gained = (["insect", "seed"] as const).find((res) => (actor.resources[res] ?? 0) > (before.players[actorId].resources[res] ?? 0));
    const wildChoices = Object.fromEntries(taken.filter((die) => die.face === "wild" && gained).map((die) => [die.index, gained!]));
    return { type: "gainFood", dieIndexes: taken.map((die) => die.index), wildChoices };
  }

  if (/^Puso huevos/.test(summary.message)) {
    const eggPlacements: SlotRef[] = [];
    for (const [key, count] of changes?.eggs ?? []) {
      if (!key.startsWith(prefix)) continue;
      const [, habitat, slot] = key.split(":");
      for (let i = 0; i < count; i += 1) eggPlacements.push({ habitat: habitat as SlotRef["habitat"], slotIndex: Number(slot) });
    }
    return { type: "layEggs", eggPlacements };
  }

  if (/^Robó cartas/.test(summary.message)) {
    // Las del mercado son públicas; las del mazo solo se cuentan (lo que sobra de las que entraron a la mano).
    const fromMarket: CardId[] = before.market.filter((id) => !after.market.includes(id));
    const gained = actor.hand.length - before.players[actorId].hand.length;
    const fromDeck = Math.max(0, gained - fromMarket.length);
    return {
      type: "drawBirdCards",
      draws: [
        ...fromMarket.map((marketCardId) => ({ source: "market" as const, marketCardId })),
        ...Array.from({ length: fromDeck }, () => ({ source: "deck" as const })),
      ],
    };
  }

  if (/^Relanzó/.test(summary.message)) return { type: "rerollFeeder" };
  return null;
}

/**
 * Lo que hizo el oponente humano de una partida online entre dos estados consecutivos, o null si no
 * hay nada que contar: no fue una jugada de ronda, la hizo el jugador local o la hizo la IA (a esa
 * la cuenta `useBotTurns`, que conoce su jugada exacta).
 */
export function describeRemoteStep(before: GameState, after: GameState, localPlayerId: PlayerId): StepAnnouncement | null {
  if (before.phase !== "round" || after.log.length <= before.log.length) return null;
  const actorId = before.currentPlayerId;
  if (actorId === localPlayerId || !before.players[actorId] || before.players[actorId].botLevel) return null;
  const move = inferMove(before, after, actorId);
  return move ? describeStep(before, after, move, actorId) : null;
}
