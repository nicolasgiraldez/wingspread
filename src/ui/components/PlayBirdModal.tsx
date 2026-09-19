import React, { useState } from "react";
import { Bird, X } from "lucide-react";
import { canPayResources, getOnPlayPowers, isLegalMove } from "../../game";
import type {
  CardId,
  GameState,
  HabitatId,
  Move,
  PlayerState,
  PowerEggChoices,
  PowerPlayBirdChoices,
  ResourceFace,
  SlotRef,
  SpeciesCard,
} from "../../game";
import {
  describePower,
  habitatLabels,
  resourceIcons,
  resourceLabels,
} from "../labels";
import { BirdCard } from "./BirdCard";
import { buildEggTargetOptions, decodeSlotKey } from "./powerOptions";
import { PowerChecklist, PowerChecklistEntry } from "./PowerChecklist";

function eggCostForColumn(slotIndex: number): number {
  return slotIndex === 0 ? 0 : slotIndex <= 2 ? 1 : 2;
}

/** Elige automáticamente qué recursos del jugador usar para pagar un costo dado. */
function autoSelectPayment(
  cost: Partial<Record<ResourceFace, number>>,
  costAnyOf: ResourceFace[] | undefined,
  resources: Partial<Record<ResourceFace, number>>,
): ResourceFace[] {
  const paid: ResourceFace[] = [];
  const available = { ...resources };

  for (const [res, count] of Object.entries(cost)) {
    if (res === "wild") continue;
    const r = res as ResourceFace;
    for (let i = 0; i < (count ?? 0); i += 1) {
      if ((available[r] ?? 0) > 0) {
        paid.push(r);
        available[r] = (available[r] ?? 1) - 1;
      }
    }
  }

  if (costAnyOf && costAnyOf.length > 0) {
    const r = costAnyOf.find((res) => (available[res] ?? 0) > 0);
    if (r) {
      paid.push(r);
      available[r] = (available[r] ?? 1) - 1;
    }
  }

  if (cost.wild) {
    for (let i = 0; i < cost.wild; i += 1) {
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
}

/**
 * Elige automáticamente de qué aves descontar los huevos necesarios. `reserved` permite excluir
 * huevos ya comprometidos por otro pago en el mismo movimiento (ej. la primera ave jugada).
 */
function autoSelectEggPayment(
  player: PlayerState,
  eggCost: number,
  reserved: Record<string, number> = {},
): SlotRef[] {
  const list: SlotRef[] = [];
  if (eggCost <= 0) return list;
  for (const hab of ["forest", "grassland", "wetland"] as HabitatId[]) {
    for (let s = 0; s < player.board[hab].length; s += 1) {
      const key = `${hab}:${s}`;
      let availableEggs = player.board[hab][s].eggs - (reserved[key] ?? 0);
      while (availableEggs > 0 && list.length < eggCost) {
        list.push({ habitat: hab, slotIndex: s });
        availableEggs -= 1;
      }
    }
  }
  return list;
}

function tallySlotRefs(refs: SlotRef[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const ref of refs) {
    const key = `${ref.habitat}:${ref.slotIndex}`;
    tally[key] = (tally[key] ?? 0) + 1;
  }
  return tally;
}

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
  const [selectedPaidResources, setSelectedPaidResources] = useState<ResourceFace[]>(() =>
    autoSelectPayment(card.cost, card.costAnyOf, player.resources),
  );

  // Egg payments from board
  const [paidEggsFrom] = useState<SlotRef[]>(() =>
    autoSelectEggPayment(player, eggCost),
  );

  // Poderes "Al jugar" (blancos): todos son opcionales, tildados por defecto. "playSecondBird"
  // tiene su propia sección (paso 5) porque necesita elegir carta + hábitat + pago, no solo
  // un checkbox.
  const allOnPlayPowers = getOnPlayPowers(card);
  const secondBirdPower = allOnPlayPowers.find((p) => p.kind === "playSecondBird");
  const onPlayPowers = allOnPlayPowers.filter((p) => p.kind !== "playSecondBird");
  const [skippedPowerIds, setSkippedPowerIds] = useState<Set<string>>(new Set());
  const [powerCardChoices, setPowerCardChoices] = useState<Record<string, CardId>>({});
  const [powerEggChoiceKeys, setPowerEggChoiceKeys] = useState<Record<string, string>>({});

  const togglePower = (powerId: string) => {
    setSkippedPowerIds((prev) => {
      const next = new Set(prev);
      if (next.has(powerId)) next.delete(powerId);
      else next.add(powerId);
      return next;
    });
  };

  // La carta que se está jugando ya no estará en la mano una vez resuelta la acción.
  const handAfterPlay = player.hand
    .filter((id) => id !== card.id)
    .map((id) => ({ id, name: gameState.cards[id]?.name ?? id }));

  // ── Poder "playSecondBird": elegir carta + hábitat + pago de una segunda ave ──
  const [secondBirdCardId, setSecondBirdCardId] = useState<CardId | null>(null);
  const [secondBirdHabitat, setSecondBirdHabitatState] = useState<HabitatId | null>(null);

  const secondBirdCandidates = secondBirdPower
    ? handAfterPlay.filter((h) => {
        const c = gameState.cards[h.id];
        return c && c.habitats.some((hab) => secondBirdPower.habitats.includes(hab));
      })
    : [];
  const secondBirdCard = secondBirdCardId ? gameState.cards[secondBirdCardId] : null;
  const secondBirdAllowedHabitats =
    secondBirdCard && secondBirdPower
      ? secondBirdPower.habitats.filter((h) => secondBirdCard.habitats.includes(h))
      : [];
  const effectiveSecondBirdHabitat =
    secondBirdHabitat && secondBirdAllowedHabitats.includes(secondBirdHabitat)
      ? secondBirdHabitat
      : (secondBirdAllowedHabitats[0] ?? null);

  const setSecondBirdCard = (id: CardId | null) => {
    setSecondBirdCardId(id);
    setSecondBirdHabitatState(null); // vuelve a elegir el hábitat por defecto para la nueva carta
  };

  // Simula que la primera ave ya ocupó su columna, si ambas van al mismo hábitat.
  const secondBirdSlotIndex = (() => {
    if (!secondBirdCard || !effectiveSecondBirdHabitat) return -1;
    const raw = player.board[effectiveSecondBirdHabitat];
    for (let i = 0; i < raw.length; i += 1) {
      const occupiedByFirst = effectiveSecondBirdHabitat === selectedHabitat && i === slotIndex;
      if (!raw[i].cardId && !occupiedByFirst) return i;
    }
    return -1;
  })();
  const secondBirdEggCost = secondBirdSlotIndex === -1 ? 0 : eggCostForColumn(secondBirdSlotIndex);
  const secondBirdPaidResources = secondBirdCard
    ? autoSelectPayment(secondBirdCard.cost, secondBirdCard.costAnyOf, player.resources)
    : [];
  // No reutilizar recursos ya comprometidos por el pago de la primera ave.
  const secondBirdPaymentOverlapsFirst = secondBirdPaidResources.some((res, idx) => {
    const usedByFirst = selectedPaidResources.filter((r) => r === res).length;
    const usedBySecondSoFar = secondBirdPaidResources.slice(0, idx + 1).filter((r) => r === res).length;
    return usedByFirst + usedBySecondSoFar > (player.resources[res] ?? 0);
  });
  const secondBirdPaidEggsFrom = secondBirdCard
    ? autoSelectEggPayment(player, secondBirdEggCost, tallySlotRefs(paidEggsFrom))
    : [];
  const secondBirdEggPaymentValid = secondBirdPaidEggsFrom.length === secondBirdEggCost;
  const secondBirdPaymentValid =
    !!secondBirdCard &&
    secondBirdSlotIndex !== -1 &&
    !secondBirdPaymentOverlapsFirst &&
    secondBirdEggPaymentValid &&
    canPayResources(player, secondBirdPaidResources, secondBirdCard.cost, secondBirdCard.costAnyOf);

  const powerPlayBirdChoices: PowerPlayBirdChoices | undefined =
    secondBirdPower && secondBirdCard && effectiveSecondBirdHabitat && secondBirdPaymentValid
      ? {
          [secondBirdPower.id]: {
            cardId: secondBirdCard.id,
            habitat: effectiveSecondBirdHabitat,
            paidResources: secondBirdPaidResources,
            paidEggsFrom: secondBirdPaidEggsFrom,
          },
        }
      : undefined;

  const powerChecklistEntries: PowerChecklistEntry[] = onPlayPowers.map((power) => {
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
        options: handAfterPlay,
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
    }

    return {
      power,
      birdName: card.name,
      checked: !skippedPowerIds.has(power.id),
      onToggle: () => togglePower(power.id),
      cardChoice,
      slotChoice,
    };
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

  const isPaymentValid = canPayResources(player, selectedPaidResources, card.cost, card.costAnyOf);
  const isEggCostValid = paidEggsFrom.length === eggCost;
  const isSlotAvailable = firstEmptySlot !== -1;

  const activePowerCardChoices: Record<string, CardId> = {};
  const activePowerEggChoices: PowerEggChoices = {};
  for (const entry of powerChecklistEntries) {
    if (!entry.checked) continue;
    if (entry.cardChoice?.selected) {
      activePowerCardChoices[entry.power.id] = entry.cardChoice.selected;
    }
    if (entry.slotChoice?.selected) {
      activePowerEggChoices[entry.power.id] = decodeSlotKey(entry.slotChoice.selected);
    }
  }

  const move: Extract<Move, { type: "playBird" }> = {
    type: "playBird",
    cardId: card.id,
    habitat: selectedHabitat,
    slotIndex,
    paidResources: selectedPaidResources,
    paidEggsFrom,
    ...(skippedPowerIds.size > 0 ? { skipPowerIds: Array.from(skippedPowerIds) } : {}),
    ...(Object.keys(activePowerCardChoices).length > 0 ? { powerCardChoices: activePowerCardChoices } : {}),
    ...(powerPlayBirdChoices ? { powerPlayBirdChoices } : {}),
    ...(Object.keys(activePowerEggChoices).length > 0 ? { powerEggChoices: activePowerEggChoices } : {}),
  };

  const isMoveValid = isSlotAvailable && isEggCostValid && isPaymentValid && isLegalMove(gameState, player.id, move);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Jugar Ave: {card.name}</h2>
          <button
            onClick={onClose}
            style={{ background: "transparent", color: "#93a397", padding: 4 }}
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
                      backgroundColor: selectedHabitat === hab ? "#1f7a4f" : "rgba(63, 174, 114, 0.12)",
                      color: selectedHabitat === hab ? "#ffffff" : "#3fae72",
                      border: "1px solid rgba(63, 174, 114, 0.35)",
                      justifyContent: "center",
                    }}
                  >
                    {habitatLabels[hab]}
                  </button>
                ))}
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#93a397" }}>
                Se colocará en la Columna {slotIndex + 1} de {habitatLabels[selectedHabitat]} (Coste: {eggCost} 🥚).
              </p>
            </div>

            {/* Step 2: Resource Payment & 2:1 */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.9rem" }}>2. Pago de Alimentos</strong>
                <span style={{ fontSize: "0.75rem", color: isPaymentValid ? "#3fae72" : "#f0645f", fontWeight: 700 }}>
                  {isPaymentValid ? "✓ Pago Válido" : "✗ Faltan Alimentos / Inválido"}
                </span>
              </div>
              <p style={{ margin: "2px 0 6px 0", fontSize: "0.75rem", color: "#93a397" }}>
                Haz clic en tus recursos para seleccionarlos. Puedes usar 2 recursos cualesquiera por cada 1 requerido.
                {card.costAnyOf && card.costAnyOf.length > 0 && (
                  <>
                    {" "}Esta ave acepta 1{" "}
                    {card.costAnyOf.map((res) => resourceIcons[res]).join(" o ")} indistintamente.
                  </>
                )}
              </p>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(player.resources).map(([res, total]) => {
                  const r = res as ResourceFace;
                  const selectedCount = selectedPaidResources.filter((item) => item === r).length;

                  return (
                    <button
                      key={r}
                      onClick={() => toggleResourceForPayment(r)}
                      disabled={(total ?? 0) === 0 && selectedCount === 0}
                      style={{
                        backgroundColor: selectedCount > 0 ? "#1f7a4f" : "#212b22",
                        color: selectedCount > 0 ? "#ffffff" : "#eef1ec",
                        border: "1.5px solid #394239",
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
                <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: isEggCostValid ? "#3fae72" : "#f0645f" }}>
                  {isEggCostValid
                    ? `✓ Se descontarán ${eggCost} huevo(s) de tu tablero.`
                    : `✗ Necesitas al menos ${eggCost} huevo(s) en tu tablero para jugar en esta columna.`}
                </p>
              </div>
            )}

            {/* Step 4: Optional "when played" powers */}
            {powerChecklistEntries.length > 0 && (
              <PowerChecklist title="4. Poderes al jugar (opcionales)" entries={powerChecklistEntries} />
            )}

            {/* Step 5: Optional "playSecondBird" power */}
            {secondBirdPower && (
              <div>
                <strong style={{ fontSize: "0.9rem" }}>5. Jugar una segunda ave (opcional)</strong>
                <p className="power-checklist-hint">
                  {describePower(secondBirdPower)}. Si no elegís ninguna carta, este poder no se activa.
                </p>

                {secondBirdCandidates.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#75897b" }}>
                    No tenés otra ave en mano jugable en {secondBirdPower.habitats.map((h) => habitatLabels[h]).join(" o ")}.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <select
                      value={secondBirdCardId ?? ""}
                      onChange={(e) => setSecondBirdCard(e.target.value || null)}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #394239", fontSize: "0.85rem" }}
                    >
                      <option value="">No jugar segunda ave</option>
                      {secondBirdCandidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    {secondBirdCard && (
                      <>
                        {secondBirdAllowedHabitats.length > 1 && (
                          <div style={{ display: "flex", gap: 6 }}>
                            {secondBirdAllowedHabitats.map((hab) => (
                              <button
                                key={hab}
                                type="button"
                                onClick={() => setSecondBirdHabitatState(hab)}
                                style={{
                                  flex: 1,
                                  backgroundColor: effectiveSecondBirdHabitat === hab ? "#1f7a4f" : "rgba(63, 174, 114, 0.12)",
                                  color: effectiveSecondBirdHabitat === hab ? "#ffffff" : "#3fae72",
                                  border: "1px solid rgba(63, 174, 114, 0.35)",
                                  justifyContent: "center",
                                  fontSize: "0.8rem",
                                }}
                              >
                                {habitatLabels[hab]}
                              </button>
                            ))}
                          </div>
                        )}
                        <span style={{ fontSize: "0.78rem", color: secondBirdPaymentValid ? "#3fae72" : "#f0645f" }}>
                          {secondBirdPaymentValid
                            ? `✓ Se jugará en ${effectiveSecondBirdHabitat ? habitatLabels[effectiveSecondBirdHabitat] : ""} pagando su costo normal${secondBirdEggCost > 0 ? ` + ${secondBirdEggCost} 🥚` : ""}.`
                            : "✗ No se puede pagar esta segunda ave con lo que queda disponible tras la primera."}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #2b332e", paddingTop: 14 }}>
          <button onClick={onClose} style={{ backgroundColor: "#212b22", color: "#c3ccc5" }}>
            Cancelar
          </button>
          <button
            onClick={() => onConfirmPlay(move)}
            disabled={!isMoveValid}
            style={{ backgroundColor: "#1f7a4f" }}
          >
            <Bird size={16} /> Confirmar y Jugar Ave
          </button>
        </div>
      </div>
    </div>
  );
};
