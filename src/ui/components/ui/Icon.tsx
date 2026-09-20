import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { IconName } from "./iconNames";

// Los SVG de src/ui/assets/icons se leen como texto y se dibujan en línea: así el contorno toma el
// color del texto (`ink`) y el ícono se dimensiona desde acá, sin depender del width/height del archivo.
const files = import.meta.glob("../../assets/icons/**/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const ICONS: Record<string, string> = {};
for (const [file, svg] of Object.entries(files)) {
  const match = /icons\/(?:(glyph|players|ui)\/)?([^/]+)\.svg$/.exec(file);
  if (match) ICONS[match[1] === "glyph" ? `glyph-${match[2]}` : match[2]] = svg;
}

const escapeAttr = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function renderSvg(name: IconName, size: number, label: string | true | undefined): string {
  const raw = ICONS[name] ?? "";
  return raw.replace(/^<svg\b([^>]*)>/, (_all, attrs: string) => {
    const ownLabel = /aria-label="([^"]*)"/.exec(attrs)?.[1];
    const accessible = label === true ? ownLabel : label;
    const cleaned = attrs.replace(/\s(?:width|height|role|aria-label|aria-hidden|focusable)="[^"]*"/g, "");
    const a11y = accessible
      ? ` role="img" aria-label="${escapeAttr(accessible)}"`
      : ' aria-hidden="true" focusable="false"';
    return `<svg${cleaned} width="${size}" height="${size}"${a11y}>`;
  });
}

interface IconProps {
  name: IconName;
  size?: number;
  /** Color del contorno (cualquier valor CSS, p. ej. "var(--c-crema)"). Por defecto, carbón. */
  ink?: string;
  /** Nombre accesible. `true` usa el del archivo. Sin `label` el ícono es decorativo (aria-hidden). */
  label?: string | true;
  /** Solo para "egg": huevo vacío (relleno crema-2) en vez de puesto. */
  empty?: boolean;
  className?: string;
}

export function Icon({ name, size = 24, ink, label, empty = false, className }: IconProps) {
  const html = useMemo(() => renderSvg(name, size, label), [name, size, label]);
  const style = {
    display: "inline-flex",
    flexShrink: 0,
    lineHeight: 0,
    color: ink ?? "var(--c-carbon)",
    ...(empty ? { "--egg-fill": "var(--c-crema-2)" } : null),
  } as CSSProperties;
  return <span className={className ? `icon ${className}` : "icon"} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
