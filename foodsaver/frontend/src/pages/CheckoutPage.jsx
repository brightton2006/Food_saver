import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../lib/cart.jsx";
import { useSession } from "../lib/session.jsx";
import { api } from "../lib/api.js";
import { addMyClaim } from "../lib/myClaims.js";
import PaymentAnimationModal from "../components/PaymentAnimationModal.jsx";
import PaymentMethodCard from "../components/PaymentMethodCard.jsx";
import CardPayment from "../components/CardPayment.jsx";
import UPIPayment from "../components/UPIPayment.jsx";

import { useToast } from "../components/ToastProvider.jsx";

const PAYMENT_METHODS = [
  { id: "upi", title: "UPI Payment", desc: "Google Pay, PhonePe, Paytm or BHIM", icon: "📱" },
  { id: "card", title: "Credit / Debit Card", desc: "Visa, Mastercard, RuPay, Amex", icon: "💳" },
  { id: "cod", title: "Cash on Delivery", desc: "Pay cash at pickup counter", icon: "💵" },
  { id: "wallet", title: "Digital Wallet", desc: "Paytm Wallet, Mobikwik, Amazon Pay", icon: "👛" },
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useSession();
  const { cartItems, subtotal, clearCart } = useCart();
  const toast = useToast();

  // Retrieve cart items from route location state or cart context
  const items = location.state?.cartItems || cartItems;
  const restaurantName = items[0]?.listing?.hotelName || items[0]?.listing?.merchantName || "Partner Kitchen";

  const [selectedMethod, setSelectedMethod] = useState("upi");
  const [address, setAddress] = useState("Home • 14/B Gandhi Road, Kovilpatti, Tamil Nadu");
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const deliveryFee = items && items.length > 0 ? 30 : 0;
  
  // Calculate genuine original total and discounted subtotal from DB fields
  const originalSubtotal = (items || []).reduce((sum, item) => {
    const orig = Number(item.listing?.originalPrice || item.listing?.original_price || item.listing?.discountPrice || 0);
    return sum + orig * item.quantity;
  }, 0);

  const calculatedSubtotal = (items || []).reduce((sum, item) => {
    const price = Number(item.listing?.discountPrice || item.listing?.discountedPrice || item.listing?.originalPrice || 0);
    return sum + price * item.quantity;
  }, 0);

  const discount = Math.max(0, originalSubtotal - calculatedSubtotal);
  const grandTotal = items && items.length > 0 ? Math.max(0, calculatedSubtotal + deliveryFee) : 0;
  const savingsPct = originalSubtotal > 0 ? Math.round((discount / originalSubtotal) * 100) : 0;

  const [paymentStatus, setPaymentStatus] = useState("PROCESSING"); // "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED" | "PENDING"
  const [errorMessage, setErrorMessage] = useState("");
  const [lastCreatedClaim, setLastCreatedClaim] = useState(null);

  async function handlePayNow(methodPayload = null) {
    if (isProcessingPayment) return;
    setIsProcessingPayment(true);
    setPaymentStatus("PROCESSING");
    setErrorMessage("");

    try {
      const custId = session?.userId || session?.id || session?.username || session?.email || "guest";
      const custName = session?.name || "Resident Customer";
      const custUsername = session?.username || "resident_customer";

      let primaryClaim = null;

      for (const item of items) {
        const listingId = item.listing?.id || item.listing?.listing_id;
        if (listingId) {
          const res = await api.claimListing(listingId, {
            customerId: custId,
            customerName: custName,
            customerUsername: custUsername,
            quantity: item.quantity || 1,
            paymentMethod: methodPayload?.method || selectedMethod,
          });

          if (res && res.claim) {
            primaryClaim = res.claim;
            addMyClaim(res.claim, custId);
          }
        }
      }

      setLastCreatedClaim(primaryClaim);
      setPaymentStatus("SUCCESS");
      toast.success("Order Placed Successfully! 📦", `Token ${primaryClaim?.token || '#FS'} confirmed. Ready for pickup at ${restaurantName}.`);
      clearCart();
    } catch (err) {
      console.error("Payment authorization error:", err);
      setErrorMessage(err.message || "Payment authorization failed. Please check payment credentials.");
      setPaymentStatus("FAILED");
      toast.error("Payment Failed", err.message || "Payment authorization failed.");
    }
  }

  if (!items || items.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0f19", color: "#ffffff", padding: "60px 16px" }}>
        <div style={{ maxWidth: 540, margin: "0 auto", textAlign: "center", background: "#2D3B37", borderRadius: 20, padding: "40px 24px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🛒</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 10, color: "#ffffff" }}>Your Cart is Empty</h2>
          <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
            You do not have any surplus food items in your order. Explore verified local partner kitchens and rescue delicious meals today!
          </p>
          <button
            type="button"
            onClick={() => navigate("/listings")}
            style={{
              padding: "14px 28px",
              fontSize: 14,
              fontWeight: 800,
              borderRadius: 12,
              border: "none",
              background: "#FF9F68",
              color: "#24332F",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(255,159,104,0.4)"
            }}
          >
            Browse Verified Hotels & Menus →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f19", color: "#ffffff", padding: "32px 16px 60px" }}>
      <div className="container" style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              background: "#2D3B37",
              color: "#ffffff",
              border: "1px solid #66736F",
              borderRadius: 10,
              padding: "8px 14px",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            ← Back
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#ffffff" }}>
              Order Checkout
            </h1>
            <span style={{ fontSize: 13, color: "#8A9490" }}>
              Restaurant: <strong style={{ color: "#FF9F68" }}>{restaurantName}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          {/* LEFT COLUMN: ADDRESS & PAYMENT METHODS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* DELIVERY ADDRESS CARD */}
            <div className="card" style={{ background: "#2D3B37", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🏠</span>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#ffffff" }}>
                    Delivery Address
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingAddress(!isEditingAddress)}
                  style={{ background: "none", border: "none", color: "#FF9F68", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
                >
                  {isEditingAddress ? "Done" : "[Change Address]"}
                </button>
              </div>

              {isEditingAddress ? (
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #FF9F68",
                    background: "#24332F",
                    color: "#ffffff",
                    fontSize: 13.5,
                  }}
                />
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: "#cbd5e1", lineHeight: 1.5 }}>{address}</p>
              )}
            </div>

            {/* PAYMENT METHOD SELECTOR CARD */}
            <div className="card" style={{ background: "#2D3B37", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,0.1)" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 800, color: "#ffffff" }}>
                Select Payment Method
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {PAYMENT_METHODS.map((m) => (
                  <PaymentMethodCard
                    key={m.id}
                    id={m.id}
                    icon={m.icon}
                    title={m.title}
                    desc={m.desc}
                    selected={selectedMethod === m.id}
                    onClick={(id) => setSelectedMethod(id)}
                  />
                ))}
              </div>

              {/* DYNAMIC FORM INLINE FOR CARD OR UPI */}
              <AnimatePresence mode="wait">
                {selectedMethod === "card" && (
                  <motion.div
                    key="card-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <CardPayment amount={grandTotal} onConfirm={handlePayNow} disabled={isProcessingPayment} />
                  </motion.div>
                )}
                {selectedMethod === "upi" && (
                  <motion.div
                    key="upi-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <UPIPayment amount={grandTotal} onConfirm={handlePayNow} disabled={isProcessingPayment} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* RIGHT COLUMN: ORDER SUMMARY */}
          <div>
            <div className="card" style={{ background: "#2D3B37", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,0.1)", position: "sticky", top: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 800, color: "#ffffff" }}>
                Order Summary ({items.length} {items.length === 1 ? "item" : "items"})
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5 }}>
                    <div>
                      <strong style={{ color: "#ffffff" }}>{item.listing?.itemName || "Food Item"}</strong>
                      <span style={{ display: "block", color: "#8A9490", fontSize: 12 }}>Qty: {item.quantity}</span>
                    </div>
                    <span style={{ color: "#FF9F68", fontWeight: 700, fontFamily: "monospace" }}>
                      ₹{((item.listing?.discountPrice || 100) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* DISCOUNT IMPACT HIGHLIGHT BADGE */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  background: "rgba(34, 197, 94, 0.12)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  margin: "12px 0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🏷️</span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: "#4ade80" }}>
                    Surplus Savings Discount
                  </span>
                </div>
                <strong style={{ color: "#69C7A8", fontSize: 13, fontWeight: 900 }}>
                  SAVE ₹{discount} ({savingsPct}% OFF)
                </strong>
              </motion.div>

              <div style={{ height: 1, borderTop: "1px dashed rgba(255,255,255,0.1)", margin: "12px 0" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5, color: "#cbd5e1" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Subtotal</span>
                  <span style={{ fontFamily: "monospace" }}>₹{calculatedSubtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Delivery Fee</span>
                  <span style={{ fontFamily: "monospace" }}>₹{deliveryFee.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#69C7A8", fontWeight: 700 }}>
                  <span>Discount</span>
                  <span style={{ fontFamily: "monospace" }}>-₹{discount.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ height: 1, borderTop: "1px dashed rgba(255,255,255,0.1)", margin: "12px 0" }} />

              {/* GRAND TOTAL */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
                <strong style={{ fontSize: 16, textTransform: "uppercase", color: "#ffffff" }}>Grand Total</strong>
                <strong style={{ fontSize: 28, color: "#FF9F68", fontFamily: "monospace", fontWeight: 900 }}>
                  ₹{grandTotal.toFixed(2)}
                </strong>
              </div>

              {/* PAY NOW CTA BUTTON */}
              <motion.button
                type="button"
                whileHover={{ scale: isProcessingPayment ? 1 : 1.01 }}
                whileTap={{ scale: isProcessingPayment ? 1 : 0.98 }}
                disabled={isProcessingPayment}
                onClick={() => handlePayNow()}
                style={{
                  width: "100%",
                  minHeight: 52,
                  padding: 16,
                  fontSize: 15,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  borderRadius: 12,
                  background: isProcessingPayment
                    ? "rgba(245, 158, 11, 0.7)"
                    : "linear-gradient(135deg, #FF9F68, #FF9F68)",
                  color: "#24332F",
                  boxShadow: "0 6px 20px rgba(245, 158, 11, 0.4)",
                  cursor: isProcessingPayment ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  border: "none",
                }}
              >
                {isProcessingPayment ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 16, height: 16, border: "2px solid #24332F", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "fsSpinnerRotate 0.8s linear infinite" }} />
                    <span>Processing Payment...</span>
                  </span>
                ) : (
                  <span>PAY NOW (₹{grandTotal.toFixed(2)}) →</span>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* PREMIUM PAYMENT ANIMATION & STATUS MODAL */}
      {isProcessingPayment && (
        <PaymentAnimationModal
          open={isProcessingPayment}
          paymentStatus={paymentStatus}
          errorMessage={errorMessage}
          amount={grandTotal}
          restaurantName={restaurantName}
          claim={lastCreatedClaim}
          onClose={() => setIsProcessingPayment(false)}
          onRetry={() => {
            setIsProcessingPayment(false);
            setTimeout(() => handlePayNow(), 150);
          }}
          onCancelPayment={() => {
            setIsProcessingPayment(false);
            setPaymentStatus("CANCELLED");
          }}
        />
      )}
    </div>
  );
}
