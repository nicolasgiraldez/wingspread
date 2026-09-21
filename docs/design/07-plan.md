# 07 · Plan de implementación

Orden recomendado, con criterios de aceptación por fase. Cada fase debería dejar el juego **jugable** y con `npm run typecheck`, `npm run lint`, `npm test` y `npm run e2e` en verde antes de pasar a la siguiente.

## Antes de empezar

1. **El repo tiene cambios sin commitear** en `src/game/cards.ts`, `src/game/types.ts`, `src/ui/components/GameOverModal.tsx` y `src/ui/components/RoundGoalsMat.tsx` (y `.claude/` sin seguimiento). Dos de ellos son componentes que este plan reescribe. **Pedile al dueño del repo que los commitee o guarde antes de empezar** para no mezclar cambios.
2. Trabajá en una rama propia (`design/plano-mid-century`) y en fases con commits chicos.
3. **Aviso de alcance:** los componentes actuales tienen **colores oscuros escritos a mano en estilos inline** (por ejemplo `#c3ccc5`, `#212b22`, `#3fae72`, `rgba(240, 100, 95, .15)`), no solo variables CSS. Cambiar `:root` no alcanza: cada componente hay que restilarlo. Buscá con `grep -rn "#[0-9a-fA-F]\{6\}\|rgba(" src/ui` y no dejes ningún color literal fuera de `tokens.css` al terminar.

## Fase 1 · Fundaciones

- `index.html`: reemplazar Inter por DM Serif Display + Work Sans (enlace en `tokens.css`); `<html lang="es">`.
- Copiar `tokens.css` y `components.css` a `src/ui/` e importarlos desde `main.tsx` (o dentro de `styles.css`) **reemplazando** el bloque `:root` y `body` oscuros. Quitar `color-scheme: dark`.
- Crear `src/ui/components/ui/` con `Button`, `Field`, `Chip`, `Banner`, `Modal` (`02-components.md`). Reemplazar los botones y modales sueltos de a uno en las fases siguientes.
- Copiar los SVG a `src/ui/assets/icons/` (+ `ui/`, `glyph/`, `players/`) y crear `Icon` (`04-icons.md`).

**Aceptación:** el juego carga con fondo crema y tipografías nuevas; ningún texto por debajo de 12px; no hay errores en consola.

## Fase 2 · Íconos y textos con emoji

- `labels.ts`: `resourceIcons`, `habitatIcons`, `nestIcons` pasan a nombres de ícono; `describePower` devuelve marcadores `{seed}` etc.; crear `RichText`.
- Reemplazar todos los emoji de `04-icons.md` (tabla "Textos con emoji sueltos").
- Quitar `lucide-react` si ya no se usa.

**Aceptación:** `grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" src/ui` no devuelve emoji en la interfaz (salvo lo marcado como pendiente en `04-icons.md`); los tests de `describePower` actualizados.

## Fase 3 · Cartas

- Reescribir `BirdCard.tsx` con los 4 modos (`03-cards.md`), `HabitatScene.tsx` y las bandas de poder por timing.
- Reemplazar el uso de tarjetas viejas en mano, tablero, mercado y modales por el modo que corresponda.
- Probar con: un ave de 1, 2 y 3 hábitats; con y sin imagen; con 0, 1 y 2 poderes; nombre largo ("Martín Pescador Norteamericano"); coste vacío ("Gratis"); coste con alternativas ("Insecto / Pez").

**Aceptación:** comparar `Cartas.png` y `Galeria.png` contra capturas propias a 1440px; la carta seleccionada muestra el anillo mostaza y la levantada sube 12px.

## Fase 4 · Textos en voseo

- Aplicar `06-copy.md` completo (tabla + plurales) y actualizar tests y e2e en el **mismo commit**.

**Aceptación:** `npm test` y `npm run e2e` en verde; `grep -rniE "\b(haz|puedes|tienes|necesitas|escribe|introduce|selecciona|elige|conservas|descartas|solapas|cambias)\b" src/ui` sin resultados en textos de interfaz (los comentarios de código no cuentan).

## Fase 5 · Pantallas, por prioridad

1. **Bienvenida y configuración** (`HomePage.tsx`) — primera impresión; incluye partida guardada, botones de modo, nombre obligatorio.
2. **Mano inicial** y **elección de bonificación**.
3. **Pantalla de juego**: barra superior, lateral, filas de hábitat, mano y botón "Jugar esta ave" (escritorio y móvil). Resolver con el equipo las decisiones de `05-screens.md` §1 (cubos, vista de rival, bonificación, menú).
4. **Paneles**: comedero, objetivos, mercado.
5. **Modales de acción**: jugar ave, poner huevos, poderes.
6. **Fin de partida**.

**Aceptación por pantalla:** captura a 1440×(alto del PNG) y a 390 comparada contra el PNG de `reference/`; sin scroll horizontal a 390px; foco visible en todo control; navegación completa con teclado.

## Fase 6 · Estados, conexión, registro y avisos ([NUEVO])

- Estados vacíos y de error (`05-screens.md` §7), empezando por los que ya tienen lógica (comedero deshabilitado, mano vacía, barra de conexión).
- Avisos de guardado bloqueado (requiere detectar el fallo en `savedGame.ts`).
- Registro con íconos por tipo (solo presentación); luego registro completo con filtros y rondas (requiere guardar el historial completo y su ronda: cambio de datos, hablarlo antes).
- Toasts (`02-components.md`), disparados desde los mismos eventos que hoy alimentan el registro.
- Desempate en fin de partida (usa `decidedByFood` del motor).

**Aceptación:** cada estado se puede provocar en una partida real o en un test de componente; los mensajes de error son `role="alert"`; los avisos no roban el foco.

## Fase 7 · Verificación final

- Recorrer todas las pantallas de `reference/` contra la app.
- Correr `npm run typecheck`, `npm run lint`, `npm test`, `npm run e2e`.
- Revisar contraste y foco (lista abajo) y probar en un teléfono real o emulado a 390×844.

## Fase 8 · Turno del rival y animaciones ([NUEVO])

Se hizo después de la fase 7, por etapas y en este orden (cada una dejó el juego jugable con `typecheck`, `lint`, `test` y, desde la 4, `e2e` en verde). Detalle en `02-components.md` y `05-screens.md` §9.

1. **El rival juega paso a paso.** `stepBot` (motor, `turns.ts`) hace una sola jugada de la IA; `applyMove` y `runBots` no cambian. `useBotTurns` la espera ("está jugando"), la aplica y la deja a la vista antes de la siguiente. Todo se deriva del estado, así que reanudar una partida guardada a mitad del turno del rival funciona. Indicador de turno: chip, fila del marcador y banner con puntos animados.
2. **Panel de acción del rival.** `describeStep` cuenta la jugada y los poderes que disparó; `RivalActionPanel` la muestra. Los toasts del rival y el "Es tu turno" posterior desaparecen.
3. **Animaciones de la mesa.** `diffBoard` + `useBoardChangeTracker` marcan lo que cambió y `motion.css` lo anima (ave, huevos, cartas, dados, reserva, cubo, chip); el marcador cuenta (`CountUp`). Corrección hecha en esta etapa: el banner de turno pasó a estar **siempre** presente para que la mesa no salte al devolverte el turno.
4. **Velocidad y online.** Selector Normal / Rápida / Sin pausas (`gameSpeed.ts`, `pacing.ts`) y anuncio de las jugadas del oponente online (`remoteAnnouncement.ts`, `useRemoteAction.ts`), sin cambiar el protocolo. El e2e elige dados con `button.die-token`.

**Aceptación:**
- Con el rival de la IA: se ve que "está jugando" antes de que juegue, el panel cuenta su jugada el tiempo suficiente para leerla, y al volver tu turno **la mesa no se mueve** (probar midiendo la posición del comedero).
- Nada se anima al cambiar de pestaña, reanudar o empezar una partida.
- Con `prefers-reduced-motion: reduce`: sin animaciones, sin dado fantasma, marcador que salta; el panel y los puntos siguen informando.
- Online: el que mira ve la jugada del oponente en el panel; las cartas del mazo solo se cuentan.
- Las tres velocidades y su elección se recuerdan al recargar.

## Checklist de aceptación transversal

**Visual**
- [ ] Ningún color fuera de `tokens.css`; ningún `border` distinto de 2px carbón (salvo separadores punteados y trazos de íconos).
- [ ] Sombras solo planas (`0 Npx 0`); sin `blur`, excepto `drop-shadow(0 Npx 0 …)` del ave.
- [ ] Títulos y cifras grandes en DM Serif Display; todo lo demás en Work Sans.
- [ ] Cada poder muestra etiqueta de texto además del color.
- [ ] Sin emoji en la interfaz.

**Accesibilidad**
- [ ] Texto ≥ 12px; objetivos táctiles ≥ 44×44px (chips-filtro, botones de +/−, cerrar).
- [ ] Contraste según la tabla de `01-tokens.md`; no usar tomate `#D8472B` para texto.
- [ ] Todo control es un elemento nativo (`button`, `input`, `label`, `select`, `table`).
- [ ] Botón de solo ícono con `aria-label`; el ícono decorativo con `aria-hidden`.
- [ ] Control deshabilitado con motivo visible en texto.
- [ ] Modales: `role="dialog"`, `aria-modal`, `aria-labelledby`, foco atrapado, Esc (salvo obligatorios), foco de vuelta al disparador.
- [ ] Registro `role="log"` con `aria-live="polite"`; avisos `role="status"`, errores `role="alert"`.
- [ ] Nada depende solo del color (estados "Se conserva/Se descarta", jugador en turno, ganador, conexión).
- [ ] `prefers-reduced-motion` respetado (spinner estático, sin animación de entrada, sin animaciones de la mesa, puntos "está jugando" quietos, marcador sin conteo).
- [ ] La región del panel del rival es `role="status"`, siempre montada, y no roba el foco; los puntos animados y el conteo son decorativos (`aria-hidden`) y el texto dice lo mismo.
- [ ] El banner de turno tiene el mismo alto en ambos turnos (la mesa no salta).
- [ ] Todo el flujo principal se completa solo con teclado.

**Texto**
- [ ] Voseo en toda la interfaz (`06-copy.md`); plurales correctos; sin "(s)".

**Técnico**
- [ ] `typecheck`, `lint`, `test` y `e2e` en verde.
- [ ] Sin scroll horizontal a 390px de ancho.
- [ ] Las imágenes de aves cargan con `alt` y `object-fit: contain`; el ave sin imagen muestra la silueta.
- [ ] Fuentes con `display=swap`; sin CLS notable al cargar.
