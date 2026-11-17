import React, { useEffect, useId, useRef, useState } from "react";
import { evaluateRoundGoalMetric } from "../../game";
import type { GameState } from "../../game";
import { playerNames } from "../labels";
import { playerSymbol, playerSymbolName } from "./playerSymbols";
import { Icon } from "./ui/Icon";

interface RoundGoalsMatProps {
  gameState: GameState;
  /**
   * Versión plegada (pantallas anchas): una franja con el objetivo de la ronda en curso y la cuenta de
   * cada jugador; un botón despliega los cuatro objetivos encima de la mesa.
   */
  collapsible?: boolean;
}

export const RoundGoalsMat: React.FC<RoundGoalsMatProps> = ({ gameState, collapsible = false }) => {
  const nameOf = (id: string) => gameState.players[id]?.name || playerNames[id] || id;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const list = (
      <ol className="goals">
        {gameState.roundGoals.map((goal, idx) => {
          const roundNumber = idx + 1;
          const isActive = gameState.round === roundNumber && gameState.phase !== "gameEnd";
          const isCompleted = gameState.round > roundNumber || gameState.phase === "gameEnd";
          const roundResults = gameState.roundGoalResults?.[roundNumber];
          const status = isActive ? "En curso" : isCompleted ? "Cerrada" : "Próxima";

          return (
            <li key={goal.id} className={`goal${isActive ? " is-selected" : ""}`}>
              <div className="goal__head">
                <span className="label">Ronda {roundNumber}</span>
                <span className={`chip goal__status${isActive ? " chip--on" : ""}`}>
                  {isActive && <span className="goal__dot" aria-hidden="true" />}
                  {status}
                </span>
              </div>
              <h3 className="goal__name">{goal.name}</h3>
              <p className="goal__desc">{goal.description}</p>

              {/* Puntos ganados (ronda cerrada) o cuenta actual (ronda en curso y próximas) */}
              <ul className="goal__scores">
                {gameState.playerOrder.map((pId, pIdx) => {
                  const closedPoints = isCompleted && roundResults ? roundResults[pId] : undefined;
                  const metric =
                    closedPoints === undefined
                      ? evaluateRoundGoalMetric(gameState.players[pId], gameState, goal)
                      : undefined;
                  return (
                    <li key={pId} className="goal__score">
                      <Icon name={playerSymbol(pIdx)} size={18} label={`Símbolo: ${playerSymbolName(pIdx)}`} />
                      <span className="goal__player">{nameOf(pId)}</span>
                      <span className="goal__value">
                        {closedPoints !== undefined ? (
                          <>
                            +{closedPoints}
                            <span className="goal__unit">p</span>
                            <span className="sr-only"> puntos</span>
                          </>
                        ) : (
                          metric
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
  );

  if (collapsible) {
    const ended = gameState.phase === "gameEnd";
    const currentIndex = Math.min(Math.max(gameState.round, 1), gameState.roundGoals.length) - 1;
    const current = gameState.roundGoals[currentIndex];
    return (
      <section ref={rootRef} className="goals-strip" aria-labelledby="goals-title">
        <div className="goals-strip__bar">
          <h2 id="goals-title" className="label goals-strip__label">
            {ended ? "Objetivos de ronda" : `Objetivo · Ronda ${currentIndex + 1}`}
          </h2>
          {current && !ended && (
            <>
              <strong className="goals-strip__name" title={current.description}>
                {current.name}
              </strong>
              <ul className="goals-strip__scores">
                {gameState.playerOrder.map((pId, pIdx) => (
                  <li key={pId} className="goals-strip__score" title={nameOf(pId)}>
                    <Icon name={playerSymbol(pIdx)} size={16} label={`Símbolo: ${playerSymbolName(pIdx)}`} />
                    <span className="sr-only">{nameOf(pId)}: </span>
                    <span className="goals-strip__value">{evaluateRoundGoalMetric(gameState.players[pId], gameState, current)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            className="btn btn--sm goals-strip__toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Ocultar objetivos" : "Ver los 4 objetivos"}
          </button>
        </div>
        {open && (
          <div id={panelId} className="goals-strip__panel">
            {list}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="panel-wide" aria-labelledby="goals-title">
      <div className="panel-wide__head">
        <h2 id="goals-title" className="panel-wide__title">
          Objetivos de Ronda
        </h2>
        <span className="panel-wide__count">Ronda {gameState.round} de 4</span>
      </div>

      {list}
    </section>
  );
};
