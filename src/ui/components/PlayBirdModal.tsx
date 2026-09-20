import React, { useState } from "react";
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
  habitatIcons,
  habitatLabels,
  resourceIcons,
  resourceLabels,
} from "../labels";
import { BirdCard } from "./BirdCard";
import { capitalize, countOf, pressVerb } from "../text";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Modal } from "./ui/Modal";
import { RichText } from "./ui/RichText";
import { StatusLine } from "./ui/StatusLine";
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

  // Los pasos 3 a 5 solo aparecen si aplican; se numeran según los que se muestran.
  const showEggStep = eggCost > 0;
  const eggStepNumber = 3;
  const powersStepNumber = eggStepNumber + (showEggStep ? 1 : 0);
  const secondBirdStepNumber = powersStepNumber + (onPlayPowers.length > 0 ? 1 : 0);

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

  const invalidReason = !isSlotAvailable
    ? "No hay una columna libre en este hábitat."
    : !isPaymentValid
      ? "Falta pagar el coste en alimentos."
      : !isEggCostValid
        ? "Faltan huevos para pagar esta columna."
        : !isMoveValid
          ? "Revisá las elecciones de los poderes: la jugada no es válida."
          : undefined;

  const habitatPills = (habitats: HabitatId[], current: HabitatId | null | undefined, onPick: (hab: HabitatId) => void) => (
    <div className="pill-row">
      {habitats.map((hab) => (
        <button
          key={hab}
          type="button"
          className={`pill${current === hab ? " pill--on" : ""}`}
          aria-pressed={current === hab}
          onClick={() => onPick(hab)}
        >
          <span className="pill__icon">
            <Icon name={habitatIcons[hab]} size={20} />
          </span>
          {habitatLabels[hab]}
        </button>
      ))}
    </div>
  );

  return (
    <Modal
      title={`Jugar Ave: ${card.name}`}
      width={1000}
      onClose={onClose}
      footer={
        <>
          {invalidReason && (
            <span id="play-bird-reason" className="modal__hint" role="status">
              {invalidReason}
            </span>
          )}
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            icon="bird"
            disabled={!isMoveValid}
            aria-describedby={invalidReason ? "play-bird-reason" : undefined}
            onClick={() => onConfirmPlay(move)}
          >
            Confirmar y Jugar Ave
          </Button>
        </>
      }
    >
      <div className="action-modal">
        <BirdCard card={card} mode="full" />

        <div className="action-modal__steps">
          {/* Paso 1: hábitat */}
          <section className="step" aria-labelledby="play-step-habitat">
            <h3 id="play-step-habitat" className="step__title">
              1. Seleccioná el Hábitat
            </h3>
            {habitatPills(availableHabitats, selectedHabitat, setSelectedHabitat)}
            <p className="step__note">
              Se colocará en la Columna {slotIndex + 1} de {habitatLabels[selectedHabitat]} (Coste: {eggCost}{" "}
              <Icon name="egg" size={16} />).
            </p>
          </section>

          {/* Paso 2: pago de alimentos (2 cualesquiera por 1 requerido) */}
          <section className="step" aria-labelledby="play-step-pay">
            <div className="step__row">
              <h3 id="play-step-pay" className="step__title">
                2. Pago de Alimentos
              </h3>
              <StatusLine ok={isPaymentValid}>{isPaymentValid ? "Pago válido" : "Faltan alimentos"}</StatusLine>
            </div>
            <p className="step__note">
              {pressVerb()} tus recursos para seleccionarlos. Podés usar 2 recursos cualesquiera por cada 1 requerido.
              {card.costAnyOf && card.costAnyOf.length > 0 && (
                <>
                  {" "}
                  Esta ave acepta 1{" "}
                  <RichText text={`${card.costAnyOf.map((res) => `{${resourceIcons[res]}}`).join(" o ")} indistintamente.`} size={18} />
                </>
              )}
            </p>
            <div className="pill-row">
              {Object.entries(player.resources).map(([res, total]) => {
                const r = res as ResourceFace;
                const selectedCount = selectedPaidResources.filter((item) => item === r).length;
                return (
                  <button
                    key={r}
                    type="button"
                    className={`pill${selectedCount > 0 ? " pill--on" : ""}`}
                    aria-pressed={selectedCount > 0}
                    disabled={(total ?? 0) === 0 && selectedCount === 0}
                    onClick={() => toggleResourceForPayment(r)}
                  >
                    <Icon name={resourceIcons[r]} size={24} />
                    {capitalize(resourceLabels[r])}: {selectedCount}/{total ?? 0}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Paso 3: coste en huevos */}
          {showEggStep && (
            <section className="step" aria-labelledby="play-step-eggs">
              <h3 id="play-step-eggs" className="step__title">
                {eggStepNumber}. Coste en Huevos ({eggCost} <Icon name="egg" size={20} />)
              </h3>
              <StatusLine ok={isEggCostValid}>
                {isEggCostValid
                  ? eggCost === 1
                    ? "Se descontará 1 huevo de tu tablero."
                    : `Se descontarán ${eggCost} huevos de tu tablero.`
                  : `Necesitás al menos ${countOf(eggCost, "huevo", "huevos")} en tu tablero para jugar en esta columna.`}
              </StatusLine>
            </section>
          )}

          {/* Paso 4: poderes "Al jugar" opcionales */}
          {powerChecklistEntries.length > 0 && (
            <PowerChecklist title={`${powersStepNumber}. Poderes al jugar (opcionales)`} entries={powerChecklistEntries} />
          )}

          {/* Paso 5: segunda ave (opcional) */}
          {secondBirdPower && (
            <section className="step" aria-labelledby="play-step-second">
              <h3 id="play-step-second" className="step__title">
                {secondBirdStepNumber}. Jugar una segunda ave (opcional)
              </h3>
              <p className="step__note">
                <RichText text={describePower(secondBirdPower)} size={18} />. Si no elegís ninguna carta, este poder no se
                activa.
              </p>

              {secondBirdCandidates.length === 0 ? (
                <p className="step__note">
                  No tenés otra ave en mano jugable en {secondBirdPower.habitats.map((h) => habitatLabels[h]).join(" o ")}.
                </p>
              ) : (
                <div className="step__stack">
                  <label htmlFor="play-second-card" className="sr-only">
                    Segunda ave
                  </label>
                  <select
                    id="play-second-card"
                    className="select"
                    value={secondBirdCardId ?? ""}
                    onChange={(e) => setSecondBirdCard(e.target.value || null)}
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
                      {secondBirdAllowedHabitats.length > 1 &&
                        habitatPills(secondBirdAllowedHabitats, effectiveSecondBirdHabitat, setSecondBirdHabitatState)}
                      <StatusLine ok={secondBirdPaymentValid}>
                        {secondBirdPaymentValid
                          ? `Se jugará en ${effectiveSecondBirdHabitat ? habitatLabels[effectiveSecondBirdHabitat] : ""} pagando su costo normal${secondBirdEggCost > 0 ? ` + ${countOf(secondBirdEggCost, "huevo", "huevos")}` : ""}.`
                          : "No se puede pagar esta segunda ave con lo que queda disponible tras la primera."}
                      </StatusLine>
                    </>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </Modal>
  );
};
