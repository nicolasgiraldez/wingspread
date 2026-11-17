import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { NameTag, ResourceFace, SpeciesCard } from "../../game";
import { BirdCard } from "./BirdCard";

interface CardPeekProps {
  card: SpeciesCard;
  eggs?: number;
  cached?: ResourceFace[];
  tucked?: string[];
  highlightNameTags?: NameTag[];
  className?: string;
  /** El contenedor recibe foco con Tab o al tocarlo (para cartas que no tienen un botón propio). */
  focusable?: boolean;
  children: React.ReactNode;
}

// Tamaño reservado para la vista previa (carta en modo "hand"; el alto varía con el texto del poder).
const PEEK_WIDTH = 192;
const PEEK_HEIGHT = 350;
const GAP = 12;
const EDGE = 8;

/**
 * Envuelve una carta compacta y, al pasarle el puntero o el foco, muestra al lado la carta completa
 * (con el texto de sus poderes). La vista previa va en un portal con posición fija para que no la
 * recorten las columnas con scroll, y no recibe clics: es solo para leer.
 */
export const CardPeek: React.FC<CardPeekProps> = ({
  card,
  eggs,
  cached,
  tucked,
  highlightNameTags,
  className,
  focusable = false,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const fitsRight = rect.right + GAP + PEEK_WIDTH <= window.innerWidth - EDGE;
    const left = fitsRight ? rect.right + GAP : Math.max(EDGE, rect.left - GAP - PEEK_WIDTH);
    const centered = rect.top + rect.height / 2 - PEEK_HEIGHT / 2;
    const top = Math.max(EDGE, Math.min(centered, window.innerHeight - PEEK_HEIGHT - EDGE));
    setPosition({ left, top });
  };
  const hide = () => setPosition(null);

  return (
    <div
      ref={ref}
      className={`peek${className ? ` ${className}` : ""}`}
      tabIndex={focusable ? 0 : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {position &&
        createPortal(
          <div className="card-peek" style={position} aria-hidden="true">
            <BirdCard card={card} mode="hand" eggs={eggs} cached={cached} tucked={tucked} highlightNameTags={highlightNameTags} showCost />
          </div>,
          document.body,
        )}
    </div>
  );
};
