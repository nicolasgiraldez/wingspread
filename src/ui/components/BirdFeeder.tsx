import React, { useState } from "react";
import { RefreshCw, Utensils } from "lucide-react";
import { canRerollFeeder } from "../../game";
import type { ResourceFace } from "../../game";
import { resourceIcons, resourceLabels } from "../labels";

interface BirdFeederProps {
  feeder: ResourceFace[];
  /** Llama con el índice del dado y (si es wild) la elección del jugador */
  onTakeDie: (dieIndex: number, wildChoice?: "insect" | "seed") => void;
  onReroll: () => void;
  disabled?: boolean;
}

/** Popup flotante para elegir entre insecto 🐛 o semilla 🌾 al tomar un dado "wild" */
const WildChoicePopup: React.FC<{
  dieIndex: number;
  onChoose: (choice: "insect" | "seed") => void;
  onCancel: () => void;
}> = ({ dieIndex, onChoose, onCancel }) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.35)",
    }}
    onClick={onCancel}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "24px 32px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        minWidth: 260,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#334" }}>
        Cara comodín — ¿Qué alimento elegís?
      </div>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "#667", textAlign: "center" }}>
        Este dado muestra insecto&nbsp;🐛 y semilla&nbsp;🌾. Elegí uno.
      </p>
      <div style={{ display: "flex", gap: 16 }}>
        <button
          style={{
            fontSize: "1.5rem",
            padding: "12px 24px",
            borderRadius: 12,
            border: "2px solid #d4e6d0",
            background: "#f0f7ee",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
          onClick={() => onChoose("insect")}
          title="Tomar 1 insecto/gusano"
        >
          🐛
          <span style={{ fontSize: "0.75rem", color: "#334", fontWeight: 600 }}>Gusano</span>
        </button>
        <button
          style={{
            fontSize: "1.5rem",
            padding: "12px 24px",
            borderRadius: 12,
            border: "2px solid #d4e6d0",
            background: "#f0f7ee",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
          onClick={() => onChoose("seed")}
          title="Tomar 1 semilla/trigo"
        >
          🌾
          <span style={{ fontSize: "0.75rem", color: "#334", fontWeight: 600 }}>Trigo</span>
        </button>
      </div>
      <button
        style={{ fontSize: "0.8rem", color: "#889", background: "none", border: "none", cursor: "pointer" }}
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
          dieIndex={wildPending}
          onChoose={handleWildChoice}
          onCancel={() => setWildPending(null)}
        />
      )}

      <div className="birdfeeder-box">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Utensils size={18} color="#8c7355" />
            <strong style={{ fontSize: "1.05rem" }}>Comedero de Aves</strong>
            <span style={{ fontSize: "0.85rem", color: "#665" }}>
              ({feeder.length} dado{feeder.length !== 1 ? "s" : ""} disponible{feeder.length !== 1 ? "s" : ""})
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#776" }}>
            Haz clic en un dado para obtener ese alimento y activar tu bosque.
            {feeder.includes("wild") && (
              <span style={{ color: "#235c3a", fontWeight: 600 }}>
                {" "}La cara 🐛/🌾 te pedirá que elijas.
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
                    ? "Dado comodín: elegí entre gusano 🐛 o trigo 🌾"
                    : `Tomar 1 ${resourceLabels[face]}`
                }
              >
                <span className="die-icon">{resourceIcons[face]}</span>
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
                backgroundColor: "#8c7355",
                minHeight: 44,
                padding: "0 14px",
              }}
              title="Relanzar todos los dados (permitido cuando todos son iguales o está vacío)"
            >
              <RefreshCw size={16} /> Relanzar
            </button>
          )}
        </div>
      </div>
    </>
  );
};
