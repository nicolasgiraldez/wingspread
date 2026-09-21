import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  applyMove,
  applyPlayerMove,
  createInitialState,
  getActivatablePowers,
  isLegalMove,
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
  SpeciesCard,
} from "../game";
import { BirdCard } from "./components/BirdCard";
import { CardBack } from "./components/CardBack";
import { GameSidebar } from "./components/GameSidebar";
import { LogText } from "./components/LogText";
import { RivalActionPanel } from "./components/RivalActionPanel";
import { ToastRegion } from "./components/Toast";
import { GameTopBar } from "./components/GameTopBar";
import { Banner } from "./components/ui/Banner";
import { Button } from "./components/ui/Button";
import { ThinkingDots } from "./components/ui/ThinkingDots";
import { BirdFeeder } from "./components/BirdFeeder";
import { BirdMarket } from "./components/BirdMarket";
import { ChooseBonusCardModal } from "./components/ChooseBonusCardModal";
import { ConnectingScreen } from "./components/ConnectingScreen";
import { StartingHandModal } from "./components/StartingHandModal";
import { ConnectionStatusBar } from "./components/ConnectionStatusBar";
import { GameOverModal } from "./components/GameOverModal";
import { HabitatPowersModal } from "./components/HabitatPowersModal";
import { HomePage, HomePageConfig } from "./components/HomePage";
import { LayEggsModal } from "./components/LayEggsModal";
import { PlayBirdModal } from "./components/PlayBirdModal";
import { PlayerBoard } from "./components/PlayerBoard";
import { RoundGoalsMat } from "./components/RoundGoalsMat";
import { bonusNameTags } from "./labels";
import { applyGuestMove, GUEST_PLAYER_ID, HOST_PLAYER_ID } from "./network/hostGame";
import { classifyLog } from "./logEvents";
import { countOf, pressVerb } from "./text";
import { GameSpeedContext, loadSpeed, saveSpeed } from "./gameSpeed";
import type { GameSpeed } from "./gameSpeed";
import { BoardChangesContext, useBoardChangeTracker } from "./useBoardChanges";
import { useBotTurns } from "./useBotTurns";
import { useRemoteAction } from "./useRemoteAction";
import { useToasts } from "./useToasts";
import {
  clearSavedGame,
  isSaveBlocked,
  loadSavedGame,
  saveGame,
  subscribeSaveStatus,
  summarizeSavedGame,
} from "./savedGame";
import type { SavedGame } from "./savedGame";
import {
  ConnectionStatus,
  networkManager,
} from "./network/peerManager";

/** Jugadores con una carta de bonificación por elegir (al inicio o tras un poder de ave). */
function playersChoosingBonus(state: GameState): PlayerId[] {
  return state.playerOrder.filter((id) => (state.players[id]?.pendingBonusChoice?.length ?? 0) > 0);
}

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

  // Partida en curso guardada en el navegador (solitaria o sala del anfitrión), para reanudarla.
  const [savedGame, setSavedGame] = useState<SavedGame | null>(() => loadSavedGame());

  // Velocidad de la partida (pausas del rival y animaciones), recordada en este navegador.
  const [speed, setSpeed] = useState<GameSpeed>(loadSpeed);
  const handleSpeedChange = (next: GameSpeed) => {
    setSpeed(next);
    saveSpeed(next);
  };

  const [selectedCardForPlay, setSelectedCardForPlay] = useState<SpeciesCard | null>(null);
  // Carta de la mano elegida en el tablero (se muestra en la columna lateral con el botón "Jugar esta ave").
  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);
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

  // Avisos efímeros (turno, poderes, caza, ronda, errores) y aviso de guardado bloqueado.
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
  const toastSeen = useRef<{ log: number; round: number; myTurn: boolean } | null>(null);
  const saveBlocked = useSyncExternalStore(subscribeSaveStatus, isSaveBlocked);

  const gameStateRef = useRef<GameState | null>(null);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Guarda la partida tras cada cambio para poder continuarla si se recarga la página. El invitado
  // no guarda nada: el anfitrión es la fuente de verdad y le reenvía el estado al reconectar.
  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase === "gameEnd") {
      clearSavedGame();
    } else if (gameState.gameMode === "solo") {
      saveGame({ kind: "solo", state: gameState, savedAt: Date.now() });
    } else if (isHost && roomCode) {
      saveGame({ kind: "online-host", state: gameState, roomCode, savedAt: Date.now() });
    }
  }, [gameState, isHost, roomCode]);

  // Avisos por los mismos eventos que alimentan el registro: turno propio, poderes, caza y cambio de ronda.
  useEffect(() => {
    if (!gameState) {
      toastSeen.current = null;
      return;
    }
    const myTurn = gameState.phase === "round" && gameState.currentPlayerId === localPlayerId;
    const prev = toastSeen.current;
    toastSeen.current = { log: gameState.log.length, round: gameState.round, myTurn };
    // La primera vez (o al cargar una partida guardada) no se avisa de lo que ya pasó.
    if (!prev || gameState.log.length < prev.log) return;

    // Lo que hace el rival (la IA o el oponente online) lo cuenta el panel de acciones del rival, no un aviso.
    const byRival = (entry: { playerId?: PlayerId }) => !!entry.playerId && entry.playerId !== localPlayerId;
    const newEntries = gameState.log.slice(prev.log);
    for (const entry of newEntries) {
      if (byRival(entry)) continue;
      const event = classifyLog(entry);
      if (event.kind === "power") pushToast({ kind: "pow", title: `Poder de ${event.bird}`, text: <LogText text={event.text} /> });
      if (event.kind === "hunt") pushToast({ kind: "hunt", title: "¡Caza exitosa!", text: <LogText text={`Depredador [${event.bird}]: ${event.text}`} /> });
      if (event.kind === "miss") pushToast({ kind: "miss", title: "Caza fallida", text: <LogText text={`Depredador [${event.bird}]: ${event.text}`} /> });
    }
    if (gameState.phase === "round" && gameState.round > prev.round) {
      const left = 4 - gameState.round;
      pushToast({
        kind: "round",
        title: `Comienza la ronda ${gameState.round}`,
        text: `${left === 0 ? "Es la última ronda." : `${left === 1 ? "Queda" : "Quedan"} ${countOf(left, "ronda", "rondas")}.`} Revisá los objetivos de la ronda.`,
      });
    }
    if (myTurn && !prev.myTurn && !newEntries.some(byRival)) {
      pushToast({ kind: "turn", title: "Es tu turno", text: "Tomá una acción: jugar un ave, comida, huevos o cartas." });
    }
  }, [gameState, localPlayerId, pushToast]);

  // Cambia el estado y actualiza el ref al instante: el anfitrión procesa mensajes de red que
  // pueden llegar antes de que React re-renderice, y cada uno debe partir del estado más nuevo.
  const commitGameState = (next: GameState) => {
    gameStateRef.current = next;
    setGameState(next);
  };

  // En solitario la IA juega de a una jugada, con pausas, y cada una se anuncia en el panel del rival;
  // en online se anuncia lo que hizo el oponente cuando llega su jugada.
  const bot = useBotTurns(gameState, commitGameState, speed);
  const remote = useRemoteAction(gameState, localPlayerId, speed);
  const rivalAction = bot.action ?? remote.action;
  const dismissBotAction = bot.dismiss;
  const dismissRemoteAction = remote.dismiss;
  const dismissRivalAction = () => {
    dismissBotAction();
    dismissRemoteAction();
  };

  // Lo que cambió en la última jugada (aves, huevos, cartas, dados…), para animar solo eso.
  const boardChanges = useBoardChangeTracker(gameState);

  // ── Crear o reanudar una sala como anfitrión ──────────────────────────────
  const startHosting = (code: string, state: GameState, resume: boolean) => {
    commitGameState(state);
    setLocalPlayerId(HOST_PLAYER_ID);
    setActiveTab(HOST_PLAYER_ID);
    setIsHost(true);
    setRoomCode(code);
    setConnectionStatus("connecting");

    networkManager.initHost(
      code,
      {
        onStatusChange: (status, message) => {
          setConnectionStatus(status);
          if (message) setConnectionMessage(message);
          if (status === "connected") {
            const cur = gameStateRef.current;
            if (cur) networkManager.sendMessage({ type: "SYNC_STATE", state: cur, roomCode: code });
          }
        },
        onMessage: (msg: NetworkMessage) => {
          const cur = gameStateRef.current;
          if (!cur) return;

          if (msg.type === "GUEST_JOIN") {
            // Update guest's display name if provided (viene de la red: se sanea)
            const guestName = typeof msg.guestName === "string" ? msg.guestName.trim().slice(0, 30) : "";
            const guest = cur.players[GUEST_PLAYER_ID];
            const updated: GameState = {
              ...cur,
              players: { ...cur.players, [GUEST_PLAYER_ID]: { ...guest, name: guestName || guest.name } },
            };
            commitGameState(updated);
            networkManager.sendMessage({ type: "SYNC_STATE", state: updated, roomCode: code });
          }
          if (msg.type === "APPLY_MOVE") {
            // El jugador lo decide el anfitrión (siempre el invitado), no el mensaje.
            const result = applyGuestMove(cur, msg.move);
            if (result.ok) {
              commitGameState(result.state);
              networkManager.sendMessage({ type: "SYNC_STATE", state: result.state, roomCode: code });
            } else {
              console.warn("Movimiento del invitado rechazado:", result.reason);
              // Reenvía el estado real para que el invitado corrija cualquier desfase.
              networkManager.sendMessage({ type: "SYNC_STATE", state: cur, roomCode: code });
            }
          }
        },
      },
      { resume },
    );
  };

  // ── Partida guardada ──────────────────────────────────────────────────────
  const handleResumeSaved = () => {
    const saved = loadSavedGame();
    if (!saved) {
      setSavedGame(null);
      return;
    }
    networkManager.cleanup();
    setSelectedCardForPlay(null);
    if (saved.kind === "online-host") {
      startHosting(saved.roomCode, saved.state, true);
    } else {
      commitGameState(saved.state);
      setLocalPlayerId("nico");
      setActiveTab("nico");
      setIsHost(true);
      setRoomCode("");
      setConnectionStatus("disconnected");
    }
  };

  const handleDiscardSaved = () => {
    clearSavedGame();
    setSavedGame(null);
  };

  // ── Handle HomePage submission ────────────────────────────────────────────
  const handleHomeStart = (config: HomePageConfig) => {
    networkManager.cleanup();
    setSelectedCardForPlay(null);

    if (config.mode === "solo") {
      const customNames: Record<string, string> = {
        nico: config.playerName,
        bot: "Rival (IA)",
      };
      const state = createInitialState({
        mode: "solo",
        botDifficulty: config.botDifficulty ?? "normal",
        playerIds: ["nico", "bot"],
        customPlayerNames: customNames,
        // El primer jugador se sortea, como en el juego de mesa.
        firstPlayerId: Math.random() < 0.5 ? "nico" : "bot",
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
        [HOST_PLAYER_ID]: config.playerName,
        [GUEST_PLAYER_ID]: config.opponentName || "Invitado",
      };
      const state = createInitialState({
        mode: "online",
        playerIds: [HOST_PLAYER_ID, GUEST_PLAYER_ID],
        customPlayerNames: customNames,
        firstPlayerId: Math.random() < 0.5 ? HOST_PLAYER_ID : GUEST_PLAYER_ID,
      });
      startHosting(code, state, false);

    } else if (config.mode === "online-join") {
      const code = config.roomCode!;
      setLocalPlayerId(GUEST_PLAYER_ID);
      setActiveTab(GUEST_PLAYER_ID);
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
                [GUEST_PLAYER_ID]: { ...next.players[GUEST_PLAYER_ID], name: config.playerName },
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
    dismissRivalAction();
    setGameState(null);
    setSavedGame(loadSavedGame());
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
        setGameState(applyPlayerMove(gameState, localPlayerId, move));
      }
    } else if (gameState.gameMode === "online") {
      if (isHost) {
        if (isLegalMove(gameState, localPlayerId, move)) {
          const next = applyMove(gameState, localPlayerId, move);
          commitGameState(next);
          networkManager.sendMessage({ type: "SYNC_STATE", state: next, roomCode });
        }
      } else {
        sendGuestMove(move);
      }
    }
  };

  // El invitado no juega por sí mismo: pide la jugada al anfitrión. Si no hay conexión abierta
  // (p. ej. mientras reconecta) la jugada no llega, y se avisa en vez de perderla en silencio.
  const sendGuestMove = (move: Move) => {
    const sent = networkManager.sendMessage({ type: "APPLY_MOVE", move, playerId: localPlayerId });
    if (!sent) {
      pushToast({
        kind: "err",
        title: "Sin conexión con el anfitrión",
        text: "Tu jugada no se envió. Reintentá cuando vuelva.",
        action: { label: "Reintentar", onClick: () => sendGuestMove(move) },
      });
    }
  };

  // Como executeLocalMove, pero sin exigir que sea el turno del jugador local: la elección de
  // carta de bonificación inicial (fase "setup") es simultánea, no por turnos.
  const executeSetupMove = (move: Move) => {
    if (!gameState) return;

    if (gameState.gameMode === "solo") {
      if (isLegalMove(gameState, localPlayerId, move)) {
        setGameState(applyPlayerMove(gameState, localPlayerId, move));
      }
    } else if (gameState.gameMode === "online") {
      if (isHost) {
        if (isLegalMove(gameState, localPlayerId, move)) {
          const next = applyMove(gameState, localPlayerId, move);
          commitGameState(next);
          networkManager.sendMessage({ type: "SYNC_STATE", state: next, roomCode });
        }
      } else {
        sendGuestMove(move);
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
    setSelectedHandId(null);
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
    return <HomePage
        onStart={handleHomeStart}
        defaultJoinCode={urlJoinCode}
        savedGame={savedGame ? summarizeSavedGame(savedGame) : null}
        onResumeSaved={handleResumeSaved}
        onDiscardSaved={handleDiscardSaved}
      />;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerId];
  const viewedPlayer = gameState.players[activeTab];
  const myNameTags = bonusNameTags(gameState.players[localPlayerId]?.bonusCards);
  const isMyTurn = gameState.currentPlayerId === localPlayerId;
  const isControlsActive =
    isMyTurn &&
    (currentPlayer?.actionCubesAvailable ?? 0) > 0 &&
    gameState.phase === "round";

  const localPlayer = gameState.players[localPlayerId];
  const selectedHandCard =
    selectedHandId && localPlayer?.hand.includes(selectedHandId) ? (gameState.cards[selectedHandId] ?? null) : null;
  const playBlockedReason = !isMyTurn ? "No es tu turno" : !isControlsActive ? "Sin acciones disponibles" : null;
  const feederReason = !isMyTurn
    ? "Todavía no es tu turno. Los dados se activan cuando te toque jugar."
    : !isControlsActive
      ? "No tenés acciones disponibles en este momento."
      : undefined;

  return (
    <GameSpeedContext.Provider value={speed}>
      <BoardChangesContext.Provider value={boardChanges}>
        <div className="game" data-speed={speed}>
          <GameTopBar
            round={gameState.round}
            ended={gameState.phase === "gameEnd"}
            isMyTurn={isMyTurn}
            currentName={getDisplayName(gameState, gameState.currentPlayerId)}
            speed={speed}
            onSpeedChange={handleSpeedChange}
            onHome={handleGoHome}
          />

          <div className="game__body">
            <GameSidebar
              gameState={gameState}
              localPlayerId={localPlayerId}
              activeTab={activeTab}
              onSelectPlayer={setActiveTab}
              selectedCard={selectedHandCard}
              playBlockedReason={playBlockedReason}
              onPlayCard={() => selectedHandCard && setSelectedCardForPlay(selectedHandCard)}
            />

            <main className="table">
              {saveBlocked && (
                <Banner tone="warn" icon="alert" title="Partida sin guardar · almacenamiento bloqueado">
                  No se pudo guardar la partida en este navegador. El almacenamiento está lleno o bloqueado (modo privado). Podés seguir
                  jugando, pero no vas a poder reanudarla si cerrás la pestaña.
                </Banner>
              )}

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

              {/* De quién es el turno. Siempre ocupa el mismo lugar y alto: si apareciera y desapareciera, todo
                  lo de abajo (los dados, el mercado) saltaría justo cuando te devuelven el turno. */}
              {gameState.phase === "round" &&
                (isMyTurn ? (
                  <Banner tone="warn" icon="star" className="banner--turn">
                    <strong>Tu turno</strong> · Elegí una acción
                  </Banner>
                ) : (
                  <Banner tone="info" icon="hourglass" className="banner--turn">
                    <strong>Turno de {getDisplayName(gameState, gameState.currentPlayerId)}</strong>
                    {gameState.gameMode === "online" ? " · Esperando su jugada" : " · Está jugando"}
                    <ThinkingDots />
                  </Banner>
                ))}

              <RoundGoalsMat gameState={gameState} />

              <BirdFeeder
                feeder={gameState.feeder}
                onTakeDie={handleGainFood}
                onReroll={handleRerollFeeder}
                disabled={!isControlsActive}
                disabledReason={feederReason}
                waitingFor={!isMyTurn && gameState.phase === "round" ? getDisplayName(gameState, gameState.currentPlayerId) : undefined}
              />

              <BirdMarket
                marketCardIds={gameState.market}
                cardsCatalog={gameState.cards}
                deckCount={gameState.deck.length}
                onDrawMarketCard={handleDrawFromMarket}
                onDrawFromDeck={handleDrawFromDeck}
                disabled={!isControlsActive}
                disabledReason={playBlockedReason ?? undefined}
                highlightNameTags={myNameTags}
              />

              {viewedPlayer && (
                <PlayerBoard
                  player={viewedPlayer}
                  gameState={gameState}
                  isOwner={activeTab === localPlayerId}
                  highlightNameTags={activeTab === localPlayerId ? myNameTags : undefined}
                  onOpenLayEggsModal={handleOpenLayEggs}
                  isCurrentPlayerTurn={isControlsActive && activeTab === localPlayerId}
                />
              )}

              {/* Mano del rival: cartas ocultas (boca abajo) */}
              {activeTab !== localPlayerId && viewedPlayer && (
                <section className="hand hand--hidden" aria-labelledby="rival-hand-title">
                  <div className="hand__head">
                    <h2 id="rival-hand-title" className="label">
                      Mano de {getDisplayName(gameState, viewedPlayer.id)} · {countOf(viewedPlayer.hand.length, "carta oculta", "cartas ocultas")}
                    </h2>
                    <span className="hand__hint">Las cartas de la mano del rival permanecen en secreto</span>
                  </div>
                  {viewedPlayer.hand.length > 0 ? (
                    <div className="hand__cards">
                      {viewedPlayer.hand.map((_, i) => (
                        <CardBack key={i} title="Carta oculta en la mano del oponente" />
                      ))}
                    </div>
                  ) : (
                    <p className="hand__empty">{getDisplayName(gameState, viewedPlayer.id)} no tiene cartas en su mano actualmente.</p>
                  )}
                </section>
              )}

              {/* Tu mano */}
              {localPlayer && (
                <section className="hand" aria-labelledby="hand-title">
                  <div className="hand__head">
                    <h2 id="hand-title" className="label">
                      Tu mano · {countOf(localPlayer.hand.length, "carta", "cartas")}
                    </h2>
                    <span className="hand__hint">{pressVerb()} "Jugar esta ave" para colocarla en tu tablero</span>
                  </div>

                  {localPlayer.hand.length > 0 ? (
                    <div className="hand__cards">
                      {localPlayer.hand.map((cardId) => {
                        const card = gameState.cards[cardId];
                        if (!card) return null;
                        const isChosen = selectedHandCard?.id === cardId;
                        return (
                          <BirdCard
                            key={cardId}
                            card={card}
                            mode="hand"
                            entering={boardChanges.cards.has(cardId)}
                            highlightNameTags={myNameTags}
                            selected={isChosen}
                            lifted={isChosen}
                            onClick={() => setSelectedHandId(isChosen ? null : cardId)}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="hand__empty">
                      <p>Tu mano está vacía. Robá cartas del mercado o del mazo para jugar más aves.</p>
                      <Button
                        icon="stack"
                        onClick={() => document.getElementById("market")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      >
                        Ir al mercado
                      </Button>
                    </div>
                  )}
                </section>
              )}
            </main>
          </div>

          <RivalActionPanel action={rivalAction} onDismiss={dismissRivalAction} />
          <ToastRegion toasts={toasts} onDismiss={dismissToast} />

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

          {/* Preparación inicial: elegir aves, alimento y bonificación (o esperar a los demás). */}
          {gameState.phase === "setup" &&
            gameState.players[localPlayerId] &&
            (gameState.players[localPlayerId].pendingStartingHand ? (
              <StartingHandModal
                player={gameState.players[localPlayerId]}
                gameState={gameState}
                onConfirm={(move) => executeSetupMove(move)}
              />
            ) : (
              <ChooseBonusCardModal
                playerName={getDisplayName(gameState, localPlayerId)}
                options={[]}
                onChoose={() => {}}
                waiting={{
                  title: "Preparación lista",
                  text: "Esperando a que el resto de los jugadores termine la suya para empezar la Ronda 1...",
                }}
              />
            ))}

          {/* Carta de bonificación revelada por un poder de ave: hay que elegir cuál conservar. */}
          {gameState.phase !== "setup" &&
            gameState.players[localPlayerId] &&
            playersChoosingBonus(gameState).includes(localPlayerId) && (
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

          {/* El resultado final espera a que se resuelvan las bonificaciones que quedaron por elegir. */}
          {gameState.phase === "gameEnd" &&
            (playersChoosingBonus(gameState).length === 0 ? (
              <GameOverModal gameState={gameState} onRestart={handleGoHome} />
            ) : (
              !playersChoosingBonus(gameState).includes(localPlayerId) && (
                <ChooseBonusCardModal
                  playerName=""
                  options={[]}
                  onChoose={() => {}}
                  waiting={{
                    title: "Conteo final en pausa",
                    text: `Esperando a que ${playersChoosingBonus(gameState)
                      .map((id) => getDisplayName(gameState, id))
                      .join(" y ")} elija su carta de bonificación...`,
                  }}
                />
              )
            ))}
        </div>
      </BoardChangesContext.Provider>
    </GameSpeedContext.Provider>
  );
};
