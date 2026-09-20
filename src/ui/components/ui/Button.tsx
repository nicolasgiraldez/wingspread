import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./iconNames";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  variant?: "primary" | "secondary" | "panel";
  size?: "lg" | "md" | "sm";
  icon?: IconName;
  /** Botón de solo ícono (44×44): `aria-label` y `title` son obligatorios. */
  iconOnly?: boolean;
  disabled?: boolean;
  /** Motivo visible del deshabilitado: reemplaza al texto del botón ("Sin alimento suficiente"). */
  disabledText?: string;
  busy?: boolean;
}

/**
 * Botón del sistema. Deshabilitado usa `aria-disabled` (queda enfocable y se lee el motivo) y bloquea
 * el clic; nunca es un gris mudo: si hay `disabledText`, es el propio texto del botón.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconOnly = false,
  disabled = false,
  disabledText,
  busy = false,
  className,
  children,
  onClick,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = ["btn", `btn--${variant}`, size !== "md" && `btn--${size}`, iconOnly && "btn--icon", className]
    .filter(Boolean)
    .join(" ");
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled || busy) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    <button
      {...rest}
      type={type}
      className={classes}
      aria-disabled={disabled || undefined}
      aria-busy={busy || undefined}
      onClick={handleClick}
    >
      {busy ? <Icon name="spinner" size={18} className="spin" /> : icon && <Icon name={icon} size={iconOnly ? 24 : 18} />}
      {iconOnly ? null : disabled && disabledText ? disabledText : children}
    </button>
  );
}
