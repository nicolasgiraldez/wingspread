import React from "react";
import logoUrl from "../assets/logo.svg";

interface CardBackProps {
  width?: number;
  height?: number;
  /** Texto del recuadro inferior (p. ej. "96 cartas"). */
  label?: string;
  /** Apila 2 cartas detrás, como un mazo. */
  stack?: boolean;
  title?: string;
}

/** Dorso de carta: mazo del mercado y cartas ocultas en la mano del rival. Es decorativo (aria-hidden). */
export const CardBack: React.FC<CardBackProps> = ({ width = 114, height = 160, label, stack = false, title }) => (
  <div className={`card-back${stack ? " card-back--stack" : ""}`} style={{ width, height }} title={title} aria-hidden="true">
    <span className="card-back__seal">
      <img src={logoUrl} alt="" width={Math.round(width * 0.4)} height={Math.round(width * 0.4)} />
    </span>
    {label && <span className="chip card-back__label">{label}</span>}
  </div>
);
