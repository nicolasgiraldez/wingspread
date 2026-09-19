import React, { useState } from "react";
import { Check, Minus, Plus, TreePine, Waves, Wind, X } from "lucide-react";
import { getActivatablePowers, getHabitatActionAllowance } from "../../game";
import type {
  CardId,
  GameState,
  HabitatId,
  Move,
  PlayerState,
  PowerEggChoices,
  PowerMoveChoices,
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
import {
  buildEggSourceOptions,
  buildEggTargetOptions,
  buildRepeatPowerOptions,
  decodeSlotKey,
} from "./powerOptions";
import { PowerChecklist, PowerChecklistEntry } from "./PowerChecklist";

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
  forest: <TreePine size={16} color="#3fae72" />,
  grassland: <Wind size={16} color="#d9a83b" />,
  wetland: <Waves size={16} color="#4fa8e0" />,
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

  // Poderes "Al activar" (marrones) de la pradera: todos opcionales, tildados por defecto.
  const activatablePowers = getActivatablePowers(gameState, player, "grassland");
  const [skippedPowerIds, setSkippedPowerIds] = useState<Set<string>>(new Set());
  const [powerCardChoices, setPowerCardChoices] = useState<Record<string, CardId>>({});
  const [powerEggChoiceKeys, setPowerEggChoiceKeys] = useState<Record<string, string>>({});
  const [powerMoveChoices, setPowerMoveChoices] = useState<PowerMoveChoices>({});

  const togglePower = (powerId: string) => {
    setSkippedPowerIds((prev) => {
      const next = new Set(prev);
      if (next.has(powerId)) next.delete(powerId);
      else next.add(powerId);
      return next;
    });
  };

  const handOptions = player.hand.map((id) => ({ id, name: gameState.cards[id]?.name ?? id }));

  const powerChecklistEntries: PowerChecklistEntry[] = activatablePowers.map(({ source, card, power }) => {
    let cardChoice: PowerChecklistEntry["cardChoice"];
    if (
      (power.kind === "tuckCard" && power.source === "hand") ||
      (power.kind === "drawCard" && power.thenDiscard)
    ) {
      cardChoice = {
        label:
          power.kind === "tuckCard"
            ? "¿Qué carta de tu mano solapás? (opcional)"
            : "¿Qué carta preferís descartar? (opcional; si no elegís, se descarta la recién robada)",
        options: handOptions,
        selected: powerCardChoices[power.id] ?? null,
        onSelect: (id) =>
          setPowerCardChoices((prev) => {
            const next = { ...prev };
            if (id) next[power.id] = id;
            else delete next[power.id];
            return next;
          }),
        defaultOptionLabel:
          power.kind === "tuckCard" ? "Automático (la última de tu mano)" : "Automático (la carta recién robada)",
      };
    }

    let slotChoice: PowerChecklistEntry["slotChoice"];
    if (power.kind === "layEgg" && power.target === "any") {
      slotChoice = {
        label: "¿En qué ave ponés el/los huevo(s)? (opcional)",
        options: buildEggTargetOptions(gameState, player),
        selected: powerEggChoiceKeys[power.id] ?? null,
        onSelect: (key) =>
          setPowerEggChoiceKeys((prev) => {
            const next = { ...prev };
            if (key) next[power.id] = key;
            else delete next[power.id];
            return next;
          }),
        defaultOptionLabel: "Automático (la primera ave con espacio)",
      };
    } else if ((power.kind === "gainResource" || power.kind === "drawCard") && power.costsEgg) {
      slotChoice = {
        label: "¿De qué ave descartás el huevo? (opcional)",
        options: buildEggSourceOptions(gameState, player, power.costEggExcludesSelf ? source : undefined),
        selected: powerEggChoiceKeys[power.id] ?? null,
        onSelect: (key) =>
          setPowerEggChoiceKeys((prev) => {
            const next = { ...prev };
            if (key) next[power.id] = key;
            else delete next[power.id];
            return next;
          }),
        defaultOptionLabel: "Automático (la primera ave con huevos)",
      };
    } else if (power.kind === "repeatPower") {
      slotChoice = {
        label: "¿Qué poder repetís? (opcional)",
        options: buildRepeatPowerOptions(gameState, player, "grassland", source, power.predatorOnly),
        selected: powerEggChoiceKeys[power.id] ?? null,
        onSelect: (key) =>
          setPowerEggChoiceKeys((prev) => {
            const next = { ...prev };
            if (key) next[power.id] = key;
            else delete next[power.id];
            return next;
          }),
        defaultOptionLabel: "Automático (el primero disponible)",
      };
    }

    let habitatChoice: PowerChecklistEntry["habitatChoice"];
    if (power.kind === "moveToHabitat") {
      const otherHabitats = card.habitats.filter((h) => h !== source.habitat);
      habitatChoice = {
        label: "¿A qué hábitat la movés?",
        options: otherHabitats.map((h) => ({ id: h, name: habitatLabels[h] })),
        selected: powerMoveChoices[power.id] ?? null,
        onSelect: (h) => setPowerMoveChoices((prev) => ({ ...prev, [power.id]: h })),
      };
    }

    return {
      power,
      birdName: card.name,
      checked: !skippedPowerIds.has(power.id),
      onToggle: () => togglePower(power.id),
      cardChoice,
      slotChoice,
      habitatChoice,
    };
  });

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

    const activePowerCardChoices: Record<string, CardId> = {};
    const activePowerEggChoices: PowerEggChoices = {};
    const activePowerMoveChoices: PowerMoveChoices = {};
    for (const entry of powerChecklistEntries) {
      if (!entry.checked) continue;
      if (entry.cardChoice?.selected) {
        activePowerCardChoices[entry.power.id] = entry.cardChoice.selected;
      }
      if (entry.slotChoice?.selected) {
        activePowerEggChoices[entry.power.id] = decodeSlotKey(entry.slotChoice.selected);
      }
      if (entry.habitatChoice?.selected) {
        activePowerMoveChoices[entry.power.id] = entry.habitatChoice.selected;
      }
    }

    onConfirmLayEggs({
      type: "layEggs",
      eggPlacements,
      ...(tradeResource ? { tradeResource } : {}),
      ...(skippedPowerIds.size > 0 ? { skipPowerIds: Array.from(skippedPowerIds) } : {}),
      ...(Object.keys(activePowerCardChoices).length > 0 ? { powerCardChoices: activePowerCardChoices } : {}),
      ...(Object.keys(activePowerEggChoices).length > 0 ? { powerEggChoices: activePowerEggChoices } : {}),
      ...(Object.keys(activePowerMoveChoices).length > 0 ? { powerMoveChoices: activePowerMoveChoices } : {}),
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
        background: "rgba(0, 0, 0, 0.7)",
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
          background: "#182019",
          border: "1px solid #2b332e",
          borderRadius: 20,
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #2b332e",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(to right, #1c241d, #182019)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(217, 168, 59, 0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem",
              }}
            >
              🥚
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#3fae72" }}>
                Poner Huevos (Acción de Pradera)
              </h2>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#93a397" }}>
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
              color: "#93a397",
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Panel informativo de cuota y canje */}
        <div
          style={{
            padding: "14px 24px",
            background: "#1c241d",
            borderBottom: "1px solid #2b332e",
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
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#eef1ec" }}>
                Huevos disponibles en este turno:
              </span>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {Array.from({ length: totalAllowed }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: "1.2rem",
                      opacity: i < totalAssigned ? 1 : 0.35,
                      filter: i < totalAssigned ? "drop-shadow(0 2px 2px rgba(0,0,0,0.4))" : "grayscale(100%)",
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
                color: remainingEggs === 0 ? "#3fae72" : "#d9a83b",
                background: remainingEggs === 0 ? "rgba(63, 174, 114, 0.15)" : "rgba(217, 168, 59, 0.15)",
                padding: "4px 10px",
                borderRadius: 8,
                border: `1px solid ${remainingEggs === 0 ? "rgba(63, 174, 114, 0.4)" : "rgba(217, 168, 59, 0.4)"}`,
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
                background: "#182019",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #2b332e",
              }}
            >
              <span style={{ color: "#c3ccc5", fontWeight: 600 }}>
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
                        border: isSelected ? "2px solid #3fae72" : "1px solid #394239",
                        background: isSelected ? "rgba(63, 174, 114, 0.15)" : "#212b22",
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
            <div style={{ textAlign: "center", padding: 32, color: "#75897b" }}>
              <p style={{ margin: 0, fontSize: "0.95rem" }}>
                No tienes aves jugadas en tu tablero para poner huevos.
              </p>
              <p style={{ margin: "6px 0 0 0", fontSize: "0.8rem" }}>
                Primero debes jugar aves en cualquiera de tus hábitats.
              </p>
            </div>
          ) : totalBoardSpace === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "#d9a83b", background: "rgba(217, 168, 59, 0.12)", borderRadius: 10 }}>
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
                    border: assigned > 0 ? "2px solid #3fae72" : "1px solid #2b332e",
                    background: assigned > 0 ? "rgba(63, 174, 114, 0.08)" : "#182019",
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
                        background: "#1c241d",
                      }}
                      title={habitatLabels[b.habitat]}
                    >
                      {habitatIcons[b.habitat]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#eef1ec" }}>
                        {b.card.name}
                      </div>
                      <div style={{ display: "flex", gap: 8, fontSize: "0.75rem", color: "#93a397", marginTop: 2 }}>
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
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#eef1ec" }}>
                        {b.currentEggs + assigned} / {b.eggCapacity} 🥚
                        {assigned > 0 && (
                          <span style={{ color: "#3fae72", marginLeft: 4 }}>
                            (+{assigned})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: isFull ? "#d9a83b" : "#93a397" }}>
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
                          border: "1px solid #394239",
                          background: canRemove ? "#212b22" : "#181f1a",
                          color: canRemove ? "#eef1ec" : "#5c6b60",
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
                          color: assigned > 0 ? "#3fae72" : "#75897b",
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
                          border: canAdd ? "1px solid #3fae72" : "1px solid #394239",
                          background: canAdd ? "#1f7a4f" : "#181f1a",
                          color: canAdd ? "#ffffff" : "#5c6b60",
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

        {/* Poderes opcionales al activar la pradera */}
        {powerChecklistEntries.length > 0 && (
          <div style={{ padding: "0 24px 16px 24px" }}>
            <PowerChecklist title="Poderes que se activarían" entries={powerChecklistEntries} />
          </div>
        )}

        {/* Pie de modal con acciones */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #2b332e",
            background: "#141a15",
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
              border: "1px solid #394239",
              background: "#212b22",
              color: "#c3ccc5",
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
              background: totalAssigned > 0 ? "#1f7a4f" : "#394239",
              color: "#ffffff",
              cursor: totalAssigned > 0 ? "pointer" : "not-allowed",
              fontWeight: 700,
              fontSize: "0.95rem",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: totalAssigned > 0 ? "0 4px 10px rgba(31,122,79,0.35)" : "none",
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
