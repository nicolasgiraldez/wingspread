import React, { useId, useState } from "react";
import { speciesCards } from "../../game";
import type { BotDifficulty } from "../../game";
import logoUrl from "../assets/logo.svg";
import { difficultyLabels } from "../labels";
import { extractRoomCode, generateRoomCode } from "../network/peerManager";
import { formatSavedAgo } from "../savedGame";
import type { SavedGameSummary } from "../savedGame";
import { BirdCard } from "./BirdCard";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { Icon } from "./ui/Icon";
import type { IconName } from "./ui/iconNames";

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

/** Escena de la portada: bosque, sol y colina con tres cartas reales abiertas en abanico (decorativa). */
const WelcomeArt: React.FC = () => (
  <div className="welcome__art" aria-hidden="true">
    <svg className="welcome__scene" viewBox="0 0 800 900" preserveAspectRatio="xMidYMax slice" focusable="false">
      <rect width="800" height="900" fill="var(--c-petroleo)" />
      <circle cx="592" cy="180" r="96" fill="var(--c-mostaza-l)" />
      <polygon points="20,828 250,828 130,380" fill="var(--c-petroleo-d)" />
      <polygon points="160,828 300,828 230,540" fill="var(--c-petroleo-l)" />
      <polygon points="590,828 790,828 690,420" fill="var(--c-petroleo-d)" />
      <polygon points="510,828 650,828 580,560" fill="var(--c-petroleo-l)" />
      <path d="M0 770 Q200 660 400 745 T800 700 V828 H0 Z" fill="var(--c-mostaza-d)" />
      <rect y="828" width="800" height="72" fill="var(--c-petroleo-d)" />
    </svg>
    <div className="welcome__cards">
      <div className="welcome__card welcome__card--left">
        <BirdCard card={speciesCards.beltedKingfisher} mode="full" />
      </div>
      <div className="welcome__card welcome__card--right">
        <BirdCard card={speciesCards.annasHummingbird} mode="full" />
      </div>
      <div className="welcome__card welcome__card--center">
        <BirdCard card={speciesCards.baldEagle} mode="full" />
      </div>
    </div>
  </div>
);

interface ModeCardProps {
  variant: "solo" | "online";
  icon: IconName;
  title: string;
  description: string;
  disabled: boolean;
  describedBy?: string;
  onClick: () => void;
}

const ModeCard: React.FC<ModeCardProps> = ({ variant, icon, title, description, disabled, describedBy, onClick }) => (
  <button
    type="button"
    className={`mode-card mode-card--${variant}`}
    aria-disabled={disabled || undefined}
    aria-describedby={disabled ? describedBy : undefined}
    onClick={onClick}
  >
    <span className="mode-card__tile">
      <Icon name={icon} size={34} />
    </span>
    <span className="mode-card__chev">
      <Icon name="chev" size={20} ink="currentColor" />
    </span>
    <span className="mode-card__title">{title}</span>
    <span className="mode-card__desc">{description}</span>
  </button>
);

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
  // Se avisa que falta el nombre recién cuando se intenta avanzar sin él.
  const [nameMissing, setNameMissing] = useState(false);
  const hintId = useId();

  const validName = playerName.trim().length >= 1;
  const nameError = nameMissing && !validName ? "Escribí tu nombre para poder jugar." : undefined;

  const goTo = (next: Section) => {
    if (!validName) {
      setNameMissing(true);
      return;
    }
    setSection(next);
  };

  const handleStartSolo = () => {
    if (!validName) return setNameMissing(true);
    onStart({
      mode: "solo",
      playerName: playerName.trim(),
      botDifficulty: difficulty,
    });
  };

  const handleCreateRoom = () => {
    if (!validName) return setNameMissing(true);
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
    if (!validName) return setNameMissing(true);
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

  // ─── Portada ──────────────────────────────────────────────────────────────
  if (section === "welcome") {
    return (
      <div className="welcome">
        <WelcomeArt />
        <main className="welcome__main">
          <div className="welcome__brand">
            <img className="welcome__logo" src={logoUrl} alt="" width={56} height={56} />
            <h1 className="welcome__title">Wingspread</h1>
          </div>
          <p className="welcome__lead">Juego de construcción de motor ecológico inspirado en Wingspan</p>

          {/* Partida guardada: continuar donde se dejó */}
          {savedGame && onResumeSaved && (
            <section className="saved" aria-labelledby={`${hintId}-saved`}>
              <div className="saved__info">
                <div id={`${hintId}-saved`} className="saved__title">
                  <Icon name="clock" size={18} />
                  Partida en curso
                </div>
                <div className="saved__meta">
                  {savedGame.kind === "solo" ? "Modo solitario" : `Sala ${savedGame.roomCode}`} · Ronda {savedGame.round} ·
                  guardada {formatSavedAgo(savedGame.savedAt)}
                </div>
                {savedGame.kind === "online-host" && (
                  <div className="saved__meta">
                    Al continuar se reabre la sala: tu invitado se reconecta solo o con el mismo enlace.
                  </div>
                )}
              </div>
              <div className="saved__actions">
                <Button variant="primary" size="sm" onClick={onResumeSaved}>
                  Continuar
                </Button>
                {onDiscardSaved && (
                  <Button
                    iconOnly
                    icon="trash"
                    aria-label="Borrar la partida guardada"
                    title="Borrar la partida guardada"
                    onClick={onDiscardSaved}
                  />
                )}
              </div>
            </section>
          )}

          <Field
            label="¿Cómo te llamás?"
            icon="user"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Escribí tu nombre..."
            maxLength={24}
            autoFocus
            autoComplete="nickname"
            error={nameError}
            onKeyDown={(e) => {
              if (e.key === "Enter") goTo("solo");
            }}
          />

          <div className="mode-grid">
            <ModeCard
              variant="solo"
              icon="bot"
              title="Modo Solitario"
              description="Una partida 1 contra 1 contra la IA"
              disabled={!validName}
              describedBy={hintId}
              onClick={() => goTo("solo")}
            />
            <ModeCard
              variant="online"
              icon="globe"
              title="Multijugador Online"
              description="Creá o unite a una sala en tiempo real"
              disabled={!validName}
              describedBy={hintId}
              onClick={() => goTo("online")}
            />
          </div>

          {!validName && (
            <p id={hintId} className="welcome__hint">
              Ingresá tu nombre para comenzar
            </p>
          )}
        </main>
      </div>
    );
  }

  // ─── Modo solitario ───────────────────────────────────────────────────────
  if (section === "solo") {
    return (
      <div className="setup-page">
        <main className="setup-card">
          <Button size="sm" icon="back" onClick={() => setSection("welcome")}>
            Volver
          </Button>

          <header className="setup-card__head">
            <span className="setup-card__tile setup-card__tile--solo">
              <Icon name="bot" size={34} ink="var(--c-crema)" />
            </span>
            <div>
              <h1 className="setup-card__title">Modo Solitario</h1>
              <p className="setup-card__sub">Jugá contra un rival controlado por la IA</p>
            </div>
          </header>

          <Field
            label="Tu nombre"
            icon="user"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Tu nombre..."
            maxLength={24}
            error={nameError}
          />

          <fieldset className="options">
            <legend className="label">Dificultad del rival</legend>
            {(["easy", "normal", "hard"] as BotDifficulty[]).map((d) => (
              <label key={d} className={`option${difficulty === d ? " option--on" : ""}`}>
                <input
                  type="radio"
                  className="sr-only"
                  name="difficulty"
                  value={d}
                  checked={difficulty === d}
                  onChange={() => setDifficulty(d)}
                />
                <span>{difficultyLabels[d]}</span>
                {difficulty === d && <Icon name="check" size={22} ink="var(--c-crema)" />}
              </label>
            ))}
          </fieldset>

          <Button
            variant="primary"
            size="lg"
            disabled={!validName}
            disabledText="Escribí tu nombre para empezar"
            onClick={handleStartSolo}
          >
            Comenzar Partida Solitaria
          </Button>
        </main>
      </div>
    );
  }

  // ─── Multijugador online ──────────────────────────────────────────────────
  return (
    <div className="setup-page">
      <main className="setup-card setup-card--wide">
        <Button size="sm" icon="back" onClick={() => setSection("welcome")}>
          Volver
        </Button>

        <header className="setup-card__head">
          <span className="setup-card__tile setup-card__tile--online">
            <Icon name="globe" size={34} />
          </span>
          <div>
            <h1 className="setup-card__title">Multijugador Online</h1>
            <p className="setup-card__sub">Jugá con un amigo en tiempo real vía P2P</p>
          </div>
        </header>

        <Field
          label="Tu nombre"
          icon="user"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Tu nombre..."
          maxLength={24}
          error={nameError}
        />

        <section className="panel setup-card__create" aria-labelledby={`${hintId}-create`}>
          <h2 id={`${hintId}-create`} className="setup-card__block-title">
            <Icon name="plus" size={22} />
            Crear nueva sala
          </h2>
          <Field
            label="Nombre de tu oponente (opcional)"
            icon="user"
            value={opponentName}
            onChange={(e) => setOpponentName(e.target.value)}
            placeholder="Nombre de tu amigo... (o dejalo en blanco)"
            maxLength={24}
          />
          <Button
            variant="primary"
            size="lg"
            disabled={!validName}
            disabledText="Escribí tu nombre para empezar"
            onClick={handleCreateRoom}
          >
            Crear Sala y Compartir Enlace
          </Button>
        </section>

        <div className="divider" role="separator">
          <span className="label">O unirse a sala existente</span>
        </div>

        <form onSubmit={handleJoinRoom} noValidate>
          <Field
            label="Código de sala"
            icon="login"
            value={joinCode}
            onChange={(e) => handleJoinCodeChange(e.target.value)}
            placeholder="ej. halcon-428 (o pegá el enlace de invitación)"
            autoComplete="off"
            error={joinError || undefined}
            action={
              <Button type="submit" size="lg" icon="login" disabled={!validName}>
                Unirse
              </Button>
            }
            hint={
              joinCode.trim() && !joinError ? (
                parsedJoinCode ? (
                  <span className="status-line status-line--ok">
                    <Icon name="check" size={18} ink="var(--c-petroleo)" />
                    <span>
                      Te vas a unir a la sala: <strong>{parsedJoinCode}</strong>
                    </span>
                  </span>
                ) : (
                  "No reconocemos ese código o enlace todavía."
                )
              ) : undefined
            }
          />
        </form>
      </main>
    </div>
  );
};
