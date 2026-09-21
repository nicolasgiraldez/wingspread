import { createContext, useContext, useEffect, useState } from "react";
import type { GameState } from "../game";
import { diffBoard, NO_CHANGES } from "./boardChanges";
import type { BoardChanges } from "./boardChanges";

/** Cuánto se conservan los cambios: lo que dura la animación más larga, con margen. Después no queda nada marcado. */
const CHANGES_MS = 3000;

/** Lo que cambió en la última jugada; los componentes de la mesa lo leen para animarse. */
export const BoardChangesContext = createContext<BoardChanges>(NO_CHANGES);

export function useBoardChanges(): BoardChanges {
  return useContext(BoardChangesContext);
}

/**
 * Compara cada estado nuevo con el anterior y publica qué cambió durante unos segundos. Al cargar una
 * partida, empezar otra o volver al inicio no hay "anterior": no se anima nada.
 */
export function useBoardChangeTracker(state: GameState | null): BoardChanges {
  const [prev, setPrev] = useState(state);
  const [changes, setChanges] = useState<BoardChanges>(NO_CHANGES);

  // Ajuste de estado durante el render (patrón de React para derivar estado de un cambio de props).
  if (state !== prev) {
    setPrev(state);
    const diff = prev && state ? diffBoard(prev, state) : null;
    if (diff) setChanges((old) => ({ ...diff, id: old.id + 1, active: true }));
    else if (!state) setChanges((old) => ({ ...NO_CHANGES, id: old.id }));
  }

  useEffect(() => {
    if (!changes.active) return;
    const timer = window.setTimeout(
      () => setChanges((old) => (old.id === changes.id ? { ...NO_CHANGES, id: old.id } : old)),
      CHANGES_MS,
    );
    return () => window.clearTimeout(timer);
  }, [changes]);

  return changes;
}
