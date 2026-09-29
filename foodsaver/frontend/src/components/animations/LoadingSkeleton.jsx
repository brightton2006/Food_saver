import React from "react";
import { isReducedMotion } from "../../lib/animations.js";

/**
 * LoadingSkeleton
 * High-end shimmer loading skeletons for food cards, lists, tables, and search results
 */
export default function LoadingSkeleton({
  type = "card", // "card" | "list" | "text" | "circle" | "banner"
  count = 1,
  height = null,
  width = "100%",
  className = "",
}) {
  const reduced = isReducedMotion();

  const shimmerStyle = {
    background: "linear-gradient(90deg, #1c2624 0%, #293834 50%, #1c2624 100%)",
    backgroundSize: "200% 100%",
    animation: reduced ? "none" : "shimmer 1.8s infinite ease-in-out",
    borderRadius: "10px",
  };

  const renderSingle = (index) => {
    if (type === "card") {
      return (
        <div
          key={index}
          className={`card ${className}`}
          style={{
            padding: 16,
            borderRadius: 16,
            background: "#182421",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            width,
          }}
        >
          {/* IMAGE BLOCK */}
          <div style={{ ...shimmerStyle, height: height || 160, borderRadius: 12, width: "100%" }} />
          {/* TITLE LINE */}
          <div style={{ ...shimmerStyle, height: 20, width: "70%" }} />
          {/* SUBTITLE LINE */}
          <div style={{ ...shimmerStyle, height: 14, width: "45%" }} />
          {/* BOTTOM ROW */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <div style={{ ...shimmerStyle, height: 22, width: "28%" }} />
            <div style={{ ...shimmerStyle, height: 32, width: "35%", borderRadius: 8 }} />
          </div>
        </div>
      );
    }

    if (type === "list") {
      return (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 14px",
            background: "#182421",
            borderRadius: 12,
            border: "1px solid rgba(255, 255, 255, 0.05)",
            marginBottom: 8,
            width,
          }}
        >
          <div style={{ ...shimmerStyle, width: 48, height: 48, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ ...shimmerStyle, height: 16, width: "60%" }} />
            <div style={{ ...shimmerStyle, height: 12, width: "35%" }} />
          </div>
          <div style={{ ...shimmerStyle, width: 60, height: 20, borderRadius: 6 }} />
        </div>
      );
    }

    if (type === "circle") {
      return (
        <div
          key={index}
          style={{
            ...shimmerStyle,
            width: width || 44,
            height: height || 44,
            borderRadius: "50%",
          }}
        />
      );
    }

    return (
      <div
        key={index}
        style={{
          ...shimmerStyle,
          width,
          height: height || 16,
          marginBottom: 6,
        }}
      />
    );
  };

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: type === "card" && count > 1 ? "row" : "column", gap: 14, flexWrap: "wrap", width: "100%" }}>
        {Array.from({ length: count }).map((_, i) => renderSingle(i))}
      </div>
    </>
  );
}
