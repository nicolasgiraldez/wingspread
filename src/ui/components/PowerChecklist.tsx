import React from "react";
import type { CardId, HabitatId, Power } from "../../game";
import { describePower } from "../labels";

export interface PowerCardChoiceConfig {
  /** Texto explicando qué carta hay que elegir (p. ej. "¿Qué carta descartás?"). */
  label: string;
  options: { id: CardId; name: string }[];
  selected: CardId | null;
  onSelect: (id: CardId | null) => void;
  /** Texto de la opción "usar comportamiento por defecto" (sin elegir explícitamente). */
  defaultOptionLabel: string;
}

export interface PowerSlotChoiceConfig {
  /** Texto explicando qué ave hay que elegir (p. ej. "¿En qué ave ponés el huevo?"). */
  label: string;
  options: { key: string; name: string }[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  /** Texto de la opción "usar comportamiento por defecto" (sin elegir explícitamente). */
  defaultOptionLabel: string;
}

export interface PowerHabitatChoiceConfig {
  /** Texto explicando qué hábitat hay que elegir (p. ej. "¿A qué hábitat la movés?"). */
  label: string;
  options: { id: HabitatId; name: string }[];
  selected: HabitatId | null;
  onSelect: (id: HabitatId) => void;
}

export interface PowerChecklistEntry {
  power: Power;
  birdName: string;
  checked: boolean;
  onToggle: () => void;
  cardChoice?: PowerCardChoiceConfig;
  slotChoice?: PowerSlotChoiceConfig;
  habitatChoice?: PowerHabitatChoiceConfig;
}

interface PowerChecklistProps {
  title: string;
  entries: PowerChecklistEntry[];
}

/**
 * Lista de poderes opcionales (onPlay/onActivate) que se activarían con la acción actual.
 * Todos están tildados por defecto; el jugador puede destildar los que no quiera usar,
 * ya que el reglamento de Wingspan establece que todos los poderes son opcionales.
 */
export const PowerChecklist: React.FC<PowerChecklistProps> = ({ title, entries }) => {
  if (entries.length === 0) return null;

  return (
    <div>
      <strong style={{ fontSize: "0.9rem" }}>{title}</strong>
      <p className="power-checklist-hint">
        Todos los poderes son opcionales: destildá los que no quieras activar.
      </p>
      <div className="power-checklist">
        {entries.map((entry, idx) => (
          <div
            key={`${entry.power.id}-${idx}`}
            className={`power-checklist-row ${entry.checked ? "checked" : ""}`}
          >
            <label className="power-checklist-label">
              <input type="checkbox" checked={entry.checked} onChange={entry.onToggle} />
              <span>
                <strong>{entry.birdName}</strong>: {describePower(entry.power)}
              </span>
            </label>

            {entry.checked && entry.cardChoice && entry.cardChoice.options.length > 0 && (
              <div className="power-checklist-choice">
                <span style={{ fontSize: "0.75rem", color: "#93a397" }}>{entry.cardChoice.label}</span>
                <select
                  value={entry.cardChoice.selected ?? ""}
                  onChange={(e) => entry.cardChoice!.onSelect(e.target.value || null)}
                >
                  <option value="">{entry.cardChoice.defaultOptionLabel}</option>
                  {entry.cardChoice.options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {entry.checked && entry.slotChoice && entry.slotChoice.options.length > 0 && (
              <div className="power-checklist-choice">
                <span style={{ fontSize: "0.75rem", color: "#93a397" }}>{entry.slotChoice.label}</span>
                <select
                  value={entry.slotChoice.selected ?? ""}
                  onChange={(e) => entry.slotChoice!.onSelect(e.target.value || null)}
                >
                  <option value="">{entry.slotChoice.defaultOptionLabel}</option>
                  {entry.slotChoice.options.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {entry.checked && entry.habitatChoice && entry.habitatChoice.options.length > 1 && (
              <div className="power-checklist-choice">
                <span style={{ fontSize: "0.75rem", color: "#93a397" }}>{entry.habitatChoice.label}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {entry.habitatChoice.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => entry.habitatChoice!.onSelect(opt.id)}
                      style={{
                        flex: 1,
                        padding: "5px 8px",
                        borderRadius: 6,
                        border: "1px solid rgba(63, 174, 114, 0.35)",
                        background: entry.habitatChoice!.selected === opt.id ? "#1f7a4f" : "rgba(63, 174, 114, 0.12)",
                        color: entry.habitatChoice!.selected === opt.id ? "#ffffff" : "#3fae72",
                        fontSize: "0.78rem",
                        cursor: "pointer",
                      }}
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
