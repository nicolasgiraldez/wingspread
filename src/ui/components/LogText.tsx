import React from "react";

/** Texto del registro: los nombres entre [corchetes] (aves) van en negrita y sin corchetes. */
export const LogText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\[[^\]]+\])/g).map((part, i) =>
      /^\[[^\]]+\]$/.test(part) ? <strong key={i}>{part.slice(1, -1)}</strong> : part,
    )}
  </>
);
