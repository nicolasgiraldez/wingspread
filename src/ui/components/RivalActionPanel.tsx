import React from "react";
import type { CSSProperties } from "react";
import type { RivalAction } from "../useBotTurns";
import type { StepDetail } from "../stepAnnouncement";
import { LogText } from "./LogText";
import { playerSymbol, playerSymbolName } from "./playerSymbols";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import type { IconName } from "./ui/iconNames";

const DETAIL_ICON: Record<StepDetail["kind"], IconName> = {
  power: "bird",
  hunt: "target",
  miss: "close",
};

const DETAIL_PREFIX: Record<StepDetail["kind"], string> = {
  power: "Poder de",
  hunt: "Depredador",
  miss: "Depredador",
};

interface RivalActionPanelProps {
  /** La acción a mostrar; null cuando no hay ninguna (el panel queda vacío pero el anuncio sigue activo). */
  action: RivalAction | null;
  onDismiss: () => void;
}

/**
 * Cuenta lo que acaba de hacer el rival: quién, qué jugada y qué poderes disparó. Es un panel propio,
 * fijo sobre la mesa y sin robar el foco. La región es siempre `role="status"` para que los lectores de
 * pantalla anuncien cada acción nueva; se cierra solo (ver `useBotTurns`) o con el botón.
 */
export const RivalActionPanel: React.FC<RivalActionPanelProps> = ({ action, onDismiss }) => (
  <div className="rival-region" role="status" aria-label="Acción del rival">
    {action && (
      <div
        key={action.id}
        className="rival-panel"
        style={{ "--hold": `${action.holdMs}ms` } as CSSProperties}
        data-rival-panel
      >
        <span className="rival-panel__tile" aria-hidden="true">
          <Icon name={playerSymbol(action.actorIndex)} size={28} />
        </span>
        <div className="rival-panel__body">
          <div className="rival-panel__who label">
            {action.actorName}
            <span className="sr-only"> ({playerSymbolName(action.actorIndex)})</span>
          </div>
          <p className="rival-panel__headline">
            <LogText text={action.headline} />
          </p>
          {action.details.length > 0 && (
            <ul className="rival-panel__details">
              {action.details.map((detail, i) => (
                <li key={i} className={`rival-panel__detail rival-panel__detail--${detail.kind}`}>
                  <Icon name={DETAIL_ICON[detail.kind]} size={20} />
                  <span>
                    <LogText text={`${DETAIL_PREFIX[detail.kind]} [${detail.bird}]: ${detail.text}`} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button iconOnly icon="close" className="rival-panel__close" aria-label="Cerrar aviso" title="Cerrar aviso" onClick={onDismiss} />
        <span className="rival-panel__bar" aria-hidden="true" />
      </div>
    )}
  </div>
);
