import React, { useState } from "react";
import type { BonusCard, CardId, GameState, Move, PlayerState, ResourceFace } from "../../game";
import { resourceIcons, resourceLabels } from "../labels";
import { BirdCard } from "./BirdCard";
import { countOf } from "../text";
import { Icon } from "./ui/Icon";

type StartMove = Extract<Move, { type: "chooseStart" }>;

interface StartingHandModalProps {
  player: PlayerState;
  gameState: GameState;
  onConfirm: (move: StartMove) => void;
}

const FOODS: ResourceFace[] = ["insect", "seed", "fruit", "fish", "rodent"];

/**
 * Preparación inicial estándar: cada jugador recibe 5 aves, 5 fichas de alimento (1 de cada tipo) y
 * 2 cartas de bonificación. Se queda con las aves que quiera, pero por cada una descarta 1 ficha de
 * alimento, y elige una de las dos bonificaciones.
 */
export const StartingHandModal: React.FC<StartingHandModalProps> = ({ player, gameState, onConfirm }) => {
  const [kept, setKept] = useState<CardId[]>([]);
  const [discarded, setDiscarded] = useState<ResourceFace[]>([]);
  const [bonusId, setBonusId] = useState<string | null>(null);

  const offered = (player.pendingBonusChoice ?? [])
    .map((id) => gameState.bonusCardsCatalog?.[id])
    .filter((bonus): bonus is BonusCard => !!bonus);

  const toggleBird = (id: CardId) => {
    setKept((prev) => {
      const next = prev.includes(id) ? prev.filter((other) => other !== id) : [...prev, id];
      // Al conservar menos aves se devuelven fichas: no puede haber más descartes que aves.
      setDiscarded((food) => food.slice(0, next.length));
      return next;
    });
  };
  const toggleFood = (food: ResourceFace) =>
    setDiscarded((prev) => {
      if (prev.includes(food)) return prev.filter((other) => other !== food);
      return prev.length < kept.length ? [...prev, food] : prev;
    });

  const missing = kept.length - discarded.length;
  const ready = missing === 0 && bonusId !== null;
  const hint = missing > 0
    ? `Elegí ${countOf(missing, "ficha", "fichas")} de alimento más para descartar.`
    : bonusId === null
      ? "Elegí una carta de bonificación."
      : "";

  const confirm = () => {
    if (!ready || bonusId === null) return;
    // Se conservan en el orden en que se repartieron, no en el de selección.
    onConfirm({
      type: "chooseStart",
      keepCards: player.hand.filter((id) => kept.includes(id)),
      discardFood: discarded,
      bonusCardId: bonusId,
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 960, maxHeight: "94vh", overflowY: "auto" }}>
        <div style={{ textAlign: "center", padding: "6px 0 12px 0" }}>
          <span style={{ display: "inline-flex", margin: "0 auto 8px auto" }}>
            <Icon name="star" size={40} />
          </span>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "1.3rem" }}>{player.name}, prepará tu mano inicial</h2>
          <p style={{ margin: 0, color: "#93a397", fontSize: "0.88rem" }}>
            Te tocaron 5 aves y 5 fichas de alimento. Quedate con las aves que quieras, pero por cada una descartá 1 ficha de alimento.
          </p>
        </div>

        <strong style={{ fontSize: "0.9rem" }}>1. Aves que conservás ({kept.length} de {player.hand.length})</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(264px, 1fr))", gap: 10, margin: "8px 0 16px 0" }}>
          {player.hand.map((id) => (
            <div key={id} title={kept.includes(id) ? "Se conserva (pulsá para descartarla)" : "Se descarta (pulsá para quedártela)"}>
              <BirdCard card={gameState.cards[id]} mode="full" selected={kept.includes(id)} onClick={() => toggleBird(id)} />
              <div style={{ textAlign: "center", fontSize: "0.75rem", marginTop: 3, color: kept.includes(id) ? "#3fae72" : "#75897b" }}>
                {kept.includes(id) ? (
                  <>
                    <Icon name="check" size={16} ink="var(--c-petroleo)" /> Se conserva
                  </>
                ) : (
                  "Se descarta"
                )}
              </div>
            </div>
          ))}
        </div>

        <strong style={{ fontSize: "0.9rem" }}>2. Alimento que descartás ({discarded.length} de {kept.length})</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 16px 0" }}>
          {FOODS.map((food) => {
            const isDiscarded = discarded.includes(food);
            return (
              <button
                key={food}
                type="button"
                onClick={() => toggleFood(food)}
                disabled={!isDiscarded && discarded.length >= kept.length}
                title={isDiscarded ? "Se descarta (pulsá para quedártela)" : "Se conserva (pulsá para descartarla)"}
                style={{
                  backgroundColor: isDiscarded ? "rgba(240, 100, 95, 0.15)" : "#212b22",
                  color: isDiscarded ? "#f0645f" : "#eef1ec",
                  border: `1.5px solid ${isDiscarded ? "rgba(240, 100, 95, 0.5)" : "#394239"}`,
                  textDecoration: isDiscarded ? "line-through" : "none",
                }}
              >
                <Icon name={resourceIcons[food]} size={20} /> {resourceLabels[food]}
              </button>
            );
          })}
        </div>

        <strong style={{ fontSize: "0.9rem" }}>3. Carta de bonificación que conservás</strong>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "8px 0 16px 0" }}>
          {offered.map((bonus) => (
            <div
              key={bonus.id}
              style={{
                flex: "1 1 230px",
                maxWidth: 300,
                background: "#212b22",
                border: `1.5px solid ${bonusId === bonus.id ? "#3fae72" : "#394239"}`,
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <strong>{bonus.name}</strong>
              <span style={{ fontSize: "0.8rem", color: "#c3ccc5" }}>{bonus.description}</span>
              <button type="button" onClick={() => setBonusId(bonus.id)} style={{ justifyContent: "center" }}>
                {bonusId === bonus.id ? (
                  <>
                    <Icon name="check" size={16} /> Elegida
                  </>
                ) : (
                  "Elegir esta"
                )}
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, borderTop: "1px solid #2b332e", paddingTop: 12 }}>
          {hint && <span style={{ fontSize: "0.82rem", color: "#d9a83b" }}>{hint}</span>}
          <button type="button" onClick={confirm} disabled={!ready} style={{ backgroundColor: "#1f7a4f" }}>
            Confirmar mano inicial
          </button>
        </div>
      </div>
    </div>
  );
};
