# Wingspread

Juego web interactivo de construcción de motor ecológico inspirado en **Wingspan**.

## Modos de Juego

1. **🤖 Modo Solitario (vs Automa)**:
   - Partidas individuales contra el oponente IA oficial de Wingspan.
   - 3 niveles de dificultad: **Fácil (Pichón)**, **Normal (Águila)** y **Difícil (Halcón)**.
   - Mazo de acciones dinámico con interacción en comedero, mercado, reservas y objetivos de ronda.

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
  - Comedero con 5 dados aleatorios de 6 caras y relanzamiento dinámico.
  - Regla de sustitución de recursos 2:1 y costes de alimento comodín (`wild`).
  - Filas de hábitat con beneficios progresivos por columna (Bosque, Pradera, Río) y costes en huevos.
  - Poderes de aves: almacenamiento de comida (*cache*), solapamiento (*tuck*), depredadores/caza (*predator*) y beneficios colectivos.
  - Objetivos de fin de ronda: en cada partida se sortean 4 de los 16 del juego base (aves y huevos por hábitat, aves y huevos por tipo de nido, conjuntos de huevos, aves totales), con puntuación por posición.
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

# Análisis estático (ESLint) y chequeo de tipos
npm run lint
npm run typecheck

# Compilar para producción (TypeScript + Vite)
npm run build

# Previsualizar el build de producción localmente
npm run preview
```

## Multijugador: conexión y reconexión

- El anfitrión (`nico`) es la única fuente de verdad: valida cada jugada del invitado (`santi`) y le reenvía el estado.
- Si el invitado recarga la página o pierde la conexión, se reconecta solo (reintenta ~47 s) y recupera su asiento; el anfitrión lo reconoce por un token de sesión.
- La partida solitaria y la sala del anfitrión se guardan en el navegador tras cada jugada. Si recargas o cierras la pestaña, la pantalla de inicio ofrece **Continuar partida**: la sala se reabre con el mismo código y el invitado se reconecta. Solo se guarda una partida a la vez y se borra al terminar.
- PeerJS ya incluye un STUN de Google y TURN públicos de peerjs.com. Son compartidos y "best effort": si tus jugadores están tras redes muy restrictivas puedes añadir un TURN propio con la variable `VITE_ICE_SERVERS` (JSON), que se **suma** a los anteriores:

```bash
VITE_ICE_SERVERS='[{"urls":"turn:turn.midominio.com:3478","username":"usuario","credential":"clave"}]'
```

En Vercel: *Project Settings → Environment Variables*. Ojo: al ir en el bundle del navegador, las credenciales son visibles; usa credenciales temporales o de bajo privilegio.

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
