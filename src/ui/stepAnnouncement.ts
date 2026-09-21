import type { GameState, Move, PlayerId, ResourceFace } from "../game";
import { habitatArticle, habitatLabels } from "./labels";
import { classifyLog } from "./logEvents";
import { countOf } from "./text";

/** Un efecto que la jugada disparó: un poder de ave, una caza lograda o una caza fallida. */
export interface StepDetail {
  kind: "power" | "hunt" | "miss";
  bird: string;
  /** Texto del registro sin el prefijo; los [nombres] de aves se resaltan al mostrarlo. */
  text: string;
}

/** Lo que hizo un jugador en una jugada, listo para mostrarse en el panel de acciones del rival. */
export interface StepAnnouncement {
  actorId: PlayerId;
  actorName: string;
  /** Posición del jugador en la mesa: define su símbolo y su color. */
  actorIndex: number;
  /** Frase principal ("Jugó [Ave] en el Río."). Los [nombres] de aves se resaltan al mostrarla. */
  headline: string;
  details: StepDetail[];
}

const RESOURCE_COUNT: Record<ResourceFace, [string, string]> = {
  seed: ["semilla", "semillas"],
  fruit: ["fruta", "frutas"],
  insect: ["insecto", "insectos"],
  fish: ["pez", "peces"],
  rodent: ["roedor", "roedores"],
  wild: ["comodín", "comodines"],
};

/** "[A]", "[A] y [B]" o "[A], [B] y 2 más": nombres de aves sin repetir, en el formato del registro. */
function listBirds(names: string[]): string {
  const unique = [...new Set(names)];
  const tagged = unique.map((name) => `[${name}]`);
  if (tagged.length <= 2) return tagged.join(" y ");
  return `${tagged[0]}, ${tagged[1]} y ${unique.length - 2} más`;
}

function foodTaken(before: GameState, move: Extract<Move, { type: "gainFood" }>): string {
  const counts = new Map<ResourceFace, number>();
  for (const index of move.dieIndexes) {
    const face = before.feeder[index];
    if (!face) continue;
    const res = face === "wild" ? (move.wildChoices?.[index] ?? face) : face;
    counts.set(res, (counts.get(res) ?? 0) + 1);
  }
  const parts = [...counts].map(([res, n]) => countOf(n, ...RESOURCE_COUNT[res]));
  return parts.length ? parts.join(" y ") : "alimento";
}

function headlineFor(before: GameState, after: GameState, move: Move, actorId: PlayerId): string | null {
  switch (move.type) {
    case "playBird": {
      const name = after.cards[move.cardId]?.name ?? "un ave";
      return `Jugó [${name}] en ${habitatArticle[move.habitat]} ${habitatLabels[move.habitat]}.`;
    }
    case "gainFood": {
      const reroll = move.rerollBefore ? "Relanzó el comedero y tomó" : "Tomó";
      return `${reroll} ${foodTaken(before, move)} del comedero.`;
    }
    case "layEggs": {
      const board = before.players[actorId].board;
      const birds = move.eggPlacements.flatMap((ref) => {
        const cardId = board[ref.habitat][ref.slotIndex]?.cardId;
        const name = cardId ? before.cards[cardId]?.name : undefined;
        return name ? [name] : [];
      });
      const eggs = countOf(move.eggPlacements.length, "huevo", "huevos");
      return birds.length ? `Puso ${eggs} en ${listBirds(birds)}.` : `Puso ${eggs}.`;
    }
    case "drawBirdCards": {
      const fromMarket = move.draws.flatMap((draw) =>
        draw.source === "market" ? [before.cards[draw.marketCardId]?.name ?? "un ave"] : [],
      );
      const fromDeck = move.draws.filter((draw) => draw.source === "deck").length;
      const parts = [
        ...(fromMarket.length ? [`${listBirds(fromMarket)} del mercado`] : []),
        ...(fromDeck ? [`${countOf(fromDeck, "carta", "cartas")} del mazo`] : []),
      ];
      return `Robó ${parts.join(" y ") || "cartas"}.`;
    }
    case "rerollFeeder":
      return "Relanzó los dados del comedero.";
    // La preparación inicial y las cartas de bonificación se eligen sin anunciarlas.
    case "chooseStart":
    case "chooseBonusCard":
      return null;
  }
}

/**
 * Cuenta lo que hizo `actorId` con `move`, comparando el estado de antes con el de después: la frase
 * principal sale de la jugada y los poderes o cazas que disparó, de las entradas nuevas del registro.
 * Devuelve null si la jugada no se anuncia (preparación inicial, elección de bonificación).
 */
export function describeStep(
  before: GameState,
  after: GameState,
  move: Move,
  actorId: PlayerId,
): StepAnnouncement | null {
  const headline = headlineFor(before, after, move, actorId);
  if (!headline) return null;

  const details: StepDetail[] = [];
  for (const entry of after.log.slice(before.log.length)) {
    const event = classifyLog(entry);
    if ((event.kind === "power" || event.kind === "hunt" || event.kind === "miss") && event.bird) {
      details.push({ kind: event.kind, bird: event.bird, text: event.text });
    }
  }

  return {
    actorId,
    actorName: after.players[actorId]?.name || actorId,
    actorIndex: Math.max(0, after.playerOrder.indexOf(actorId)),
    headline,
    details,
  };
}
