import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyClaims, updateMyClaim } from "../lib/myClaims.js";
import { useSession } from "../lib/session.jsx";
import { api } from "../lib/api.js";
import { socket } from "../lib/socket.js";
import TokenStub from "../components/TokenStub.jsx";
import PageTransition from "../components/animations/PageTransition.jsx";
import SuccessAnimation from "../components/animations/SuccessAnimation.jsx";

export default function CustomerPickups() {
  const { session } = useSession();
  const userId = session?.userId || session?.id || session?.username || session?.email || "guest";
  const [claims, setClaims] = useState(() => getMyClaims(userId));
  const [completedOrderModal, setCompletedOrderModal] = useState(null);

  const fetchClaims = () => {
    const userIdentifiers = Array.from(
      new Set([session?.userId, session?.id, session?.username, session?.email, userId, "guest"].filter(Boolean))
    );
    Promise.all(userIdentifiers.map((id) => api.getCustomerClaims(id).catch(() => ({ claims: [] }))))
      .then((results) => {
        const serverClaims = results.flatMap((r) => r?.claims || []);
        const local = getMyClaims(userId);
        const tokenMap = new Map();
        local.forEach((c) => tokenMap.set(c.token, c));
        serverClaims.forEach((c) => {
          if (c && c.token) {
            tokenMap.set(c.token, { ...tokenMap.get(c.token), ...c });
          }
        });
        const merged = Array.from(tokenMap.values()).sort(
          (a, b) => new Date(b.claimedAt || 0) - new Date(a.claimedAt || 0)
        );
        setClaims(merged);
      })
      .catch(() => {
        setClaims(getMyClaims(userId));
      });
  };

  useEffect(() => {
    fetchClaims();
  }, [userId, session]);

  useEffect(() => {
    const onCollected = (claim) => {
      if (!claim?.token) return;
      updateMyClaim(claim.token, { status: claim.status || "PICKED_UP", collectedAt: new Date().toISOString() }, userId);
      setClaims((prev) =>
        prev.map((c) =>
          c.token === claim.token
            ? { ...c, ...claim, status: "PICKED_UP", collectedAt: new Date().toISOString() }
            : c
        )
      );

      // Trigger Celebration Modal for Customer
      const matchingClaim = claims.find((c) => c.token === claim.token) || claim;
      setCompletedOrderModal({
        ...matchingClaim,
        collectedAt: new Date().toISOString(),
      });
    };

    const onTokenVerified = (data) => {
      if (!data?.token) return;
      updateMyClaim(data.token, { status: "TOKEN_VERIFIED", isVerified: true }, userId);
      setClaims((prev) =>
        prev.map((c) =>
          c.token === data.token ? { ...c, status: "TOKEN_VERIFIED", isVerified: true } : c
        )
      );
    };

    const onClaimUpdated = (updated) => {
      if (!updated?.token) return;
      updateMyClaim(updated.token, updated, userId);
      setClaims((prev) => prev.map((c) => (c.token === updated.token ? { ...c, ...updated } : c)));
    };

    socket.on("claim:collected", onCollected);
    socket.on("order:completed", onCollected);
    socket.on("order:token_verified", onTokenVerified);
    socket.on("claim:updated", onClaimUpdated);

    return () => {
      socket.off("claim:collected", onCollected);
      socket.off("order:completed", onCollected);
      socket.off("order:token_verified", onTokenVerified);
      socket.off("claim:updated", onClaimUpdated);
    };
  }, [userId, claims]);

  return (
    <PageTransition className="app-main">
      <div className="section-head" style={{ marginTop: 0 }}>
        <h2>My Pickups & Order History</h2>
        <span className="count">{claims.length} claimed</span>
      </div>

      {claims.length === 0 && (
        <div
          className="empty-state card"
          style={{
            padding: "36px 24px",
            textAlign: "center",
            border: "1.5px dashed rgba(245, 158, 11, 0.4)",
            borderRadius: 16,
          }}
        >
          <span style={{ fontSize: 40, display: "block", marginBottom: 8 }}>🛍️</span>
          <p
            className="display"
            style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", margin: "0 0 6px" }}
          >
            No Active Orders Yet
          </p>
          <p
            style={{
              fontSize: 13.5,
              color: "#cbd5e1",
              maxWidth: 460,
              margin: "0 auto 16px",
              lineHeight: 1.5,
            }}
          >
            Once you claim a food offer from the nearby feed, your pickup token code and QR code will appear
            here automatically for merchant verification at the counter!
          </p>
          <Link to="/customer" className="btn btn-amber" style={{ display: "inline-block" }}>
            Explore Today's Food Deals →
          </Link>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {claims.map((claim) => (
          <TokenStub key={claim.token} claim={claim} />
        ))}
      </div>

      {/* REAL-TIME ORDER COMPLETED CELEBRATION MODAL */}
      {completedOrderModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCompletedOrderModal(null);
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#182421",
              borderRadius: 22,
              border: "2px solid #22c55e",
              boxShadow: "0 25px 50px rgba(0,0,0,0.7), 0 0 35px rgba(34, 197, 94, 0.3)",
              padding: 28,
              textAlign: "center",
              animation: "slideUp 0.3s ease-out",
            }}
          >
            <SuccessAnimation
              type="order_completed"
              title="✓ Food Successfully Picked Up"
              subtitle="Your FoodSaver order has been completed."
            />

            {/* RECEIPT / METADATA CARD */}
            <div
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                borderRadius: 14,
                padding: "16px 18px",
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
                <strong style={{ fontFamily: "monospace", color: "#FF9F68", fontSize: 14 }}>
                  #{completedOrderModal.token || completedOrderModal.id}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Food Item:</span>
                <strong style={{ color: "#ffffff" }}>
                  {completedOrderModal.itemName}{" "}
                  {completedOrderModal.quantity > 1 ? `(×${completedOrderModal.quantity})` : ""}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Merchant:</span>
                <strong style={{ color: "#ffffff" }}>
                  {completedOrderModal.merchantName || "Verified Merchant"}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Pickup Time:</span>
                <span>Till {completedOrderModal.pickupWindowEnd || "22:00"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Completion Time:</span>
                <strong style={{ color: "#4ade80" }}>
                  {new Date(completedOrderModal.collectedAt || Date.now()).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </strong>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-amber"
              style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 900 }}
              onClick={() => setCompletedOrderModal(null)}
            >
              Awesome, Enjoy Meal! 😋
            </button>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
