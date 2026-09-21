import React from "react";
import { scorePlayerDetails } from "../../game";
import type { GameState, HabitatId, PlayerId, ResourceFace, SpeciesCard } from "../../game";
import {
  costIcon,
  describePower,
  describePowerText,
  habitatIcons,
  habitatLabels,
  powerTimingLabels,
  resourceLabels,
} from "../labels";
import logoUrl from "../assets/logo.svg";
import { classifyLog } from "../logEvents";
import type { LogKind } from "../logEvents";
import { LogText } from "./LogText";
import { ActionCube } from "./ActionCube";
import { playerSymbol, playerSymbolName } from "./playerSymbols";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import type { IconName } from "./ui/iconNames";
import { RichText } from "./ui/RichText";

const RESERVE_ORDER: ResourceFace[] = ["seed", "fruit", "insect", "fish", "rodent"];
const HABITAT_ARTICLE: Record<HabitatId, string> = { forest: "el", grassland: "la", wetland: "el" };
const LOG_LIMIT = 6;

interface GameSidebarProps {
  gameState: GameState;
  localPlayerId: PlayerId;
  /** Jugador cuyo tablero se está viendo. */
  activeTab: PlayerId;
  onSelectPlayer: (id: PlayerId) => void;
  /** Carta de tu mano elegida para jugar, si hay. */
  selectedCard: SpeciesCard | null;
  /** Motivo por el que no se puede jugar ahora (null = se puede). */
  playBlockedReason: string | null;
  onPlayCard: () => void;
}

const displayName = (state: GameState, id: PlayerId) => state.players[id]?.name || id;

const LOG_ICON: Partial<Record<LogKind, { icon: IconName; label: string }>> = {
  power: { icon: "bird", label: "Poder de ave" },
  hunt: { icon: "target", label: "Caza exitosa" },
  miss: { icon: "close", label: "Caza fallida" },
  eggs: { icon: "egg", label: "Huevos" },
};

const Scoreboard: React.FC<Pick<GameSidebarProps, "gameState" | "localPlayerId" | "activeTab" | "onSelectPlayer">> = ({
  gameState,
  localPlayerId,
  activeTab,
  onSelectPlayer,
}) => (
  <section className="side-block" aria-labelledby="side-score" data-fingerprint>
    <h2 id="side-score" className="label side-block__title">
      Marcador
    </h2>
    <ul className="score-list">
      {gameState.playerOrder.map((id, index) => {
        const inTurn = gameState.currentPlayerId === id && gameState.phase !== "gameEnd";
        const viewed = activeTab === id;
        const isBot = !!gameState.players[id]?.botLevel;
        return (
          <li key={id}>
            <button
              type="button"
              className={`score${inTurn ? " score--turn" : ""}${viewed ? " score--viewed" : ""}`}
              aria-pressed={viewed}
              title={viewed ? "Estás viendo este tablero" : "Ver el tablero de este jugador"}
              onClick={() => onSelectPlayer(id)}
            >
              <Icon name={playerSymbol(index)} size={20} label={`Símbolo: ${playerSymbolName(index)}`} />
              <span className="score__name">
                <span>{displayName(gameState, id)}</span>
                {isBot && <Icon name="bot" size={18} />}
                {id === localPlayerId && <span className="score__mark">(Vos)</span>}
                {gameState.firstPlayerId === id && <span className="score__mark">1.º</span>}
                {inTurn && <span className="score__mark score__mark--turn">Turno</span>}
              </span>
              <span className="score__points">
                {scorePlayerDetails(gameState, id).total}
                <span className="sr-only"> puntos</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
    {activeTab !== localPlayerId && (
      <Banner tone="info" icon="bird" className="side-block__note">
        Viendo aves y recursos jugados por {displayName(gameState, activeTab)}
      </Banner>
    )}
  </section>
);

const ActionCubes: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  const current = gameState.players[gameState.currentPlayerId];
  const left = current?.actionCubesAvailable ?? 0;
  // Los cubos son del color del jugador en turno, el mismo de su símbolo en el marcador.
  const owner = Math.max(0, gameState.playerOrder.indexOf(gameState.currentPlayerId));
  return (
    <section className="side-block" aria-labelledby="side-cubes" data-fingerprint>
      <h2 id="side-cubes" className="label side-block__title">
        Cubos de acción
      </h2>
      <div className="cubes" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <ActionCube key={i} owner={owner} spent={i >= left} />
        ))}
      </div>
      <p className="side-block__text">
        {displayName(gameState, gameState.currentPlayerId)}: {left} {left === 1 ? "restante" : "restantes"}
      </p>
    </section>
  );
};

const Reserve: React.FC<Pick<GameSidebarProps, "gameState" | "localPlayerId" | "activeTab">> = ({
  gameState,
  localPlayerId,
  activeTab,
}) => {
  const viewed = gameState.players[activeTab];
  if (!viewed) return null;
  const eggs = (["forest", "grassland", "wetland"] as HabitatId[]).reduce(
    (sum, hab) => sum + viewed.board[hab].reduce((acc, slot) => acc + (slot.cardId ? slot.eggs : 0), 0),
    0,
  );
  return (
    <section className="side-block" aria-labelledby="side-reserve">
      <h2 id="side-reserve" className="label side-block__title">
        {activeTab === localPlayerId ? "Tu reserva" : `Reserva de ${displayName(gameState, activeTab)}`}
      </h2>
      <ul className="reserve">
        {RESERVE_ORDER.map((res) => (
          <li key={res} className="reserve__tile" title={resourceLabels[res]}>
            <Icon name={costIcon(res)} size={28} label={resourceLabels[res]} />
            <span className="reserve__count">{viewed.resources?.[res] ?? 0}</span>
          </li>
        ))}
        <li className="reserve__tile" title="Huevos en el tablero">
          <Icon name="egg" size={28} label="Huevos en el tablero" />
          <span className="reserve__count">{eggs}</span>
        </li>
      </ul>
    </section>
  );
};

const BonusPanel: React.FC<Pick<GameSidebarProps, "gameState" | "localPlayerId" | "activeTab">> = ({
  gameState,
  localPlayerId,
  activeTab,
}) => {
  const viewed = gameState.players[activeTab];
  if (!viewed) return null;
  const visible = activeTab === localPlayerId || gameState.phase === "gameEnd";
  const count = viewed.bonusCards?.length ?? 0;
  return (
    <section className="side-block" aria-labelledby="side-bonus">
      <h2 id="side-bonus" className="label side-block__title">
        Bonificación
      </h2>
      {visible ? (
        count > 0 ? (
          <ul className="bonus-list">
            {viewed.bonusCards.map((b) => (
              <li key={b.id} className="bonus-list__item">
                <strong>{b.name}</strong>
                <span>{b.description}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="side-block__text">Sin cartas de bonificación</p>
        )
      ) : (
        <p className="side-block__text">
          <strong>{count === 1 ? "1 carta secreta" : `${count} cartas secretas`}</strong>
          <br />
          Se revelan al finalizar la partida.
        </p>
      )}
    </section>
  );
};

const SelectedCard: React.FC<Pick<GameSidebarProps, "selectedCard" | "playBlockedReason" | "onPlayCard">> = ({
  selectedCard,
  playBlockedReason,
  onPlayCard,
}) => (
  <section className="selected-card" aria-labelledby="side-selected" data-selected-card>
    <h2 id="side-selected" className="selected-card__label">
      Carta seleccionada
    </h2>
    {selectedCard ? (
      <>
        <h3 className="selected-card__name">{selectedCard.name}</h3>
        <p className="selected-card__habitats">
          <span className="selected-card__habitat-icons">
            {selectedCard.habitats.map((hab) => (
              <span key={hab} className="selected-card__hab">
                <Icon name={habitatIcons[hab]} size={20} />
              </span>
            ))}
          </span>
          Se juega en {selectedCard.habitats.map((hab) => `${HABITAT_ARTICLE[hab]} ${habitatLabels[hab]}`).join(" o ")}
        </p>
        <p className="selected-card__cost" title="Coste">
          {Object.entries(selectedCard.cost).flatMap(([res, count]) =>
            Array.from({ length: count ?? 0 }, (_, i) => (
              <Icon key={`${res}${i}`} name={costIcon(res as ResourceFace)} size={24} label={resourceLabels[res as ResourceFace]} />
            )),
          )}
          {(selectedCard.costAnyOf ?? []).map((res, i) => (
            <React.Fragment key={res}>
              {i > 0 && "/"}
              <Icon name={costIcon(res)} size={24} label={resourceLabels[res]} />
            </React.Fragment>
          ))}
          {Object.keys(selectedCard.cost).length === 0 && !(selectedCard.costAnyOf?.length ?? 0) && "Gratis"}
        </p>
        {selectedCard.powers.length > 0 ? (
          <ul className="selected-card__powers">
            {selectedCard.powers.map((p) => (
              <li key={p.id} title={describePowerText(p)}>
                <strong>{powerTimingLabels[p.timing]}.</strong> <RichText text={describePower(p)} size={16} ink="var(--c-crema)" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="selected-card__none">Sin poder</p>
        )}
        <Button
          variant="primary"
          size="lg"
          disabled={!!playBlockedReason}
          disabledText={playBlockedReason ?? undefined}
          onClick={onPlayCard}
        >
          Jugar esta ave
        </Button>
      </>
    ) : (
      <p className="selected-card__none">Elegí un ave de tu mano para ver sus detalles y jugarla.</p>
    )}
  </section>
);

const ActionLog: React.FC<{ gameState: GameState }> = ({ gameState }) => (
  <section className="side-block" aria-labelledby="side-log" data-fingerprint>
    <h2 id="side-log" className="label side-block__title">
      Registro de acciones
    </h2>
    <ul className="log" role="log" aria-live="polite">
      {gameState.log.slice(-LOG_LIMIT).map((entry, idx) => {
        const event = classifyLog(entry);
        const special = LOG_ICON[event.kind];
        const playerIndex = entry.playerId ? gameState.playerOrder.indexOf(entry.playerId) : -1;
        return (
          <li key={idx} className="log__entry">
            <span className="log__tile">
              {special ? (
                <Icon name={special.icon} size={20} label={special.label} />
              ) : event.kind === "move" && playerIndex >= 0 ? (
                <Icon name={playerSymbol(playerIndex)} size={20} label={`Símbolo: ${playerSymbolName(playerIndex)}`} />
              ) : (
                <img src={logoUrl} alt="Sistema" width={20} height={20} />
              )}
            </span>
            <span className="log__text">
              {entry.playerId ? <strong>{displayName(gameState, entry.playerId)}: </strong> : null}
              <LogText text={entry.message} />
            </span>
          </li>
        );
      })}
    </ul>
  </section>
);

/** Columna izquierda: marcador, cubos, reserva, bonificación, carta seleccionada y registro. */
export const GameSidebar: React.FC<GameSidebarProps> = (props) => (
  <aside className="sidebar" aria-label="Estado de la partida">
    <Scoreboard {...props} />
    <ActionCubes gameState={props.gameState} />
    <Reserve {...props} />
    <BonusPanel {...props} />
    <ActionLog gameState={props.gameState} />
    <SelectedCard {...props} />
  </aside>
);
