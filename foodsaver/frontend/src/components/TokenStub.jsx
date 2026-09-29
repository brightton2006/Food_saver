import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function TokenStub({ claim, onDismissCompletion }) {
  const [qrSrc, setQrSrc] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  useEffect(() => {
    if (!claim?.token) {
      setQrSrc("");
      return;
    }

    // Generate secure QR containing only the token string without sensitive DB data
    QRCode.toDataURL(claim.token, {
      errorCorrectionLevel: "M",
      type: "image/png",
      width: 180,
      margin: 1,
      color: {
        dark: "#1e293b",
        light: "#ffffff",
      },
    })
      .then(setQrSrc)
      .catch(() => setQrSrc(""));
  }, [claim?.token]);

  function handleCopy() {
    if (!claim?.token) return;
    navigator.clipboard?.writeText(claim.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!claim) return null;

  const rawStatus = (claim.status || "").toUpperCase();
  const isCollected = ["COLLECTED", "PICKED_UP", "COMPLETED", "DELIVERED"].includes(rawStatus);
  const isVerified = rawStatus === "TOKEN_VERIFIED" || Boolean(claim.verifiedAt || claim.verified_at);
  const isRerouted = rawStatus === "REROUTED_TO_NGO";

  let statusLabel = "Ready for Pickup";
  let statusBg = "rgba(245, 158, 11, 0.15)";
  let statusColor = "#f59e0b";

  if (isCollected) {
    statusLabel = "✓ Picked Up / Completed";
    statusBg = "rgba(34, 197, 94, 0.15)";
    statusColor = "#22c55e";
  } else if (isVerified) {
    statusLabel = "✓ Token Verified";
    statusBg = "rgba(16, 185, 129, 0.2)";
    statusColor = "#10b981";
  } else if (isRerouted) {
    statusLabel = "🚨 Rescued by NGO";
    statusBg = "rgba(239, 68, 68, 0.15)";
    statusColor = "#ef4444";
  }

  const completedAtFormatted = claim.collectedAt || claim.collected_at
    ? new Date(claim.collectedAt || claim.collected_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const claimedAtFormatted = claim.claimedAt || claim.claimed_at
    ? new Date(claim.claimedAt || claim.claimed_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Recently";

  return (
    <>
      <div
        className="card minimal-compact-token-pass"
        style={{
          padding: "16px 20px",
          borderRadius: 16,
          border: isVerified && !isCollected
            ? "1.5px solid #10b981"
            : isCollected
            ? "1.5px solid #22c55e"
            : "1.5px solid rgba(245, 158, 11, 0.35)",
          background: "var(--card-bg, #182421)",
          boxShadow: isVerified
            ? "0 4px 20px rgba(16, 185, 129, 0.2)"
            : "0 4px 14px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* ROW 1: MERCHANT NAME, DISH NAME & STATUS BADGE */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
            <span style={{ fontSize: 22 }}>🛍️</span>
            <div>
              <strong style={{ fontSize: 16, color: "#ffffff", display: "block" }}>
                {claim.merchantName || "Verified Kitchen"}
              </strong>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>
                {claim.itemName} {claim.quantity > 1 ? `(×${claim.quantity})` : ""}
              </span>
            </div>
          </div>

          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "4px 12px",
              borderRadius: 20,
              background: statusBg,
              color: statusColor,
              border: `1px solid ${statusColor}`,
              whiteSpace: "nowrap",
            }}
          >
            {statusLabel}
          </span>
        </div>

        {/* VERIFICATION STATE BANNER (WHEN VERIFIED AT COUNTER) */}
        {isVerified && !isCollected && (
          <div
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid #10b981",
              borderRadius: 10,
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              color: "#a7f3d0",
            }}
          >
            <span style={{ fontSize: 16 }}>✓</span>
            <span>
              <strong>Token Verified by Merchant!</strong> Handing over food at the counter...
            </span>
          </div>
        )}

        {/* ROW 2: SECURE PICKUP TOKEN DISPLAY & ACTIONS */}
        <div
          style={{
            background: "rgba(0,0,0,0.35)",
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block" }}>
              Pickup Token
            </span>
            <strong
              style={{
                fontSize: 22,
                fontFamily: "monospace",
                letterSpacing: 2,
                color: isCollected ? "#86efac" : "var(--amber, #FF9F68)",
              }}
            >
              {claim.token}
            </strong>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCopy}
              style={{ fontSize: 12, padding: "5px 10px", height: "auto" }}
            >
              {copied ? "✓ Copied" : "📋 Copy"}
            </button>

            {qrSrc && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowQr((prev) => !prev)}
                style={{
                  fontSize: 12,
                  padding: "5px 12px",
                  height: "auto",
                  border: showQr ? "1px solid #69C7A8" : undefined,
                  color: showQr ? "#69C7A8" : undefined,
                }}
              >
                {showQr ? "▲ Hide QR" : "📱 Show QR"}
              </button>
            )}

            {isCollected && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowCompletionModal(true)}
                style={{ fontSize: 12, padding: "5px 10px", borderColor: "#22c55e", color: "#22c55e" }}
              >
                🎉 Receipt
              </button>
            )}
          </div>
        </div>

        {/* INSTRUCTION NOTE */}
        {!isCollected && (
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>
            💡 Show either this <strong>Pickup Token</strong> or the <strong>QR code</strong> to the merchant when collecting your food.
          </p>
        )}

        {/* ROW 3: LOCATION & PICKUP WINDOW */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: "#cbd5e1" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span>📍 {claim.address || "Merchant Counter"}</span>
            <span>•</span>
            <span>⏱️ Till {claim.pickupWindowEnd || "22:00"}</span>
          </div>
        </div>

        {/* EXPANDABLE QR CODE CARD */}
        {showQr && qrSrc && (
          <div
            style={{
              padding: 16,
              background: "#ffffff",
              borderRadius: 14,
              textAlign: "center",
              marginTop: 4,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <img
              src={qrSrc}
              alt={`QR Token ${claim.token}`}
              style={{ width: 150, height: 150, margin: "0 auto", display: "block" }}
            />
            <strong style={{ fontSize: 14, color: "#0f172a", display: "block", marginTop: 8, fontFamily: "monospace", letterSpacing: 1.5 }}>
              {claim.token}
            </strong>
            <span style={{ fontSize: 11.5, color: "#64748b", display: "block", marginTop: 2 }}>
              Merchant scans this code to verify pickup instantly
            </span>
          </div>
        )}
      </div>

      {/* 🎉 CUSTOMER ORDER COMPLETED CELEBRATION MODAL */}
      {showCompletionModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCompletionModal(false);
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#182421",
              borderRadius: 20,
              border: "1.5px solid #22c55e",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(34, 197, 94, 0.2)",
              padding: 26,
              textAlign: "center",
              animation: "slideUp 0.3s ease-out",
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
            <h3 style={{ margin: "0 0 6px", fontSize: 22, color: "#ffffff", fontWeight: 900 }}>
              Order Completed!
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#86efac" }}>
              Your FoodSaver order has been successfully picked up.
            </p>

            {/* ORDER DETAILS RECEIPT */}
            <div
              style={{
                background: "rgba(0,0,0,0.35)",
                borderRadius: 14,
                padding: 16,
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                fontSize: 13.5,
                color: "#cbd5e1",
                marginBottom: 20,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Order ID:</span>
                <strong style={{ fontFamily: "monospace", color: "#FF9F68" }}>
                  #{claim.token || claim.id}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Food Item:</span>
                <strong style={{ color: "#ffffff" }}>
                  {claim.itemName} {claim.quantity > 1 ? `(×${claim.quantity})` : ""}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Merchant:</span>
                <strong style={{ color: "#ffffff" }}>{claim.merchantName || "Merchant"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Claimed At:</span>
                <span>{claimedAtFormatted}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Completion Time:</span>
                <strong style={{ color: "#4ade80" }}>{completedAtFormatted}</strong>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-amber"
              style={{ width: "100%", padding: "10px", fontWeight: 800 }}
              onClick={() => setShowCompletionModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
