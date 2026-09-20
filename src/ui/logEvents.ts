/** Tipos de entrada del registro de la partida (solo presentación: el motor guarda texto). */
export type LogKind = "power" | "hunt" | "miss" | "eggs" | "system" | "move";

export interface LogEvent {
  kind: LogKind;
  /** Nombre del ave que actuó, si el texto lo trae ("Poder de [Ave]: …"). */
  bird?: string;
  /** Texto sin el prefijo "Poder de [Ave]:" / "Depredador [Ave]:" (los [nombres] se mantienen para resaltarlos). */
  text: string;
}

/**
 * Clasifica una entrada del registro por su texto. Es una lectura de presentación (íconos y avisos),
 * no una regla del juego: si el motor cambia una frase, la entrada cae en "move" o "system".
 */
export function classifyLog(entry: { playerId?: string | null; message: string }): LogEvent {
  const { message } = entry;
  const hunt = /^Depredador \[([^\]]+)\]:\s*(.*)$/s.exec(message);
  if (hunt) {
    return { kind: /Caza fallida/.test(hunt[2]) ? "miss" : "hunt", bird: hunt[1], text: hunt[2] };
  }
  const power = /^Poder de \[([^\]]+)\]:\s*(.*)$/s.exec(message);
  if (power) return { kind: "power", bird: power[1], text: power[2] };
  if (!entry.playerId) return { kind: "system", text: message };
  if (/huevo/i.test(message)) return { kind: "eggs", text: message };
  return { kind: "move", text: message };
}
