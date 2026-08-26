import type { AutomaCard } from "./types";

export const automaCardsCatalog: Record<string, AutomaCard> = {
  automa_1: {
    id: "automa_1",
    name: "Recolector Voraz",
    description: "Consume alimento del comedero y avanza en objetivos.",
    roundActions: {
      1: [{ type: "gainFoodFromFeeder", count: 1 }, { type: "advanceGoal", metricBonus: 1 }],
      2: [{ type: "stashCardFromDeck", count: 1 }, { type: "layEggs", count: 1 }],
      3: [{ type: "drawMarketCard", count: 1 }, { type: "advanceGoal", metricBonus: 2 }],
      4: [{ type: "stashCardFromDeck", count: 2 }, { type: "layEggs", count: 2 }],
    },
  },
  automa_2: {
    id: "automa_2",
    name: "Constructor de Nidos",
    description: "Prioriza poner huevos y renovar el mercado de aves.",
    roundActions: {
      1: [{ type: "layEggs", count: 1 }, { type: "drawMarketCard", count: 1 }],
      2: [{ type: "gainFoodFromFeeder", count: 1 }, { type: "stashCardFromDeck", count: 1 }],
      3: [{ type: "layEggs", count: 2 }, { type: "advanceGoal", metricBonus: 1 }],
      4: [{ type: "stashCardFromDeck", count: 2 }, { type: "advanceGoal", metricBonus: 2 }],
    },
  },
  automa_3: {
    id: "automa_3",
    name: "Explorador de Humedales",
    description: "Roba aves del mercado y guarda cartas en su reserva.",
    roundActions: {
      1: [{ type: "drawMarketCard", count: 1 }, { type: "advanceGoal", metricBonus: 1 }],
      2: [{ type: "stashCardFromDeck", count: 1 }, { type: "gainFoodFromFeeder", count: 1 }],
      3: [{ type: "stashCardFromDeck", count: 2 }],
      4: [{ type: "layEggs", count: 2 }, { type: "advanceGoal", metricBonus: 3 }],
    },
  },
  automa_4: {
    id: "automa_4",
    name: "Cazador Silvestre",
    description: "Guarda cartas de ave rápidamente y toma dados del comedero.",
    roundActions: {
      1: [{ type: "stashCardFromDeck", count: 1 }],
      2: [{ type: "layEggs", count: 2 }, { type: "gainFoodFromFeeder", count: 1 }],
      3: [{ type: "drawMarketCard", count: 1 }, { type: "stashCardFromDeck", count: 1 }],
      4: [{ type: "stashCardFromDeck", count: 2 }, { type: "layEggs", count: 2 }],
    },
  },
  automa_5: {
    id: "automa_5",
    name: "Competidor Tenaz",
    description: "Maximiza el progreso en los objetivos de final de ronda.",
    roundActions: {
      1: [{ type: "advanceGoal", metricBonus: 2 }],
      2: [{ type: "drawMarketCard", count: 1 }, { type: "advanceGoal", metricBonus: 1 }],
      3: [{ type: "stashCardFromDeck", count: 1 }, { type: "layEggs", count: 2 }],
      4: [{ type: "advanceGoal", metricBonus: 3 }, { type: "stashCardFromDeck", count: 1 }],
    },
  },
  automa_6: {
    id: "automa_6",
    name: "Guardián de Bosques",
    description: "Consume alimento constante y acumula nidadas.",
    roundActions: {
      1: [{ type: "gainFoodFromFeeder", count: 1 }, { type: "layEggs", count: 1 }],
      2: [{ type: "advanceGoal", metricBonus: 2 }],
      3: [{ type: "gainFoodFromFeeder", count: 1 }, { type: "stashCardFromDeck", count: 1 }],
      4: [{ type: "layEggs", count: 3 }],
    },
  },
  automa_7: {
    id: "automa_7",
    name: "Maestro Estratega",
    description: "Equilibrio letal entre reserva, huevos y dados de alimento.",
    roundActions: {
      1: [{ type: "stashCardFromDeck", count: 1 }, { type: "gainFoodFromFeeder", count: 1 }],
      2: [{ type: "layEggs", count: 1 }, { type: "advanceGoal", metricBonus: 2 }],
      3: [{ type: "stashCardFromDeck", count: 2 }, { type: "drawMarketCard", count: 1 }],
      4: [{ type: "stashCardFromDeck", count: 2 }, { type: "layEggs", count: 2 }],
    },
  },
  automa_8: {
    id: "automa_8",
    name: "Bandada Migratoria",
    description: "Renueva el mercado de aves y acumula aves en reserva.",
    roundActions: {
      1: [{ type: "drawMarketCard", count: 1 }],
      2: [{ type: "stashCardFromDeck", count: 1 }, { type: "layEggs", count: 2 }],
      3: [{ type: "advanceGoal", metricBonus: 2 }, { type: "gainFoodFromFeeder", count: 1 }],
      4: [{ type: "stashCardFromDeck", count: 3 }],
    },
  },
  automa_9: {
    id: "automa_9",
    name: "Especialista en Nidos",
    description: "Enfoque intensivo en acumular huevos en cada ronda.",
    roundActions: {
      1: [{ type: "layEggs", count: 2 }],
      2: [{ type: "gainFoodFromFeeder", count: 1 }, { type: "stashCardFromDeck", count: 1 }],
      3: [{ type: "layEggs", count: 2 }, { type: "advanceGoal", metricBonus: 1 }],
      4: [{ type: "layEggs", count: 3 }, { type: "stashCardFromDeck", count: 1 }],
    },
  },
  automa_10: {
    id: "automa_10",
    name: "Depredador Sigiloso",
    description: "Acelera su reserva de cartas en rondas avanzadas.",
    roundActions: {
      1: [{ type: "gainFoodFromFeeder", count: 1 }],
      2: [{ type: "stashCardFromDeck", count: 2 }],
      3: [{ type: "advanceGoal", metricBonus: 2 }, { type: "layEggs", count: 1 }],
      4: [{ type: "stashCardFromDeck", count: 2 }, { type: "gainFoodFromFeeder", count: 1 }],
    },
  },
};
