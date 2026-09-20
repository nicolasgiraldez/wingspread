import type { IconName } from "./ui/iconNames";

/** Cada jugador tiene una forma y un color propios, además del nombre: 1.º círculo, 2.º triángulo, 3.º cuadrado. */
const PLAYER_SYMBOLS: IconName[] = ["circulo-mostaza", "triangulo-tomate", "cuadrado-petroleo"];

const SYMBOL_NAMES = ["círculo", "triángulo", "cuadrado"];

export function playerSymbol(index: number): IconName {
  return PLAYER_SYMBOLS[index % PLAYER_SYMBOLS.length];
}

export function playerSymbolName(index: number): string {
  return SYMBOL_NAMES[index % SYMBOL_NAMES.length];
}
