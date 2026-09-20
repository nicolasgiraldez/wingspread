import React, { useState } from "react";
import { canRerollFeeder } from "../../game";
import type { ResourceFace } from "../../game";
import { resourceIcons, resourceLabels } from "../labels";
import { countOf, plural, pressVerb } from "../text";
import { Icon } from "./ui/Icon";
import { RichText } from "./ui/RichText";

interface BirdFeederProps {
  feeder: ResourceFace[];
  /** Llama con el índice del dado y (si es wild) la elección del jugador */
  onTakeDie: (dieIndex: number, wildChoice?: "insect" | "seed") => void;
  onReroll: () => void;
  disabled?: boolean;
}

/** Popup flotante para elegir entre insecto o semilla al tomar un dado "wild" */
const WildChoicePopup: React.FC<{
  onChoose: (choice: "insect" | "seed") => void;
  onCancel: () => void;
}> = ({ onChoose, onCancel }) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.65)",
    }}
    onClick={onCancel}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "#182019",
        border: "1px solid #2b332e",
        borderRadius: 16,
        padding: "24px 32px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        minWidth: 260,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#eef1ec" }}>
        Cara comodín — ¿Qué alimento elegís?
      </div>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "#93a397", textAlign: "center" }}>
        <RichText text="Este dado muestra insecto {insect} y semilla {seed}. Elegí uno." size={18} />
      </p>
      <div style={{ display: "flex", gap: 16 }}>
        <button
          style={{
            fontSize: "1.5rem",
            padding: "12px 24px",
            borderRadius: 12,
            border: "2px solid rgba(63, 174, 114, 0.35)",
            background: "rgba(63, 174, 114, 0.12)",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
          onClick={() => onChoose("insect")}
          title="Tomar 1 insecto/gusano"
        >
          <Icon name="insect" size={32} />
          <span style={{ fontSize: "0.75rem", color: "#eef1ec", fontWeight: 600 }}>Insecto</span>
        </button>
        <button
          style={{
            fontSize: "1.5rem",
            padding: "12px 24px",
            borderRadius: 12,
            border: "2px solid rgba(63, 174, 114, 0.35)",
            background: "rgba(63, 174, 114, 0.12)",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
          onClick={() => onChoose("seed")}
          title="Tomar 1 semilla/trigo"
        >
          <Icon name="seed" size={32} />
          <span style={{ fontSize: "0.75rem", color: "#eef1ec", fontWeight: 600 }}>Semilla</span>
        </button>
      </div>
      <button
        style={{ fontSize: "0.8rem", color: "#75897b", background: "none", border: "none", cursor: "pointer" }}
        onClick={onCancel}
      >
        Cancelar
      </button>
    </div>
  </div>
);

export const BirdFeeder: React.FC<BirdFeederProps> = ({
  feeder,
  onTakeDie,
  onReroll,
  disabled = false,
}) => {
  const [wildPending, setWildPending] = useState<number | null>(null);
  const canReroll = canRerollFeeder(feeder);

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
      {wildPending !== null && (
        <WildChoicePopup
          onChoose={handleWildChoice}
          onCancel={() => setWildPending(null)}
        />
      )}

      <div className="birdfeeder-box">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <strong style={{ fontSize: "1.05rem" }}>Comedero de Aves</strong>
            <span style={{ fontSize: "0.85rem", color: "#93a397" }}>
              ({countOf(feeder.length, "dado", "dados")} {plural(feeder.length, "disponible", "disponibles")})
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#93a397" }}>
            {pressVerb()} un dado para obtener ese alimento y activar tu bosque.
            {feeder.includes("wild") && (
              <span style={{ color: "#3fae72", fontWeight: 600 }}>
                {" "}
                <RichText text="La cara {insect}/{seed} te pedirá que elijas." size={16} />
              </span>
            )}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="feeder-dice-row">
            {feeder.map((face, idx) => (
              <button
                key={idx}
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
                      <Icon name="insect" size={22} />
                      <Icon name="seed" size={22} />
                    </>
                  ) : (
                    <Icon name={resourceIcons[face]} size={30} />
                  )}
                </span>
                <span className="die-label">
                  {face === "wild" ? "elegir" : resourceLabels[face]}
                </span>
              </button>
            ))}
          </div>

          {canReroll && (
            <button
              onClick={onReroll}
              disabled={disabled}
              style={{
                backgroundColor: "#6b5a3e",
                minHeight: 44,
                padding: "0 14px",
              }}
              title="Relanzar todos los dados (permitido cuando todos son iguales o está vacío)"
            >
              <Icon name="refresh" size={18} /> Relanzar
            </button>
          )}
        </div>
      </div>
    </>
  );
};
