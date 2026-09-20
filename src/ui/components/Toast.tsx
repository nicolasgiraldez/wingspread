import React, { useEffect } from "react";
import logoUrl from "../assets/logo.svg";
import { useMediaQuery } from "../useMediaQuery";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import type { IconName } from "./ui/iconNames";

export type ToastKind = "turn" | "pow" | "hunt" | "miss" | "round" | "err";

export interface ToastData {
  id: number;
  kind: ToastKind;
  title: string;
  /** Mensaje: los [nombres] de aves se resaltan en negrita. */
  text?: React.ReactNode;
  /** Solo los errores traen acción (p. ej. "Reintentar"). */
  action?: { label: string; onClick: () => void };
}

const AUTO_CLOSE_MS = 5000;

const KIND_ICON: Record<Exclude<ToastKind, "round">, IconName> = {
  turn: "clock",
  pow: "bird",
  hunt: "target",
  miss: "close",
  err: "alert",
};

const ToastItem: React.FC<{ toast: ToastData; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  const persistent = toast.kind === "err";

  // Se cierran solos a los 5 s; los errores no.
  useEffect(() => {
    if (persistent) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [persistent, toast.id, onDismiss]);

  return (
    <div className={`toast toast--${toast.kind}`} role={persistent ? "alert" : "status"}>
      <span className="toast__tile" aria-hidden="true">
        {toast.kind === "round" ? (
          <img src={logoUrl} alt="" width={22} height={22} />
        ) : (
          <Icon name={KIND_ICON[toast.kind]} size={22} ink={toast.kind === "err" ? "var(--c-tomate-d)" : undefined} />
        )}
      </span>
      <div className="toast__body">
        <div className="toast__title">{toast.title}</div>
        {toast.text && <div className="toast__text">{toast.text}</div>}
        {toast.action && (
          <Button size="sm" className="toast__action" onClick={toast.action.onClick}>
            {toast.action.label}
          </Button>
        )}
      </div>
      <Button
        iconOnly
        icon="close"
        className="toast__close"
        aria-label="Cerrar aviso"
        title="Cerrar aviso"
        onClick={() => onDismiss(toast.id)}
      />
      {!persistent && <span className="toast__bar" aria-hidden="true" />}
    </div>
  );
};

interface ToastRegionProps {
  /** El más nuevo primero. */
  toasts: ToastData[];
  onDismiss: (id: number) => void;
}

/** Pila de avisos efímeros: 3 visibles en escritorio, 2 en móvil. No roban el foco. */
export const ToastRegion: React.FC<ToastRegionProps> = ({ toasts, onDismiss }) => {
  const narrow = useMediaQuery("(max-width: 640px)");
  const visible = toasts.slice(0, narrow ? 2 : 3);
  return (
    <div className="toast-region" aria-label="Avisos">
      {visible.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
