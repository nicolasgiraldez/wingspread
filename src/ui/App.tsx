import React, { useEffect, useRef, useState } from "react";
import {
  Bird,
  Bot,
  Feather,
  Globe,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  applyMove,
  createInitialState,
  isLegalMove,
  scorePlayerDetails,
} from "../game";
import type {
  AutomaDifficulty,
  GameState,
  HabitatId,
  Move,
  NetworkMessage,
  PlayerId,
  ResourceFace,
  SpeciesCard,
} from "../game";
import { AutomaPanel } from "./components/AutomaPanel";
import { BirdCard } from "./components/BirdCard";
import { BirdFeeder } from "./components/BirdFeeder";
import { BirdMarket } from "./components/BirdMarket";
import { ConnectionStatusBar } from "./components/ConnectionStatusBar";
import { GameOverModal } from "./components/GameOverModal";
import { HomePage, HomePageConfig } from "./components/HomePage";
import { PlayBirdModal } from "./components/PlayBirdModal";
import { PlayerBoard } from "./components/PlayerBoard";
import { RoundGoalsMat } from "./components/RoundGoalsMat";
import {
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
  const [urlJoinCode, setUrlJoinCode] = useState<string>("");

  const [selectedCardForPlay, setSelectedCardForPlay] = useState<SpeciesCard | null>(null);
  const [selectedHabitat, setSelectedHabitat] = useState<HabitatId>("forest");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<PlayerId>("nico");

  const gameStateRef = useRef<GameState | null>(null);
  gameStateRef.current = gameState;

  // Check URL for ?room= on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room") || params.get("join");
    if (roomParam) {
      setUrlJoinCode(roomParam.trim().toLowerCase());
    }
  }, []);

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
            setGameState((prev) => {
              const next = msg.state;
              // Keep our entered name in santi slot
              return {
                ...next,
                players: {
                  ...next.players,
                  santi: { ...next.players.santi, name: config.playerName },
                },
              };
            });
          }
        },
      });
    }
  };

  // ── Return to homepage ────────────────────────────────────────────────────
  const handleGoHome = () => {
    networkManager.cleanup();
    setGameState(null);
    setConnectionStatus("disconnected");
    setConnectionMessage("");
    setRoomCode("");
    setSelectedCardForPlay(null);
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

  const handleGainFood = (dieIndex: number) =>
    executeLocalMove({ type: "gainFood", dieIndexes: [dieIndex] });

  const handleRerollFeeder = () =>
    executeLocalMove({ type: "rerollFeeder" });

  const handleDrawFromDeck = () =>
    executeLocalMove({ type: "drawBirdCards", draws: [{ source: "deck" }] });

  const handleDrawFromMarket = (cardId: string) =>
    executeLocalMove({ type: "drawBirdCards", draws: [{ source: "market", marketCardId: cardId }] });

  const handleLayEggOnSlot = (habitat: HabitatId, slotIndex: number) =>
    executeLocalMove({ type: "layEggs", eggPlacements: [{ habitat, slotIndex }] });

  const handleConfirmPlayBird = (move: Extract<Move, { type: "playBird" }>) => {
    executeLocalMove(move);
    setSelectedCardForPlay(null);
  };

  // ── Show HomePage ─────────────────────────────────────────────────────────
  if (!gameState) {
    return <HomePage onStart={handleHomeStart} defaultJoinCode={urlJoinCode} />;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerId];
  const viewedPlayer = gameState.players[activeTab];
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
              <span style={{ fontSize: "0.75rem", color: "#235c3a", fontWeight: 700 }}>(Tú)</span>
            )}
          </div>
          <div>
            <span style={{ fontSize: "0.8rem", color: "#445" }}>
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
          <div style={{ fontSize: "0.8rem", color: "#556", marginTop: 2 }}>
            Ronda <strong>{gameState.round}</strong> de 4{" "}
            {gameState.phase === "gameEnd" ? "(Terminada)" : ""}
          </div>
        </div>

        {/* Scoreboard */}
        <div className="status-card">
          <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Trophy size={14} color="#9c6c16" /> Puntuación en Vivo
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
                  borderBottom: "1px solid #eef2ed",
                }}
              >
                <span>
                  <strong>{getDisplayName(gameState, pId)}</strong>
                  {pId === localPlayerId && (
                    <small style={{ color: "#235c3a" }}> (Tú)</small>
                  )}
                  {gameState.firstPlayerId === pId && (
                    <span style={{ fontSize: "0.7rem", color: "#235c3a", marginLeft: 4 }}>
                      (1er jugador)
                    </span>
                  )}
                </span>
                <strong style={{ color: "#235c3a" }}>{scoreDetails.total} pts</strong>
              </div>
            );
          })}
        </div>

        {/* View tabs */}
        <div>
          <h4 style={{ margin: "0 0 6px 0", fontSize: "0.8rem", color: "#667" }}>VER VISTA DE:</h4>
          <div style={{ display: "flex", gap: 8 }}>
            {gameState.playerOrder.map((pId) => (
              <button
                key={pId}
                onClick={() => setActiveTab(pId)}
                style={{
                  flex: 1,
                  backgroundColor: activeTab === pId ? "#235c3a" : "#eef2ed",
                  color: activeTab === pId ? "#ffffff" : "#334",
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
              <Sparkles size={14} color="#235c3a" /> Cartas de Bonificación
            </h4>
            {viewedPlayer.bonusCards?.length > 0 ? (
              viewedPlayer.bonusCards.map((b) => (
                <div
                  key={b.id}
                  style={{
                    fontSize: "0.8rem",
                    background: "#ffffff",
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid #d2ded0",
                    marginTop: 4,
                  }}
                >
                  <strong>{b.name}</strong>
                  <p style={{ margin: "2px 0 0 0", color: "#556" }}>{b.description}</p>
                </div>
              ))
            ) : (
              <span style={{ fontSize: "0.8rem", color: "#889" }}>Sin cartas de bonificación</span>
            )}
          </div>
        )}

        {/* Activity log */}
        <div className="status-card" style={{ maxHeight: 160, overflowY: "auto" }}>
          <h4>Registro de Acciones</h4>
          {gameState.log.slice(-6).map((entry, idx) => (
            <div key={idx} style={{ fontSize: "0.75rem", padding: "2px 0", color: "#445" }}>
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
          style={{ backgroundColor: "#235c3a", marginTop: "auto", justifyContent: "center" }}
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
            localPlayerId={localPlayerId}
          />
        )}

        {/* Waiting banner */}
        {gameState.gameMode === "online" && !isMyTurn && gameState.phase === "round" && (
          <div
            style={{
              background: "#fef3d6",
              border: "1px solid #ebdcb2",
              padding: "10px 16px",
              borderRadius: 8,
              color: "#9c6c16",
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
        />

        {viewedPlayer && !viewedPlayer.isAutoma && (
          <PlayerBoard
            player={viewedPlayer}
            gameState={gameState}
            onLayEggOnSlot={handleLayEggOnSlot}
            onSelectEmptySlot={(hab, sIdx) => {
              setSelectedHabitat(hab);
              setSelectedSlotIndex(sIdx);
            }}
            selectedHabitat={selectedHabitat}
            selectedSlotIndex={selectedSlotIndex}
            isCurrentPlayerTurn={isControlsActive && activeTab === localPlayerId}
          />
        )}

        {/* Hand */}
        {gameState.players[localPlayerId] && (
          <section
            style={{
              background: "#ffffff",
              padding: 18,
              borderRadius: 16,
              border: "1px solid #d2ded0",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Feather size={20} color="#235c3a" />
                <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
                  Tu Mano ({gameState.players[localPlayerId].hand.length} carta
                  {gameState.players[localPlayerId].hand.length !== 1 ? "s" : ""})
                </h3>
              </div>
              <span style={{ fontSize: "0.8rem", color: "#667" }}>
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
                      actionLabel={isControlsActive ? "Jugar esta ave" : undefined}
                      onAction={() => setSelectedCardForPlay(card)}
                    />
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: "#889" }}>
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

      {gameState.phase === "gameEnd" && (
        <GameOverModal gameState={gameState} onRestart={handleGoHome} />
      )}
    </div>
  );
};
