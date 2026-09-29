import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cardHoverVariants, smoothSpring, isReducedMotion } from "../../lib/animations.js";

/**
 * FoodCardAnimation
 * Wraps food listing cards with:
 * - Hover elevation, subtle scale & soft shadow
 * - Image parallax scale on hover
 * - Real closing-window dynamic progress bar (from pickup_window_end)
 * - "Save Food" favorite micro-interaction (♡ → ✓ Saved)
 * - Discounted price soft highlight glow
 */
export default function FoodCardAnimation({
  children,
  onClick = null,
  pickupWindowEnd = "22:00",
  pickupWindowStart = "18:00",
  className = "",
  style = {},
  isSaved = false,
  onToggleSave = null,
  discountPrice = null,
  originalPrice = null,
}) {
  const reduced = isReducedMotion();
  const [saved, setSaved] = useState(isSaved);
  const [justSaved, setJustSaved] = useState(false);
  const [timeRemainingPercent, setTimeRemainingPercent] = useState(100);
  const [timeLabel, setTimeLabel] = useState("");

  useEffect(() => {
    setSaved(isSaved);
  }, [isSaved]);

  // Calculate dynamic closing window progress bar from real backend times
  useEffect(() => {
    function computeWindow() {
      if (!pickupWindowEnd) return;
      const now = new Date();
      const [endH, endM] = pickupWindowEnd.split(":").map(Number);
      const [startH, startM] = (pickupWindowStart || "18:00").split(":").map(Number);

      const endTime = new Date(now);
      endTime.setHours(endH, endM || 0, 0, 0);

      const startTime = new Date(now);
      startTime.setHours(startH, startM || 0, 0, 0);

      if (endTime < startTime) {
        // rolls over midnight
        endTime.setDate(endTime.getDate() + 1);
      }

      const totalMs = Math.max(1, endTime - startTime);
      const remainingMs = Math.max(0, endTime - now);
      const pct = Math.min(100, Math.max(0, (remainingMs / totalMs) * 100));

      setTimeRemainingPercent(pct);

      const diffMin = Math.ceil(remainingMs / 60000);
      if (diffMin <= 0) {
        setTimeLabel("Window Closed");
      } else if (diffMin < 60) {
        setTimeLabel(`${diffMin}m left to rescue`);
      } else {
        const hrs = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        setTimeLabel(`${hrs}h ${mins > 0 ? `${mins}m ` : ""}left (Till ${pickupWindowEnd})`);
      }
    }

    computeWindow();
    const interval = setInterval(computeWindow, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [pickupWindowEnd, pickupWindowStart]);

  function handleSaveClick(e) {
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    if (next) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    }
    if (onToggleSave) onToggleSave(next);
  }

  return (
    <motion.div
      variants={reduced ? {} : cardHoverVariants}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      onClick={onClick}
      className={`food-card-animated ${className}`}
      style={{
        position: "relative",
        borderRadius: 18,
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        background: "#182421",
        border: "1px solid rgba(105, 199, 168, 0.2)",
        transition: "border-color 0.25s ease",
        ...style,
      }}
    >
      {/* FLOATING SAVE (FAVORITE) BUTTON */}
      <button
        type="button"
        onClick={handleSaveClick}
        aria-label="Save food item"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 10,
          background: saved ? "rgba(34, 197, 94, 0.9)" : "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(6px)",
          border: `1px solid ${saved ? "#22c55e" : "rgba(255, 255, 255, 0.2)"}`,
          borderRadius: 20,
          padding: "5px 10px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          fontWeight: 700,
          color: "#ffffff",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <motion.span
          animate={justSaved ? { scale: [1, 1.4, 1] } : {}}
          transition={smoothSpring}
        >
          {saved ? "✓" : "♡"}
        </motion.span>
        <span>{saved ? "Saved" : "Save"}</span>
      </button>

      {/* CARD CONTENT */}
      {children}

      {/* DYNAMIC CLOSING-WINDOW AVAILABILITY PROGRESS INDICATOR */}
      {pickupWindowEnd && (
        <div
          style={{
            padding: "8px 14px 10px",
            background: "rgba(0, 0, 0, 0.25)",
            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 11.5,
              fontWeight: 700,
              color: timeRemainingPercent < 25 ? "#f87171" : "#FF9F68",
              marginBottom: 4,
            }}
          >
            <span>⏱️ {timeLabel || `Available until ${pickupWindowEnd}`}</span>
            <span>{Math.round(timeRemainingPercent)}% left</span>
          </div>

          {/* PROGRESS BAR */}
          <div
            style={{
              width: "100%",
              height: 4,
              borderRadius: 2,
              background: "rgba(255, 255, 255, 0.1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${timeRemainingPercent}%`,
                background:
                  timeRemainingPercent < 25
                    ? "linear-gradient(90deg, #ef4444, #f97316)"
                    : "linear-gradient(90deg, #10b981, #f59e0b)",
                transition: "width 0.5s ease-out",
                borderRadius: 2,
              }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
