import { useEffect, useRef, useState } from "react";

/**
 * Holds a value back until it stops changing. The search boxes write to the URL,
 * and the URL is the query key — without this every keystroke is a request.
 */
export function useDebouncedValue<T>(value: T, wait: number): T {
  const [debounced, setDebounced] = useState(value);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = window.setTimeout(() => setDebounced(value), wait);
    return () => window.clearTimeout(timeout);
  }, [value, wait]);

  return debounced;
}
