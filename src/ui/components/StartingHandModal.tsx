import React, { useId, useState } from "react";
import type { BonusCard, CardId, GameState, Move, PlayerState, ResourceFace } from "../../game";
import logoUrl from "../assets/logo.svg";
import { resourceIcons, resourceLabels } from "../labels";
import { capitalize, countOf } from "../text";
import { BirdCard } from "./BirdCard";
import { BonusOption } from "./BonusOption";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Modal } from "./ui/Modal";

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
 * alimento, y elige una de las dos bonificaciones. Es un modal obligatorio: no se cierra sin confirmar.
 */
export const StartingHandModal: React.FC<StartingHandModalProps> = ({ player, gameState, onConfirm }) => {
  const [kept, setKept] = useState<CardId[]>([]);
  const [discarded, setDiscarded] = useState<ResourceFace[]>([]);
  const [bonusId, setBonusId] = useState<string | null>(null);
  const hintId = useId();

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
  const hint =
    missing > 0
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
    <Modal
      title={`${player.name}, prepará tu mano inicial`}
      subtitle="Te tocaron 5 aves y 5 fichas de alimento. Quedate con las aves que quieras, pero por cada una descartá 1 ficha de alimento."
      icon={<img src={logoUrl} alt="" width={44} height={44} />}
      iconStyle="bare"
      align="center"
      width={1116}
      className="modal--hand"
      footer={
        <>
          {hint && (
            <span id={hintId} className="modal__hint" role="status">
              {hint}
            </span>
          )}
          <Button
            variant="primary"
            size="lg"
            disabled={!ready}
            aria-describedby={hint ? hintId : undefined}
            onClick={confirm}
          >
            Confirmar mano inicial
          </Button>
        </>
      }
    >
      <section className="step" aria-labelledby={`${hintId}-birds`}>
        <h3 id={`${hintId}-birds`} className="step__title">
          1. Aves que conservás ({kept.length} de {player.hand.length})
        </h3>
        <div className="pick-row">
          {player.hand.map((id) => {
            const isKept = kept.includes(id);
            return (
              <div key={id} className={`pick${isKept ? "" : " pick--out"}`}>
                <BirdCard
                  card={gameState.cards[id]}
                  mode="hand"
                  selected={isKept}
                  onClick={() => toggleBird(id)}
                />
                <span className={`pick__status${isKept ? " pick__status--in" : ""}`}>
                  {isKept ? (
                    <>
                      <Icon name="check" size={18} ink="var(--c-petroleo)" /> Se conserva
                    </>
                  ) : (
                    "Se descarta"
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="step" aria-labelledby={`${hintId}-food`}>
        <h3 id={`${hintId}-food`} className="step__title">
          2. Alimento que descartás ({discarded.length} de {kept.length})
        </h3>
        {kept.length === 0 && (
          <p className="step__note">Por cada ave que conserves vas a descartar 1 ficha de alimento.</p>
        )}
        <div className="food-row">
          {FOODS.map((food) => {
            const isDiscarded = discarded.includes(food);
            const blocked = !isDiscarded && discarded.length >= kept.length;
            return (
              <button
                key={food}
                type="button"
                className={`food${isDiscarded ? " food--out" : ""}`}
                aria-pressed={isDiscarded}
                aria-disabled={blocked || undefined}
                title={
                  isDiscarded
                    ? "Se descarta (pulsá para quedártela)"
                    : blocked
                      ? "Ya elegiste todas las fichas que hay que descartar"
                      : "Se conserva (pulsá para descartarla)"
                }
                onClick={() => !blocked && toggleFood(food)}
              >
                <Icon name={resourceIcons[food]} size={32} />
                <span className="food__text">
                  <span className="food__name">{capitalize(resourceLabels[food])}</span>
                  <span className="food__state">{isDiscarded ? "Se descarta" : "Se conserva"}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="step" aria-labelledby={`${hintId}-bonus`}>
        <h3 id={`${hintId}-bonus`} className="step__title">
          3. Carta de bonificación que conservás
        </h3>
        <div className="bonus-row">
          {offered.map((bonus) => (
            <BonusOption
              key={bonus.id}
              bonus={bonus}
              toggle
              selected={bonusId === bonus.id}
              onChoose={() => setBonusId(bonus.id)}
            />
          ))}
        </div>
      </section>
    </Modal>
  );
};
