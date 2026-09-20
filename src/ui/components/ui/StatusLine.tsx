import type { ReactNode } from "react";
import { Icon } from "./Icon";

interface StatusLineProps {
  /** Válido: ícono check (petróleo). Inválido: ícono close (tomate profundo). */
  ok: boolean;
  children: ReactNode;
  className?: string;
}

/** Línea de validación: ícono + texto, así el estado no depende solo del color. */
export function StatusLine({ ok, children, className }: StatusLineProps) {
  return (
    <span className={["status-line", ok ? "status-line--ok" : "status-line--bad", className].filter(Boolean).join(" ")}>
      <Icon name={ok ? "check" : "close"} size={18} ink={ok ? "var(--c-petroleo)" : "var(--c-tomate-d)"} />
      <span>{children}</span>
    </span>
  );
}
