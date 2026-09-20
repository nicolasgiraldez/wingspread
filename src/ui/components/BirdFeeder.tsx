import React, { useState } from "react";
import { canRerollFeeder } from "../../game";
import type { ResourceFace } from "../../game";
import { resourceIcons, resourceLabels } from "../labels";
import { capitalize, countOf, plural, pressVerb } from "../text";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Modal } from "./ui/Modal";
import { RichText } from "./ui/RichText";

interface BirdFeederProps {
  feeder: ResourceFace[];
  /** Llama con el índice del dado y (si es wild) la elección del jugador */
  onTakeDie: (dieIndex: number, wildChoice?: "insect" | "seed") => void;
  onReroll: () => void;
  disabled?: boolean;
  /** Por qué los dados no se pueden usar ahora (se muestra en texto cuando `disabled`). */
  disabledReason?: string;
  /** Nombre de quien tiene el turno cuando no es el tuyo: se muestra como chip en el encabezado. */
  waitingFor?: string;
}

/** Elección de alimento al tomar un dado "wild" (insecto o semilla). */
const WildChoiceModal: React.FC<{
  onChoose: (choice: "insect" | "seed") => void;
  onCancel: () => void;
}> = ({ onChoose, onCancel }) => (
  <Modal
    title="Cara comodín — ¿Qué alimento elegís?"
    subtitle={<RichText text="Este dado muestra insecto {insect} y semilla {seed}. Elegí uno." size={18} />}
    align="center"
    width={440}
    onClose={onCancel}
    footer={<Button onClick={onCancel}>Cancelar</Button>}
  >
    <div className="wild-choice">
      <button type="button" className="wild-choice__option" onClick={() => onChoose("insect")} title="Tomar 1 insecto/gusano">
        <Icon name="insect" size={44} />
        Insecto
      </button>
      <button type="button" className="wild-choice__option" onClick={() => onChoose("seed")} title="Tomar 1 semilla/trigo">
        <Icon name="seed" size={44} />
        Semilla
      </button>
    </div>
  </Modal>
);

export const BirdFeeder: React.FC<BirdFeederProps> = ({
  feeder,
  onTakeDie,
  onReroll,
  disabled = false,
  disabledReason,
  waitingFor,
}) => {
  const [wildPending, setWildPending] = useState<number | null>(null);
  const canReroll = canRerollFeeder(feeder);
  const empty = feeder.length === 0;

  const handleDieClick = (idx: number) => {
    if (disabled) return;
    if (feeder[idx] === "wild") {
      // Mostrar popup de elección
      setWildPending(idx);
    } else {
      onTakeDie(idx);
    }
  };

  const handleWildChoice = (choice: "insect" | "seed") => {
    if (wildPending !== null) {
      onTakeDie(wildPending, choice);
    }
    setWildPending(null);
  };

  return (
    <>
      {wildPending !== null && <WildChoiceModal onChoose={handleWildChoice} onCancel={() => setWildPending(null)} />}

      <section className="panel-wide feeder" aria-labelledby="feeder-title">
        <div className="feeder__info">
          <div className="panel-wide__head">
            <h2 id="feeder-title" className="panel-wide__title">
              Comedero de Aves
            </h2>
            <span className="panel-wide__count">
              ({countOf(feeder.length, "dado", "dados")} {plural(feeder.length, "disponible", "disponibles")})
            </span>
            {waitingFor && <span className="chip chip--on">Turno de {waitingFor}</span>}
          </div>
          {empty ? (
            <p className="panel-wide__help">El comedero está vacío. Relanzá los dados para volver a llenarlo.</p>
          ) : disabled && disabledReason ? (
            <p className="panel-wide__help">{disabledReason}</p>
          ) : (
            <p className="panel-wide__help">
              {pressVerb()} un dado para obtener ese alimento y activar tu bosque.
              {feeder.includes("wild") && (
                <span className="panel-wide__strong">
                  {" "}
                  <RichText text="La cara {insect}/{seed} te pedirá que elijas." size={16} />
                </span>
              )}
            </p>
          )}
        </div>

        <div className="feeder__dice">
          {empty ? (
            <span className="die-token die-token--hole" aria-hidden="true" />
          ) : (
            feeder.map((face, idx) => (
              <button
                key={idx}
                type="button"
                className={`die-token${face === "wild" ? " die-wild" : ""}`}
                onClick={() => handleDieClick(idx)}
                disabled={disabled}
                title={
                  face === "wild"
                    ? "Dado comodín: elegí entre insecto o semilla"
                    : `Tomar 1 ${resourceLabels[face]}`
                }
              >
                <span className="die-icon">
                  {face === "wild" ? (
                    <>
                      <Icon name="insect" size={26} />
                      <Icon name="seed" size={26} />
                    </>
                  ) : (
                    <Icon name={resourceIcons[face]} size={40} />
                  )}
                </span>
                <span className="die-label">{face === "wild" ? "Elegir" : capitalize(resourceLabels[face])}</span>
              </button>
            ))
          )}

          {canReroll && (
            <Button
              icon="refresh"
              disabled={disabled}
              onClick={onReroll}
              title="Relanzar todos los dados (permitido cuando todos son iguales o está vacío)"
            >
              Relanzar
            </Button>
          )}
        </div>
      </section>
    </>
  );
};
