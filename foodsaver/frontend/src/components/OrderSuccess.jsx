import React from "react";
import { motion } from "framer-motion";

export default function OrderSuccess({ order, onTrack, onClose }) {
  const methodIconMap = {
    upi: "📱 UPI Payment",
    card: "💳 Credit / Debit Card",
    cod: "💵 Pay at Counter",
  };

  const methodLabel = methodIconMap[order?.method] || order?.method || "Digital Payment";
  const amountStr = typeof order?.amount === "number" ? order.amount.toFixed(2) : order?.amount || "0.00";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="order-success-popup-card"
      style={{
        background: "#121215",
        border: "2px solid #69C7A8",
        borderRadius: 20,
        padding: "28px 24px",
        textAlign: "center",
        boxShadow: "0 20px 50px rgba(34, 197, 94, 0.25), 0 10px 30px rgba(0,0,0,0.8)",
        color: "#ffffff",
        maxWidth: 440,
        margin: "0 auto",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* GLOWING AMBER/GREEN BACKGROUND GRADIENT ORB */}
      <div
        style={{
          position: "absolute",
          top: "-50px",
          left: "50%",
          transform: "translateX(-50%)",
          width: 200,
          height: 120,
          background: "radial-gradient(circle, rgba(34, 197, 94, 0.25) 0%, rgba(0,0,0,0) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* FLOATING CELEBRATION BADGES */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
        <motion.span
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            padding: "4px 10px",
            borderRadius: 20,
            background: "rgba(34, 197, 94, 0.15)",
            color: "#69C7A8",
            border: "1px solid rgba(34, 197, 94, 0.4)",
          }}
        >
          🎉 Payment Successfully Paid!
        </motion.span>
        <motion.span
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            padding: "4px 10px",
            borderRadius: 20,
            background: "rgba(245, 158, 11, 0.15)",
            color: "#FF9F68",
            border: "1px solid rgba(245, 158, 11, 0.4)",
          }}
        >
          ⚡ Token Generated
        </motion.span>
      </div>

      {/* ANIMATED RIPPLE CHECKMARK ICON */}
      <div style={{ position: "relative", width: 88, height: 88, margin: "0 auto 16px" }}>
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.2, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "rgba(34, 197, 94, 0.25)",
          }}
        />
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #145C52, #69C7A8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 24px rgba(34, 197, 94, 0.4)",
            position: "relative",
            zIndex: 2,
          }}
        >
          <motion.svg
            width="46"
            height="46"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <motion.path
              d="M5 13l4 4L19 7"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.2 }}
            />
          </motion.svg>
        </div>
      </div>

      {/* SUCCESS TITLE & SUBTITLE WITH ENHANCED FONT COLORS */}
      <h2 style={{ fontSize: 24, fontWeight: 900, color: "#ffffff", margin: "0 0 4px", letterSpacing: -0.3 }}>
        Payment Successful!
      </h2>
      <p style={{ fontSize: 13.5, color: "#8A9490", margin: "0 0 20px", fontWeight: 500 }}>
        Your surplus meal deal is reserved. Show your token at counter pickup!
      </p>

      {/* HIGH-CONTRAST ITEM & BILL DETAILS CARD */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 14,
          padding: 16,
          textAlign: "left",
          marginBottom: 20,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#8A9490", fontWeight: 600 }}>Pickup Token Code</span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: "#FF9F68",
              fontFamily: "monospace",
              background: "rgba(245, 158, 11, 0.15)",
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid rgba(245, 158, 11, 0.3)",
            }}
          >
            {order?.token || order?.id || "FS-882910"}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#8A9490", fontWeight: 600 }}>Payment Method</span>
          <span style={{ fontSize: 13, color: "#ffffff", fontWeight: 700 }}>
            {methodLabel}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#8A9490", fontWeight: 600 }}>Amount Paid</span>
          <strong style={{ fontSize: 18, color: "#69C7A8", fontFamily: "monospace", fontWeight: 900 }}>
            ₹{amountStr}
          </strong>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#8A9490", fontWeight: 600 }}>Counter Pickup Window</span>
          <span style={{ fontSize: 13, color: "#ffffff", fontWeight: 700 }}>
            {order?.eta || "Today · Till 22:00"}
          </span>
        </div>
      </div>

      {/* ACTION BUTTONS WITH ENHANCED COLOR CONTRAST */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          className="btn btn-amber"
          style={{
            width: "100%",
            padding: "13px 16px",
            fontSize: 15,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 4px 16px rgba(245, 158, 11, 0.4)",
            cursor: "pointer",
          }}
          onClick={() => {
            if (onClose) onClose();
            window.location.href = "/customer/pickups";
          }}
        >
          🎟️ View My Pickup Tokens
        </button>

        {onClose && (
          <button
            type="button"
            className="btn btn-outline"
            style={{
              width: "100%",
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 700,
              color: "#ffffff",
              borderColor: "rgba(255, 255, 255, 0.2)",
            }}
            onClick={onClose}
          >
            ✕ Close Notification
          </button>
        )}
      </div>
    </motion.div>
  );
}

