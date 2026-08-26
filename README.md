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
- **TypeScript 5**
- **PeerJS (WebRTC P2P)**
- **Lucide Icons**
- **Vitest**

## Características Principales

- **Motor de Reglas Completo**:
  - Comedero con 5 dados aleatorios de 6 caras y relanzamiento dinámico.
  - Regla de sustitución de recursos 2:1 y costes de alimento comodín (`wild`).
  - Filas de hábitat con beneficios progresivos por columna (Bosque, Pradera, Río) y costes en huevos.
  - Poderes de aves: almacenamiento de comida (*cache*), solapamiento (*tuck*), depredadores/caza (*predator*) y beneficios colectivos.
  - Objetivos de fin de ronda con puntuación y cartas de bonificación personal.
- **Interfaz Web Interactiva**:
  - Tablero temático con fichas de huevos, comida almacenada y cartas solapadas.
  - Comedero interactivo de dados y mercado de aves con mazo.
  - Modales guiados para jugar aves y pantalla final de puntuaciones y victoria.

## Scripts de Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor local de desarrollo
npm run dev

# Ejecutar suite de pruebas
npm test

# Compilar para producción (TypeScript + Vite)
npm run build

# Previsualizar el build de producción localmente
npm run preview
```

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
