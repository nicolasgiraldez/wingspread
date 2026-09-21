/** Tres puntos que se encienden en fila: "está jugando…". Decorativos; el texto de al lado lo dice. Con movimiento reducido quedan quietos. */
export function ThinkingDots() {
  return (
    <span className="dots" aria-hidden="true">
      <span className="dots__dot" />
      <span className="dots__dot" />
      <span className="dots__dot" />
    </span>
  );
}
