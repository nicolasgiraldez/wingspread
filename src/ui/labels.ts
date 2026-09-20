import type { BonusCard, BotDifficulty, HabitatId, NameTag, NestType, Power, PowerTiming, ResourceFace, SpeciesCard } from "../game";
import type { IconName } from "./components/ui/iconNames";
import { plainText } from "./components/ui/richTextParts";
import { countOf } from "./text";

export const playerNames: Record<string, string> = {
  nico: "Nico",
  santi: "Santi",
  bot: "Rival (IA)",
};

export const difficultyLabels: Record<BotDifficulty, string> = {
  easy: "Fácil (Pichón)",
  normal: "Normal (Águila)",
  hard: "Difícil (Halcón)",
};

export const habitatLabels: Record<HabitatId, string> = {
  forest: "Bosque",
  grassland: "Pradera",
  wetland: "Río",
};

export const habitatIcons: Record<HabitatId, IconName> = {
  forest: "forest",
  grassland: "grass",
  wetland: "river",
};

/**
 * Carta de bonificación asociada a cada categoría de nombre curada en SpeciesCard.nameTags.
 * El diseño no define íconos para estas categorías: se identifican con la palabra (chip de texto).
 */
export const nameTagBonus: Record<NameTag, { label: string }> = {
  color: { label: "Fotógrafo" },
  bodyPart: { label: "Anatomista" },
  geographic: { label: "Cartógrafo" },
  possessive: { label: "Historiador" },
};

/** Categorías de nombre que puntúan alguna de las cartas de bonificación dadas. */
export function bonusNameTags(bonusCards: BonusCard[] | undefined): NameTag[] {
  return (bonusCards ?? []).flatMap((b) => (b.conditionType === "birdsWithNameTag" && b.nameTag ? [b.nameTag] : []));
}

export const resourceLabels: Record<ResourceFace, string> = {
  seed: "semilla",
  fruit: "fruta",
  insect: "insecto",
  fish: "pez",
  rodent: "roedor",
  wild: "comodín (gusano/trigo)",
};

/** Ícono de cada alimento. "wild" es el comodín de coste (cualquier alimento); la cara comodín del dado se dibuja aparte. */
export const resourceIcons: Record<ResourceFace, IconName> = {
  seed: "seed",
  fruit: "fruit",
  insect: "insect",
  fish: "fish",
  rodent: "rodent",
  wild: "wild",
};

/**
 * Etiqueta para "wild" cuando aparece como costo de comida de una carta (acepta CUALQUIER
 * tipo de alimento, no solo insecto/semilla). Distinto de resourceLabels.wild, que representa
 * específicamente la cara "comodín" del dado del comedero (ahí sí es insecto o semilla).
 */
const wildCostLabel = "comodín (cualquier alimento)";

export function costIcon(res: ResourceFace): IconName {
  return resourceIcons[res];
}

export function costLabel(res: ResourceFace): string {
  return res === "wild" ? wildCostLabel : resourceLabels[res];
}

export const nestLabels: Record<NestType, string> = {
  bowl: "Nido de copa",
  cavity: "Nido en cavidad",
  platform: "Nido de plataforma",
  ground: "Nido en suelo",
  wild: "Nido comodín",
};

export const nestIcons: Record<NestType, IconName> = {
  bowl: "bowl",
  cavity: "cavity",
  platform: "platform",
  ground: "ground",
  wild: "nestwild",
};

/** Marcador de ícono para incrustar un alimento dentro de un texto (se dibuja con <RichText>). */
const ico = (res: ResourceFace) => `{${resourceIcons[res]}}`;
const eggs = (n: number) => countOf(n, "huevo", "huevos");
const cards = (n: number) => countOf(n, "carta", "cartas");

/**
 * Descripción legible de un poder, usada tanto en BirdCard como en los checklists de activación.
 * Los alimentos van como marcadores ({seed}, {fruit}…): mostralos con <RichText>, o usá describePowerText
 * para el texto plano (title / aria-label).
 */
export function describePower(power: Power): string {
  switch (power.kind) {
    case "gainResource": {
      if (power.gainAllMatching) {
        return `Obtené TODOS los ${power.resource ? ico(power.resource) : "dados"} que haya en el comedero`;
      }
      if (power.anyDie) {
        return "Obtené 1 dado cualquiera del comedero";
      }
      const altText = power.resourceAlt ? ` o ${ico(power.resourceAlt)}` : "";
      return `Obtené ${power.amount} ${power.resource ? ico(power.resource) : "alimento"}${altText}${power.from === "feeder" ? " del comedero" : ""}`;
    }
    case "layEgg": {
      if (power.target === "self") return `Poné ${eggs(power.amount)} en este nido`;
      if (power.target === "eachNestType") {
        return `Poné ${eggs(power.amount)} en CADA una de tus aves con nido ${power.nestType ? nestLabels[power.nestType] : ""}`;
      }
      if (power.target === "allPlayersNestType") {
        return `Todos ponen 1 huevo en 1 ave con nido ${power.nestType ? nestLabels[power.nestType] : ""}; vos ponés ${power.activePlayerBonus ?? 1} extra`;
      }
      if (power.target === "nestType") {
        return `Poné ${eggs(power.amount)} en otra ave con nido ${power.nestType ? nestLabels[power.nestType] : ""}`;
      }
      return `Poné ${eggs(power.amount)} en cualquier ave`;
    }
    case "drawCard":
      return `Robá ${cards(power.amount)}${power.thenDiscard ? " y descartá 1" : ""}`;
    case "tuckCard": {
      const costPrefix = power.costResource
        ? `Descartá ${power.costAmount ?? 1} ${ico(power.costResource)} para `
        : "";
      const verb = costPrefix ? "solapar" : "Solapá";
      return (
        `${costPrefix}${verb} ${cards(power.amount)}${power.source === "deck" ? " del mazo" : " de tu mano"}` +
        `${power.thenDraw ? " y robá 1" : ""}` +
        `${power.thenGainEgg ? " y poné 1 huevo" : ""}` +
        `${power.thenGainResource ? ` y ganá 1 ${ico(power.thenGainResource)}${power.thenGainResourceAlt ? ` o 1 ${ico(power.thenGainResourceAlt)}` : ""}` : ""}`
      );
    }
    case "cacheFood":
      return `Almacená 1 ${power.resource ? ico(power.resource) : "semilla"} en esta carta`;
    case "huntPredator":
      return `Caza: si envergadura del mazo ≤ ${power.maxWingspanCm}cm, solapa como presa`;
    case "diceHuntPredator":
      return `Caza: relanza los dados fuera del comedero; si alguno muestra ${ico(power.resource)}, gana 1 y lo cachea en esta carta`;
    case "playSecondBird":
      return `Jugá una segunda ave en ${power.habitats.map((h) => habitatLabels[h]).join(" o ")}, pagando su costo normal`;
    case "allPlayersGain":
      return power.benefitType === "card"
        ? "Todos los jugadores roban 1 carta del mazo"
        : `Todos obtienen 1 ${power.resource ? ico(power.resource) : "recurso"}`;
    case "tradeResource":
      return `Cambiá 1 ${ico(power.costResource)} por ${power.amount ?? 1} ${ico(power.gainResource)}`;
    case "gainBonusCard":
      return `Revelá ${cards(power.drawCount)} de bonificación y conservá ${power.keepCount}`;
    case "repeatPower":
      return `Repetí ${power.predatorOnly ? "un poder de caza" : "un poder marrón"} de otra ave en este hábitat`;
    case "fewestBirdsBenefit":
      return power.benefitType === "drawCard"
        ? `Jugador(es) con menos aves en ${habitatLabels[power.habitat]}: roba(n) ${cards(power.amount ?? 1)}`
        : `Jugador(es) con menos aves en ${habitatLabels[power.habitat]}: gana(n) 1 dado del comedero`;
    case "allPlayersGainDie":
      return "Cada jugador toma 1 dado del comedero, empezando por vos";
    case "moveToHabitat":
      return "Mové esta ave a otro hábitat";
    default:
      return "";
  }
}

/** Nombre en palabras de cada ícono que puede aparecer como marcador en el texto de un poder. */
const markerNames: Partial<Record<IconName, string>> = {
  seed: "semilla",
  fruit: "fruta",
  insect: "insecto",
  fish: "pez",
  rodent: "roedor",
  wild: "comodín",
};

/** Texto plano de un poder (los marcadores pasan a palabras): para title, aria-label y comparaciones. */
export function describePowerText(power: Power): string {
  return plainText(describePower(power), markerNames);
}

/** Etiqueta del momento en que actúa un poder (siempre en texto: el color de la banda no es el único portador). */
export const powerTimingLabels: Record<PowerTiming, string> = {
  onActivate: "Al activar",
  onceBetweenTurns: "Entre turnos",
  onPlay: "Al jugar",
};

/** Coste de una carta en palabras: "2 insecto + 1 de semilla o pez" o "Gratis". */
export function costText(card: SpeciesCard): string {
  const parts = Object.entries(card.cost)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([res, count]) => `${count} ${costLabel(res as ResourceFace)}`);
  if (card.costAnyOf && card.costAnyOf.length > 0) {
    parts.push(`1 de ${card.costAnyOf.map((res) => resourceLabels[res]).join(" o ")}`);
  }
  return parts.length > 0 ? parts.join(" + ") : "Gratis";
}

/** Nombre accesible de una carta: nombre, puntos, coste y poderes (para title y aria-label). */
export function birdCardLabel(card: SpeciesCard): string {
  const powers =
    card.powers.length > 0
      ? card.powers.map((p) => `${powerTimingLabels[p.timing]}: ${describePowerText(p)}`).join(". ")
      : "Sin poder";
  return `${card.name}. ${card.points} puntos. Coste: ${costText(card)}. ${powers}.`;
}
