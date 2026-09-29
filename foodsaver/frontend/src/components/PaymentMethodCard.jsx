import React from "react";
import { motion } from "framer-motion";

export default function PaymentMethodCard({
  icon,
  title,
  desc,
  selected,
  onClick,
  id,
}) {
  return (
    <motion.button
      type="button"
      layout
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      onClick={() => onClick(id)}
      className={`payment-method-card ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      style={{
        position: "relative",
        border: selected ? "2px solid #FF9F68" : "1.5px solid rgba(255,255,255,0.12)",
        background: selected ? "rgba(245, 158, 11, 0.08)" : "#18181b",
        boxShadow: selected ? "0 8px 24px rgba(245, 158, 11, 0.25)" : "0 4px 14px rgba(0,0,0,0.3)",
        borderRadius: 14,
        padding: 14,
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        color: "#ffffff",
        transition: "border-color 0.25s ease, background-color 0.25s ease, box-shadow 0.25s ease",
      }}
    >
      <div className="pm-icon" style={{ fontSize: 24, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}>
        {icon}
      </div>
      <div className="pm-body" style={{ flex: 1 }}>
        <div className="pm-title" style={{ fontSize: 14.5, fontWeight: 800, color: selected ? "#FF9F68" : "#ffffff" }}>
          {title}
        </div>
        <div className="pm-desc" style={{ fontSize: 12, color: "#8A9490", marginTop: 2 }}>
          {desc}
        </div>
      </div>
      {selected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#FF9F68",
            color: "#000000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          ✓
        </motion.div>
      )}
    </motion.button>
  );
}
