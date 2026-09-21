import { useEffect, useRef, useState } from "react";
import { useGameSpeed } from "../../gameSpeed";
import type { GameSpeed } from "../../gameSpeed";

const DURATION_MS: Record<GameSpeed, number> = { normal: 600, fast: 300, instant: 150 };

const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Cifra que cuenta hacia su valor nuevo en vez de saltar. Al montarse muestra el valor sin animar.
 * Los lectores de pantalla leen siempre el valor final; con movimiento reducido no cuenta, salta.
 */
export function CountUp({ value }: { value: number }) {
  const speed = useGameSpeed();
  const [shown, setShown] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    if (current.current === value) return;
    const from = current.current;
    const duration = prefersReducedMotion() ? 0 : DURATION_MS[speed];
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      current.current = t === 1 ? value : Math.round(from + (value - from) * eased);
      setShown(current.current);
      if (t < 1) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [value, speed]);

  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{value}</span>
    </>
  );
}
