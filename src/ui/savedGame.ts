import { bonusCardsCatalog, speciesCards } from "../game";
import type { BonusCard, GameState } from "../game";

/**
 * Partida guardada en el navegador para poder continuarla tras recargar o cerrar la pestaña.
 * Solo se guarda la del modo solitario y la del ANFITRIÓN online: el invitado no necesita nada,
 * porque el anfitrión es la fuente de verdad y le reenvía el estado al reconectar.
 */
export type SavedGame =
  | { kind: "solo"; state: GameState; savedAt: number }
  | { kind: "online-host"; state: GameState; roomCode: string; savedAt: number };

const STORAGE_KEY = "wingspread.savedGame.v2";
/** Versión anterior (partidas con el Automa y la preparación antigua): incompatible, se descarta. */
const LEGACY_STORAGE_KEY = "wingspread.savedGame.v1";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

// Estado del último guardado, para avisar en pantalla cuando el navegador no deja guardar.
let saveBlocked = false;
const saveListeners = new Set<() => void>();

function setSaveBlocked(blocked: boolean) {
  if (blocked === saveBlocked) return;
  saveBlocked = blocked;
  saveListeners.forEach((listener) => listener());
}

/** Para useSyncExternalStore: avisa cuando cambia si el guardado está bloqueado. */
export function subscribeSaveStatus(listener: () => void): () => void {
  saveListeners.add(listener);
  return () => {
    saveListeners.delete(listener);
  };
}

/** true si el último intento de guardar falló (almacenamiento lleno o bloqueado, p. ej. modo privado). */
export function isSaveBlocked(): boolean {
  return saveBlocked;
}

/** Guarda la partida; devuelve false si no se pudo (almacenamiento lleno o bloqueado). */
export function saveGame(game: SavedGame): boolean {
  try {
    // Los catálogos de cartas son estáticos y pesan ~66 KB: no se guardan. Al cargar se usan
    // los de la versión actual, así una partida guardada no arrastra datos viejos de cartas.
    const stored = { ...game, state: { ...game.state, cards: undefined, bonusCardsCatalog: undefined } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setSaveBlocked(false);
    return true;
  } catch {
    // Almacenamiento lleno o bloqueado (modo privado): la partida sigue, solo no se puede reanudar.
    setSaveBlocked(true);
    return false;
  }
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nada que limpiar
  }
}

export function loadSavedGame(): SavedGame | null {
  let raw: string | null;
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const game = restoreGame(parsed);
  if (!game) clearSavedGame(); // corrupta o de una versión incompatible: no sirve de nada guardarla
  return game;
}

/**
 * Valida un valor leído del almacenamiento y lo convierte en una partida jugable, o devuelve
 * null si no es fiable (formato roto, cartas que ya no existen, partida terminada...).
 */
export function restoreGame(value: unknown): SavedGame | null {
  if (!isRecord(value) || typeof value.savedAt !== "number" || !isRecord(value.state)) return null;
  const kind = value.kind;
  if (kind !== "solo" && kind !== "online-host") return null;
  if (kind === "online-host" && (typeof value.roomCode !== "string" || value.roomCode === "")) return null;
  // Una partida solitaria necesita un rival de la IA que juegue; sin él quedaría parada.
  const hasBot = isRecord(value.state.players) && Object.values(value.state.players).some((p) => isRecord(p) && p.botLevel);
  if (kind === "solo" && !hasBot) return null;

  const raw = value.state;
  const players = raw.players;
  if (
    !isRecord(players) ||
    !isArray(raw.playerOrder) ||
    !raw.playerOrder.every((id) => typeof id === "string" && isRecord(players[id])) ||
    !["setup", "round"].includes(raw.phase as string) ||
    ![1, 2, 3, 4].includes(raw.round as number) ||
    raw.gameMode !== (kind === "solo" ? "solo" : "online") ||
    typeof raw.currentPlayerId !== "string" ||
    !isRecord(players[raw.currentPlayerId]) ||
    !isArray(raw.deck) ||
    !isArray(raw.discard) ||
    !isArray(raw.market) ||
    !isArray(raw.feeder) ||
    !isArray(raw.bonusDeck) ||
    !isArray(raw.bonusDiscard) ||
    !isArray(raw.log)
  ) {
    return null;
  }

  // Sin cartas desconocidas: si una carta cambió de id entre versiones, la partida no es fiable.
  const cardIds: unknown[] = [...raw.deck, ...raw.discard, ...raw.market];
  for (const player of Object.values(players)) {
    if (!isRecord(player) || !isArray(player.hand) || !isRecord(player.board) || !isArray(player.bonusCards)) return null;
    cardIds.push(...player.hand);
    for (const row of Object.values(player.board)) {
      if (!isArray(row) || row.length !== 5) return null;
      for (const slot of row) {
        if (!isRecord(slot) || !isArray(slot.tucked)) return null;
        if (slot.cardId !== null) cardIds.push(slot.cardId);
        cardIds.push(...slot.tucked);
      }
    }
  }
  if (!cardIds.every((id) => typeof id === "string" && id in speciesCards)) return null;

  // Las bonificaciones de cada jugador son copias de la definición: se re-toman del catálogo actual.
  const state = { ...raw, cards: { ...speciesCards }, bonusCardsCatalog: { ...bonusCardsCatalog } } as unknown as GameState;
  for (const id of state.playerOrder) {
    const player = state.players[id];
    const bonusCards: BonusCard[] = [];
    for (const bonus of player.bonusCards as unknown[]) {
      const current = isRecord(bonus) && typeof bonus.id === "string" ? bonusCardsCatalog[bonus.id] : undefined;
      if (!current) return null;
      bonusCards.push(current);
    }
    player.bonusCards = bonusCards;
  }

  return kind === "solo"
    ? { kind, state, savedAt: value.savedAt }
    : { kind, state, savedAt: value.savedAt, roomCode: value.roomCode as string };
}

/** Datos mínimos para mostrar la tarjeta "Continuar partida" en la pantalla de inicio. */
export type SavedGameSummary = {
  kind: SavedGame["kind"];
  roomCode?: string;
  round: number;
  savedAt: number;
};

export function summarizeSavedGame(game: SavedGame): SavedGameSummary {
  return {
    kind: game.kind,
    roomCode: game.kind === "online-host" ? game.roomCode : undefined,
    round: game.state.round,
    savedAt: game.savedAt,
  };
}

/** "hace un momento", "hace 5 min", "hace 3 h", "hace 2 días". */
export function formatSavedAgo(savedAt: number, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - savedAt) / 60_000));
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}
