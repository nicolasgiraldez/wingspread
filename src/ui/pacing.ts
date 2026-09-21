import type { GameSpeed } from "./gameSpeed";
import type { StepAnnouncement } from "./stepAnnouncement";

/** Pausa antes de que el rival juegue a velocidad normal: se ve que "está jugando" antes de que aparezca su acción. */
export const THINK_MS = 800;

const THINK_BY_SPEED: Record<GameSpeed, number> = { normal: THINK_MS, fast: 400, instant: 0 };

/** Pausa antes de la jugada del rival, según la velocidad. */
export const thinkMs = (speed: GameSpeed = "normal") => THINK_BY_SPEED[speed];

const HOLD_BASE_MS = 1300;
const HOLD_PER_CHAR_MS = 40;
const HOLD_MIN_MS = 1800;
const HOLD_MAX_MS = 4500;

/** Cuánto de la espera normal se respeta a cada velocidad. */
const HOLD_SCALE: Record<GameSpeed, number> = { normal: 1, fast: 0.5, instant: 0 };

/** Sin pausas, la acción no frena al rival, pero se queda un rato a la vista para poder leerla. */
const INSTANT_DISPLAY_MS = 2000;

type Readable = Pick<StepAnnouncement, "headline" | "details">;

/**
 * Cuánto se espera a que se lea la acción del rival antes de su siguiente jugada: un mínimo cómodo más
 * un poco por cada carácter (frase principal y poderes), con tope. Sin pausas es 0: no frena nada.
 */
export function holdMs(announcement: Readable, speed: GameSpeed = "normal"): number {
  const chars = announcement.details.reduce((sum, d) => sum + d.bird.length + d.text.length, announcement.headline.length);
  const normal = Math.min(HOLD_MAX_MS, Math.max(HOLD_MIN_MS, HOLD_BASE_MS + chars * HOLD_PER_CHAR_MS));
  return Math.round(normal * HOLD_SCALE[speed]);
}

/** Cuánto tiempo queda la acción del rival en pantalla: lo que se espera, o un tiempo fijo si no se espera. */
export function displayMs(announcement: Readable, speed: GameSpeed = "normal"): number {
  return speed === "instant" ? INSTANT_DISPLAY_MS : holdMs(announcement, speed);
}
