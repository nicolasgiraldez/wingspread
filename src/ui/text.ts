/** "1 carta" / "2 cartas": el singular solo cuando n es exactamente 1. */
export function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}

/** "1 huevo" / "2 huevos". */
export function countOf(n: number, singular: string, pluralForm: string): string {
  return `${n} ${plural(n, singular, pluralForm)}`;
}

/** Pantalla táctil (puntero grueso): ahí se dice "Tocá" en lugar de "Hacé clic en". */
export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

/** Verbo para invitar a apretar algo: "Hacé clic en" en escritorio, "Tocá" en pantallas táctiles. */
export function pressVerb(): string {
  return isTouchDevice() ? "Tocá" : "Hacé clic en";
}
