import React, { useEffect, useId, useRef, useState } from "react";
import logoUrl from "../assets/logo.svg";
import { Button } from "./ui/Button";

interface GameTopBarProps {
  round: number;
  ended: boolean;
  isMyTurn: boolean;
  /** Nombre de quien tiene el turno (para el chip cuando no es el tuyo). */
  currentName: string;
  onHome: () => void;
}

const ROUNDS = 4;

/** Barra superior: marca, progreso de rondas, de quién es el turno y menú de la partida. */
export const GameTopBar: React.FC<GameTopBarProps> = ({ round, ended, isMyTurn, currentName, onHome }) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <img src={logoUrl} alt="" width={36} height={36} />
        <h1 className="topbar__name">Wingspread</h1>
      </div>

      <div className="topbar__rounds" data-fingerprint>
        <span className="topbar__round-text">
          Ronda {round} de {ROUNDS}
        </span>
        <span className="topbar__pills" aria-hidden="true">
          {Array.from({ length: ROUNDS }, (_, i) => (
            <span key={i} className={`topbar__pill${i < round ? " topbar__pill--on" : ""}`} />
          ))}
        </span>
        {ended && <span className="topbar__ended">(Terminada)</span>}
      </div>

      <div className="topbar__end">
        {!ended && (
          <span className={`chip topbar__turn${isMyTurn ? " chip--on" : ""}`}>
            {isMyTurn ? "Tu turno" : `Turno de ${currentName}`}
          </span>
        )}
        <div className="topbar__menu">
          <button
            ref={buttonRef}
            type="button"
            className="btn btn--icon topbar__menu-btn"
            aria-label="Menú de la partida"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" focusable="false">
              <path d="M4 7H20M4 12H20M4 17H20" />
            </svg>
          </button>
          {open && (
            <div id={menuId} ref={menuRef} className="topbar__popover" role="group" aria-label="Menú de la partida">
              <Button icon="back" onClick={onHome}>
                Volver al inicio
              </Button>
              <Button icon="refresh" onClick={onHome}>
                Nueva partida
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
