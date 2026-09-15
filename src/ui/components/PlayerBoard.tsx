import React from "react";
import { TreePine, Waves, Wind } from "lucide-react";
import { getHabitatActionAllowance, getHabitatActiveColumn } from "../../game";
import type { GameState, HabitatId, PlayerState } from "../../game";
import { habitatLabels, playerNames } from "../labels";
import { BirdCard } from "./BirdCard";

interface PlayerBoardProps {
  player: PlayerState;
  gameState: GameState;
  isOwner?: boolean;
  onOpenLayEggsModal?: (initialBird?: { habitat: HabitatId; slotIndex: number }) => void;
  onSelectEmptySlot?: (habitat: HabitatId, slotIndex: number) => void;
  selectedHabitat?: HabitatId;
  selectedSlotIndex?: number;
  isCurrentPlayerTurn: boolean;
}

const habitatIcons: Record<HabitatId, React.ReactNode> = {
  forest: <TreePine size={20} color="#235c3a" />,
  grassland: <Wind size={20} color="#9c6c16" />,
  wetland: <Waves size={20} color="#1d618a" />,
};

const columnEggCosts = [0, 1, 1, 2, 2];

export const PlayerBoard: React.FC<PlayerBoardProps> = ({
  player,
  gameState,
  isOwner = true,
  onOpenLayEggsModal,
  onSelectEmptySlot,
  selectedHabitat,
  selectedSlotIndex,
  isCurrentPlayerTurn,
}) => {
  const habitats: HabitatId[] = ["forest", "grassland", "wetland"];
  const displayName = player.name || playerNames[player.id] || player.id;

  const grasslandAllowance = getHabitatActionAllowance(player, "grassland");

  // Espacio total de huevos disponible en todo el tablero del jugador
  let totalEggCapacity = 0;
  let totalEggsOnBoard = 0;
  habitats.forEach((h) => {
    player.board[h].forEach((s) => {
      if (s.cardId) {
        const c = gameState.cards[s.cardId];
        if (c) {
          totalEggCapacity += c.eggCapacity;
          totalEggsOnBoard += s.eggs;
        }
      }
    });
  });
  const totalFreeEggSpace = totalEggCapacity - totalEggsOnBoard;

  return (
    <div className="habitat-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
            Tablero de Hábitats: {displayName}
          </h3>
          {!isOwner && (
            <span
              style={{
                fontSize: "0.75rem",
                backgroundColor: "#eef2ed",
                color: "#235c3a",
                padding: "2px 8px",
                borderRadius: 12,
                fontWeight: 600,
                border: "1px solid #d2ded0",
              }}
            >
              👁️ Tablero del Oponente (Solo lectura)
            </span>
          )}
        </div>
        <span style={{ fontSize: "0.8rem", color: "#667" }}>
          {isOwner
            ? "La columna con borde verde es la ranura activa de acción"
            : "Viendo aves y recursos jugados por tu oponente"}
        </span>
      </div>

      {habitats.map((hab) => {
        const activeCol = getHabitatActiveColumn(player, hab);

        return (
          <div key={hab} className={`habitat-row-container ${hab}`}>
            {/* Left Info Column */}
            <div className="habitat-info">
              <div>
                <h3>
                  {habitatIcons[hab]} {habitatLabels[hab]}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", color: "#556" }}>
                  {hab === "forest" && "Obtén alimento del comedero"}
                  {hab === "grassland" && "Pon huevos en tus nidos"}
                  {hab === "wetland" && "Roba nuevas cartas de ave"}
                </p>
              </div>

              <div style={{ fontSize: "0.75rem", color: "#667", background: "rgba(255,255,255,0.7)", padding: "4px 6px", borderRadius: 4 }}>
                Aves: <strong>{player.board[hab].filter((s) => s.cardId !== null).length} / 5</strong>
              </div>

              {hab === "grassland" && isOwner && (
                <button
                  type="button"
                  onClick={() => onOpenLayEggsModal?.()}
                  disabled={!isCurrentPlayerTurn || totalFreeEggSpace <= 0}
                  style={{
                    marginTop: 8,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: isCurrentPlayerTurn && totalFreeEggSpace > 0 ? "#9c6c16" : "#d0dad0",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    cursor: isCurrentPlayerTurn && totalFreeEggSpace > 0 ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    boxShadow: isCurrentPlayerTurn && totalFreeEggSpace > 0 ? "0 2px 6px rgba(156,108,22,0.3)" : "none",
                    width: "100%",
                  }}
                  title={
                    totalFreeEggSpace <= 0
                      ? "Tus aves no tienen espacio libre para huevos"
                      : `Poner hasta ${grasslandAllowance.baseAmount} huevos en tus aves`
                  }
                >
                  <span>🥚</span>
                  <span>Poner {grasslandAllowance.baseAmount} Huevos</span>
                </button>
              )}
            </div>

            {/* 5 Slots Grid */}
            <div className="habitat-slots-grid">
              {player.board[hab].map((slot, sIdx) => {
                const card = slot.cardId ? gameState.cards[slot.cardId] : null;
                const isActiveCol = sIdx === activeCol;
                const isSelected = selectedHabitat === hab && selectedSlotIndex === sIdx;
                const eggCost = columnEggCosts[sIdx];

                return (
                  <div
                    key={sIdx}
                    className={`board-slot ${card ? "" : "empty"} ${isActiveCol ? "active-col" : ""}`}
                    style={{
                      borderWidth: isSelected ? 2 : 1.5,
                      borderColor: isSelected ? "#235c3a" : undefined,
                    }}
                    onClick={() => {
                      if (isOwner && !card && onSelectEmptySlot) {
                        onSelectEmptySlot(hab, sIdx);
                      }
                    }}
                  >
                    {card ? (
                      <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <BirdCard
                          card={card}
                          eggs={slot.eggs}
                          cached={slot.cached}
                          tucked={slot.tucked}
                          compact
                          actionLabel={
                            isOwner && slot.eggs < card.eggCapacity && isCurrentPlayerTurn && onOpenLayEggsModal
                              ? "+ 🥚 Poner"
                              : undefined
                          }
                          onAction={() => {
                            if (isOwner && onOpenLayEggsModal) {
                              onOpenLayEggsModal({ habitat: hab, slotIndex: sIdx });
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: 6, width: "100%" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#445" }}>
                          Columna {sIdx + 1}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#667", margin: "4px 0" }}>
                          {hab === "forest" && `${sIdx >= 4 ? 3 : sIdx >= 2 ? 2 : 1} Alimento`}
                          {hab === "grassland" && `${sIdx >= 4 ? 4 : sIdx >= 2 ? 3 : 2} Huevos`}
                          {hab === "wetland" && `${sIdx >= 4 ? 3 : sIdx >= 2 ? 2 : 1} Cartas`}
                        </div>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            marginTop: 6,
                            background: eggCost === 0 ? "#eaf4ed" : "#fef3d6",
                            color: eggCost === 0 ? "#235c3a" : "#9c6c16",
                            padding: "2px 4px",
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          Coste: {eggCost === 0 ? "0 🥚" : `${eggCost} 🥚`}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
