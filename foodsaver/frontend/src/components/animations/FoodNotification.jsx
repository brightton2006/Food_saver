import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { smoothSpring, isReducedMotion } from "../../lib/animations.js";

/**
 * FoodNotification
 * Elegant top-right sliding alert with food/location icon and smooth auto-dismiss progress bar
 */
export default function FoodNotification({
  id = null,
  icon = "🍛",
  title = "Fresh Surplus Food Available Nearby",
  message = "A nearby kitchen just published quality surplus meals at 60% off.",
  distance = "1.2 km away",
  duration = 4500,
  onDismiss = () => {},
  onClick = null,
}) {
  const reduced = isReducedMotion();
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, onDismiss]);

  return (
    <motion.div
      initial={reduced ? {} : { x: 50, opacity: 0, scale: 0.95 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={reduced ? {} : { x: 40, opacity: 0, scale: 0.95 }}
      transition={smoothSpring}
      onClick={onClick}
      style={{
        position: "relative",
        background: "rgba(24, 36, 33, 0.96)",
        backdropFilter: "blur(8px)",
        border: "1.5px solid rgba(105, 199, 168, 0.4)",
        boxShadow: "0 14px 34px rgba(0,0,0,0.5), 0 0 20px rgba(105, 199, 168, 0.15)",
        borderRadius: 16,
        padding: "14px 16px 16px",
        width: 340,
        maxWidth: "92vw",
        cursor: onClick ? "pointer" : "default",
        overflow: "hidden",
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "rgba(105, 199, 168, 0.15)",
            border: "1px solid rgba(105, 199, 168, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
            <strong style={{ fontSize: 13.5, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {title}
            </strong>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                fontSize: 14,
                cursor: "pointer",
                padding: "0 4px",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          <p style={{ margin: "2px 0 6px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.4 }}>
            {message}
          </p>

          {distance && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#69C7A8",
                background: "rgba(105, 199, 168, 0.12)",
                padding: "2px 8px",
                borderRadius: 6,
                display: "inline-block",
              }}
            >
              📍 {distance}
            </span>
          )}
        </div>
      </div>

      {/* AUTO-DISMISS PROGRESS LINE */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "rgba(255, 255, 255, 0.08)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "linear-gradient(90deg, #10b981, #f59e0b)",
            transition: "width 0.05s linear",
          }}
        />
      </div>
    </motion.div>
  );
}
