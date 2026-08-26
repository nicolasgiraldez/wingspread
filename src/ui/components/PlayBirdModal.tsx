import React, { useState } from "react";
import { Bird, Egg, X } from "lucide-react";
import { canPayResources, isLegalMove } from "../../game";
import type {
  CardId,
  GameState,
  HabitatId,
  Move,
  PlayerState,
  ResourceFace,
  SlotRef,
  SpeciesCard,
} from "../../game";
import {
  habitatLabels,
  resourceIcons,
  resourceLabels,
} from "../labels";
import { BirdCard } from "./BirdCard";

interface PlayBirdModalProps {
  card: SpeciesCard;
  player: PlayerState;
  gameState: GameState;
  onConfirmPlay: (move: Extract<Move, { type: "playBird" }>) => void;
  onClose: () => void;
}

export const PlayBirdModal: React.FC<PlayBirdModalProps> = ({
  card,
  player,
  gameState,
  onConfirmPlay,
  onClose,
}) => {
  const availableHabitats = card.habitats;
  const [selectedHabitat, setSelectedHabitat] = useState<HabitatId>(
    availableHabitats[0] ?? "forest",
  );

  // Find first empty slot in selected habitat
  const firstEmptySlot = player.board[selectedHabitat].findIndex(
    (s) => s.cardId === null,
  );
  const slotIndex = firstEmptySlot === -1 ? 0 : firstEmptySlot;
  const eggCost = slotIndex === 0 ? 0 : slotIndex <= 2 ? 1 : 2;

  // Selected payment resources
  const [selectedPaidResources, setSelectedPaidResources] = useState<ResourceFace[]>(() => {
    // Try to auto-select exact matches or wild
    const paid: ResourceFace[] = [];
    const available = { ...player.resources };

    for (const [res, count] of Object.entries(card.cost)) {
      if (res === "wild") continue;
      const r = res as ResourceFace;
      for (let i = 0; i < (count ?? 0); i += 1) {
        if ((available[r] ?? 0) > 0) {
          paid.push(r);
          available[r] = (available[r] ?? 1) - 1;
        }
      }
    }

    if (card.cost.wild) {
      for (let i = 0; i < card.cost.wild; i += 1) {
        for (const [res, amt] of Object.entries(available)) {
          if ((amt ?? 0) > 0) {
            paid.push(res as ResourceFace);
            available[res as ResourceFace] = (amt ?? 1) - 1;
            break;
          }
        }
      }
    }

    return paid;
  });

  // Egg payments from board
  const [paidEggsFrom, setPaidEggsFrom] = useState<SlotRef[]>(() => {
    const list: SlotRef[] = [];
    if (eggCost > 0) {
      for (const hab of ["forest", "grassland", "wetland"] as HabitatId[]) {
        for (let s = 0; s < player.board[hab].length; s += 1) {
          const slot = player.board[hab][s];
          let availableEggs = slot.eggs;
          while (availableEggs > 0 && list.length < eggCost) {
            list.push({ habitat: hab, slotIndex: s });
            availableEggs -= 1;
          }
        }
      }
    }
    return list;
  });

  const toggleResourceForPayment = (res: ResourceFace) => {
    const countInPaid = selectedPaidResources.filter((r) => r === res).length;
    const playerTotal = player.resources[res] ?? 0;

    if (countInPaid < playerTotal) {
      setSelectedPaidResources([...selectedPaidResources, res]);
    } else {
      // Remove one instance
      const idx = selectedPaidResources.lastIndexOf(res);
      if (idx !== -1) {
        const next = [...selectedPaidResources];
        next.splice(idx, 1);
        setSelectedPaidResources(next);
      }
    }
  };

  const isPaymentValid = canPayResources(player, selectedPaidResources, card.cost);
  const isEggCostValid = paidEggsFrom.length === eggCost;
  const isSlotAvailable = firstEmptySlot !== -1;

  const move: Extract<Move, { type: "playBird" }> = {
    type: "playBird",
    cardId: card.id,
    habitat: selectedHabitat,
    slotIndex,
    paidResources: selectedPaidResources,
    paidEggsFrom,
  };

  const isMoveValid = isSlotAvailable && isEggCostValid && isPaymentValid && isLegalMove(gameState, player.id, move);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Jugar Ave: {card.name}</h2>
          <button
            onClick={onClose}
            style={{ background: "transparent", color: "#667", padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16 }}>
          <BirdCard card={card} compact />

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Step 1: Habitat selection */}
            <div>
              <strong style={{ fontSize: "0.9rem" }}>1. Selecciona el Hábitat</strong>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {availableHabitats.map((hab) => (
                  <button
                    key={hab}
                    onClick={() => setSelectedHabitat(hab)}
                    style={{
                      flex: 1,
                      backgroundColor: selectedHabitat === hab ? "#235c3a" : "#eaf4ed",
                      color: selectedHabitat === hab ? "#ffffff" : "#235c3a",
                      border: "1px solid #b8dbc0",
                      justifyContent: "center",
                    }}
                  >
                    {habitatLabels[hab]}
                  </button>
                ))}
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#667" }}>
                Se colocará en la Columna {slotIndex + 1} de {habitatLabels[selectedHabitat]} (Coste: {eggCost} 🥚).
              </p>
            </div>

            {/* Step 2: Resource Payment & 2:1 */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.9rem" }}>2. Pago de Alimentos</strong>
                <span style={{ fontSize: "0.75rem", color: isPaymentValid ? "#235c3a" : "#b91c1c", fontWeight: 700 }}>
                  {isPaymentValid ? "✓ Pago Válido" : "✗ Faltan Alimentos / Inválido"}
                </span>
              </div>
              <p style={{ margin: "2px 0 6px 0", fontSize: "0.75rem", color: "#667" }}>
                Haz clic en tus recursos para seleccionarlos. Puedes usar 2 recursos cualesquiera por cada 1 requerido.
              </p>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(player.resources).map(([res, total]) => {
                  const r = res as ResourceFace;
                  const selectedCount = selectedPaidResources.filter((item) => item === r).length;
                  const available = (total ?? 0) - selectedCount;

                  return (
                    <button
                      key={r}
                      onClick={() => toggleResourceForPayment(r)}
                      disabled={(total ?? 0) === 0 && selectedCount === 0}
                      style={{
                        backgroundColor: selectedCount > 0 ? "#235c3a" : "#ffffff",
                        color: selectedCount > 0 ? "#ffffff" : "#1d2a22",
                        border: "1.5px solid #d2ded0",
                        padding: "6px 10px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {resourceIcons[r]} {resourceLabels[r]}: {selectedCount}/{total ?? 0}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Egg cost check */}
            {eggCost > 0 && (
              <div>
                <strong style={{ fontSize: "0.9rem" }}>3. Coste en Huevos ({eggCost} 🥚)</strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: isEggCostValid ? "#235c3a" : "#b91c1c" }}>
                  {isEggCostValid
                    ? `✓ Se descontarán ${eggCost} huevo(s) de tu tablero.`
                    : `✗ Necesitas al menos ${eggCost} huevo(s) en tu tablero para jugar en esta columna.`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #d2ded0", paddingTop: 14 }}>
          <button onClick={onClose} style={{ backgroundColor: "#e2e8f0", color: "#334155" }}>
            Cancelar
          </button>
          <button
            onClick={() => onConfirmPlay(move)}
            disabled={!isMoveValid}
            style={{ backgroundColor: "#235c3a" }}
          >
            <Bird size={16} /> Confirmar y Jugar Ave
          </button>
        </div>
      </div>
    </div>
  );
};
