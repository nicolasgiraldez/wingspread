/** Íconos de juego (estilo "D"), de interfaz, glifos de timing sin círculo y símbolos de jugador. */
export const ICON_NAMES = [
  // Alimento
  "seed", "fruit", "insect", "fish", "rodent", "wild",
  // Nidos
  "bowl", "cavity", "platform", "ground", "nestwild",
  // Hábitats
  "forest", "grass", "river",
  // Timing de poder (con círculo) y huevo
  "activate", "between", "play", "egg",
  // Timing de poder sin círculo (bandas de la carta)
  "glyph-activate", "glyph-between", "glyph-play",
  // Símbolo de jugador: 1.º círculo mostaza, 2.º triángulo tomate, 3.º cuadrado petróleo
  "circulo-mostaza", "triangulo-tomate", "cuadrado-petroleo",
  // Interfaz
  "alert", "back", "bird", "bot", "check", "chev", "clock", "close", "copy", "globe", "hourglass",
  "login", "minus", "plus", "plus2", "refresh", "send", "spinner", "stack", "star", "target",
  "trash", "trophy", "user", "wifi", "wifioff",
] as const;

export type IconName = (typeof ICON_NAMES)[number];
