import { ICON_NAMES } from "./iconNames";
import type { IconName } from "./iconNames";

/** Marcador de ícono dentro de un texto: `{seed}`, `{fruit}`… (ver RichText). */
export const ICON_MARKER = /(\{[a-z0-9-]+\})/g;

export function markerIcon(part: string): IconName | null {
  const name = /^\{([a-z0-9-]+)\}$/.exec(part)?.[1];
  return name && (ICON_NAMES as readonly string[]).includes(name) ? (name as IconName) : null;
}

/** Texto de un poder sin marcadores, con el nombre de cada ícono en palabras (para title / aria-label). */
export function plainText(text: string, names: Partial<Record<IconName, string>>): string {
  return text.replace(ICON_MARKER, (part) => {
    const icon = markerIcon(part);
    return icon ? (names[icon] ?? icon) : part;
  });
}
