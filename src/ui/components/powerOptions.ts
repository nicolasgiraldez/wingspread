import { getActivatablePowers } from "../../game";
import type { GameState, HabitatId, PlayerState, SlotRef } from "../../game";
import { describePower, habitatLabels } from "../labels";

/** Codifica un SlotRef como string para usarlo de value en un <select>. */
export function encodeSlotKey(ref: SlotRef): string {
  return `${ref.habitat}:${ref.slotIndex}`;
}

export function decodeSlotKey(key: string): SlotRef {
  const [habitat, slotIndexText] = key.split(":");
  return { habitat: habitat as HabitatId, slotIndex: Number(slotIndexText) };
}

/** Aves del jugador con espacio libre para huevos, para poderes "layEgg" con target "any". */
export function buildEggTargetOptions(
  gameState: GameState,
  player: PlayerState,
): { key: string; name: string }[] {
  const options: { key: string; name: string }[] = [];
  for (const hab of ["forest", "grassland", "wetland"] as HabitatId[]) {
    player.board[hab].forEach((slot, slotIndex) => {
      if (!slot.cardId) return;
      const card = gameState.cards[slot.cardId];
      if (!card || slot.eggs >= card.eggCapacity) return;
      options.push({
        key: encodeSlotKey({ habitat: hab, slotIndex }),
        name: `${card.name} (${habitatLabels[hab]}, ${slot.eggs}/${card.eggCapacity} 🥚)`,
      });
    });
  }
  return options;
}

/** Aves del jugador con al menos 1 huevo, para poderes que cuestan "descartar 1 huevo". */
export function buildEggSourceOptions(
  gameState: GameState,
  player: PlayerState,
  excludeSlot?: SlotRef,
): { key: string; name: string }[] {
  const options: { key: string; name: string }[] = [];
  for (const hab of ["forest", "grassland", "wetland"] as HabitatId[]) {
    player.board[hab].forEach((slot, slotIndex) => {
      if (excludeSlot && excludeSlot.habitat === hab && excludeSlot.slotIndex === slotIndex) return;
      if (!slot.cardId || slot.eggs <= 0) return;
      const card = gameState.cards[slot.cardId];
      options.push({
        key: encodeSlotKey({ habitat: hab, slotIndex }),
        name: `${card?.name ?? slot.cardId} (${habitatLabels[hab]}, ${slot.eggs} 🥚)`,
      });
    });
  }
  return options;
}

/** Otras aves con poder "Al activar" en el mismo hábitat, para el poder "repeatPower". */
export function buildRepeatPowerOptions(
  gameState: GameState,
  player: PlayerState,
  habitat: HabitatId,
  excludeSlot: SlotRef,
  predatorOnly?: boolean,
): { key: string; name: string }[] {
  return getActivatablePowers(gameState, player, habitat)
    .filter(({ source: s, power: p }) => {
      if (s.habitat === excludeSlot.habitat && s.slotIndex === excludeSlot.slotIndex) return false;
      if (predatorOnly) return p.kind === "huntPredator" || p.kind === "diceHuntPredator";
      return true;
    })
    .map(({ source: s, card, power: p }) => ({
      key: encodeSlotKey(s),
      name: `${card.name}: ${describePower(p)}`,
    }));
}
