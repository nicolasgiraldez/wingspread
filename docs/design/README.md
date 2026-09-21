# Wingspread · Diseño "Plano mid-century" para implementar

Esta carpeta es el paquete de traspaso del rediseño de Wingspread. Está pensada para que Claude Code (o cualquier dev) lo implemente sobre el repo actual sin tener que adivinar. Todo lo que ves acá sale del lienzo de diseño; los PNG de `reference/` son la verdad visual, y estos documentos explican las reglas y dónde toca cada cambio en el código.

Lienzo de diseño (fuente): https://claude.ai/artifact/2bjai94NYTLXUonNNMtDxW

## Qué es el rediseño en una frase

Un cambio de tema completo: de la interfaz oscura verde con Inter a un estilo claro tipo plano mid-century (fondo crema, contornos carbón de 2px, sombras planas desplazadas, tipografías DM Serif Display + Work Sans), con íconos SVG propios en lugar de emoji, cartas ilustradas con banda de poder por color, y el texto de toda la interfaz en voseo rioplatense.

**No es un retoque de colores.** Cambia `:root` en `src/ui/styles.css`, la fuente de `index.html`, el layout de varias pantallas y los textos. Ver `07-plan.md` para hacerlo por fases sin romper el juego.

## Contenido

| Archivo | Para qué sirve |
|---|---|
| `01-tokens.md` | Colores, tipografía, formas, sombras, espaciado y movimiento (duraciones, curvas y velocidades). Tabla de equivalencias con las variables actuales del repo. |
| `02-components.md` | Botones, campos, chips, paneles, avisos, toasts, modales: medidas, estados y reglas de accesibilidad. También el banner de turno, el panel de acción del rival, el selector de velocidad y el catálogo de animaciones. |
| `03-cards.md` | Sistema de carta de ave: 4 modos, geometría de la escena por hábitat, bandas de poder, selección. |
| `04-icons.md` | Qué SVG reemplaza a cada emoji del repo, componente `RichText` para los textos con emoji, íconos de interfaz. |
| `05-screens.md` | Pantalla por pantalla: tablero de referencia, componente del repo, layout, estados y diferencias con lo actual. §9: turno del rival y animaciones. |
| `06-copy.md` | Reglas de voseo y tabla completa de textos actuales → nuevos, más los textos nuevos propuestos y qué tests actualizar. |
| `07-plan.md` | Orden de implementación por fases (la 8 es el turno del rival y las animaciones), checklist de aceptación y accesibilidad. |
| `tokens.css` | Variables CSS listas para pegar (reemplaza el `:root` oscuro). |
| `components.css` | Borrador de clases base (botón, campo, chip, aviso, toast, modal). |
| `logo.svg` | Logo actual (se mantiene; ver "Decisiones cerradas"). |
| `icons/*.svg` | 18 íconos de juego (estilo "D": color desplazado + contorno carbón) y `manifest.json`. |
| `icons/ui/*.svg` | 26 íconos de interfaz (globo, bot, copiar, wifi, reloj, etc.). |
| `icons/glyph/*.svg`, `icons/players/*.svg` | Glifos de timing sin círculo (para las bandas de la carta) y los 3 símbolos de jugador. |
| `reference/*.png` | Captura de cada tablero del lienzo, a tamaño real. **Excepción:** `TurnoRival`, `AccionRival`, `AccionRivalMovil`, `MenuVelocidad` y `AnimacionAve` son capturas de la app ya implementada (no salen del lienzo). |

**Ojo con el movimiento:** el CSS de las animaciones (mesa, turno del rival, puntos "está jugando", velocidad) no vive en esta carpeta sino en `src/ui/motion.css` y `src/ui/rival.css`. Acá están las reglas, el catálogo (`02-components.md` §Movimiento) y los tokens (`tokens.css`).

## Índice de tableros → PNG → código

| Tablero (PNG en `reference/`) | Componente(s) del repo | Doc |
|---|---|---|
| `Sistema.png` | `src/ui/styles.css`, `index.html` | 01 |
| `Cartas.png`, `Galeria.png` | `BirdCard.tsx` | 03 |
| `IconosD.png` | `labels.ts` + nuevo `Icon.tsx` | 04 |
| `Main.png`, `Movil.png` | `App.tsx` (layout general) | 05 §1 |
| `Paneles.png`, `PanelesMovil.png` | `BirdFeeder.tsx`, `RoundGoalsMat.tsx`, `BirdMarket.tsx` | 05 §2 |
| `Bienvenida.png`, `BienvenidaMovil.png` | `HomePage.tsx` | 05 §3 |
| `Configuracion.png` | `HomePage.tsx` (solitario, online), `ConnectingScreen.tsx` | 05 §3 |
| `ManoInicial.png`, `ManoInicialMovil.png` | `StartingHandModal.tsx`, `ChooseBonusCardModal.tsx` | 05 §4 |
| `FinPartida.png`, `FinPartidaMovil.png` | `GameOverModal.tsx` | 05 §5 |
| `ModalJugarAve*.png` | `PlayBirdModal.tsx` | 05 §6 |
| `ModalPonerHuevos*.png` | `LayEggsModal.tsx` | 05 §6 |
| `ModalPoderes*.png` | `HabitatPowersModal.tsx`, `PowerChecklist.tsx` | 05 §6 |
| `ModalBonificacion*.png` | `ChooseBonusCardModal.tsx` y pantallas de espera de `App.tsx` | 05 §6 |
| `EstadosTablero*.png` | `PlayerBoard.tsx`, sección "Tu mano" de `App.tsx` | 05 §7 |
| `EstadosConexion*.png` | `ConnectionStatusBar.tsx`, `peerManager.ts`, errores de `HomePage.tsx` | 05 §7 |
| `RegistroAvisos*.png` | Registro del panel lateral de `App.tsx` + avisos (toasts) | 05 §8 |
| `TurnoRival.png`, `AccionRival.png`, `AccionRivalMovil.png` | `GameTopBar.tsx`, `GameSidebar.tsx`, `RivalActionPanel.tsx`, banner de turno de `App.tsx` (captura de la app) | 05 §9, 02 |
| `MenuVelocidad.png` | `GameTopBar.tsx` (menú de la partida) (captura de la app) | 05 §1, 02 |
| `AnimacionAve.png` | `PlayerBoard.tsx`, `motion.css` (captura de la app, fotograma de la animación) | 02 §Movimiento |

## Cómo leer la marca "Propuesta / Nuevo"

El diseño va más allá de lo que el juego tiene hoy. Cada elemento que **no existe en el repo actual** está marcado así:

- **[EXISTE]** ya está en el juego; el diseño solo cambia su aspecto o textos.
- **[NUEVO]** el diseño lo propone y hay que construirlo (toasts, registro completo con filtros, varios estados vacíos y de error, variantes de conexión).
- **[DIFIERE]** existe, pero el diseño lo organiza distinto (ver `05-screens.md`).

Si algo marcado [NUEVO] implica lógica de juego que no está clara, implementá solo la parte visual y dejá una nota; no inventes reglas.

## Principios (no negociables)

1. **Formas planas, tintas firmes, contorno carbón de 2px.** Si un adorno no ayuda a leer el juego, se quita.
2. **Sin emoji como interfaz.** Todo ícono es un SVG. (Los emoji de `labels.ts` y de textos sueltos se reemplazan; ver `04-icons.md`.)
3. **Texto mínimo 12px; objetivos táctiles mínimo 44×44px.**
4. **Elementos reales:** `<button>`, `<input>`, `<label for>`, `<select>`. Nada de `div` con `onClick`.
5. **Un control deshabilitado dice por qué, en texto** ("Sin alimento suficiente"), no solo se apaga.
6. **Voseo en todo el texto de interfaz** (ver `06-copy.md`).
7. **El color nunca es el único portador de significado:** los poderes llevan su etiqueta ("Al activar", "Entre turnos", "Al jugar") además del color de banda.

## Decisiones cerradas

- **Logo:** se mantiene el actual (círculo mostaza con flecha carbón, `logo.svg`). Se exploraron 10 alternativas y se decidió no cambiarlo por ahora. No las implementes.
- **Sistema de íconos:** estilo "D" (relleno de color desplazado + contorno carbón).
- **Voseo** en toda la interfaz.

## Datos de ejemplo en los tableros

Nombres de jugadores (Nico, Santi, Rival), aves, cifras y mensajes de los tableros son **de ejemplo**. No hay que copiarlos como datos; sirven para mostrar estructura. Las aves reales y sus imágenes salen de `src/game/cards.ts` y `src/ui/assets/birds/*.webp`.

## Decisiones abiertas para quien implemente

- **Fin de ronda (turquesa) y fin de partida (mostaza clara):** colores reservados en la paleta; el juego aún no tiene cartas con esos timings. Dejar los tokens, no dibujar nada con ellos.
- **Íconos de cartas de bonificación** (Fotógrafo, Anatomista, Cartógrafo, Historiador): hoy son emoji (📷 🫀 🗺️ 👤) y el diseño **no** define íconos propios para ellos. Ver `04-icons.md` §"Pendientes".
- **Ilustración de aves faltantes:** si un ave no tiene imagen, la carta usa la silueta con el texto "Ilustración pendiente" (ver `03-cards.md`).
