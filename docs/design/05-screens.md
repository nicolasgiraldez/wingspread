# 05 · Pantallas

Cada sección indica el tablero de referencia (PNG en `reference/`), el componente del repo, el layout y **qué cambia respecto de hoy**. Marcas: **[EXISTE]** ya está y solo cambia el aspecto o los textos, **[DIFIERE]** existe pero el diseño lo organiza distinto, **[NUEVO]** el diseño lo propone y no existe hoy.

Anchos diseñados: escritorio 1440px y móvil 390px. **Los breakpoints no están diseñados**; propuesta: móvil hasta 640px, escritorio desde 1024px, y entre ambos usar el layout móvil ampliado (una columna centrada de máx. 640px).

---

## 1. Pantalla de juego — `Main.png` (1440×1160) y `Movil.png` (390×844)

Componente: `App.tsx` (layout general), `PlayerBoard.tsx`, sección "Tu mano".

### Escritorio

- **Barra superior** (carbón, 68px): logo + "Wingspread" (DM Serif 34px, crema) a la izquierda; al centro "Ronda 2 de 4" con **4 píldoras** de progreso (llenas mostaza las rondas jugadas/en curso, vacías con borde); a la derecha chip mostaza "Tu turno" (en el turno del rival, chip **menta** "Turno de {nombre}" con puntos animados; ver §9) y botón de menú (44×44, borde crema) que abre el menú de la partida, con el selector de velocidad. **[DIFIERE]** hoy no hay barra superior; la ronda está en el panel lateral y el turno en "Turno Actual".
- **Barra lateral izquierda** (280px, fondo crema-2, borde derecho 2px): tres bloques.
  1. **Marcador**: una fila por jugador con su símbolo (círculo / triángulo / cuadrado), nombre y puntaje en DM Serif; el jugador **en turno** va con fondo mostaza y, si es el rival, con la marca "Turno •••" y una leve "respiración" (§9). Los puntajes **cuentan** hacia el valor nuevo. **[DIFIERE]** reemplaza "Puntuación en Vivo".
  2. **Tu reserva**: 6 fichas de 2 columnas (semilla, fruta, insecto, pez, roedor, huevo) con ícono + cantidad en DM Serif. **[DIFIERE]** hoy es "Recursos de X".
  3. **Carta seleccionada** (panel petróleo abajo): nombre, "Se juega en el Río", costes en una fichita crema, texto del poder ("Entre turnos. …") y botón primario **"Jugar esta ave"**. **[NUEVO]** como panel; hoy el botón "Jugar esta ave" vive dentro de cada carta de la mano.
- **Área de juego** (fondo crema): tres **filas de hábitat**, una por hábitat (Bosque, Pradera, Río). Cada fila es un contenedor crema-2 de radio 20 con: a la izquierda un **panel de hábitat** de 240px de ancho (fondo del color del hábitat, ficha con el ícono, chip "3 de 5 aves", nombre en DM Serif 30px y la acción del hábitat: "Obtené alimento del comedero" / "Poné huevos en tus nidos" / "Robá nuevas cartas de ave"), y a la derecha **5 casillas** de carta modo `board` (132×200). Las casillas vacías son rectángulos con borde punteado y un "+" (ver estados en §7).
- **Tu mano · 4 cartas**: fila de cartas modo `hand` (192×290) debajo del tablero. La carta seleccionada va **levantada** (ver `03-cards.md` §Estados). Si la carta no se puede jugar, el botón "Jugar esta ave" del panel queda deshabilitado con el motivo en texto (ej. "Sin alimento suficiente"). **[Propuesta: el tablero solo muestra el caso habilitado]**

### Móvil

- Barra superior (carbón, 60px): logo + nombre, chip "Ronda 2/4".
- **Marcador** en una sola fila de píldoras (símbolo + nombre + puntaje); la del jugador en turno, mostaza.
- **Pestañas de hábitat** (Bosque / Pradera / Río), 3 botones de 44px+; solo se ve **un hábitat a la vez**. La activa lleva el color del hábitat.
- **Grilla de 3 columnas** con cartas `board`; la última celda es una tarjeta del color del hábitat con "3 de 5 aves" y la acción ("Obtené alimento del comedero").
- **Reserva** en una franja horizontal con los 6 recursos.
- **Tu mano**: carrusel horizontal de cartas `hand`; la seleccionada, levantada.
- **Botón "Jugar esta ave"** fijo abajo, ancho completo, 56px.

### Diferencias importantes con la app actual (decisiones a tomar al implementar)

El diseño de pantalla de juego **no muestra** varias cosas que el juego tiene hoy. No las borres: dejalas funcionando y estilizalas con los tokens; abajo, qué propongo para cada una.

| Elemento actual (`App.tsx`) | En el diseño | Qué hacer |
|---|---|---|
| **Cubos de acción** ("Turno Actual" con 8 cubos, `.cubes-indicator`) | No aparece | Mantener como fila de 8 círculos de 20px con borde carbón (llenos = usados) debajo del Marcador. **[Propuesta sin tablero]** |
| **"VER VISTA DE:"** (pestañas para ver el tablero de un rival) | No aparece | Hacer que las filas del Marcador sean `<button aria-pressed>` que cambian la vista; mostrar el aviso "Viendo aves y recursos jugados por tu oponente" como banner info. **[Propuesta sin tablero]** |
| **"Recursos de X"** al mirar a otro jugador | Solo "Tu reserva" | Reusar el bloque de reserva con el título "Reserva de X". **[Propuesta]** |
| **Cartas de bonificación** (panel lateral) | Solo el estado vacío ("Sin cartas de bonificación", ver §7) y el modal de elección (§6) | Bloque "Bonificación" bajo la reserva, con el estado "N carta(s) secreta(s)" para el rival. **[Propuesta]** |
| **"(1er jugador)"** marca | No aparece | Añadir texto "1.º" junto al nombre en el Marcador. **[Propuesta]** |
| **Registro de acciones** (últimas 6) | Ver §8 | Va en un panel del lateral o en una hoja; ver §8. |
| **Botón "Nueva Partida / Inicio"** | Hay botón de menú, sin contenido diseñado | El menú (hamburguesa) abre un popover con el **selector de velocidad** (Normal / Rápida / Sin pausas) y, debajo, "Volver al inicio" / "Nueva partida" como botones secundarios. Ver `reference/MenuVelocidad.png`. **[Propuesta sin tablero]** |
| **Ícono de bot** en el turno de la IA | Hay ícono `bot` en Bienvenida | Usarlo junto al nombre del rival IA en el Marcador. **[Propuesta]** |
| **Composición completa**: comedero, objetivos de ronda y mercado **junto** al tablero | `Main` no los dibuja; `Paneles` los diseña para "la columna central de 1112 px" | Apilarlos en la columna central en el orden actual: barra de conexión → **banner de turno** (siempre presente, mismo alto; ver `02-components.md`) → objetivos → comedero → mercado → tablero → mano. **[Propuesta sin tablero]** |

---

## 2. Comedero, objetivos y mercado — `Paneles.png` (1240×2140), `PanelesMovil.png` (390×1150)

Componentes: `BirdFeeder.tsx`, `RoundGoalsMat.tsx`, `BirdMarket.tsx`. Ancho de la columna central: 1112px.

**Comedero de Aves** [EXISTE] — encabezado "Comedero de Aves" + "(5 dados disponibles)"; línea de ayuda ("Hacé clic en un dado para obtener ese alimento y activar tu bosque."; en móvil "Tocá un dado…"); fila de dados 76×84 con ícono de 40px y etiqueta (Semilla, Fruta, Pez, Insecto). El dado **comodín** (insecto/semilla) muestra ambos íconos y un botón "Elegir"; al tomarlo abre el panel "Cara comodín — ¿Qué alimento elegís?" con dos opciones (Insecto / Semilla) y "Cancelar". Variantes diseñadas: dados mezclados, todos iguales (aparece botón **"Relanzar"**), y elección de comodín.

**Objetivos de ronda** [EXISTE] — 4 columnas "Ronda 1…4" con estado "Cerrada" / "En curso", título del objetivo, descripción, y una fila por jugador con su marcador (en rondas cerradas "+4 p", en curso el conteo actual). La ronda en curso se distingue de las cerradas y las futuras (ver PNG); el estado va siempre en texto.

**Mercado de Aves** [EXISTE] — "Mercado de Aves (96 cartas en el mazo)", ficha "96 cartas" y botón "Robar Carta Oculta del Mazo", más las 3 cartas visibles, cada una con su botón **"Robar esta ave"** (tamaño de carta según el PNG).

Textos con voseo: ver `06-copy.md`. Ayuda del comedero: usar "Tocá" en pantallas táctiles y "Hacé clic" en escritorio (el diseño distingue ambos).

---

## 3. Bienvenida y configuración — `Bienvenida.png`, `BienvenidaMovil.png`, `Configuracion.png`

Componente: `HomePage.tsx` (y `ConnectingScreen.tsx`).

**Bienvenida (escritorio 1440×900)** [DIFIERE]: pantalla partida en dos.
- Izquierda (crema, 640px de ancho): logo + "Wingspread" (DM Serif 64/72px), subtítulo "Juego de construcción de motor ecológico inspirado en Wingspan"; si hay partida guardada, tarjeta **"Partida en curso"** ("Modo solitario · Ronda 2 · guardada hace 12 min") con botón primario **Continuar** y botón de solo ícono de borrar (44×44, `aria-label="Borrar la partida guardada"`); campo **"¿Cómo te llamás?"** (placeholder "Escribí tu nombre..."); dos **botones de modo** grandes (188px de alto): **Modo Solitario** (petróleo, ícono `bot`) y **Multijugador Online** (mostaza, ícono `globe`).
- Derecha (petróleo, ilustración): escena de bosque con sol grande y tres cartas reales abiertas en abanico, ligeramente rotadas, sobre una colina mostaza y franja de suelo petróleo-d. Es decorativa (`aria-hidden`); en móvil se elimina.
- Sin nombre no se puede empezar: los botones de modo se deshabilitan con el texto "Ingresá tu nombre para comenzar" (móvil) — ver §7.
- **Móvil**: una columna, sin ilustración, botones de modo apilados.

**Configuración** [DIFIERE] (`Configuracion.png`, 1520×880), tres paneles crema de radio 20 con sombra `0 6px 0`:
- **Modo solitario**: botón "Volver" (secundario 44px), título, subtítulo "Jugá contra un rival controlado por la IA", campo "Tu nombre", selector de **dificultad** como 3 botones de opción (Fácil (Pichón) / Normal (Águila) / Difícil (Halcón)) y botón primario "Comenzar Partida Solitaria".
- **Multijugador online**: "Volver", título, subtítulo, campo "Tu nombre"; sección **Crear nueva sala** (campo "Nombre de tu oponente (opcional)" y botón "Crear Sala y Compartir Enlace"); separador "O unirse a sala existente"; campo "Código de sala" con placeholder "ej. halcon-428 (o pegá el enlace de invitación)" y botón "Unirse"; con código válido aparece la línea "Te vas a unir a la sala: halcon-428".
- **Conexión a sala** (`ConnectingScreen`): panel "Uniéndote a la sala" con "Sala halcon-428 · Jugando como Nico" y spinner + "Conectando con la sala..." + "Volver al inicio"; variante de fallo en §7.

---

## 4. Mano inicial — `ManoInicial.png` (1440×1260), `ManoInicialMovil.png` (390×1450)

Componentes: `StartingHandModal.tsx` y `ChooseBonusCardModal.tsx`. **Modal obligatorio** (no se cierra con Esc).

Título "Nico, prepará tu mano inicial" + subtítulo "Te tocaron 5 aves y 5 fichas de alimento. Quedate con las aves que quieras, pero por cada una descartá 1 ficha de alimento." En tres pasos:
Panel centrado (≈1116px de ancho, mismo carcasa que los modales, sin botón de cerrar) con el logo arriba. Pasos:
1. **Aves que conservás (3 de 5)** — 5 cartas `full` seleccionables. Las **conservadas** llevan anillo mostaza y debajo "✓ Se conserva" (texto petróleo + ícono `check`); las **descartadas** se ven atenuadas (desaturadas, poco contraste) con "Se descarta" debajo en texto normal. Nunca solo color: siempre el texto.
2. **Alimento que descartás (3 de 3)** — fichas de alimento (ícono + nombre + estado). Las que se **conservan**: fondo blanco, borde carbón, "Se conserva". Las que se **descartan**: fondo de error `#F6D5CC`, borde tomate profundo y "Se descarta" en tomate profundo.
3. **Carta de bonificación que conservás** — dos tarjetas (cabecera mostaza con ícono `star` y "BONIFICACIÓN", nombre en DM Serif, descripción y botón **"Elegir esta"**). La elegida lleva anillo mostaza y su botón pasa a petróleo lleno con `check` y el texto **"Elegida"**.

Botón primario "Confirmar mano inicial", deshabilitado con motivo mientras falten descartes o elección (ej. "Elegí 2 fichas de alimento más para descartar.", ver `06-copy.md`).

Móvil (`ManoInicialMovil.png`): misma secuencia en una columna; las cartas se apilan en filas de 2 y el botón "Confirmar mano inicial" va al final.

---

## 5. Fin de partida — `FinPartida.png`, `FinPartidaMovil.png`

Componente: `GameOverModal.tsx` [DIFIERE].

Tarjeta centrada sobre fondo carbón: medallón mostaza-claro con ícono `trophy`, título **"¡Victoria de Nico!"** (DM Serif 44px), subtítulo "Fin de la Ronda 4. Desglose final de puntuaciones ecológicas.", **tabla** con encabezado carbón (columna del ganador con fondo mostaza y su símbolo de jugador), seis filas con ícono (Puntos de Aves `bird`, Huevos (1 pt c/u) `egg`, Alimentos Almacenados `seed`, Cartas Solapadas `stack`, Objetivos de Ronda `target`, Cartas de Bonificación / Dificultad `star`), fila de **Puntuación total** (petróleo, cifras DM Serif con "pts") y botón **"Jugar Otra Partida"** (`refresh`).

**Móvil**: la misma tabla de 4 columnas sin scroll (las etiquetas de categoría se parten en 2–3 líneas, ícono de 20px a la izquierda) y botón a ancho completo.

**Variante de desempate [NUEVO en la UI; el motor ya lo resuelve, ver `decidedByFood` en `engine.ts`]**: cuando hay empate a puntos, aparece un aviso de advertencia sobre la tabla: "Empate a puntos: gana quien tiene más alimento sin usar (Nico: 3 · Santi: 1)." y el título sigue siendo "¡Victoria de Nico!". Con empate total, mostrar "¡Empate!" (sin tablero diseñado).

Accesibilidad: `<table>` real con `<th scope>`; el ganador se indica también con texto ("¡Victoria de Nico!"), no solo con el color de columna.

---

## 6. Modales de acción — `Modal*.png`

Todos usan la carcasa de `02-components.md` §Modales.

**Jugar ave** (`ModalJugarAve*.png`, `PlayBirdModal.tsx`) [DIFIERE]: título "Jugar Ave: Vireo de Bell", carta modo `full` a la izquierda del formulario y 4 pasos:
1. **Seleccioná el Hábitat** — botones píldora con ícono (Bosque / Pradera; solo los hábitats válidos del ave); nota "Se colocará en la Columna 3 de Pradera (Coste: 1 huevo)".
2. **Pago de Alimentos** — estado "Pago válido"; instrucción "Hacé clic en tus recursos para seleccionarlos. Podés usar 2 recursos cualesquiera por cada 1 requerido."; contadores por recurso ("Semilla: 0/3", "Fruta: 0/1"…).
3. **Coste en Huevos (1)** — "Se descontará 1 huevo de tu tablero." (o error "Necesitás al menos N huevo(s)…", ver `06-copy.md`).
4. **Poderes al jugar (opcionales)** — lista con casillas ("Todos los poderes son opcionales: destildá los que no quieras activar.").
Pie: "Cancelar" y "Confirmar y Jugar Ave".

**Poner huevos** (`ModalPonerHuevos*.png`, `LayEggsModal.tsx`): cupo "Huevos disponibles en este turno: 1 por asignar", opción "Opcional (+1 extra): Descartar 1 alimento" con fichas de alimento seleccionables; **lista de aves** con hábitat/columna, tipo de nido, "1 / 2 · 1 espacio libre", botones de −/+ de 44×44 (`aria-label="Quitar 1 huevo asignado"` / `"Poner 1 huevo en esta ave"`) y el contador; poderes opcionales (con selectores como "¿En qué ave ponés el/los huevo(s)?"); pie "Cancelar" / "Confirmar y poner 2 huevos". Dos **estados vacíos** con su propio modal: "No tenés aves jugadas en tu tablero para poner huevos." ("Primero tenés que jugar aves en cualquiera de tus hábitats.") y "Todas tus aves ya alcanzaron su capacidad máxima de huevos."

**Poderes de hábitat** (`ModalPoderes*.png`, `HabitatPowersModal.tsx` + `PowerChecklist.tsx`): "Confirmar: Obtener comida" / "Confirmar: Robar cartas" (según el hábitat), subtítulo "Tenés aves con poderes opcionales en el bosque. Elegí cuáles activar antes de confirmar.", lista "Poderes que se activarían" con casilla por poder y, cuando corresponde, un `<select>` con su etiqueta ("¿Qué carta de tu mano solapás? (opcional)", "¿A qué hábitat la movés?", "¿Qué carta preferís descartar? (opcional; si no elegís, se descarta la recién robada)"), pie "Cancelar" / "Confirmar".

**Bonificación y esperas** (`ModalBonificacion*.png`, `ChooseBonusCardModal.tsx` + textos de espera de `App.tsx`): "Nico, elegí tu carta de bonificación" con "Se revelaron 2 cartas. Quedate con 1; el resto vuelve al descarte." y dos tarjetas con "Elegir esta". Pantallas de **espera** (modal con ícono `hourglass`, sin cierre): "Preparación lista — Esperando a que el resto de los jugadores termine la suya para empezar la Ronda 1..." y "Conteo final en pausa — Esperando a que Santi elija su carta de bonificación...". Y, en partida online, el **banner de turno** del oponente: "Turno de Santi · Esperando su jugada" (info, con ícono `hourglass`; ver §9).

---

## 7. Estados vacíos y de error — `EstadosTablero*.png`, `EstadosConexion*.png`

Todo lo de esta sección es **[NUEVO]** salvo donde se aclare; el juego hoy solo muestra unos pocos de estos mensajes.

### Tablero (`EstadosTablero.png` 1440×1940 / `EstadosTableroMovil.png`)

- **Comedero vacío** — "El comedero está vacío. Relanzá los dados para volver a llenarlo." + botón "Relanzar" (única acción habilitada).
- **Comedero en turno ajeno** — encabezado con chip "Turno de Santi", dados deshabilitados (opacidad .55) y el texto "Todavía no es tu turno. Los dados se activan cuando te toque jugar." [EXISTE la lógica `disabled={!isControlsActive}`, **[NUEVO]** el mensaje].
- **Mercado con mazo agotado** — "El mazo se agotó. Se barajó la pila de descarte para formar un nuevo mazo." con ficha "Mazo vacío · 0 cartas · se baraja el descarte"; el hueco sin carta muestra "Sin carta — No quedan aves para reponer este lugar" (botón deshabilitado).
- **Encabezado de hábitat**: con espacio (botón "Poner 2 huevos" habilitado); sin espacio para huevos (botón deshabilitado + texto "Tus aves no tienen espacio libre para huevos."); **hábitat lleno** ("5 de 5 aves · lleno"); **hábitat vacío** ("0 de 5 aves") con la primera casilla destacada y el texto "Jugá tu primera ave acá".
- **Mano vacía** — "Tu mano está vacía. Robá cartas del mercado o del mazo para jugar más aves." (esto **[EXISTE]** en `App.tsx:932`) + botón "Ir al mercado" [NUEVO]. **Sin bonificación** — "Sin cartas de bonificación".

### Conexión y errores (`EstadosConexion.png` 1520×1815 / móvil)

- **Barra de conexión** (una fila por estado; siempre color + ícono + texto): "¡Conectado con el oponente!" (chip "Conectado en vivo"), "Sala creada. Esperando a que el invitado se conecte..." / "El invitado se desconectó. Esperando a que vuelva..." (chip "Esperando oponente..."), "Reconectando con el servidor de señalización..." (chip "Conectando..."), "Error en el canal de datos: se perdió la conexión." (chip "Desconectado" + botón "Reconectar"). Todas con "Sala online: halcon-428 · Rol: Nico (Host)" y botón "Copiar enlace de sala" (excepto conectando). [EXISTE `ConnectionStatusBar.tsx`, estados de `peerManager.ts`].
- **Avisos en la partida** (banners): "Sin conexión con el anfitrión: tu jugada no se envió. Reintentá cuando vuelva." + "Reintentar"; "El invitado se desconectó. Esperando a que vuelva... La partida queda en pausa y se guarda."; "Reconectando con el servidor de señalización... No cierres esta pestaña."; "¡Conectado con el oponente! La partida sigue desde donde estaba."; **"Partida guardada · almacenamiento bloqueado"** — "No se pudo guardar la partida en este navegador. El almacenamiento está lleno o bloqueado (modo privado). Podés seguir jugando, pero no vas a poder reanudarla si cerrás la pestaña." [NUEVO: hoy no se avisa].
- **Crear sala / unirse / nombre**: error de campo ("Ya existe una sala con ese código. Probá con otro."), fallo de conexión ("No se pudo conectar a la sala halcon-428: la sala no responde." + "Verificá que el código de sala sea correcto y que la persona anfitriona siga con la sala abierta en su navegador." + "Volver al inicio" / "Reintentar"), nombre faltante ("Escribí tu nombre para poder jugar." con botones de modo deshabilitados), y **copiar enlace**: "Copiado / ¡Enlace copiado!" y el caso sin permiso ("No se pudo copiar el enlace. Copialo a mano:" + campo de solo lectura con el enlace).

---

## 8. Registro de partida y avisos — `RegistroAvisos.png` (1440×2465), `RegistroAvisosMovil.png` (390×1305)

**Registro lateral** [DIFIERE]: tarjeta "Registro de acciones" (crema-2, radio 14, padding 16, 280px) con **las últimas 6 entradas** (igual que hoy, `slice(-6)`), pero cada entrada lleva una **ficha de ícono** (32×32) por tipo: jugador (su símbolo), `bird` (poder), `target` (caza exitosa), `close` (caza fallida), `egg` (huevos), logo (sistema); el nombre del jugador en negrita y los nombres de aves en negrita **sin corchetes** (el texto de origen usa `[Ave]` como marcador). Separadores punteados entre entradas. Un botón "Ver registro completo" (secundario 48px) abre el registro completo. `<ul role="log" aria-live="polite">`: anuncia las jugadas nuevas.

**Registro completo** [NUEVO]: panel "Registro de la partida" (modal en escritorio, hoja inferior en móvil) con botón cerrar, **filtros** como chips de 44px ("Todo · 41", "Poderes · 12", "Sistema · 6") con `aria-pressed`, y las entradas **agrupadas por ronda** (separador "Ronda 3 · en curso", "Ronda 2"…). Requiere que el estado guarde más de 6 entradas y su ronda; si hoy solo se guarda lo mostrado, es un cambio de datos (marcar como [NUEVO], fuera de la primera fase). Incluye estado vacío: "Todavía no hay acciones. Cuando empiece la partida vas a ver acá lo que pasa en cada turno."

**Tipos de entrada**: jugada común ("Jugó un ave."), poder ("Poder de Vireo de Bell: reveló 2 cartas de bonificación y conservó Oólogo."), caza exitosa, caza fallida, huevos, y mensajes del sistema ("¡Todos terminaron la preparación! Comienza la Ronda 1.", "El mazo se agotó. Se barajó la pila de descarte para formar un nuevo mazo.").

**Móvil**: el registro va como **fila cerrada** siempre visible sobre la mano (una línea con la última jugada y "Registro ›", 60px de alto) que abre una **hoja inferior** con asa, cerrar (44×44), filtros y lista.

**Avisos (toasts)** [NUEVO]: ver `02-components.md` §Toasts (tipos, tiempos, pila).

---

## 9. Turno del rival y animaciones — [NUEVO]

Tableros de referencia (capturas de la app implementada, no del lienzo): `TurnoRival.png`, `AccionRival.png`, `AccionRivalMovil.png`, `MenuVelocidad.png`, `AnimacionAve.png`. Componentes: `GameTopBar.tsx`, `GameSidebar.tsx`, `RivalActionPanel.tsx`, `useBotTurns.ts`, `useRemoteAction.ts`, `motion.css`, `rival.css`. Detalle de cada pieza en `02-components.md`.

**Problema que resuelve:** en solitario la IA jugaba todos sus turnos al instante y el turno volvía ya con el estado cambiado, sin que se entendiera qué había pasado. Ahora el turno del rival tiene tres momentos:

1. **Está jugando** (0,8 s a velocidad normal) — `reference/TurnoRival.png`. Tres indicadores a la vez, para que se vea aunque mires otra parte de la pantalla: el **chip** de la barra superior en menta ("Turno de Rival (IA) •••"), la **fila del marcador** ("Turno •••", con leve respiración) y el **banner de turno** sobre la mesa. Los dados están deshabilitados con el texto "Todavía no es tu turno…".
2. **Jugó** — `reference/AccionRival.png` (escritorio) y `AccionRivalMovil.png`. Aparece el **panel de acción del rival** con la frase ("Jugó Achichilique de Clark en el Río.") y sus poderes; el estado ya cambió (tablero, reserva, marcador contando, dado que se despide). Si además mirás el tablero del rival, el ave nueva cae con su aro mostaza (`AnimacionAve.png`). Ver `02-components.md` §Movimiento.
3. **Tu turno** — el chip pasa a mostaza y "salta", el banner pasa a "Tu turno · Elegí una acción" **sin cambiar de alto** (la mesa no se mueve). No sale un toast "Es tu turno": lo cubren el chip, el banner y el panel.

Decisiones:
- **No se cambia solo de tablero:** mientras el rival juega seguís viendo el tablero que tenías. Para ver dónde puso el ave, tocá su fila del marcador (el panel y el aro mostaza te avisan de que pasó algo).
- **Online:** el oponente humano no se frena (su jugada ya está hecha), pero su jugada se **anuncia en el mismo panel**. Como al que mira solo le llega el estado, la frase se reconstruye a partir de la última línea del registro y de lo que cambió en la mesa; las cartas robadas del **mazo solo se cuentan**, no se nombran.
- **Velocidad:** Normal / Rápida / Sin pausas, en el menú de la partida (`reference/MenuVelocidad.png`). Ver `02-components.md` §Ritmo y §Selector de velocidad.
- **Móvil:** el panel se ubica bajo la barra superior (de dos filas) y cubre unos segundos lo que hay debajo; se cierra con el botón o solo.
