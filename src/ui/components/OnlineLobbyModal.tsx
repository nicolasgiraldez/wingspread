import React, { useState } from "react";
import { Bot, Globe, LogIn, PlusCircle, X } from "lucide-react";
import type { AutomaDifficulty } from "../../game";
import { difficultyLabels } from "../labels";
import { generateRoomCode } from "../network/peerManager";

interface OnlineLobbyModalProps {
  onStartSolo: (difficulty: AutomaDifficulty) => void;
  onCreateOnlineRoom: (roomCode: string) => void;
  onJoinOnlineRoom: (roomCode: string) => void;
  onClose?: () => void;
  defaultJoinCode?: string;
}

export const OnlineLobbyModal: React.FC<OnlineLobbyModalProps> = ({
  onStartSolo,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  onClose,
  defaultJoinCode = "",
}) => {
  const [joinCodeInput, setJoinCodeInput] = useState(defaultJoinCode);
  const [errorMsg, setErrorMsg] = useState("");

  const handleCreateRoom = () => {
    const code = generateRoomCode();
    onCreateOnlineRoom(code);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCodeInput.trim().toLowerCase();
    if (!cleanCode) {
      setErrorMsg("Por favor introduce un código de sala válido.");
      return;
    }
    setErrorMsg("");
    onJoinOnlineRoom(cleanCode);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Modos de Juego - Wingspread</h2>
          {onClose && (
            <button onClick={onClose} style={{ background: "transparent", color: "#93a397", padding: 4 }}>
              <X size={20} />
            </button>
          )}
        </div>

        <p style={{ margin: "0 0 14px 0", color: "#c3ccc5", fontSize: "0.9rem" }}>
          Selecciona cómo deseas jugar: en solitario contra la IA o en línea con otra persona en tiempo real.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 1. Modo Solitario vs Automa */}
          <div style={{ background: "#1c241d", border: "1.5px solid #2b332e", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ background: "#1f7a4f", color: "#ffffff", padding: 6, borderRadius: 8 }}>
                <Bot size={18} />
              </div>
              <strong style={{ fontSize: "1.05rem" }}>Modo Solitario (vs Automa)</strong>
            </div>
            <p style={{ margin: "0 0 10px 0", fontSize: "0.82rem", color: "#93a397" }}>
              Juega una partida individual contra el oponente IA oficial de Wingspan.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {(["easy", "normal", "hard"] as AutomaDifficulty[]).map((diff) => (
                <button
                  key={diff}
                  onClick={() => onStartSolo(diff)}
                  style={{
                    flex: 1,
                    fontSize: "0.8rem",
                    justifyContent: "center",
                    padding: "7px 8px",
                  }}
                >
                  {difficultyLabels[diff]}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Modo Multijugador Online */}
          <div style={{ background: "rgba(79, 168, 224, 0.1)", border: "1.5px solid rgba(79, 168, 224, 0.35)", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ background: "#20699a", color: "#ffffff", padding: 6, borderRadius: 8 }}>
                <Globe size={18} />
              </div>
              <strong style={{ fontSize: "1.05rem" }}>Multijugador Online (P2P)</strong>
            </div>
            <p style={{ margin: "0 0 12px 0", fontSize: "0.82rem", color: "#c3ccc5" }}>
              Crea una sala privada y comparte el enlace, o únete a una sala con su código.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={handleCreateRoom}
                style={{
                  backgroundColor: "#20699a",
                  width: "100%",
                  justifyContent: "center",
                  padding: "9px 12px",
                }}
              >
                <PlusCircle size={16} /> Crear Nueva Sala Online
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0" }}>
                <div style={{ flex: 1, height: 1, background: "#2b332e" }} />
                <span style={{ fontSize: "0.75rem", color: "#75897b" }}>O UNIRSE A SALA</span>
                <div style={{ flex: 1, height: 1, background: "#2b332e" }} />
              </div>

              <form onSubmit={handleJoinRoom} style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Ej: halcon-428"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(79, 168, 224, 0.4)",
                    fontSize: "0.88rem",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="submit"
                  style={{ backgroundColor: "#1f7a4f", padding: "0 16px" }}
                >
                  <LogIn size={16} /> Unirse
                </button>
              </form>
              {errorMsg && (
                <div style={{ fontSize: "0.78rem", color: "#f0645f" }}>{errorMsg}</div>
              )}
            </div>
          </div>
        </div>

        {onClose && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={onClose} style={{ backgroundColor: "#212b22", color: "#c3ccc5" }}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
