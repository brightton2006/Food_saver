import React, { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import PaymentMethodCard from "./PaymentMethodCard";
import UPIPayment from "./UPIPayment";
import CardPayment from "./CardPayment";
import CashOnDelivery from "./CashOnDelivery";
import OrderSuccess from "./OrderSuccess";

const METHODS = [
  { id: "upi", title: "UPI", desc: "Pay with your UPI app or ID", icon: "📱" },
  {
    id: "card",
    title: "Credit / Debit Card",
    desc: "Pay securely with card",
    icon: "💳",
  },
  {
    id: "cod",
    title: "Cash on Delivery",
    desc: "Pay when you pick up",
    icon: "💵",
  },
];

export default function PaymentModal({ open, isOpen, onClose, listing, onComplete, onSuccess }) {
  const isModalOpen = open ?? isOpen;
  const [method, setMethod] = useState("upi");
  const [stage, setStage] = useState("select");
  const [order, setOrder] = useState(null);
  const [quantity, setQuantity] = useState(1);

  if (!isModalOpen || !listing) return null;


  async function handleConfirm(result) {
    const orderObj = {
      id: `ORD-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
      method: result.method,
      amount: listing.discountPrice,
      eta: "20-30 mins",
    };
    setOrder(orderObj);
    setStage("success");
    try {
      const callback = onComplete || onSuccess;
      if (callback) {
        const res = await callback(listing, quantity, orderObj);
        if (res && res.claim) {
          setOrder((prev) => ({
            ...prev,
            id: res.claim.token || prev.id,
            claimToken: res.claim.token,
            claim: res.claim,
          }));
        }
      }
    } catch (e) {
      console.error("Error creating claim in PaymentModal", e);
    }
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="payment-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="payment-sheet"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <header className="payment-header">
            <div>
              <h3>Order Checkout</h3>
              <p className="checkout-subhead">
                Review your order details and select a secure payment method
              </p>
            </div>
            <button className="icon-btn checkout-close-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </header>

          <div className="checkout-left-panel">
            {/* ITEM & QUANTITY STEPPER */}
            <div className="checkout-item-card" style={{ background: "#18181b", border: "1.5px solid rgba(255,255,255,0.12)", padding: 16, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="checkout-item-info">
                <strong className="item-title" style={{ color: "#ffffff", fontSize: 16, fontWeight: 800 }}>{listing.itemName}</strong>
                <span className="item-merchant" style={{ color: "#8A9490", fontSize: 13 }}>By {listing.merchantName || listing.hotelName || "Verified Kitchen"}</span>
              </div>

              <div className="qty-stepper-box" style={{ display: "flex", alignItems: "center", background: "#121215", border: "1.5px solid #FF9F68", borderRadius: 8, overflow: "hidden" }}>
                <button
                  type="button"
                  className="qty-step-btn"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  style={{ background: "rgba(245, 158, 11, 0.25)", border: "none", color: "#FF9F68", fontWeight: 900, fontSize: 18, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  −
                </button>
                <input
                  id="checkout-qty"
                  type="number"
                  min={1}
                  max={listing.quantityAvailable}
                  className="qty-step-input"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.max(
                        1,
                        Math.min(
                          listing.quantityAvailable,
                          Number(e.target.value) || 1,
                        ),
                      ),
                    )
                  }
                  style={{ width: 36, height: 34, background: "#121215", border: "none", color: "#ffffff", fontSize: 15, fontWeight: 900, textAlign: "center" }}
                />
                <button
                  type="button"
                  className="qty-step-btn"
                  disabled={quantity >= listing.quantityAvailable}
                  onClick={() =>
                    setQuantity((q) =>
                      Math.min(listing.quantityAvailable, q + 1),
                    )
                  }
                  aria-label="Increase quantity"
                  style={{ background: "rgba(245, 158, 11, 0.25)", border: "none", color: "#FF9F68", fontWeight: 900, fontSize: 18, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  +
                </button>
              </div>
            </div>

            {/* DIGITAL RESTAURANT BILL BREAKDOWN */}
            <div className="checkout-summary-box" style={{ background: "#18181b", padding: 18, borderRadius: 14, border: "1.5px solid rgba(245,158,11,0.35)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", color: "#ffffff" }}>
              <div className="summary-title" style={{ fontSize: 13, fontWeight: 800, color: "#FF9F68", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                FOOD SAVER • ORDER SUMMARY
              </div>
              
              <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, fontWeight: 700, paddingBottom: 8, borderBottom: "1px dashed rgba(255,255,255,0.18)", color: "#ffffff" }}>
                <span>{listing.itemName} × {quantity}</span>
                <span style={{ fontFamily: "monospace", color: "#ffffff" }}>₹{((listing.originalPrice || listing.discountPrice * 2) * quantity).toFixed(2)}</span>
              </div>

              <div style={{ padding: "10px 0", display: "flex", flexDirection: "column", gap: 7, fontSize: 13.5 }}>
                <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1" }}>
                  <span>Subtotal</span>
                  <span style={{ fontFamily: "monospace", color: "#ffffff" }}>₹{((listing.originalPrice || listing.discountPrice * 2) * quantity).toFixed(2)}</span>
                </div>

                <div className="summary-row discount-row" style={{ display: "flex", justifyContent: "space-between", color: "#69C7A8", fontWeight: 700 }}>
                  <span>Discount</span>
                  <span style={{ fontFamily: "monospace" }}>−₹{(((listing.originalPrice || listing.discountPrice * 2) - listing.discountPrice) * quantity).toFixed(2)}</span>
                </div>

                <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1" }}>
                  <span>Platform Fee</span>
                  <span style={{ fontFamily: "monospace", color: "#69C7A8", fontWeight: 700 }}>FREE</span>
                </div>

                <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1" }}>
                  <span>Pickup Fee</span>
                  <span style={{ fontFamily: "monospace", color: "#69C7A8", fontWeight: 700 }}>FREE</span>
                </div>
              </div>

              <div style={{ height: 1, borderTop: "1px dashed rgba(255,255,255,0.18)", margin: "4px 0 10px" }} />

              <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", color: "#69C7A8", fontSize: 13.5, fontWeight: 700 }}>
                <span>Total Savings</span>
                <span style={{ fontFamily: "monospace" }}>−₹{(((listing.originalPrice || listing.discountPrice * 2) - listing.discountPrice) * quantity).toFixed(2)}</span>
              </div>

              <div className="summary-row total-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10 }}>
                <strong style={{ fontSize: 15, textTransform: "uppercase", letterSpacing: 0.5, color: "#ffffff" }}>TOTAL TO PAY</strong>
                <strong style={{ fontSize: 26, color: "#FF9F68", fontFamily: "monospace", fontWeight: 900 }}>
                  ₹{(listing.discountPrice * quantity).toFixed(2)}
                </strong>
              </div>
            </div>

            {/* TRUST BADGE */}
            <div className="checkout-trust-badge" style={{ marginTop: 14, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8A9490", fontWeight: 600 }}>
              <span>🔒 256-bit Encrypted Checkout</span>
              <span>⚡ Instant Verification Receipt</span>
            </div>
          </div>

          <div className="checkout-right-panel">
            <div className="payment-methods-title">Select Payment Method</div>
            <div className="payment-methods">
              {METHODS.map((m) => (
                <PaymentMethodCard
                  key={m.id}
                  id={m.id}
                  icon={m.icon}
                  title={m.title}
                  desc={m.desc}
                  selected={method === m.id}
                  onClick={(id) => {
                    setMethod(id);
                    setStage("details");
                  }}
                />
              ))}
            </div>

            <div className="payment-details">
              <AnimatePresence mode="wait">
                {stage === "details" && method === "upi" && (
                  <UPIPayment
                    key="upi"
                    amount={listing.discountPrice * quantity}
                    onConfirm={handleConfirm}
                  />
                )}

                {stage === "details" && method === "card" && (
                  <CardPayment
                    key="card"
                    amount={listing.discountPrice * quantity}
                    onConfirm={handleConfirm}
                  />
                )}

                {stage === "details" && method === "cod" && (
                  <CashOnDelivery
                    key="cod"
                    amount={listing.discountPrice * quantity}
                    onConfirm={handleConfirm}
                  />
                )}

                {stage === "success" && order && (
                  <OrderSuccess
                    key="success"
                    order={order}
                    onClose={onClose}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
