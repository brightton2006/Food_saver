import React from "react";

export default function NoImagePlaceholder({ height = 160, className = "", style = {} }) {
  return (
    <div
      className={`no-image-placeholder ${className}`}
      style={{
        width: "100%",
        height: typeof height === "number" ? `${height}px` : height,
        background: "linear-gradient(135deg, #2D3B37 0%, #24332F 100%)",
        border: "1px dashed rgba(255, 255, 255, 0.2)",
        borderRadius: "inherit",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#8A9490",
        userSelect: "none",
        padding: 12,
        boxSizing: "border-box",
        ...style,
      }}
    >
      <span style={{ fontSize: 32, marginBottom: 4, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>
        🍱
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#cbd5e1",
          textTransform: "uppercase",
          letterSpacing: 0.8,
        }}
      >
        No Image Available
      </span>
      <span style={{ fontSize: 10.5, color: "#64748b", marginTop: 2 }}>
        Merchant Photo Pending
      </span>
    </div>
  );
}
