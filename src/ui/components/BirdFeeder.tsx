import React from "react";
import { RefreshCw, Utensils } from "lucide-react";
import { canRerollFeeder } from "../../game";
import type { ResourceFace } from "../../game";
import { resourceIcons, resourceLabels } from "../labels";

interface BirdFeederProps {
  feeder: ResourceFace[];
  onTakeDie: (dieIndex: number) => void;
  onReroll: () => void;
  disabled?: boolean;
}

export const BirdFeeder: React.FC<BirdFeederProps> = ({
  feeder,
  onTakeDie,
  onReroll,
  disabled = false,
}) => {
  const canReroll = canRerollFeeder(feeder);

  return (
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
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div className="feeder-dice-row">
          {feeder.map((face, idx) => (
            <button
              key={idx}
              className="die-token"
              onClick={() => onTakeDie(idx)}
              disabled={disabled}
              title={`Tomar 1 ${resourceLabels[face]}`}
            >
              <span className="die-icon">{resourceIcons[face]}</span>
              <span className="die-label">{resourceLabels[face]}</span>
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
  );
};
