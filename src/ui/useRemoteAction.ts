import { useCallback, useEffect, useState } from "react";
import type { GameState, PlayerId } from "../game";
import type { GameSpeed } from "./gameSpeed";
import { displayMs } from "./pacing";
import { describeRemoteStep } from "./remoteAnnouncement";
import type { RivalAction } from "./useBotTurns";

/**
 * En una partida online, anuncia lo que hizo el oponente humano cuando llega su jugada (al invitado
 * desde el anfitrión, y al anfitrión cuando aplica la jugada del invitado). No frena nada: la jugada
 * ya está hecha, solo queda a la vista el tiempo que lleva leerla.
 */
export function useRemoteAction(state: GameState | null, localPlayerId: PlayerId, speed: GameSpeed = "normal") {
  const [prev, setPrev] = useState(state);
  const [action, setAction] = useState<RivalAction | null>(null);

  // Ajuste de estado durante el render (patrón de React para derivar estado de un cambio de props).
  if (state !== prev) {
    setPrev(state);
    const described = prev && state?.gameMode === "online" ? describeRemoteStep(prev, state, localPlayerId) : null;
    if (described) setAction((old) => ({ ...described, id: (old?.id ?? 0) + 1, holdMs: displayMs(described, speed) }));
    else if (!state) setAction(null);
  }

  useEffect(() => {
    if (!action) return;
    const timer = window.setTimeout(() => setAction(null), action.holdMs);
    return () => window.clearTimeout(timer);
  }, [action]);

  const dismiss = useCallback(() => setAction(null), []);
  return { action, dismiss };
}
