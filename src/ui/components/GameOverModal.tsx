import React from "react";
import { Bot, RefreshCw, Trophy } from "lucide-react";
import { scorePlayerDetails } from "../../game";
import type { GameState } from "../../game";
import { playerNames } from "../labels";

interface GameOverModalProps {
  gameState: GameState;
  onRestart: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  gameState,
  onRestart,
}) => {
  const playerScores = gameState.playerOrder.map((pId) => ({
    id: pId,
    name: playerNames[pId] ?? pId,
    isAutoma: gameState.players[pId]?.isAutoma,
    details: scorePlayerDetails(gameState, pId),
  }));

  playerScores.sort((a, b) => b.details.total - a.details.total);
  const isTie = playerScores[0]?.details.total === playerScores[1]?.details.total;
  const winner = playerScores[0];

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 640 }}>
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          {winner.isAutoma ? (
            <Bot size={48} color="#93a397" style={{ margin: "0 auto 10px auto" }} />
          ) : (
            <Trophy size={48} color="#f0bf5c" style={{ margin: "0 auto 10px auto" }} />
          )}
          <h2 style={{ margin: "0 0 6px 0", fontSize: "1.7rem" }}>
            {isTie
              ? "¡Empate en la Partida!"
              : winner.isAutoma
                ? "¡Victoria de Automa!"
                : `¡Victoria de ${winner.name}!`}
          </h2>
          <p style={{ margin: 0, color: "#93a397", fontSize: "0.95rem" }}>
            Fin de la Ronda 4. Desglose final de puntuaciones ecológicas.
          </p>
        </div>

        {/* Detailed scoring comparison table */}
        <table style={{ width: "100%", borderCollapse: "collapse", margin: "10px 0" }}>
          <thead>
            <tr style={{ background: "#1c241d", borderBottom: "2px solid #2b332e", textAlign: "left" }}>
              <th style={{ padding: "10px 12px" }}>Categoría</th>
              {playerScores.map((p) => (
                <th key={p.id} style={{ padding: "10px 12px", textAlign: "center" }}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #2b332e" }}>
              <td style={{ padding: "8px 12px" }}>🪶 Puntos de Aves / Reserva</td>
              {playerScores.map((p) => (
                <td key={p.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.details.birds}
                </td>
              ))}
            </tr>
            <tr style={{ borderBottom: "1px solid #2b332e" }}>
              <td style={{ padding: "8px 12px" }}>🥚 Huevos (1 pt c/u)</td>
              {playerScores.map((p) => (
                <td key={p.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.details.eggs}
                </td>
              ))}
            </tr>
            <tr style={{ borderBottom: "1px solid #2b332e" }}>
              <td style={{ padding: "8px 12px" }}>🌾 Alimentos Almacenados</td>
              {playerScores.map((p) => (
                <td key={p.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.details.cachedFood}
                </td>
              ))}
            </tr>
            <tr style={{ borderBottom: "1px solid #2b332e" }}>
              <td style={{ padding: "8px 12px" }}>📑 Cartas Solapadas</td>
              {playerScores.map((p) => (
                <td key={p.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.details.tuckedCards}
                </td>
              ))}
            </tr>
            <tr style={{ borderBottom: "1px solid #2b332e" }}>
              <td style={{ padding: "8px 12px" }}>🎯 Objetivos de Ronda</td>
              {playerScores.map((p) => (
                <td key={p.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.details.roundGoals}
                </td>
              ))}
            </tr>
            <tr style={{ borderBottom: "2px solid #2b332e" }}>
              <td style={{ padding: "8px 12px" }}>⭐ Cartas de Bonificación / Dificultad</td>
              {playerScores.map((p) => (
                <td key={p.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.details.bonusCards}
                </td>
              ))}
            </tr>
            <tr style={{ background: "rgba(63, 174, 114, 0.1)", fontWeight: 800, fontSize: "1.1rem" }}>
              <td style={{ padding: "12px" }}>PUNTUACIÓN TOTAL</td>
              {playerScores.map((p) => (
                <td key={p.id} style={{ padding: "12px", textAlign: "center", color: "#3fae72" }}>
                  {p.details.total} pts
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
          <button
            onClick={onRestart}
            style={{
              backgroundColor: "#1f7a4f",
              padding: "10px 24px",
              fontSize: "1rem",
            }}
          >
            <RefreshCw size={18} /> Jugar Otra Partida
          </button>
        </div>
      </div>
    </div>
  );
};
