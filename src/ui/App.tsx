import React, { useState } from "react";
import {
  Bird,
  Feather,
  Layers,
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
  GameState,
  HabitatId,
  Move,
  PlayerId,
  ResourceFace,
  SpeciesCard,
} from "../game";
import { BirdCard } from "./components/BirdCard";
import { BirdFeeder } from "./components/BirdFeeder";
import { BirdMarket } from "./components/BirdMarket";
import { GameOverModal } from "./components/GameOverModal";
import { PlayBirdModal } from "./components/PlayBirdModal";
import { PlayerBoard } from "./components/PlayerBoard";
import { RoundGoalsMat } from "./components/RoundGoalsMat";
import {
  actionLabels,
  habitatLabels,
  playerNames,
  resourceIcons,
  resourceLabels,
} from "./labels";

export const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialState(["nico", "santi"]),
  );
  const [selectedCardForPlay, setSelectedCardForPlay] = useState<SpeciesCard | null>(null);
  const [selectedHabitat, setSelectedHabitat] = useState<HabitatId>("forest");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<PlayerId>("nico");

  const currentPlayer = gameState.players[gameState.currentPlayerId];
  const viewedPlayer = gameState.players[activeTab];
  const isCurrentTurn = activeTab === gameState.currentPlayerId;

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

  const handleResetGame = () => {
    setGameState(createInitialState(["nico", "santi"]));
    setSelectedCardForPlay(null);
    setActiveTab("nico");
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
            <p>Juego de Motor Ecológico</p>
          </div>
        </div>

        {/* Active Turn Card */}
        <div className="status-card active-turn">
          <h4>Turno Actual</h4>
          <div className="player-title">
            {playerNames[gameState.currentPlayerId]}
          </div>
          <div>
            <span style={{ fontSize: "0.8rem", color: "#445" }}>
              Cubos de acción ({currentPlayer.actionCubesAvailable} restantes):
            </span>
            <div className="cubes-indicator">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`cube ${i >= currentPlayer.actionCubesAvailable ? "spent" : ""}`}
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
            VER TABLERO DE:
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
                {playerNames[pId]}
              </button>
            ))}
          </div>
        </div>

        {/* Resources for activeTab player */}
        <div className="status-card">
          <h4>Recursos de {playerNames[viewedPlayer.id]}</h4>
          <div className="resources-grid">
            {Object.entries(viewedPlayer.resources).map(([res, count]) => (
              <div key={res} className="resource-badge">
                <span>{resourceIcons[res as ResourceFace]} {resourceLabels[res as ResourceFace]}</span>
                <strong>{count ?? 0}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Bonus Cards for activeTab player */}
        <div className="status-card">
          <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={14} color="#235c3a" /> Cartas de Bonificación
          </h4>
          {viewedPlayer.bonusCards.length > 0 ? (
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
          onClick={handleResetGame}
          style={{ backgroundColor: "#b91c1c", marginTop: "auto", justifyContent: "center" }}
        >
          <RefreshCw size={14} /> Reiniciar Partida
        </button>
      </aside>

      {/* Main Game Area */}
      <main className="main-table">
        {/* 1. Round Goals Track */}
        <RoundGoalsMat gameState={gameState} />

        {/* 2. Birdfeeder Tray */}
        <BirdFeeder
          feeder={gameState.feeder}
          onTakeDie={handleGainFood}
          onReroll={handleRerollFeeder}
          disabled={!isCurrentTurn || currentPlayer.actionCubesAvailable <= 0}
        />

        {/* 3. Bird Market */}
        <BirdMarket
          marketCardIds={gameState.market}
          cardsCatalog={gameState.cards}
          deckCount={gameState.deck.length}
          onDrawMarketCard={handleDrawFromMarket}
          onDrawFromDeck={handleDrawFromDeck}
          disabled={!isCurrentTurn || currentPlayer.actionCubesAvailable <= 0}
        />

        {/* 4. Player Habitat Board */}
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
          isCurrentPlayerTurn={isCurrentTurn && currentPlayer.actionCubesAvailable > 0}
        />

        {/* 5. Player Hand */}
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
                    actionLabel={isCurrentTurn && currentPlayer.actionCubesAvailable > 0 ? "Jugar esta ave" : undefined}
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
      </main>

      {/* Play Bird Modal Dialog */}
      {selectedCardForPlay && (
        <PlayBirdModal
          card={selectedCardForPlay}
          player={currentPlayer}
          gameState={gameState}
          onConfirmPlay={handleConfirmPlayBird}
          onClose={() => setSelectedCardForPlay(null)}
        />
      )}

      {/* Game Over Victory Modal */}
      {gameState.phase === "gameEnd" && (
        <GameOverModal
          gameState={gameState}
          onRestart={handleResetGame}
        />
      )}
    </div>
  );
};
