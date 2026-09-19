// Ilustraciones de aves: src/ui/assets/birds/<cardId>.webp (ver `npm run images`).
// Las que todavía no existen simplemente no aparecen en el mapa.
const imageUrls = import.meta.glob<string>("./assets/birds/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

const birdImages: Record<string, string> = Object.fromEntries(
  Object.entries(imageUrls).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -".webp".length), url]),
);

export function getBirdImage(cardId: string): string | undefined {
  return birdImages[cardId];
}
