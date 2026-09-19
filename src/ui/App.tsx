import React, { useEffect, useRef, useState } from "react";
import {
  Bird,
  Bot,
  Eye,
  EyeOff,
  Feather,
  Lock,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  applyMove,
  createInitialState,
  getActivatablePowers,
  isLegalMove,
  scorePlayerDetails,
} from "../game";
import type {
  BonusCard,
  DrawCardSelection,
  GameState,
  HabitatId,
  Move,
  NetworkMessage,
  PlayerId,
  PowerEggChoices,
  PowerMoveChoices,
  ResourceFace,
  SpeciesCard,
} from "../game";
import { AutomaPanel } from "./components/AutomaPanel";
import { BirdCard } from "./components/BirdCard";
import { BirdFeeder } from "./components/BirdFeeder";
import { BirdMarket } from "./components/BirdMarket";
import { ChooseBonusCardModal } from "./components/ChooseBonusCardModal";
import { ConnectingScreen } from "./components/ConnectingScreen";
import { ConnectionStatusBar } from "./components/ConnectionStatusBar";
import { GameOverModal } from "./components/GameOverModal";
import { HabitatPowersModal } from "./components/HabitatPowersModal";
import { HomePage, HomePageConfig } from "./components/HomePage";
import { LayEggsModal } from "./components/LayEggsModal";
import { PlayBirdModal } from "./components/PlayBirdModal";
import { PlayerBoard } from "./components/PlayerBoard";
import { RoundGoalsMat } from "./components/RoundGoalsMat";
import {
  bonusNameTags,
  resourceIcons,
  resourceLabels,
} from "./labels";
import {
  ConnectionStatus,
  networkManager,
} from "./network/peerManager";

// Helper: get display name from game state
function getDisplayName(state: GameState, playerId: PlayerId): string {
  return state.players[playerId]?.name || playerId;
}

export const App: React.FC = () => {
  // null = show homepage
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<PlayerId>("nico");
  const [roomCode, setRoomCode] = useState<string>("");
  const [isHost, setIsHost] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [connectionMessage, setConnectionMessage] = useState<string>("");
  const [urlJoinCode] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("room") || params.get("join") || "").trim().toLowerCase();
  });
  // Mientras el invitado espera el primer SYNC_STATE del anfitrión (todavía no hay gameState),
  // esto mantiene los datos necesarios para mostrar una pantalla de "conectando" en vez de
  // dejar la pantalla de inicio sin ningún indicio de que hay una conexión en curso.
  const [pendingOnlineJoin, setPendingOnlineJoin] = useState<
    { roomCode: string; playerName: string } | null
  >(null);

  const [selectedCardForPlay, setSelectedCardForPlay] = useState<SpeciesCard | null>(null);
  const [selectedHabitat, setSelectedHabitat] = useState<HabitatId>("forest");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<PlayerId>("nico");

  const [layEggsModalOpen, setLayEggsModalOpen] = useState<boolean>(false);
  const [layEggsInitialBird, setLayEggsInitialBird] = useState<
    { habitat: HabitatId; slotIndex: number } | undefined
  >(undefined);

  // Acciones pendientes de confirmación de poderes opcionales (bosque/río)
  const [pendingGainFood, setPendingGainFood] = useState<
    { dieIndex: number; wildChoice?: "insect" | "seed" } | null
  >(null);
  const [pendingDraw, setPendingDraw] = useState<DrawCardSelection[] | null>(null);

  const gameStateRef = useRef<GameState | null>(null);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // ── Handle HomePage submission ────────────────────────────────────────────
  const handleHomeStart = (config: HomePageConfig) => {
    networkManager.cleanup();
    setSelectedCardForPlay(null);

    if (config.mode === "solo") {
      const customNames: Record<string, string> = {
        nico: config.playerName,
        automa: "Automa (IA)",
      };
      const state = createInitialState({
        mode: "solo",
        automaDifficulty: config.automaDifficulty ?? "normal",
        playerIds: ["nico", "automa"],
        customPlayerNames: customNames,
      });
      setGameState(state);
      setLocalPlayerId("nico");
      setActiveTab("nico");
      setIsHost(true);
      setRoomCode("");
      setConnectionStatus("disconnected");

    } else if (config.mode === "online-host") {
      const code = config.roomCode!;
      const customNames: Record<string, string> = {
        nico: config.playerName,
        santi: config.opponentName || "Invitado",
      };
      const state = createInitialState({
        mode: "online",
        playerIds: ["nico", "santi"],
        customPlayerNames: customNames,
      });
      setGameState(state);
      setLocalPlayerId("nico");
      setActiveTab("nico");
      setIsHost(true);
      setRoomCode(code);
      setConnectionStatus("connecting");

      networkManager.initHost(code, {
        onStatusChange: (status, message) => {
          setConnectionStatus(status);
          if (message) setConnectionMessage(message);
          if (status === "connected") {
            const cur = gameStateRef.current;
            if (cur) networkManager.sendMessage({ type: "SYNC_STATE", state: cur, roomCode: code });
          }
        },
        onMessage: (msg: NetworkMessage) => {
          if (msg.type === "GUEST_JOIN") {
            // Update guest's display name if provided
            setGameState((prev) => {
              if (!prev) return prev;
              const updated = {
                ...prev,
                players: {
                  ...prev.players,
                  santi: { ...prev.players.santi, name: msg.guestName || prev.players.santi.name },
                },
              };
              networkManager.sendMessage({ type: "SYNC_STATE", state: updated, roomCode: code });
              return updated;
            });
          }
          if (msg.type === "APPLY_MOVE") {
            const cur = gameStateRef.current;
            if (!cur) return;
            if (isLegalMove(cur, msg.playerId, msg.move)) {
              const next = applyMove(cur, msg.playerId, msg.move);
              setGameState(next);
              networkManager.sendMessage({ type: "SYNC_STATE", state: next, roomCode: code });
            }
          }
        },
      });

    } else if (config.mode === "online-join") {
      const code = config.roomCode!;
      setLocalPlayerId("santi");
      setActiveTab("santi");
      setIsHost(false);
      setRoomCode(code);
      setConnectionStatus("connecting");
      setPendingOnlineJoin({ roomCode: code, playerName: config.playerName });

      networkManager.initGuest(code, {
        onStatusChange: (status, message) => {
          setConnectionStatus(status);
          if (message) setConnectionMessage(message);
          if (status === "connected") {
            // Tell host our name
            networkManager.sendMessage({ type: "GUEST_JOIN", guestName: config.playerName });
          }
        },
        onMessage: (msg: NetworkMessage) => {
          if (msg.type === "SYNC_STATE") {
            // Patch our local name in the state we receive
            const next = msg.state;
            // Keep our entered name in santi slot
            setGameState({
              ...next,
              players: {
                ...next.players,
                santi: { ...next.players.santi, name: config.playerName },
              },
            });
            setPendingOnlineJoin(null);
          }
        },
      });
    }
  };

  const handleCancelJoin = () => {
    networkManager.cleanup();
    setPendingOnlineJoin(null);
    setConnectionStatus("disconnected");
    setConnectionMessage("");
    setRoomCode("");
  };

  const handleRetryJoin = () => {
    if (!pendingOnlineJoin) return;
    handleHomeStart({
      mode: "online-join",
      playerName: pendingOnlineJoin.playerName,
      roomCode: pendingOnlineJoin.roomCode,
    });
  };

  // ── Return to homepage ────────────────────────────────────────────────────
  const handleGoHome = () => {
    networkManager.cleanup();
    setGameState(null);
    setConnectionStatus("disconnected");
    setConnectionMessage("");
    setRoomCode("");
    setSelectedCardForPlay(null);
    setPendingOnlineJoin(null);
  };

  // ── Game moves ────────────────────────────────────────────────────────────
  const executeLocalMove = (move: Move) => {
    if (!gameState) return;
    if (gameState.currentPlayerId !== localPlayerId) return;

    if (gameState.gameMode === "solo") {
      if (isLegalMove(gameState, localPlayerId, move)) {
        setGameState(applyMove(gameState, localPlayerId, move));
      }
    } else if (gameState.gameMode === "online") {
      if (isHost) {
        if (isLegalMove(gameState, localPlayerId, move)) {
          const next = applyMove(gameState, localPlayerId, move);
          setGameState(next);
          networkManager.sendMessage({ type: "SYNC_STATE", state: next, roomCode });
        }
      } else {
        networkManager.sendMessage({ type: "APPLY_MOVE", move, playerId: localPlayerId });
      }
    }
  };

  // Como executeLocalMove, pero sin exigir que sea el turno del jugador local: la elección de
  // carta de bonificación inicial (fase "setup") es simultánea, no por turnos.
  const executeSetupMove = (move: Move) => {
    if (!gameState) return;

    if (gameState.gameMode === "solo") {
      if (isLegalMove(gameState, localPlayerId, move)) {
        setGameState(applyMove(gameState, localPlayerId, move));
      }
    } else if (gameState.gameMode === "online") {
      if (isHost) {
        if (isLegalMove(gameState, localPlayerId, move)) {
          const next = applyMove(gameState, localPlayerId, move);
          setGameState(next);
          networkManager.sendMessage({ type: "SYNC_STATE", state: next, roomCode });
        }
      } else {
        networkManager.sendMessage({ type: "APPLY_MOVE", move, playerId: localPlayerId });
      }
    }
  };

  // Si el jugador no tiene aves con poderes "Al activar" en el hábitat correspondiente,
  // ejecutamos la acción directo (no hay nada que confirmar). Si tiene, abrimos el modal
  // para que decida qué poderes opcionales activar antes de resolver el movimiento.
  const handleGainFood = (dieIndex: number, wildChoice?: "insect" | "seed") => {
    const player = gameState?.players[localPlayerId];
    if (gameState && player && getActivatablePowers(gameState, player, "forest").length > 0) {
      setPendingGainFood({ dieIndex, wildChoice });
      return;
    }
    executeLocalMove({
      type: "gainFood",
      dieIndexes: [dieIndex],
      ...(wildChoice ? { wildChoices: { [dieIndex]: wildChoice } } : {}),
    });
  };

  const handleConfirmGainFood = (
    skipPowerIds: string[],
    powerCardChoices: Record<string, string>,
    powerEggChoices: PowerEggChoices,
    powerMoveChoices: PowerMoveChoices,
  ) => {
    if (!pendingGainFood) return;
    const { dieIndex, wildChoice } = pendingGainFood;
    executeLocalMove({
      type: "gainFood",
      dieIndexes: [dieIndex],
      ...(wildChoice ? { wildChoices: { [dieIndex]: wildChoice } } : {}),
      ...(skipPowerIds.length ? { skipPowerIds } : {}),
      ...(Object.keys(powerCardChoices).length ? { powerCardChoices } : {}),
      ...(Object.keys(powerEggChoices).length ? { powerEggChoices } : {}),
      ...(Object.keys(powerMoveChoices).length ? { powerMoveChoices } : {}),
    });
    setPendingGainFood(null);
  };

  const handleRerollFeeder = () =>
    executeLocalMove({ type: "rerollFeeder" });

  const executeOrConfirmDraw = (draws: DrawCardSelection[]) => {
    const player = gameState?.players[localPlayerId];
    if (gameState && player && getActivatablePowers(gameState, player, "wetland").length > 0) {
      setPendingDraw(draws);
      return;
    }
    executeLocalMove({ type: "drawBirdCards", draws });
  };

  const handleDrawFromDeck = () => executeOrConfirmDraw([{ source: "deck" }]);

  const handleDrawFromMarket = (cardId: string) =>
    executeOrConfirmDraw([{ source: "market", marketCardId: cardId }]);

  const handleConfirmDraw = (
    skipPowerIds: string[],
    powerCardChoices: Record<string, string>,
    powerEggChoices: PowerEggChoices,
    powerMoveChoices: PowerMoveChoices,
  ) => {
    if (!pendingDraw) return;
    executeLocalMove({
      type: "drawBirdCards",
      draws: pendingDraw,
      ...(skipPowerIds.length ? { skipPowerIds } : {}),
      ...(Object.keys(powerCardChoices).length ? { powerCardChoices } : {}),
      ...(Object.keys(powerEggChoices).length ? { powerEggChoices } : {}),
      ...(Object.keys(powerMoveChoices).length ? { powerMoveChoices } : {}),
    });
    setPendingDraw(null);
  };

  const handleOpenLayEggs = (initialBird?: { habitat: HabitatId; slotIndex: number }) => {
    setLayEggsInitialBird(initialBird);
    setLayEggsModalOpen(true);
  };

  const handleConfirmLayEggs = (move: Extract<Move, { type: "layEggs" }>) => {
    executeLocalMove(move);
    setLayEggsModalOpen(false);
    setLayEggsInitialBird(undefined);
  };

  const handleConfirmPlayBird = (move: Extract<Move, { type: "playBird" }>) => {
    executeLocalMove(move);
    setSelectedCardForPlay(null);
  };

  // ── Show HomePage / connecting screen ─────────────────────────────────────
  if (!gameState) {
    if (pendingOnlineJoin) {
      return (
        <ConnectingScreen
          roomCode={pendingOnlineJoin.roomCode}
          playerName={pendingOnlineJoin.playerName}
          status={connectionStatus}
          statusMessage={connectionMessage}
          onCancel={handleCancelJoin}
          onRetry={handleRetryJoin}
        />
      );
    }
    return <HomePage onStart={handleHomeStart} defaultJoinCode={urlJoinCode} />;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerId];
  const viewedPlayer = gameState.players[activeTab];
  const myNameTags = bonusNameTags(gameState.players[localPlayerId]?.bonusCards);
  const isMyTurn = gameState.currentPlayerId === localPlayerId;
  const isControlsActive =
    isMyTurn &&
    (currentPlayer?.actionCubesAvailable ?? 0) > 0 &&
    gameState.phase === "round";

  return (
    <div className="app-shell">
      {/* ── Side Panel ───────────────────────────────────────────────────── */}
      <aside className="side-panel">
        <div className="brand">
          <div className="brand-icon">
            <Bird size={28} />
          </div>
          <div>
            <h1>Wingspread</h1>
            <p>
              {gameState.gameMode === "solo"
                ? "Modo Solitario (vs Automa)"
                : "Multijugador Online (P2P)"}
            </p>
          </div>
        </div>

        {/* Active Turn */}
        <div className={`status-card ${isMyTurn ? "active-turn" : ""}`}>
          <h4>Turno Actual</h4>
          <div className="player-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {currentPlayer?.isAutoma ? <Bot size={20} /> : null}
            {getDisplayName(gameState, gameState.currentPlayerId)}
            {gameState.currentPlayerId === localPlayerId && (
              <span style={{ fontSize: "0.75rem", color: "var(--color-forest)", fontWeight: 700 }}>(Tú)</span>
            )}
          </div>
          <div>
            <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
              Cubos de acción ({currentPlayer?.actionCubesAvailable ?? 0} restantes):
            </span>
            <div className="cubes-indicator">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`cube ${i >= (currentPlayer?.actionCubesAvailable ?? 0) ? "spent" : ""}`}
                />
              ))}
            </div>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", marginTop: 2 }}>
            Ronda <strong>{gameState.round}</strong> de 4{" "}
            {gameState.phase === "gameEnd" ? "(Terminada)" : ""}
          </div>
        </div>

        {/* Scoreboard */}
        <div className="status-card">
          <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Trophy size={14} color="var(--color-grassland)" /> Puntuación en Vivo
          </h4>
          {gameState.playerOrder.map((pId) => {
            const scoreDetails = scorePlayerDetails(gameState, pId);
            return (
              <div
                key={pId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 0",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <span>
                  <strong>{getDisplayName(gameState, pId)}</strong>
                  {pId === localPlayerId && (
                    <small style={{ color: "var(--color-forest)" }}> (Tú)</small>
                  )}
                  {gameState.firstPlayerId === pId && (
                    <span style={{ fontSize: "0.7rem", color: "var(--color-forest)", marginLeft: 4 }}>
                      (1er jugador)
                    </span>
                  )}
                </span>
                <strong style={{ color: "var(--color-forest)" }}>{scoreDetails.total} pts</strong>
              </div>
            );
          })}
        </div>

        {/* View tabs */}
        <div>
          <h4 style={{ margin: "0 0 6px 0", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>VER VISTA DE:</h4>
          <div style={{ display: "flex", gap: 8 }}>
            {gameState.playerOrder.map((pId) => (
              <button
                key={pId}
                onClick={() => setActiveTab(pId)}
                style={{
                  flex: 1,
                  backgroundColor: activeTab === pId ? "var(--color-forest-strong)" : "var(--color-panel-bg-raised)",
                  color: activeTab === pId ? "#ffffff" : "var(--color-text)",
                  justifyContent: "center",
                  fontSize: "0.8rem",
                }}
              >
                {gameState.players[pId]?.isAutoma
                  ? "Automa"
                  : pId === localPlayerId
                  ? `${getDisplayName(gameState, pId)} (Tú)`
                  : getDisplayName(gameState, pId)}
              </button>
            ))}
          </div>
        </div>

        {/* Resources */}
        {viewedPlayer && !viewedPlayer.isAutoma && (
          <div className="status-card">
            <h4>Recursos de {getDisplayName(gameState, viewedPlayer.id)}</h4>
            <div className="resources-grid">
              {Object.entries(viewedPlayer.resources ?? {}).map(([res, count]) => (
                <div key={res} className="resource-badge">
                  <span>
                    {resourceIcons[res as ResourceFace]} {resourceLabels[res as ResourceFace]}
                  </span>
                  <strong>{count ?? 0}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bonus cards */}
        {viewedPlayer && !viewedPlayer.isAutoma && (
          <div className="status-card">
            <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={14} color="var(--color-forest)" /> Cartas de Bonificación
            </h4>
            {activeTab === localPlayerId || gameState.phase === "gameEnd" ? (
              viewedPlayer.bonusCards?.length > 0 ? (
                viewedPlayer.bonusCards.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      fontSize: "0.8rem",
                      background: "var(--color-panel-bg-raised)",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid var(--color-border)",
                      marginTop: 4,
                    }}
                  >
                    <strong>{b.name}</strong>
                    <p style={{ margin: "2px 0 0 0", color: "var(--color-text-secondary)" }}>{b.description}</p>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>Sin cartas de bonificación</span>
              )
            ) : (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--color-text-secondary)",
                  background: "var(--color-panel-bg-alt)",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px dashed var(--color-border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Lock size={15} color="var(--color-text-dim)" />
                <div>
                  <strong>{viewedPlayer.bonusCards?.length ?? 0} carta(s) secreta(s)</strong>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: 2 }}>
                    Se revelan al finalizar la partida.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Activity log */}
        <div className="status-card" style={{ maxHeight: 160, overflowY: "auto" }}>
          <h4>Registro de Acciones</h4>
          {gameState.log.slice(-6).map((entry, idx) => (
            <div key={idx} style={{ fontSize: "0.75rem", padding: "2px 0", color: "var(--color-text-secondary)" }}>
              {entry.playerId ? (
                <strong>[{getDisplayName(gameState, entry.playerId)}]: </strong>
              ) : (
                ""
              )}
              {entry.message}
            </div>
          ))}
        </div>

        <button
          onClick={handleGoHome}
          style={{ backgroundColor: "var(--color-forest-strong)", marginTop: "auto", justifyContent: "center" }}
        >
          <RefreshCw size={14} /> Nueva Partida / Inicio
        </button>
      </aside>

      {/* ── Main Table ───────────────────────────────────────────────────── */}
      <main className="main-table">
        {/* Online connection bar */}
        {gameState.gameMode === "online" && (
          <ConnectionStatusBar
            roomCode={roomCode}
            isHost={isHost}
            status={connectionStatus}
            statusMessage={connectionMessage}
            localPlayerName={getDisplayName(gameState, localPlayerId)}
          />
        )}

        {/* Waiting banner */}
        {gameState.gameMode === "online" && !isMyTurn && gameState.phase === "round" && (
          <div
            style={{
              background: "var(--color-grassland-bg)",
              border: "1px solid var(--color-grassland-border)",
              padding: "10px 16px",
              borderRadius: 8,
              color: "var(--color-grassland)",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            ⏳ Turno de {getDisplayName(gameState, gameState.currentPlayerId)}... Esperando su
            jugada en tiempo real.
          </div>
        )}

        <RoundGoalsMat gameState={gameState} />

        {gameState.gameMode === "solo" && gameState.automaState && gameState.players.automa && (
          <AutomaPanel
            automaState={gameState.automaState}
            automaPlayer={gameState.players.automa}
            gameState={gameState}
          />
        )}

        <BirdFeeder
          feeder={gameState.feeder}
          onTakeDie={handleGainFood}
          onReroll={handleRerollFeeder}
          disabled={!isControlsActive}
        />

        <BirdMarket
          marketCardIds={gameState.market}
          cardsCatalog={gameState.cards}
          deckCount={gameState.deck.length}
          onDrawMarketCard={handleDrawFromMarket}
          onDrawFromDeck={handleDrawFromDeck}
          disabled={!isControlsActive}
          highlightNameTags={myNameTags}
        />

        {/* Selector de Tablero */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>
            Tablero mostrado:
          </span>
          {gameState.playerOrder.map((pId) => {
            const isMe = pId === localPlayerId;
            const isAut = gameState.players[pId]?.isAutoma;
            const pName = getDisplayName(gameState, pId);
            const isCurrentActive = activeTab === pId;

            return (
              <button
                key={pId}
                onClick={() => setActiveTab(pId)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: isCurrentActive ? "2px solid var(--color-forest)" : "1px solid var(--color-border-light)",
                  backgroundColor: isCurrentActive ? "var(--color-forest-strong)" : "var(--color-panel-bg)",
                  color: isCurrentActive ? "#ffffff" : "var(--color-text)",
                  fontWeight: isCurrentActive ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.85rem",
                  transition: "all 0.15s ease",
                }}
              >
                {isMe ? <Feather size={14} /> : isAut ? <Bot size={14} /> : <Eye size={14} />}
                {isMe ? `Mi Tablero (${pName})` : isAut ? "Tablero Automa" : `Tablero de ${pName}`}
                {!isMe && !isAut && (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      opacity: 0.9,
                      background: isCurrentActive ? "rgba(255,255,255,0.2)" : "var(--color-panel-bg-raised)",
                      color: isCurrentActive ? "#ffffff" : "var(--color-forest)",
                      padding: "1px 6px",
                      borderRadius: 10,
                      fontWeight: 600,
                    }}
                  >
                    {gameState.players[pId]?.hand?.length ?? 0} en mano
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {viewedPlayer && !viewedPlayer.isAutoma && (
          <PlayerBoard
            player={viewedPlayer}
            gameState={gameState}
            isOwner={activeTab === localPlayerId}
            highlightNameTags={activeTab === localPlayerId ? myNameTags : undefined}
            onOpenLayEggsModal={handleOpenLayEggs}
            onSelectEmptySlot={(hab, sIdx) => {
              setSelectedHabitat(hab);
              setSelectedSlotIndex(sIdx);
            }}
            selectedHabitat={selectedHabitat}
            selectedSlotIndex={selectedSlotIndex}
            isCurrentPlayerTurn={isControlsActive && activeTab === localPlayerId}
          />
        )}

        {/* Opponent's Hand (Cartas ocultas / boca abajo) */}
        {activeTab !== localPlayerId && viewedPlayer && !viewedPlayer.isAutoma && (
          <section
            style={{
              background: "var(--color-panel-bg-alt)",
              padding: 16,
              borderRadius: 16,
              border: "1px dashed var(--color-border-light)",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <EyeOff size={18} color="var(--color-text-muted)" />
                <h4 style={{ margin: 0, fontSize: "1rem", color: "var(--color-text)" }}>
                  Mano de {getDisplayName(gameState, viewedPlayer.id)} ({viewedPlayer.hand.length} carta{viewedPlayer.hand.length !== 1 ? "s" : ""} oculta{viewedPlayer.hand.length !== 1 ? "s" : ""})
                </h4>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                🔒 Las cartas de la mano del rival permanecen en secreto
              </span>
            </div>

            {viewedPlayer.hand.length > 0 ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {viewedPlayer.hand.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 95,
                      height: 130,
                      borderRadius: 10,
                      background: "linear-gradient(145deg, #1c4a2e 0%, #0a1a10 100%)",
                      border: "2px solid #2c5c3f",
                      boxShadow: "0 3px 6px rgba(0,0,0,0.35)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#dcebe1",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      textAlign: "center",
                      padding: 6,
                      userSelect: "none",
                    }}
                    title="Carta oculta en la mano del oponente"
                  >
                    <Bird size={24} style={{ marginBottom: 6, opacity: 0.85, color: "#7fce9c" }} />
                    <span style={{ letterSpacing: "0.5px" }}>Wingspread</span>
                    <span style={{ fontSize: "0.62rem", opacity: 0.7, marginTop: 4, background: "rgba(255,255,255,0.12)", padding: "1px 6px", borderRadius: 6 }}>
                      Oculta #{i + 1}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 10, color: "var(--color-text-dim)", fontSize: "0.85rem" }}>
                {getDisplayName(gameState, viewedPlayer.id)} no tiene cartas en su mano actualmente.
              </div>
            )}
          </section>
        )}

        {/* Local Player's Hand */}
        {gameState.players[localPlayerId] && (
          <section
            style={{
              background: "var(--color-panel-bg)",
              padding: 18,
              borderRadius: 16,
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Feather size={20} color="var(--color-forest)" />
                <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
                  Tu Mano ({getDisplayName(gameState, localPlayerId)}) — {gameState.players[localPlayerId].hand.length} carta
                  {gameState.players[localPlayerId].hand.length !== 1 ? "s" : ""}
                </h3>
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                Haz clic en "Jugar esta ave" para colocarla en tu tablero
              </span>
            </div>

            {gameState.players[localPlayerId].hand.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                  gap: 12,
                }}
              >
                {gameState.players[localPlayerId].hand.map((cardId) => {
                  const card = gameState.cards[cardId];
                  if (!card) return null;
                  return (
                    <BirdCard
                      key={cardId}
                      card={card}
                      highlightNameTags={myNameTags}
                      actionLabel={isControlsActive ? "Jugar esta ave" : undefined}
                      onAction={() => setSelectedCardForPlay(card)}
                    />
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-dim)" }}>
                Tu mano está vacía. Roba cartas del mercado o del mazo para jugar más aves.
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {selectedCardForPlay && gameState.players[localPlayerId] && (
        <PlayBirdModal
          card={selectedCardForPlay}
          player={gameState.players[localPlayerId]}
          gameState={gameState}
          onConfirmPlay={handleConfirmPlayBird}
          onClose={() => setSelectedCardForPlay(null)}
        />
      )}

      {layEggsModalOpen && gameState.players[localPlayerId] && (
        <LayEggsModal
          player={gameState.players[localPlayerId]}
          gameState={gameState}
          initialBird={layEggsInitialBird}
          onConfirmLayEggs={handleConfirmLayEggs}
          onClose={() => {
            setLayEggsModalOpen(false);
            setLayEggsInitialBird(undefined);
          }}
        />
      )}

      {pendingGainFood && gameState.players[localPlayerId] && (
        <HabitatPowersModal
          title="Confirmar: Obtener comida"
          subtitle="Tenés aves con poderes opcionales en el bosque. Elegí cuáles activar antes de confirmar."
          habitat="forest"
          player={gameState.players[localPlayerId]}
          gameState={gameState}
          onConfirm={handleConfirmGainFood}
          onClose={() => setPendingGainFood(null)}
        />
      )}

      {pendingDraw && gameState.players[localPlayerId] && (
        <HabitatPowersModal
          title="Confirmar: Robar cartas"
          subtitle="Tenés aves con poderes opcionales en el río. Elegí cuáles activar antes de confirmar."
          habitat="wetland"
          player={gameState.players[localPlayerId]}
          gameState={gameState}
          onConfirm={handleConfirmDraw}
          onClose={() => setPendingDraw(null)}
        />
      )}

      {gameState.phase === "setup" && gameState.players[localPlayerId] && (
        <ChooseBonusCardModal
          playerName={getDisplayName(gameState, localPlayerId)}
          options={
            (gameState.players[localPlayerId].pendingBonusChoice ?? [])
              .map((id) => gameState.bonusCardsCatalog?.[id])
              .filter((b): b is BonusCard => !!b)
          }
          onChoose={(bonusCardId) => executeSetupMove({ type: "chooseBonusCard", bonusCardId })}
        />
      )}

      {gameState.phase === "gameEnd" && (
        <GameOverModal gameState={gameState} onRestart={handleGoHome} />
      )}
    </div>
  );
};
