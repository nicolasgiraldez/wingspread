import React from "react";
import { evaluateRoundGoalMetric } from "../../game";
import type { GameState } from "../../game";
import { playerNames } from "../labels";
import { playerSymbol, playerSymbolName } from "./playerSymbols";
import { Icon } from "./ui/Icon";

interface RoundGoalsMatProps {
  gameState: GameState;
}

export const RoundGoalsMat: React.FC<RoundGoalsMatProps> = ({ gameState }) => {
  const nameOf = (id: string) => gameState.players[id]?.name || playerNames[id] || id;

  return (
    <section className="panel-wide" aria-labelledby="goals-title">
      <div className="panel-wide__head">
        <h2 id="goals-title" className="panel-wide__title">
          Objetivos de Ronda
        </h2>
        <span className="panel-wide__count">Ronda {gameState.round} de 4</span>
      </div>

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
    </section>
  );
};
