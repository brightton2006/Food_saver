import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { smoothSpring, isReducedMotion } from "../../lib/animations.js";

/**
 * TokenVerification
 * Clean circular verification animation representing the 3-step state flow:
 * VERIFYING → ✓ TOKEN VERIFIED → PICKUP CONFIRMED
 */
export default function TokenVerification({
  state = "READY", // "READY" | "VERIFYING" | "TOKEN_VERIFIED" | "PICKUP_CONFIRMED" | "ERROR"
  token = "FS-XXXXXX",
  itemName = "",
  customerName = "",
  errorMessage = "Invalid Pickup Token",
  onConfirmHandover = null,
  isCompleting = false,
}) {
  const reduced = isReducedMotion();

  return (
    <div
      style={{
        padding: "20px",
        borderRadius: "18px",
        background: "rgba(24, 36, 33, 0.95)",
        border: "1.5px solid rgba(105, 199, 168, 0.3)",
        boxShadow: "0 14px 36px rgba(0, 0, 0, 0.45)",
        textAlign: "center",
      }}
    >
      {/* CIRCULAR ANIMATION CONTAINER */}
      <div style={{ position: "relative", width: 90, height: 90, margin: "0 auto 16px" }}>
        {/* ROTATING SPINNER RING DURING VERIFYING */}
        {state === "VERIFYING" && (
          <motion.div
            animate={reduced ? {} : { rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "3px solid rgba(245, 158, 11, 0.2)",
              borderTopColor: "#F59E0B",
            }}
          />
        )}

        {/* GLOWING AMBER PULSE DURING READY */}
        {state === "READY" && (
          <motion.div
            animate={reduced ? {} : { scale: [1, 1.12, 1], opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, transparent 70%)",
            }}
          />
        )}

        {/* EMERALD PULSE DURING TOKEN_VERIFIED & CONFIRMED */}
        {(state === "TOKEN_VERIFIED" || state === "PICKUP_CONFIRMED") && (
          <motion.div
            initial={reduced ? {} : { scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            style={{
              position: "absolute",
              inset: -6,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(34, 197, 94, 0.45) 0%, transparent 70%)",
            }}
          />
        )}

        {/* CENTER ICON/BADGE */}
        <div
          style={{
            position: "absolute",
            inset: 6,
            borderRadius: "50%",
            background:
              state === "TOKEN_VERIFIED" || state === "PICKUP_CONFIRMED"
                ? "linear-gradient(135deg, #15803d 0%, #16a34a 100%)"
                : state === "ERROR"
                ? "linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)"
                : "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border:
              state === "TOKEN_VERIFIED" || state === "PICKUP_CONFIRMED"
                ? "2px solid #4ade80"
                : state === "ERROR"
                ? "2px solid #f87171"
                : "2px solid rgba(245, 158, 11, 0.5)",
            boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
          }}
        >
          <AnimatePresence mode="wait">
            {state === "READY" && (
              <motion.span
                key="ready"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{ fontSize: 28 }}
              >
                🏷️
              </motion.span>
            )}

            {state === "VERIFYING" && (
              <motion.span
                key="verifying"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{ fontSize: 24 }}
              >
                ⏳
              </motion.span>
            )}

            {(state === "TOKEN_VERIFIED" || state === "PICKUP_CONFIRMED") && (
              <motion.svg
                key="check"
                initial={reduced ? {} : { scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={smoothSpring}
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 13l4 4L19 7" />
              </motion.svg>
            )}

            {state === "ERROR" && (
              <motion.span
                key="err"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{ fontSize: 28 }}
              >
                ✕
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* STEP PROGRESS PILL */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 1,
            padding: "3px 10px",
            borderRadius: 12,
            background:
              state === "TOKEN_VERIFIED"
                ? "rgba(34, 197, 94, 0.2)"
                : state === "PICKUP_CONFIRMED"
                ? "rgba(34, 197, 94, 0.3)"
                : state === "VERIFYING"
                ? "rgba(245, 158, 11, 0.2)"
                : state === "ERROR"
                ? "rgba(239, 68, 68, 0.2)"
                : "rgba(255, 255, 255, 0.1)",
            color:
              state === "TOKEN_VERIFIED" || state === "PICKUP_CONFIRMED"
                ? "#4ade80"
                : state === "VERIFYING"
                ? "#fbbf24"
                : state === "ERROR"
                ? "#f87171"
                : "#cbd5e1",
            border: `1px solid ${
              state === "TOKEN_VERIFIED" || state === "PICKUP_CONFIRMED"
                ? "#22c55e"
                : state === "VERIFYING"
                ? "#f59e0b"
                : state === "ERROR"
                ? "#ef4444"
                : "rgba(255, 255, 255, 0.15)"
            }`,
          }}
        >
          {state === "READY"
            ? "READY FOR PICKUP"
            : state === "VERIFYING"
            ? "VERIFYING TOKEN..."
            : state === "TOKEN_VERIFIED"
            ? "✓ TOKEN VERIFIED"
            : state === "PICKUP_CONFIRMED"
            ? "PICKUP CONFIRMED ✓"
            : "VERIFICATION FAILED"}
        </span>
      </div>

      {/* HEADLINE */}
      <h4 style={{ margin: "0 0 4px", fontSize: 18, color: "#ffffff", fontWeight: 800 }}>
        {state === "TOKEN_VERIFIED"
          ? "✓ Pickup Verified"
          : state === "PICKUP_CONFIRMED"
          ? "Pickup completed successfully."
          : state === "ERROR"
          ? errorMessage
          : `Order #${token}`}
      </h4>

      {/* METADATA DETAILS */}
      {(itemName || customerName) && (
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#cbd5e1" }}>
          {itemName ? <strong>{itemName}</strong> : ""}
          {itemName && customerName ? " • " : ""}
          {customerName ? <span>Customer: {customerName}</span> : ""}
        </p>
      )}

      {/* TOKEN VERIFIED HANDOVER BUTTON */}
      {state === "TOKEN_VERIFIED" && onConfirmHandover && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: 14 }}
        >
          <button
            type="button"
            className="btn btn-amber"
            onClick={onConfirmHandover}
            disabled={isCompleting}
            style={{
              width: "100%",
              padding: "11px 18px",
              fontSize: 14,
              fontWeight: 900,
              background: "#22c55e",
              borderColor: "#22c55e",
              color: "#ffffff",
              boxShadow: "0 0 16px rgba(34, 197, 94, 0.4)",
            }}
          >
            {isCompleting ? "Recording Handover..." : "MARK AS PICKED UP / COMPLETED"}
          </button>
        </motion.div>
      )}
    </div>
  );
}
