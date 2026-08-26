export type ResourceFace =
  | "seed"
  | "fruit"
  | "insect"
  | "fish"
  | "rodent"
  | "wild";

export type NestType = "platform" | "cup" | "cavity" | "ground" | "wild";

export type HabitatId = "forest" | "grassland" | "wetland";
export type CardId = string;
export type PlayerId = string;

export type GameMode = "solo" | "online";
export type AutomaDifficulty = "easy" | "normal" | "hard";

export type PowerTiming =
  | "onPlay"
  | "onActivate"
  | "roundEnd"
  | "gameEnd"
  | "onceBetweenTurns";

export type Power =
  | {
      id: string;
      timing: PowerTiming;
      kind: "gainResource";
      resource?: ResourceFace;
      amount: number;
      from?: "supply" | "feeder";
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "layEgg";
      amount: number;
      target: "self" | "any" | "habitat" | "nestType";
      habitat?: HabitatId;
      nestType?: NestType;
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "drawCard";
      amount: number;
      thenDiscard?: boolean;
    }
  | {
      id: string;
      timing: PowerTiming;
      kind: "tuckCard";
      amount: number;
      source: "deck" | "hand";
      thenDraw?: boolean;
      thenGainEgg?: boolean;
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
    };

export type SpeciesCard = {
  id: CardId;
  name: string;
  scientificName?: string;
  habitats: HabitatId[];
  cost: Partial<Record<ResourceFace, number>>;
  points: number;
  eggCapacity: number;
  nestType?: NestType;
  wingspanCm?: number;
  powers: Power[];
};

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
    | "totalEggs"
    | "tuckedCards";
  habitat?: HabitatId;
  nestType?: NestType;
  resourceCost?: ResourceFace;
  minWingspanCm?: number;
  maxWingspanCm?: number;
  tiers: BonusCardTier[];
};

export type RoundGoalType =
  | "eggsInHabitat"
  | "birdsInHabitat"
  | "totalEggs"
  | "totalBirds"
  | "birdsInNests"
  | "cachedFood";

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
  isAutoma?: boolean;
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

export type AutomaCardAction =
  | { type: "gainFoodFromFeeder"; foodType?: ResourceFace | "any"; count: number }
  | { type: "drawMarketCard"; slotIndex?: number; count?: number }
  | { type: "stashCardFromDeck"; count: number }
  | { type: "layEggs"; count: number }
  | { type: "advanceGoal"; metricBonus: number };

export type AutomaCard = {
  id: string;
  name: string;
  description?: string;
  roundActions: Record<1 | 2 | 3 | 4, AutomaCardAction[]>;
};

export type AutomaState = {
  difficulty: AutomaDifficulty;
  deck: string[];
  discard: string[];
  currentCard: AutomaCard | null;
  stashedCardsCount: number;
  eggs: number;
  roundGoalMetric: number;
};

export type GameState = {
  gameMode: GameMode;
  phase: "setup" | "round" | "roundEnd" | "gameEnd";
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
  automaState?: AutomaState;
  log: GameLogEntry[];
};

export type DrawCardSelection =
  | { source: "deck" }
  | { source: "market"; marketCardId: CardId };

export type Move =
  | {
      type: "playBird";
      cardId: CardId;
      habitat: HabitatId;
      slotIndex: number;
      paidResources: ResourceFace[];
      paidEggsFrom: SlotRef[];
    }
  | {
      type: "gainFood";
      dieIndexes: number[];
      rerollBefore?: boolean;
      tradeCardId?: CardId;
    }
  | {
      type: "layEggs";
      eggPlacements: SlotRef[];
      tradeResource?: ResourceFace;
    }
  | {
      type: "drawBirdCards";
      draws: DrawCardSelection[];
      tradeEggFrom?: SlotRef;
    }
  | {
      type: "rerollFeeder";
    };

export type NetworkMessage =
  | { type: "SYNC_STATE"; state: GameState; roomCode?: string }
  | { type: "GUEST_JOIN"; guestName: string }
  | { type: "APPLY_MOVE"; move: Move; playerId: PlayerId }
  | { type: "RESTART_GAME" }
  | { type: "PING" };
