import { createContext, useContext } from "react";

/** Qué tan rápido va la partida: cuánto espera el rival y cuánto duran las animaciones. */
export type GameSpeed = "normal" | "fast" | "instant";

export const SPEED_OPTIONS: { id: GameSpeed; label: string; hint: string }[] = [
  { id: "normal", label: "Normal", hint: "El rival espera un momento y deja ver cada jugada." },
  { id: "fast", label: "Rápida", hint: "Pausas y animaciones más cortas." },
  { id: "instant", label: "Sin pausas", hint: "El rival juega sin esperar; su última jugada queda a la vista." },
];

const STORAGE_KEY = "wingspread.speed.v1";

/** La velocidad guardada en este navegador; "normal" si no hay (o si el almacenamiento está bloqueado). */
export function loadSpeed(): GameSpeed {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SPEED_OPTIONS.some((option) => option.id === stored) ? (stored as GameSpeed) : "normal";
  } catch {
    return "normal";
  }
}

/** Guarda la velocidad elegida. Si no se puede (modo privado, lleno), simplemente no se recuerda. */
export function saveSpeed(speed: GameSpeed) {
  try {
    localStorage.setItem(STORAGE_KEY, speed);
  } catch {
    // Sin almacenamiento: la elección vale para esta sesión.
  }
}

/** La velocidad de la partida en curso, para los componentes que animan por su cuenta (como el marcador). */
export const GameSpeedContext = createContext<GameSpeed>("normal");

export function useGameSpeed(): GameSpeed {
  return useContext(GameSpeedContext);
}
