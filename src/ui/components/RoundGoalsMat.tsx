import React from "react";
import { Target, Trophy } from "lucide-react";
import { evaluateRoundGoalMetric } from "../../game";
import type { GameState, RoundGoal } from "../../game";
import { playerNames } from "../labels";

interface RoundGoalsMatProps {
  gameState: GameState;
}

export const RoundGoalsMat: React.FC<RoundGoalsMatProps> = ({ gameState }) => {
  return (
    <div className="goals-mat">
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
        <Target size={20} color="#235c3a" />
        <div>
          <strong style={{ fontSize: "0.95rem" }}>Objetivos de Ronda</strong>
          <div style={{ fontSize: "0.75rem", color: "#667" }}>
            Ronda {gameState.round} de 4
          </div>
        </div>
      </div>

      <div className="goals-strip">
        {gameState.roundGoals.map((goal, idx) => {
          const roundNumber = idx + 1;
          const isActive = gameState.round === roundNumber && gameState.phase !== "gameEnd";
          const isCompleted = gameState.round > roundNumber || gameState.phase === "gameEnd";
          const roundResults = gameState.roundGoalResults?.[roundNumber];

          return (
            <div
              key={goal.id}
              className={`goal-card ${isActive ? "active" : ""}`}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="round-tag">Ronda {roundNumber}</span>
                {isActive && (
                  <span style={{ fontSize: "0.7rem", color: "#235c3a", fontWeight: 700 }}>
                    ● En Curso
                  </span>
                )}
              </div>
              <strong style={{ fontSize: "0.85rem", margin: "2px 0" }}>{goal.name}</strong>
              <span style={{ fontSize: "0.7rem", color: "#667" }}>{goal.description}</span>

              {/* Score / Live Metric */}
              <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px dashed #d5ded0", fontSize: "0.75rem" }}>
                {isCompleted && roundResults ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    {Object.entries(roundResults).map(([pId, pts]) => (
                      <span key={pId}>
                        {playerNames[pId]}: <strong>+{pts}p</strong>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, color: "#445" }}>
                    {gameState.playerOrder.map((pId) => {
                      const metric = evaluateRoundGoalMetric(gameState.players[pId], gameState, goal);
                      return (
                        <span key={pId}>
                          {playerNames[pId]}: {metric}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
