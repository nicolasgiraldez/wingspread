# Wingspread

Prototipo web interactivo de un juego de mesa de construcción de motor ecológico inspirado en **Wingspan**.

## Stack Técnico

- **Vite 8**
- **React 19**
- **TypeScript 5**
- **Lucide Icons**
- **Vitest**

## Características Principales

- **Motor de Reglas Completo**:
  - Comedero con 5 dados de alimento y relanzamiento dinámico.
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
npx vercel
```
O para desplegar directamente a producción:
```bash
npx vercel --prod
```
