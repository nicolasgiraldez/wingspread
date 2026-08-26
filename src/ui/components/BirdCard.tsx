import React from "react";
import { Egg, Feather, Layers, Sparkles } from "lucide-react";
import type { ResourceFace, SpeciesCard } from "../../game";
import {
  habitatIcons,
  habitatLabels,
  nestIcons,
  nestLabels,
  powerTimingLabels,
  resourceIcons,
} from "../labels";

interface BirdCardProps {
  card: SpeciesCard;
  isSelected?: boolean;
  onClick?: () => void;
  eggs?: number;
  cached?: ResourceFace[];
  tucked?: string[];
  actionLabel?: string;
  onAction?: (e: React.MouseEvent) => void;
  compact?: boolean;
}

export const BirdCard: React.FC<BirdCardProps> = ({
  card,
  isSelected,
  onClick,
  eggs = 0,
  cached = [],
  tucked = [],
  actionLabel,
  onAction,
  compact = false,
}) => {
  return (
    <div
      className={`bird-card-wrapper ${isSelected ? "selected" : ""}`}
      onClick={onClick}
      style={{
        padding: compact ? 8 : 12,
        minHeight: compact ? 130 : 170,
      }}
    >
      {/* Top Bar: Habitats & Points & Nest & Wingspan */}
      <div className="card-top-bar">
        {/* Habitats with Icons */}
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          {card.habitats.map((hab) => (
            <span
              key={hab}
              title={`Hábitat: ${habitatLabels[hab]}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                fontSize: "0.75rem",
                padding: "2px 5px",
                borderRadius: 4,
                fontWeight: 700,
                backgroundColor:
                  hab === "forest"
                    ? "#eaf4ed"
                    : hab === "grassland"
                      ? "#fbf5e6"
                      : "#e9f3f9",
                color:
                  hab === "forest"
                    ? "#235c3a"
                    : hab === "grassland"
                      ? "#9c6c16"
                      : "#1d618a",
                border: `1px solid ${
                  hab === "forest"
                    ? "#b8dbc0"
                    : hab === "grassland"
                      ? "#ebdcb2"
                      : "#bddbf0"
                }`,
              }}
            >
              <span>{habitatIcons[hab]}</span>
              {!compact && <span style={{ fontSize: "0.68rem" }}>{habitatLabels[hab]}</span>}
            </span>
          ))}
        </div>

        {/* Nest, Wingspan and Victory Points */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {card.nestType && (
            <span title={nestLabels[card.nestType] ?? card.nestType} style={{ fontSize: "0.85rem" }}>
              {nestIcons[card.nestType] ?? "🪺"}
            </span>
          )}
          {card.wingspanCm && (
            <span style={{ fontSize: "0.7rem", color: "#667" }} title="Envergadura">
              {card.wingspanCm}cm
            </span>
          )}
          <div className="points-badge" title="Puntos de victoria">
            <Feather size={12} /> {card.points}
          </div>
        </div>
      </div>

      {/* Card Names */}
      <div>
        <h4 className="card-title">{card.name}</h4>
        {card.scientificName && !compact && (
          <div className="card-scientific">{card.scientificName}</div>
        )}
      </div>

      {/* Food Cost */}
      <div className="card-cost-row">
        {Object.entries(card.cost).length > 0 ? (
          Object.entries(card.cost).map(([res, count]) => (
            <span key={res} className="cost-pill">
              {count} {resourceIcons[res as ResourceFace] ?? res}
            </span>
          ))
        ) : (
          <span className="cost-pill" style={{ color: "#2f7d5b" }}>Gratis</span>
        )}
      </div>

      {/* Powers Box */}
      {card.powers.length > 0 && (
        <div className="card-power-box">
          {card.powers.map((p) => (
            <div key={p.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <strong style={{ fontSize: "0.7rem", textTransform: "uppercase" }}>
                [{powerTimingLabels[p.timing] ?? p.timing}]
              </strong>
              <span>
                {p.kind === "gainResource" && `Obtén ${p.amount} ${p.resource ? resourceIcons[p.resource] : "alimento"}`}
                {p.kind === "layEgg" && `Pon ${p.amount} huevo(s) en ${p.target === "self" ? "este nido" : "cualquier ave"}`}
                {p.kind === "drawCard" && `Roba ${p.amount} carta(s)${p.thenDiscard ? " y descarta 1" : ""}`}
                {p.kind === "tuckCard" && `Solapa 1 carta${p.source === "deck" ? " del mazo" : " de tu mano"}${p.thenDraw ? " y roba 1" : ""}`}
                {p.kind === "cacheFood" && `Almacena 1 ${p.resource ? resourceIcons[p.resource] : "semilla"} en esta carta`}
                {p.kind === "huntPredator" && `Caza: si envergadura mazo ≤ ${p.maxWingspanCm}cm, solapa como presa`}
                {p.kind === "allPlayersGain" && `Todos obtienen 1 ${p.resource ? resourceIcons[p.resource] : "recurso"}`}
                {p.kind === "tradeResource" && `Cambia 1 ${resourceIcons[p.costResource]} por 1 ${resourceIcons[p.gainResource]}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tokens Bar (if on board) */}
      {(eggs > 0 || cached.length > 0 || tucked.length > 0 || card.eggCapacity > 0) && (
        <div className="card-tokens-bar">
          <span title={`Capacidad de nido: ${card.eggCapacity}`}>
            <Egg size={12} style={{ verticalAlign: "middle" }} /> {eggs}/{card.eggCapacity}
          </span>
          {cached.length > 0 && (
            <span title="Alimento almacenado">
              🌾 {cached.length}
            </span>
          )}
          {tucked.length > 0 && (
            <span title="Cartas solapadas">
              <Layers size={12} style={{ verticalAlign: "middle" }} /> {tucked.length}
            </span>
          )}
        </div>
      )}

      {/* Action button if provided */}
      {actionLabel && onAction && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction(e);
          }}
          style={{
            marginTop: 6,
            minHeight: 28,
            padding: "2px 8px",
            fontSize: "0.75rem",
            justifyContent: "center",
            width: "100%",
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
