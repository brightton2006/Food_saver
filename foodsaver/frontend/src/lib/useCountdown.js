import { useEffect, useState } from "react";

// Ticks once a second and reports remaining time plus a 0..1 fraction,
// used to drive the dimming countdown bar. The server is still the
// source of truth for when a listing actually closes (see the sweeper) —
// this just renders that fact smoothly on the client.
export function useCountdown(expiresAt, createdAt) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const total = Math.max(1, expiresAt - createdAt);
  const remaining = Math.max(0, expiresAt - now);
  const fraction = Math.min(1, Math.max(0, remaining / total));

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const label =
    remaining <= 0
      ? "Closed"
      : minutes > 0
      ? `${minutes}m ${String(seconds).padStart(2, "0")}s`
      : `${seconds}s`;

  return { remaining, fraction, label, isClosed: remaining <= 0 };
}
