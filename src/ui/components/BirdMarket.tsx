import React from "react";
import type { CardId, NameTag, SpeciesCard } from "../../game";
import { BirdCard } from "./BirdCard";
import { Icon } from "./ui/Icon";

interface BirdMarketProps {
  marketCardIds: CardId[];
  cardsCatalog: Record<CardId, SpeciesCard>;
  deckCount: number;
  onDrawMarketCard: (cardId: CardId) => void;
  onDrawFromDeck: () => void;
  disabled?: boolean;
  highlightNameTags?: NameTag[];
}

export const BirdMarket: React.FC<BirdMarketProps> = ({
  marketCardIds,
  cardsCatalog,
  deckCount,
  onDrawMarketCard,
  onDrawFromDeck,
  disabled = false,
  highlightNameTags,
}) => {
  return (
    <div style={{ background: "#182019", padding: 16, borderRadius: 12, border: "1px solid #2b332e" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="stack" size={20} />
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Mercado de Aves</h3>
          <span style={{ fontSize: "0.85rem", color: "#93a397" }}>
            ({deckCount} cartas en el mazo)
          </span>
        </div>
        <button
          onClick={onDrawFromDeck}
          disabled={disabled || deckCount === 0}
          style={{ minHeight: 34, padding: "0 12px", fontSize: "0.85rem" }}
        >
          <Icon name="bird" size={18} /> Robar Carta Oculta del Mazo
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(264px, 1fr))", gap: 12 }}>
        {marketCardIds.map((cardId) => {
          const card = cardsCatalog[cardId];
          if (!card) return null;
          return (
            <BirdCard
              key={cardId}
              card={card}
              highlightNameTags={highlightNameTags}
              actionLabel="Robar esta ave"
              onAction={() => onDrawMarketCard(cardId)}
              mode="full"
            />
          );
        })}
      </div>
    </div>
  );
};
