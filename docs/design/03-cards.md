# 03 · Carta de ave

Referencia visual: `reference/Cartas.png` (sistema completo, modos, estados) y `reference/Galeria.png` (aves reales en los cuatro modos). Componente del repo: `src/ui/components/BirdCard.tsx` (**[DIFIERE]**: hoy es una tarjeta oscura con emoji; se rehace entera).

## Anatomía (de arriba abajo)

1. **Ventana** (alto `win`): escena de hábitat generada en SVG + **ilustración del ave** (protagonista) + insignia de puntos (arriba izquierda) + fichas de hábitat (arriba derecha, en columna). Borde inferior de 2px carbón.
2. **Nombre** en DM Serif Display; en modo completo también nombre científico en cursiva (12px, `--c-muted`, se corta con elipsis) y envergadura con su glifo ("↔ 203 cm") a la derecha.
3. **Fila de estadísticas**, centrada verticalmente en el espacio libre entre el nombre y la banda: **coste** de alimento a la izquierda; **nido + huevos** (capacidad) a la derecha. El coste vacío se muestra como chip "Gratis" (fondo petróleo, texto crema, 12px).
4. **Banda de poder** pegada al borde inferior; una fila por cada poder. Si no tiene poder, banda crema-2 con "Sin poder".

Peso visual: centro grande y legible; la banda de poder ocupa poca altura (pedido explícito del diseño: "más peso al centro de la carta y al poder un poco menos de altura"). **No** subas la línea divisoria de la banda por encima de la fila coste/nido/huevos.

Contorno de carta: 2px carbón, fondo crema, `overflow: hidden`.

## Los cuatro modos

| Modo | Tamaño | Ventana | Radio | Padding | Nombre | Puntos (círculo / n.º) | Ficha hábitat | Ficha alimento | Ícono stat | Sombra ave | Uso |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `full` | 264×400 | 196 | 16 | 14 | 24px | 46 / 26 | 32 | 26 | 32 | 4px | mercado, detalle, mano inicial |
| `hand` | 192×290 | 146 | 14 | 10 | 17px | 36 / 20 | 26 | 20 | 24 | 3px | tu mano |
| `board` | 132×200 | 108 | 12 | 8 | 14px | 28 / 16 | 22 | 18 | 18 | 2px | aves en tablero |
| `mini` | 114×160 | 80 | 10 | 6 | 13px | 24 / 14 | 20 | 16 | 16 | 2px | listas de modales, elecciones |

Notas por modo:
- `board` y `mini` **ocultan el coste** (solo nido + huevos) salvo que se pida `showCost`; `mini` solo muestra el ícono del timing en la banda (sin texto).
- `hand` recorta el texto del poder a 2 líneas (`-webkit-line-clamp: 2`). `board`/`mini` no muestran texto de poder (solo el nombre del timing o su ícono); el texto completo va en `title` y `aria-label`.
- Nombre en `hand`/`board`/`mini`: máx. 2 líneas con elipsis. En `full` usa `text-wrap: balance`.
- El texto del poder en `full` es de 12px con íconos de 16px en línea; en `hand`, 12px con íconos de 15px.

Márgenes internos de la ilustración (izq/der · arriba · abajo): full 16 · 16 · 6, hand 10 · 12 · 4, board 6 · 8 · 3, mini 4 · 6 · 2. Insignia y fichas se separan del borde por `off`: 10 / 8 / 6 / 5 px.

## Ilustración del ave

- Imágenes reales de `src/ui/assets/birds/*.webp` (mapeo actual en `birdImages.ts`). **No** son vectoriales.
- `object-fit: contain`, `object-position: 50% 100%` (apoyada abajo), y `filter: drop-shadow(0 {sombra}px 0 rgba(22,79,76,.32))` (sombra plana, ver tabla).
- El ave debe llenar la ventana con protagonismo: por eso los márgenes son mínimos.
- **Fallback sin imagen:** silueta carbón al 22% de opacidad (elipse cuerpo, círculo cabeza, pico, patas) centrada y, en modo `full` únicamente, el texto "Ilustración pendiente" (12px, 600, crema sobre bosque, carbón en el resto) a 10px del borde inferior. Se sigue usando este estado mientras se generan las imágenes que faltan.
- `alt` = nombre común del ave.

## Escenas de hábitat (SVG generado, no imágenes)

Cada escena es un `<svg viewBox="0 0 w h">` con `w = anchoCarta − 4` y `h = ventana − 2`, posicionado absoluto detrás del ave. Fórmulas (todas proporcionales a `w` y `h`):

**Bosque** — fondo `--c-petroleo`. Cuatro pinos (triángulos) `pine(cx, alto, ancho, color)` con base en `y = 0.90·h`:
`(0.10w, 0.72h, 0.26w, petróleo-d)`, `(0.27w, 0.46h, 0.17w, petróleo-l)`, `(0.90w, 0.64h, 0.24w, petróleo-d)`, `(0.74w, 0.40h, 0.15w, petróleo-l)`. Franja de suelo `--c-petroleo-d` desde `y = 0.88h` hasta el borde inferior.

**Pradera** — fondo `--c-mostaza`. Sol `--c-mostaza-l`: círculo en `(0.78w, 0.28h)` radio `0.14h`. Colina `--c-mostaza-d`: `M0 0.78h Q0.25w 0.56h 0.5w 0.76h T w 0.70h V h H0 Z`.

**Río** — fondo `--c-menta`. Sol crema: círculo en `(0.76w, 0.28h)` radio `0.13h`. Dos olas rellenas hasta el fondo: `--c-menta-d` en `y = 0.70h` (amplitud `0.05h`, 8 tramos) y `--c-petroleo` en `y = 0.83h` (amplitud `0.045h`, 10 tramos). Cada tramo es una curva cuadrática `Q` alternando arriba/abajo de la línea base.

**Aves de 2 o 3 hábitats** — se recorta cada escena con un `<clipPath>` poligonal en diagonal y se separan con una línea crema de 3px:
- 2 hábitats: `[(0,0),(0.56w,0),(0.44w,h),(0,h)]` y `[(0.56w,0),(w,0),(w,h),(0.44w,h)]`; línea de `(0.56w,0)` a `(0.44w,h)`.
- 3 hábitats: `[(0,0),(0.38w,0),(0.30w,h),(0,h)]`, `[(0.38w,0),(0.72w,0),(0.64w,h),(0.30w,h)]`, `[(0.72w,0),(w,0),(w,h),(0.64w,h)]`; líneas `(0.38w,0)→(0.30w,h)` y `(0.72w,0)→(0.64w,h)`.
- Cada `clipPath` necesita un `id` único por carta (usá un contador o `useId`).

Sugerencia: `HabitatScene.tsx` con props `{ habitats: HabitatId[]; width: number; height: number }`.

## Fichas y símbolos de la carta

- **Puntos:** círculo mostaza, borde 2px carbón, número en DM Serif Display, arriba a la izquierda. `title="Puntos de victoria"`.
- **Ficha de hábitat:** círculo crema con borde 2px carbón, ícono D del hábitat (`forest` / `grass` / `river`) al 60% del tamaño. `role="img"` y `aria-label` con el nombre del hábitat. Apiladas en columna, separación 6px (`full`/`hand`) o 4px (`board`/`mini`).
- **Coste:** un ícono de alimento por unidad. Alternativas ("A o B") se separan con "/" y se unen al resto con "+". Comodín = ícono `wild`.
- **Nido:** ícono D del tipo (`bowl`, `cavity`, `platform`, `ground`, `nestwild`) de `tok − 2` px.
- **Huevos (capacidad):** tantos ícono `egg` como capacidad; los **puestos** con el relleno normal (mostaza clara `#F3CF5E`) y los **vacíos** con relleno crema-2 (`#EBE1C8`). `title="Capacidad: N huevos"`. Tamaño del ícono: 20px en `full`, 17 en `hand`, 14 en `board`, 13 en `mini`.
- **Envergadura:** glifo de flecha doble de 18×11 + "203 cm", 12px `--c-muted`, solo en `full`.

## Bandas de poder (color = tipo de poder)

| Timing (`Power.timing`) | Etiqueta | Fondo | Texto | Ícono (glifo en círculo) |
|---|---|---|---|---|
| `onActivate` | Al activar | `#7B4B2A` marrón | crema | ▶ (`icons/glyph/activate.svg`) |
| `onceBetweenTurns` | Entre turnos | `#EC8FAE` rosa | carbón | ⏸ (`between.svg`) |
| `onPlay` | Al jugar | `#FFFDF6` blanco | carbón | ✦ (`play.svg`) |

- La etiqueta va siempre en texto (12px, 600, mayúsculas, `letter-spacing .07em`) además del color: el color no es el único portador.
- Cada poder es una fila con `border-top: 2px solid carbón`. Dos poderes = dos filas de colores distintos apiladas.
- En `full`: etiqueta con ícono de 20px arriba y texto del poder debajo (12px, `line-height 1.28`). Alto mínimo de banda 64px. Sin poder: 52px (`full`), 40 (`hand`), 24 (`board`), 20 (`mini`).
- Los íconos de alimento dentro del texto del poder van en el color de tinta del fondo (crema sobre marrón, carbón en el resto). Ver `04-icons.md` §RichText.
- Fin de ronda (turquesa) y fin de partida (mostaza clara): **reservados**, hoy sin cartas.

## Estados

| Estado | Cómo se ve |
|---|---|
| Normal | Sin sombra. |
| Seleccionada (`ring`) | `box-shadow: 0 0 0 4px #D9A21B`. |
| Elegida / levantada | `transform: translateY(-12px)` + anillo mostaza + `0 8px 0` carbón. |
| Sin imagen | Silueta + "Ilustración pendiente" (solo `full`). |
| Con huevos | Los óvalos de huevo llenos según `eggs`. |
| Ave recién jugada (`slot--new`, 3 s) | Cae con rebote y lleva un aro mostaza de 5px que se apaga; solo la ranura que cambió. |
| Huevos recién puestos (`egg-pop`) | Solo los huevos nuevos hacen "pop"; los que ya estaban no se mueven. `BirdCard` recibe `newEggs`. |
| Carta recién llegada a la mano o al mercado (`bird-card-wrap--enter`) | Sube desde abajo y aparece. `BirdCard` recibe `entering`. |

Las tres animaciones son transitorias y dependen de lo que cambió en la última jugada (ver `02-components.md` §Movimiento): al cambiar de pestaña o reanudar una partida las cartas aparecen quietas.

Las cartas interactivas son `<button>` (o contienen uno) con `aria-pressed` cuando son seleccionables, foco visible con el anillo mostaza y un `aria-label` que incluya nombre, puntos, coste y poder.

## Texto de poder

El texto que se ve en la banda sale de `describePower()` (`labels.ts`) pasado por dos correcciones que el diseño ya aplica (ver `06-copy.md`): voseo ("Obtené", "Poné", "Robá", "Solapá", "Almacená", "Revelá", "Mové", "Descartá") y plurales correctos ("1 carta" / "2 cartas", "1 huevo" / "2 huevos" en lugar de "carta(s)" y "huevo(s)"), y con los emoji reemplazados por íconos SVG.

## Bonificación de nombre — pendiente

El repo hoy dibuja una marca `card-bonus-mark` con el emoji de la categoría (Fotógrafo 📷, Anatomista 🫀, Cartógrafo 🗺️, Historiador 👤) cuando un ave cuenta para tu bonificación. El diseño **no** define esa marca. Ver `04-icons.md` §Pendientes.
