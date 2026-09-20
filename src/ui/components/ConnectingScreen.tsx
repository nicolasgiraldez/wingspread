import React from "react";
import type { ConnectionStatus } from "../network/peerManager";
import { Icon } from "./ui/Icon";

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
    <div style={styles.fullPage}>
      <div style={styles.heroCard}>
        <div style={styles.logoRow}>
          <div style={{ ...styles.logoIcon, background: isError ? "#b8433f" : "#20699a" }}>
            <Icon name="bird" size={32} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Uniéndote a la sala</h2>
            <p style={{ margin: 0, color: "#93a397", fontSize: "0.85rem" }}>
              Sala <strong>{roomCode}</strong> · Jugando como <strong>{playerName}</strong>
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 18px",
            borderRadius: 12,
            background: isError ? "rgba(240, 100, 95, 0.12)" : "rgba(79, 168, 224, 0.12)",
            border: `1.5px solid ${isError ? "rgba(240, 100, 95, 0.4)" : "rgba(79, 168, 224, 0.4)"}`,
            marginBottom: 18,
          }}
        >
          {isError ? (
            <Icon name="alert" size={24} />
          ) : (
            <Icon name="spinner" size={24} className="spin" />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: isError ? "#f0645f" : "#4fa8e0" }}>
              {statusText[status]}
            </div>
            {statusMessage && (
              <div style={{ fontSize: "0.78rem", color: "#93a397", marginTop: 2 }}>{statusMessage}</div>
            )}
          </div>
        </div>

        {isError && (
          <p style={{ fontSize: "0.82rem", color: "#c3ccc5", marginBottom: 18 }}>
            Verificá que el código de sala sea correcto y que la persona anfitriona siga con la
            sala abierta en su navegador.
          </p>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ ...styles.secondaryBtn, flex: isError ? 1 : "0 0 auto" }}
          >
            <Icon name="back" size={18} /> Volver al inicio
          </button>
          {isError && (
            <button onClick={onRetry} style={{ ...styles.primaryBtn, flex: 1 }}>
              <Icon name="refresh" size={18} /> Reintentar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  fullPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0d1c14 0%, #0d161c 50%, #0d1a15 100%)",
    padding: 24,
  },
  heroCard: {
    background: "#182019",
    border: "1px solid #2b332e",
    borderRadius: 20,
    padding: 32,
    maxWidth: 460,
    width: "100%",
    boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 22,
  },
  logoIcon: {
    background: "linear-gradient(135deg, #3fae72, #4fa8e0)",
    borderRadius: 16,
    padding: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  secondaryBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "11px 16px",
    borderRadius: 10,
    border: "1.5px solid #394239",
    background: "#212b22",
    color: "#c3ccc5",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "pointer",
  },
  primaryBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "11px 16px",
    borderRadius: 10,
    border: "none",
    background: "#1f7a4f",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "pointer",
  },
};
