import React from "react";
import { AlertTriangle, ArrowLeft, Bird, Loader2, RefreshCw } from "lucide-react";
import type { ConnectionStatus } from "../network/peerManager";

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
          <div style={{ ...styles.logoIcon, background: isError ? "#b91c1c" : "#1d618a" }}>
            <Bird size={28} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Uniéndote a la sala</h2>
            <p style={{ margin: 0, color: "#667", fontSize: "0.85rem" }}>
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
            background: isError ? "#fee2e2" : "#e9f3f9",
            border: `1.5px solid ${isError ? "#fca5a5" : "#bddbf0"}`,
            marginBottom: 18,
          }}
        >
          {isError ? (
            <AlertTriangle size={22} color="#b91c1c" />
          ) : (
            <Loader2 size={22} color="#1d618a" className="spin-icon" />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: isError ? "#b91c1c" : "#1d618a" }}>
              {statusText[status]}
            </div>
            {statusMessage && (
              <div style={{ fontSize: "0.78rem", color: "#667", marginTop: 2 }}>{statusMessage}</div>
            )}
          </div>
        </div>

        {isError && (
          <p style={{ fontSize: "0.82rem", color: "#556", marginBottom: 18 }}>
            Verificá que el código de sala sea correcto y que la persona anfitriona siga con la
            sala abierta en su navegador.
          </p>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ ...styles.secondaryBtn, flex: isError ? 1 : "0 0 auto" }}
          >
            <ArrowLeft size={16} /> Volver al inicio
          </button>
          {isError && (
            <button onClick={onRetry} style={{ ...styles.primaryBtn, flex: 1 }}>
              <RefreshCw size={16} /> Reintentar
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
    background: "linear-gradient(135deg, #1a3a28 0%, #1a2e3a 50%, #1a3328 100%)",
    padding: 24,
  },
  heroCard: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 32,
    maxWidth: 460,
    width: "100%",
    boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 22,
  },
  logoIcon: {
    background: "linear-gradient(135deg, #235c3a, #1d618a)",
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
    border: "1.5px solid #d2ded0",
    background: "#ffffff",
    color: "#334",
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
    background: "#235c3a",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "pointer",
  },
};
