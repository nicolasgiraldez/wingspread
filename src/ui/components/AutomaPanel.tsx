import React from "react";
import { Bot, Cpu, Egg, Layers, Sparkles, Target } from "lucide-react";
import type { AutomaState, GameState, PlayerState } from "../../game";
import { difficultyLabels } from "../labels";

interface AutomaPanelProps {
  automaState: AutomaState;
  automaPlayer: PlayerState;
  gameState: GameState;
}

export const AutomaPanel: React.FC<AutomaPanelProps> = ({
  automaState,
  automaPlayer,
  gameState,
}) => {
  const currentCard = automaState.currentCard;
  const currentActions = currentCard ? currentCard.roundActions[gameState.round] : [];
  const diffMultiplier = automaState.difficulty === "easy" ? 3 : automaState.difficulty === "normal" ? 4 : 5;

  return (
    <div style={{ background: "#f5f6f8", border: "1.5px solid #d0d7de", borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: "#24292f", color: "#ffffff", padding: 6, borderRadius: 8 }}>
            <Bot size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Automa (Oponente IA)</h3>
            <span style={{ fontSize: "0.75rem", color: "#57606a" }}>
              Dificultad: <strong>{difficultyLabels[automaState.difficulty]}</strong> ({diffMultiplier} pts / ave en reserva)
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", color: "#57606a" }}>Cubos de acción:</span>
          <strong>{automaPlayer.actionCubesAvailable}</strong>
        </div>
      </div>

      {/* Automa Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
        <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 8, border: "1px solid #e1e4e8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "#57606a" }}>
            <Layers size={14} color="#0969da" /> Aves en Reserva
          </div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: 2 }}>
            {automaState.stashedCardsCount} <small style={{ fontSize: "0.75rem", color: "#57606a" }}>({automaState.stashedCardsCount * diffMultiplier} pts)</small>
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 8, border: "1px solid #e1e4e8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "#57606a" }}>
            <Egg size={14} color="#9a6700" /> Huevos Acumulados
          </div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: 2 }}>
            {automaState.eggs} <small style={{ fontSize: "0.75rem", color: "#57606a" }}>({automaState.eggs} pts)</small>
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 8, border: "1px solid #e1e4e8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "#57606a" }}>
            <Target size={14} color="#1a7f37" /> Progreso Ronda {gameState.round}
          </div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: 2 }}>
            {automaState.roundGoalMetric}
          </div>
        </div>
      </div>

      {/* Current Action Card of Automa */}
      {currentCard ? (
        <div style={{ background: "#ffffff", border: "1px solid #d0d7de", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: "0.8rem", color: "#57606a", fontWeight: 600 }}>
              Última Carta de Acción Jugada:
            </span>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#24292f" }}>
              {currentCard.name}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#24292f" }}>
            {currentActions.map((act, i) => (
              <span key={i} style={{ background: "#f6f8fa", padding: "3px 6px", borderRadius: 4, marginRight: 6, border: "1px solid #eaeef2" }}>
                {act.type === "gainFoodFromFeeder" && `Retirar ${act.count} dado(s) del comedero`}
                {act.type === "drawMarketCard" && `Robar ${act.count} ave(s) del mercado`}
                {act.type === "stashCardFromDeck" && `Guardar ${act.count} ave(s) en reserva`}
                {act.type === "layEggs" && `Poner ${act.count} huevo(s)`}
                {act.type === "advanceGoal" && `+${act.metricBonus} al objetivo de ronda`}
              </span>
            ))}
          </p>
        </div>
      ) : (
        <div style={{ fontSize: "0.8rem", color: "#57606a", fontStyle: "italic", textAlign: "center", padding: 8 }}>
          El Automa revelará una carta en su próximo turno.
        </div>
      )}
    </div>
  );
};
