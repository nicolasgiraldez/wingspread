import React from "react";
import type { CardId, NameTag, SpeciesCard } from "../../game";
import { countOf } from "../text";
import { BirdCard } from "./BirdCard";
import { CardBack } from "./CardBack";
import { Button } from "./ui/Button";

const MARKET_SLOTS = 3;

interface BirdMarketProps {
  marketCardIds: CardId[];
  cardsCatalog: Record<CardId, SpeciesCard>;
  deckCount: number;
  onDrawMarketCard: (cardId: CardId) => void;
  onDrawFromDeck: () => void;
  disabled?: boolean;
  /** Por qué no se puede robar ahora (se muestra en el propio botón cuando `disabled`). */
  disabledReason?: string;
  highlightNameTags?: NameTag[];
}

export const BirdMarket: React.FC<BirdMarketProps> = ({
  marketCardIds,
  cardsCatalog,
  deckCount,
  onDrawMarketCard,
  onDrawFromDeck,
  disabled = false,
  disabledReason,
  highlightNameTags,
}) => {
  const deckEmpty = deckCount === 0;
  const visible = marketCardIds.map((id) => cardsCatalog[id]).filter((card): card is SpeciesCard => !!card);
  const holes = Math.max(0, MARKET_SLOTS - visible.length);

  return (
    <section id="market" className="panel-wide" aria-labelledby="market-title">
      <div className="panel-wide__head">
        <h2 id="market-title" className="panel-wide__title">
          Mercado de Aves
        </h2>
        <span className="panel-wide__count">({countOf(deckCount, "carta", "cartas")} en el mazo)</span>
      </div>

      {deckEmpty && (
        <p className="panel-wide__help" role="status">
          El mazo se agotó. Se baraja la pila de descarte para formar un nuevo mazo.
        </p>
      )}

      <div className="market">
        <div className="market__deck">
          <CardBack
            width={192}
            height={290}
            stack
            label={deckEmpty ? "Mazo vacío · 0 cartas" : countOf(deckCount, "carta", "cartas")}
          />
          <Button
            onClick={onDrawFromDeck}
            disabled={disabled || deckEmpty}
            disabledText={deckEmpty ? "Mazo vacío" : disabledReason}
          >
            Robar Carta Oculta del Mazo
          </Button>
        </div>

        {visible.map((card) => (
          <BirdCard
            key={card.id}
            card={card}
            mode="hand"
            highlightNameTags={highlightNameTags}
            actionLabel="Robar esta ave"
            actionDisabled={disabled}
            actionDisabledText={disabledReason}
            onAction={() => onDrawMarketCard(card.id)}
          />
        ))}

        {Array.from({ length: holes }, (_, i) => (
          <div key={`hole-${i}`} className="market__hole">
            <strong>Sin carta</strong>
            <span>No quedan aves para reponer este lugar</span>
          </div>
        ))}
      </div>
    </section>
  );
};
