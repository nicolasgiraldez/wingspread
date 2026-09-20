import React from "react";
import type { BonusCard } from "../../game";
import { BonusOption } from "./BonusOption";
import { Icon } from "./ui/Icon";
import { Modal } from "./ui/Modal";

interface ChooseBonusCardModalProps {
  playerName: string;
  /** Las cartas ofrecidas (ya resueltas desde el catálogo); vacío mientras se espera a otro jugador. */
  options: BonusCard[];
  onChoose: (bonusCardId: string) => void;
  /** Texto de espera cuando no hay nada que elegir. */
  waiting?: { title: string; text: string };
}

/**
 * Paso de setup previo a la Ronda 1: cada jugador recibe 2 cartas de bonificación al azar y
 * debe elegir 1 para conservar (la otra se descarta). En modo online, mientras el jugador local
 * ya eligió pero otro todavía no, se muestra un estado de espera en vez del selector.
 * Ambos son obligatorios: no hay botón de cerrar ni Esc.
 */
export const ChooseBonusCardModal: React.FC<ChooseBonusCardModalProps> = ({
  playerName,
  options,
  onChoose,
  waiting,
}) => {
  if (options.length === 0) {
    return (
      <Modal
        title={waiting?.title ?? "Esperando"}
        subtitle={waiting?.text ?? "Esperando al resto de los jugadores..."}
        icon={<Icon name="hourglass" size={40} />}
        iconStyle="round"
        align="center"
        width={640}
        className="modal--wait"
      />
    );
  }

  return (
    <Modal
      title={`${playerName}, elegí tu carta de bonificación`}
      subtitle={`Se revelaron ${options.length} cartas. Quedate con 1; el resto vuelve al descarte.`}
      icon={<Icon name="star" size={40} ink="var(--c-carbon)" />}
      iconStyle="bare"
      align="center"
      width={640}
    >
      <div className="bonus-row">
        {options.map((bonus) => (
          <BonusOption key={bonus.id} bonus={bonus} onChoose={() => onChoose(bonus.id)} />
        ))}
      </div>
    </Modal>
  );
};
