import React from "react";
import { Egg, Feather, TreePine, Utensils, Waves, Wind } from "lucide-react";
import { getHabitatActiveColumn } from "../../game";
import type { GameState, HabitatId, PlayerState } from "../../game";
import { habitatLabels, playerNames } from "../labels";
import { BirdCard } from "./BirdCard";

interface PlayerBoardProps {
  player: PlayerState;
  gameState: GameState;
  onLayEggOnSlot?: (habitat: HabitatId, slotIndex: number) => void;
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
  onLayEggOnSlot,
  onSelectEmptySlot,
  selectedHabitat,
  selectedSlotIndex,
  isCurrentPlayerTurn,
}) => {
  const habitats: HabitatId[] = ["forest", "grassland", "wetland"];

  return (
    <div className="habitat-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
          Tablero de Hábitats: {playerNames[player.id]}
        </h3>
        <span style={{ fontSize: "0.8rem", color: "#667" }}>
          La columna con borde verde es la ranura activa de acción
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
                      if (!card && onSelectEmptySlot) {
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
                            hab === "grassland" && slot.eggs < card.eggCapacity && isCurrentPlayerTurn
                              ? "+ 1 Huevo"
                              : undefined
                          }
                          onAction={() => {
                            if (onLayEggOnSlot) onLayEggOnSlot(hab, sIdx);
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
