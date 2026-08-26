import React from "react";
import { Feather, Sparkles } from "lucide-react";
import type { CardId, SpeciesCard } from "../../game";
import { BirdCard } from "./BirdCard";

interface BirdMarketProps {
  marketCardIds: CardId[];
  cardsCatalog: Record<CardId, SpeciesCard>;
  deckCount: number;
  onDrawMarketCard: (cardId: CardId) => void;
  onDrawFromDeck: () => void;
  disabled?: boolean;
}

export const BirdMarket: React.FC<BirdMarketProps> = ({
  marketCardIds,
  cardsCatalog,
  deckCount,
  onDrawMarketCard,
  onDrawFromDeck,
  disabled = false,
}) => {
  return (
    <div style={{ background: "#ffffff", padding: 16, borderRadius: 12, border: "1px solid #d2ded0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={18} color="#2f7d5b" />
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Mercado de Aves</h3>
          <span style={{ fontSize: "0.85rem", color: "#667" }}>
            ({deckCount} cartas en el mazo)
          </span>
        </div>
        <button
          onClick={onDrawFromDeck}
          disabled={disabled || deckCount === 0}
          style={{ minHeight: 34, padding: "0 12px", fontSize: "0.85rem" }}
        >
          <Feather size={14} /> Robar Carta Oculta del Mazo
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {marketCardIds.map((cardId) => {
          const card = cardsCatalog[cardId];
          if (!card) return null;
          return (
            <BirdCard
              key={cardId}
              card={card}
              actionLabel="Robar esta ave"
              onAction={() => onDrawMarketCard(cardId)}
              compact
            />
          );
        })}
      </div>
    </div>
  );
};
