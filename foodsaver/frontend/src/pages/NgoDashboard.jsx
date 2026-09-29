import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "../lib/session.jsx";
import { useNgoNotifications } from "../lib/useNgoNotifications.js";
import { useRealtimeListings } from "../lib/useRealtimeListings.js";
import { useToasts } from "../lib/useToasts.js";
import { socket } from "../lib/socket.js";
import { api } from "../lib/api.js";
import ToastStack from "../components/ToastStack.jsx";
import TokenStub from "../components/TokenStub.jsx";

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

const CATEGORIES = ["All", "Bakery", "Meals", "Snacks", "Beverages", "Desserts", "Fast Food", "Healthy"];

export default function NgoDashboard() {
  const { session } = useSession();
  const { notifications } = useNgoNotifications();
  const { listings, loading: listingsLoading } = useRealtimeListings();
  const { toasts, pushToast } = useToasts();

  const [activeTab, setActiveTab] = useState("active_marketplace"); // "active_marketplace" | "alerts"
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Rescue Selection Modal State
  const [selectedListing, setSelectedListing] = useState(null);
  const [rescueQty, setRescueQty] = useState(1);
  const [distributionNote, setDistributionNote] = useState("Community Shelter Food Drive");
  const [rescuing, setRescuing] = useState(false);
  const [rescueClaimToken, setRescueClaimToken] = useState(null);

  useEffect(() => {
    const onNew = (n) =>
      pushToast(
        <>
          <strong>Lights out</strong> — {n.itemName} at {n.merchantName} closed with {n.quantityLeft} left.
        </>
      );
    socket.on("ngo:notification", onNew);
    return () => socket.off("ngo:notification", onNew);
  }, [pushToast]);

  async function handleAcknowledge(id) {
    await api.acknowledgeNotification(id, session?.name);
    pushToast(
      <>
        <strong>Rescue Acknowledged!</strong> Pickup details dispatched to restaurant counter.
      </>
    );
  }

  function handleOpenRescueModal(listing) {
    setSelectedListing(listing);
    setRescueQty(1);
    setDistributionNote("Community Shelter Food Drive");
    setRescueClaimToken(null);
  }

  async function handleConfirmRescue() {
    if (!selectedListing) return;
    setRescuing(true);
    try {
      const res = await api.ngoRescueListing({
        listingId: selectedListing.id,
        ngoName: session?.name || session?.businessName || "Partner NGO",
        quantity: rescueQty,
        distributionNote,
      });

      if (res && res.claim) {
        setRescueClaimToken(res.claim);
        pushToast(
          <>
            <strong>Food Rescued Successfully!</strong> Token generated for {rescueQty}x {selectedListing.itemName}.
          </>
        );
      } else {
        pushToast(<span>Failed to process rescue request. Please try again.</span>);
      }
    } catch (err) {
      console.error("NGO Rescue Error:", err);
      pushToast(<span>{err.message || "Rescue request failed"}</span>);
    } finally {
      setRescuing(false);
    }
  }

  const unclaimedAlerts = notifications.filter((n) => n.status === "unclaimed");
  const acknowledgedAlerts = notifications.filter((n) => n.status !== "unclaimed");

  const filteredActiveListings = useMemo(() => {
    return listings.filter((l) => {
      if (l.status !== "active" || l.quantityAvailable <= 0) return false;
      const matchesCategory = selectedCategory === "All" || l.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery = q
        ? `${l.itemName} ${l.merchantName} ${l.category} ${l.address}`.toLowerCase().includes(q)
        : true;
      return matchesCategory && matchesQuery;
    });
  }, [listings, selectedCategory, searchQuery]);

  const isApproved = !session?.verificationStatus || session?.verificationStatus === "approved";
  const isPending = session?.verificationStatus === "pending" || session?.verificationStatus === "under_review";
  const isRejected = session?.verificationStatus === "rejected";

  return (
    <div className="app-main">
      <ToastStack toasts={toasts} />
      
      {/* HERO BANNER */}
      <section className="hero" style={{ paddingBottom: 16 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: isApproved ? "#E8F5F0" : "#FFF3E8", padding: "6px 14px", borderRadius: 20, border: `1px solid ${isApproved ? "#B8E6D2" : "#FFDAB5"}`, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>🤝</span>
          <div style={{ textAlign: "left" }}>
            <strong style={{ fontSize: 13, color: isApproved ? "#145C52" : "#A0522D", display: "block" }}>
              {isApproved ? "Verified NGO Partner ✓" : "NGO Partner"}
            </strong>
            <span style={{ fontSize: 11, color: "#66736F", fontWeight: 600 }}>
              {session?.name || session?.businessName || "Community Food Rescue Partner"}
            </span>
          </div>
        </div>
        <br />
        <span className="eyebrow">Zero Waste Hunger Relief</span>
        <h1>Select & Rescue Food for Your Community</h1>
        <p style={{ maxWidth: 680 }}>
          NGO partners can select specific active surplus food items directly from verified kitchens, or collect unclaimed stock the moment closing counters hit zero.
        </p>
      </section>

      {/* VERIFICATION NOTICE */}
      {isPending && (
        <div className="card" style={{ padding: 18, background: "#FFF3E8", border: "1.5px solid #D97706", borderRadius: 14, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 32 }}>🟡</span>
            <div>
              <h3 style={{ margin: "0 0 4px", color: "#A0522D", fontSize: 16 }}>Account Status: Pending Verification</h3>
              <p style={{ margin: 0, fontSize: 13, color: "#66736F", fontWeight: 500 }}>
                Your NGO Partner account is under review. Full rescue operations will unlock upon Admin approval.
              </p>
            </div>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="card" style={{ padding: 18, background: "#FEF2F2", border: "1.5px solid #EF4444", borderRadius: 14, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 32 }}>🔴</span>
            <div>
              <h3 style={{ margin: "0 0 4px", color: "#991B1B", fontSize: 16 }}>Verification Action Required</h3>
              <p style={{ margin: 0, fontSize: 13, color: "#66736F", fontWeight: 500 }}>
                Admin Feedback: {session?.rejectionReason || "Please update your NGO verification document proof."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MAIN TAB SWITCHER */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: "1.5px solid var(--glass-border, rgba(255,255,255,0.1))", paddingBottom: 12 }}>
        <button
          type="button"
          className={`btn ${activeTab === "active_marketplace" ? "btn-amber" : "btn-outline"}`}
          onClick={() => setActiveTab("active_marketplace")}
          style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}
        >
          <span>🍲</span> Select & Rescue Active Food
          <span className="count" style={{ background: activeTab === "active_marketplace" ? "#000" : "#FF9F68", color: activeTab === "active_marketplace" ? "#fff" : "#000" }}>
            {filteredActiveListings.length}
          </span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === "alerts" ? "btn-amber" : "btn-outline"}`}
          onClick={() => setActiveTab("alerts")}
          style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}
        >
          <span>🚨</span> Closing Counter Alerts
          {unclaimedAlerts.length > 0 && (
            <span className="count" style={{ background: "#C94C4C", color: "#fff" }}>
              {unclaimedAlerts.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: SELECT & RESCUE ACTIVE FOOD MARKETPLACE */}
      {activeTab === "active_marketplace" && (
        <div>
          {/* SEARCH & CATEGORY FILTERS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
                <input
                  type="search"
                  placeholder="Search available dishes, bakery items, or restaurants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 36px",
                    borderRadius: 10,
                    border: "1.5px solid var(--border-color, #66736F)",
                    background: "var(--input-bg, #24332F)",
                    color: "#fff",
                    fontSize: 14,
                  }}
                />
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.6 }}>🔍</span>
              </div>
            </div>

            {/* CATEGORY PILLS */}
            <div className="category-pill-row" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category-pill ${selectedCategory === cat ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                  style={{ padding: "6px 14px", fontSize: 13, borderRadius: 20, whiteSpace: "nowrap" }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {listingsLoading && (
            <div style={{ textAlign: "center", padding: 40, color: "#8A9490" }}>
              Loading live surplus food catalog...
            </div>
          )}

          {!listingsLoading && filteredActiveListings.length === 0 && (
            <div className="empty-state card" style={{ padding: 36, textAlign: "center", borderRadius: 16 }}>
              <span style={{ fontSize: 44, display: "block", marginBottom: 10 }}>🍲</span>
              <h3>No Active Surplus Food Available Right Now</h3>
              <p style={{ color: "#8A9490", maxWidth: 450, margin: "6px auto 16px" }}>
                Check back shortly as partner restaurants and bakeries post their daily closing surplus stock.
              </p>
            </div>
          )}

          {/* FOOD SELECTION GRID */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {filteredActiveListings.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 14,
                  overflow: "hidden",
                  border: "1.5px solid var(--glass-border, rgba(255,255,255,0.08))",
                  background: "var(--card-bg, #2D3B37)",
                }}
              >
                <div style={{ position: "relative", height: 160, width: "100%", background: "#24332F" }}>
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.itemName}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 40 }}>🍲</div>
                  )}
                  <span style={{ position: "absolute", top: 10, right: 10, background: "rgba(16, 185, 129, 0.9)", color: "#fff", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 800 }}>
                    {item.quantityAvailable} available
                  </span>
                  <span style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(0,0,0,0.75)", color: "#FF9F68", padding: "2px 8px", borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>
                    🏷️ {item.category}
                  </span>
                </div>

                <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 17, color: "#fff", fontWeight: 800 }}>{item.itemName}</h3>
                    <p style={{ margin: "0 0 10px", fontSize: 13, color: "#cbd5e1" }}>
                      By <strong>{item.merchantName}</strong> • 📍 {item.address}
                    </p>
                    {item.description && (
                      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#8A9490", lineHeight: 1.4 }}>
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div style={{ marginTop: 10, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ fontSize: 11, color: "#8A9490", display: "block" }}>Rescue Price</span>
                      <strong style={{ fontSize: 18, color: "#69C7A8", fontWeight: 900 }}>₹0 (Free Rescue)</strong>
                    </div>

                    <button
                      type="button"
                      className="btn btn-rescue"
                      style={{ padding: "8px 16px", fontWeight: 700, borderRadius: 8 }}
                      onClick={() => handleOpenRescueModal(item)}
                    >
                      🤝 Select & Rescue
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: REAL-TIME CLOSING ALERTS */}
      {activeTab === "alerts" && (
        <div>
          <div className="section-head" style={{ marginTop: 0 }}>
            <h2>Unclaimed Lights-Out Stock</h2>
            <span className="count">{unclaimedAlerts.length}</span>
          </div>

          {unclaimedAlerts.length === 0 && (
            <div className="empty-state card" style={{ padding: 36, textAlign: "center" }}>
              <p className="display" style={{ fontSize: 22 }}>All Clear</p>
              <p style={{ color: "#8A9490" }}>No unclaimed surplus alerts right now. You will receive an instant push notification the moment a merchant's counter closes!</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {unclaimedAlerts.map((n) => (
              <div className="card ngo-alert" key={n.id} style={{ padding: 16, borderRadius: 14 }}>
                <div className="alert-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span className="alert-item" style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{n.itemName}</span>
                    <div className="alert-meta" style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 13, color: "#8A9490" }}>
                      <span>🏢 {n.merchantName}</span>
                      <span>📍 {n.address}</span>
                      <span>⏱️ {timeAgo(n.closedAt)}</span>
                    </div>
                  </div>
                  <span className="badge badge-ember" style={{ fontSize: 13, fontWeight: 800, padding: "4px 10px" }}>
                    {n.quantityLeft} left
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-rescue"
                  style={{ marginTop: 12, width: "100%", fontWeight: 700 }}
                  onClick={() => handleAcknowledge(n.id)}
                >
                  ✓ We'll Collect This Rescue Stock
                </button>
              </div>
            ))}
          </div>

          {acknowledgedAlerts.length > 0 && (
            <>
              <div className="section-head" style={{ marginTop: 28 }}>
                <h2>Claimed Rescue History</h2>
                <span className="count">{acknowledgedAlerts.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {acknowledgedAlerts.map((n) => (
                  <div className="card ngo-alert acknowledged" key={n.id} style={{ padding: 14, opacity: 0.85 }}>
                    <div className="alert-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span className="alert-item" style={{ fontSize: 15, fontWeight: 700 }}>{n.itemName}</span>
                        <div className="alert-meta" style={{ fontSize: 12, color: "#8A9490", marginTop: 2 }}>
                          <span>{n.merchantName}</span> • <span>{n.address}</span>
                        </div>
                      </div>
                      <span className="badge badge-rescue" style={{ fontSize: 12, fontWeight: 700 }}>
                        Rescued by {n.acknowledgedBy}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* NGO SELECTION & RESCUE MODAL */}
      {selectedListing && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#2D3B37",
              borderRadius: 16,
              padding: 24,
              border: "1.5px solid #FF9F68",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {!rescueClaimToken ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ margin: 0, fontSize: 20, color: "#fff", fontWeight: 800 }}>
                    🤝 NGO Food Rescue Selection
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSelectedListing(null)}
                    style={{ background: "none", border: "none", color: "#8A9490", fontSize: 24, cursor: "pointer" }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ padding: 14, background: "#24332F", borderRadius: 12, marginBottom: 16 }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "#FF9F68" }}>{selectedListing.itemName}</h3>
                  <p style={{ margin: "0 0 6px", fontSize: 13, color: "#cbd5e1" }}>
                    From: <strong>{selectedListing.merchantName}</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "#8A9490" }}>
                    📍 Pickup Location: {selectedListing.address}
                  </p>
                </div>

                {/* QUANTITY SELECTION */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#cbd5e1", marginBottom: 8 }}>
                    Select Rescue Quantity (Max Available: {selectedListing.quantityAvailable})
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ width: 40, height: 40, fontSize: 20, fontWeight: 900 }}
                      disabled={rescueQty <= 1}
                      onClick={() => setRescueQty((q) => Math.max(1, q - 1))}
                    >
                      -
                    </button>
                    <span style={{ fontSize: 20, fontWeight: 900, color: "#fff", minWidth: 40, textAlign: "center" }}>
                      {rescueQty}
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ width: 40, height: 40, fontSize: 20, fontWeight: 900 }}
                      disabled={rescueQty >= selectedListing.quantityAvailable}
                      onClick={() => setRescueQty((q) => Math.min(selectedListing.quantityAvailable, q + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* DISTRIBUTION PURPOSE NOTE */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                    Community Distribution Purpose
                  </label>
                  <input
                    type="text"
                    value={distributionNote}
                    onChange={(e) => setDistributionNote(e.target.value)}
                    placeholder="e.g. Community Shelter Evening Meals"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #66736F",
                      background: "#24332F",
                      color: "#fff",
                      fontSize: 13.5,
                    }}
                  />
                </div>

                <div style={{ padding: 12, background: "rgba(16, 185, 129, 0.15)", borderRadius: 10, border: "1px solid rgba(16, 185, 129, 0.3)", marginBottom: 20, textAlign: "center" }}>
                  <span style={{ fontSize: 12, color: "#a7f3d0", display: "block" }}>Total NGO Rescue Charge</span>
                  <strong style={{ fontSize: 22, color: "#69C7A8", fontWeight: 900 }}>₹0 (100% Free Rescue)</strong>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ flex: 1 }}
                    onClick={() => setSelectedListing(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-rescue"
                    style={{ flex: 2, fontWeight: 800 }}
                    disabled={rescuing}
                    onClick={handleConfirmRescue}
                  >
                    {rescuing ? "Rescuing Food..." : "✓ Confirm Rescue Claim"}
                  </button>
                </div>
              </>
            ) : (
              /* TOKEN GENERATED DISPLAY */
              <div>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <span style={{ fontSize: 40 }}>🎉</span>
                  <h2 style={{ margin: "6px 0 0", color: "#69C7A8", fontSize: 20, fontWeight: 900 }}>
                    Food Rescue Claim Confirmed!
                  </h2>
                  <p style={{ fontSize: 13, color: "#cbd5e1", margin: "4px 0 0" }}>
                    Show this pickup token at the restaurant counter to receive the food.
                  </p>
                </div>

                <TokenStub claim={rescueClaimToken} />

                <button
                  type="button"
                  className="btn btn-amber"
                  style={{ width: "100%", marginTop: 20, fontWeight: 800 }}
                  onClick={() => {
                    setSelectedListing(null);
                    setRescueClaimToken(null);
                  }}
                >
                  Done & Close Token
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
