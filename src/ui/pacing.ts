import type { StepAnnouncement } from "./stepAnnouncement";

/** Pausa antes de que el rival juegue: se ve que "está jugando" antes de que aparezca su acción. */
export const THINK_MS = 800;

const HOLD_BASE_MS = 1300;
const HOLD_PER_CHAR_MS = 40;
const HOLD_MIN_MS = 1800;
const HOLD_MAX_MS = 4500;

/**
 * Cuánto se deja a la vista la acción del rival: un mínimo cómodo más un poco por cada carácter a
 * leer (frase principal y poderes), con tope. La siguiente jugada del rival espera a que termine.
 */
export function holdMs(announcement: Pick<StepAnnouncement, "headline" | "details">): number {
  const chars = announcement.details.reduce((sum, d) => sum + d.bird.length + d.text.length, announcement.headline.length);
  return Math.min(HOLD_MAX_MS, Math.max(HOLD_MIN_MS, HOLD_BASE_MS + chars * HOLD_PER_CHAR_MS));
}
