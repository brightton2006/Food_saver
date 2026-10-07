import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "../lib/session.jsx";
import { api } from "../lib/api.js";
import { socket } from "../lib/socket.js";
import PickupVerificationModal from "../components/PickupVerificationModal.jsx";
import { useToast } from "../components/ToastProvider.jsx";

export default function MerchantCounter() {
  const { session } = useSession();
  const toast = useToast();
  const [tokenInput, setTokenInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null); // { success, order, errorType, message }
  const [completingId, setCompletingId] = useState(null);
  const [queue, setQueue] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalOrder, setModalOrder] = useState(null);

  const merchantIdentifier =
    session?.merchantId ||
    session?.userId ||
    session?.hotelName ||
    session?.name ||
    session?.username ||
    session?.email ||
    "all";

  const matchesSession = useCallback(
    (name) => {
      if (!name) return true;
      if (!session) return true;
      const q = String(name).trim().toLowerCase();
      const sName = String(session.name || "").trim().toLowerCase();
      const sHotel = String(session.hotelName || "").trim().toLowerCase();
      const sUser = String(session.username || "").trim().toLowerCase();
      const sEmail = String(session.email || "").trim().toLowerCase();
      const sId = String(session.userId || session.merchantId || "").trim().toLowerCase();
      if (sUser === "admin" || sId === "admin" || (!sName && !sHotel)) return true;
      return (
        q === sName ||
        q === sHotel ||
        q === sUser ||
        q === sEmail ||
        q === sId ||
        (sHotel.length > 2 && (sHotel.includes(q) || q.includes(sHotel))) ||
        (sName.length > 2 && (sName.includes(q) || q.includes(sName)))
      );
    },
    [session]
  );

  const loadQueue = useCallback(async () => {
    try {
      const data = await api.getMerchantClaims(merchantIdentifier || "all");
      setQueue(data.claims || []);
    } catch {
      // ignore
    }
  }, [merchantIdentifier]);

  useEffect(() => {
    loadQueue();

    const handleClaimCreated = (newClaim) => {
      if (matchesSession(newClaim.merchantName)) {
        setQueue((prev) => {
          const exists = prev.some((c) => c.token === newClaim.token);
          if (exists) return prev.map((c) => (c.token === newClaim.token ? newClaim : c));
          return [newClaim, ...prev];
        });
      }
    };

    const handleClaimUpdated = (updated) => {
      setQueue((prev) =>
        prev.map((c) => (c.token === updated.token || c.id === updated.id ? { ...c, ...updated } : c))
      );
      if (verificationResult?.order?.token === updated.token) {
        setVerificationResult((prev) => (prev ? { ...prev, order: { ...prev.order, ...updated } } : null));
      }
    };

    const handleTokenVerified = (data) => {
      setQueue((prev) =>
        prev.map((c) =>
          c.token === data.token || c.id === data.orderId
            ? { ...c, status: "TOKEN_VERIFIED", isVerified: true, ...data.order }
            : c
        )
      );
    };

    const handleOrderCompleted = (data) => {
      setQueue((prev) =>
        prev.map((c) =>
          c.token === data.token || c.id === data.orderId
            ? { ...c, status: "PICKED_UP", collectedAt: new Date().toISOString(), ...data.order }
            : c
        )
      );
    };

    socket.on("claim:created", handleClaimCreated);
    socket.on("claim:updated", handleClaimUpdated);
    socket.on("order:token_verified", handleTokenVerified);
    socket.on("order:completed", handleOrderCompleted);

    return () => {
      socket.off("claim:created", handleClaimCreated);
      socket.off("claim:updated", handleClaimUpdated);
      socket.off("order:token_verified", handleTokenVerified);
      socket.off("order:completed", handleOrderCompleted);
    };
  }, [loadQueue, matchesSession, verificationResult]);

  // Option 1 — Verify Token from manual text input
  const handleVerifyToken = async (e) => {
    if (e) e.preventDefault();
    const clean = tokenInput.trim().toUpperCase();
    if (!clean) return;

    setVerifying(true);
    setVerificationResult(null);

    try {
      const res = await api.verifyPickupToken(clean, undefined, "TOKEN");
      if (res && res.verified) {
        setVerificationResult({
          success: true,
          order: res.order,
          message: res.message || "✓ Pickup Verified: Customer verified successfully.",
        });
        toast.success("Pickup Token Verified! ✅", `Token ${clean} verified. Handover ready.`);
        loadQueue();
      } else {
        setVerificationResult({
          success: false,
          errorType: "INVALID",
          message: "Invalid Pickup Token",
        });
        toast.error("Verification Failed", "Invalid Pickup Token");
      }
    } catch (err) {
      const errMsg = err.message || "";
      let msg = "Invalid Pickup Token";
      if (errMsg.toLowerCase().includes("already been used") || err.status === 409) {
        msg = "This pickup token has already been used.";
      } else if (errMsg.toLowerCase().includes("another merchant") || err.status === 403) {
        msg = "This pickup token belongs to another merchant.";
      }
      setVerificationResult({
        success: false,
        errorType: "INVALID",
        message: msg,
      });
      toast.error("Token Error", msg);
    } finally {
      setVerifying(false);
    }
  };

  // Complete handover only after verification
  const handleCompleteHandover = async (orderId) => {
    setCompletingId(orderId);
    try {
      const res = await api.completeOrderHandover(orderId);
      if (res && (res.completed || res.ok)) {
        setVerificationResult(null);
        setTokenInput("");
        toast.ready("Order Handed Over! 🛍️", "Customer pickup completed successfully.");
        loadQueue();
      }
    } catch (err) {
      toast.error("Handover Failed", err.message);
    } finally {
      setCompletingId(null);
    }
  };

  const handleRerouteNgo = async (tok) => {
    if (!window.confirm("Reroute this unclaimed food package to rescue NGO?")) return;
    try {
      const data = await api.rerouteToNgo(tok);
      setQueue((prev) => prev.map((c) => (c.token === tok ? data.claim : c)));
      toast.info("Rerouted to NGO 🚚", "Surplus package dispatched for rescue.");
      loadQueue();
    } catch (err) {
      toast.error("Reroute Failed", err.message);
    }
  };

  const pending = queue.filter(
    (c) =>
      c.status === "pending" ||
      c.status === "ready" ||
      c.status === "READY_FOR_PICKUP" ||
      c.status === "TOKEN_VERIFIED"
  );
  const completed = queue.filter(
    (c) =>
      c.status === "collected" ||
      c.status === "PICKED_UP" ||
      c.status === "COMPLETED" ||
      c.status === "DELIVERED"
  );
  const rerouted = queue.filter((c) => c.status === "rerouted_to_ngo");

  return (
    <div className="app-main">
      <div className="section-head" style={{ marginTop: 0 }}>
        <h2>Merchant Counter Pickup Verification</h2>
        <span className="count">{pending.length} pending pickup</span>
      </div>

      {/* VERIFY PICKUP SECTION */}
      <div
        className="card"
        style={{
          padding: 24,
          borderRadius: 18,
          marginBottom: 24,
          border: "1.5px solid rgba(105, 199, 168, 0.4)",
          background: "#182421",
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 19, color: "#ffffff", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              🛡️ Verify Pickup
            </h3>
            <span style={{ fontSize: 13, color: "#cbd5e1" }}>
              Validate customer token before handing over food packages.
            </span>
          </div>

          {/* OPTION 2 — SCAN QR BUTTON */}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setModalOrder(null);
              setModalOpen(true);
            }}
            style={{
              padding: "9px 16px",
              fontSize: 13.5,
              fontWeight: 800,
              borderColor: "#69C7A8",
              color: "#69C7A8",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            📷 Scan Customer QR
          </button>
        </div>

        {/* OPTION 1 — ENTER TOKEN INPUT FORM */}
        <form onSubmit={handleVerifyToken}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 700,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Option 1 — Enter Customer Pickup Token
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="[ FS-482917 ]"
              value={tokenInput}
              onChange={(e) => {
                setTokenInput(e.target.value.toUpperCase());
                setVerificationResult(null);
              }}
              className="mono"
              style={{
                flex: "1 1 240px",
                padding: "12px 16px",
                borderRadius: 10,
                border: "1.5px solid #4b5563",
                background: "#0f172a",
                color: "#FF9F68",
                fontSize: 17,
                fontWeight: 800,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            />
            <button
              className="btn btn-amber"
              type="submit"
              disabled={verifying || !tokenInput.trim()}
              style={{
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: 1,
              }}
            >
              {verifying ? "VERIFYING..." : "VERIFY"}
            </button>
          </div>
        </form>

        {/* INVALID / ALREADY USED TOKEN FEEDBACK */}
        {verificationResult && !verificationResult.success && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 12,
              background: "rgba(239, 68, 68, 0.15)",
              border: "1.5px solid #ef4444",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <strong style={{ fontSize: 14.5, color: "#fca5a5", display: "block" }}>
                {verificationResult.message}
              </strong>
              <span style={{ fontSize: 12.5, color: "#cbd5e1" }}>
                {verificationResult.errorType === "ALREADY_USED"
                  ? "This pickup token has already been used and cannot be claimed again."
                  : "Order status remains unchanged. Please check token spelling and try again."}
              </span>
            </div>
          </div>
        )}

        {/* SUCCESSFUL VERIFICATION ANIMATION CARD */}
        {verificationResult && verificationResult.success && (
          <div
            style={{
              marginTop: 18,
              padding: 20,
              borderRadius: 16,
              background: "rgba(34, 197, 94, 0.14)",
              border: "2px solid #22c55e",
              boxShadow: "0 10px 25px rgba(34, 197, 94, 0.2)",
              animation: "slideUp 0.3s ease-out",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "#22c55e",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    fontWeight: 900,
                    boxShadow: "0 0 16px rgba(34, 197, 94, 0.4)",
                  }}
                >
                  ✓
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 18, color: "#ffffff", fontWeight: 900 }}>
                    ✓ Pickup Verified
                  </h4>
                  <div style={{ fontSize: 13, color: "#86efac", fontWeight: 700 }}>
                    Order #{verificationResult.order?.token || verificationResult.order?.id} • Customer Verified
                  </div>
                </div>
              </div>

              {/* HANDOVER CONFIRM BUTTON */}
              <button
                type="button"
                className="btn btn-amber"
                onClick={() =>
                  handleCompleteHandover(
                    verificationResult.order?.id || verificationResult.order?.token
                  )
                }
                disabled={completingId === (verificationResult.order?.id || verificationResult.order?.token)}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 900,
                  background: "#22c55e",
                  borderColor: "#22c55e",
                  color: "#ffffff",
                  boxShadow: "0 0 16px rgba(34, 197, 94, 0.35)",
                }}
              >
                {completingId ? "Processing..." : "MARK AS PICKED UP / COMPLETED"}
              </button>
            </div>

            <div
              style={{
                marginTop: 14,
                padding: "10px 14px",
                background: "rgba(0,0,0,0.3)",
                borderRadius: 10,
                fontSize: 13,
                color: "#cbd5e1",
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <span>
                🍽️ <strong>{verificationResult.order?.itemName}</strong> × {verificationResult.order?.quantity || 1}
              </span>
              <span>
                👤 Buyer: <strong>{verificationResult.order?.customerName || "Customer"}</strong>
              </span>
              <span style={{ color: "#4ade80", fontWeight: 700 }}>
                Status: TOKEN_VERIFIED → Ready for physical handover
              </span>
            </div>
          </div>
        )}
      </div>

      {/* PENDING PICKUPS QUEUE */}
      <div className="section-head">
        <h2>Pending Pickups</h2>
        <span className="count">{pending.length}</span>
      </div>

      <div className="card" style={{ padding: 10, borderRadius: 16, marginBottom: 28 }}>
        {pending.length === 0 && (
          <div className="empty-state" style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
            <span style={{ fontSize: 32, display: "block", marginBottom: 6 }}>📦</span>
            <p style={{ margin: 0, fontSize: 14 }}>No pending pickups right now.</p>
          </div>
        )}

        {pending.map((c) => {
          const isVerified = (c.status || "").toUpperCase() === "TOKEN_VERIFIED" || c.isVerified;
          return (
            <div
              key={c.token}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 18px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                flexWrap: "wrap",
                gap: 10,
                background: isVerified ? "rgba(16, 185, 129, 0.08)" : "transparent",
                borderRadius: 10,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    className="mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 900,
                      color: "#FF9F68",
                      background: "rgba(255, 159, 104, 0.15)",
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    Order #{c.token}
                  </span>
                  <strong style={{ fontSize: 15, color: "#ffffff" }}>
                    {c.itemName} × {c.quantity || 1}
                  </strong>
                </div>
                <div style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 4 }}>
                  Customer: <strong style={{ color: "#cbd5e1" }}>{c.customerName || "Customer"}</strong> • Till {c.pickupWindowEnd || "22:00"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {isVerified ? (
                  <>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#22c55e",
                        background: "rgba(34, 197, 94, 0.15)",
                        padding: "6px 12px",
                        borderRadius: 20,
                        border: "1px solid #22c55e",
                      }}
                    >
                      ✓ VERIFIED
                    </span>
                    <button
                      className="btn btn-amber"
                      type="button"
                      style={{
                        fontSize: 13,
                        padding: "7px 16px",
                        fontWeight: 900,
                        background: "#22c55e",
                        borderColor: "#22c55e",
                        color: "#ffffff",
                      }}
                      onClick={() => handleCompleteHandover(c.id || c.token)}
                      disabled={completingId === (c.id || c.token)}
                    >
                      {completingId === (c.id || c.token) ? "Completing..." : "Confirm Handover"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      style={{ fontSize: 12, padding: "6px 10px", color: "var(--ember)" }}
                      onClick={() => handleRerouteNgo(c.token)}
                      title="Customer failed to arrive, transfer food to NGO"
                    >
                      🚨 No-Show → NGO
                    </button>
                    <button
                      className="btn btn-amber"
                      style={{ fontSize: 13, padding: "7px 16px", fontWeight: 800 }}
                      onClick={() => {
                        setModalOrder(c);
                        setModalOpen(true);
                      }}
                    >
                      [ VERIFY TOKEN ]
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* COMPLETED ORDERS */}
      <div className="section-head">
        <h2>Completed Orders</h2>
        <span className="count">{completed.length}</span>
      </div>

      <div className="card" style={{ padding: 10, borderRadius: 16, marginBottom: 28 }}>
        {completed.length === 0 && (
          <div className="empty-state" style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
            <span style={{ fontSize: 32, display: "block", marginBottom: 6 }}>🧾</span>
            <p style={{ margin: 0, fontSize: 14 }}>No completed orders yet.</p>
          </div>
        )}

        {completed.map((c) => (
          <div
            key={c.token}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 18px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ fontSize: 13, color: "#86efac" }}>
                  #{c.token}
                </span>
                <strong style={{ fontSize: 14.5, color: "#cbd5e1" }}>
                  {c.itemName} × {c.quantity || 1}
                </strong>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>— {c.customerName || "Customer"}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                Completed at:{" "}
                {c.collectedAt
                  ? new Date(c.collectedAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Today"}
              </div>
            </div>

            <div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#22c55e",
                  background: "rgba(34, 197, 94, 0.15)",
                  padding: "4px 10px",
                  borderRadius: 16,
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                }}
              >
                ✓ Picked Up / Completed
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* REROUTED TO RESCUE NGOS */}
      {rerouted.length > 0 && (
        <>
          <div className="section-head">
            <h2>Rerouted to Rescue NGOs</h2>
            <span className="count">{rerouted.length}</span>
          </div>
          <div className="card" style={{ padding: 10, borderRadius: 16 }}>
            {rerouted.map((c) => (
              <div
                key={c.token}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 18px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div>
                  <strong>{c.itemName}</strong> × {c.quantity || 1} — {c.customerName || "Customer"}
                  <div style={{ fontSize: 12, color: "#FF9F68", marginTop: 2 }}>
                    Rerouted to rescue NGO partner (Customer No-Show)
                  </div>
                </div>
                <span className="badge badge-amber" style={{ fontSize: 11 }}>
                  Rerouted to NGO
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* PICKUP VERIFICATION MODAL */}
      <PickupVerificationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        preselectedOrder={modalOrder}
        merchantUserId={merchantIdentifier}
        onVerified={() => loadQueue()}
        onCompleted={() => loadQueue()}
      />
    </div>
  );
}
