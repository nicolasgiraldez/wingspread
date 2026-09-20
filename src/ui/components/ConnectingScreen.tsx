import React from "react";
import logoUrl from "../assets/logo.svg";
import type { ConnectionStatus } from "../network/peerManager";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";

interface ConnectingScreenProps {
  roomCode: string;
  playerName: string;
  status: ConnectionStatus;
  statusMessage?: string;
  onCancel: () => void;
  onRetry: () => void;
}

const statusText: Record<ConnectionStatus, string> = {
  disconnected: "Desconectado",
  connecting: "Conectando con la sala...",
  waiting_for_opponent: "Esperando al anfitrión...",
  connected: "¡Conectado! Sincronizando la partida...",
  error: "No se pudo conectar",
};

/**
 * Pantalla intermedia que se muestra al invitado entre "Unirse" y recibir el primer
 * SYNC_STATE del anfitrión. Antes de esto, la app se quedaba mostrando el inicio sin
 * ningún indicio de que había una conexión en curso (o que había fallado).
 */
export const ConnectingScreen: React.FC<ConnectingScreenProps> = ({
  roomCode,
  playerName,
  status,
  statusMessage,
  onCancel,
  onRetry,
}) => {
  const isError = status === "error";

  return (
    <div className="setup-page">
      <main className="setup-card" aria-busy={!isError}>
        <header className="setup-card__head">
          <span className={`setup-card__tile ${isError ? "setup-card__tile--error" : "setup-card__tile--online"}`}>
            <img src={logoUrl} alt="" width={40} height={40} />
          </span>
          <div>
            <h1 className="setup-card__title">Uniéndote a la sala</h1>
            <p className="setup-card__sub">
              Sala <strong>{roomCode}</strong> · Jugando como <strong>{playerName}</strong>
            </p>
          </div>
        </header>

        <Banner tone={isError ? "error" : "info"} icon={isError ? "alert" : "spinner"} title={statusText[status]}>
          {statusMessage}
        </Banner>

        {isError && (
          <p className="setup-card__note">
            Verificá que el código de sala sea correcto y que la persona anfitriona siga con la sala abierta en su
            navegador.
          </p>
        )}

        <div className="setup-card__actions">
          <Button icon="back" onClick={onCancel}>
            Volver al inicio
          </Button>
          {isError && (
            <Button variant="primary" icon="refresh" onClick={onRetry}>
              Reintentar
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};
