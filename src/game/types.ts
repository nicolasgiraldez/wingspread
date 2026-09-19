export type ResourceFace =
  | "seed"
  | "fruit"
  | "insect"
  | "fish"
  | "rodent"
  | "wild";

export type NestType = "platform" | "bowl" | "cavity" | "ground" | "wild";

export type HabitatId = "forest" | "grassland" | "wetland";
export type CardId = string;
export type PlayerId = string;

export type GameMode = "solo" | "online";
/** Nivel del rival controlado por la IA: cuánto y cómo piensa cada jugada. */
export type BotDifficulty = "easy" | "normal" | "hard";

export type PowerTiming =
  | "onPlay"
  | "onActivate"
  | "onceBetweenTurns";

export type Power =
  | {
      id: string;
      timing: PowerTiming;
      kind: "gainResource";
      resource?: ResourceFace;
      amount: number;
      from?: "supply" | "feeder";
      habitat?: HabitatId;
      /** Si es true, el poder cuesta descartar 1 huevo de una de las aves del jugador. */
      costsEgg?: boolean;
      /** Solo con costsEgg: el huevo no puede salir de esta misma carta ("otra ave"). */
      costEggExcludesSelf?: boolean;
      /** Solo con from:"feeder": toma TODOS los dados que muestren `resource`, no solo 1. */
      gainAllMatching?: boolean;
      /** Solo con from:"feeder": si `resource` no está en el comedero, probá con este otro tipo. */
      resourceAlt?: ResourceFace;
      /** Solo con from:"feeder": ignora `resource` y toma el próximo dado disponible, sea cual sea. */
      anyDie?: boolean;
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "layEgg";
      amount: number;
      target:
        | "self"
        /** Cualquier ave (con espacio libre); el jugador elige cuál. */
        | "any"
        /** 1 ave con nido de este tipo (el jugador elige, o se autoselecciona en poderes rosas). */
        | "nestType"
        /** TODAS las aves propias con nido de este tipo reciben `amount` huevo(s) cada una. */
        | "eachNestType"
        /** Todos los jugadores ponen 1 huevo en 1 ave con nido de este tipo (a su elección);
         * el jugador activo además pone `activePlayerBonus` huevo(s) extra en un ave así. */
        | "allPlayersNestType";
      nestType?: NestType;
      /** Solo para target "allPlayersNestType": huevos extra exclusivos del jugador activo. */
      activePlayerBonus?: number;
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "drawCard";
      amount: number;
      thenDiscard?: boolean;
      /** Si es true, el poder cuesta descartar 1 huevo de una de las aves del jugador. */
      costsEgg?: boolean;
      costEggExcludesSelf?: boolean;
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "tuckCard";
      amount: number;
      source: "deck" | "hand";
      thenDraw?: boolean;
      thenGainEgg?: boolean;
      /** Costo en comida para activar este poder (p. ej. "descartá 1 pez para solapar 2 del mazo"). */
      costResource?: ResourceFace;
      costAmount?: number;
      /** Si se solapó con éxito, además ganá este recurso de la reserva. */
      thenGainResource?: ResourceFace;
      /** Segunda opción de thenGainResource; hoy se prioriza siempre thenGainResource. */
      thenGainResourceAlt?: ResourceFace;
      /** Solo para el patrón rosa "cuando otro jugador juega un ave de [hábitat]": filtra el evento. */
      habitat?: HabitatId;
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "cacheFood";
      resource?: ResourceFace;
      amount: number;
      source: "supply" | "feeder";
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "huntPredator";
      maxWingspanCm: number;
      onFailDrawCard?: boolean;
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "diceHuntPredator";
      /** Relanza los dados que están fuera del comedero (5 - dados en el comedero); si alguno
       * muestra este recurso, la caza tiene éxito: gana 1 y lo cachea en esta carta. */
      resource: ResourceFace;
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "playSecondBird";
      /** Hábitat(s) donde se puede jugar la segunda ave; el jugador elige si hay más de uno. */
      habitats: HabitatId[];
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "moveToHabitat";
      /** Solo funciona si esta carta está en la columna más a la derecha ocupada de su hábitat. */
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "allPlayersGain";
      resource?: ResourceFace;
      benefitType?: "resource" | "egg" | "card";
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "tradeResource";
      costResource: ResourceFace;
      gainResource: ResourceFace;
      amount?: number;
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "gainBonusCard";
      /** Cuántas cartas de bonificación se revelan del mazo. */
      drawCount: number;
      /** Cuántas de las reveladas se queda el jugador (el resto se descarta). */
      keepCount: number;
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "repeatPower";
      /** Si es true, solo puede repetir un poder de caza (huntPredator/diceHuntPredator). */
      predatorOnly?: boolean;
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "fewestBirdsBenefit";
      /** Jugador(es) con menos aves en este hábitat reciben el beneficio (empates: todos). */
      habitat: HabitatId;
      benefitType: "drawCard" | "gainDieFromFeeder";
      /** Solo para benefitType "drawCard". */
      amount?: number;
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "allPlayersGainDie";
      /** Cada jugador (empezando por el activo) toma 1 dado del comedero, si queda alguno. */
    };

export type SpeciesCard = {
  id: CardId;
  name: string;
  scientificName?: string;
  habitats: HabitatId[];
  cost: Partial<Record<ResourceFace, number>>;
  /**
   * Costo "O": además de `cost`, el jugador debe pagar 1 unidad usando CUALQUIERA de estos
   * tipos (a diferencia de `cost.wild`, que acepta los 5 tipos, este set es restringido a
   * los 2-3 tipos mostrados en la carta real, unidos por "/").
   */
  costAnyOf?: ResourceFace[];
  points: number;
  eggCapacity: number;
  nestType?: NestType;
  wingspanCm?: number;
  powers: Power[];
  /** Categorías de nombre usadas por algunas cartas de bonificación (ej. "tiene un color en el nombre"). */
  nameTags?: NameTag[];
};

/**
 * Categorías de texto del nombre común/científico que algunas cartas de bonificación reales
 * usan como criterio (ej. Anatomist, Cartographer, Photographer, Historian). Se curan a mano
 * por carta en vez de intentar detectarlas en tiempo de ejecución con un diccionario de
 * palabras clave, que sería frágil para nombres en inglés.
 */
export type NameTag = "bodyPart" | "geographic" | "color" | "possessive";

export type SlotRef = {
  habitat: HabitatId;
  slotIndex: number;
};

export type BoardSlot = {
  cardId: CardId | null;
  eggs: number;
  cached: ResourceFace[];
  tucked: CardId[];
};

export type BonusCardTier = {
  threshold: number;
  points: number;
};

export type BonusCard = {
  id: string;
  name: string;
  description: string;
  conditionType:
    | "birdsInHabitat"
    | "birdsWithNest"
    | "birdsWithFoodCost"
    | "birdsWithWingspan"
    /** Aves cuyos puntos de victoria impresos caen en [minPoints, maxPoints] (ej. "valen menos de 4"). */
    | "birdsWithPoints"
    /** Aves con AL MENOS `minEggs` huevos puestos sobre ellas (distinto de "totalEggs": cuenta aves, no huevos). */
    | "birdsWithMinEggs"
    /** Aves cuyo nombre está taggeado con `nameTag` (ver SpeciesCard.nameTags). */
    | "birdsWithNameTag"
    /** Aves que tienen al menos 1 poder cuyo `kind` está en `powerKinds`. */
    | "birdsWithPowerKind"
    /** Aves en el hábitat donde el jugador tiene MENOS aves jugadas (se recalcula por jugador). */
    | "birdsInFewestOwnHabitat"
    /** Cartas de ave que quedan en la mano del jugador al momento de puntuar. */
    | "cardsInHand"
    | "totalEggs"
    | "tuckedCards";
  habitat?: HabitatId;
  /** Solo para "birdsInHabitat": exige que el ave viva ÚNICAMENTE en ese hábitat (no cuenta multi-hábitat). */
  onlyHabitat?: boolean;
  nestType?: NestType;
  resourceCost?: ResourceFace;
  /** Solo con "birdsWithFoodCost": el ave debe comer ÚNICAMENTE ese alimento (ej. "solo invertebrados"). */
  onlyResourceCost?: boolean;
  minWingspanCm?: number;
  maxWingspanCm?: number;
  minPoints?: number;
  maxPoints?: number;
  minEggs?: number;
  nameTag?: NameTag;
  powerKinds?: Power["kind"][];
  /**
   * "tiered" (default): puntúa según el umbral más alto alcanzado en `tiers`.
   * "perBird": puntúa `pointsPerBird` × cantidad de aves calificadas, sin techo.
   */
  scoringMode?: "tiered" | "perBird";
  pointsPerBird?: number;
  tiers?: BonusCardTier[];
};

export type RoundGoalType =
  | "eggsInHabitat"
  | "birdsInHabitat"
  | "totalBirds"
  /** Aves con nido `nestType` (o comodín) que tienen AL MENOS 1 huevo. */
  | "birdsWithEggsInNests"
  /** Total de huevos sobre aves con nido `nestType` (o comodín). */
  | "eggsInNests"
  /** Conjuntos de huevos: cada conjunto es 1 huevo en el bosque, 1 en la pradera y 1 en el río. */
  | "eggSets";

export type RoundGoal = {
  id: string;
  name: string;
  description?: string;
  type: RoundGoalType;
  habitat?: HabitatId;
  nestType?: NestType;
};

export type PlayerState = {
  id: PlayerId;
  name: string;
  hand: CardId[];
  bonusCards: BonusCard[];
  resources: Partial<Record<ResourceFace, number>>;
  board: Record<HabitatId, BoardSlot[]>;
  actionCubesAvailable: number;
  roundGoalScores: number[];
  /** Si es un rival controlado por la IA, su nivel; undefined para un jugador humano. */
  botLevel?: BotDifficulty;
  /**
   * true durante la preparación inicial, hasta que el jugador elige qué aves y alimento conserva
   * (y su carta de bonificación) con un movimiento chooseStart.
   */
  pendingStartingHand?: boolean;
  /** IDs de poderes "entre turnos" (rosa) ya activados desde el último turno propio de este jugador. */
  pinkPowersUsed?: string[];
  /**
   * Cartas de bonificación ofrecidas al jugador, de las que debe elegir 1 para conservar (las
   * demás se descartan). Se ofrecen 2 al inicio de la partida (se resuelve dentro de chooseStart)
   * y también cuando un poder de ave "roba 2 cartas de bonificación y conserva 1" (se resuelve con
   * chooseBonusCard). Mientras haya una oferta pendiente el jugador no puede hacer otra cosa;
   * elegir no gasta acción ni exige ser su turno. undefined si no hay.
   */
  pendingBonusChoice?: string[];
};

export type GameLogEntry = {
  message: string;
  playerId?: PlayerId;
};

export type ScoreBreakdown = {
  birds: number;
  eggs: number;
  cachedFood: number;
  tuckedCards: number;
  roundGoals: number;
  bonusCards: number;
  total: number;
};

export type GameState = {
  gameMode: GameMode;
  phase: "setup" | "round" | "gameEnd";
  round: 1 | 2 | 3 | 4;
  currentPlayerId: PlayerId;
  firstPlayerId: PlayerId;
  players: Record<PlayerId, PlayerState>;
  playerOrder: PlayerId[];
  customPlayerNames?: Record<PlayerId, string>;
  deck: CardId[];
  discard: CardId[];
  market: CardId[];
  feeder: ResourceFace[];
  roundGoals: RoundGoal[];
  roundGoalResults?: Record<number, Record<PlayerId, number>>;
  cards: Record<CardId, SpeciesCard>;
  bonusCardsCatalog?: Record<string, BonusCard>;
  /** Mazo de cartas de bonificación restantes (no repartidas al inicio), para poderes que reparten más. */
  bonusDeck: string[];
  /** Cartas de bonificación reveladas y no conservadas. */
  bonusDiscard: string[];
  log: GameLogEntry[];
};

export type DrawCardSelection =
  | { source: "deck" }
  | { source: "market"; marketCardId: CardId };

/**
 * IDs (Power["id"]) de poderes opcionales que el jugador decide NO activar en esta acción.
 * Todo poder onPlay/onActivate es opcional según el reglamento; si su id no aparece acá, se activa.
 */
export type SkipPowerIds = string[];

/**
 * Elecciones de carta del jugador para poderes que requieren elegir una carta específica
 * (p. ej. "solapa 1 carta de tu mano" o "descarta 1 carta" tras robar). Clave = Power["id"].
 */
export type PowerCardChoices = Record<string, CardId>;

/** Elección del jugador para un poder "playSecondBird": qué ave jugar, dónde y cómo pagarla. */
export type PowerPlayBirdChoice = {
  cardId: CardId;
  habitat: HabitatId;
  paidResources: ResourceFace[];
  paidEggsFrom: SlotRef[];
  skipPowerIds?: SkipPowerIds;
};

export type PowerPlayBirdChoices = Record<string, PowerPlayBirdChoice>;

/**
 * Elección del jugador de a qué ave apunta un poder "layEgg" con target "any" o "nestType"
 * (hasta `amount` huevos van todos a esa única ave elegida, limitados por su capacidad).
 * Clave = Power["id"].
 */
export type PowerEggChoices = Record<string, SlotRef>;

/**
 * Elección del jugador del hábitat de destino para un poder "moveToHabitat" (cuando la carta
 * admite más de un hábitat alternativo). Clave = Power["id"].
 */
export type PowerMoveChoices = Record<string, HabitatId>;

export type Move =
  | {
      type: "playBird";
      cardId: CardId;
      habitat: HabitatId;
      slotIndex: number;
      paidResources: ResourceFace[];
      paidEggsFrom: SlotRef[];
      skipPowerIds?: SkipPowerIds;
      powerCardChoices?: PowerCardChoices;
      powerPlayBirdChoices?: PowerPlayBirdChoices;
      powerEggChoices?: PowerEggChoices;
      powerMoveChoices?: PowerMoveChoices;
    }
  | {
      type: "gainFood";
      dieIndexes: number[];
      /** Para dados que muestran "wild": el jugador elige "insect" o "seed" por cada índice wild */
      wildChoices?: Record<number, "insect" | "seed">;
      rerollBefore?: boolean;
      tradeCardId?: CardId;
      skipPowerIds?: SkipPowerIds;
      powerCardChoices?: PowerCardChoices;
      powerEggChoices?: PowerEggChoices;
      powerMoveChoices?: PowerMoveChoices;
    }
  | {
      type: "layEggs";
      eggPlacements: SlotRef[];
      tradeResource?: ResourceFace;
      skipPowerIds?: SkipPowerIds;
      powerCardChoices?: PowerCardChoices;
      powerEggChoices?: PowerEggChoices;
      powerMoveChoices?: PowerMoveChoices;
    }
  | {
      type: "drawBirdCards";
      draws: DrawCardSelection[];
      tradeEggFrom?: SlotRef;
      skipPowerIds?: SkipPowerIds;
      powerCardChoices?: PowerCardChoices;
      powerEggChoices?: PowerEggChoices;
      powerMoveChoices?: PowerMoveChoices;
    }
  | {
      type: "rerollFeeder";
    }
  | {
      /**
       * Preparación inicial (fase "setup"): de las 5 aves repartidas se conservan `keepCards` y por
       * cada una se descarta 1 ficha de alimento (`discardFood`, tipos distintos); además se elige
       * 1 de las 2 cartas de bonificación ofrecidas.
       */
      type: "chooseStart";
      keepCards: CardId[];
      discardFood: ResourceFace[];
      bonusCardId: string;
    }
  | {
      /** Elección de la carta de bonificación a conservar de las reveladas por un poder de ave. */
      type: "chooseBonusCard";
      bonusCardId: string;
    };

export type NetworkMessage =
  | { type: "SYNC_STATE"; state: GameState; roomCode?: string }
  | { type: "GUEST_JOIN"; guestName: string }
  | { type: "APPLY_MOVE"; move: Move; playerId: PlayerId }
  /** El anfitrión rechaza a quien intenta sentarse en un asiento ya ocupado por otro invitado. */
  | { type: "ROOM_FULL" };
