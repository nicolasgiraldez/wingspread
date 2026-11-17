import type { IconName } from "./ui/iconNames";

/**
 * Cada jugador tiene una forma y un color propios, además del nombre: 1.º círculo, 2.º triángulo,
 * 3.º cuadrado, 4.º rombo y 5.º hexágono (una partida tiene hasta 5 jugadores).
 */
const PLAYER_SYMBOLS: IconName[] = ["circulo-mostaza", "triangulo-tomate", "cuadrado-petroleo", "rombo-menta", "hexagono-pizarra"];

const SYMBOL_NAMES = ["círculo", "triángulo", "cuadrado", "rombo", "hexágono"];

/** Cantidad de símbolos (y colores de cubo) distintos. */
export const PLAYER_SYMBOL_COUNT = PLAYER_SYMBOLS.length;

export function playerSymbol(index: number): IconName {
  return PLAYER_SYMBOLS[index % PLAYER_SYMBOLS.length];
}

export function playerSymbolName(index: number): string {
  return SYMBOL_NAMES[index % SYMBOL_NAMES.length];
}
