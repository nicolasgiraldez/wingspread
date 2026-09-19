import type { AutomaDifficulty, BonusCard, HabitatId, NameTag, NestType, Power, PowerTiming, ResourceFace } from "../game";

export const playerNames: Record<string, string> = {
  nico: "Nico",
  santi: "Santi",
  automa: "Automa (IA)",
};

export const difficultyLabels: Record<AutomaDifficulty, string> = {
  easy: "Fácil (Pichón)",
  normal: "Normal (Águila)",
  hard: "Difícil (Halcón)",
};

export const habitatLabels: Record<HabitatId, string> = {
  forest: "Bosque",
  grassland: "Pradera",
  wetland: "Río",
};

export const habitatIcons: Record<HabitatId, string> = {
  forest: "🌲",
  grassland: "🌾",
  wetland: "🌊",
};

/** Carta de bonificación asociada a cada categoría de nombre curada en SpeciesCard.nameTags. */
export const nameTagBonus: Record<NameTag, { label: string; icon: string }> = {
  color: { label: "Fotógrafo", icon: "📷" },
  bodyPart: { label: "Anatomista", icon: "🫀" },
  geographic: { label: "Cartógrafo", icon: "🗺️" },
  possessive: { label: "Historiador", icon: "👤" },
};

/** Categorías de nombre que puntúan alguna de las cartas de bonificación dadas. */
export function bonusNameTags(bonusCards: BonusCard[] | undefined): NameTag[] {
  return (bonusCards ?? []).flatMap((b) => (b.conditionType === "birdsWithNameTag" && b.nameTag ? [b.nameTag] : []));
}

export const actionLabels = {
  playBird: "Jugá un ave",
  gainFood: "Obtené alimento",
  layEggs: "Poné huevos",
  drawBirdCards: "Robá cartas de ave",
};

export const moveLogLabels: Record<keyof typeof actionLabels | "rerollFeeder", string> = {
  playBird: "jugó un ave",
  gainFood: "obtuvo alimento del comedero",
  layEggs: "puso huevos",
  drawBirdCards: "robó cartas de ave",
  rerollFeeder: "relanzó los dados del comedero",
};

export const resourceLabels: Record<ResourceFace, string> = {
  seed: "semilla",
  fruit: "fruta",
  insect: "insecto",
  fish: "pez",
  rodent: "roedor",
  wild: "comodín (gusano/trigo)",
};

export const resourceIcons: Record<ResourceFace, string> = {
  seed: "🌾",
  fruit: "🍒",
  insect: "🐛",
  fish: "🐟",
  rodent: "🐁",
  wild: "🐛/🌾",
};

/**
 * Ícono/etiqueta para "wild" cuando aparece como costo de comida de una carta (acepta CUALQUIER
 * tipo de alimento, no solo insecto/semilla). Distinto de resourceIcons.wild, que representa
 * específicamente la cara "comodín" del dado del comedero (ahí sí es insecto o semilla).
 */
export const wildCostIcon = "🃏";
export const wildCostLabel = "comodín (cualquier alimento)";

export function costIcon(res: ResourceFace): string {
  return res === "wild" ? wildCostIcon : resourceIcons[res];
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

export const nestIcons: Record<NestType, string> = {
  bowl: "🥣",
  cavity: "🕳️",
  platform: "🪵",
  ground: "🌿",
  wild: "⭐",
};

export const powerTimingLabels: Record<PowerTiming, string> = {
  onPlay: "Al jugar",
  onActivate: "Al activar",
  roundEnd: "Fin de ronda",
  gameEnd: "Fin de partida",
  onceBetweenTurns: "Entre turnos",
};

/** Descripción legible de un poder, usada tanto en BirdCard como en los checklists de activación. */
export function describePower(power: Power): string {
  switch (power.kind) {
    case "gainResource": {
      if (power.gainAllMatching) {
        return `Obtén TODOS los ${power.resource ? resourceIcons[power.resource] : "dados"} que haya en el comedero`;
      }
      if (power.anyDie) {
        return "Obtén 1 dado cualquiera del comedero";
      }
      const altText = power.resourceAlt ? ` o ${resourceIcons[power.resourceAlt]}` : "";
      return `Obtén ${power.amount} ${power.resource ? resourceIcons[power.resource] : "alimento"}${altText}${power.from === "feeder" ? " del comedero" : ""}`;
    }
    case "layEgg": {
      if (power.target === "self") return `Pon ${power.amount} huevo(s) en este nido`;
      if (power.target === "eachNestType") {
        return `Pon ${power.amount} huevo(s) en CADA una de tus aves con nido ${power.nestType ? nestLabels[power.nestType] : ""}`;
      }
      if (power.target === "allPlayersNestType") {
        return `Todos ponen 1 huevo en 1 ave con nido ${power.nestType ? nestLabels[power.nestType] : ""}; vos ponés ${power.activePlayerBonus ?? 1} extra`;
      }
      if (power.target === "nestType") {
        return `Pon ${power.amount} huevo(s) en otra ave con nido ${power.nestType ? nestLabels[power.nestType] : ""}`;
      }
      return `Pon ${power.amount} huevo(s) en cualquier ave`;
    }
    case "drawCard":
      return `Roba ${power.amount} carta(s)${power.thenDiscard ? " y descarta 1" : ""}`;
    case "tuckCard": {
      const costPrefix = power.costResource
        ? `Descartá ${power.costAmount ?? 1} ${resourceIcons[power.costResource]} para `
        : "";
      const verb = costPrefix ? "solapar" : "Solapa";
      return (
        `${costPrefix}${verb} ${power.amount} carta(s)${power.source === "deck" ? " del mazo" : " de tu mano"}` +
        `${power.thenDraw ? " y roba 1" : ""}` +
        `${power.thenGainEgg ? " y pon 1 huevo" : ""}` +
        `${power.thenGainResource ? ` y ganá 1 ${resourceIcons[power.thenGainResource]}${power.thenGainResourceAlt ? ` o 1 ${resourceIcons[power.thenGainResourceAlt]}` : ""}` : ""}`
      );
    }
    case "cacheFood":
      return `Almacena 1 ${power.resource ? resourceIcons[power.resource] : "semilla"} en esta carta`;
    case "huntPredator":
      return `Caza: si envergadura del mazo ≤ ${power.maxWingspanCm}cm, solapa como presa`;
    case "diceHuntPredator":
      return `Caza: relanza los dados fuera del comedero; si alguno muestra ${resourceIcons[power.resource]}, gana 1 y lo cachea en esta carta`;
    case "playSecondBird":
      return `Jugá una segunda ave en ${power.habitats.map((h) => habitatLabels[h]).join(" o ")}, pagando su costo normal`;
    case "allPlayersGain":
      return power.benefitType === "card"
        ? "Todos los jugadores roban 1 carta del mazo"
        : `Todos obtienen 1 ${power.resource ? resourceIcons[power.resource] : "recurso"}`;
    case "tradeResource":
      return `Cambia 1 ${resourceIcons[power.costResource]} por ${power.amount ?? 1} ${resourceIcons[power.gainResource]}`;
    case "gainBonusCard":
      return `Revela ${power.drawCount} carta(s) de bonificación y conservá ${power.keepCount}`;
    case "repeatPower":
      return `Repetí ${power.predatorOnly ? "un poder de caza" : "un poder marrón"} de otra ave en este hábitat`;
    case "fewestBirdsBenefit":
      return power.benefitType === "drawCard"
        ? `Jugador(es) con menos aves en ${habitatLabels[power.habitat]}: roba(n) ${power.amount ?? 1} carta(s)`
        : `Jugador(es) con menos aves en ${habitatLabels[power.habitat]}: gana(n) 1 dado del comedero`;
    case "allPlayersGainDie":
      return "Cada jugador toma 1 dado del comedero, empezando por vos";
    default:
      return "";
  }
}
