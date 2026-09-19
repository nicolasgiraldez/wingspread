import React from "react";
import { Hourglass, Sparkles } from "lucide-react";
import type { BonusCard } from "../../game";

interface ChooseBonusCardModalProps {
  playerName: string;
  /** Las cartas ofrecidas (ya resueltas desde el catálogo); vacío mientras se espera a otro jugador. */
  options: BonusCard[];
  onChoose: (bonusCardId: string) => void;
  /** Texto de espera cuando no hay nada que elegir. */
  waiting?: { title: string; text: string };
}

/**
 * Paso de setup previo a la Ronda 1: cada jugador recibe 2 cartas de bonificación al azar y
 * debe elegir 1 para conservar (la otra se descarta). En modo online, mientras el jugador local
 * ya eligió pero otro todavía no, se muestra un estado de espera en vez del selector.
 */
export const ChooseBonusCardModal: React.FC<ChooseBonusCardModalProps> = ({
  playerName,
  options,
  onChoose,
  waiting,
}) => {
  if (options.length === 0) {
    return (
      <div className="modal-backdrop">
        <div className="modal-content" style={{ maxWidth: 420, textAlign: "center" }}>
          <Hourglass size={32} color="#3fae72" style={{ margin: "0 auto 10px auto" }} />
          <h2 style={{ margin: "0 0 6px 0", fontSize: "1.15rem" }}>{waiting?.title ?? "Esperando"}</h2>
          <p style={{ margin: 0, color: "#93a397", fontSize: "0.9rem" }}>
            {waiting?.text ?? "Esperando al resto de los jugadores..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 580 }}>
        <div style={{ textAlign: "center", padding: "6px 0 14px 0" }}>
          <Sparkles size={36} color="#3fae72" style={{ margin: "0 auto 8px auto" }} />
          <h2 style={{ margin: "0 0 6px 0", fontSize: "1.25rem" }}>
            {playerName}, elegí tu carta de bonificación
          </h2>
          <p style={{ margin: 0, color: "#93a397", fontSize: "0.88rem" }}>
            Se revelaron {options.length} cartas. Quedate con 1; el resto vuelve al descarte.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          {options.map((bonus) => (
            <div
              key={bonus.id}
              style={{
                flex: "1 1 230px",
                maxWidth: 260,
                background: "#212b22",
                border: "1.5px solid #394239",
                borderRadius: 10,
                padding: "14px 14px 12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <strong style={{ fontSize: "1rem" }}>{bonus.name}</strong>
              <p style={{ margin: 0, color: "#c3ccc5", fontSize: "0.85rem", flex: 1 }}>
                {bonus.description}
              </p>
              <button
                onClick={() => onChoose(bonus.id)}
                style={{ backgroundColor: "#1f7a4f", padding: "8px 12px", fontSize: "0.9rem" }}
              >
                Elegir esta
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
