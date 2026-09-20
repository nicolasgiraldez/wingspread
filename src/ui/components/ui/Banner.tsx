import type { ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./iconNames";

export type BannerTone = "error" | "warn" | "info" | "ok";

const DEFAULT_ICON: Record<BannerTone, IconName> = {
  error: "alert",
  warn: "clock",
  info: "wifi",
  ok: "check",
};

interface BannerProps {
  tone: BannerTone;
  /** Título en carbón (nunca en tomate: no llega al contraste sobre el fondo de error). */
  title?: string;
  icon?: IconName;
  children?: ReactNode;
  /** Acción opcional a la derecha (p. ej. "Reintentar"). */
  action?: ReactNode;
  className?: string;
}

/** Aviso en línea. Error usa `role="alert"`; el resto `role="status"`. Siempre ícono + texto, no solo color. */
export function Banner({ tone, title, icon, children, action, className }: BannerProps) {
  return (
    <div
      className={["banner", `banner--${tone}`, className].filter(Boolean).join(" ")}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon name={icon ?? DEFAULT_ICON[tone]} size={22} className={icon === "spinner" ? "spin" : undefined} />
      <div className="banner__body">
        {title && <div className="banner__title">{title}</div>}
        {children && <div className="banner__text">{children}</div>}
      </div>
      {action && <div className="banner__action">{action}</div>}
    </div>
  );
}
