import React, { useState } from "react";
import { Check, X } from "lucide-react";
import { getActivatablePowers } from "../../game";
import type { GameState, HabitatId, PlayerState } from "../../game";
import { PowerChecklist, PowerChecklistEntry } from "./PowerChecklist";

interface HabitatPowersModalProps {
  title: string;
  subtitle: string;
  habitat: HabitatId;
  player: PlayerState;
  gameState: GameState;
  onConfirm: (skipPowerIds: string[], powerCardChoices: Record<string, string>) => void;
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

  const entries: PowerChecklistEntry[] = activatable.map(({ card, power }) => {
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
    }

    return {
      power,
      birdName: card.name,
      checked: !skipped.has(power.id),
      onToggle: () => toggle(power.id),
      cardChoice,
    };
  });

  const handleConfirm = () => {
    const activeChoices: Record<string, string> = {};
    for (const entry of entries) {
      if (entry.checked && entry.cardChoice?.selected) {
        activeChoices[entry.power.id] = entry.cardChoice.selected;
      }
    }
    onConfirm(Array.from(skipped), activeChoices);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onClose} style={{ background: "transparent", color: "#667", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: "0.85rem", color: "#556" }}>{subtitle}</p>

        <PowerChecklist title="Poderes que se activarían" entries={entries} />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #d2ded0", paddingTop: 14 }}>
          <button onClick={onClose} style={{ backgroundColor: "#e2e8f0", color: "#334155" }}>
            Cancelar
          </button>
          <button onClick={handleConfirm} style={{ backgroundColor: "#235c3a" }}>
            <Check size={16} /> Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
