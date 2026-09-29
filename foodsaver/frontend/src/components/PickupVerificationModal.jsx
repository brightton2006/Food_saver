import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";
import { api } from "../lib/api.js";
import { shakeVariants } from "../lib/animations.js";
import TokenVerification from "./animations/TokenVerification.jsx";
import SuccessAnimation from "./animations/SuccessAnimation.jsx";

/**
 * PickupVerificationModal
 * Secure Merchant-Side Token Verification & Handover Completion
 *
 * Flow:
 * 1. Merchant Enters Token or Scans QR
 * 2. Backend validates:
 *    - Token exists
 *    - Belongs to correct order
 *    - Belongs to this merchant
 *    - Not already used
 *    - In eligible pickup state
 * 3. Successful verification displays:
 *    "✓ Pickup Verified", "Order #...", "Customer Verified"
 * 4. Enables "MARK AS PICKED UP / COMPLETED" button
 * 5. Merchant confirms physical handover -> Status moves to PICKED_UP
 */
export default function PickupVerificationModal({
  isOpen,
  onClose,
  preselectedOrder = null,
  merchantUserId = null,
  onVerified = () => {},
  onCompleted = () => {},
}) {
  const [method, setMethod] = useState("TOKEN"); // "TOKEN" | "QR"
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifResult, setVerifResult] = useState(null); // { success: boolean, order: any, errorType: string, message: string }
  const [completing, setCompleting] = useState(false);
  const [handoverDone, setHandoverDone] = useState(false);

  // QR Scanner refs & state
  const qrScannerRef = useRef(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState(null);

  // Initialize token input if preselected
  useEffect(() => {
    if (preselectedOrder) {
      setTokenInput(preselectedOrder.token || "");
      // If already verified previously, populate result
      if (
        (preselectedOrder.status || "").toUpperCase() === "TOKEN_VERIFIED" ||
        preselectedOrder.isVerified
      ) {
        setVerifResult({
          success: true,
          order: preselectedOrder,
          message: "✓ Pickup Verified: Customer token previously verified.",
        });
      }
    } else {
      setTokenInput("");
      setVerifResult(null);
    }
    setHandoverDone(false);
    setMethod("TOKEN");
  }, [preselectedOrder, isOpen]);

  // Clean up scanner when closing or switching to TOKEN mode
  useEffect(() => {
    if (method !== "QR" || !isOpen) {
      stopScanner();
    }
  }, [method, isOpen]);

  async function startScanner() {
    setScannerError(null);
    try {
      if (qrScannerRef.current) {
        try {
          await qrScannerRef.current.stop();
        } catch (_) {}
      }

      const scanner = new Html5Qrcode("pickup-qr-reader");
      qrScannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleQrScanSuccess(decodedText);
        },
        (errorMessage) => {
          // ignore scan frame errors
        }
      );
      setScannerActive(true);
    } catch (err) {
      console.error("Camera scan start error:", err);
      setScannerError("Camera access failed or permission denied. Please enter the token code manually.");
      setScannerActive(false);
    }
  }

  async function stopScanner() {
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop();
        }
        await qrScannerRef.current.clear();
      } catch (_) {}
      qrScannerRef.current = null;
    }
    setScannerActive(false);
  }

  function handleQrScanSuccess(rawText) {
    if (!rawText) return;
    stopScanner();

    // Parse potential JSON or plain token string
    let extractedToken = rawText.trim();
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && (parsed.token || parsed.claim_token || parsed.t)) {
        extractedToken = parsed.token || parsed.claim_token || parsed.t;
      }
    } catch (_) {
      // It's a plain string like "FS-482917"
    }

    setTokenInput(extractedToken);
    setMethod("TOKEN");
    executeVerification(extractedToken, "QR");
  }

  async function executeVerification(tokenToVerify, verifyMethod = "TOKEN") {
    const clean = String(tokenToVerify || tokenInput).trim().toUpperCase();
    if (!clean) {
      setVerifResult({
        success: false,
        errorType: "EMPTY",
        message: "Please enter the customer pickup token.",
      });
      return;
    }

    setLoading(true);
    setVerifResult(null);

    try {
      const targetOrderId = preselectedOrder?.id || preselectedOrder?.claim_id || undefined;
      const res = await api.verifyPickupToken(clean, targetOrderId, verifyMethod);

      if (res && res.verified) {
        setVerifResult({
          success: true,
          order: res.order,
          message: res.message || "✓ Pickup Verified: Customer verified successfully.",
        });
        onVerified(res.order);
      } else {
        setVerifResult({
          success: false,
          errorType: "INVALID",
          message: "Invalid Pickup Token",
        });
      }
    } catch (err) {
      const errMsg = err.message || "";
      const isAlreadyUsed =
        errMsg.toLowerCase().includes("already been used") ||
        errMsg.toLowerCase().includes("already_used") ||
        err.status === 409;

      if (isAlreadyUsed) {
        setVerifResult({
          success: false,
          errorType: "ALREADY_USED",
          message: "This pickup token has already been used.",
        });
      } else if (errMsg.toLowerCase().includes("another merchant") || err.status === 403) {
        setVerifResult({
          success: false,
          errorType: "FORBIDDEN",
          message: "This pickup token belongs to another merchant.",
        });
      } else {
        setVerifResult({
          success: false,
          errorType: "INVALID",
          message: "Invalid Pickup Token",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmHandover() {
    if (!verifResult?.order) return;
    const orderId = verifResult.order.id || verifResult.order.claim_id || verifResult.order.token;
    setCompleting(true);

    try {
      const res = await api.completeOrderHandover(orderId);
      if (res && (res.completed || res.ok)) {
        setHandoverDone(true);
        onCompleted(res.order || verifResult.order);
      }
    } catch (err) {
      alert(`Handover completion failed: ${err.message}`);
    } finally {
      setCompleting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopScanner();
          onClose();
        }
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#182421",
          borderRadius: 20,
          border: "1.5px solid rgba(105, 199, 168, 0.35)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(105, 199, 168, 0.15)",
          padding: 24,
          position: "relative",
          animation: "fadeIn 0.25s ease-out",
        }}
      >
        {/* CLOSE BUTTON */}
        <button
          type="button"
          onClick={() => {
            stopScanner();
            onClose();
          }}
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            background: "rgba(255, 255, 255, 0.08)",
            border: "none",
            borderRadius: "50%",
            width: 32,
            height: 32,
            color: "#ffffff",
            fontSize: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>

        {/* HEADER */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 24 }}>🛡️</span>
            <h3 style={{ margin: 0, fontSize: 20, color: "#ffffff", fontWeight: 800 }}>
              Verify Customer Pickup
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1" }}>
            Handover is securely locked until the customer's pickup token is verified.
          </p>
        </div>

        {/* HANDOVER COMPLETED STATE */}
        {handoverDone ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <SuccessAnimation
              type="pickup_completed"
              title="✓ Food Successfully Picked Up"
              subtitle={`Order #${verifResult?.order?.token || preselectedOrder?.token} marked as Completed.`}
            />
            <div
              style={{
                marginTop: 16,
                padding: "10px 14px",
                background: "rgba(0, 0, 0, 0.3)",
                borderRadius: 10,
                fontSize: 12.5,
                color: "#cbd5e1",
                marginBottom: 16,
              }}
            >
              Customer: <strong>{verifResult?.order?.customerName || "Customer"}</strong> • Status:{" "}
              <span style={{ color: "#4ade80", fontWeight: 700 }}>COMPLETED</span>
            </div>
            <button
              type="button"
              className="btn btn-amber"
              style={{ width: "100%", padding: "11px 16px", fontWeight: 800 }}
              onClick={onClose}
            >
              Done / Close
            </button>
          </div>
        ) : (
          <>
            {/* METHOD TABS */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 18,
                background: "rgba(0,0,0,0.25)",
                padding: 4,
                borderRadius: 12,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  stopScanner();
                  setMethod("TOKEN");
                }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: method === "TOKEN" ? "#69C7A8" : "transparent",
                  color: method === "TOKEN" ? "#0f172a" : "#cbd5e1",
                  transition: "all 0.2s",
                }}
              >
                Option 1 — Enter Token
              </button>
              <button
                type="button"
                onClick={() => {
                  setMethod("QR");
                  startScanner();
                }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: method === "QR" ? "#69C7A8" : "transparent",
                  color: method === "QR" ? "#0f172a" : "#cbd5e1",
                  transition: "all 0.2s",
                }}
              >
                Option 2 — Scan QR
              </button>
            </div>

            {/* TAB CONTENT: ENTER TOKEN */}
            {method === "TOKEN" && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#cbd5e1",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}
                >
                  Enter Customer Pickup Token
                </label>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <input
                    type="text"
                    placeholder="FS-482917"
                    value={tokenInput}
                    onChange={(e) => {
                      setTokenInput(e.target.value.toUpperCase());
                      setVerifResult(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        executeVerification(tokenInput, "TOKEN");
                      }
                    }}
                    className="mono"
                    style={{
                      flex: 1,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1.5px solid #4b5563",
                      background: "#111827",
                      color: "#FF9F68",
                      fontSize: 18,
                      fontWeight: 800,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-amber"
                    disabled={loading || !tokenInput.trim()}
                    onClick={() => executeVerification(tokenInput, "TOKEN")}
                    style={{
                      padding: "0 20px",
                      fontSize: 14,
                      fontWeight: 800,
                      letterSpacing: 0.5,
                    }}
                  >
                    {loading ? "Verifying..." : "VERIFY"}
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: SCAN QR */}
            {method === "QR" && (
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <div
                  id="pickup-qr-reader"
                  style={{
                    width: "100%",
                    maxWidth: 280,
                    margin: "0 auto",
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "2px solid #69C7A8",
                    background: "#000",
                    minHeight: 220,
                  }}
                />
                {scannerError && (
                  <p style={{ color: "#ef4444", fontSize: 12.5, marginTop: 8 }}>{scannerError}</p>
                )}
                <p style={{ fontSize: 12, color: "#8A9490", marginTop: 8 }}>
                  Position the customer's order QR code inside the frame to verify automatically.
                </p>
              </div>
            )}

            {/* VERIFYING SPINNER STATE */}
            {loading && (
              <div style={{ marginBottom: 16 }}>
                <TokenVerification state="VERIFYING" token={tokenInput} />
              </div>
            )}

            {/* ERROR DISPLAY WITH SHAKE ANIMATION */}
            {verifResult && !verifResult.success && !loading && (
              <motion.div
                variants={shakeVariants}
                animate="shake"
                key={verifResult.message + tokenInput}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1.5px solid #ef4444",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 22 }}>⚠️</span>
                <div>
                  <strong style={{ fontSize: 14, color: "#fca5a5", display: "block" }}>
                    {verifResult.message}
                  </strong>
                  <span style={{ fontSize: 12, color: "#cbd5e1" }}>
                    {verifResult.errorType === "ALREADY_USED"
                      ? "This token has already been fulfilled and cannot be reused."
                      : "Order status remains unchanged. Please check the pickup token."}
                  </span>
                </div>
              </motion.div>
            )}

            {/* SUCCESS TOKEN VERIFIED ANIMATION */}
            {verifResult && verifResult.success && !loading && (
              <div style={{ marginBottom: 16 }}>
                <TokenVerification
                  state="TOKEN_VERIFIED"
                  token={verifResult.order?.token || verifResult.order?.id}
                  itemName={verifResult.order?.itemName}
                  customerName={verifResult.order?.customerName}
                  onConfirmHandover={handleConfirmHandover}
                  isCompleting={completing}
                />
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  stopScanner();
                  onClose();
                }}
                style={{ flex: 1, padding: "11px", fontSize: 13.5 }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-amber"
                disabled={!verifResult?.success || completing}
                onClick={handleConfirmHandover}
                style={{
                  flex: 2,
                  padding: "11px",
                  fontSize: 14,
                  fontWeight: 900,
                  letterSpacing: 0.5,
                  background: verifResult?.success ? "#22c55e" : "#4b5563",
                  borderColor: verifResult?.success ? "#22c55e" : "#4b5563",
                  color: "#ffffff",
                  cursor: verifResult?.success ? "pointer" : "not-allowed",
                  boxShadow: verifResult?.success ? "0 0 15px rgba(34, 197, 94, 0.4)" : "none",
                }}
              >
                {completing ? "Confirming Handover..." : "MARK AS PICKED UP / COMPLETED"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
