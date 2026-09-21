# 02 · Componentes base

Las clases están en `components.css`. Las medidas salen de los tableros; ante cualquier diferencia, manda el PNG. Sugerencia de estructura en el repo: `src/ui/components/ui/` con `Button.tsx`, `Field.tsx`, `Chip.tsx`, `Banner.tsx`, `Toast.tsx`, `Modal.tsx`, `Icon.tsx`.

## Botones

| Variante | Fondo | Texto | Borde | Sombra |
|---|---|---|---|---|
| Primario | `--c-tomate-d` | crema | 2px carbón | `0 4px 0` carbón |
| Secundario | transparente | carbón | 2px carbón | ninguna |
| De modo (tarjeta grande de Bienvenida) | petróleo (solitario) / mostaza (online, texto carbón) | crema / carbón | 2px carbón | `0 4px 0` carbón, radio 16 |
| Deshabilitado | crema-2 | `--c-muted` | 2px **punteado** | ninguna |

- Alturas: **56** (acción principal de pantalla), **52** (estándar), **44** (mínimo, botones secundarios y de modal compacto). Nunca menos de 44.
- Radio 12. Padding horizontal 20 (18 en el de 44). Texto Work Sans 600, 17px (15px en el de 44).
- Pulsado: baja 2px y la sombra pasa de 4 a 2 (`translateY(2px)` + `0 2px 0`).
- Ícono + texto: ícono de 18px, separación 8px.
- **Solo ícono:** 44×44, `aria-label` y `title` obligatorios (ej. borrar partida guardada, cerrar).
- **Deshabilitado siempre explica el motivo** en el propio texto del botón o en una línea al lado ("Sin alimento suficiente", "Escribí tu nombre para empezar"). Usar `aria-disabled` + el texto; no solo el atributo `disabled` mudo.
- Existe en el repo hoy: botones sueltos con estilos inline en cada componente. **Unificar** en un `Button`.

## Campos de texto

- `<label for>` visible arriba (13px, 600, mayúsculas, `--c-muted`), con ícono opcional de 16px a la izquierda. `aria-label` solo si no hay etiqueta visible.
- Input: alto **56**, radio 12, borde 2px carbón, fondo `#FFFDF6`, padding 0 16, Work Sans 18px.
- Foco: `outline: 3px solid #D9A21B; outline-offset: 2px`.
- Ayuda debajo (14px, `--c-muted`) y error debajo (14px, 600, tomate profundo) con `aria-describedby`; el input se marca `aria-invalid="true"` y toma fondo de error.
- Placeholders en voseo: "Escribí tu nombre..." (ver `06-copy.md`).

## Chips

Píldora de 28px de alto mínimo, borde 2px carbón, texto 12px 600. Activo = fondo mostaza. Los chips **filtro** (registro de partida) miden 44px de alto para ser tocables. **[NUEVO]** los filtros; el chip de "Nombre" en cartas ya existe (`card-bonus-mark`).

## Paneles

Crema-2, borde 2px carbón, radio 14, padding 16. Variante elevada: fondo crema + `0 4px 0`.

## Avisos en línea (banner)

Estructura: ícono 20–24px + título en 600 + texto de 14px. Fondo y borde según `01-tokens.md` §Estados, sombra `0 4px 0` carbón, radio 14, `role="status"` (o `role="alert"` para error).

| Tipo | Fondo / borde | Ícono | Ejemplo real del juego |
|---|---|---|---|
| error | `#F6D5CC` / tomate profundo | `alert` | "Sin conexión con el anfitrión: tu jugada no se envió." |
| warn | `#F8E6B0` / mostaza oscuro | `clock` | reconectando |
| info | menta / carbón | `wifi` | "Esperando al anfitrión..." |
| ok | menta / petróleo profundo | `check` | "¡Enlace copiado!" |

Nota de contraste: en el tablero el título del aviso de error está en tomate profundo sobre `#F6D5CC` (4.35:1, por debajo de AA para 16px). **Al implementar, poné el título en carbón** y dejá el tomate solo en borde e ícono.

**[EXISTE]** el mensaje de conexión en `ConnectionStatusBar.tsx` y `connectionMessage` en `App.tsx`; **[NUEVO]** el sistema de cuatro tipos. Ver `05-screens.md` §7 para todas las variantes.

### Banner de turno — [NUEVO]

En la fase de rondas hay **siempre** un banner de turno sobre la mesa, con el mismo alto (`min-height: 56px`, clase `banner--turn`) en los dos casos. Es a propósito: si apareciera solo en el turno del rival, todo lo de abajo (dados, mercado) **saltaría unos 75px justo cuando te devuelven el turno** y podrías pulsar el dado equivocado.

| Turno | Tipo | Ícono | Texto |
|---|---|---|---|
| Tuyo | warn (amarillo, como el chip "Tu turno") | `star` | **Tu turno** · Elegí una acción |
| Del rival (IA) | info (menta) | `hourglass` | **Turno de {nombre}** · Está jugando ••• |
| Del oponente (online) | info (menta) | `hourglass` | **Turno de {nombre}** · Esperando su jugada ••• |

Mantené los textos cortos: en móvil no deben partirse en dos líneas (un alto distinto reintroduce el salto).

### Puntos "está jugando" — [NUEVO]

Tres puntos de 6px (`currentColor`, separación 4px, 6px de margen izquierdo) que se encienden en fila (`dots-pulse`, 1.2s, desfase .15s). Son **decorativos** (`aria-hidden`): el texto de al lado ya dice que está jugando. Con movimiento reducido quedan quietos al 60% de opacidad. Se usan en tres lugares del turno del rival:

1. **Chip de turno** de la barra superior: en el turno del rival, fondo menta (`topbar__turn--rival`) y el texto "Turno de {nombre}" + puntos; en el tuyo, mostaza y "Tu turno". El chip se remonta al cambiar de dueño y "salta" (`chip-pop`).
2. **Fila del marcador** del jugador en turno cuando no sos vos: la marca "Turno" lleva los puntos y la fila "respira" (`turn-breathe`, sombra plana `0 0 → 0 2px`, .8s alternando).
3. **Banner de turno** (arriba).

Nada depende solo del color ni del movimiento: el texto "Turno de …" está siempre.

## Panel de acción del rival — [NUEVO]

Cuenta lo que acaba de hacer el rival (la IA o el oponente online): quién, qué jugada y qué poderes disparó. **Panel propio**, distinto de los toasts. Ver `reference/AccionRival.png` y `AccionRivalMovil.png`.

- **Posición:** fijo sobre la mesa, centrado en el área de juego, `z-index` bajo el menú de la barra y bajo los modales. Escritorio: `top: 84px` y `left: 280px` (deja libre el lateral). Tablet (<1024): `top: 80px`, `left: 0`. Móvil (≤640): `top: 100px`, margen lateral 12px (cubre unos segundos lo que está debajo de la barra). La región contenedora no captura el puntero; solo el panel.
- **Caja:** ancho `min(560px, 100%)`, fondo crema, borde 2px carbón, radio 14, sombra `0 4px 0`, padding `14 8 20 14`, separación 12px.
- **Contenido:** ficha de 40×40 (crema-2, borde 2px, radio 9) con el **símbolo del jugador** de 28px; etiqueta con el nombre en mayúsculas (13px, `--c-muted`; el nombre de la forma va en `sr-only`, "(triángulo)"); la **frase principal** en 18px 600 con el nombre del ave en negrita y sin corchetes; si hubo poderes, una lista separada por un borde **punteado** 2px `--c-muted`, con ícono de 20px por entrada (`bird` poder, `target` caza exitosa, `close` caza fallida) y el texto de 14px ("Poder de {ave}: …", "Depredador {ave}: …").
- **Cierre:** botón de solo ícono 44×44 (`aria-label="Cerrar aviso"`, `title`). Cerrarlo también libera al rival para su siguiente jugada.
- **Barra de tiempo:** 4px carbón abajo, `scaleX(1 → 0)` durante lo que queda a la vista (variable `--hold`).
- **Entrada:** `rival-in` (baja 12px y aparece, .18s) bajo `no-preference`.
- **Accesibilidad:** la región contenedora es `role="status"` con `aria-label="Acción del rival"` y **está siempre montada** (así los lectores anuncian cada acción nueva); no roba el foco. Una acción nueva reemplaza a la anterior.
- **Frases** (ver `06-copy.md`): "Jugó {ave} en el {hábitat}.", "Tomó {n} {alimento} del comedero.", "Relanzó el comedero y tomó …", "Puso {n} huevos en {ave}.", "Robó {ave} del mercado y {n} carta(s) del mazo.", "Relanzó los dados del comedero." La preparación inicial y la elección de bonificación **no se anuncian**.

### Ritmo del turno del rival

El rival no juega al instante: primero **espera** ("está jugando"), después juega y **deja a la vista** lo que hizo antes de la siguiente jugada. Solo aplica a la IA (a un oponente humano no se lo frena: su jugada ya está hecha y solo se anuncia).

| Velocidad | Espera antes de jugar | Se espera a que se lea | Queda a la vista |
|---|---|---|---|
| Normal | 800 ms | `1300 ms + 40 ms × caracteres`, entre 1,8 y 4,5 s | lo mismo que se espera |
| Rápida | 400 ms | la mitad | lo mismo que se espera |
| Sin pausas | 0 | **nada** (el rival sigue con su racha) | 2 s fijos, sin frenar |

"Caracteres" = frase principal + nombre y texto de cada poder. Sin pausas, una ronda entera del rival pasa en un instante y solo queda a la vista su última acción.

## Selector de velocidad — [NUEVO]

Vive en el **menú de la partida** (botón ☰ de la barra superior), arriba de "Volver al inicio" / "Nueva partida", separado por un borde punteado. Ver `reference/MenuVelocidad.png`.

- Etiqueta "Velocidad" (`.label`) + tres chips-filtro (`chip chip--filter`, 44px de alto, padding lateral 12px para que quepan en una fila a 390px): **Normal**, **Rápida**, **Sin pausas**. El elegido lleva `chip--on` (mostaza) y `aria-pressed="true"`.
- Debajo, una línea de 14px `--c-muted` que explica la opción elegida (ver `06-copy.md`).
- Elegir **no cierra** el menú. El menú mide `min(320px, 100vw − 24px)`.
- Se **recuerda en el navegador** (`localStorage`, clave `wingspread.speed.v1`); si el almacenamiento está bloqueado vale para la sesión. Por defecto, Normal.
- Efecto: pausas del rival (tabla de arriba), duraciones de las animaciones (`01-tokens.md` §Movimiento) y duración del conteo del marcador.

## Marcador que cuenta — [NUEVO]

Los puntos de cada jugador **cuentan hacia el valor nuevo** en vez de saltar: 600 ms (Normal), 300 (Rápida), 150 (Sin pausas), curva de salida cúbica. Al montarse muestra el valor sin animar. Con movimiento reducido salta directo. Accesibilidad: la cifra animada es `aria-hidden` y el valor final va en un `sr-only` ("6 puntos"), así que los lectores nunca leen valores intermedios.

## Toasts — [NUEVO]

Avisos efímeros por eventos del juego (fuera de tu turno o de un modal). Hoy el juego solo tiene el registro del panel lateral y el banner de conexión.

- Escritorio: pila abajo a la derecha, **máximo 3 visibles**; el más nuevo queda arriba y los anteriores se comprimen a una línea. Móvil: arriba, ancho completo (358px en el tablero), **máximo 2 a la vez**.
- Cada toast: 400px máx., borde 2px, radio 14, `0 4px 0`, `role="status"` (el de error `role="alert"`), ficha de ícono 32×32 (radio 9, borde 2px) + título 16px 700 + mensaje 14px + botón "Cerrar aviso" de 44×44 (`aria-label`). Los nombres de aves van en negrita.
- **Se cierran solos a los 5 s** con una barra de progreso de 4px abajo; **los errores no se cierran solos** y no llevan barra: traen un botón de acción ("Reintentar").
- Variantes (tablero `RegistroAvisos.png`):

| Tipo | Fondo | Ficha de ícono | Ejemplo |
|---|---|---|---|
| `turn` | mostaza | `clock` | "Es tu turno · Tomá una acción: jugar un ave, comida, huevos o cartas." |
| `pow` | crema | `bird` sobre menta | "Poder de Turpial de Baltimore · Tomó 1 fruta del comedero." |
| `hunt` | menta | `target` | "¡Caza exitosa! · Búho Barrado reveló a Colibrí de Anna (13 cm ≤ 75 cm) y la solapó debajo." |
| `miss` | crema-2 | `close` | "Caza fallida · Fumarel Negro relanzó 2 dados fuera del comedero y ninguno coincidió." |
| `round` | carbón (texto crema) | logo | "Comienza la ronda 3 · Quedan 2 rondas. Revisá los objetivos de la ronda." |
| `err` | error `#F6D5CC`, borde tomate profundo | `alert` | "Sin conexión con el anfitrión · Tu jugada no se envió. Reintentá cuando vuelva." + botón Reintentar |

- Cuándo dispararlos: `pow`/`hunt`/`miss` cuando un poder **propio** produce un resultado (los mismos eventos que hoy van al registro), `round` al cambiar de ronda, `err` cuando `App.tsx` hoy hace `setConnectionMessage("Sin conexión con el anfitrión…")`, y `turn` solo si el turno te llega sin que haya jugado un rival.
- **Lo que hace el rival no va en toasts:** ni sus poderes y cazas (`pow`/`hunt`/`miss`) ni el "Es tu turno" que sigue a su jugada. Los cuenta el **panel de acción del rival** (arriba), y el chip y el banner de turno ya dicen que te toca. Vale para la IA y para el oponente online. Tus propios poderes siguen saliendo como toast.
- Respetar `prefers-reduced-motion` (sin animación de entrada).

## Modales

Estructura tomada de los tableros `Modal*.png` (misma carcasa para todos):

- **Fondo (scrim):** `--c-scrim` (#2E3638), opaco en el tablero; en el juego usar `opacity: .72` sobre la pantalla.
- **Panel:** crema, borde 2px carbón, **radio 22**, sombra `0 8px 0` carbón, columna con separación de 20px.
- **Cabecera:** padding 24/28; a la izquierda ficha de ícono opcional de 56×56 (radio 16, fondo menta, borde 2px) + título DM Serif 30px (26 en móvil) + subtítulo de 15px `--c-muted`; a la derecha botón cerrar de 44×44 (`aria-label="Cerrar"`).
- **Cuerpo:** padding lateral 28; pasos con título DM Serif de 20px ("1. Elegí el hábitat") y nota de 14px `--c-muted`.
- **Pie:** borde superior **punteado** 2px `--c-muted`, acciones alineadas a la derecha con separación 12px (secundario a la izquierda del primario; se apilan en móvil).
- **Anchos en escritorio:** Jugar ave 1000, Poner huevos 900, Bonificación / esperas 640, Poderes de hábitat ver PNG. Alto según contenido, con scroll interno si no entra.
- **Móvil:** el panel mide 358px (390 − 16 de margen a cada lado), mismo radio y sombra, cabecera y pie con padding 16. El contenido es una sola columna; en Poner huevos las filas de aves pasan a tarjetas apiladas.
- **Controles internos:** `<select>` alto 48, radio 10; botones tipo píldora (elección de hábitat, cantidades) alto 48, seleccionado = mostaza + `0 3px 0`; casillas de 24×24 con `accent-color` petróleo; estado de validación con ícono `check` (petróleo) o `close` (tomate profundo) más texto.
- **Accesibilidad:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` al título, foco atrapado, foco inicial en el primer control útil, Esc cierra (salvo los obligatorios: mano inicial y elección de bonificación), el foco vuelve al disparador.

## Dado del comedero y fichas de alimento

Ver `Paneles.png` y `EstadosTablero.png`. Dado: 76×84, radio 14, borde 2px carbón, ícono del recurso de 40px, sombra `0 4px 0`; seleccionado = anillo mostaza. **Deshabilitado:** sin sombra, opacidad .55 y `cursor: not-allowed` (más el motivo en texto en el panel). **Dado vacío** (comedero sin dados): "hueco" de mismo tamaño con borde 2px punteado `--c-muted` y sin relleno. Ficha de alimento de tu reserva: ícono + cantidad, ver PNG.

**Dado que se despide y dados relanzados:** cuando un dado sale del comedero se dibuja un **dado fantasma** en su lugar de antes (un `<span>`, no un botón: `aria-hidden`, sin puntero) que sube, se apaga y cierra el hueco, para que los demás dados se deslicen en vez de saltar. Los dados relanzados caen girando, escalonados (70 ms × posición). Con movimiento reducido el fantasma no se dibuja. **Las pruebas y el e2e deben elegir dados con `button.die-token`**, nunca con `.die-token` a secas.

## Estados que todo componente interactivo debe cubrir

reposo · hover (translateY(-2px) en opciones, +2px en botones de modo) · foco visible (anillo mostaza) · pulsado · deshabilitado (con motivo) · cargando (ícono `spinner`, `aria-busy="true"`).

## Movimiento

Contenido, y siempre en función de lo que pasó en el juego: nada se mueve "porque sí". Todo bajo `prefers-reduced-motion: no-preference`; con movimiento reducido no hay animaciones de entrada ni de salida, los puntos "está jugando" quedan quietos, el marcador salta directo y el dado que se despide no se dibuja. Duraciones y curvas: `01-tokens.md` §Movimiento (dependen de la velocidad elegida).

**Los de siempre:** hundimiento de botón al pulsar, giro del `spinner`, entrada de toast.

**De la mesa** (se disparan con lo que cambió en la última jugada, sea tuya, de la IA o del oponente online):

| Qué cambió | Efecto | Clase | Duración / curva |
|---|---|---|---|
| Un ave entró a un tablero | Cae 28px con un leve agrandado y rebota; un **aro mostaza** de 5px se apaga en 2,4 s (`reference/AnimacionAve.png`) | `slot--new` | `--dur-base` · `--ease-pop` |
| Se pusieron huevos | Solo los **nuevos** hacen "pop" (0 → 1,35 → 1), escalonados .08 s | `egg-pop` | `--dur-base` · `--ease-pop` |
| Una carta llegó a tu mano o al mercado | Sube 26px desde abajo y aparece | `bird-card-wrap--enter` | `--dur-base` · `--ease-out` |
| Salió un dado del comedero | Dado fantasma que sube, se apaga y cierra el hueco | `die-token--ghost` | `--dur-slow` · `--ease-out` |
| Se relanzó el comedero | Los dados caen girando, escalonados | `die-token--rolled` | `--dur-slow` · `--ease-out` |
| Subió un alimento (o los huevos) del jugador cuyo tablero ves | La ficha de la reserva salta 5px | `reserve__tile--bump` | `--dur-base` · `--ease-out` |
| Se gastó un cubo de acción | El cubo hace un rebote (solo si la fila sigue mostrando a quien lo gastó) | `cube--just-spent` | `--dur-base` · `--ease-pop` |
| Cambió el turno | El chip de turno salta | `topbar__turn` | `--dur-fast` · `--ease-pop` |
| Cambió un puntaje | La cifra cuenta hacia el valor nuevo | — (JS) | 600 / 300 / 150 ms |

**Regla de oro: solo se anima lo que cambió.** Cada estado nuevo se compara con el anterior de la misma partida (`diffBoard`, `src/ui/boardChanges.ts`) y lo que cambió queda marcado 3 segundos (`useBoardChangeTracker`, publicado por contexto). Por eso **no se anima nada** al cambiar de pestaña (ver el tablero del rival), al reanudar una partida guardada, al empezar otra ni al volver al inicio. En online funciona igual, comparando cada estado recibido con el anterior, sin cambiar el protocolo. Las clases y los `keyframes` están en `src/ui/motion.css` (mesa) y `src/ui/rival.css` (turno del rival, puntos, velocidad).
