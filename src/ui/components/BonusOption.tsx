import React, { useId } from "react";
import type { BonusCard } from "../../game";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";

interface BonusOptionProps {
  bonus: BonusCard;
  /** Elegida: anillo mostaza y botón lleno con "Elegida". */
  selected?: boolean;
  /** Si se pasa, la opción se comporta como interruptor (aria-pressed); si no, elegir es inmediato. */
  toggle?: boolean;
  onChoose: () => void;
}

/** Carta de bonificación ofrecida: cabecera mostaza, nombre, descripción y botón "Elegir esta". */
export const BonusOption: React.FC<BonusOptionProps> = ({ bonus, selected = false, toggle = false, onChoose }) => {
  const id = useId();
  return (
    <article className={`bonus-option${selected ? " is-selected" : ""}`} aria-labelledby={`${id}-name`}>
      <header className="bonus-option__tag">
        <Icon name="star" size={20} />
        Bonificación
      </header>
      <div className="bonus-option__body">
        <h3 id={`${id}-name`} className="bonus-option__name">
          {bonus.name}
        </h3>
        <p id={`${id}-desc`} className="bonus-option__desc">
          {bonus.description}
        </p>
        <Button
          variant={selected ? "panel" : "secondary"}
          icon={selected ? "check" : undefined}
          aria-pressed={toggle ? selected : undefined}
          aria-describedby={`${id}-name ${id}-desc`}
          onClick={onChoose}
        >
          {selected ? "Elegida" : "Elegir esta"}
        </Button>
      </div>
    </article>
  );
};
