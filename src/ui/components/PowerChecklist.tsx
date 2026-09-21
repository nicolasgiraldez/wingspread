import React, { useId } from "react";
import type { CardId, HabitatId, Power } from "../../game";
import { describePower } from "../labels";
import { RichText } from "./ui/RichText";

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
  /** Alimento que se gana al solapar cuando el poder ofrece dos (p. ej. insecto o semilla). */
  gainChoice?: PowerCardChoiceConfig;
  slotChoice?: PowerSlotChoiceConfig;
  habitatChoice?: PowerHabitatChoiceConfig;
}

interface PowerChecklistProps {
  title: string;
  entries: PowerChecklistEntry[];
}

/** Selector con su etiqueta visible enlazada (`label for`). */
const SelectChoice: React.FC<{
  label: string;
  value: string;
  defaultLabel: string;
  options: { value: string; name: string }[];
  onChange: (value: string) => void;
}> = ({ label, value, defaultLabel, options, onChange }) => {
  const id = useId();
  return (
    <div className="power-row__choice">
      <label htmlFor={id} className="power-row__label">
        {label}
      </label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{defaultLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.name}
          </option>
        ))}
      </select>
    </div>
  );
};

/**
 * Lista de poderes opcionales (onPlay/onActivate) que se activarían con la acción actual.
 * Todos están tildados por defecto; el jugador puede destildar los que no quiera usar,
 * ya que el reglamento de Wingspan establece que todos los poderes son opcionales.
 */
export const PowerChecklist: React.FC<PowerChecklistProps> = ({ title, entries }) => {
  const headingId = useId();
  if (entries.length === 0) return null;

  return (
    <section className="step" aria-labelledby={headingId}>
      <h3 id={headingId} className="step__title">
        {title}
      </h3>
      <p className="step__note">Todos los poderes son opcionales: destildá los que no quieras activar.</p>
      <div className="power-list">
        {entries.map((entry, idx) => (
          <div key={`${entry.power.id}-${idx}`} className={`power-row${entry.checked ? " power-row--on" : ""}`}>
            <label className="power-row__main">
              <input type="checkbox" checked={entry.checked} onChange={entry.onToggle} />
              <span>
                <strong>{entry.birdName}</strong>: <RichText text={describePower(entry.power)} size={18} />
              </span>
            </label>

            {entry.checked && entry.cardChoice && entry.cardChoice.options.length > 0 && (
              <SelectChoice
                label={entry.cardChoice.label}
                value={entry.cardChoice.selected ?? ""}
                defaultLabel={entry.cardChoice.defaultOptionLabel}
                options={entry.cardChoice.options.map((o) => ({ value: o.id, name: o.name }))}
                onChange={(v) => entry.cardChoice!.onSelect(v || null)}
              />
            )}

            {entry.checked && entry.gainChoice && (
              <SelectChoice
                label={entry.gainChoice.label}
                value={entry.gainChoice.selected ?? ""}
                defaultLabel={entry.gainChoice.defaultOptionLabel}
                options={entry.gainChoice.options.map((o) => ({ value: o.id, name: o.name }))}
                onChange={(v) => entry.gainChoice!.onSelect(v || null)}
              />
            )}

            {entry.checked && entry.slotChoice && entry.slotChoice.options.length > 0 && (
              <SelectChoice
                label={entry.slotChoice.label}
                value={entry.slotChoice.selected ?? ""}
                defaultLabel={entry.slotChoice.defaultOptionLabel}
                options={entry.slotChoice.options.map((o) => ({ value: o.key, name: o.name }))}
                onChange={(v) => entry.slotChoice!.onSelect(v || null)}
              />
            )}

            {entry.checked && entry.habitatChoice && entry.habitatChoice.options.length > 1 && (
              <div className="power-row__choice" role="group" aria-label={entry.habitatChoice.label}>
                <span className="power-row__label">{entry.habitatChoice.label}</span>
                <div className="pill-row">
                  {entry.habitatChoice.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`pill${entry.habitatChoice!.selected === opt.id ? " pill--on" : ""}`}
                      aria-pressed={entry.habitatChoice!.selected === opt.id}
                      onClick={() => entry.habitatChoice!.onSelect(opt.id)}
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
    </section>
  );
};
