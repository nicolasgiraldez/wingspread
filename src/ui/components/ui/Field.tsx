import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./iconNames";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  icon?: IconName;
  hint?: ReactNode;
  error?: ReactNode;
}

/** Campo de texto con etiqueta visible, ayuda y error enlazados (`aria-describedby`, `aria-invalid`). */
export function Field({ label, icon, hint, error, className, ...input }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className ? `field ${className}` : "field"}>
      <label htmlFor={id} className="label field__label">
        {icon && <Icon name={icon} size={16} />}
        {label}
      </label>
      <input
        {...input}
        id={id}
        className="field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && (
        <div id={hintId} className="field__hint">
          {hint}
        </div>
      )}
      {error && (
        <div id={errorId} className="field__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
