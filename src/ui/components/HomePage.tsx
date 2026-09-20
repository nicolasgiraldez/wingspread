import React, { useState } from "react";
import type { BotDifficulty } from "../../game";
import { Icon } from "./ui/Icon";
import { difficultyLabels } from "../labels";
import { extractRoomCode, generateRoomCode } from "../network/peerManager";
import { formatSavedAgo } from "../savedGame";
import type { SavedGameSummary } from "../savedGame";

export interface HomePageConfig {
  mode: "solo" | "online-host" | "online-join";
  playerName: string;
  opponentName?: string;
  botDifficulty?: BotDifficulty;
  roomCode?: string;
}

interface HomePageProps {
  onStart: (config: HomePageConfig) => void;
  defaultJoinCode?: string;
  /** Partida en curso guardada en el navegador: se ofrece continuarla o descartarla. */
  savedGame?: SavedGameSummary | null;
  onResumeSaved?: () => void;
  onDiscardSaved?: () => void;
}

type Section = "welcome" | "solo" | "online";

export const HomePage: React.FC<HomePageProps> = ({
  onStart,
  defaultJoinCode = "",
  savedGame = null,
  onResumeSaved,
  onDiscardSaved,
}) => {
  const [section, setSection] = useState<Section>(defaultJoinCode ? "online" : "welcome");
  const [playerName, setPlayerName] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [difficulty, setDifficulty] = useState<BotDifficulty>("normal");
  const [joinCode, setJoinCode] = useState(defaultJoinCode);
  const [joinError, setJoinError] = useState("");

  const validName = playerName.trim().length >= 1;

  const handleStartSolo = () => {
    if (!validName) return;
    onStart({
      mode: "solo",
      playerName: playerName.trim(),
      botDifficulty: difficulty,
    });
  };

  const handleCreateRoom = () => {
    if (!validName) return;
    const code = generateRoomCode();
    onStart({
      mode: "online-host",
      playerName: playerName.trim(),
      opponentName: opponentName.trim() || undefined,
      roomCode: code,
    });
  };

  // El código puede venir tipeado a mano o pegado como el enlace completo de invitación
  // (ej. "https://wingspread.vercel.app/?room=halcon-482"); extractRoomCode reconoce ambos.
  const parsedJoinCode = extractRoomCode(joinCode);

  const handleJoinCodeChange = (raw: string) => {
    setJoinError("");
    // Si pegaron un enlace completo, colapsamos el campo al código solo: así no queda
    // una URL larga ocupando el input y el jugador ve al instante qué se reconoció.
    const looksLikeLink = /^https?:\/\//i.test(raw) || raw.includes("room=") || raw.includes("join=");
    if (looksLikeLink) {
      setJoinCode(extractRoomCode(raw) || raw);
    } else {
      setJoinCode(raw);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validName) return;
    if (!parsedJoinCode) {
      setJoinError(
        joinCode.trim()
          ? "No reconocemos ese código o enlace. Revisá que esté completo."
          : "Ingresá un código de sala.",
      );
      return;
    }
    setJoinError("");
    onStart({
      mode: "online-join",
      playerName: playerName.trim(),
      roomCode: parsedJoinCode,
    });
  };

  // ─── Welcome Screen ───────────────────────────────────────────────────────
  if (section === "welcome") {
    return (
      <div style={styles.fullPage}>
        <div style={styles.heroCard}>
          {/* Branding */}
          <div style={styles.logoRow}>
            <div style={styles.logoIcon}>
              <Icon name="bird" size={44} />
            </div>
            <div>
              <h1 style={styles.title}>Wingspread</h1>
              <p style={styles.subtitle}>
                Juego de construcción de motor ecológico inspirado en Wingspan
              </p>
            </div>
          </div>

          {/* Partida guardada: continuar donde se dejó */}
          {savedGame && onResumeSaved && (
            <div style={styles.savedCard}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.savedTitle}>
                  <Icon name="clock" size={16} />
                  Partida en curso
                </div>
                <div style={styles.savedInfo}>
                  {savedGame.kind === "solo" ? "Modo solitario" : `Sala ${savedGame.roomCode}`} · Ronda {savedGame.round} ·
                  guardada {formatSavedAgo(savedGame.savedAt)}
                </div>
                {savedGame.kind === "online-host" && (
                  <div style={styles.savedHint}>
                    Al continuar se reabre la sala: tu invitado se reconecta solo o con el mismo enlace.
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={onResumeSaved} style={styles.savedResume}>
                  Continuar
                </button>
                {onDiscardSaved && (
                  <button onClick={onDiscardSaved} style={styles.savedDiscard} title="Borrar la partida guardada">
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Player name always first */}
          <div style={styles.nameSection}>
            <label style={styles.label}>
              <Icon name="user" size={16} />
              ¿Cómo te llamas?
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Escribí tu nombre..."
              maxLength={24}
              style={styles.input}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && validName) setSection("solo");
              }}
            />
          </div>

          {/* Mode buttons */}
          <div style={styles.modeGrid}>
            <button
              onClick={() => setSection("solo")}
              disabled={!validName}
              style={{
                ...styles.modeButton,
                ...(validName ? styles.modeButtonSolo : styles.modeButtonDisabled),
              }}
            >
              <Icon name="bot" size={28} />
              <span style={styles.modeLabel}>Modo Solitario</span>
              <span style={styles.modeDesc}>Una partida 1 contra 1 contra la IA</span>
              <Icon name="chev" size={16} />
            </button>

            <button
              onClick={() => setSection("online")}
              disabled={!validName}
              style={{
                ...styles.modeButton,
                ...(validName ? styles.modeButtonOnline : styles.modeButtonDisabled),
              }}
            >
              <Icon name="globe" size={28} />
              <span style={styles.modeLabel}>Multijugador Online</span>
              <span style={styles.modeDesc}>Crea o únete a una sala en tiempo real</span>
              <Icon name="chev" size={16} />
            </button>
          </div>

          {!validName && (
            <p style={styles.hint}>
              Ingresá tu nombre para comenzar
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── Solo Setup ───────────────────────────────────────────────────────────
  if (section === "solo") {
    return (
      <div style={styles.fullPage}>
        <div style={{ ...styles.heroCard, maxWidth: 480 }}>
          <button onClick={() => setSection("welcome")} style={styles.backBtn}>
            <Icon name="back" size={18} /> Volver
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ ...styles.logoIcon, background: "#1f7a4f" }}>
              <Icon name="bot" size={28} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Modo Solitario</h2>
              <p style={{ margin: 0, color: "#93a397", fontSize: "0.85rem" }}>Juega contra un rival controlado por la IA</p>
            </div>
          </div>

          {/* Player name */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}><Icon name="user" size={16} /> Tu nombre</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Tu nombre..."
              maxLength={24}
              style={styles.input}
            />
          </div>

          {/* Difficulty */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Dificultad del rival</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["easy", "normal", "hard"] as BotDifficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  style={{
                    flex: 1,
                    padding: "9px 6px",
                    borderRadius: 8,
                    border: `2px solid ${difficulty === d ? "#3fae72" : "#394239"}`,
                    background: difficulty === d ? "#1f7a4f" : "#1c241d",
                    color: difficulty === d ? "#fff" : "#c3ccc5",
                    fontSize: "0.78rem",
                    fontWeight: difficulty === d ? 700 : 400,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {difficultyLabels[d]}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStartSolo}
            disabled={!validName}
            style={{
              ...styles.startBtn,
              backgroundColor: validName ? "#1f7a4f" : "#3a453e",
              cursor: validName ? "pointer" : "not-allowed",
            }}
          >
            <Icon name="bird" size={18} /> Comenzar Partida Solitaria
          </button>
        </div>
      </div>
    );
  }

  // ─── Online Setup ─────────────────────────────────────────────────────────
  return (
    <div style={styles.fullPage}>
      <div style={{ ...styles.heroCard, maxWidth: 500 }}>
        <button onClick={() => setSection("welcome")} style={styles.backBtn}>
            <Icon name="back" size={18} /> Volver
          </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ ...styles.logoIcon, background: "#20699a" }}>
            <Icon name="globe" size={28} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Multijugador Online</h2>
            <p style={{ margin: 0, color: "#93a397", fontSize: "0.85rem" }}>Juega con un amigo en tiempo real vía P2P</p>
          </div>
        </div>

        {/* Your name */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}><Icon name="user" size={16} /> Tu nombre</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Tu nombre..."
            maxLength={24}
            style={styles.input}
          />
        </div>

        {/* Create Room block */}
        <div style={{ background: "rgba(79, 168, 224, 0.1)", border: "1.5px solid rgba(79, 168, 224, 0.35)", borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <p style={{ margin: "0 0 10px 0", fontWeight: 600, fontSize: "0.95rem", color: "#4fa8e0" }}>
            <Icon name="plus" size={16} />
            Crear nueva sala
          </p>

          <div style={styles.fieldGroup}>
            <label style={styles.label}><Icon name="user" size={16} /> Nombre de tu oponente (opcional)</label>
            <input
              type="text"
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder="Nombre de tu amigo... (o dejalo en blanco)"
              maxLength={24}
              style={styles.input}
            />
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={!validName}
            style={{
              ...styles.startBtn,
              backgroundColor: validName ? "#20699a" : "#3a453e",
              cursor: validName ? "pointer" : "not-allowed",
            }}
          >
            <Icon name="plus" size={16} /> Crear Sala y Compartir Enlace
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 14px" }}>
          <div style={{ flex: 1, height: 1, background: "#2b332e" }} />
          <span style={{ fontSize: "0.75rem", color: "#75897b" }}>O UNIRSE A SALA EXISTENTE</span>
          <div style={{ flex: 1, height: 1, background: "#2b332e" }} />
        </div>

        {/* Join Room block */}
        <form onSubmit={handleJoinRoom} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}><Icon name="login" size={16} /> Código de sala</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => handleJoinCodeChange(e.target.value)}
                placeholder="ej. halcon-428 (o pegá el enlace de invitación)"
                style={{ ...styles.input, flex: 1, minWidth: 0 }}
              />
              <button
                type="submit"
                disabled={!validName}
                style={{
                  ...styles.startBtn,
                  width: "auto",
                  padding: "0 18px",
                  minWidth: 0,
                  flexShrink: 0,
                  backgroundColor: validName ? "#1f7a4f" : "#3a453e",
                  cursor: validName ? "pointer" : "not-allowed",
                }}
              >
                <Icon name="login" size={16} /> Unirse
              </button>
            </div>
            {joinCode.trim() && !joinError && (
              parsedJoinCode ? (
                <span style={{ fontSize: "0.78rem", color: "#3fae72" }}>
                  <Icon name="check" size={18} ink="var(--c-petroleo)" /> Te vas a unir a la sala: <strong>{parsedJoinCode}</strong>
                </span>
              ) : (
                <span style={{ fontSize: "0.78rem", color: "#d9a83b" }}>
                  No reconocemos ese código o enlace todavía.
                </span>
              )
            )}
            {joinError && <span style={{ fontSize: "0.78rem", color: "#f0645f" }}>{joinError}</span>}
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
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
    padding: 36,
    maxWidth: 560,
    width: "100%",
    boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 28,
  },
  logoIcon: {
    background: "linear-gradient(135deg, #3fae72, #4fa8e0)",
    borderRadius: 16,
    padding: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: "2rem",
    fontWeight: 800,
    background: "linear-gradient(135deg, #3fae72, #4fa8e0)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  subtitle: {
    margin: "4px 0 0 0",
    color: "#93a397",
    fontSize: "0.85rem",
  },
  nameSection: {
    marginBottom: 24,
  },
  savedCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    padding: 14,
    marginBottom: 20,
    background: "rgba(63, 174, 114, 0.1)",
    border: "1px solid rgba(63, 174, 114, 0.35)",
    borderRadius: 12,
  },
  savedTitle: {
    display: "flex",
    alignItems: "center",
    fontWeight: 700,
    fontSize: "0.9rem",
    color: "#3fae72",
    marginBottom: 2,
  },
  savedInfo: {
    fontSize: "0.82rem",
    color: "#c3ccc5",
  },
  savedHint: {
    fontSize: "0.75rem",
    color: "#93a397",
    marginTop: 4,
  },
  savedResume: {
    background: "#1f7a4f",
    color: "#ffffff",
    fontWeight: 700,
  },
  savedDiscard: {
    background: "#212b22",
    color: "#c3ccc5",
    padding: "0 10px",
  },
  label: {
    display: "flex",
    alignItems: "center",
    fontSize: "0.82rem",
    fontWeight: 600,
    color: "#c3ccc5",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1.5px solid #394239",
    background: "#212b22",
    color: "#eef1ec",
    fontSize: "1rem",
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.15s",
  },
  modeGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 16,
  },
  modeButton: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    gap: 4,
    padding: "18px 16px",
    borderRadius: 14,
    border: "2px solid transparent",
    cursor: "pointer",
    position: "relative" as const,
    transition: "all 0.15s",
  },
  modeButtonSolo: {
    background: "rgba(63, 174, 114, 0.12)",
    borderColor: "rgba(63, 174, 114, 0.35)",
    color: "#cdeddb",
  },
  modeButtonOnline: {
    background: "rgba(79, 168, 224, 0.12)",
    borderColor: "rgba(79, 168, 224, 0.35)",
    color: "#cfe7f7",
  },
  modeButtonDisabled: {
    background: "#1c241d",
    borderColor: "#2b332e",
    color: "#5c6b60",
    cursor: "not-allowed",
  },
  modeLabel: {
    fontWeight: 700,
    fontSize: "0.9rem",
    marginTop: 6,
  },
  modeDesc: {
    fontSize: "0.75rem",
    opacity: 0.7,
  },
  modeArrow: {
    position: "absolute" as const,
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    opacity: 0.5,
  },
  hint: {
    textAlign: "center" as const,
    color: "#75897b",
    fontSize: "0.82rem",
    margin: "0 0 16px 0",
  },
  fieldGroup: {
    marginBottom: 14,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  startBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    padding: "12px 0",
    borderRadius: 10,
    border: "none",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.95rem",
    fontFamily: "inherit",
    transition: "background 0.15s",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#93a397",
    cursor: "pointer",
    fontSize: "0.85rem",
    padding: "0 0 16px 0",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
};
