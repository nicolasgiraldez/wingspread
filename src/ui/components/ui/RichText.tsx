import { Icon } from "./Icon";
import { ICON_MARKER, markerIcon } from "./richTextParts";

interface RichTextProps {
  text: string;
  /** Tamaño de los íconos: el del texto + 2–4px. */
  size?: number;
  /** Color del contorno de los íconos (crema sobre la banda marrón, carbón en el resto). */
  ink?: string;
}

/** Texto con marcadores `{seed}` que se dibujan como ícono en línea (con nombre accesible). */
export function RichText({ text, size = 16, ink }: RichTextProps) {
  return (
    <>
      {text.split(ICON_MARKER).map((part, i) => {
        const icon = markerIcon(part);
        if (!icon) return part;
        return (
          <span key={i} style={{ display: "inline-block", verticalAlign: `-${Math.round(size * 0.28)}px` }}>
            <Icon name={icon} size={size} ink={ink} label />
          </span>
        );
      })}
    </>
  );
}
