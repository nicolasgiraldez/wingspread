import React, { useState } from "react";
import { getHabitatActionAllowance, getHabitatActiveColumn } from "../../game";
import type { GameState, HabitatId, NameTag, PlayerState } from "../../game";
import { habitatIcons, habitatLabels, playerNames } from "../labels";
import { countOf } from "../text";
import { useMediaQuery } from "../useMediaQuery";
import { BirdCard } from "./BirdCard";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";

interface PlayerBoardProps {
  player: PlayerState;
  gameState: GameState;
  isOwner?: boolean;
  highlightNameTags?: NameTag[];
  onOpenLayEggsModal?: (initialBird?: { habitat: HabitatId; slotIndex: number }) => void;
  isCurrentPlayerTurn: boolean;
}

const HABITATS: HabitatId[] = ["forest", "grassland", "wetland"];
const columnEggCosts = [0, 1, 1, 2, 2];

const HABITAT_ACTION: Record<HabitatId, string> = {
  forest: "Obtené alimento del comedero",
  grassland: "Poné huevos en tus nidos",
  wetland: "Robá nuevas cartas de ave",
};

/** Lo que da la acción del hábitat al usarla desde cada columna (1.ª–2.ª / 3.ª–4.ª / 5.ª). */
function columnReward(hab: HabitatId, slotIndex: number): string {
  const tier = slotIndex >= 4 ? 2 : slotIndex >= 2 ? 1 : 0;
  if (hab === "forest") return countOf([1, 2, 3][tier], "alimento", "alimentos");
  if (hab === "grassland") return countOf([2, 3, 4][tier], "huevo", "huevos");
  return countOf([1, 2, 3][tier], "carta", "cartas");
}

export const PlayerBoard: React.FC<PlayerBoardProps> = ({
  player,
  gameState,
  isOwner = true,
  highlightNameTags,
  onOpenLayEggsModal,
  isCurrentPlayerTurn,
}) => {
  const narrow = useMediaQuery("(max-width: 640px)");
  const [mobileHabitat, setMobileHabitat] = useState<HabitatId>("forest");
  const displayName = player.name || playerNames[player.id] || player.id;
  const grasslandAllowance = getHabitatActionAllowance(player, "grassland");

  // Espacio total de huevos disponible en todo el tablero del jugador
  let totalEggCapacity = 0;
  let totalEggsOnBoard = 0;
  HABITATS.forEach((h) => {
    player.board[h].forEach((s) => {
      if (s.cardId) {
        const c = gameState.cards[s.cardId];
        if (c) {
          totalEggCapacity += c.eggCapacity;
          totalEggsOnBoard += s.eggs;
        }
      }
    });
  });
  const totalFreeEggSpace = totalEggCapacity - totalEggsOnBoard;

  const eggsBlockedReason = !isCurrentPlayerTurn
    ? "Todavía no es tu turno"
    : totalFreeEggSpace <= 0
      ? "Tus aves no tienen espacio libre para huevos."
      : undefined;

  return (
    <section className="board" aria-labelledby="board-title">
      <div className="board__head">
        <h2 id="board-title" className="board__title">
          {isOwner ? "Tu tablero" : `Tablero de ${displayName}`}
        </h2>
        {isOwner ? (
          <span className="board__hint">La columna marcada como activa es la ranura de la próxima acción.</span>
        ) : (
          <span className="board__hint">Tablero del oponente (solo lectura)</span>
        )}
      </div>

      <div className="habitat-tabs" role="tablist" aria-label="Hábitat que se muestra">
        {HABITATS.map((hab) => (
          <button
            key={hab}
            type="button"
            role="tab"
            aria-selected={mobileHabitat === hab}
            className={`habitat-tab habitat-tab--${hab}${mobileHabitat === hab ? " habitat-tab--on" : ""}`}
            onClick={() => setMobileHabitat(hab)}
          >
            <Icon name={habitatIcons[hab]} size={20} />
            {habitatLabels[hab]}
          </button>
        ))}
      </div>

      {HABITATS.map((hab) => {
        const activeCol = getHabitatActiveColumn(player, hab);
        const birds = player.board[hab].filter((s) => s.cardId !== null).length;
        const firstEmpty = player.board[hab].findIndex((s) => s.cardId === null);
        return (
          <div key={hab} className={`habitat-row habitat-row--${hab}${mobileHabitat === hab ? " habitat-row--current" : ""}`}>
            <div className="habitat-panel">
              <div className="habitat-panel__top">
                <span className="habitat-panel__icon">
                  <Icon name={habitatIcons[hab]} size={34} />
                </span>
                <span className="chip habitat-panel__count">
                  {birds} de 5 aves{birds === 5 ? " · lleno" : ""}
                </span>
              </div>
              <div className="habitat-panel__bottom">
                <h3 className="habitat-panel__name">{habitatLabels[hab]}</h3>
                <p className="habitat-panel__action">{HABITAT_ACTION[hab]}</p>
                {activeCol !== null && activeCol !== undefined && (
                  <p className="habitat-panel__next">Próxima ranura: columna {activeCol + 1}</p>
                )}
                {hab === "grassland" && isOwner && (
                  <>
                    <Button
                      size="sm"
                      icon="egg"
                      disabled={!!eggsBlockedReason}
                      disabledText={eggsBlockedReason}
                      onClick={() => onOpenLayEggsModal?.()}
                      title={
                        totalFreeEggSpace <= 0
                          ? "Tus aves no tienen espacio libre para huevos"
                          : `Poner hasta ${grasslandAllowance.baseAmount} huevos en tus aves`
                      }
                    >
                      {`Poner ${grasslandAllowance.baseAmount} Huevos`}
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="habitat-slots">
              {player.board[hab].map((slot, sIdx) => {
                const card = slot.cardId ? gameState.cards[slot.cardId] : null;
                const isActiveCol = sIdx === activeCol;
                const eggCost = columnEggCosts[sIdx];
                const canLay =
                  !!card && isOwner && slot.eggs < card.eggCapacity && isCurrentPlayerTurn && !!onOpenLayEggsModal;

                if (card) {
                  return (
                    <div key={sIdx} className={`slot slot--filled${isActiveCol ? " slot--active" : ""}`}>
                      <BirdCard
                        card={card}
                        highlightNameTags={highlightNameTags}
                        eggs={slot.eggs}
                        cached={slot.cached}
                        tucked={slot.tucked}
                        mode={narrow ? "mini" : "board"}
                        actionLabel={canLay ? "Poner huevos" : undefined}
                        onAction={() => onOpenLayEggsModal?.({ habitat: hab, slotIndex: sIdx })}
                      />
                      {isActiveCol && <span className="slot__tag">Activa</span>}
                    </div>
                  );
                }

                const emptyClasses = `slot slot--empty${isActiveCol ? " slot--active" : ""}`;
                const content = (
                  <>
                    <Icon name="plus2" size={28} />
                    <span className="slot__col">Columna {sIdx + 1}</span>
                    <span className="slot__info">
                      {columnReward(hab, sIdx)} · Coste: {countOf(eggCost, "huevo", "huevos")}
                    </span>
                    {birds === 0 && sIdx === firstEmpty && <span className="slot__first">Jugá tu primera ave acá</span>}
                    {isActiveCol && <span className="slot__tag">Activa</span>}
                  </>
                );
                return (
                  <div key={sIdx} className={emptyClasses}>
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
};
