import React from "react";
import { rankPlayers, scorePlayerDetails } from "../../game";
import type { GameState } from "../../game";
import { playerNames } from "../labels";
import { Icon } from "./ui/Icon";
import type { IconName } from "./ui/iconNames";

interface GameOverModalProps {
  gameState: GameState;
  onRestart: () => void;
}

const categoryLabel = (icon: IconName, text: string) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
    <Icon name={icon} size={20} />
    {text}
  </span>
);

export const GameOverModal: React.FC<GameOverModalProps> = ({
  gameState,
  onRestart,
}) => {
  const { standings, winnerIds, decidedByFood } = rankPlayers(gameState);
  const playerScores = standings.map(({ playerId, unusedFood }) => ({
    id: playerId,
    name: gameState.players[playerId]?.name || playerNames[playerId] || playerId,
    isBot: !!gameState.players[playerId]?.botLevel,
    unusedFood,
    details: scorePlayerDetails(gameState, playerId),
  }));
  const isTie = winnerIds.length > 1;
  const winner = playerScores[0];

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 640 }}>
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          {winner.isBot && !isTie ? (
            <span style={{ display: "inline-flex", margin: "0 auto 10px auto" }}>
              <Icon name="bot" size={56} />
            </span>
          ) : (
            <span style={{ display: "inline-flex", margin: "0 auto 10px auto" }}>
              <Icon name="trophy" size={56} />
            </span>
          )}
          <h2 style={{ margin: "0 0 6px 0", fontSize: "1.7rem" }}>
            {isTie
              ? "¡Empate en la Partida!"
              : `¡Victoria de ${winner.name}!`}
          </h2>
          <p style={{ margin: 0, color: "#93a397", fontSize: "0.95rem" }}>
            Fin de la Ronda 4. Desglose final de puntuaciones ecológicas.
          </p>
          {decidedByFood && (
            <p style={{ margin: "6px 0 0 0", color: "#d9a83b", fontSize: "0.85rem" }}>
              Empate a puntos: gana quien tiene más alimento sin usar ({playerScores.map((p) => `${p.name}: ${p.unusedFood}`).join(" · ")}).
            </p>
          )}
          {isTie && (
            <p style={{ margin: "6px 0 0 0", color: "#d9a83b", fontSize: "0.85rem" }}>
              Mismos puntos y el mismo alimento sin usar ({winner.unusedFood}): empate total.
            </p>
          )}
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
              <td style={{ padding: "8px 12px" }}>{categoryLabel("bird", "Puntos de Aves")}</td>
              {playerScores.map((p) => (
                <td key={p.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.details.birds}
                </td>
              ))}
            </tr>
            <tr style={{ borderBottom: "1px solid #2b332e" }}>
              <td style={{ padding: "8px 12px" }}>{categoryLabel("egg", "Huevos (1 pt c/u)")}</td>
              {playerScores.map((p) => (
                <td key={p.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.details.eggs}
                </td>
              ))}
            </tr>
            <tr style={{ borderBottom: "1px solid #2b332e" }}>
              <td style={{ padding: "8px 12px" }}>{categoryLabel("seed", "Alimentos Almacenados")}</td>
              {playerScores.map((p) => (
                <td key={p.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.details.cachedFood}
                </td>
              ))}
            </tr>
            <tr style={{ borderBottom: "1px solid #2b332e" }}>
              <td style={{ padding: "8px 12px" }}>{categoryLabel("stack", "Cartas Solapadas")}</td>
              {playerScores.map((p) => (
                <td key={p.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.details.tuckedCards}
                </td>
              ))}
            </tr>
            <tr style={{ borderBottom: "1px solid #2b332e" }}>
              <td style={{ padding: "8px 12px" }}>{categoryLabel("target", "Objetivos de Ronda")}</td>
              {playerScores.map((p) => (
                <td key={p.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.details.roundGoals}
                </td>
              ))}
            </tr>
            <tr style={{ borderBottom: "2px solid #2b332e" }}>
              <td style={{ padding: "8px 12px" }}>{categoryLabel("star", "Cartas de Bonificación / Dificultad")}</td>
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
            <Icon name="refresh" size={18} /> Jugar Otra Partida
          </button>
        </div>
      </div>
    </div>
  );
};
