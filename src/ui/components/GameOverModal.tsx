import React from "react";
import { rankPlayers, scorePlayerDetails } from "../../game";
import type { GameState } from "../../game";
import { playerNames } from "../labels";
import { playerSymbol, playerSymbolName } from "./playerSymbols";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import type { IconName } from "./ui/iconNames";
import { Modal } from "./ui/Modal";

interface GameOverModalProps {
  gameState: GameState;
  onRestart: () => void;
}

type ScoreKey = "birds" | "eggs" | "cachedFood" | "tuckedCards" | "roundGoals" | "bonusCards";

const ROWS: { key: ScoreKey; icon: IconName; label: string }[] = [
  { key: "birds", icon: "bird", label: "Puntos de Aves" },
  { key: "eggs", icon: "egg", label: "Huevos (1 pt c/u)" },
  { key: "cachedFood", icon: "seed", label: "Alimentos Almacenados" },
  { key: "tuckedCards", icon: "stack", label: "Cartas Solapadas" },
  { key: "roundGoals", icon: "target", label: "Objetivos de Ronda" },
  { key: "bonusCards", icon: "star", label: "Cartas de Bonificación / Dificultad" },
];

/** Resultado final: quién ganó (en texto, no solo por color de columna) y el desglose por categoría. */
export const GameOverModal: React.FC<GameOverModalProps> = ({ gameState, onRestart }) => {
  const { standings, winnerIds, decidedByFood } = rankPlayers(gameState);
  const players = standings.map(({ playerId, unusedFood }) => ({
    id: playerId,
    name: gameState.players[playerId]?.name || playerNames[playerId] || playerId,
    symbol: gameState.playerOrder.indexOf(playerId),
    isWinner: winnerIds.includes(playerId),
    unusedFood,
    details: scorePlayerDetails(gameState, playerId),
  }));
  const isTie = winnerIds.length > 1;
  const winner = players[0];

  return (
    <Modal
      title={isTie ? "¡Empate!" : `¡Victoria de ${winner.name}!`}
      subtitle="Fin de la Ronda 4. Desglose final de puntuaciones ecológicas."
      icon={<Icon name="trophy" size={56} />}
      iconStyle="round"
      align="center"
      width={800}
      className="modal--over"
      footer={
        <Button variant="primary" size="lg" icon="refresh" onClick={onRestart}>
          Jugar Otra Partida
        </Button>
      }
    >
      {decidedByFood && (
        <Banner tone="warn" icon="alert" title="Desempate">
          Empate a puntos: gana quien tiene más alimento sin usar ({players.map((p) => `${p.name}: ${p.unusedFood}`).join(" · ")}).
        </Banner>
      )}
      {isTie && (
        <Banner tone="warn" icon="alert" title="Empate total">
          Mismos puntos y el mismo alimento sin usar ({winner.unusedFood}): empate total.
        </Banner>
      )}

      <table className="score-table">
        <caption className="sr-only">Puntuación final por categoría</caption>
        <thead>
          <tr>
            <th scope="col" className="score-table__cat">
              Categoría
            </th>
            {players.map((p) => (
              <th key={p.id} scope="col" className={p.isWinner ? "score-table__win" : undefined}>
                <Icon name={playerSymbol(p.symbol)} size={20} label={`Símbolo: ${playerSymbolName(p.symbol)}`} />
                <span className="score-table__name">{p.name}</span>
                {p.isWinner && <span className="sr-only"> (ganó)</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="score-table__cat">
                <span className="score-table__label">
                  <Icon name={row.icon} size={22} />
                  {row.label}
                </span>
              </th>
              {players.map((p) => (
                <td key={p.id} className={p.isWinner ? "score-table__win" : undefined}>
                  {p.details[row.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="score-table__cat">
              Puntuación total
            </th>
            {players.map((p) => (
              <td key={p.id}>
                {p.details.total}
                <span className="score-table__unit"> pts</span>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </Modal>
  );
};
