import React, { useState } from "react";
import { Check, X } from "lucide-react";
import { getActivatablePowers } from "../../game";
import type { GameState, HabitatId, PlayerState, PowerEggChoices, PowerMoveChoices } from "../../game";
import {
  buildEggSourceOptions,
  buildEggTargetOptions,
  anyFoodOptions,
  buildRepeatPowerOptions,
  decodeSlotKey,
} from "./powerOptions";
import { PowerChecklist, PowerChecklistEntry } from "./PowerChecklist";
import { habitatLabels } from "../labels";

interface HabitatPowersModalProps {
  title: string;
  subtitle: string;
  habitat: HabitatId;
  player: PlayerState;
  gameState: GameState;
  onConfirm: (
    skipPowerIds: string[],
    powerCardChoices: Record<string, string>,
    powerEggChoices: PowerEggChoices,
    powerMoveChoices: PowerMoveChoices,
  ) => void;
  onClose: () => void;
}

/**
 * Confirma una acción de "obtener comida" o "robar cartas" cuando el jugador tiene aves con
 * poderes "Al activar" (marrones) en ese hábitat. Deja elegir qué poderes activar (todos son
 * opcionales) y, si corresponde, qué carta de la mano usar para descartar o solapar.
 */
export const HabitatPowersModal: React.FC<HabitatPowersModalProps> = ({
  title,
  subtitle,
  habitat,
  player,
  gameState,
  onConfirm,
  onClose,
}) => {
  const activatable = getActivatablePowers(gameState, player, habitat);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [eggChoiceKeys, setEggChoiceKeys] = useState<Record<string, string>>({});
  const [moveChoices, setMoveChoices] = useState<PowerMoveChoices>({});

  const toggle = (powerId: string) => {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(powerId)) next.delete(powerId);
      else next.add(powerId);
      return next;
    });
  };

  const handConfirmable = player.hand.map((id) => ({
    id,
    name: gameState.cards[id]?.name ?? id,
  }));

  const entries: PowerChecklistEntry[] = activatable.map(({ source, card, power }) => {
    let cardChoice: PowerChecklistEntry["cardChoice"];
    if (power.kind === "tuckCard" && power.source === "hand") {
      cardChoice = {
        label: "¿Qué carta de tu mano solapás? (opcional)",
        options: handConfirmable,
        selected: choices[power.id] ?? null,
        onSelect: (id) =>
          setChoices((prev) => {
            const next = { ...prev };
            if (id) next[power.id] = id;
            else delete next[power.id];
            return next;
          }),
        defaultOptionLabel: "Automático (la última de tu mano)",
      };
    } else if (power.kind === "drawCard" && power.thenDiscard) {
      cardChoice = {
        label: "¿Qué carta preferís descartar? (opcional; si no elegís, se descarta la recién robada)",
        options: handConfirmable,
        selected: choices[power.id] ?? null,
        onSelect: (id) =>
          setChoices((prev) => {
            const next = { ...prev };
            if (id) next[power.id] = id;
            else delete next[power.id];
            return next;
          }),
        defaultOptionLabel: "Automático (la carta recién robada)",
      };
    } else if (power.kind === "gainResource" && power.resource === "wild") {
      cardChoice = {
        label: "¿Qué alimento tomás? (opcional)",
        options: anyFoodOptions,
        selected: choices[power.id] ?? null,
        onSelect: (id) =>
          setChoices((prev) => {
            const next = { ...prev };
            if (id) next[power.id] = id;
            else delete next[power.id];
            return next;
          }),
        defaultOptionLabel: "Insecto (por defecto)",
      };
    }

    let slotChoice: PowerChecklistEntry["slotChoice"];
    if (power.kind === "layEgg" && power.target === "any") {
      slotChoice = {
        label: "¿En qué ave ponés el/los huevo(s)? (opcional)",
        options: buildEggTargetOptions(gameState, player),
        selected: eggChoiceKeys[power.id] ?? null,
        onSelect: (key) =>
          setEggChoiceKeys((prev) => {
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
        selected: eggChoiceKeys[power.id] ?? null,
        onSelect: (key) =>
          setEggChoiceKeys((prev) => {
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
        options: buildRepeatPowerOptions(gameState, player, habitat, source, power.predatorOnly),
        selected: eggChoiceKeys[power.id] ?? null,
        onSelect: (key) =>
          setEggChoiceKeys((prev) => {
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
        selected: moveChoices[power.id] ?? null,
        onSelect: (h) => setMoveChoices((prev) => ({ ...prev, [power.id]: h })),
      };
    }

    return {
      power,
      birdName: card.name,
      checked: !skipped.has(power.id),
      onToggle: () => toggle(power.id),
      cardChoice,
      slotChoice,
      habitatChoice,
    };
  });

  const handleConfirm = () => {
    const activeChoices: Record<string, string> = {};
    const activeEggChoices: PowerEggChoices = {};
    const activeMoveChoices: PowerMoveChoices = {};
    for (const entry of entries) {
      if (!entry.checked) continue;
      if (entry.cardChoice?.selected) {
        activeChoices[entry.power.id] = entry.cardChoice.selected;
      }
      if (entry.slotChoice?.selected) {
        activeEggChoices[entry.power.id] = decodeSlotKey(entry.slotChoice.selected);
      }
      if (entry.habitatChoice?.selected) {
        activeMoveChoices[entry.power.id] = entry.habitatChoice.selected;
      }
    }
    onConfirm(Array.from(skipped), activeChoices, activeEggChoices, activeMoveChoices);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onClose} style={{ background: "transparent", color: "#93a397", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: "0.85rem", color: "#c3ccc5" }}>{subtitle}</p>

        <PowerChecklist title="Poderes que se activarían" entries={entries} />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #2b332e", paddingTop: 14 }}>
          <button onClick={onClose} style={{ backgroundColor: "#212b22", color: "#c3ccc5" }}>
            Cancelar
          </button>
          <button onClick={handleConfirm} style={{ backgroundColor: "#1f7a4f" }}>
            <Check size={16} /> Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
