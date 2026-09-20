import { useId } from "react";
import type { HabitatId } from "../../game";

interface HabitatSceneProps {
  habitats: HabitatId[];
  width: number;
  height: number;
}

const f = (n: number) => Number(n.toFixed(2));

/** Pino: triángulo con la base en el suelo (y = 0.90·h). */
function Pine({ cx, alto, ancho, fill, w, h }: { cx: number; alto: number; ancho: number; fill: string; w: number; h: number }) {
  const base = 0.9 * h;
  const x = cx * w;
  const half = (ancho * w) / 2;
  return <polygon points={`${f(x - half)},${f(base)} ${f(x + half)},${f(base)} ${f(x)},${f(base - alto * h)}`} fill={fill} />;
}

/** Ola rellena hasta el fondo: `segments` tramos cuadráticos que alternan arriba/abajo de la línea base. */
function wavePath(w: number, h: number, y: number, amp: number, segments: number): string {
  const step = w / segments;
  let d = `M0 ${f(y)}`;
  for (let i = 0; i < segments; i += 1) {
    const dir = i % 2 === 0 ? -1 : 1;
    d += ` Q${f(step * i + step / 2)} ${f(y + dir * amp * 2)} ${f(step * (i + 1))} ${f(y)}`;
  }
  return `${d} L${f(w)} ${f(h)} L0 ${f(h)} Z`;
}

function Scene({ habitat, w, h }: { habitat: HabitatId; w: number; h: number }) {
  if (habitat === "forest") {
    return (
      <>
        <rect width={w} height={h} fill="var(--c-petroleo)" />
        <Pine cx={0.1} alto={0.72} ancho={0.26} fill="var(--c-petroleo-d)" w={w} h={h} />
        <Pine cx={0.27} alto={0.46} ancho={0.17} fill="var(--c-petroleo-l)" w={w} h={h} />
        <Pine cx={0.9} alto={0.64} ancho={0.24} fill="var(--c-petroleo-d)" w={w} h={h} />
        <Pine cx={0.74} alto={0.4} ancho={0.15} fill="var(--c-petroleo-l)" w={w} h={h} />
        <rect y={f(0.88 * h)} width={w} height={f(h - 0.88 * h)} fill="var(--c-petroleo-d)" />
      </>
    );
  }
  if (habitat === "grassland") {
    return (
      <>
        <rect width={w} height={h} fill="var(--c-mostaza)" />
        <circle cx={f(0.78 * w)} cy={f(0.28 * h)} r={f(0.14 * h)} fill="var(--c-mostaza-l)" />
        <path
          d={`M0 ${f(0.78 * h)} Q${f(0.25 * w)} ${f(0.56 * h)} ${f(0.5 * w)} ${f(0.76 * h)} T${f(w)} ${f(0.7 * h)} V${f(h)} H0 Z`}
          fill="var(--c-mostaza-d)"
        />
      </>
    );
  }
  return (
    <>
      <rect width={w} height={h} fill="var(--c-menta)" />
      <circle cx={f(0.76 * w)} cy={f(0.28 * h)} r={f(0.13 * h)} fill="var(--c-crema)" />
      <path d={wavePath(w, h, 0.7 * h, 0.05 * h, 8)} fill="var(--c-menta-d)" />
      <path d={wavePath(w, h, 0.83 * h, 0.045 * h, 10)} fill="var(--c-petroleo)" />
    </>
  );
}

/** Polígonos diagonales que reparten la ventana entre 2 o 3 hábitats (fracciones de w; y = 0 arriba, y = h abajo). */
const SPLITS: Record<2 | 3, [number, number][][]> = {
  2: [
    [[0, 0], [0.56, 0], [0.44, 1], [0, 1]],
    [[0.56, 0], [1, 0], [1, 1], [0.44, 1]],
  ],
  3: [
    [[0, 0], [0.38, 0], [0.3, 1], [0, 1]],
    [[0.38, 0], [0.72, 0], [0.64, 1], [0.3, 1]],
    [[0.72, 0], [1, 0], [1, 1], [0.64, 1]],
  ],
};

/** Escena de fondo de la ventana de una carta: un hábitat, o franjas diagonales si tiene 2 o 3. */
export function HabitatScene({ habitats, width, height }: HabitatSceneProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const w = width;
  const h = height;
  const list = habitats.slice(0, 3);
  const svgProps = {
    className: "bird-card__scene",
    viewBox: `0 0 ${w} ${h}`,
    preserveAspectRatio: "none",
    "aria-hidden": true,
    focusable: false,
  } as const;

  if (list.length <= 1) {
    return (
      <svg {...svgProps}>
        <Scene habitat={list[0] ?? "wetland"} w={w} h={h} />
      </svg>
    );
  }

  const polygons = SPLITS[list.length as 2 | 3];
  const points = (poly: [number, number][]) => poly.map(([x, y]) => `${f(x * w)},${f(y * h)}`).join(" ");
  return (
    <svg {...svgProps}>
      <defs>
        {polygons.map((poly, i) => (
          <clipPath id={`${uid}-${i}`} key={i}>
            <polygon points={points(poly)} />
          </clipPath>
        ))}
      </defs>
      {list.map((habitat, i) => (
        <g key={habitat} clipPath={`url(#${uid}-${i})`}>
          <Scene habitat={habitat} w={w} h={h} />
        </g>
      ))}
      {polygons.slice(1).map((poly, i) => (
        <line
          key={i}
          x1={f(poly[0][0] * w)}
          y1={0}
          x2={f(poly[3][0] * w)}
          y2={f(h)}
          stroke="var(--c-crema)"
          strokeWidth={3}
        />
      ))}
    </svg>
  );
}
