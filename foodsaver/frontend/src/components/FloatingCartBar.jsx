import React from "react";
import { useCart } from "../lib/cart.jsx";

export default function FloatingCartBar({ hotelName }) {
  const { cartItems, totalCount, totalPayable, setIsCartOpen } = useCart();

  if (cartItems.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: 720,
        background: "linear-gradient(135deg, #FF9F68 0%, #FF9F68 100%)",
        borderRadius: 16,
        padding: "14px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 12px 36px rgba(245, 158, 11, 0.45), 0 4px 12px rgba(0,0,0,0.5)",
        zIndex: 9990,
        color: "#000000",
        animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 16, fontWeight: 900 }}>
            {totalCount} {totalCount === 1 ? "Item" : "Items"}
          </strong>
          <span style={{ opacity: 0.7 }}>|</span>
          <strong style={{ fontSize: 18, fontWeight: 900, fontFamily: "monospace" }}>
            ₹{totalPayable.toFixed(2)}
          </strong>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, display: "block", marginTop: 2 }}>
          {hotelName ? `From ${hotelName}` : "Ready to Order"}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setIsCartOpen(true)}
        style={{
          background: "#000000",
          color: "#ffffff",
          border: "none",
          borderRadius: 12,
          padding: "10px 20px",
          fontSize: 14,
          fontWeight: 900,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        VIEW CART 🛒 →
      </button>
    </div>
  );
}
