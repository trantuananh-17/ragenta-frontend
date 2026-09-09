"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * The backlog is drained over roughly this long, so the reveal trails the stream
 * by at most this much — never more. It does not accumulate: the rate is
 * recomputed from the outstanding characters every frame, so a large burst is
 * spent faster than a trickle rather than queueing behind a fixed speed.
 */
const CATCH_UP_MS = 120;

/** A floor, so the tail of an almost-caught-up reveal still visibly moves. */
const MIN_CHARS_PER_MS = 0.02;

/**
 * Paces a growing stream string onto the screen at frame rate instead of at
 * arrival rate.
 *
 * The server sends tokens in whatever sizes the provider and the network
 * produce, so rendering the raw string lands a whole clause in one frame and
 * then nothing for 300ms — which reads as stalling rather than as writing.
 *
 * It cannot make the answer settle later than it otherwise would: `streaming`
 * going false returns the target string from the render path itself, with no
 * frame in between, so the moment the turn ends the full text is on screen. The
 * reveal only ever trails; it never rewinds, because `revealed` only grows.
 */
export function useSmoothText(target: string, streaming: boolean): string {
  const reduced = useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  const smoothing = streaming && !reduced;

  // Read from inside the frame loop, which must not re-subscribe once per
  // token. Synced in an effect rather than during render: a frame that reads
  // the previous target simply reveals one frame less and catches up on the
  // next.
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  const [revealed, setRevealed] = useState(() =>
    smoothing ? 0 : target.length,
  );

  useEffect(() => {
    if (!smoothing) return;

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = now - last;
      last = now;
      setRevealed((current) => {
        const length = targetRef.current.length;
        // Caught up. Returning the same value bails out of the re-render, so an
        // idle loop between bursts costs nothing but the frame callback.
        if (current >= length) return current;
        const rate = Math.max(
          MIN_CHARS_PER_MS,
          (length - current) / CATCH_UP_MS,
        );
        return Math.min(length, current + Math.ceil(rate * elapsed));
      });
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [smoothing]);

  if (!smoothing) return target;
  return revealed >= target.length ? target : target.slice(0, revealed);
}
