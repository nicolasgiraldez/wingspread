import type { AutomaDifficulty, HabitatId, NestType, PowerTiming, ResourceFace } from "../game";

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
  wild: "comodín",
};

export const resourceIcons: Record<ResourceFace, string> = {
  seed: "🌾",
  fruit: "🍒",
  insect: "🐛",
  fish: "🐟",
  rodent: "🐁",
  wild: "✨",
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
