import type { ReactNode } from "react";

interface ChipProps {
  children: ReactNode;
  /** Activo = fondo mostaza. */
  on?: boolean;
  className?: string;
  title?: string;
}

/** Píldora informativa (28px). Para chips que se tocan usá FilterChip. */
export function Chip({ children, on = false, className, title }: ChipProps) {
  return (
    <span className={["chip", on && "chip--on", className].filter(Boolean).join(" ")} title={title}>
      {children}
    </span>
  );
}

interface FilterChipProps {
  children: ReactNode;
  pressed: boolean;
  onClick: () => void;
}

/** Chip filtro: botón de 44px con `aria-pressed`. */
export function FilterChip({ children, pressed, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      className={["chip", "chip--filter", pressed && "chip--on"].filter(Boolean).join(" ")}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
