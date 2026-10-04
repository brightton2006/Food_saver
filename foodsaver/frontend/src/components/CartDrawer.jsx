import React from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../lib/cart.jsx";
import { getFoodFallbackImage } from "../lib/foodImageService.js";

export default function CartDrawer() {
  const {
    cartItems,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalCount,
    subtotal,
    totalSavings,
    totalPayable,
  } = useCart();

  const navigate = useNavigate();

  if (!isCartOpen) return null;

  function handleProceedToCheckout() {
    setIsCartOpen(false);
    if (cartItems.length > 0) {
      navigate("/checkout", { state: { listing: cartItems[0].listing, cartItems } });
    }
  }

  return (
    <div
      className="cart-drawer-overlay"
      onClick={() => setIsCartOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 99990,
        display: "flex",
        justifyContent: "flex-end",
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      <div
        className="cart-drawer-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          height: "100%",
          background: "#121215",
          borderLeft: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "-10px 0 35px rgba(0,0,0,0.7)",
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          color: "#ffffff",
        }}
      >
        {/* DRAWER HEADER */}
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🛒</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                Your Food Cart
              </h3>
              <span style={{ fontSize: 12.5, color: "#8A9490", display: "block", marginTop: 2 }}>
                {totalCount} {totalCount === 1 ? "item" : "items"} reserved
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setIsCartOpen(false)}
            style={{ fontSize: 18, width: 36, height: 36, padding: 0, borderRadius: "50%", color: "#ffffff" }}
          >
            ✕
          </button>
        </div>

        {/* DRAWER BODY: ITEMS LIST */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {cartItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#8A9490" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛍️</div>
              <h4 style={{ margin: "0 0 6px", fontSize: 18, color: "#ffffff", fontWeight: 700 }}>Your cart is empty</h4>
              <p style={{ fontSize: 13.5, margin: "0 0 20px", lineHeight: 1.5, color: "#8A9490" }}>
                Discover delicious surplus food deals from nearby restaurants before they sell out!
              </p>
              <button
                type="button"
                className="btn btn-amber"
                onClick={() => setIsCartOpen(false)}
                style={{ fontSize: 14, padding: "10px 20px" }}
              >
                Explore Food Offers
              </button>
            </div>
          ) : (
            cartItems.map(({ listing, quantity }) => {
              const originalPrice = Number(listing.originalPrice) || Number(listing.discountPrice) * 2;
              const discountPrice = Number(listing.discountPrice) || 60;
              const itemTotal = discountPrice * quantity;

              return (
                <div
                  key={listing.id}
                  style={{
                    display: "flex",
                    gap: 14,
                    padding: 14,
                    borderRadius: 14,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  }}
                >
                  {(() => {
                    const foodPhoto =
                      listing.imageUrl ||
                      getFoodFallbackImage(listing.itemName, listing.category);
                    return (
                      <img
                        src={foodPhoto}
                        alt={listing.itemName}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = getFoodFallbackImage(
                            listing.itemName,
                            listing.category
                          );
                        }}
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 10,
                          objectFit: "cover",
                          border: "1px solid rgba(255,255,255,0.12)",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                        }}
                      />
                    );
                  })()}

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <strong style={{ fontSize: 15.5, display: "block", color: "#ffffff", fontWeight: 800 }}>
                        {listing.itemName}
                      </strong>
                      <button
                        type="button"
                        onClick={() => removeFromCart(listing.id)}
                        style={{ background: "none", border: "none", color: "#8A9490", cursor: "pointer", fontSize: 15 }}
                        title="Remove item"
                      >
                        🗑️
                      </button>
                    </div>

                    <span style={{ fontSize: 12.5, color: "#cbd5e1", display: "block", marginTop: 2 }}>
                      By {listing.merchantName || "Verified Kitchen"}
                    </span>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                        <strong style={{ color: "#FF9F68", fontSize: 16, fontFamily: "monospace", fontWeight: 800 }}>
                          ₹{itemTotal.toFixed(2)}
                        </strong>
                        {originalPrice > discountPrice && (
                          <span style={{ fontSize: 12, color: "#64748b", textDecoration: "line-through" }}>
                            ₹{(originalPrice * quantity).toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* HIGH CONTRAST AMBER STEPPER CONTROL */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          background: "#121215",
                          border: "1.5px solid #FF9F68",
                          borderRadius: 8,
                          overflow: "hidden",
                          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => updateQuantity(listing.id, quantity - 1)}
                          style={{
                            background: "rgba(245, 158, 11, 0.25)",
                            border: "none",
                            color: "#FF9F68",
                            fontWeight: 900,
                            fontSize: 18,
                            width: 32,
                            height: 32,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          −
                        </button>
                        <span
                          style={{
                            color: "#ffffff",
                            fontWeight: 900,
                            fontSize: 14.5,
                            minWidth: 32,
                            textAlign: "center",
                            background: "#121215",
                          }}
                        >
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(listing.id, quantity + 1)}
                          style={{
                            background: "rgba(245, 158, 11, 0.25)",
                            border: "none",
                            color: "#FF9F68",
                            fontWeight: 900,
                            fontSize: 18,
                            width: 32,
                            height: 32,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DRAWER FOOTER: BILL SUMMARY & CHECKOUT CTA */}
        {cartItems.length > 0 && (
          <div
            style={{
              padding: 20,
              borderTop: "1px dashed rgba(255, 255, 255, 0.18)",
              background: "#0a0a0c",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1" }}>
                <span>Subtotal</span>
                <span style={{ fontFamily: "monospace", color: "#ffffff" }}>₹{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#69C7A8", fontWeight: 600 }}>
                <span>Discount Savings</span>
                <span style={{ fontFamily: "monospace" }}>−₹{totalSavings.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1" }}>
                <span>Platform Rescue Fee</span>
                <span style={{ color: "#69C7A8", fontWeight: 700 }}>FREE</span>
              </div>
              <div style={{ height: 1, borderTop: "1px dashed rgba(255,255,255,0.18)", margin: "4px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <strong style={{ fontSize: 14.5, textTransform: "uppercase", color: "#ffffff" }}>Total Payable</strong>
                <strong style={{ fontSize: 24, color: "#FF9F68", fontFamily: "monospace", fontWeight: 900 }}>
                  ₹{totalPayable.toFixed(2)}
                </strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  if (window.confirm("Are you sure you want to clear all items from your cart?")) {
                    clearCart();
                  }
                }}
                style={{
                  fontSize: 12.5,
                  padding: "12px 14px",
                  borderColor: "rgba(255, 255, 255, 0.2)",
                  color: "#cbd5e1",
                }}
                title="Clear all items in cart"
              >
                🗑️ Clear
              </button>
              <button
                type="button"
                className="btn btn-amber"
                onClick={handleProceedToCheckout}
                style={{
                  flex: 1,
                  padding: 14,
                  fontSize: 15,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  boxShadow: "0 4px 16px rgba(245, 158, 11, 0.35)",
                }}
              >
                Proceed to Checkout (₹{totalPayable.toFixed(2)}) →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
