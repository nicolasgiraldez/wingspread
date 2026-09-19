// Convierte las ilustraciones fuente (PNG grandes) de src/ui/assets/birds a WebP livianos.
// Uso: npm run images            → solo convierte las que faltan o cambiaron
//      npm run images -- --force → reconvierte todas
// Los PNG fuente están en .gitignore: solo se versionan los .webp.
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "ui", "assets", "birds");
const MAX_SIZE = 400;
const force = process.argv.includes("--force");

const isStale = async (source, target) => {
  try {
    return (await stat(source)).mtimeMs > (await stat(target)).mtimeMs;
  } catch {
    return true;
  }
};

const sources = (await readdir(dir)).filter((file) => file.endsWith(".png"));
let converted = 0;
let savedBytes = 0;

for (const file of sources) {
  const source = path.join(dir, file);
  const target = source.replace(/\.png$/, ".webp");
  if (!force && !(await isStale(source, target))) continue;

  await sharp(source)
    .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, alphaQuality: 90 })
    .toFile(target);

  savedBytes += (await stat(source)).size - (await stat(target)).size;
  converted += 1;
  console.log(`✓ ${path.basename(target)}`);
}

console.log(
  `${converted} convertida(s), ${sources.length - converted} sin cambios, ${(savedBytes / 1024 / 1024).toFixed(1)} MB ahorrados.`,
);
