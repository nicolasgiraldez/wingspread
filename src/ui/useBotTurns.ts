import { useCallback, useEffect, useRef, useState } from "react";
import { nextBotActor, stepBot } from "../game";
import type { GameState } from "../game";
import type { GameSpeed } from "./gameSpeed";
import { displayMs, holdMs, thinkMs } from "./pacing";
import { describeStep } from "./stepAnnouncement";
import type { StepAnnouncement } from "./stepAnnouncement";

/** Una acción del rival en pantalla; `id` distingue una de otra aunque el texto se repita y `holdMs` es cuánto queda visible. */
export type RivalAction = StepAnnouncement & { id: number; holdMs: number };

/**
 * Hace jugar a los rivales de la IA de a una jugada, con pausas: espera un momento ("está jugando"),
 * aplica la jugada y deja a la vista lo que hizo hasta que se lee, antes de pasar a la siguiente.
 * `commit` recibe cada estado nuevo. Las elecciones sin anuncio (preparación inicial, bonificación)
 * se resuelven al instante. La velocidad acorta las pausas o las quita.
 *
 * Todo se deriva del estado (`nextBotActor`), así que al reanudar una partida guardada a mitad del
 * turno del rival, este sigue jugando solo.
 */
export function useBotTurns(state: GameState | null, commit: (next: GameState) => void, speed: GameSpeed = "normal") {
  const [action, setAction] = useState<RivalAction | null>(null);
  const [holding, setHolding] = useState(false);
  const nextId = useRef(0);
  const holdTimer = useRef<number | undefined>(undefined);
  const displayTimer = useRef<number | undefined>(undefined);

  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  useEffect(
    () => () => {
      window.clearTimeout(holdTimer.current);
      window.clearTimeout(displayTimer.current);
    },
    [],
  );

  /** Quita la acción de pantalla y libera al rival para su siguiente jugada. */
  const dismiss = useCallback(() => {
    window.clearTimeout(holdTimer.current);
    window.clearTimeout(displayTimer.current);
    setAction(null);
    setHolding(false);
  }, []);

  useEffect(() => {
    if (!state || holding) return;
    const botId = nextBotActor(state);
    if (!botId) return;
    const player = state.players[botId];
    const silent = !!(player.pendingStartingHand || player.pendingBonusChoice?.length);

    const timer = window.setTimeout(() => {
      const step = stepBot(state);
      if (!step) return;
      commitRef.current(step.state);

      const described = describeStep(state, step.state, step.move, step.botId);
      if (!described) return;
      nextId.current += 1;
      const shownFor = displayMs(described, speed);
      setAction({ ...described, id: nextId.current, holdMs: shownFor });
      window.clearTimeout(displayTimer.current);
      displayTimer.current = window.setTimeout(() => setAction(null), shownFor);

      // Sin pausas no se espera: el rival sigue con su próxima jugada mientras la acción se lee.
      const hold = holdMs(described, speed);
      window.clearTimeout(holdTimer.current);
      if (hold > 0) {
        setHolding(true);
        holdTimer.current = window.setTimeout(() => setHolding(false), hold);
      }
    }, silent ? 0 : thinkMs(speed));

    return () => window.clearTimeout(timer);
  }, [state, holding, speed]);

  return { action, dismiss };
}
