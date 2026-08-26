import React, { useState } from "react";
import { Check, Copy, Globe, Link, Share2, Wifi, WifiOff } from "lucide-react";
import type { ConnectionStatus } from "../network/peerManager";
import { playerNames } from "../labels";

interface ConnectionStatusBarProps {
  roomCode: string;
  isHost: boolean;
  status: ConnectionStatus;
  statusMessage?: string;
  localPlayerId: string;
}

export const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = ({
  roomCode,
  isHost,
  status,
  statusMessage,
  localPlayerId,
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
          bg: "#eaf4ed",
          color: "#235c3a",
          border: "#b8dbc0",
          icon: <Wifi size={14} />,
          text: "Conectado en Vivo",
        };
      case "waiting_for_opponent":
        return {
          bg: "#fef3d6",
          color: "#9c6c16",
          border: "#ebdcb2",
          icon: <Share2 size={14} />,
          text: "Esperando Oponente...",
        };
      case "connecting":
        return {
          bg: "#e9f3f9",
          color: "#1d618a",
          border: "#bddbf0",
          icon: <Wifi size={14} />,
          text: "Conectando...",
        };
      default:
        return {
          bg: "#fee2e2",
          color: "#b91c1c",
          border: "#fca5a5",
          icon: <WifiOff size={14} />,
          text: "Desconectado",
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #d2ded0",
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
        <div style={{ background: "#eaf4ed", color: "#235c3a", padding: 6, borderRadius: 8 }}>
          <Globe size={18} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.85rem", color: "#556" }}>Sala Online:</span>
            <strong style={{ fontSize: "0.95rem", letterSpacing: 0.5 }}>{roomCode}</strong>
            <span style={{ fontSize: "0.75rem", background: "#f0f3f0", padding: "1px 6px", borderRadius: 4, color: "#445" }}>
              Rol: <strong>{playerNames[localPlayerId]} ({isHost ? "Host" : "Invitado"})</strong>
            </span>
          </div>
          {statusMessage && (
            <div style={{ fontSize: "0.75rem", color: "#667", marginTop: 2 }}>
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
            backgroundColor: copied ? "#235c3a" : "#1e5740",
            minHeight: 32,
            padding: "0 12px",
            fontSize: "0.8rem",
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "¡Enlace Copiado!" : "Copiar Enlace de Sala"}</span>
        </button>
      </div>
    </div>
  );
};
