import React from "react";
import { useCountdown } from "../lib/useCountdown.js";

// The signature element: shop lights dimming from amber to ember as the
// closing window runs down, then going dark the instant the counter
// hits zero — visually tying the countdown directly to "lights out,
// rescue begins".
export default function CountdownBar({ createdAt, expiresAt, compact = false }) {
  const { fraction, label, isClosed } = useCountdown(expiresAt, createdAt);

  const color = isClosed
    ? "var(--line)"
    : fraction > 0.5
    ? "var(--amber)"
    : fraction > 0.2
    ? "#e08a2b"
    : "var(--ember)";

  return (
    <div className="countdown">
      <div className="countdown-track">
        <div
          className="countdown-fill"
          style={{ width: `${fraction * 100}%`, background: color }}
        />
      </div>
      {!compact && (
        <div className="countdown-label">
          <span>{isClosed ? "Pickup window closed" : "Time left to claim"}</span>
          <span className="time-left">{label}</span>
        </div>
      )}
    </div>
  );
}
