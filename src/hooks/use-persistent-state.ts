"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A piece of UI preference that survives a reload — a sidebar tab, a collapsed
 * panel. Never for anything the server decides: it is per-browser, and the
 * server cannot see it.
 *
 * `localStorage` is treated as the external store it is rather than mirrored
 * into state: reading it in an effect and calling `setState` would render the
 * fallback first and then immediately re-render with the stored value, which is
 * both a cascading render and a visible flicker of the wrong tab.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab writing the same key. Without this the two drift apart until
  // one of them is reloaded.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private mode, or storage disabled.
    return null;
  }
}

export function usePersistentState<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      const stored = read(key);
      // A value the caller no longer recognises — a tab that was renamed in a
      // later release — falls back rather than being handed on.
      return stored && (allowed as readonly string[]).includes(stored)
        ? (stored as T)
        : fallback;
    },
    // The server has no browser storage, so it renders the fallback and the
    // first client render matches it.
    () => fallback,
  );

  const update = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Losing the preference is better than failing the interaction — the
        // notification below still moves the UI for this session.
      }
      for (const listener of listeners) listener();
    },
    [key],
  );

  return [value, update];
}
