import React, { useState } from "react";
import { getActivatablePowers, getHabitatActionAllowance, tuckGainChoiceKey } from "../../game";
import { capitalize, countOf } from "../text";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Modal } from "./ui/Modal";
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
  habitatIcons,
  habitatLabels,
  nestIcons,
  nestLabels,
  resourceIcons,
  resourceLabels,
} from "../labels";
import {
  anyFoodOptions,
  buildEggSourceOptions,
  buildEggTargetOptions,
  buildRepeatPowerOptions,
  buildTuckGainChoice,
  decodeSlotKey,
  tradeOptions,
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
    } else if (power.kind === "gainResource" && power.resource === "wild") {
      cardChoice = {
        label: "¿Qué alimento tomás? (opcional)",
        options: anyFoodOptions,
        selected: powerCardChoices[power.id] ?? null,
        onSelect: (id) =>
          setPowerCardChoices((prev) => {
            const next = { ...prev };
            if (id) next[power.id] = id;
            else delete next[power.id];
            return next;
          }),
        defaultOptionLabel: "Insecto (por defecto)",
      };
    } else if (power.kind === "tradeResource" && power.costResource === "wild") {
      cardChoice = {
        label: "¿Qué alimento cambiás y por cuál? (opcional)",
        options: tradeOptions(player),
        selected: powerCardChoices[power.id] ?? null,
        onSelect: (id) =>
          setPowerCardChoices((prev) => {
            const next = { ...prev };
            if (id) next[power.id] = id;
            else delete next[power.id];
            return next;
          }),
        defaultOptionLabel: "Automático (cambia el que más tengas)",
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

    const gainChoice = buildTuckGainChoice(power, powerCardChoices, setPowerCardChoices);
    return {
      power,
      birdName: card.name,
      checked: !skippedPowerIds.has(power.id),
      onToggle: () => togglePower(power.id),
      cardChoice,
      gainChoice,
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
      if (entry.gainChoice?.selected) {
        activePowerCardChoices[tuckGainChoiceKey(entry.power.id)] = entry.gainChoice.selected;
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

  const emptyState =
    birds.length === 0 ? (
      <div className="empty-state">
        <p>
          <strong>No tenés aves jugadas en tu tablero para poner huevos.</strong>
        </p>
        <p>Primero tenés que jugar aves en cualquiera de tus hábitats.</p>
      </div>
    ) : totalBoardSpace === 0 ? (
      <div className="empty-state">
        <p>
          <strong>Todas tus aves ya alcanzaron su capacidad máxima de huevos.</strong>
        </p>
      </div>
    ) : null;

  return (
    <Modal
      title="Poner Huevos (Acción de Pradera)"
      subtitle="Distribuí los huevos entre cualquiera de tus aves que tenga espacio disponible."
      icon={<Icon name="egg" size={34} />}
      width={900}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          {!emptyState && (
            <Button
              variant="primary"
              icon="check"
              disabled={totalAssigned === 0}
              disabledText={totalAssigned === 0 ? "Asigná al menos 1 huevo" : undefined}
              onClick={handleConfirm}
            >
              Confirmar y poner {countOf(totalAssigned, "huevo", "huevos")}
            </Button>
          )}
        </>
      }
    >
      {emptyState ?? (
        <>
          {/* Cupo del turno y canje opcional de alimento por un huevo extra */}
          <section className="egg-quota" aria-label="Huevos disponibles">
            <div className="egg-quota__row">
              <span className="egg-quota__title">Huevos disponibles en este turno:</span>
              <span className="egg-quota__eggs" aria-hidden="true">
                {Array.from({ length: totalAllowed }).map((_, i) => (
                  <Icon key={i} name="egg" size={26} empty={i >= totalAssigned} />
                ))}
              </span>
              <span className={`chip egg-quota__left${remainingEggs === 0 ? "" : " chip--on"}`} role="status">
                {remainingEggs === 0 ? "Todos los huevos asignados" : `${remainingEggs} por asignar`}
              </span>
            </div>

            {canTradeFood && (
              <div className="egg-quota__trade">
                <span className="egg-quota__title">
                  Opcional (+1 <Icon name="egg" size={16} /> extra): Descartar 1 alimento
                </span>
                <div className="pill-row">
                  {(["seed", "fruit", "insect", "fish", "rodent"] as ResourceFace[]).map((res) => {
                    const count = player.resources[res] ?? 0;
                    if (count <= 0) return null;
                    const isSelected = tradeResource === res;
                    return (
                      <button
                        key={res}
                        type="button"
                        className={`pill pill--sm${isSelected ? " pill--on" : ""}`}
                        aria-pressed={isSelected}
                        title={`Descartar 1 ${resourceLabels[res]}`}
                        onClick={() => setTradeResource(isSelected ? null : res)}
                      >
                        <Icon name={resourceIcons[res]} size={22} />
                        {capitalize(resourceLabels[res])} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Aves con espacio libre */}
          <ul className="egg-birds">
            {birds.map((b) => {
              const key = `${b.habitat}:${b.slotIndex}`;
              const assigned = allocations[key] ?? 0;
              const isFull = b.currentEggs + assigned >= b.eggCapacity;
              const canAdd = remainingEggs > 0 && !isFull;
              const canRemove = assigned > 0;
              const nest = b.card.nestType ?? "wild";

              return (
                <li key={key} className={`egg-bird${assigned > 0 ? " egg-bird--on" : ""}`}>
                  <span className="egg-bird__habitat" role="img" aria-label={habitatLabels[b.habitat]} title={habitatLabels[b.habitat]}>
                    <Icon name={habitatIcons[b.habitat]} size={24} />
                  </span>
                  <div className="egg-bird__info">
                    <div className="egg-bird__name">{b.card.name}</div>
                    <div className="egg-bird__meta">
                      <span>
                        {habitatLabels[b.habitat]} (Columna {b.slotIndex + 1})
                      </span>
                      <span aria-hidden="true">•</span>
                      <span className="egg-bird__nest">
                        <Icon name={nestIcons[nest]} size={18} /> {nestLabels[nest]}
                      </span>
                    </div>
                  </div>

                  <div className="egg-bird__count">
                    <div className="egg-bird__eggs">
                      {b.currentEggs + assigned} / {b.eggCapacity} <Icon name="egg" size={16} />
                      {assigned > 0 && <span className="egg-bird__plus">(+{assigned})</span>}
                    </div>
                    <div className="egg-bird__space">
                      {isFull ? "Capacidad completa" : countOf(b.availableSpace - assigned, "espacio libre", "espacios libres")}
                    </div>
                  </div>

                  <div className="stepper">
                    <button
                      type="button"
                      className="stepper__btn"
                      aria-label="Quitar 1 huevo asignado"
                      title="Quitar 1 huevo asignado"
                      disabled={!canRemove}
                      onClick={() => handleRemoveEgg(key)}
                    >
                      <Icon name="minus" size={22} />
                    </button>
                    <span className="stepper__value" aria-live="polite">
                      {assigned}
                    </span>
                    <button
                      type="button"
                      className="stepper__btn"
                      aria-label="Poner 1 huevo en esta ave"
                      title={!canAdd ? (isFull ? "Ave llena" : "No quedan huevos disponibles") : "Poner 1 huevo en esta ave"}
                      disabled={!canAdd}
                      onClick={() => handleAddEgg(key, b.availableSpace)}
                    >
                      <Icon name="plus2" size={22} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Poderes opcionales al activar la pradera */}
          {powerChecklistEntries.length > 0 && (
            <PowerChecklist title="Poderes que se activarían" entries={powerChecklistEntries} />
          )}
        </>
      )}
    </Modal>
  );
};
