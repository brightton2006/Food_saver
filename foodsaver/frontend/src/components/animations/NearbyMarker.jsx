import React from "react";
import { motion } from "framer-motion";
import { isReducedMotion } from "../../lib/animations.js";

/**
 * NearbyMarker
 * Animated live map pulse beacon and food surplus marker
 */
export default function NearbyMarker({
  name = "Restaurant",
  distance = "1.2 km",
  hasSurplus = true,
  category = "Meals",
  onClick = null,
  isUser = false,
}) {
  const reduced = isReducedMotion();

  const icon =
    category === "Bakery"
      ? "🥐"
      : category === "Desserts"
      ? "🍰"
      : category === "Snacks"
      ? "🥟"
      : "🍛";

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      {/* EXPANDING RADAR PULSE RING */}
      {hasSurplus && !reduced && (
        <motion.div
          animate={{
            scale: [1, 2.3],
            opacity: [0.75, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 2.2,
            ease: "easeOut",
          }}
          style={{
            position: "absolute",
            top: 4,
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: isUser
              ? "rgba(59, 130, 246, 0.45)"
              : "rgba(16, 185, 129, 0.45)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      )}

      {/* SECONDARY PULSE RING */}
      {hasSurplus && !reduced && (
        <motion.div
          animate={{
            scale: [1, 1.8],
            opacity: [0.5, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 2.2,
            delay: 0.7,
            ease: "easeOut",
          }}
          style={{
            position: "absolute",
            top: 4,
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: isUser
              ? "rgba(59, 130, 246, 0.35)"
              : "rgba(245, 158, 11, 0.35)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      )}

      {/* CENTER PIN BADGE */}
      <motion.div
        whileHover={reduced ? {} : { scale: 1.14, y: -2 }}
        transition={{ duration: 0.18 }}
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: isUser
            ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
            : hasSurplus
            ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
            : "linear-gradient(135deg, #475569 0%, #334155 100%)",
          border: isUser ? "2px solid #93c5fd" : "2px solid #ffffff",
          boxShadow: hasSurplus
            ? "0 4px 14px rgba(16, 185, 129, 0.5), 0 0 10px rgba(0,0,0,0.4)"
            : "0 4px 10px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: isUser ? 16 : 18,
          zIndex: 2,
        }}
      >
        {isUser ? "📍" : icon}
      </motion.div>

      {/* TOOLTIP LABEL */}
      <motion.div
        initial={reduced ? {} : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          marginTop: 4,
          padding: "3px 8px",
          background: "rgba(15, 23, 42, 0.9)",
          borderRadius: 8,
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          fontSize: 11,
          fontWeight: 700,
          color: "#ffffff",
          whiteSpace: "nowrap",
          zIndex: 3,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span>{name}</span>
        {distance && <span style={{ color: "#69C7A8" }}>• {distance}</span>}
      </motion.div>
    </div>
  );
}
