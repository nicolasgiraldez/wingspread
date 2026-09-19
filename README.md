# Wingspread

Juego web interactivo de construcción de motor ecológico inspirado en **Wingspan**.

## Modos de Juego

1. **🤖 Modo Solitario (1 contra 1 contra la IA)**:
   - Una partida estándar de dos jugadores contra un rival controlado por la IA. No hay un modo solitario oficial: el rival es un jugador más, con su tablero, su mano, su alimento y sus poderes, y juega con exactamente las mismas reglas y puntuación que un humano.
   - 3 niveles: **Fácil (Pichón)**, **Normal (Águila)** y **Difícil (Halcón)** (ver "El rival de la IA").

2. **🌐 Multijugador Online con Salas P2P (PeerJS / WebRTC)**:
   - Crea salas privadas con códigos únicos (ej. `wingspread.vercel.app?room=halcon-482`).
   - Comparte el enlace con un amigo para jugar desde diferentes dispositivos en tiempo real sin registros ni servidores externos.
   - Sincronización de estado instantánea bidireccional.

## Stack Técnico

- **Vite 8**
- **React 19**
- **TypeScript 6**
- **PeerJS (WebRTC P2P)**
- **Lucide Icons**
- **Vitest** + Testing Library
- **ESLint** (flat config, `typescript-eslint`, `react-hooks`)

## Características Principales

- **Motor de Reglas Completo**:
  - Preparación estándar: cada jugador recibe 5 aves, 5 fichas de alimento (1 de cada tipo) y 2 bonificaciones; se queda con las aves que quiera descartando 1 alimento por cada una, y con 1 bonificación. El primer jugador se sortea.
  - Comedero con 5 dados aleatorios de 6 caras y relanzamiento dinámico.
  - Regla de sustitución de recursos 2:1 y costes de alimento comodín (`wild`).
  - Filas de hábitat con beneficios progresivos por columna (Bosque, Pradera, Río) y costes en huevos.
  - Poderes de aves: almacenamiento de comida (*cache*), solapamiento (*tuck*), depredadores/caza (*predator*) y beneficios colectivos.
  - Objetivos de fin de ronda: en cada partida se sortean 4 de los 16 del juego base (aves y huevos por hábitat, aves y huevos por tipo de nido, conjuntos de huevos, aves totales), con puntuación por posición. Ante un empate a puntos gana quien tiene más alimento sin usar.
  - Cartas de bonificación personal (26 del juego base, incluidas las de categoría por nombre, con marca en las aves que cuentan); las que se roban con un poder se eligen viendo las cartas reveladas.
- **Interfaz Web Interactiva**:
  - Tablero temático con fichas de huevos, comida almacenada y cartas solapadas.
  - Comedero interactivo de dados y mercado de aves con mazo.
  - Modales guiados para jugar aves y pantalla final de puntuaciones y victoria.
  - Ilustraciones de aves en las cartas (WebP optimizado; las aves sin arte muestran un marcador).

## Scripts de Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor local de desarrollo
npm run dev

# Ejecutar suite de pruebas
npm test

# Simulación de partidas completas con un jugador aleatorio (40 por modo por defecto).
# Para una pasada exhaustiva: VITE_SIM_GAMES=1000 npx vitest run simulation
# (en PowerShell: $env:VITE_SIM_GAMES=1000; npx vitest run simulation)
# Si una partida falla, el mensaje incluye la semilla para reproducirla con playGame({ seed, mode }).

# Análisis estático (ESLint) y chequeo de tipos (tsc -b)
npm run lint
npm run typecheck

# Prueba e2e del multijugador con dos navegadores reales (ver más abajo)
npm run e2e

# Compilar para producción (TypeScript + Vite)
npm run build

# Previsualizar el build de producción localmente
npm run preview
```

## El rival de la IA

El rival (`src/game/bot.ts`) no tiene reglas propias: en cada turno genera jugadas candidatas válidas, las simula con el propio motor y elige la que deja mejor el estado (puntos actuales, valor del alimento, las cartas y las aves en juego, y la carrera por el objetivo de la ronda). Al empezar elige qué aves conservar según lo que podría pagar con el alimento que le queda, y la bonificación que mejor encaja.

| Nivel | Cómo juega | Puntos medios* |
|---|---|---|
| Fácil | Jugadas válidas al azar | ~40 |
| Normal | Compara pocas candidatas y decide con mucho ruido | ~50 |
| Difícil | Compara muchas y mira también su siguiente jugada | ~57 |

\*Partidas entre IAs de distinto nivel. Difícil gana al normal en ~2 de cada 3 partidas y al fácil en casi todas.

## Multijugador: conexión y reconexión

- El anfitrión (`nico`) es la única fuente de verdad: valida cada jugada del invitado (`santi`) y le reenvía el estado.
- Si el invitado recarga la página o pierde la conexión, se reconecta solo (reintenta ~47 s) y recupera su asiento; el anfitrión lo reconoce por un token de sesión.
- La partida solitaria y la sala del anfitrión se guardan en el navegador tras cada jugada. Si recargas o cierras la pestaña, la pantalla de inicio ofrece **Continuar partida**: la sala se reabre con el mismo código y el invitado se reconecta. Solo se guarda una partida a la vez y se borra al terminar.
- PeerJS ya incluye un STUN de Google y TURN públicos de peerjs.com. Son compartidos y "best effort": si tus jugadores están tras redes muy restrictivas puedes añadir un TURN propio con la variable `VITE_ICE_SERVERS` (JSON), que se **suma** a los anteriores:

```bash
VITE_ICE_SERVERS='[{"urls":"turn:turn.midominio.com:3478","username":"usuario","credential":"clave"}]'
```

En Vercel: *Project Settings → Environment Variables*. Ojo: al ir en el bundle del navegador, las credenciales son visibles; usa credenciales temporales o de bajo privilegio.

## Prueba e2e del multijugador

`npm run e2e` compila la app y abre **dos navegadores reales** (anfitrión e invitado) que se conectan por WebRTC a través del servidor de señalización de PeerJS. Juega una partida completa comprobando que ambos ven siempre el mismo estado, mientras provoca los problemas típicos: recarga del invitado, recarga del anfitrión (reanuda la sala guardada), caída de la conexión desde cada lado y un intruso que intenta sentarse en la sala.

- Requiere un Chrome, Edge o Chromium instalado (se busca solo; o indica uno con `E2E_BROWSER=<ruta>`) y conexión a internet.
- `E2E_URL=https://tu-app.vercel.app/ npm run e2e` prueba una versión ya desplegada en vez de la build local. `E2E_BAIL=1` para en el primer fallo y `E2E_HEADED=1` muestra los navegadores.
- Si un escenario falla, las capturas de ambas pantallas quedan en `e2e/out/` (ignorada por git).
- No forma parte de `npm test`: depende de la red y de un navegador, así que se ejecuta a mano (dura ~30 s).

## Ilustraciones de aves

Cada carta busca su imagen en `src/ui/assets/birds/<id>.webp`, donde `<id>` es la clave de la especie en `src/game/cards.ts` (por ejemplo `baldEagle`).

1. Deja el PNG original (fondo transparente) en `src/ui/assets/birds/` con ese nombre, p. ej. `baldEagle.png`.
2. Ejecuta `npm run images`: genera el `.webp` (máx. 400 px, ~30 KB) solo para los PNG nuevos o modificados. Usa `npm run images -- --force` para regenerar todos.
3. Versiona solo los `.webp`: los PNG fuente están en `.gitignore`.

Las aves sin imagen siguen funcionando y muestran un marcador en su lugar.

## Despliegue en Vercel

El proyecto cuenta con configuración lista para Vercel (`vercel.json`):

### Opción 1: Conectar Repositorio Git
1. Sube el proyecto a tu repositorio de GitHub / GitLab.
2. En [Vercel](https://vercel.com/), haz clic en **Add New Project** e importa el repositorio.
3. Vercel detectará el framework **Vite** de forma automática (Command: `npm run build`, Output Directory: `dist`).
4. Haz clic en **Deploy**.

### Opción 2: Usar Vercel CLI
```bash
npx vercel --prod
```
