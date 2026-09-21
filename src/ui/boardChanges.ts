import type { CardId, GameState, HabitatId, PlayerId, ResourceFace } from "../game";

const HABITATS: HabitatId[] = ["forest", "grassland", "wetland"];
const RESOURCES: ResourceFace[] = ["seed", "fruit", "insect", "fish", "rodent"];

/** Qué pasó con los dados del comedero en una jugada. */
export interface FeederChange {
  /** Dados que salieron, con su posición y cara ANTES de la jugada. */
  taken: { index: number; face: ResourceFace }[];
  /** Los dados se relanzaron (o se volvieron a llenar): todos son nuevos. */
  rolled: boolean;
}

/**
 * Lo que cambió en la mesa entre dos estados, para animar solo eso (y no todo lo que se dibuja al
 * cambiar de pestaña o al reanudar una partida). Es presentación: no forma parte del estado del juego.
 */
export interface BoardChanges {
  /** Crece con cada jugada con cambios; sirve de `key` para reiniciar una animación. */
  id: number;
  /** Hay algo marcado (false una vez pasado el tiempo o si no se cambió nada). */
  active: boolean;
  /** Aves que entraron a un tablero (o cambiaron de lugar): ver `slotKey`. */
  birds: ReadonlySet<string>;
  /** Huevos puestos por ranura (`slotKey`): cuántos son nuevos. */
  eggs: ReadonlyMap<string, number>;
  /** Cartas que llegaron a una mano o al mercado. */
  cards: ReadonlySet<CardId>;
  /** Alimentos que aumentaron, por jugador (`resourceKey`). */
  resources: ReadonlySet<string>;
  feeder: FeederChange;
  /** Cubo de acción que se acaba de gastar: quién y cuál (su posición en la fila). */
  spentCube: { playerId: PlayerId; index: number } | null;
}

export const NO_CHANGES: BoardChanges = {
  id: 0,
  active: false,
  birds: new Set(),
  eggs: new Map(),
  cards: new Set(),
  resources: new Set(),
  feeder: { taken: [], rolled: false },
  spentCube: null,
};

export const slotKey = (playerId: PlayerId, habitat: HabitatId, slotIndex: number) => `${playerId}:${habitat}:${slotIndex}`;
export const resourceKey = (playerId: PlayerId, res: ResourceFace) => `${playerId}:${res}`;

/** Qué le pasó al comedero: dados que salieron (si lo que queda es lo mismo, sin los sacados) o relanzamiento. */
function feederChange(prev: ResourceFace[], next: ResourceFace[]): FeederChange {
  if (prev.length === next.length && prev.every((face, i) => face === next[i])) return { taken: [], rolled: false };
  if (next.length < prev.length) {
    const taken: FeederChange["taken"] = [];
    let kept = 0;
    prev.forEach((face, index) => {
      if (kept < next.length && face === next[kept]) kept += 1;
      else taken.push({ index, face });
    });
    if (kept === next.length) return { taken, rolled: false };
  }
  return { taken: [], rolled: true };
}

/**
 * Compara dos estados consecutivos de la MISMA partida y dice qué cambió. Devuelve null si no hay
 * nada que animar o si no son estados consecutivos de una misma partida (otra partida, el registro
 * no creció): en esos casos no se anima nada.
 */
export function diffBoard(prev: GameState, next: GameState): Omit<BoardChanges, "id" | "active"> | null {
  const samePlayers = prev.playerOrder.length === next.playerOrder.length && prev.playerOrder.every((id, i) => id === next.playerOrder[i]);
  if (!samePlayers || next.log.length <= prev.log.length) return null;

  const birds = new Set<string>();
  const eggs = new Map<string, number>();
  const cards = new Set<CardId>();
  const resources = new Set<string>();
  let spentCube: BoardChanges["spentCube"] = null;

  for (const id of next.market) if (!prev.market.includes(id)) cards.add(id);

  for (const playerId of next.playerOrder) {
    const before = prev.players[playerId];
    const after = next.players[playerId];
    if (!before || !after) continue;

    for (const id of after.hand) if (!before.hand.includes(id)) cards.add(id);

    for (const res of RESOURCES) {
      if ((after.resources[res] ?? 0) > (before.resources[res] ?? 0)) resources.add(resourceKey(playerId, res));
    }

    if (next.round === prev.round && after.actionCubesAvailable === before.actionCubesAvailable - 1) {
      spentCube = { playerId, index: after.actionCubesAvailable };
    }

    for (const habitat of HABITATS) {
      after.board[habitat].forEach((slot, slotIndex) => {
        const old = before.board[habitat][slotIndex];
        if (!slot.cardId) return;
        if (slot.cardId !== old?.cardId) birds.add(slotKey(playerId, habitat, slotIndex));
        else if (slot.eggs > old.eggs) eggs.set(slotKey(playerId, habitat, slotIndex), slot.eggs - old.eggs);
      });
    }
  }

  const feeder = feederChange(prev.feeder, next.feeder);
  const nothing =
    !birds.size && !eggs.size && !cards.size && !resources.size && !spentCube && !feeder.taken.length && !feeder.rolled;
  return nothing ? null : { birds, eggs, cards, resources, feeder, spentCube };
}
