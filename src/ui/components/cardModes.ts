export type CardMode = "full" | "hand" | "board" | "mini";

/** Medidas de cada modo de carta (docs/design/03-cards.md). Todo en px. */
export interface CardMetrics {
  w: number;
  h: number;
  /** Alto de la ventana con la escena y el ave. */
  win: number;
  radius: number;
  pad: number;
  name: number;
  ptsCircle: number;
  ptsNum: number;
  habTok: number;
  foodTok: number;
  /** Tamaño del ícono de huevo. */
  egg: number;
  /** Separación de la insignia y las fichas respecto del borde de la ventana. */
  off: number;
  /** Sombra plana del ave. */
  shadow: number;
  /** Márgenes internos de la ilustración: izquierda/derecha, arriba, abajo. */
  artX: number;
  artTop: number;
  artBottom: number;
  /** Alto de la banda de "Sin poder". */
  noPower: number;
}

export const CARD_MODES: Record<CardMode, CardMetrics> = {
  full: { w: 264, h: 400, win: 196, radius: 16, pad: 14, name: 24, ptsCircle: 46, ptsNum: 26, habTok: 32, foodTok: 26, egg: 20, off: 10, shadow: 4, artX: 16, artTop: 16, artBottom: 6, noPower: 52 },
  hand: { w: 192, h: 290, win: 146, radius: 14, pad: 10, name: 17, ptsCircle: 36, ptsNum: 20, habTok: 26, foodTok: 20, egg: 17, off: 8, shadow: 3, artX: 10, artTop: 12, artBottom: 4, noPower: 40 },
  board: { w: 132, h: 200, win: 108, radius: 12, pad: 8, name: 14, ptsCircle: 28, ptsNum: 16, habTok: 22, foodTok: 18, egg: 14, off: 6, shadow: 2, artX: 6, artTop: 8, artBottom: 3, noPower: 24 },
  mini: { w: 114, h: 160, win: 80, radius: 10, pad: 6, name: 13, ptsCircle: 24, ptsNum: 14, habTok: 20, foodTok: 16, egg: 13, off: 5, shadow: 2, artX: 4, artTop: 6, artBottom: 2, noPower: 20 },
};
