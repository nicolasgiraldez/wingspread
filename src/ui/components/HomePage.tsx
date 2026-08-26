import React, { useEffect, useState } from "react";
import {
  Bird,
  Bot,
  ChevronRight,
  Feather,
  Globe,
  LogIn,
  PlusCircle,
  User,
  Users,
} from "lucide-react";
import type { AutomaDifficulty } from "../../game";
import { difficultyLabels } from "../labels";
import { generateRoomCode } from "../network/peerManager";

export interface HomePageConfig {
  mode: "solo" | "online-host" | "online-join";
  playerName: string;
  opponentName?: string;
  automaDifficulty?: AutomaDifficulty;
  roomCode?: string;
}

interface HomePageProps {
  onStart: (config: HomePageConfig) => void;
  defaultJoinCode?: string;
}

type Section = "welcome" | "solo" | "online";

export const HomePage: React.FC<HomePageProps> = ({ onStart, defaultJoinCode = "" }) => {
  const [section, setSection] = useState<Section>("welcome");
  const [playerName, setPlayerName] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [difficulty, setDifficulty] = useState<AutomaDifficulty>("normal");
  const [joinCode, setJoinCode] = useState(defaultJoinCode);
  const [joinError, setJoinError] = useState("");

  // If we have a join code from URL, jump straight to online join screen
  useEffect(() => {
    if (defaultJoinCode) {
      setSection("online");
      setJoinCode(defaultJoinCode);
    }
  }, [defaultJoinCode]);

  const validName = playerName.trim().length >= 1;

  const handleStartSolo = () => {
    if (!validName) return;
    onStart({
      mode: "solo",
      playerName: playerName.trim(),
      automaDifficulty: difficulty,
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

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validName) return;
    const code = joinCode.trim().toLowerCase();
    if (!code) {
      setJoinError("Por favor, introduce un código de sala.");
      return;
    }
    setJoinError("");
    onStart({
      mode: "online-join",
      playerName: playerName.trim(),
      roomCode: code,
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
              <Bird size={44} color="#ffffff" />
            </div>
            <div>
              <h1 style={styles.title}>Wingspread</h1>
              <p style={styles.subtitle}>
                Juego de construcción de motor ecológico inspirado en Wingspan
              </p>
            </div>
          </div>

          {/* Player name always first */}
          <div style={styles.nameSection}>
            <label style={styles.label}>
              <User size={14} style={{ marginRight: 6 }} />
              ¿Cómo te llamas?
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Escribe tu nombre..."
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
              <Bot size={28} />
              <span style={styles.modeLabel}>Modo Solitario</span>
              <span style={styles.modeDesc}>Juega contra la IA Automa</span>
              <ChevronRight size={16} style={styles.modeArrow} />
            </button>

            <button
              onClick={() => setSection("online")}
              disabled={!validName}
              style={{
                ...styles.modeButton,
                ...(validName ? styles.modeButtonOnline : styles.modeButtonDisabled),
              }}
            >
              <Globe size={28} />
              <span style={styles.modeLabel}>Multijugador Online</span>
              <span style={styles.modeDesc}>Crea o únete a una sala en tiempo real</span>
              <ChevronRight size={16} style={styles.modeArrow} />
            </button>
          </div>

          {!validName && (
            <p style={styles.hint}>
              ✏️ Introduce tu nombre para comenzar
            </p>
          )}

          {/* Feature pills */}
          <div style={styles.featurePills}>
            {["🌲 Bosque", "🌾 Pradera", "🌊 Humedal", "🎲 Dados de alimento", "🐦 17+ aves", "🃏 Objetivos de ronda"].map((f) => (
              <span key={f} style={styles.pill}>{f}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Solo Setup ───────────────────────────────────────────────────────────
  if (section === "solo") {
    return (
      <div style={styles.fullPage}>
        <div style={{ ...styles.heroCard, maxWidth: 480 }}>
          <button onClick={() => setSection("welcome")} style={styles.backBtn}>← Volver</button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ ...styles.logoIcon, background: "#235c3a" }}>
              <Bot size={28} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Modo Solitario</h2>
              <p style={{ margin: 0, color: "#667", fontSize: "0.85rem" }}>Juega contra el Automa (IA)</p>
            </div>
          </div>

          {/* Player name */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}><User size={13} /> Tu nombre</label>
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
            <label style={styles.label}>Dificultad del Automa</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["easy", "normal", "hard"] as AutomaDifficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  style={{
                    flex: 1,
                    padding: "9px 6px",
                    borderRadius: 8,
                    border: `2px solid ${difficulty === d ? "#235c3a" : "#d2ded0"}`,
                    background: difficulty === d ? "#235c3a" : "#f8faf8",
                    color: difficulty === d ? "#fff" : "#334",
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
              backgroundColor: validName ? "#235c3a" : "#9ca3af",
              cursor: validName ? "pointer" : "not-allowed",
            }}
          >
            <Feather size={18} /> Comenzar Partida Solitaria
          </button>
        </div>
      </div>
    );
  }

  // ─── Online Setup ─────────────────────────────────────────────────────────
  return (
    <div style={styles.fullPage}>
      <div style={{ ...styles.heroCard, maxWidth: 500 }}>
        <button onClick={() => setSection("welcome")} style={styles.backBtn}>← Volver</button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ ...styles.logoIcon, background: "#1d618a" }}>
            <Globe size={28} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Multijugador Online</h2>
            <p style={{ margin: 0, color: "#667", fontSize: "0.85rem" }}>Juega con un amigo en tiempo real vía P2P</p>
          </div>
        </div>

        {/* Your name */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}><User size={13} /> Tu nombre</label>
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
        <div style={{ background: "#f4f8fb", border: "1.5px solid #bddbf0", borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <p style={{ margin: "0 0 10px 0", fontWeight: 600, fontSize: "0.95rem", color: "#1d618a" }}>
            <PlusCircle size={15} style={{ marginRight: 6, verticalAlign: "middle" }} />
            Crear nueva sala
          </p>

          <div style={styles.fieldGroup}>
            <label style={styles.label}><Users size={13} /> Nombre de tu oponente (opcional)</label>
            <input
              type="text"
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder="Nombre de tu amigo... (o déjalo en blanco)"
              maxLength={24}
              style={styles.input}
            />
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={!validName}
            style={{
              ...styles.startBtn,
              backgroundColor: validName ? "#1d618a" : "#9ca3af",
              cursor: validName ? "pointer" : "not-allowed",
            }}
          >
            <PlusCircle size={16} /> Crear Sala y Compartir Enlace
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 14px" }}>
          <div style={{ flex: 1, height: 1, background: "#d0e1ef" }} />
          <span style={{ fontSize: "0.75rem", color: "#778" }}>O UNIRSE A SALA EXISTENTE</span>
          <div style={{ flex: 1, height: 1, background: "#d0e1ef" }} />
        </div>

        {/* Join Room block */}
        <form onSubmit={handleJoinRoom} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}><LogIn size={13} /> Código de sala</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="ej. halcon-428"
                maxLength={32}
                style={{ ...styles.input, flex: 1 }}
              />
              <button
                type="submit"
                disabled={!validName}
                style={{
                  ...styles.startBtn,
                  padding: "0 18px",
                  minWidth: 0,
                  flexShrink: 0,
                  backgroundColor: validName ? "#235c3a" : "#9ca3af",
                  cursor: validName ? "pointer" : "not-allowed",
                }}
              >
                <LogIn size={15} /> Unirse
              </button>
            </div>
            {joinError && <span style={{ fontSize: "0.78rem", color: "#b91c1c" }}>{joinError}</span>}
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
    background: "linear-gradient(135deg, #1a3a28 0%, #1a2e3a 50%, #1a3328 100%)",
    padding: 24,
  },
  heroCard: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 36,
    maxWidth: 560,
    width: "100%",
    boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 28,
  },
  logoIcon: {
    background: "linear-gradient(135deg, #235c3a, #1d618a)",
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
    background: "linear-gradient(135deg, #235c3a, #1d618a)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  subtitle: {
    margin: "4px 0 0 0",
    color: "#667",
    fontSize: "0.85rem",
  },
  nameSection: {
    marginBottom: 24,
  },
  label: {
    display: "flex",
    alignItems: "center",
    fontSize: "0.82rem",
    fontWeight: 600,
    color: "#445",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1.5px solid #d2ded0",
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
    background: "#eaf4ed",
    borderColor: "#b8dbc0",
    color: "#1a3a28",
  },
  modeButtonOnline: {
    background: "#e9f3f9",
    borderColor: "#bddbf0",
    color: "#0f2a38",
  },
  modeButtonDisabled: {
    background: "#f5f5f5",
    borderColor: "#e0e0e0",
    color: "#aaa",
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
    color: "#9ca3af",
    fontSize: "0.82rem",
    margin: "0 0 16px 0",
  },
  featurePills: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 6,
    justifyContent: "center",
    marginTop: 8,
  },
  pill: {
    background: "#f0f4f0",
    color: "#445",
    borderRadius: 20,
    padding: "4px 10px",
    fontSize: "0.75rem",
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
    color: "#667",
    cursor: "pointer",
    fontSize: "0.85rem",
    padding: "0 0 16px 0",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
};
