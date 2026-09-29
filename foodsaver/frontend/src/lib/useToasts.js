import { useCallback, useRef, useState } from "react";

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const pushToast = useCallback((body, ttl = 4500) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, body }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ttl);
  }, []);

  return { toasts, pushToast };
}
