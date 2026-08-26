import React, { useState } from "react";
import {
  Bird,
  Bot,
  Feather,
  Layers,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import {
  applyMove,
  createInitialState,
  isLegalMove,
  scorePlayerDetails,
} from "../game";
import type {
  AutomaDifficulty,
  GameMode,
  GameState,
  HabitatId,
  Move,
  PlayerId,
  ResourceFace,
  SpeciesCard,
} from "../game";
import { AutomaPanel } from "./components/AutomaPanel";
import { BirdCard } from "./components/BirdCard";
import { BirdFeeder } from "./components/BirdFeeder";
import { BirdMarket } from "./components/BirdMarket";
import { GameOverModal } from "./components/GameOverModal";
import { PlayBirdModal } from "./components/PlayBirdModal";
import { PlayerBoard } from "./components/PlayerBoard";
import { RoundGoalsMat } from "./components/RoundGoalsMat";
import {
  actionLabels,
  difficultyLabels,
  habitatLabels,
  playerNames,
  resourceIcons,
  resourceLabels,
} from "./labels";

export const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialState({ mode: "solo", automaDifficulty: "normal" }),
  );
  const [selectedCardForPlay, setSelectedCardForPlay] = useState<SpeciesCard | null>(null);
  const [selectedHabitat, setSelectedHabitat] = useState<HabitatId>("forest");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<PlayerId>("nico");
  const [showModeModal, setShowModeModal] = useState<boolean>(false);

  const currentPlayer = gameState.players[gameState.currentPlayerId];
  const viewedPlayer = gameState.players[activeTab];
  const isCurrentTurn = activeTab === gameState.currentPlayerId && !currentPlayer?.isAutoma;

  const handleGainFood = (dieIndex: number) => {
    const move: Move = {
      type: "gainFood",
      dieIndexes: [dieIndex],
    };
    if (isLegalMove(gameState, gameState.currentPlayerId, move)) {
      setGameState(applyMove(gameState, gameState.currentPlayerId, move));
    }
  };

  const handleRerollFeeder = () => {
    const move: Move = { type: "rerollFeeder" };
    if (isLegalMove(gameState, gameState.currentPlayerId, move)) {
      setGameState(applyMove(gameState, gameState.currentPlayerId, move));
    }
  };

  const handleDrawFromDeck = () => {
    const move: Move = {
      type: "drawBirdCards",
      draws: [{ source: "deck" }],
    };
    if (isLegalMove(gameState, gameState.currentPlayerId, move)) {
      setGameState(applyMove(gameState, gameState.currentPlayerId, move));
    }
  };

  const handleDrawFromMarket = (cardId: string) => {
    const move: Move = {
      type: "drawBirdCards",
      draws: [{ source: "market", marketCardId: cardId }],
    };
    if (isLegalMove(gameState, gameState.currentPlayerId, move)) {
      setGameState(applyMove(gameState, gameState.currentPlayerId, move));
    }
  };

  const handleLayEggOnSlot = (habitat: HabitatId, slotIndex: number) => {
    const move: Move = {
      type: "layEggs",
      eggPlacements: [{ habitat, slotIndex }],
    };
    if (isLegalMove(gameState, gameState.currentPlayerId, move)) {
      setGameState(applyMove(gameState, gameState.currentPlayerId, move));
    }
  };

  const handleConfirmPlayBird = (move: Extract<Move, { type: "playBird" }>) => {
    if (isLegalMove(gameState, gameState.currentPlayerId, move)) {
      setGameState(applyMove(gameState, gameState.currentPlayerId, move));
      setSelectedCardForPlay(null);
    }
  };

  const handleStartGame = (mode: GameMode, difficulty: AutomaDifficulty = "normal") => {
    setGameState(createInitialState({ mode, automaDifficulty: difficulty }));
    setSelectedCardForPlay(null);
    setActiveTab("nico");
    setShowModeModal(false);
  };

  return (
    <div className="app-shell">
      {/* Side Navigation & Player Status Panel */}
      <aside className="side-panel">
        <div className="brand">
          <div className="brand-icon">
            <Bird size={28} />
          </div>
          <div>
            <h1>Wingspread</h1>
            <p>
              {gameState.gameMode === "solo" ? "Modo Solitario (vs Automa)" : "Modo 2 Jugadores Local"}
            </p>
          </div>
        </div>

        {/* Active Turn Card */}
        <div className="status-card active-turn">
          <h4>Turno Actual</h4>
          <div className="player-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {currentPlayer?.isAutoma ? <Bot size={20} /> : null}
            {playerNames[gameState.currentPlayerId]}
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
            Ronda <strong>{gameState.round}</strong> de 4 {gameState.phase === "gameEnd" ? "(Terminada)" : ""}
          </div>
        </div>

        {/* Live Scoreboard */}
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
                  <strong>{playerNames[pId]}</strong>
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

        {/* Player View Tabs */}
        <div>
          <h4 style={{ margin: "0 0 6px 0", fontSize: "0.8rem", color: "#667" }}>
            VER VISTA DE:
          </h4>
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
                  fontSize: "0.85rem",
                }}
              >
                {gameState.players[pId]?.isAutoma ? "Automa" : playerNames[pId]}
              </button>
            ))}
          </div>
        </div>

        {/* Resources for activeTab player (if not Automa) */}
        {!viewedPlayer?.isAutoma && (
          <div className="status-card">
            <h4>Recursos de {playerNames[viewedPlayer?.id]}</h4>
            <div className="resources-grid">
              {Object.entries(viewedPlayer?.resources ?? {}).map(([res, count]) => (
                <div key={res} className="resource-badge">
                  <span>{resourceIcons[res as ResourceFace]} {resourceLabels[res as ResourceFace]}</span>
                  <strong>{count ?? 0}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bonus Cards for activeTab player (if not Automa) */}
        {!viewedPlayer?.isAutoma && (
          <div className="status-card">
            <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={14} color="#235c3a" /> Cartas de Bonificación
            </h4>
            {viewedPlayer?.bonusCards && viewedPlayer.bonusCards.length > 0 ? (
              viewedPlayer.bonusCards.map((b) => (
                <div key={b.id} style={{ fontSize: "0.8rem", background: "#ffffff", padding: "6px 8px", borderRadius: 6, border: "1px solid #d2ded0", marginTop: 4 }}>
                  <strong>{b.name}</strong>
                  <p style={{ margin: "2px 0 0 0", color: "#556" }}>{b.description}</p>
                </div>
              ))
            ) : (
              <span style={{ fontSize: "0.8rem", color: "#889" }}>Sin cartas de bonificación</span>
            )}
          </div>
        )}

        {/* Game Activity Log */}
        <div className="status-card" style={{ maxHeight: 160, overflowY: "auto" }}>
          <h4>Registro de Acciones</h4>
          {gameState.log.slice(-6).map((entry, idx) => (
            <div key={idx} style={{ fontSize: "0.75rem", padding: "2px 0", color: "#445" }}>
              {entry.playerId ? <strong>[{playerNames[entry.playerId]}]: </strong> : ""}
              {entry.message}
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowModeModal(true)}
          style={{ backgroundColor: "#235c3a", marginTop: "auto", justifyContent: "center" }}
        >
          <RefreshCw size={14} /> Nueva Partida / Cambiar Modo
        </button>
      </aside>

      {/* Main Game Area */}
      <main className="main-table">
        {/* 1. Round Goals Track */}
        <RoundGoalsMat gameState={gameState} />

        {/* 2. Automa Panel (if Solo mode and viewing Automa or above table) */}
        {gameState.gameMode === "solo" && gameState.automaState && gameState.players.automa && (
          <AutomaPanel
            automaState={gameState.automaState}
            automaPlayer={gameState.players.automa}
            gameState={gameState}
          />
        )}

        {/* 3. Birdfeeder Tray */}
        <BirdFeeder
          feeder={gameState.feeder}
          onTakeDie={handleGainFood}
          onReroll={handleRerollFeeder}
          disabled={!isCurrentTurn || (currentPlayer?.actionCubesAvailable ?? 0) <= 0}
        />

        {/* 4. Bird Market */}
        <BirdMarket
          marketCardIds={gameState.market}
          cardsCatalog={gameState.cards}
          deckCount={gameState.deck.length}
          onDrawMarketCard={handleDrawFromMarket}
          onDrawFromDeck={handleDrawFromDeck}
          disabled={!isCurrentTurn || (currentPlayer?.actionCubesAvailable ?? 0) <= 0}
        />

        {/* 5. Player Habitat Board (for human player) */}
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
            isCurrentPlayerTurn={isCurrentTurn && (currentPlayer?.actionCubesAvailable ?? 0) > 0}
          />
        )}

        {/* 6. Human Player Hand */}
        {viewedPlayer && !viewedPlayer.isAutoma && (
          <section style={{ background: "#ffffff", padding: 18, borderRadius: 16, border: "1px solid #d2ded0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Feather size={20} color="#235c3a" />
                <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
                  Mano de {playerNames[viewedPlayer.id]} ({viewedPlayer.hand.length} carta{viewedPlayer.hand.length !== 1 ? "s" : ""})
                </h3>
              </div>
              <span style={{ fontSize: "0.8rem", color: "#667" }}>
                Haz clic en "Jugar esta ave" para colocarla en tu tablero
              </span>
            </div>

            {viewedPlayer.hand.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
                {viewedPlayer.hand.map((cardId) => {
                  const card = gameState.cards[cardId];
                  if (!card) return null;

                  return (
                    <BirdCard
                      key={cardId}
                      card={card}
                      actionLabel={isCurrentTurn && (currentPlayer?.actionCubesAvailable ?? 0) > 0 ? "Jugar esta ave" : undefined}
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

      {/* Play Bird Modal Dialog */}
      {selectedCardForPlay && viewedPlayer && !viewedPlayer.isAutoma && (
        <PlayBirdModal
          card={selectedCardForPlay}
          player={viewedPlayer}
          gameState={gameState}
          onConfirmPlay={handleConfirmPlayBird}
          onClose={() => setSelectedCardForPlay(null)}
        />
      )}

      {/* Mode Selection / Reset Modal */}
      {showModeModal && (
        <div className="modal-backdrop" onClick={() => setShowModeModal(false)}>
          <div className="modal-content" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Configurar Nueva Partida</h2>
            </div>
            <p style={{ margin: 0, color: "#556" }}>
              Selecciona cómo deseas jugar a Wingspread:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "#f8faf8", border: "1px solid #d2ded0", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Bot size={20} color="#235c3a" />
                  <strong>Modo Solitario (vs Automa)</strong>
                </div>
                <p style={{ margin: "0 0 10px 0", fontSize: "0.85rem", color: "#667" }}>
                  Enfréntate a la IA oficial con mazo de acciones y 3 niveles de desafío.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["easy", "normal", "hard"] as AutomaDifficulty[]).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => handleStartGame("solo", diff)}
                      style={{ flex: 1, fontSize: "0.8rem", justifyContent: "center", padding: "6px 8px" }}
                    >
                      {difficultyLabels[diff]}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: "#f8faf8", border: "1px solid #d2ded0", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Users size={20} color="#235c3a" />
                  <strong>Modo 2 Jugadores Local</strong>
                </div>
                <p style={{ margin: "0 0 10px 0", fontSize: "0.85rem", color: "#667" }}>
                  Partida local por turnos entre Nico y Santi en la misma pantalla.
                </p>
                <button
                  onClick={() => handleStartGame("local2p")}
                  style={{ width: "100%", justifyContent: "center", backgroundColor: "#235c3a" }}
                >
                  Iniciar Partida 2 Jugadores
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={() => setShowModeModal(false)} style={{ backgroundColor: "#e2e8f0", color: "#334155" }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Victory Modal */}
      {gameState.phase === "gameEnd" && (
        <GameOverModal
          gameState={gameState}
          onRestart={() => setShowModeModal(true)}
        />
      )}
    </div>
  );
};
