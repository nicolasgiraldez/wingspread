# 01 · Tokens

Todos los valores están en `tokens.css` (listo para pegar). Este documento explica el uso y cómo se traduce desde las variables actuales de `src/ui/styles.css`.

## Paleta

| Token | Valor | Uso |
|---|---|---|
| `--c-crema` | `#F5EEDC` | Fondo de página, fondo de modales, texto sobre botones oscuros |
| `--c-crema-2` | `#EBE1C8` | Paneles, huecos, superficies hundidas, controles deshabilitados |
| `--c-carbon` | `#22292B` | Texto y **todos** los contornos (2px) y sombras planas |
| `--c-petroleo` | `#1F6F6B` | Bosque, botones de modo, paneles de color |
| `--c-petroleo-d` | `#164F4C` | Sombras de escena, texto sobre menta |
| `--c-petroleo-l` | `#2A8079` | Luces de escena (pinos claros) |
| `--c-mostaza` | `#D9A21B` | Pradera, puntos, turno activo, **selección** y foco |
| `--c-mostaza-l` | `#F3CF5E` | Sol de la escena pradera; reservado fin de partida |
| `--c-mostaza-d` | `#B98512` | Colina de la pradera; borde de aviso de advertencia |
| `--c-tomate` | `#D8472B` | Acentos e íconos. **No** para texto pequeño (contraste) |
| `--c-tomate-d` | `#B23A1F` | Botones primarios (texto crema), errores, texto de error |
| `--c-menta` | `#A9CFC7` | Río, avisos informativos |
| `--c-menta-d` | `#8FBFB5` | Olas de la escena río |
| `--c-muted` | `#4B5558` | Texto secundario (pasa AA sobre crema y crema-2) |
| `--c-slate` | `#56676A` | Texto terciario, solo a 14px o más |
| `--c-placeholder` | `#6B7578` | Placeholder de campos |
| `--c-input` | `#FFFDF6` | Fondo de campos de texto |
| `--c-scrim` | `#2E3638` | Fondo de modales (con `opacity: .72`) |

### Hábitats

`--habitat-forest` = petróleo · `--habitat-grassland` = mostaza · `--habitat-wetland` = menta.

### Poderes (banda de la carta y etiquetas)

| Timing | Fondo | Texto | Token |
|---|---|---|---|
| Al activar (marrón) | `#7B4B2A` | crema | `--power-activate-*` |
| Entre turnos (rosa) | `#EC8FAE` | carbón | `--power-between-*` |
| Al jugar (blanco) | `#FFFDF6` | carbón | `--power-play-*` |
| Fin de ronda (turquesa) | `#5CC2B3` | carbón | `--power-round-*` — **reservado**, no hay cartas |

Ojo: en `labels.ts`/`BirdCard.tsx` los poderes hoy se distinguen con `--color-power-brown/white/pink/teal/yellow`. Usá la tabla de arriba, no los colores viejos (el "blanco" ahora es crema-blanca `#FFFDF6`, no gris).

### Estados

| Estado | Fondo | Borde |
|---|---|---|
| Error | `#F6D5CC` | `#B23A1F` |
| Advertencia | `#F8E6B0` | `#B98512` |
| Info | `#A9CFC7` | `#164F4C` |
| OK | `#A9CFC7` | `#1F6F6B` |

Los avisos llevan además un **ícono y una palabra** (Error, Atención…) para que el color no sea lo único que informa.

## Tipografía

- **DM Serif Display** (400): titulares, nombres de carta, cifras grandes (puntajes).
- **Work Sans** 400 / 500 / 600 / 700: todo lo demás.
- Etiquetas: 13px, 600, mayúsculas, `letter-spacing: .08em`, color `--c-muted` (clase `.label`).
- Cuerpo: 16px. Datos secundarios: 14px. **Mínimo absoluto: 12px.**
- Campos y botones grandes: 17–18px.
- Titulares vistos en los tableros: 72 / 64 (bienvenida), 44, 34, 29, 26, 24, 21 px (DM Serif). Usá el tamaño del PNG correspondiente.

Cambio en `index.html`: quitar Inter y cargar
`https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Work+Sans:wght@400;500;600;700&display=swap`.

## Forma

- **Contorno:** siempre 2px carbón. Nada de bordes finos ni translúcidos.
- **Radios:** botones y campos 12px; paneles, avisos y filas 14px; tarjetas de modo 16px; modales 18px; círculos 50%.
- **Sombras planas** (sin blur): `0 2px 0`, `0 4px 0` (botones/avisos), `0 8px 0` (carta levantada), siempre en carbón. La sombra del ave en la carta es `0 Npx 0 rgba(22,79,76,.32)` (N según modo, ver `03-cards.md`).
- **Selección / foco:** anillo `0 0 0 4px #D9A21B`.

## Espaciado

Escala de 4px: 4, 8, 12, 16, 20, 24, 32, 48. Gutter de página en móvil: 16px.

## Movimiento

Tokens de duración y curva, definidos en `tokens.css`. **Solo se usan dentro de `@media (prefers-reduced-motion: no-preference)`**; con movimiento reducido no hay animación de entrada ni de salida (ver `02-components.md` §Movimiento).

| Token | Valor | Uso |
|---|---|---|
| `--dur-fast` | `.18s` | Microinteracciones: el chip de turno que salta |
| `--dur-base` | `.4s` | Entradas: ave que cae, carta que llega, huevo, alimento que sube en la reserva, cubo gastado |
| `--dur-slow` | `.7s` | Salidas y relanzamientos: dado que se despide, dados relanzados |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | Entradas suaves (cartas, dados) |
| `--ease-pop` | `cubic-bezier(.34,1.56,.64,1)` | Con rebote: lo que "cae" o "salta" (ave, huevo, chip, cubo) |

**La velocidad del juego los reemplaza.** El contenedor de la partida lleva `data-speed="normal|fast|instant"` y en `rival.css` las velocidades altas redefinen los tres `--dur-*` (ver `02-components.md` §Selector de velocidad):

| Velocidad | `--dur-fast` | `--dur-base` | `--dur-slow` |
|---|---|---|---|
| Normal (por defecto, los de `:root`) | .18s | .4s | .7s |
| Rápida (`fast`) | .1s | .22s | .38s |
| Sin pausas (`instant`) | .08s | .15s | .2s |

Reglas: sombras siempre planas (nada de `blur` en las animaciones), solo `transform`/`opacity` salvo el dado que se despide (anima `width` para cerrar el hueco), y ningún color fuera de la paleta (el aro de "recién cambiado" es `--c-mostaza`).

## Tabla de equivalencias con `styles.css` actual

| Variable actual | Reemplazo | Nota |
|---|---|---|
| `--color-bg` | `--c-crema` | |
| `--color-text` | `--c-carbon` | |
| `--color-text-secondary` | `--c-muted` | |
| `--color-text-muted`, `--color-text-dim` | `--c-slate` | solo ≥14px; si es más chico, `--c-muted` |
| `--color-border`, `--color-border-light` | `--c-carbon` (2px) | ya no hay borde "suave" |
| `--color-panel-bg`, `--color-panel-bg-alt` | `--c-crema-2` | |
| `--color-panel-bg-raised` | `--c-crema` + `--shadow-press` | |
| `--color-forest` / `-strong` | `--habitat-forest` / `--c-petroleo-d` | |
| `--color-forest-bg`, `-border` (y equivalentes de pradera/río) | eliminar | los hábitats se dibujan con color sólido, no translúcido |
| `--color-grassland` | `--habitat-grassland` | |
| `--color-wetland` | `--habitat-wetland` | |
| `--color-power-brown` | `--power-activate-bg` | |
| `--color-power-white` | `--power-play-bg` | |
| `--color-power-pink` | `--power-between-bg` | |
| `--color-power-teal` | `--power-round-bg` | reservado |
| `--color-power-yellow` | `--c-mostaza-l` | reservado |
| `--color-danger` | `--c-tomate-d` | |
| `--color-success` | `--state-ok-*` | |
| `--color-gold` | `--c-mostaza` | |
| `--color-cube-blue` | `--c-petroleo` | **Decisión a confirmar:** el diseño no muestra cubos de acción (ver `05-screens.md` §1) |
| `--font-family` | `--font-body` (+ `--font-display`) | |
| `--radius-sm/md/lg` | `--radius-btn/card/panel` | 6px desaparece |
| `--shadow-sm/md/lg` | `--shadow-press-sm/press/lift` | sombras planas, no difusas |

## Contraste (ratios calculados)

| Combinación | Ratio | Uso permitido |
|---|---|---|
| Carbón sobre crema / crema-2 / blanco | 12.8 / 11.4 / 14.5 | todo texto |
| Carbón sobre mostaza / menta / rosa / turquesa | 6.4 / 8.8 / 6.4 / 6.9 | todo texto |
| Carbón sobre fondo de error / advertencia | 10.8 / 11.9 | texto de avisos |
| Crema sobre tomate profundo / petróleo / marrón | 5.2 / 5.1 / 6.3 | botones y bandas |
| `--c-muted` sobre crema / crema-2 | 6.6 / 5.9 | texto secundario |
| `--c-slate` sobre crema / crema-2 | 5.1 / 4.6 | solo ≥14px |
| Petróleo profundo sobre menta | 5.5 | texto sobre río |
| Placeholder `#6B7578` sobre `#FFFDF6` | 4.65 | solo placeholder |
| Tomate profundo sobre crema | 5.2 | texto de error sobre crema |

Prohibido: tomate `#D8472B` como texto (3.7), crema sobre mostaza (2.0) y tomate profundo como texto **sobre** el fondo de error (4.35, en avisos usar carbón).
