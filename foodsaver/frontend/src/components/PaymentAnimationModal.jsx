import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

/**
 * FOOD SAVER — PREMIUM PAYMENT ANIMATION & CONFIRMATION MODAL
 * 
 * Implements fintech-grade payment processing, SVG checkmark drawing animations,
 * "Food Saved!" branding badge, error/failure/cancel states, and reduced-motion accessibility.
 */
export default function PaymentAnimationModal({
  open,
  paymentStatus = "PROCESSING", // "PROCESSING" | "VERIFYING" | "SUCCESS" | "FAILED" | "CANCELLED" | "PENDING"
  errorMessage = "",
  amount = 0,
  restaurantName = "Hotel Partner",
  claim = null,
  onClose,
  onRetry,
  onCancelPayment,
  onCheckStatus,
}) {
  const navigate = useNavigate();

  // Internal animation state transitions: 1=Processing, 2=Verifying, 3=Success Checkmark, 4=Confirmed Summary
  const [animStep, setAnimStep] = useState(1);
  const [svgChecked, setSvgChecked] = useState(false);

  useEffect(() => {
    if (!open) {
      setAnimStep(1);
      setSvgChecked(false);
      return;
    }

    if (paymentStatus === "PROCESSING") {
      setAnimStep(1);
      const t = setTimeout(() => {
        setAnimStep(2);
      }, 1000);
      return () => clearTimeout(t);
    } else if (paymentStatus === "SUCCESS") {
      setAnimStep(3);
      const checkTimer = setTimeout(() => {
        setSvgChecked(true);
      }, 100);
      const summaryTimer = setTimeout(() => {
        setAnimStep(4);
      }, 1200);
      return () => {
        clearTimeout(checkTimer);
        clearTimeout(summaryTimer);
      };
    } else if (paymentStatus === "FAILED") {
      setAnimStep(5); // Failure step
    } else if (paymentStatus === "CANCELLED") {
      setAnimStep(6); // Cancelled step
    } else if (paymentStatus === "PENDING") {
      setAnimStep(7); // Pending step
    }
  }, [open, paymentStatus]);

  if (!open) return null;

  const displayOrderToken = claim?.token || `#FS${Math.floor(10000 + Math.random() * 90000)}`;
  const displayItemName = claim?.itemName || "Fresh Surplus Food Bundle";
  const displayQuantity = claim?.quantity || 1;
  const displayPickupWindow = claim?.pickupWindowEnd
    ? `Today until ${claim.pickupWindowEnd}`
    : "Today closing window (6:30 PM - 9:30 PM)";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-label="Payment Processing and Confirmation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(3, 7, 18, 0.88)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      {/* CSS ANIMATION STYLES INJECTED SILENTLY */}
      <style>{`
        @keyframes fsSpinnerRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fsPulseGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.06); }
        }
        @keyframes fsModalScaleIn {
          0% { opacity: 0; transform: scale(0.92) translateY(12px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fsCheckCircleDraw {
          0% { stroke-dashoffset: 200; transform: scale(0.8); }
          100% { stroke-dashoffset: 0; transform: scale(1); }
        }
        @keyframes fsCheckMarkDraw {
          0% { stroke-dashoffset: 60; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes fsRippleExpand {
          0% { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes fsBadgeSlideUp {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fsErrorShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        @keyframes fsProgressBar {
          0% { width: 10%; }
          50% { width: 65%; }
          100% { width: 95%; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, ::before, ::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#24332F",
          borderRadius: 24,
          border:
            animStep === 3 || animStep === 4
              ? "2px solid #69C7A8"
              : animStep === 5
              ? "2px solid #C94C4C"
              : animStep === 6
              ? "1.5px solid #64748b"
              : "1.5px solid #FF9F68",
          padding: "32px 24px",
          textAlign: "center",
          color: "#ffffff",
          boxShadow:
            animStep === 3 || animStep === 4
              ? "0 24px 60px rgba(34, 197, 94, 0.25)"
              : animStep === 5
              ? "0 24px 60px rgba(239, 68, 68, 0.25)"
              : "0 24px 60px rgba(245, 158, 11, 0.2)",
          position: "relative",
          overflow: "hidden",
          animation: animStep === 5 ? "fsErrorShake 0.4s ease" : "fsModalScaleIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* ======================================================== */}
        {/* STEP 1 & 2: PAYMENT PROCESSING & VERIFICATION             */}
        {/* ======================================================== */}
        {(animStep === 1 || animStep === 2) && (
          <div>
            <div style={{ position: "relative", width: 88, height: 88, margin: "0 auto 24px" }}>
              {/* Pulsing Backglow Ring */}
              <div
                style={{
                  position: "absolute",
                  inset: -6,
                  borderRadius: "50%",
                  background: "rgba(245, 158, 11, 0.15)",
                  animation: "fsPulseGlow 1.8s ease-in-out infinite",
                }}
              />
              {/* Rotating Spinner Ring */}
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  border: "4px solid rgba(245, 158, 11, 0.15)",
                  borderTopColor: "#FF9F68",
                  borderRightColor: "#fbbf24",
                  animation: "fsSpinnerRotate 0.9s linear infinite",
                }}
              />
              {/* Center Lock / Card Icon */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                }}
              >
                {animStep === 1 ? "💳" : "🔒"}
              </div>
            </div>

            <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.3px" }}>
              {animStep === 1 ? "Processing Payment..." : "Verifying Payment..."}
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#8A9490", lineHeight: 1.5 }}>
              Please wait while we securely authorize{" "}
              <strong style={{ color: "#FF9F68" }}>₹{amount.toFixed(2)}</strong> with {restaurantName}.
            </p>

            {/* Animated Progress Bar */}
            <div
              style={{
                width: "100%",
                height: 6,
                background: "rgba(255, 255, 255, 0.08)",
                borderRadius: 99,
                overflow: "hidden",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #FF9F68, #fbbf24)",
                  borderRadius: 99,
                  animation: "fsProgressBar 2.5s ease-in-out infinite",
                }}
              />
            </div>

            <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600, display: "block" }}>
              ⚠️ Please don't close or refresh this page.
            </span>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3 & 4: PAYMENT SUCCESSFUL & ORDER CONFIRMED          */}
        {/* ======================================================== */}
        {(animStep === 3 || animStep === 4) && (
          <div>
            <div style={{ position: "relative", width: 90, height: 90, margin: "0 auto 16px" }}>
              {/* Outward Expanding Ripple */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "rgba(34, 197, 94, 0.3)",
                  animation: "fsRippleExpand 1.2s cubic-bezier(0, 0.2, 0.8, 1) infinite",
                }}
              />

              {/* Pure SVG Animated Checkmark Circle */}
              <svg width="90" height="90" viewBox="0 0 90 90" style={{ display: "block" }}>
                <circle
                  cx="45"
                  cy="45"
                  r="40"
                  fill="url(#greenGrad)"
                  stroke="#69C7A8"
                  strokeWidth="3"
                  style={{
                    strokeDasharray: 260,
                    strokeDashoffset: svgChecked ? 0 : 260,
                    transition: "stroke-dashoffset 0.6s ease",
                  }}
                />
                <path
                  d="M26 46 L38 58 L64 32"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: 60,
                    strokeDashoffset: svgChecked ? 0 : 60,
                    transition: "stroke-dashoffset 0.5s ease 0.3s",
                  }}
                />
                <defs>
                  <linearGradient id="greenGrad" x1="0" y1="0" x2="90" y2="90">
                    <stop offset="0%" stopColor="#145C52" />
                    <stop offset="100%" stopColor="#69C7A8" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <span
              style={{
                fontSize: 12.5,
                fontWeight: 900,
                color: "#69C7A8",
                textTransform: "uppercase",
                letterSpacing: 1.2,
                display: "block",
                marginBottom: 4,
              }}
            >
              Payment Successful ✓
            </span>

            <h2 style={{ margin: "0 0 12px", fontSize: 24, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.4px" }}>
              Order Confirmed!
            </h2>

            {/* FOOD SAVER SPECIFIC BRANDING BADGE */}
            <div
              style={{
                background: "rgba(34, 197, 94, 0.12)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                borderRadius: 14,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 20,
                animation: "fsBadgeSlideUp 0.4s ease 0.2s both",
              }}
            >
              <span style={{ fontSize: 22 }}>🍱</span>
              <div style={{ textAlign: "left" }}>
                <strong style={{ fontSize: 13.5, color: "#4ade80", display: "block", fontWeight: 800 }}>
                  Food Saved!
                </strong>
                <span style={{ fontSize: 11.5, color: "#cbd5e1", fontWeight: 500 }}>
                  Your order directly helps reduce surplus food waste.
                </span>
              </div>
            </div>

            {/* REAL ORDER RECEIPT SUMMARY CARD */}
            <div
              style={{
                background: "#2D3B37",
                borderRadius: 16,
                padding: 18,
                textAlign: "left",
                marginBottom: 24,
                border: "1px solid #66736F",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                fontSize: 13.5,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#8A9490" }}>Order ID</span>
                <strong style={{ color: "#FF9F68", fontFamily: "monospace", fontSize: 14, fontWeight: 800 }}>
                  {displayOrderToken}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#8A9490" }}>Item</span>
                <strong style={{ color: "#ffffff", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {displayQuantity} × {displayItemName}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#8A9490" }}>Amount Paid</span>
                <strong style={{ color: "#69C7A8", fontSize: 16, fontWeight: 900 }}>
                  ₹{amount > 0 ? amount.toFixed(2) : (claim?.pricePaid || 0).toFixed(2)}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#8A9490" }}>Pickup Counter</span>
                <strong style={{ color: "#ffffff" }}>{restaurantName}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#8A9490" }}>Pickup Window</span>
                <strong style={{ color: "#fbbf24", fontSize: 12.5 }}>{displayPickupWindow}</strong>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="btn btn-amber"
                onClick={() => {
                  onClose?.();
                  navigate("/customer/pickups");
                }}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  fontSize: 14.5,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  borderRadius: 12,
                  boxShadow: "0 6px 20px rgba(245, 158, 11, 0.4)",
                  cursor: "pointer",
                }}
              >
                View My Pickup Tokens 🛍️ →
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 5: PAYMENT FAILURE                                  */}
        {/* ======================================================== */}
        {animStep === 5 && (
          <div>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                border: "2px solid #C94C4C",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                color: "#C94C4C",
                fontSize: 36,
                fontWeight: 900,
                boxShadow: "0 8px 24px rgba(239, 68, 68, 0.3)",
              }}
            >
              ✕
            </div>

            <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "#C94C4C" }}>
              Payment Failed
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#cbd5e1", lineHeight: 1.5 }}>
              {errorMessage || "We couldn't complete your payment. Please verify your details or try again."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="btn btn-amber"
                onClick={() => {
                  onRetry?.();
                }}
                style={{
                  width: "100%",
                  padding: "13px",
                  fontSize: 14,
                  fontWeight: 800,
                  borderRadius: 12,
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  onClose?.();
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "#cbd5e1",
                  borderColor: "#66736F",
                  borderRadius: 12,
                  cursor: "pointer",
                }}
              >
                Choose Another Payment Method
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 6: PAYMENT CANCELLED                                */}
        {/* ======================================================== */}
        {animStep === 6 && (
          <div>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(100, 116, 139, 0.2)",
                border: "2px solid #64748b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: 32,
              }}
            >
              🚫
            </div>

            <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "#ffffff" }}>
              Payment Cancelled
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#8A9490", lineHeight: 1.5 }}>
              Your payment was cancelled. Your order has not been confirmed.
            </p>

            <button
              type="button"
              className="btn btn-amber"
              onClick={() => {
                onCancelPayment?.() || onClose?.();
              }}
              style={{
                width: "100%",
                padding: "13px",
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              Return to Checkout
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 7: PAYMENT PENDING VERIFICATION                    */}
        {/* ======================================================== */}
        {animStep === 7 && (
          <div>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(245, 158, 11, 0.15)",
                border: "2px solid #FF9F68",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: 32,
                animation: "fsSpinnerRotate 2s linear infinite",
              }}
            >
              ◌
            </div>

            <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "#FF9F68" }}>
              Payment Verification
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#cbd5e1", lineHeight: 1.5 }}>
              We're waiting for confirmation from the payment provider.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="btn btn-amber"
                onClick={() => {
                  onCheckStatus?.();
                }}
                style={{
                  width: "100%",
                  padding: "13px",
                  fontSize: 14,
                  fontWeight: 800,
                  borderRadius: 12,
                  cursor: "pointer",
                }}
              >
                Check Payment Status
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  onClose?.();
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "#cbd5e1",
                  borderColor: "#66736F",
                  borderRadius: 12,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
