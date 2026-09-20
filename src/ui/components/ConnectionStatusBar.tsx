import React, { useState } from "react";
import type { ConnectionStatus } from "../network/peerManager";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { Icon } from "./ui/Icon";
import type { IconName } from "./ui/iconNames";

interface ConnectionStatusBarProps {
  roomCode: string;
  isHost: boolean;
  status: ConnectionStatus;
  statusMessage?: string;
  localPlayerName: string;
}

type Tone = "ok" | "warn" | "info" | "error";

/** Cada estado lleva color + ícono + texto: el color nunca es lo único que informa. */
const STATUS: Record<"connected" | "waiting_for_opponent" | "connecting" | "other", { tone: Tone; icon: IconName; text: string }> = {
  connected: { tone: "ok", icon: "wifi", text: "Conectado en vivo" },
  waiting_for_opponent: { tone: "warn", icon: "send", text: "Esperando oponente..." },
  connecting: { tone: "info", icon: "wifi", text: "Conectando..." },
  other: { tone: "error", icon: "wifioff", text: "Desconectado" },
};

export const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = ({
  roomCode,
  isHost,
  status,
  statusMessage,
  localPlayerName,
}) => {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error("Failed to copy link", e);
      setCopyFailed(true);
    }
  };

  const state =
    status === "connected" || status === "waiting_for_opponent" || status === "connecting"
      ? STATUS[status]
      : STATUS.other;

  return (
    <section className={`conn conn--${state.tone}`} aria-label="Conexión de la sala online">
      <div className="conn__main">
        <span className="conn__tile">
          <Icon name="globe" size={24} />
        </span>
        <div className="conn__text">
          <div className="conn__room">
            <span>Sala online:</span>
            <strong>{roomCode}</strong>
            <span className="chip">
              Rol: <strong>{`${localPlayerName} (${isHost ? "Host" : "Invitado"})`}</strong>
            </span>
          </div>
          {statusMessage && <div className="conn__msg">{statusMessage}</div>}
        </div>
      </div>

      <div className="conn__side">
        <span className="chip conn__chip" role="status">
          <Icon name={state.icon} size={18} />
          {state.text}
        </span>
        <Button size="sm" icon={copied ? "check" : "copy"} onClick={handleCopyLink}>
          {copied ? "¡Enlace copiado!" : "Copiar enlace de sala"}
        </Button>
      </div>

      {copyFailed && (
        <div className="conn__fallback">
          <Field
            label="No se pudo copiar el enlace. Copialo a mano:"
            icon="copy"
            readOnly
            value={inviteUrl}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}
    </section>
  );
};
