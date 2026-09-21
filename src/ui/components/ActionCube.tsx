import React from "react";

interface ActionCubeProps {
  /** Índice del jugador dueño del cubo: define su color (mostaza, tomate, petróleo), como su símbolo. */
  owner: number;
  /** Gastado: cubo vacío con contorno punteado (no depende del color). */
  spent?: boolean;
  size?: number;
}

/** Cubo isométrico de tres caras (arriba clara, izquierda base, derecha oscura). Decorativo: el texto dice cuántos quedan. */
export const ActionCube: React.FC<ActionCubeProps> = ({ owner, spent = false, size = 24 }) => (
  <svg
    className={`cube cube--${owner % 3}${spent ? " cube--spent" : ""}`}
    width={size}
    height={Math.round((size * 26) / 24)}
    viewBox="0 0 24 26"
    aria-hidden="true"
    focusable="false"
  >
    <polygon className="cube__face cube__left" points="2,7 12,12.5 12,24.5 2,19" />
    <polygon className="cube__face cube__right" points="12,12.5 22,7 22,19 12,24.5" />
    <polygon className="cube__face cube__top" points="12,1.5 22,7 12,12.5 2,7" />
  </svg>
);
