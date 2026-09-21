# 06 · Textos: voseo y tabla de cambios

Todo el texto de la interfaz va en **voseo rioplatense**. Este documento trae las reglas, la tabla exacta de textos del repo actual → versión nueva (con archivo y línea al momento de escribirlo; las líneas pueden moverse un poco), los textos **nuevos** que propone el diseño y los tests que hay que actualizar.

## Reglas

| Tuteo (hoy) | Voseo (nuevo) | Ejemplos |
|---|---|---|
| Imperativo en -ar: `-a` | `-á` | Solapa → **Solapá**, Roba → **Robá**, Almacena → **Almacená**, Cambia → **Cambiá**, Revela → **Revelá**, Descarta → **Descartá**, Escribe → **Escribí** (-ir: `-í`) |
| Imperativo en -er/-ir irregulares | vos + acento final | Pon → **Poné**, Obtén → **Obtené**, Mueve → **Mové**, Elige → **Elegí**, Haz → **Hacé** |
| Presente indicativo 2.ª persona | terminación aguda | tienes → **tenés**, puedes → **podés**, necesitas → **necesitás**, conservas → **conservás**, descartas → **descartás**, cambias → **cambiás**, solapas → **solapás** |
| Pronombre | vos | (Tú) → **(Vos)**, "si eras tú" → "si eras **vos**" |
| Imperativo + pronombre | sin cambio de posición | ciérrala → **cerrala**, inténtalo → **intentá**, déjalo → **dejalo** |
| "tu / tus / te" | igual | tu nombre, tus nidos, ¿Cómo te llamás? |

Además: **plurales correctos** en lugar de "carta(s)" / "huevo(s)": "1 carta" / "2 cartas", "1 huevo" / "2 huevos" (el diseño ya lo hace; implementarlo con una función `plural(n, singular, plural)`). Y **sin emoji** dentro de los textos (ver `04-icons.md`).

No se convierte lo que ya está en tercera persona describiendo un efecto: "Caza: si envergadura del mazo ≤ 75cm, **solapa** como presa" queda así (lo hace el ave, no el jugador). "Cada jugador toma 1 dado del comedero, empezando por vos" ya está bien.

## Tabla de cambios en el repo

### `src/ui/labels.ts` — `describePower()` (textos de poderes)

| Actual | Nuevo |
|---|---|
| `Obtén TODOS los {ícono} que haya en el comedero` | `Obtené TODOS los {ícono} que haya en el comedero` |
| `Obtén 1 dado cualquiera del comedero` | `Obtené 1 dado cualquiera del comedero` |
| `Obtén {n} {ícono}[ o {ícono}][ del comedero]` | `Obtené {n} {ícono}[ o {ícono}][ del comedero]` |
| `Pon {n} huevo(s) en este nido` | `Poné {n} huevo/huevos en este nido` |
| `Pon {n} huevo(s) en CADA una de tus aves con nido {tipo}` | `Poné {n} huevo/huevos en CADA una de tus aves con nido {tipo}` |
| `Todos ponen 1 huevo en 1 ave con nido {tipo}; vos ponés {n} extra` | igual (ya está en voseo) |
| `Pon {n} huevo(s) en otra ave con nido {tipo}` | `Poné {n} huevo/huevos en otra ave con nido {tipo}` |
| `Pon {n} huevo(s) en cualquier ave` | `Poné {n} huevo/huevos en cualquier ave` |
| `Roba {n} carta(s)[ y descarta 1]` | `Robá {n} carta/cartas[ y descartá 1]` |
| `Descartá {n} {ícono} para solapar …` | igual (ya está en voseo) |
| `Solapa {n} carta(s) de tu mano / del mazo[ y roba 1][ y pon 1 huevo]` | `Solapá {n} carta/cartas de tu mano / del mazo[ y robá 1][ y poné 1 huevo]` |
| `… y ganá 1 {ícono}[ o 1 {ícono}]` | igual |
| `Almacena 1 {ícono} en esta carta` | `Almacená 1 {ícono} en esta carta` |
| `Caza: si envergadura del mazo ≤ {n}cm, solapa como presa` | igual |
| `Caza: relanza los dados fuera del comedero; si alguno muestra {ícono}, gana 1 y lo cachea en esta carta` | igual (tercera persona) |
| `Jugá una segunda ave en {hábitats}, pagando su costo normal` | igual |
| `Todos los jugadores roban 1 carta del mazo` / `Todos obtienen 1 {ícono}` | igual |
| `Cambia 1 {ícono} por {n} {ícono}` | `Cambiá 1 {ícono} por {n} {ícono}` |
| `Revela {n} carta(s) de bonificación y conservá {m}` | `Revelá {n} cartas de bonificación y conservá {m}` |
| `Repetí un poder de caza / marrón de otra ave en este hábitat` | igual |
| `Jugador(es) con menos aves en {hábitat}: roba(n) …` / `gana(n) 1 dado…` | igual |
| `Cada jugador toma 1 dado del comedero, empezando por vos` | igual |
| `moveToHabitat`: hoy `describePower` no tiene caso para este poder y devuelve `""` | `Mové esta ave a otro hábitat` (así aparece en el diseño, `Chivirín de Bewick`) |

Tras la conversión los `{ícono}` van como marcadores de `RichText` (ver `04-icons.md`). En la carta "Sin poder" se muestra "Sin poder".

### `src/ui/App.tsx`

| Línea | Actual | Nuevo |
|---|---|---|
| 512, 555, 585 | `(Tú)` | `(Vos)` |
| 710 | `⏳ Turno de {nombre}... Esperando su jugada` | `Turno de {nombre} · Esperando su jugada` (sin emoji, con ícono `hourglass`; es el **banner de turno**, que ahora también existe en solitario y en tu turno: ver abajo) |
| 899 | `Tu Mano ({nombre}) — {n} carta(s)` | `Tu mano · {n} cartas` (etiqueta de sección, 13px mayúsculas) |
| 904 | `Haz clic en "Jugar esta ave" para colocarla en tu tablero` | `Hacé clic en "Jugar esta ave" para colocarla en tu tablero` (en pantallas táctiles: `Tocá "Jugar esta ave"…`) |
| 932 | `Tu mano está vacía. Roba cartas del mercado o del mazo para jugar más aves.` | `Tu mano está vacía. Robá cartas del mercado o del mazo para jugar más aves.` |
| 343, 966, 978, 1003, 1035 | ya en voseo ("Reintentá", "Tenés…", "Elegí") | sin cambio |

### `src/ui/components/`

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `BirdFeeder.tsx:148` | `Haz clic en un dado para obtener ese alimento y activar tu bosque.` | `Hacé clic en un dado para obtener ese alimento y activar tu bosque.` (móvil: `Tocá un dado…`) |
| `BirdFeeder.tsx:51` | `Este dado muestra insecto 🐛 y semilla 🌾. Elegí uno.` | `Este dado muestra insecto {ícono} y semilla {ícono}. Elegí uno.` con título nuevo `Cara comodín — ¿Qué alimento elegís?` |
| `HabitatPowersModal.tsx:111`, `LayEggsModal.tsx:169` | `¿Qué alimento cambias y por cuál? (opcional)` | `¿Qué alimento cambiás y por cuál? (opcional)` |
| `LayEggsModal.tsx:504` | `No tienes aves jugadas en tu tablero para poner huevos.` | `No tenés aves jugadas en tu tablero para poner huevos.` + línea nueva `Primero tenés que jugar aves en cualquiera de tus hábitats.` |
| `HomePage.tsx:170` | `Escribe tu nombre...` (placeholder) | `Escribí tu nombre...` |
| `HomePage.tsx:213` | `✏️ Introduce tu nombre para comenzar` | `Ingresá tu nombre para comenzar` |
| `HomePage.tsx:240,312` | `Tu nombre` | `Tu nombre` (en Bienvenida el campo pasa a `¿Cómo te llamás?`) |
| `HomePage.tsx:336` | `Nombre de tu amigo... (o déjalo en blanco)` | `Nombre de tu amigo... (o dejalo en blanco)` |
| `HomePage.tsx:143` | `Al continuar se reabre la sala: tu invitado se reconecta solo o con el mismo enlace.` | igual |
| `PlayBirdModal.tsx:360` | `1. Selecciona el Hábitat` | `1. Seleccioná el Hábitat` |
| `PlayBirdModal.tsx:392` | `Haz clic en tus recursos para seleccionarlos. Puedes usar 2 recursos cualesquiera por cada 1 requerido.` | `Hacé clic en tus recursos para seleccionarlos. Podés usar 2 recursos cualesquiera por cada 1 requerido.` |
| `PlayBirdModal.tsx:432` | `✓ Se descontarán {n} huevo(s) de tu tablero.` | `Se descontará 1 huevo de tu tablero.` / `Se descontarán {n} huevos de tu tablero.` (con ícono `check`) |
| `PlayBirdModal.tsx:433` | `✗ Necesitas al menos {n} huevo(s) en tu tablero para jugar en esta columna.` | `Necesitás al menos {n} huevo/huevos en tu tablero para jugar en esta columna.` (con ícono `close`) |
| `StartingHandModal.tsx:48` | `Elige {n} ficha(s) de alimento más para descartar.` | `Elegí {n} ficha/fichas de alimento más para descartar.` |
| `StartingHandModal.tsx:50` | `Elige una carta de bonificación.` | `Elegí una carta de bonificación.` |
| `StartingHandModal.tsx:69` | `{nombre}, prepara tu mano inicial` | `{nombre}, prepará tu mano inicial` |
| `StartingHandModal.tsx:75` | `1. Aves que conservas (n de m)` | `1. Aves que conservás (n de m)` |
| `StartingHandModal.tsx:87` | `2. Alimento que descartas (n de m)` | `2. Alimento que descartás (n de m)` |
| `StartingHandModal.tsx:111` | `3. Carta de bonificación que conservas` | `3. Carta de bonificación que conservás` |
| `StartingHandModal.tsx:78,97` | `Se conserva (pulsa para descartarla)` / `Se descarta (pulsa para quedártela)` (tooltips) | `Se conserva (pulsá para descartarla)` / `Se descarta (pulsá para quedártela)`; el texto visible bajo cada carta pasa a `Se conserva` / `Se descarta` |
| `StartingHandModal.tsx:70-72` (subtítulo) | `Te tocaron 5 aves y 5 fichas de alimento. Quédate con las aves que quieras, pero por cada una descarta 1 ficha de alimento.` | `Te tocaron 5 aves y 5 fichas de alimento. Quedate con las aves que quieras, pero por cada una descartá 1 ficha de alimento.` |
| `PlayerBoard.tsx:102-104` | `Obtén alimento del comedero` / `Pon huevos en tus nidos` / `Roba nuevas cartas de ave` | `Obtené alimento del comedero` / `Poné huevos en tus nidos` / `Robá nuevas cartas de ave` |
| `ConnectionStatusBar.tsx:138` | `Copiar Enlace de Sala` / `¡Enlace Copiado!` | `Copiar enlace de sala` / `¡Enlace copiado!` |
| `GameOverModal.tsx` | `Jugar Otra Partida` etc. | igual (los emoji de las filas pasan a íconos) |

### `src/ui/network/peerManager.ts`

| Línea | Actual | Nuevo |
|---|---|---|
| 452 | `La sala ya tiene otro invitado conectado. Si eras tú desde otra pestaña, ciérrala e inténtalo de nuevo.` | `La sala ya tiene otro invitado conectado. Si eras vos desde otra pestaña, cerrala e intentá de nuevo.` |
| 241, 429, 17 | `Sala creada. Esperando a que el invitado se conecte...`, `El invitado se desconectó. Esperando a que vuelva...`, `Esperando al anfitrión...` | igual |

### `src/game/cards.ts` (descripciones)

Las descripciones de bonificación usan emoji ("Cuentan las aves con el ícono 🫀.", líneas ~3560–3590). Ver `04-icons.md` §Pendientes: hasta que haya íconos, dejá el texto sin el emoji (ej. "Cuentan las aves con el ícono de anatomía.") o mantené el emoji solo ahí y avisá al equipo de diseño.

## Textos nuevos que propone el diseño ([NUEVO])

Todo ya en voseo. Ver `05-screens.md` para el contexto de cada uno.

**Comedero / mercado / tablero**
- `El comedero está vacío. Relanzá los dados para volver a llenarlo.`
- `Turno de {nombre}` (chip) + `Todavía no es tu turno. Los dados se activan cuando te toque jugar.`
- `El mazo se agotó.` / `Se barajó la pila de descarte para formar un nuevo mazo.` · ficha `Mazo vacío` / `0 cartas · se baraja el descarte` · hueco `Sin carta` / `No quedan aves para reponer este lugar`
- Encabezado de hábitat: `{n} de 5 aves`, `{n} de 5 aves · lleno`, botón `Poner {n} huevos`, `Tus aves no tienen espacio libre para huevos.`, `Jugá tu primera ave acá`
- `Tu mano está vacía` + botón `Ir al mercado` · `Sin cartas de bonificación`

**Conexión y guardado**
- Chips: `Conectado en vivo`, `Esperando oponente...`, `Conectando...`, `Desconectado` + botón `Reconectar`
- `Sala online:` · `Rol:` · `{nombre} (Host)`
- `Reconectando con el servidor de señalización...` · `No cierres esta pestaña.`
- `Error en el canal de datos: se perdió la conexión.`
- `¡Conectado con el oponente!` · `La partida sigue desde donde estaba.`
- `Partida guardada · almacenamiento bloqueado` · `No se pudo guardar la partida en este navegador.` · `El almacenamiento está lleno o bloqueado (modo privado). Podés seguir jugando, pero no vas a poder reanudarla si cerrás la pestaña.`
- `Ya existe una sala con ese código. Probá con otro.`
- `No se pudo conectar a la sala {código}: la sala no responde.` · `Verificá que el código de sala sea correcto y que la persona anfitriona siga con la sala abierta en su navegador.`
- `Escribí tu nombre para poder jugar.` · `Copiado` / `¡Enlace copiado!` · `Sin permiso del navegador` / `No se pudo copiar el enlace. Copialo a mano:`
- `Te vas a unir a la sala: {código}`

**Poner huevos**
- `Huevos disponibles en este turno:` · `{n} por asignar` · `Opcional (+1 extra): Descartar 1 alimento`
- `{n} / {cap}` · `{n} espacio libre` / `{n} espacios libres` · `Capacidad completa`
- `Todas tus aves ya alcanzaron su capacidad máxima de huevos.`
- `Confirmar y poner {n} huevos`
- `aria-label`: `Quitar 1 huevo asignado`, `Poner 1 huevo en esta ave`

**Esperas y bonificación**
- `Preparación lista` · `Esperando a que el resto de los jugadores termine la suya para empezar la Ronda 1...`
- `Conteo final en pausa` · `Esperando a que {nombre} elija su carta de bonificación...`
- `{nombre}, elegí tu carta de bonificación` · `Se revelaron 2 cartas. Quedate con 1; el resto vuelve al descarte.` · `Elegir esta` / `Elegida`

**Fin de partida (desempate)**
- `Empate a puntos: gana quien tiene más alimento sin usar ({nombre}: {n} · {nombre}: {n}).`

**Registro y avisos**
- `Registro de acciones` (lateral) · `Ver registro completo` · `Registro de la partida` · filtros `Todo`, `Poderes`, `Sistema` · separadores `Ronda {n}` / `en curso`
- `Todavía no hay acciones. Cuando empiece la partida vas a ver acá lo que pasa en cada turno.`
- Entradas: `Jugó un ave.`, `Obtuvo alimento del comedero.`, `Relanzó los dados del comedero.`, `Robó cartas de ave.`, `Puso huevos.`, `Poder de {ave}: {efecto}.`, `Depredador {ave}: ¡Caza exitosa! Reveló a {ave} ({n} cm ≤ {m} cm) y la solapó debajo.`, `Depredador {ave}: Caza fallida ({detalle}).`, `Comenzó la ronda {n}.`, `¡Todos terminaron la preparación! Comienza la Ronda 1.`, `El mazo se agotó. Se barajó la pila de descarte para formar un nuevo mazo.`
- Toasts (el rival ya no genera ninguno: ver `02-components.md` §Toasts): `Es tu turno` / `Tomá una acción: jugar un ave, comida, huevos o cartas.` · `Poder de {ave}` · `¡Caza exitosa!` · `Caza fallida` · `Comienza la ronda {n}` / `Quedan {n} rondas. Revisá los objetivos de la ronda.` · `Cerrar aviso` · `Reintentar`

**Turno del rival y velocidad**
- Banner de turno: `Tu turno` · `Elegí una acción` — `Turno de {nombre}` · `Está jugando` (solitario) / `Esperando su jugada` (online)
- Chip de la barra: `Tu turno` / `Turno de {nombre}` · marca del marcador: `Turno`
- Panel de acción del rival, frase principal (siempre en pasado, tercera persona; los [nombres] de aves en negrita y sin corchetes):
  - `Jugó {ave} en el Bosque.` / `en la Pradera.` / `en el Río.` (artículo según el hábitat)
  - `Tomó {n} {alimento} del comedero.` — alimentos con plural: `1 semilla` / `2 semillas`, `fruta(s)`, `insecto(s)`, `1 pez` / `2 peces`, `roedor(es)`, `comodín` / `comodines`; varios se unen con " y " (`Tomó 1 semilla y 1 pez del comedero.`); si no se sabe cuál: `Tomó alimento del comedero.`
  - `Relanzó el comedero y tomó {…} del comedero.` · `Relanzó los dados del comedero.`
  - `Puso {n} huevo(s) en {ave}.` · con varias aves `en {ave} y {ave}` · con más de dos `en {ave}, {ave} y {n} más`
  - `Robó {ave} del mercado.` · `Robó {n} carta(s) del mazo.` · `Robó {ave} del mercado y 1 carta del mazo.`
- Detalle de poderes bajo la frase: `Poder de {ave}: {efecto}` · `Depredador {ave}: ¡Caza exitosa! …` · `Depredador {ave}: Caza fallida …`
- Menú de la partida: etiqueta `Velocidad` · opciones `Normal`, `Rápida`, `Sin pausas` · ayudas: `El rival espera un momento y deja ver cada jugada.` / `Pausas y animaciones más cortas.` / `El rival juega sin esperar; su última jugada queda a la vista.`
- `Cerrar aviso` (botón del panel; igual que el de los toasts) · región: `aria-label="Acción del rival"` · grupo: `aria-label="Velocidad del juego"`

**Bienvenida y configuración**
- `Juego de construcción de motor ecológico inspirado en Wingspan`
- `Partida en curso` / `Modo solitario · Ronda {n} · guardada hace {n} min` · `Continuar` · `Borrar la partida guardada`
- `¿Cómo te llamás?` · `Modo Solitario` / `Una partida 1 contra 1 contra la IA` · `Multijugador Online` / `Creá o unite a una sala en tiempo real`
- `Jugá contra un rival controlado por la IA` · `Dificultad del rival` · `Jugá con un amigo en tiempo real vía P2P` · `O unirse a sala existente` · `Código de sala` · `ej. halcon-428 (o pegá el enlace de invitación)`
- `Uniéndote a la sala` · `Sala {código} · Jugando como {nombre}` · `Conectando con la sala...` · `No se pudo conectar` · `Volver al inicio`

## Inconsistencias de mayúsculas en los tableros

El diseño mezcla "Crear Sala y Compartir Enlace" (Configuración) con "Crear sala y compartir enlace" (Conexión), y "Multijugador Online" con "Multijugador online". **Recomendación:** mantener las mayúsculas del repo actual (Title Case) en botones y títulos de modo, porque los tests y el e2e las buscan (`/Crear Sala/`, `/Multijugador Online/`, `/Unirse/`); usar sentence case solo donde el diseño cambia un texto que ya existe (`Copiar enlace de sala`, `¡Enlace copiado!`).

## Tests y e2e que dependen de los textos

Actualizá estos selectores junto con el cambio de texto (mismo commit):

| Archivo | Selector actual | Cambio |
|---|---|---|
| `e2e/run.mjs:117` | `.replace(/\s*\(Tú\)/g, "")` | `/\s*\((Tú|Vos)\)/g` (o solo `Vos`) |
| `e2e/run.mjs:186` | `getByPlaceholder("Escribe tu nombre...")` | `getByPlaceholder("Escribí tu nombre...")` |
| `e2e/run.mjs:175,220` | `getByPlaceholder("Tu nombre...")` | sin cambio (Configuración mantiene "Tu nombre...") |
| `e2e/run.mjs` | `getByTitle("Tomar 1 insecto/gusano")` | **conservar el atributo `title`** en el dado (aunque cambien los íconos) |
| `e2e/run.mjs` | `locator("button.die-token")`, `.die-wild` | **conservar esas clases**, y elegir dados siempre con `button.die-token`: el dado que se despide es un `<span class="die-token die-token--ghost">` (ver `02-components.md` §Dado) |
| `e2e/run.mjs` | `getByText(/Ronda\s*1\s*de 4/)` | conservar el texto "Ronda N de 4" en un solo nodo de texto |
| `e2e/run.mjs` | `getByRole("button", { name: "Elegir esta" / "Confirmar mano inicial" / "Continuar" })`, `/Crear Sala/`, `/Unirse/`, `/Multijugador Online/`, `getByText("(Terminada)")`, `getByText("Partida en curso")` | conservar los nombres accesibles de estos botones y textos |
| `e2e/run.mjs` | `getByText(/La sala ya tiene otro invitado/)` | sin cambio (solo cambia el final de la frase) |
| `src/ui/App.resume.test.tsx` | `getByTitle("Borrar la partida guardada")`, `getByText("Wingspread")`, `getByText(/Modo solitario/)`, `getByText(/Sala halcon-482/)`, `getByText(/hace 5 min/)` | **conservar `title` y `aria-label` del botón de borrar**; el logo debe seguir teniendo el texto "Wingspread"; la tarjeta "Partida en curso" conserva esos textos |
| `src/ui/App.bonusChoice.test.tsx` | `elegí tu carta de bonificación`, `Se revelaron 2 cartas` | sin cambio (ya están en voseo y coinciden con el diseño) |
| `src/ui/components/playerNames.test.tsx` | `getByText("Nico")`, `/Nico:/` | el nombre debe ir en su propio elemento de texto (no concatenado con "(Vos)" ni con puntaje) |

Los tests de `describePower` (si existen, buscar con `grep -rn "describePower\|Obtén\|Pon " src`) cambian a los textos nuevos y sin emoji.
