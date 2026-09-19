import { getActivatablePowers } from "../../game";
import type { GameState, HabitatId, PlayerState, SlotRef } from "../../game";
import { describePower, habitatLabels, resourceIcons, resourceLabels } from "../labels";

/** Alimentos entre los que se elige en los poderes "ganá 1 alimento a elección" (resource "wild"). */
export const anyFoodOptions: { id: string; name: string }[] = (
  ["insect", "seed", "fruit", "fish", "rodent"] as const
).map((food) => ({ id: food, name: `${resourceIcons[food]} ${resourceLabels[food]}` }));

/** Opciones "pagado>recibido" para el poder que cambia 1 alimento por otro (costo comodín). */
export function tradeOptions(player: PlayerState): { id: string; name: string }[] {
  const foods = ["insect", "seed", "fruit", "fish", "rodent"] as const;
  const options: { id: string; name: string }[] = [];
  for (const pay of foods) {
    if ((player.resources[pay] ?? 0) < 1) continue;
    for (const gain of foods) {
      if (gain === pay) continue;
      options.push({
        id: `${pay}>${gain}`,
        name: `${resourceIcons[pay]} → ${resourceIcons[gain]} (${resourceLabels[pay]} por ${resourceLabels[gain]})`,
      });
    }
  }
  return options;
}

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
