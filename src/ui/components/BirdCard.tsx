import React from "react";
import type { NameTag, ResourceFace, SpeciesCard } from "../../game";
import { getBirdImage } from "../birdImages";
import { Icon } from "./ui/Icon";
import { RichText } from "./ui/RichText";
import {
  costIcon,
  costLabel,
  describePower,
  describePowerText,
  habitatIcons,
  habitatLabels,
  nameTagBonus,
  nestIcons,
  nestLabels,
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
  /** Categorías de nombre de las bonificaciones que tiene el jugador: se marcan con un icono discreto. */
  highlightNameTags?: NameTag[];
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
  highlightNameTags = [],
}) => {
  const nameTags = card.nameTags ?? [];
  const image = getBirdImage(card.id);
  const highlighted = nameTags.filter((tag) => highlightNameTags.includes(tag));
  const countsForTitle =
    nameTags.length > 0
      ? ["Esta ave cuenta para:", ...nameTags.map((tag) => nameTagBonus[tag].label)].join("\n")
      : undefined;

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
        <div style={{ display: "flex", gap: 3, alignItems: "center", flexWrap: "wrap" }}>
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
                    ? "rgba(63, 174, 114, 0.14)"
                    : hab === "grassland"
                      ? "rgba(217, 168, 59, 0.14)"
                      : "rgba(79, 168, 224, 0.14)",
                color:
                  hab === "forest"
                    ? "#3fae72"
                    : hab === "grassland"
                      ? "#d9a83b"
                      : "#4fa8e0",
                border: `1px solid ${
                  hab === "forest"
                    ? "rgba(63, 174, 114, 0.35)"
                    : hab === "grassland"
                      ? "rgba(217, 168, 59, 0.35)"
                      : "rgba(79, 168, 224, 0.35)"
                }`,
              }}
            >
              <Icon name={habitatIcons[hab]} size={16} />
              {!compact && <span style={{ fontSize: "0.68rem" }}>{habitatLabels[hab]}</span>}
            </span>
          ))}
        </div>

        {/* Nest, Wingspan and Victory Points */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {card.nestType && (
            <span title={nestLabels[card.nestType] ?? card.nestType} style={{ fontSize: "0.85rem" }}>
              <Icon name={nestIcons[card.nestType]} size={20} />
            </span>
          )}
          {card.wingspanCm && (
            <span style={{ fontSize: "0.7rem", color: "#93a397" }} title="Envergadura">
              {card.wingspanCm}cm
            </span>
          )}
          <div className="points-badge" title="Puntos de victoria">
            <Icon name="bird" size={16} /> {card.points}
          </div>
        </div>
      </div>

      {/* Ilustración (o marcador si todavía no hay arte) */}
      <div className={`card-art ${compact ? "compact" : ""}`}>
        {image ? (
          <img src={image} alt="" loading="lazy" decoding="async" draggable={false} />
        ) : (
          <span className="card-art-placeholder">
            <Icon name="bird" size={compact ? 24 : 32} />
          </span>
        )}
      </div>

      {/* Card Names */}
      <div>
        <h4 className="card-title" title={countsForTitle}>
          {card.name}
          {highlighted.map((tag) => (
            <span key={tag} className="card-bonus-mark" title={`Cuenta para tu bonificación: ${nameTagBonus[tag].label}`}>
              {nameTagBonus[tag].label}
            </span>
          ))}
        </h4>
        {card.scientificName && !compact && (
          <div className="card-scientific">{card.scientificName}</div>
        )}
      </div>

      {/* Food Cost */}
      <div className="card-cost-row">
        {Object.entries(card.cost).length > 0 || (card.costAnyOf && card.costAnyOf.length > 0) ? (
          <>
            {Object.entries(card.cost).map(([res, count]) => (
              <span key={res} className="cost-pill" title={costLabel(res as ResourceFace)}>
                {count} <Icon name={costIcon(res as ResourceFace)} size={16} />
              </span>
            ))}
            {card.costAnyOf && card.costAnyOf.length > 0 && (
              <span className="cost-pill" title="Pagá 1 usando cualquiera de estos tipos">
                1 {card.costAnyOf.map((res, i) => (
                  <React.Fragment key={res}>
                    {i > 0 && "/"}
                    <Icon name={resourceIcons[res]} size={16} />
                  </React.Fragment>
                ))}
              </span>
            )}
          </>
        ) : (
          <span className="cost-pill" style={{ color: "#4ade95" }}>Gratis</span>
        )}
      </div>

      {/* Powers Box */}
      {card.powers.length > 0 && (
        <div className="card-powers-container">
          {card.powers.map((p) => (
            <div key={p.id} className={`card-power-item power-timing-${p.timing}`}>
              <span className={`power-timing-badge badge-${p.timing}`}>
                {p.timing === "onActivate" && "Al activar"}
                {p.timing === "onPlay" && "Al jugar"}
                {p.timing === "onceBetweenTurns" && "Entre turnos"}
              </span>
              <span className="power-description-text" title={describePowerText(p)}>
                <RichText text={describePower(p)} size={16} />
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tokens Bar (if on board) */}
      {(eggs > 0 || cached.length > 0 || tucked.length > 0 || card.eggCapacity > 0) && (
        <div className="card-tokens-bar">
          <span title={`Capacidad de nido: ${card.eggCapacity}`}>
            <Icon name="egg" size={16} /> {eggs}/{card.eggCapacity}
          </span>
          {cached.length > 0 && (
            <span title="Alimento almacenado">
              <Icon name="seed" size={14} /> {cached.length}
            </span>
          )}
          {tucked.length > 0 && (
            <span title="Cartas solapadas">
              <Icon name="stack" size={16} /> {tucked.length}
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
