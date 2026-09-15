import React, { useState } from "react";
import { Check, Egg, Minus, Plus, TreePine, Waves, Wind, X } from "lucide-react";
import { getHabitatActionAllowance } from "../../game";
import type {
  GameState,
  HabitatId,
  Move,
  PlayerState,
  ResourceFace,
  SpeciesCard,
} from "../../game";
import {
  habitatLabels,
  nestIcons,
  nestLabels,
  resourceIcons,
  resourceLabels,
} from "../labels";

interface LayEggsModalProps {
  player: PlayerState;
  gameState: GameState;
  initialBird?: { habitat: HabitatId; slotIndex: number };
  onConfirmLayEggs: (move: Extract<Move, { type: "layEggs" }>) => void;
  onClose: () => void;
}

interface BirdSlotInfo {
  habitat: HabitatId;
  slotIndex: number;
  card: SpeciesCard;
  currentEggs: number;
  eggCapacity: number;
  availableSpace: number;
}

const habitatIcons: Record<HabitatId, React.ReactNode> = {
  forest: <TreePine size={16} color="#235c3a" />,
  grassland: <Wind size={16} color="#9c6c16" />,
  wetland: <Waves size={16} color="#1d618a" />,
};

export const LayEggsModal: React.FC<LayEggsModalProps> = ({
  player,
  gameState,
  initialBird,
  onConfirmLayEggs,
  onClose,
}) => {
  const allowance = getHabitatActionAllowance(player, "grassland");

  // Opciones de canje de alimento (+1 huevo)
  const canTradeFood =
    allowance.canTradeFood &&
    Object.values(player.resources).some((count) => (count ?? 0) > 0);

  const [tradeResource, setTradeResource] = useState<ResourceFace | null>(null);

  // Huevos máximos que puede poner en esta acción
  const totalAllowed = allowance.baseAmount + (tradeResource ? 1 : 0);

  // Recopilar todas las aves jugadas en el tablero
  const birds: BirdSlotInfo[] = [];
  (["forest", "grassland", "wetland"] as HabitatId[]).forEach((hab) => {
    player.board[hab].forEach((slot, sIdx) => {
      if (slot.cardId) {
        const card = gameState.cards[slot.cardId];
        if (card) {
          birds.push({
            habitat: hab,
            slotIndex: sIdx,
            card,
            currentEggs: slot.eggs,
            eggCapacity: card.eggCapacity,
            availableSpace: card.eggCapacity - slot.eggs,
          });
        }
      }
    });
  });

  // Asignaciones de huevos: key = `${habitat}:${slotIndex}` -> cantidad de huevos a agregar
  const [allocations, setAllocations] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    if (initialBird) {
      const key = `${initialBird.habitat}:${initialBird.slotIndex}`;
      const target = birds.find(
        (b) => b.habitat === initialBird.habitat && b.slotIndex === initialBird.slotIndex,
      );
      if (target && target.availableSpace > 0) {
        init[key] = 1;
      }
    }
    return init;
  });

  const totalAssigned = Object.values(allocations).reduce((sum, n) => sum + n, 0);
  const remainingEggs = totalAllowed - totalAssigned;

  const handleAddEgg = (key: string, maxSpace: number) => {
    const current = allocations[key] ?? 0;
    if (remainingEggs <= 0 || current >= maxSpace) return;
    setAllocations({ ...allocations, [key]: current + 1 });
  };

  const handleRemoveEgg = (key: string) => {
    const current = allocations[key] ?? 0;
    if (current <= 0) return;
    if (current === 1) {
      const next = { ...allocations };
      delete next[key];
      setAllocations(next);
    } else {
      setAllocations({ ...allocations, [key]: current - 1 });
    }
  };

  const handleConfirm = () => {
    if (totalAssigned <= 0) return;

    // Convertir allocations a array plano de SlotRef
    const eggPlacements: { habitat: HabitatId; slotIndex: number }[] = [];
    for (const [key, count] of Object.entries(allocations)) {
      const [habitat, slotIndexText] = key.split(":");
      const hab = habitat as HabitatId;
      const sIdx = Number(slotIndexText);
      for (let i = 0; i < count; i += 1) {
        eggPlacements.push({ habitat: hab, slotIndex: sIdx });
      }
    }

    onConfirmLayEggs({
      type: "layEggs",
      eggPlacements,
      ...(tradeResource ? { tradeResource } : {}),
    });
  };

  // Huevos que caben en total en todas las aves
  const totalBoardSpace = birds.reduce((sum, b) => sum + b.availableSpace, 0);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff",
          borderRadius: 20,
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #e0ebe0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(to right, #f7faf7, #ffffff)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#fef3d6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem",
              }}
            >
              🥚
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#235c3a" }}>
                Poner Huevos (Acción de Pradera)
              </h2>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#667" }}>
                Distribuí los huevos entre cualquiera de tus aves que tenga espacio disponible.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "#778",
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Panel informativo de cuota y canje */}
        <div
          style={{
            padding: "14px 24px",
            background: "#f4f8f4",
            borderBottom: "1px solid #e2ede2",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#334" }}>
                Huevos disponibles en este turno:
              </span>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {Array.from({ length: totalAllowed }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: "1.2rem",
                      opacity: i < totalAssigned ? 1 : 0.35,
                      filter: i < totalAssigned ? "drop-shadow(0 2px 2px rgba(0,0,0,0.15))" : "grayscale(100%)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    🥚
                  </span>
                ))}
              </div>
            </div>

            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: remainingEggs === 0 ? "#235c3a" : "#b06d00",
                background: remainingEggs === 0 ? "#e5f4e7" : "#fff8e6",
                padding: "4px 10px",
                borderRadius: 8,
                border: `1px solid ${remainingEggs === 0 ? "#c4e5c8" : "#fae6b8"}`,
              }}
            >
              {remainingEggs === 0
                ? "✓ Todos los huevos asignados"
                : `${remainingEggs} por asignar`}
            </div>
          </div>

          {/* Opción de canje: descartar 1 alimento por +1 huevo */}
          {canTradeFood && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: "0.82rem",
                background: "#ffffff",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #dce8db",
              }}
            >
              <span style={{ color: "#445", fontWeight: 600 }}>
                Opcional (+1 🥚 extra): Descartar 1 alimento
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                {(["seed", "fruit", "insect", "fish", "rodent"] as ResourceFace[]).map((res) => {
                  const count = player.resources[res] ?? 0;
                  if (count <= 0) return null;
                  const isSelected = tradeResource === res;
                  return (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setTradeResource(isSelected ? null : res)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        border: isSelected ? "2px solid #235c3a" : "1px solid #ccd8ca",
                        background: isSelected ? "#e5f4e7" : "#fbfdfb",
                        cursor: "pointer",
                        fontSize: "0.78rem",
                        fontWeight: isSelected ? 700 : 500,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      title={`Descartar 1 ${resourceLabels[res]}`}
                    >
                      {resourceIcons[res]} {resourceLabels[res]} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Lista de Aves con control de huevos */}
        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          {birds.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "#889" }}>
              <p style={{ margin: 0, fontSize: "0.95rem" }}>
                No tienes aves jugadas en tu tablero para poner huevos.
              </p>
              <p style={{ margin: "6px 0 0 0", fontSize: "0.8rem" }}>
                Primero debes jugar aves en cualquiera de tus hábitats.
              </p>
            </div>
          ) : totalBoardSpace === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "#9c6c16", background: "#fff9ea", borderRadius: 10 }}>
              Todas tus aves ya han alcanzado su capacidad máxima de huevos.
            </div>
          ) : (
            birds.map((b) => {
              const key = `${b.habitat}:${b.slotIndex}`;
              const assigned = allocations[key] ?? 0;
              const isFull = b.currentEggs + assigned >= b.eggCapacity;
              const canAdd = remainingEggs > 0 && !isFull;
              const canRemove = assigned > 0;

              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: assigned > 0 ? "2px solid #235c3a" : "1px solid #e0ebe0",
                    background: assigned > 0 ? "#f6fbf6" : "#ffffff",
                    transition: "all 0.15s ease",
                  }}
                >
                  {/* Info del ave */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "#f0f4ef",
                      }}
                      title={habitatLabels[b.habitat]}
                    >
                      {habitatIcons[b.habitat]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#223" }}>
                        {b.card.name}
                      </div>
                      <div style={{ display: "flex", gap: 8, fontSize: "0.75rem", color: "#667", marginTop: 2 }}>
                        <span>
                          {habitatLabels[b.habitat]} (Columna {b.slotIndex + 1})
                        </span>
                        <span>•</span>
                        <span>
                          {nestIcons[b.card.nestType ?? "wild"]} {nestLabels[b.card.nestType ?? "wild"]}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Estado de huevos y controles */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Visualización de huevos */}
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334" }}>
                        {b.currentEggs + assigned} / {b.eggCapacity} 🥚
                        {assigned > 0 && (
                          <span style={{ color: "#235c3a", marginLeft: 4 }}>
                            (+{assigned})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: isFull ? "#b06d00" : "#778" }}>
                        {isFull ? "Capacidad completa" : `${b.availableSpace - assigned} espacio(s) libre(s)`}
                      </div>
                    </div>

                    {/* Botones +/- */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveEgg(key)}
                        disabled={!canRemove}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: "1px solid #ccd8ca",
                          background: canRemove ? "#ffffff" : "#f5f7f4",
                          color: canRemove ? "#334" : "#aab",
                          cursor: canRemove ? "pointer" : "not-allowed",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                        }}
                        title="Quitar 1 huevo asignado"
                      >
                        <Minus size={16} />
                      </button>

                      <span
                        style={{
                          width: 24,
                          textAlign: "center",
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          color: assigned > 0 ? "#235c3a" : "#889",
                        }}
                      >
                        {assigned}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleAddEgg(key, b.availableSpace)}
                        disabled={!canAdd}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: canAdd ? "1px solid #235c3a" : "1px solid #ccd8ca",
                          background: canAdd ? "#235c3a" : "#f5f7f4",
                          color: canAdd ? "#ffffff" : "#aab",
                          cursor: canAdd ? "pointer" : "not-allowed",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                        }}
                        title={
                          !canAdd
                            ? isFull
                              ? "Ave llena"
                              : "No quedan huevos disponibles"
                            : "Poner 1 huevo en esta ave"
                        }
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pie de modal con acciones */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e2ede2",
            background: "#fbfdfb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "1px solid #ccd8ca",
              background: "#ffffff",
              color: "#556",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={totalAssigned === 0}
            style={{
              padding: "10px 22px",
              borderRadius: 8,
              border: "none",
              background: totalAssigned > 0 ? "#235c3a" : "#ccd8ca",
              color: "#ffffff",
              cursor: totalAssigned > 0 ? "pointer" : "not-allowed",
              fontWeight: 700,
              fontSize: "0.95rem",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: totalAssigned > 0 ? "0 4px 10px rgba(35,92,58,0.3)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <Check size={18} />
            Confirmar y poner {totalAssigned} huevo{totalAssigned !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
};
