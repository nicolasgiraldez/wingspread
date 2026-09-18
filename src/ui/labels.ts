import type { AutomaDifficulty, HabitatId, NestType, Power, PowerTiming, ResourceFace } from "../game";

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

export const nestLabels: Record<NestType, string> = {
  cup: "Nido de copa",
  cavity: "Nido en cavidad",
  platform: "Nido de plataforma",
  ground: "Nido en suelo",
  wild: "Nido comodín",
};

export const nestIcons: Record<NestType, string> = {
  cup: "🥣",
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
    case "gainResource":
      return `Obtén ${power.amount} ${power.resource ? resourceIcons[power.resource] : "alimento"}${power.from === "feeder" ? " del comedero" : ""}`;
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
    case "tuckCard":
      return `Solapa 1 carta${power.source === "deck" ? " del mazo" : " de tu mano"}${power.thenDraw ? " y roba 1" : ""}${power.thenGainEgg ? " y pon 1 huevo" : ""}`;
    case "cacheFood":
      return `Almacena 1 ${power.resource ? resourceIcons[power.resource] : "semilla"} en esta carta`;
    case "huntPredator":
      return `Caza: si envergadura del mazo ≤ ${power.maxWingspanCm}cm, solapa como presa`;
    case "diceHuntPredator":
      return `Caza: relanza los dados fuera del comedero; si alguno muestra ${resourceIcons[power.resource]}, gana 1 y lo cachea en esta carta`;
    case "playSecondBird":
      return `Jugá una segunda ave en ${power.habitats.map((h) => habitatLabels[h]).join(" o ")}, pagando su costo normal`;
    case "allPlayersGain":
      return `Todos obtienen 1 ${power.resource ? resourceIcons[power.resource] : "recurso"}`;
    case "tradeResource":
      return `Cambia 1 ${resourceIcons[power.costResource]} por ${power.amount ?? 1} ${resourceIcons[power.gainResource]}`;
    case "gainBonusCard":
      return `Revela ${power.drawCount} carta(s) de bonificación y conservá ${power.keepCount}`;
    default:
      return "";
  }
}
