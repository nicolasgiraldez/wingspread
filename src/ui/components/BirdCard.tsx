import React from "react";
import type { CSSProperties } from "react";
import type { NameTag, PowerTiming, ResourceFace, SpeciesCard } from "../../game";
import { getBirdImage } from "../birdImages";
import {
  birdCardLabel,
  costIcon,
  costText,
  describePower,
  describePowerText,
  habitatIcons,
  habitatLabels,
  nameTagBonus,
  nestIcons,
  nestLabels,
  powerTimingLabels,
  resourceIcons,
} from "../labels";
import { CARD_MODES } from "./cardModes";
import type { CardMode } from "./cardModes";
import { HabitatScene } from "./HabitatScene";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import type { IconName } from "./ui/iconNames";
import { RichText } from "./ui/RichText";

interface BirdCardProps {
  card: SpeciesCard;
  /** Tamaño y nivel de detalle: full (mercado, detalle), hand (tu mano), board (tablero) o mini (listas). */
  mode?: CardMode;
  /** Anillo mostaza: la carta está elegida. */
  selected?: boolean;
  /** Elegida y levantada 12px. */
  lifted?: boolean;
  /** Si se pasa, la carta entera es un botón (con `aria-pressed` cuando `selected` está definido). */
  onClick?: () => void;
  /** Huevos puestos (los de la capacidad se dibujan llenos o vacíos). */
  eggs?: number;
  cached?: ResourceFace[];
  tucked?: string[];
  /** Muestra el coste aunque el modo lo oculte (board y mini). */
  showCost?: boolean;
  /** Categorías de nombre de las bonificaciones que tiene el jugador: se marcan con un chip con la palabra. */
  highlightNameTags?: NameTag[];
  /** Botón de acción debajo de la carta ("Jugar esta ave", "Robar esta ave"). */
  actionLabel?: string;
  onAction?: (e: React.MouseEvent) => void;
}

const TIMING_GLYPH: Record<PowerTiming, IconName> = {
  onActivate: "glyph-activate",
  onceBetweenTurns: "glyph-between",
  onPlay: "glyph-play",
};

/** Flecha doble de la envergadura (decorativa). */
const WingspanGlyph = () => (
  <svg width="18" height="11" viewBox="0 0 18 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1.5 5.5H16.5M1.5 5.5L5 2M1.5 5.5L5 9M16.5 5.5L13 2M16.5 5.5L13 9" />
  </svg>
);

/** Silueta de ave para las cartas que todavía no tienen ilustración. */
const BirdSilhouette = () => (
  <svg className="bird-card__silhouette" viewBox="0 0 100 70" aria-hidden="true" focusable="false">
    <ellipse cx="48" cy="44" rx="26" ry="17" />
    <circle cx="72" cy="24" r="10" />
    <path d="M80 22 L94 27 L80 31 Z" />
    <path d="M40 60 V69 M54 60 V69" stroke="var(--c-carbon)" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);

export const BirdCard: React.FC<BirdCardProps> = ({
  card,
  mode = "hand",
  selected,
  lifted = false,
  onClick,
  eggs = 0,
  cached = [],
  tucked = [],
  showCost,
  highlightNameTags = [],
  actionLabel,
  onAction,
}) => {
  const m = CARD_MODES[mode];
  const image = getBirdImage(card.id);
  const nameTags = card.nameTags ?? [];
  const highlighted = nameTags.filter((tag) => highlightNameTags.includes(tag));
  const costVisible = showCost ?? (mode === "full" || mode === "hand");
  const countsForTitle =
    nameTags.length > 0
      ? ["Esta ave cuenta para:", ...nameTags.map((tag) => nameTagBonus[tag].label)].join("\n")
      : undefined;
  const label = birdCardLabel(card);

  const style = {
    "--card-w": `${m.w}px`,
    "--card-h": `${m.h}px`,
    "--card-win": `${m.win}px`,
    "--card-radius": `${m.radius}px`,
    "--card-pad": `${m.pad}px`,
    "--card-name": `${m.name}px`,
    "--card-pts": `${m.ptsCircle}px`,
    "--card-pts-num": `${m.ptsNum}px`,
    "--card-hab": `${m.habTok}px`,
    "--card-off": `${m.off}px`,
    "--card-art-x": `${m.artX}px`,
    "--card-art-top": `${m.artTop}px`,
    "--card-art-bottom": `${m.artBottom}px`,
    "--card-shadow": `${m.shadow}px`,
    "--card-nopower": `${m.noPower}px`,
  } as CSSProperties;

  // Coste: un ícono por unidad; las alternativas ("A o B") van separadas por "/" y unidas al resto con "+".
  const fixedCost = Object.entries(card.cost).flatMap(([res, count]) =>
    Array.from({ length: count ?? 0 }, () => res as ResourceFace),
  );
  const alternatives = card.costAnyOf ?? [];
  const isFree = fixedCost.length === 0 && alternatives.length === 0;

  const cost = (
    <span className="bird-card__cost" title={`Coste: ${costText(card)}`}>
      {isFree ? (
        <span className="bird-card__free">Gratis</span>
      ) : (
        <>
          {fixedCost.map((res, i) => (
            <Icon key={i} name={costIcon(res)} size={m.foodTok} />
          ))}
          {fixedCost.length > 0 && alternatives.length > 0 && <span className="bird-card__plus">+</span>}
          {alternatives.map((res, i) => (
            <React.Fragment key={res}>
              {i > 0 && <span className="bird-card__plus">/</span>}
              <Icon name={resourceIcons[res]} size={m.foodTok} />
            </React.Fragment>
          ))}
        </>
      )}
    </span>
  );

  const tokens = (cached.length > 0 || tucked.length > 0) && (
    <span className="bird-card__tokens">
      {cached.length > 0 && (
        <span title={`Alimento almacenado: ${cached.length}`}>
          <Icon name={resourceIcons[cached[0]]} size={m.foodTok - 4} /> {cached.length}
        </span>
      )}
      {tucked.length > 0 && (
        <span title={`Cartas solapadas: ${tucked.length}`}>
          <Icon name="stack" size={m.foodTok - 4} /> {tucked.length}
        </span>
      )}
    </span>
  );

  const nestEggs = (
    <span className="bird-card__nest">
      {card.nestType && (
        <span title={nestLabels[card.nestType]}>
          <Icon name={nestIcons[card.nestType]} size={m.foodTok - 2} />
        </span>
      )}
      <span className="bird-card__eggs" title={`Capacidad: ${card.eggCapacity} ${card.eggCapacity === 1 ? "huevo" : "huevos"}`}>
        {Array.from({ length: card.eggCapacity }, (_, i) => (
          <Icon key={i} name="egg" size={m.egg} empty={i >= eggs} />
        ))}
      </span>
    </span>
  );

  const body = (
    <>
      <span className="bird-card__win">
        <HabitatScene habitats={card.habitats} width={m.w - 4} height={m.win - 2} />
        <span className="bird-card__art">
          {image ? (
            <img src={image} alt={card.name} loading="lazy" decoding="async" draggable={false} />
          ) : (
            <>
              <BirdSilhouette />
              {mode === "full" && (
                <span className={`bird-card__pending${card.habitats[0] !== "grassland" ? " bird-card__pending--on-dark" : ""}`}>
                  Ilustración pendiente
                </span>
              )}
            </>
          )}
        </span>
        <span className="bird-card__points" title="Puntos de victoria">
          {card.points}
        </span>
        <span className="bird-card__habitats">
          {card.habitats.map((hab) => (
            <span key={hab} className="bird-card__habitat" role="img" aria-label={habitatLabels[hab]} title={`Hábitat: ${habitatLabels[hab]}`}>
              <Icon name={habitatIcons[hab]} size={Math.round(m.habTok * 0.6)} />
            </span>
          ))}
        </span>
        {highlighted.length > 0 && (
          <span className="bird-card__bonus">
            {highlighted.map((tag) => (
              <span key={tag} className="card-bonus-mark" title={`Cuenta para tu bonificación: ${nameTagBonus[tag].label}`}>
                {nameTagBonus[tag].label}
              </span>
            ))}
          </span>
        )}
      </span>

      <span className="bird-card__head">
        <span className="bird-card__name" title={countsForTitle}>
          {card.name}
        </span>
        {mode === "full" && (card.scientificName || card.wingspanCm) && (
          <span className="bird-card__meta">
            <span className="bird-card__sci">{card.scientificName}</span>
            {card.wingspanCm && (
              <span className="bird-card__span" title="Envergadura">
                <WingspanGlyph /> {card.wingspanCm} cm
              </span>
            )}
          </span>
        )}
      </span>

      <span className="bird-card__stats">
        {costVisible ? cost : tokens || <span />}
        {costVisible && tokens}
        {nestEggs}
      </span>

      <span className="bird-card__powers">
        {card.powers.length === 0 ? (
          <span className="bird-card__power bird-card__power--none">Sin poder</span>
        ) : (
          card.powers.map((p) => (
            <span key={p.id} className={`bird-card__power bird-card__power--${p.timing}`} title={describePowerText(p)}>
              <span className="bird-card__timing">
                <Icon
                  name={TIMING_GLYPH[p.timing]}
                  size={mode === "full" ? 20 : mode === "hand" ? 18 : 16}
                  ink={p.timing === "onActivate" ? "var(--c-crema)" : undefined}
                />
                {mode !== "mini" && <span>{powerTimingLabels[p.timing]}</span>}
              </span>
              {(mode === "full" || mode === "hand") && (
                <span className="bird-card__power-text">
                  <RichText
                    text={describePower(p)}
                    size={mode === "full" ? 16 : 15}
                    ink={p.timing === "onActivate" ? "var(--c-crema)" : undefined}
                  />
                </span>
              )}
            </span>
          ))
        )}
      </span>
    </>
  );

  const classes = [
    "bird-card",
    `bird-card--${mode}`,
    onClick && "bird-card--interactive",
    selected && "is-selected",
    lifted && "is-lifted",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="bird-card-wrap" style={{ width: m.w }}>
      {onClick ? (
        <button type="button" className={classes} style={style} aria-label={label} aria-pressed={selected} onClick={onClick}>
          {body}
        </button>
      ) : (
        <div className={classes} style={style} role="group" aria-label={label}>
          {body}
        </div>
      )}
      {actionLabel && onAction && (
        <Button size="sm" className="bird-card__action" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
