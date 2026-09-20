import React, { useState } from "react";
import type { ConnectionStatus } from "../network/peerManager";
import { Icon } from "./ui/Icon";

interface ConnectionStatusBarProps {
  roomCode: string;
  isHost: boolean;
  status: ConnectionStatus;
  statusMessage?: string;
  localPlayerName: string;
}

export const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = ({
  roomCode,
  isHost,
  status,
  statusMessage,
  localPlayerName,
}) => {
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error("Failed to copy link", e);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "connected":
        return {
          bg: "rgba(63, 174, 114, 0.12)",
          color: "#3fae72",
          border: "rgba(63, 174, 114, 0.35)",
          icon: <Icon name="wifi" size={16} />,
          text: "Conectado en vivo",
        };
      case "waiting_for_opponent":
        return {
          bg: "rgba(217, 168, 59, 0.12)",
          color: "#d9a83b",
          border: "rgba(217, 168, 59, 0.35)",
          icon: <Icon name="send" size={16} />,
          text: "Esperando oponente...",
        };
      case "connecting":
        return {
          bg: "rgba(79, 168, 224, 0.12)",
          color: "#4fa8e0",
          border: "rgba(79, 168, 224, 0.35)",
          icon: <Icon name="wifi" size={16} />,
          text: "Conectando...",
        };
      default:
        return {
          bg: "rgba(240, 100, 95, 0.12)",
          color: "#f0645f",
          border: "rgba(240, 100, 95, 0.35)",
          icon: <Icon name="wifioff" size={16} />,
          text: "Desconectado",
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div
      style={{
        background: "#182019",
        border: "1px solid #2b332e",
        borderRadius: 12,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ background: "rgba(63, 174, 114, 0.12)", color: "#3fae72", padding: 6, borderRadius: 8 }}>
          <Icon name="globe" size={20} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.85rem", color: "#c3ccc5" }}>Sala online:</span>
            <strong style={{ fontSize: "0.95rem", letterSpacing: 0.5 }}>{roomCode}</strong>
            <span style={{ fontSize: "0.75rem", background: "#212b22", padding: "1px 6px", borderRadius: 4, color: "#c3ccc5" }}>
              Rol: <strong>{localPlayerName} ({isHost ? "Host" : "Invitado"})</strong>
            </span>
          </div>
          {statusMessage && (
            <div style={{ fontSize: "0.75rem", color: "#93a397", marginTop: 2 }}>
              {statusMessage}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Status Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: "0.78rem",
            padding: "4px 8px",
            borderRadius: 6,
            backgroundColor: badge.bg,
            color: badge.color,
            border: `1px solid ${badge.border}`,
            fontWeight: 600,
          }}
        >
          {badge.icon}
          <span>{badge.text}</span>
        </div>

        {/* Copy Invite Link */}
        <button
          onClick={handleCopyLink}
          style={{
            backgroundColor: copied ? "#1f7a4f" : "#1a4a35",
            minHeight: 32,
            padding: "0 12px",
            fontSize: "0.8rem",
          }}
        >
          <Icon name={copied ? "check" : "copy"} size={16} />
          <span>{copied ? "¡Enlace copiado!" : "Copiar enlace de sala"}</span>
        </button>
      </div>
    </div>
  );
};
