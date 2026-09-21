# 04 · Íconos

Referencia: `reference/IconosD.png`. Archivos: `icons/*.svg` (18 de juego), `icons/glyph/*.svg` (3 de timing sin círculo), `icons/players/*.svg` (3 símbolos de jugador), `icons/ui/*.svg` (26 de interfaz), `icons/manifest.json` (clave → nombre en español).

## Estilo "D": color desplazado + contorno carbón

Cada ícono de juego es una forma de color sólido **desplazada 1.5 unidades** (abajo a la derecha) respecto de su contorno carbón de 1.6 de grosor. Esa desalineación intencional da el aspecto de impresión offset mid-century. `viewBox="-1 -1 27 27"`. Los SVG traen `width="96" height="96"`: **siempre** se dimensionan desde el componente (`size`).

- Tamaño mínimo: **16px** (por debajo, el contorno de 1.6 se pierde). Tamaños usados: 16, 18, 20, 24, 26, 32, 40 (dado del comedero) y 96 (galería).
- Los íconos de juego no cambian de color. El único parámetro de color es la **tinta del contorno** (`ink`): carbón por defecto, **crema** cuando el ícono va sobre la banda marrón "Al activar".
- Los íconos de interfaz (`ui/`) usan el mismo lenguaje; los de línea (`check`, `back`, `chev`, `login`, `trash`, `refresh`, `close`, `minus`, `plus2`, `wifi`, `wifioff`, `copy`, `send`) son un trazo carbón de 2.4 sin relleno.
- Todos son decorativos salvo que sean el único contenido de un botón: en ese caso el botón lleva `aria-label`. Los SVG de juego traen `role="img"` + `aria-label` (en español); cuando acompañen texto visible, pasales `aria-hidden`.

### Componente `Icon`

Sugerencia: `src/ui/components/Icon.tsx`.

```tsx
// Los SVG se copian a src/ui/assets/icons/ y se importan con Vite: import seed from "./assets/icons/seed.svg?raw"
// ICONS: Record<IconName, string> con el contenido crudo de cada archivo.
type IconProps = { name: IconName; size?: number; ink?: string; label?: string };
export function Icon({ name, size = 24, ink, label }: IconProps) {
  let svg = ICONS[name]
    .replace(/ width="96" height="96"/, ` width="${size}" height="${size}"`);
  if (ink) svg = svg.replaceAll("#22292B", ink);          // solo el contorno
  if (!label) svg = svg.replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"');
  return <span style={{ display: "inline-flex", flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
```

(Alternativa igual de válida: convertir cada SVG a un componente React con SVGR. Lo importante: un solo lugar que mapea nombre → SVG, con `size` e `ink`.)

Mover los SVG a `src/ui/assets/icons/` (y `ui/`, `glyph/`) al implementar; `docs/design/icons/` es la fuente del diseño.

## Reemplazo de emoji: de `labels.ts` y componentes

Hoy `labels.ts` expone `resourceIcons`, `habitatIcons`, `nestIcons`, `nameTagBonus` como **strings de emoji**. Cambiarlos a nombres de ícono (`IconName`) y renderizar con `<Icon>`; los textos que los incrustan (`describePower`) pasan por `<RichText>` (más abajo).

### Alimentos (`resourceIcons`)

| Clave | Emoji actual | Ícono nuevo | Archivo |
|---|---|---|---|
| `seed` | 🌾 | Semilla | `icons/seed.svg` |
| `fruit` | 🍒 | Fruta | `icons/fruit.svg` |
| `insect` | 🐛 | Insecto | `icons/insect.svg` |
| `fish` | 🐟 | Pez | `icons/fish.svg` |
| `rodent` | 🐁 | Roedor | `icons/rodent.svg` |
| `wild` (cara del dado: insecto **o** semilla) | 🐛/🌾 | Comodín | `icons/wild.svg` |
| `wild` como coste de carta (**cualquier** alimento) | 🃏 | Comodín | `icons/wild.svg` |

Ojo: 🌾 hoy significa **dos cosas** (semilla y hábitat pradera). Con los íconos nuevos quedan separados (`seed` ≠ `grass`).

### Hábitats (`habitatIcons`)

🌲 → `forest.svg` · 🌾 → `grass.svg` · 🌊 → `river.svg`

### Nidos (`nestIcons`)

🥣 → `bowl.svg` · 🕳️ → `cavity.svg` · 🪵 → `platform.svg` · 🌿 → `ground.svg` · ⭐ → `nestwild.svg`. El fallback `🪺` de `BirdCard.tsx:107` se elimina (todo nido tiene ícono).

### Timing de poder

Al activar → `activate.svg` · Entre turnos → `between.svg` · Al jugar → `play.svg`. En la banda de la carta se usa la variante sin círculo (`icons/glyph/*.svg`, ver `03-cards.md`).

### Huevo

🥚 (aparece en `LayEggsModal`, `PlayBirdModal`, `GameOverModal`, y el ícono suelto de "cached" 🌾 en `BirdCard.tsx:189`) → `egg.svg`. Ojo: en `BirdCard.tsx:189` el 🌾 es **comida almacenada**: usar el ícono del recurso almacenado (`seed`, etc.).

### Textos con emoji sueltos en la interfaz

| Dónde | Emoji | Reemplazo |
|---|---|---|
| `App.tsx:710` banner de espera | ⏳ | `ui/hourglass.svg` (ya diseñado en "Poderes y esperas") |
| `App.tsx:831` "cartas de la mano del rival en secreto" | 🔒 | **Pendiente**: no hay ícono de candado. Ver Pendientes. |
| `HomePage.tsx:213` "Introduce tu nombre…" | ✏️ | quitar el emoji (el campo ya tiene ícono `user` en la etiqueta) |
| `PlayerBoard.tsx:79` "Tablero del Oponente" | 👁️ | **Pendiente** (ojo). Alternativa: quitar el emoji, el texto basta. |
| `GameOverModal.tsx:70` Puntos de Aves | 🪶 | `ui/bird.svg` |
| `GameOverModal.tsx:78` Huevos | 🥚 | `egg.svg` |
| `GameOverModal.tsx:94` Cartas solapadas | 📑 | `ui/stack.svg` |
| `GameOverModal.tsx:102` Objetivos de ronda | 🎯 | `ui/target.svg` |
| `GameOverModal.tsx:110` Bonificación / dificultad | ⭐ | `ui/star.svg` |
| `PlayBirdModal`, `LayEggsModal`, `HomePage`, `BirdCard` | ✓ / ✗ | `ui/check.svg` / `ui/close.svg` con el mismo color semántico (petróleo / tomate profundo) |
| `HomePage.tsx:226,298` | ← | `ui/back.svg` |
| `ConnectionStatusBar` / conexión | (lucide) | `ui/wifi.svg`, `ui/wifioff.svg`, `ui/copy.svg`, `ui/refresh.svg` |

`lucide-react` (`User`, `Users`, etc. en `HomePage`) se reemplaza por los íconos `ui/`: `user`, `globe`, `bot`, `login`, `trash`, `plus`. Si no queda ningún uso, se puede quitar la dependencia.

## RichText: textos con emoji incrustados

`describePower()` (y otros textos) insertan emoji **dentro de la frase** ("Obtén TODOS los 🐛 que haya en el comedero"). Hay que renderizarlos como ícono en línea. Propuesta: cambiar `describePower` para devolver texto con **marcadores** (por ejemplo `{seed}`, `{fruit}`) y un componente:

```tsx
function RichText({ text, size = 16, ink }: { text: string; size?: number; ink?: string }) {
  const parts = text.split(/(\{[a-z]+\})/g);
  return <>{parts.map((p, i) => {
    const m = /^\{([a-z]+)\}$/.exec(p);
    return m
      ? <span key={i} style={{ display: "inline-block", verticalAlign: `-${Math.round(size * 0.28)}px` }}><Icon name={m[1] as IconName} size={size} ink={ink} /></span>
      : p;
  })}</>;
}
```

- Tamaño: 16px en la carta `full`, 15px en `hand`, y `size` = tamaño del texto + 2–4px en modales.
- `ink` = crema sobre la banda marrón, carbón en el resto.
- Alineación vertical: `-0.28 × size` px, para que el ícono asiente en la línea base.
- El texto accesible: el marcador debe leerse como palabra. Envolvé el resultado en un `<span aria-label={textoPlano}>` o usá `title`, para que un lector de pantalla diga "semilla", no nada. Como el ícono es decorativo (`aria-hidden`), lo más simple es incluir `<span class="sr-only">semilla</span>` junto al ícono.
- Mientras se migra, el equivalente rápido es una función que reemplaza cada emoji conocido (🐛 🌾 🍒 🐟 🐁) por el `<Icon>` correspondiente, como hace el diseño con su mapa `EMO`.
- Los tests que hoy comparan el texto de `describePower` con emoji tienen que actualizarse (ver `06-copy.md`).

Además, `cards.ts` (líneas ~3560–3590) tiene descripciones de cartas de bonificación con emoji ("Cuentan las aves con el ícono 🫀."). Ver Pendientes.

## Íconos de interfaz (`icons/ui/`)

| Archivo | Uso en el diseño |
|---|---|
| `globe` | Modo online / multijugador |
| `bot` | Rival IA (Bienvenida, tablero, registro) |
| `user` | Etiqueta "Tu nombre", jugador |
| `trophy` | Ganador, fin de partida |
| `target` | Objetivos de ronda, caza exitosa |
| `stack` | Cartas solapadas / mazo |
| `star` | Bonificaciones |
| `bird` | Puntos de aves, poder de ave en el registro |
| `plus` | Agregar / crear sala |
| `plus2`, `minus` | Aumentar / disminuir cantidades (línea) |
| `alert` | Error y advertencia |
| `clock`, `hourglass` | Turno / espera |
| `check`, `close` | Confirmar, cerrar, validación |
| `back`, `chev` | Volver, expandir el registro |
| `login` | Unirse a una sala |
| `trash` | Borrar partida guardada |
| `refresh` | Reintentar |
| `wifi`, `wifioff` | Estado de conexión |
| `copy` | Copiar enlace de sala |
| `send` | Invitación enviada / esperando oponente |
| `spinner` | Cargando: aplicá `animation: spin 1s linear infinite` (`@keyframes spin{to{transform:rotate(360deg)}}`, `transform-origin:50% 50%`) solo con `prefers-reduced-motion: no-preference`; con reduced-motion mostrar estático |

**Símbolo de jugador** (`icons/players/*.svg`): cada jugador tiene una forma y un color propios, además del nombre, para no depender solo del color: 1.º círculo mostaza, 2.º triángulo tomate, 3.º cuadrado petróleo (20px, contorno carbón de 2px). Se usan en la barra de jugadores, el registro y el marcador. **[NUEVO]** hoy el juego no asigna forma/color por jugador; si hay más de 3 jugadores, definir formas adicionales (no hay diseño).

## Pendientes (el diseño no cubre estos íconos)

1. **Cartas de bonificación por nombre** (Fotógrafo 📷, Anatomista 🫀, Cartógrafo 🗺️, Historiador 👤): están en `labels.ts` (`nameTagBonus`) y en las descripciones de `cards.ts`. Opciones: (a) mantenerlos como texto/etiqueta sin ícono ("Fotógrafo") usando la palabra en un chip; (b) pedir al diseño que los dibuje en estilo D. Recomendado: (a) por ahora.
2. **Candado 🔒** (mano del rival en secreto) y **ojo 👁️** (vista de solo lectura): sin ícono; usar solo el texto.
3. **Más de 3 jugadores:** solo hay 3 símbolos de jugador.
