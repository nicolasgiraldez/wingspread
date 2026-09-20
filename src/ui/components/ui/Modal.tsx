import { useEffect, useId, useRef } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { Button } from "./Button";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Ficha de ícono opcional (56×56) a la izquierda del título. */
  icon?: ReactNode;
  /** Sin `onClose` el modal es obligatorio: no hay botón de cerrar ni cierra con Esc. */
  onClose?: () => void;
  /** Ancho en escritorio (px); en móvil ocupa el ancho de la pantalla menos el margen. */
  width?: number;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * Carcasa de todos los modales: `role="dialog"`, `aria-modal`, foco atrapado, Esc (salvo los
 * obligatorios) y foco de vuelta al disparador al cerrarse.
 */
export function Modal({ title, subtitle, icon, onClose, width = 900, footer, className, children }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Foco inicial: lo marcado con data-autofocus o el primer control útil del cuerpo; si no hay, el diálogo.
    const first =
      dialog?.querySelector<HTMLElement>("[data-autofocus]") ??
      dialog?.querySelector<HTMLElement>(".modal__body button:not([disabled]), .modal__body input:not([disabled]), .modal__body select:not([disabled])");
    (first ?? dialog)?.focus({ preventScroll: true });
    return () => opener?.focus?.({ preventScroll: true });
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && onCloseRef.current) {
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const firstEl = focusable[0];
    const lastEl = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === firstEl || active === dialogRef.current)) {
      event.preventDefault();
      lastEl.focus();
    } else if (!event.shiftKey && active === lastEl) {
      event.preventDefault();
      firstEl.focus();
    }
  };

  return (
    <>
      <div className="scrim" aria-hidden="true" />
      <div
        ref={dialogRef}
        className={className ? `modal ${className}` : "modal"}
        style={{ "--modal-w": `${width}px` } as CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="modal__head">
          <div className="modal__heading">
            {icon && <div className="modal__icon">{icon}</div>}
            <div>
              <h2 id={titleId} className="modal__title">
                {title}
              </h2>
              {subtitle && <p className="modal__subtitle">{subtitle}</p>}
            </div>
          </div>
          {onClose && <Button iconOnly icon="close" aria-label="Cerrar" title="Cerrar" onClick={onClose} />}
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </>
  );
}
