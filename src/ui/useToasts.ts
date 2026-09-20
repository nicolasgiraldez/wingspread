import { useCallback, useRef, useState } from "react";
import type { ToastData } from "./components/Toast";

const MAX_QUEUED = 8;

/** Cola de avisos: `push` agrega el más nuevo arriba y `dismiss` lo quita. */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const nextId = useRef(0);

  const push = useCallback((toast: Omit<ToastData, "id">) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((prev) => [{ ...toast, id }, ...prev].slice(0, MAX_QUEUED));
  }, []);

  const dismiss = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  return { toasts, push, dismiss };
}
