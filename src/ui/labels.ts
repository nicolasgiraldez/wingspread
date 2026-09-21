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

/** Alimento dicho en el texto: el comodín es "alimento a elección"; el resto va como ícono. */
const food = (res: ResourceFace | undefined, fallback = "alimento") =>
  !res ? fallback : res === "wild" ? "alimento a elección" : ico(res);

/** Tipo de nido dicho dentro de una frase ("con nido de copa"). */
const NEST_WORDS: Record<NestType, string> = {
  bowl: "de copa",
  cavity: "en cavidad",
  platform: "de plataforma",
  ground: "en suelo",
  wild: "comodín",
};
const withNest = (nest?: NestType) => (nest ? `con nido ${NEST_WORDS[nest]}` : "con nido");
const orWildNest = " (o con nido comodín)";

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** Coste en huevo de un poder: "Descartá 1 huevo de otra ave para " (se sigue con el efecto en infinitivo). */
const eggCostPrefix = (excludesSelf?: boolean) =>
  `Descartá 1 huevo ${excludesSelf ? "de otra ave" : "de una de tus aves"} para `;

/**
 * Cuándo se dispara un poder rosa ("Entre turnos"): el motor los resuelve cuando OTRO jugador hace
 * una acción concreta, y cada poder solo se puede usar una vez entre turnos propios.
 */
function betweenTurnsTrigger(power: Power): string | null {
  if (power.timing !== "onceBetweenTurns") return null;
  switch (power.kind) {
    case "layEgg":
      return "Cuando otro jugador ponga huevos";
    case "gainResource":
      if (power.from === "feeder") return "Cuando la caza de otro jugador tenga éxito";
      return power.habitat
        ? `Cuando otro jugador juegue un ave en su ${habitatLabels[power.habitat]}`
        : "Cuando otro jugador juegue un ave u obtenga alimento";
    case "tuckCard":
      return power.habitat
        ? `Cuando otro jugador juegue un ave en su ${habitatLabels[power.habitat]}`
        : "Cuando otro jugador juegue un ave";
    case "cacheFood":
      return "Cuando otro jugador obtenga alimento";
    case "drawCard":
      return "Cuando otro jugador robe cartas";
    default:
      return null;
  }
}

/** Qué hace el poder, con sus costes y condiciones (sin el disparador de los poderes rosas). */
function describeEffect(power: Power): string {
  switch (power.kind) {
    case "gainResource": {
      const paid = !!power.costsEgg;
      const cost = paid ? eggCostPrefix(power.costEggExcludesSelf) : "";
      const verb = paid ? "obtener" : "Obtené";
      if (power.gainAllMatching) {
        return `${cost}${verb} TODOS los ${food(power.resource, "dados")} que haya en el comedero`;
      }
      if (power.anyDie) {
        return `${cost}${verb} 1 dado cualquiera del comedero`;
      }
      if (power.from === "feeder") {
        const main = `${cost}${verb} ${power.amount} ${food(power.resource)} del comedero`;
        return power.resourceAlt
          ? `${main}; si no hay, ${power.amount} ${ico(power.resourceAlt)}`
          : `${main} (si hay)`;
      }
      const fromSupply = power.resource === "wild" ? "" : " de la reserva";
      return `${cost}${verb} ${power.amount} ${food(power.resource)}${fromSupply}`;
    }
    case "layEgg": {
      if (power.target === "self") return `Poné ${eggs(power.amount)} en este nido`;
      if (power.target === "eachNestType") {
        return `Poné ${eggs(power.amount)} en CADA una de tus aves ${withNest(power.nestType)}${orWildNest}`;
      }
      if (power.target === "allPlayersNestType") {
        return `Todos ponen 1 huevo en 1 ave ${withNest(power.nestType)}; vos ponés ${power.activePlayerBonus ?? 1} extra`;
      }
      if (power.target === "nestType") {
        return `Poné ${eggs(power.amount)} en otra ave ${withNest(power.nestType)}${orWildNest}`;
      }
      return `Poné ${eggs(power.amount)} en cualquier ave`;
    }
    case "drawCard": {
      const paid = !!power.costsEgg;
      const cost = paid ? eggCostPrefix(power.costEggExcludesSelf) : "";
      const discard = power.thenDiscard ? (paid ? " y descartar 1" : " y descartá 1") : "";
      return `${cost}${paid ? "robar" : "Robá"} ${cards(power.amount)}${discard}`;
    }
    case "tuckCard": {
      const cost = power.costResource ? `Descartá ${power.costAmount ?? 1} ${ico(power.costResource)} para ` : "";
      const source = power.source === "deck" ? " del mazo" : " de tu mano";
      const base = `${cost}${cost ? "solapar" : "Solapá"} ${cards(power.amount)}${source}`;
      // Lo que sigue solo pasa si se solapó una carta (el motor no lo da si no había qué solapar).
      const after = [
        power.thenDraw && "robá 1 carta",
        power.thenGainEgg && "poné 1 huevo en esta ave",
        power.thenGainResource &&
          `ganá 1 ${ico(power.thenGainResource)}${power.thenGainResourceAlt ? ` o 1 ${ico(power.thenGainResourceAlt)}` : ""} de la reserva`,
      ].filter(Boolean);
      return after.length > 0 ? `${base}; si lo hacés, ${after.join(" y ")}` : base;
    }
    case "cacheFood":
      // Del comedero el dado sale del comedero (solo si hay uno); de la reserva no depende de nada.
      return power.source === "feeder"
        ? `Tomá 1 ${food(power.resource, "semilla")} del comedero y almacenalo en esta carta (si hay)`
        : `Almacená 1 ${food(power.resource, "semilla")} de la reserva en esta carta`;
    case "huntPredator":
      return (
        `Caza: revelá la carta superior del mazo; si su envergadura es de ${power.maxWingspanCm} cm o menos, ` +
        `solapala debajo de esta ave; si no, ${power.onFailDrawCard ? "sumala a tu mano" : "se descarta"}`
      );
    case "diceHuntPredator":
      return `Caza: relanzá los dados que estén fuera del comedero; si alguno muestra ${ico(power.resource)}, almacená 1 ${ico(power.resource)} en esta carta`;
    case "playSecondBird":
      return `Podés jugar una segunda ave en ${power.habitats.map((h) => habitatLabels[h]).join(" o ")}, pagando su costo en alimento y en huevos`;
    case "allPlayersGain":
      return power.benefitType === "card"
        ? "Todos los jugadores roban 1 carta del mazo"
        : `Todos los jugadores obtienen 1 ${food(power.resource, "alimento")} de la reserva`;
    case "tradeResource":
      return `Cambiá 1 ${power.costResource === "wild" ? "alimento cualquiera" : ico(power.costResource)} por ${power.amount ?? 1} ${food(power.gainResource)}`;
    case "gainBonusCard":
      return `Revelá ${cards(power.drawCount)} de bonificación y conservá ${power.keepCount}`;
    case "repeatPower":
      return `Repetí un poder ${power.predatorOnly ? "de caza" : "marrón"} de otra ave en este hábitat`;
    case "fewestBirdsBenefit": {
      const who = `Quien tenga menos aves en ${habitatLabels[power.habitat]} (si hay empate, todos)`;
      return power.benefitType === "drawCard"
        ? `${who} roba ${cards(power.amount ?? 1)}`
        : `${who} toma 1 dado del comedero`;
    }
    case "allPlayersGainDie":
      return "Cada jugador toma 1 dado del comedero, empezando por vos";
    case "moveToHabitat":
      return "Si esta ave está en la columna más a la derecha de su hábitat, movela a otro hábitat donde pueda vivir y haya lugar";
    default:
      return "";
  }
}

/**
 * Descripción completa de un poder, con sus costes y condiciones: la usan las cartas (en todos los
 * modos), el panel de carta seleccionada y los checklists de activación.
 * Los alimentos van como marcadores ({seed}, {fruit}…): mostralos con <RichText>, o usá describePowerText
 * para el texto plano (title / aria-label).
 */
export function describePower(power: Power): string {
  const trigger = betweenTurnsTrigger(power);
  const effect = describeEffect(power);
  return trigger ? `${trigger}, ${lowerFirst(effect)}` : effect;
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
