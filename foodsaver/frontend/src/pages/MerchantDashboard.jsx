import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { useRealtimeListings } from "../lib/useRealtimeListings.js";
import { useToasts } from "../lib/useToasts.js";
import { socket } from "../lib/socket.js";
import { api } from "../lib/api.js";
import ListingCard from "../components/ListingCard.jsx";
import ToastStack from "../components/ToastStack.jsx";
import RecentlyAccessed from "../components/RecentlyAccessed.jsx";
import RescueIntelligenceWidget from "../components/RescueIntelligenceWidget.jsx";
import PickupVerificationModal from "../components/PickupVerificationModal.jsx";

export default function MerchantDashboard() {
  const { session } = useSession();
  const merchantIdentifier = session?.merchantId || session?.userId || session?.hotelName || session?.name || session?.username || session?.email || "all";
  const { listings, loading, refresh } = useRealtimeListings({
    merchantName: merchantIdentifier,
    includeAll: true,
  });
  const { toasts, pushToast } = useToasts();
  const [selectedFoodFilter, setSelectedFoodFilter] = useState("all");
  const [editingListing, setEditingListing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deletingId, setDeletingId] = useState(null);
  const [merchantHotel, setMerchantHotel] = useState(null);
  const [merchantClaims, setMerchantClaims] = useState([]);
  const [claimsFilter, setClaimsFilter] = useState("pending");
  const [verifyTokenInput, setVerifyTokenInput] = useState("");
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [orderForVerification, setOrderForVerification] = useState(null);
  const [salesData, setSalesData] = useState({
    todaySales: 0,
    todayOrders: 0,
    todayItemsSold: 0,
    todayCustomers: 0,
    averageOrderValue: 0,
    recentOrders: [],
    hourlySales: [],
  });

  const loadTodaySales = useCallback(async () => {
    try {
      const res = await api.getMerchantTodaySales(merchantIdentifier || "all");
      if (res && res.salesData) {
        setSalesData(res.salesData);
      }
    } catch (err) {
      console.error("Failed loading merchant today sales", err);
    }
  }, [merchantIdentifier]);

  const loadMerchantClaims = useCallback(async () => {
    try {
      const res = await api.getMerchantClaims(merchantIdentifier || "all");
      if (res && res.claims) {
        setMerchantClaims(res.claims);
      }
    } catch (err) {
      console.error("Failed loading merchant claims", err);
    }
  }, [merchantIdentifier]);

  useEffect(() => {
    loadMerchantHotel();
    loadTodaySales();
    loadMerchantClaims();
  }, [session, loadTodaySales, loadMerchantClaims]);

  async function loadMerchantHotel() {
    if (!merchantIdentifier || merchantIdentifier === "all") return;
    try {
      const res = await api.getMerchantHotel(merchantIdentifier);
      if (res && res.hotel) {
        setMerchantHotel(res.hotel);
      }
    } catch (err) {
      console.error("Failed loading merchant hotel", err);
    }
  }

  useEffect(() => {
    const matchesSession = (name) => {
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
    };

    const onUpdate = (listing) => {
      if (!matchesSession(listing.merchantName)) return;
      if (listing.status === "expired_donatable") {
        pushToast(
          <>
            <strong>Counter closed</strong> — {listing.itemName} still had{" "}
            {listing.quantityLeft ?? listing.quantityAvailable} left, nearby
            NGOs were notified automatically.
          </>,
        );
      }
    };
    const onClaim = (claim) => {
      if (!matchesSession(claim.merchantName)) return;
      loadTodaySales();
      loadMerchantClaims();
      refresh();
      pushToast(
        <>
          <strong>🔔 New Order Received!</strong> — {claim.customerName || "Customer"} ordered{" "}
          {claim.quantity} × {claim.itemName} (₹{claim.pricePaid || 0}). Token #{claim.token}.
        </>,
      );
    };
    const onClaimCollected = (collectedClaim) => {
      loadTodaySales();
      loadMerchantClaims();
    };
    const onNgoCollected = (notice) => {
      if (!matchesSession(notice.merchantName)) return;
      loadTodaySales();
      loadMerchantClaims();
      pushToast(
        <>
          <strong>Pickup confirmed</strong> — {notice.ngoName} collected{" "}
          {notice.itemName} for your counter.
        </>,
      );
    };
    socket.on("listing:updated", onUpdate);
    socket.on("claim:created", onClaim);
    socket.on("order:created", onClaim);
    socket.on("claim:collected", onClaimCollected);
    socket.on("claim:updated", onClaimCollected);
    socket.on("merchant:ngo-collected", onNgoCollected);
    return () => {
      socket.off("listing:updated", onUpdate);
      socket.off("claim:created", onClaim);
      socket.off("order:created", onClaim);
      socket.off("claim:collected", onClaimCollected);
      socket.off("claim:updated", onClaimCollected);
      socket.off("merchant:ngo-collected", onNgoCollected);
    };
  }, [session, pushToast, loadTodaySales, loadMerchantClaims, refresh]);

  const filteredListings = listings.filter((l) => {
    if (selectedFoodFilter === "all") return true;
    return l.itemName.toLowerCase() === selectedFoodFilter.toLowerCase();
  });

  const active = filteredListings.filter((l) => l.status === "active");
  const closed = filteredListings.filter((l) => l.status !== "active");
  const uniqueFoodItems = Array.from(new Set(listings.map((l) => l.itemName)));
  const totalQuantityAvailable = listings.reduce((acc, item) => acc + (item.quantityAvailable || 0), 0);
  const totalQuantitySold = listings.reduce((acc, item) => acc + ((item.quantityTotal || 0) - (item.quantityAvailable || 0)), 0);
  const totalRevenue = listings.reduce((acc, item) => acc + (((item.quantityTotal || 0) - (item.quantityAvailable || 0)) * (item.discountPrice || 0)), 0);

  const isProfileComplete = Boolean(
    (session?.hotelName || session?.name) &&
    session?.address &&
    (session?.mobile || session?.email) &&
    session?.regDetails
  );
  const hotelStatus = merchantHotel?.status || (session?.verificationStatus === "approved" ? "APPROVED" : session?.verificationStatus === "rejected" ? "REJECTED" : "PENDING");
  const isApproved = hotelStatus === "APPROVED";
  const isPending = hotelStatus === "PENDING";
  const isRejected = hotelStatus === "REJECTED";
  const canPostFood = isApproved;

  // Hotel Profile Form state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    hotelName: session?.hotelName || session?.name || "Bright Food Hotel",
    description: session?.description || "Fresh surplus food partner offering daily deals.",
    address: session?.address || "14 Kovilpatti Main Road, Kovilpatti",
    mobile: session?.mobile || "+91 98765 43210",
    cuisine: session?.cuisine || "South Indian • Bakery • Fast Food",
    logo: session?.logo || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80",
    coverImage: session?.coverImage || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
  });

  async function handleSaveProfile(e) {
    e.preventDefault();
    try {
      if (!merchantHotel || !merchantHotel.id) {
        const res = await api.createHotel({
          merchantId: merchantIdentifier,
          merchantName: session?.name || profileForm.hotelName,
          ...profileForm,
        });
        if (res && res.hotel) {
          setMerchantHotel(res.hotel);
          pushToast(<strong>Hotel Submitted to Admin for Approval 🟡</strong>);
        }
      } else {
        const updated = await api.updateHotelProfile({
          merchantId: merchantIdentifier,
          ...profileForm,
        });
        if (updated && updated.hotel) {
          setMerchantHotel(updated.hotel);
          pushToast(<strong>Hotel Profile Updated ✓</strong>);
        }
      }
      setEditingProfile(false);
      loadMerchantHotel();
    } catch (err) {
      alert(`Failed to save hotel profile: ${err.message}`);
    }
  }

  async function handleToggleStatus(listing) {
    const newStatus = listing.status === "active" ? "soldout" : "active";
    try {
      await api.updateListing(listing.id, {
        status: newStatus,
        merchantName: merchantIdentifier,
      });
      pushToast(<strong>Status changed to {newStatus === "active" ? "Available" : "Sold Out"} ✓</strong>);
      refresh();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingListing) return;
    try {
      await api.updateListing(editingListing.id, {
        ...editForm,
        merchantName: merchantIdentifier,
      });
      pushToast(<strong>Listing Updated ✓</strong>);
      setEditingListing(null);
      refresh();
    } catch (err) {
      alert(`Failed to update listing: ${err.message}`);
    }
  }

  async function handleDeleteListing(id) {
    if (!window.confirm("Are you sure you want to delete this food listing?")) return;
    try {
      setDeletingId(id);
      await api.deleteListing(id, merchantIdentifier);
      pushToast(<strong>Listing Deleted</strong>);
      refresh();
    } catch (err) {
      alert(`Failed to delete listing: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  function handleStartEdit(listing) {
    setEditingListing(listing);
    setEditForm({
      itemName: listing.itemName,
      category: listing.category,
      quantityTotal: listing.quantityTotal || listing.quantityAvailable,
      originalPrice: listing.originalPrice,
      discountPrice: listing.discountPrice,
      address: listing.address,
      imageUrl: listing.imageUrl || "",
    });
  }

  async function handleMarkCollected(claimOrToken) {
    const claim = typeof claimOrToken === "object" ? claimOrToken : merchantClaims.find(c => c.token === claimOrToken || c.id === claimOrToken);
    const isVerified = claim && ((claim.status || "").toUpperCase() === "TOKEN_VERIFIED" || claim.isVerified);

    if (!isVerified) {
      // Must verify pickup token before completing!
      setOrderForVerification(claim || { token: claimOrToken });
      setVerifyModalOpen(true);
      return;
    }

    try {
      await api.completeOrderHandover(claim.id || claim.token);
      pushToast(<strong>Order #{claim.token} marked as Picked Up / Completed ✓</strong>);
      loadTodaySales();
      loadMerchantClaims();
    } catch (err) {
      alert(`Failed to complete order: ${err.message}`);
    }
  }

  async function handleRerouteNgo(token) {
    try {
      await api.rerouteToNgo(token);
      pushToast(<strong>Order #{token} rerouted to NGO rescue partner 🚨</strong>);
      loadTodaySales();
      loadMerchantClaims();
    } catch (err) {
      alert(`Notice: ${err.message || "Rerouted to NGO."}`);
    }
  }

  function handleVerifyTokenSubmit(e) {
    if (e) e.preventDefault();
    const clean = verifyTokenInput.trim().toUpperCase();
    const matching = merchantClaims.find(
      (c) => (c.token || "").toUpperCase() === clean || (c.id || "").toUpperCase() === clean
    );
    setOrderForVerification(matching || (clean ? { token: clean } : null));
    setVerifyModalOpen(true);
  }

  return (
    <div className="app-main">
      <ToastStack toasts={toasts} />

      {/* HERO & STATS OVERVIEW */}
      <section className="hero" style={{ paddingBottom: 20 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: isApproved ? "rgba(34, 197, 94, 0.1)" : isRejected ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.08)", padding: "6px 14px", borderRadius: 20, border: `1px solid ${isApproved ? "rgba(34, 197, 94, 0.4)" : isRejected ? "rgba(239, 68, 68, 0.4)" : "rgba(245, 158, 11, 0.3)"}`, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>🏢</span>
          <div style={{ textAlign: "left" }}>
            <strong style={{ fontSize: 13, color: isApproved ? "#145C52" : isRejected ? "#C94C4C" : "var(--amber, #FF9F68)", display: "block" }}>
              {isApproved ? "🟢 Hotel Approved & Live for Customers" : isRejected ? "🔴 Hotel Rejected by Admin" : "🟡 Hotel Pending Admin Approval"}
            </strong>
            <span style={{ fontSize: 11, color: "var(--dusk-soft)" }}>
              {isApproved
                ? "Your hotel profile is verified and active on the platform."
                : isRejected
                ? `Reason: ${merchantHotel?.rejectionReason || "Documentation update required."}`
                : "Your hotel submission is under review by the single Admin."}
            </span>
          </div>
        </div>
        <br />
        <span className="eyebrow">Merchant console</span>
        <h1>{profileForm.hotelName}</h1>
        <p>
          Manage your hotel profile, monitor surplus food inventory, and process customer pickup orders in real time.
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          {canPostFood ? (
            <Link to="/merchant/post" className="btn btn-amber">
              + Add Food Listing
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-amber"
              disabled
              style={{ opacity: 0.6, cursor: "not-allowed" }}
              title="Admin verification required before publishing food surplus"
            >
              🔒 Add Food (Pending Admin Verification)
            </button>
          )}

          <Link to="/merchant/counter" className="btn btn-outline" style={{ borderColor: "#145C52", color: "#145C52" }}>
            🧾 Counter Verification Queue ({merchantClaims.filter(c => c.status === 'pending').length})
          </Link>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setEditingProfile(true)}
          >
            ⚙️ Edit Hotel Profile
          </button>
        </div>
      </section>

      {/* RECENTLY ACCESSED HISTORY */}
      <RecentlyAccessed />

      {/* FOOD RESCUE INTELLIGENCE SYSTEM */}
      <RescueIntelligenceWidget merchantId={merchantIdentifier} />

      {/* TODAY'S REAL-TIME SALES DASHBOARD */}
      <div className="card" style={{ padding: 22, borderRadius: 20, marginBottom: 28, border: "1px solid #DCE6E3", background: "#FFFFFF", boxShadow: "0 8px 25px rgba(20, 92, 82, 0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: "#145C52", fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
              📊 Today's Real-Time Sales Dashboard
            </h2>
            <span style={{ fontSize: 12.5, color: "#687674" }}>
              Live sales performance for {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          <span className="badge badge-amber" style={{ fontSize: 12, padding: "4px 12px", background: "rgba(255, 159, 67, 0.15)", color: "#FF9F43", border: "1px solid rgba(255, 159, 67, 0.4)" }}>
            ⚡ Live Socket Updates
          </span>
        </div>

        {/* 5 TODAY METRICS CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
          <div style={{ background: "#E8F4F1", border: "1px solid #16796B", borderRadius: 16, padding: 16 }}>
            <span style={{ fontSize: 12, color: "#687674", fontWeight: 700, textTransform: "uppercase" }}>Today's Sales</span>
            <h3 style={{ margin: "4px 0 0", fontSize: 26, color: "#145C52", fontWeight: 900, fontFamily: "monospace" }}>
              {salesData.todaySales > 0 ? `₹${salesData.todaySales.toFixed(2)}` : "₹0.00"}
            </h3>
            <span style={{ fontSize: 11, color: salesData.todaySales > 0 ? "#16796B" : "#8A9693", marginTop: 2, display: "block" }}>
              {salesData.todaySales > 0 ? "Total Revenue Today" : "No sales recorded today"}
            </span>
          </div>

          <div style={{ background: "rgba(255, 159, 67, 0.12)", border: "1px solid #FF9F43", borderRadius: 16, padding: 16 }}>
            <span style={{ fontSize: 12, color: "#687674", fontWeight: 700, textTransform: "uppercase" }}>Today's Orders</span>
            <h3 style={{ margin: "4px 0 0", fontSize: 26, color: "#FF9F43", fontWeight: 900 }}>
              {salesData.todayOrders}
            </h3>
            <span style={{ fontSize: 11, color: salesData.todayOrders > 0 ? "#FF9F43" : "#8A9693", marginTop: 2, display: "block" }}>
              {salesData.todayOrders > 0 ? "Completed Orders Today" : "No orders yet"}
            </span>
          </div>

          <div style={{ background: "#E8F4F1", border: "1px solid #16796B", borderRadius: 16, padding: 16 }}>
            <span style={{ fontSize: 12, color: "#687674", fontWeight: 700, textTransform: "uppercase" }}>Items Sold</span>
            <h3 style={{ margin: "4px 0 0", fontSize: 26, color: "#16796B", fontWeight: 900 }}>
              {salesData.todayItemsSold}
            </h3>
            <span style={{ fontSize: 11, color: salesData.todayItemsSold > 0 ? "#16796B" : "#8A9693", marginTop: 2, display: "block" }}>
              {salesData.todayItemsSold > 0 ? "Food Portions Sold" : "No items sold"}
            </span>
          </div>

          <div style={{ background: "rgba(245, 196, 81, 0.15)", border: "1px solid #F5C451", borderRadius: 16, padding: 16 }}>
            <span style={{ fontSize: 12, color: "#687674", fontWeight: 700, textTransform: "uppercase" }}>Today's Customers</span>
            <h3 style={{ margin: "4px 0 0", fontSize: 26, color: "#B4890A", fontWeight: 900 }}>
              {salesData.todayCustomers}
            </h3>
            <span style={{ fontSize: 11, color: salesData.todayCustomers > 0 ? "#B4890A" : "#8A9693", marginTop: 2, display: "block" }}>
              {salesData.todayCustomers > 0 ? "Unique Buyers Today" : "No customers yet"}
            </span>
          </div>

          <div style={{ background: "#E8F4F1", border: "1px solid #16796B", borderRadius: 16, padding: 16 }}>
            <span style={{ fontSize: 12, color: "#687674", fontWeight: 700, textTransform: "uppercase" }}>Avg Order Value</span>
            <h3 style={{ margin: "4px 0 0", fontSize: 26, color: "#145C52", fontWeight: 900, fontFamily: "monospace" }}>
              {salesData.averageOrderValue > 0 ? `₹${salesData.averageOrderValue.toFixed(2)}` : "₹0.00"}
            </h3>
            <span style={{ fontSize: 11, color: salesData.averageOrderValue > 0 ? "#145C52" : "#8A9693", marginTop: 2, display: "block" }}>
              Revenue per Order
            </span>
          </div>
        </div>

        {/* HOURLY SALES CHART & RECENT LIVE SALES ACTIVITY GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {/* HOURLY SALES CHART */}
          <div style={{ background: "#F7F9F8", borderRadius: 16, padding: 18, border: "1px solid #DCE6E3" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: "#102A2A" }}>
              📈 Today's Hourly Sales (₹)
            </h4>

            {salesData.hourlySales.length === 0 ? (
              <div style={{ padding: "36px 16px", textAlign: "center", color: "#8A9693", background: "#FFFFFF", borderRadius: 12, border: "1px dashed #DCE6E3" }}>
                <span style={{ fontSize: 32, display: "block", marginBottom: 6 }}>📊</span>
                <strong style={{ fontSize: 15, color: "#102A2A", display: "block" }}>No sales recorded today</strong>
                <span style={{ fontSize: 12.5 }}>Real-time hourly sales will plot here as orders arrive.</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 160, paddingTop: 20 }}>
                {salesData.hourlySales.map(({ hour, sales }) => {
                  const maxSales = Math.max(...salesData.hourlySales.map((h) => h.sales), 1);
                  const barHeightPct = Math.round((sales / maxSales) * 100);
                  return (
                    <div key={hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: 10, color: sales > 0 ? "#145C52" : "transparent", fontWeight: 800, fontFamily: "monospace" }}>
                        ₹{sales}
                      </span>
                      <div
                        style={{
                          width: "100%",
                          height: `${Math.max(barHeightPct, 6)}%`,
                          background: sales > 0 ? "linear-gradient(180deg, #145C52 0%, #16796B 100%)" : "#DCE6E3",
                          borderRadius: "4px 4px 0 0",
                          transition: "height 0.3s ease",
                        }}
                      />
                      <span style={{ fontSize: 9.5, color: "#8A9693", fontWeight: 700, textTransform: "uppercase" }}>{hour}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LIVE SALES ACTIVITY FEED */}
          <div style={{ background: "#F7F9F8", borderRadius: 16, padding: 18, border: "1px solid #DCE6E3", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#102A2A" }}>
                ⚡ Live Sales Activity
              </h4>
              <span style={{ fontSize: 11.5, color: "#145C52", fontWeight: 800 }}>
                {salesData.recentOrders.length} Orders Today
              </span>
            </div>

            {salesData.recentOrders.length === 0 ? (
              <div style={{ flex: 1, padding: "36px 16px", textAlign: "center", color: "#8A9693", background: "#FFFFFF", borderRadius: 12, border: "1px dashed #DCE6E3", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <span style={{ fontSize: 32, display: "block", marginBottom: 6 }}>🧾</span>
                <strong style={{ fontSize: 15, color: "#102A2A", display: "block" }}>No orders placed today</strong>
                <span style={{ fontSize: 12.5 }}>Customer orders will automatically update this live feed.</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 180, overflowY: "auto" }}>
                {salesData.recentOrders.map((order) => (
                  <div
                    key={order.id || order.token}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: "#FFFFFF",
                      border: "1px solid #DCE6E3",
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <strong style={{ color: "#FF9F43", fontFamily: "monospace" }}>#{order.token || order.id}</strong>
                        <span style={{ color: "#102A2A", fontWeight: 700 }}>• {order.itemName} × {order.quantity}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#687674" }}>Buyer: {order.customerName || "Customer"}</span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <strong style={{ color: "#145C52", fontFamily: "monospace", fontSize: 14 }}>₹{order.pricePaid}</strong>
                      <span style={{ fontSize: 10, color: "#4CAF73", display: "block", fontWeight: 800 }}>✓ Completed</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RECEIVED CUSTOMER ORDERS & PICKUP QUEUE */}
      <div className="card" style={{ padding: 22, borderRadius: 20, marginBottom: 28, border: "1px solid #DCE6E3", background: "#FFFFFF", boxShadow: "0 8px 25px rgba(20, 92, 82, 0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: "#145C52", fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
              📦 Received Customer Orders ({merchantClaims.length})
            </h2>
            <span style={{ fontSize: 12.5, color: "#687674" }}>
              Live customer pickup queue, token verification & order fulfillment details
            </span>
          </div>

          {/* TOKEN LOOKUP QUICK FIELD */}
          <form onSubmit={handleVerifyTokenSubmit} style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Verify Token (e.g. FS-10231)"
              value={verifyTokenInput}
              onChange={(e) => setVerifyTokenInput(e.target.value)}
              className="mono"
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #DCE6E3", background: "#FFFFFF", color: "#102A2A", fontSize: 13, minWidth: 200 }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13, background: "#145C52" }}>
              🔍 Verify Token
            </button>
          </form>
        </div>

        {/* FILTER TABS */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          {[
            {
              id: "pending",
              label: `Pending Pickups (${
                merchantClaims.filter(
                  (c) =>
                    c.status === "pending" ||
                    c.status === "ready" ||
                    c.status === "READY_FOR_PICKUP" ||
                    c.status === "TOKEN_VERIFIED"
                ).length
              })`,
            },
            {
              id: "completed",
              label: `Completed Orders (${
                merchantClaims.filter(
                  (c) =>
                    c.status === "collected" ||
                    c.status === "PICKED_UP" ||
                    c.status === "COMPLETED" ||
                    c.status === "DELIVERED"
                ).length
              })`,
            },
            { id: "all", label: `All Orders (${merchantClaims.length})` },
            {
              id: "rerouted_to_ngo",
              label: `Rerouted to NGO (${
                merchantClaims.filter((c) => c.status === "rerouted_to_ngo").length
              })`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setClaimsFilter(tab.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                background: claimsFilter === tab.id ? "#69C7A8" : "#2D3B37",
                color: claimsFilter === tab.id ? "#000" : "#cbd5e1",
                border: `1px solid ${claimsFilter === tab.id ? "#69C7A8" : "#66736F"}`,
                transition: "all 0.2s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CLAIMS LIST */}
        {merchantClaims.length === 0 ? (
          <div style={{ padding: "36px 16px", textAlign: "center", color: "#8A9490", background: "rgba(36, 51, 47, 0.5)", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.1)" }}>
            <span style={{ fontSize: 36, display: "block", marginBottom: 8 }}>🛍️</span>
            <strong style={{ fontSize: 16, color: "#ffffff", display: "block" }}>No customer orders received yet</strong>
            <span style={{ fontSize: 13 }}>When customers purchase surplus food items, their detailed order receipts & pickup tokens will appear here.</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {merchantClaims
              .filter((c) => {
                if (claimsFilter === "all") return true;
                if (claimsFilter === "pending") {
                  return (
                    c.status === "pending" ||
                    c.status === "ready" ||
                    c.status === "READY_FOR_PICKUP" ||
                    c.status === "TOKEN_VERIFIED"
                  );
                }
                if (claimsFilter === "completed") {
                  return (
                    c.status === "collected" ||
                    c.status === "PICKED_UP" ||
                    c.status === "COMPLETED" ||
                    c.status === "DELIVERED"
                  );
                }
                return c.status === claimsFilter;
              })
              .map((c) => {
                const statusUpper = (c.status || "").toUpperCase();
                const isCollected = ["COLLECTED", "PICKED_UP", "COMPLETED", "DELIVERED"].includes(statusUpper);
                const isVerified = statusUpper === "TOKEN_VERIFIED" || c.isVerified;
                const isNgo = statusUpper === "REROUTED_TO_NGO";

                return (
                  <div
                    key={c.id || c.token}
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      background: "#2D3B37",
                      border: `1.5px solid ${isVerified ? "#22c55e" : isCollected ? "rgba(34, 197, 94, 0.3)" : "rgba(245, 158, 11, 0.4)"}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span className="mono" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#FF9F68", padding: "4px 10px", borderRadius: 8, fontWeight: 900, fontSize: 14, border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                            Order #{c.token}
                          </span>
                          <strong style={{ fontSize: 16, color: "#ffffff" }}>{c.itemName}</strong>
                          <span style={{ fontSize: 13, color: "#69C7A8", fontWeight: 800 }}>× {c.quantity} portion{c.quantity > 1 ? "s" : ""}</span>
                        </div>
                        <div style={{ fontSize: 13, color: "#8A9490", marginTop: 4 }}>
                          Customer: <strong style={{ color: "#cbd5e1" }}>{c.customerName || "Customer"}</strong> ({c.customerId || c.customerUsername || "guest"})
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#69C7A8", fontFamily: "monospace" }}>
                          ₹{c.pricePaid}
                        </div>
                        <span
                          className={`badge ${isCollected ? "badge-rescue" : isVerified ? "badge-rescue" : isNgo ? "badge-amber" : "badge-amber"}`}
                          style={{
                            fontSize: 11,
                            padding: "3px 10px",
                            marginTop: 2,
                            display: "inline-block",
                            border: isVerified ? "1px solid #22c55e" : undefined,
                          }}
                        >
                          {isCollected
                            ? "✓ Picked Up / Completed"
                            : isVerified
                            ? "✓ VERIFIED"
                            : isNgo
                            ? "🚨 Rerouted to NGO"
                            : "READY FOR PICKUP"}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #66736F", paddingTop: 10, flexWrap: "wrap", gap: 10, fontSize: 12.5, color: "#8A9490" }}>
                      <div>
                        📅 Placed: {new Date(c.claimedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} ({new Date(c.claimedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})
                        • 🕒 Pickup window ends: {c.pickupWindowEnd || "22:00"}
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {!isCollected && !isNgo && (
                          <>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ fontSize: 12, padding: "5px 10px", color: "#C94C4C" }}
                              onClick={() => handleRerouteNgo(c.token)}
                              title="Transfer to NGO rescue if customer fails to arrive"
                            >
                              🚨 No-Show → NGO
                            </button>

                            {isVerified ? (
                              <button
                                type="button"
                                className="btn btn-amber"
                                style={{
                                  fontSize: 12,
                                  padding: "6px 16px",
                                  fontWeight: 900,
                                  background: "#22c55e",
                                  borderColor: "#22c55e",
                                  color: "#ffffff",
                                }}
                                onClick={() => handleMarkCollected(c)}
                              >
                                ✓ Confirm Handover (Picked Up)
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-amber"
                                style={{ fontSize: 12, padding: "6px 16px", fontWeight: 800 }}
                                onClick={() => {
                                  setOrderForVerification(c);
                                  setVerifyModalOpen(true);
                                }}
                              >
                                [ VERIFY TOKEN ]
                              </button>
                            )}
                          </>
                        )}
                        {isCollected && (
                          <span style={{ fontSize: 12, color: "#86efac", fontWeight: 700 }}>
                            ✓ Handover Complete
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* MY HOTEL PROFILE CARD */}
      <div className="card" style={{ padding: 20, borderRadius: 20, marginBottom: 24, border: "1px solid #DCE6E3", background: "#FFFFFF", boxShadow: "0 8px 25px rgba(20, 92, 82, 0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: "#145C52", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            🏢 My Hotel / Restaurant Profile
          </h3>
          <button type="button" className="btn btn-outline" style={{ fontSize: 12, padding: "6px 14px", borderColor: "#145C52", color: "#145C52" }} onClick={() => setEditingProfile(true)}>
            ✏️ Edit Profile
          </button>
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, overflow: "hidden", border: "2px solid #16796B", background: "#ffffff", flexShrink: 0 }}>
            <img src={profileForm.logo} alt="Hotel Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <h4 style={{ margin: "0 0 2px", fontSize: 17, color: "#102A2A", fontWeight: 800 }}>{profileForm.hotelName}</h4>
            <span style={{ fontSize: 12.5, color: "#16796B", fontWeight: 700, display: "block", marginBottom: 4 }}>{profileForm.cuisine}</span>
            <span style={{ fontSize: 12, color: "#687674", display: "block" }}>📍 {profileForm.address} • 📞 {profileForm.mobile}</span>
          </div>

          <div>
            <span className={`badge ${canPostFood ? "badge-rescue" : "badge-amber"}`} style={{ fontSize: 12, padding: "6px 12px" }}>
              {canPostFood ? "Verified ✓" : "Pending Verification"}
            </span>
          </div>
        </div>
      </div>

      {/* VERIFICATION UNVERIFIED NOTICE */}
      {!canPostFood && (
        <div className="card" style={{ padding: 20, background: "rgba(255, 159, 67, 0.08)", border: "1px solid #FF9F43", borderRadius: 16, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 32 }}>🔒</span>
            <div>
              <h3 style={{ margin: "0 0 4px", color: "#FF9F43", fontSize: 17 }}>Verification Required Before Publishing Food</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "#687674", lineHeight: 1.5 }}>
                Your Merchant account status is currently <strong>Pending Admin Verification</strong>. Once your business documents are verified by Admin, you will be able to publish food listings publicly to customers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MY FOOD MANAGEMENT TABLE SECTION */}
      <div className="section-head-with-sort" style={{ marginTop: 0, marginBottom: 14 }}>
        <div>
          <h2>My Food Listings</h2>
          <p className="subtext-muted">All surplus food items published under {profileForm.hotelName}</p>
        </div>

        {canPostFood && (
          <Link to="/merchant/post" className="btn btn-amber" style={{ fontSize: 13, padding: "8px 16px" }}>
            + Add Food
          </Link>
        )}
      </div>

      {/* EMPTY STATE FOR MERCHANT */}
      {!loading && listings.length === 0 && (
        <div className="empty-state card" style={{ padding: "48px 24px", textAlign: "center", border: "1.5px dashed rgba(245, 158, 11, 0.4)", borderRadius: 16, margin: "16px 0 32px" }}>
          <span style={{ fontSize: 44, display: "block", marginBottom: 10 }}>🍲</span>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", margin: "0 0 8px" }}>
            No Food Items Yet
          </h3>
          <p style={{ fontSize: 14, color: "#cbd5e1", maxWidth: 440, margin: "0 auto 20px", lineHeight: 1.6 }}>
            Start adding your surplus food to make it available to customers and prevent food waste.
          </p>
          {canPostFood ? (
            <Link to="/merchant/post" className="btn btn-amber" style={{ fontSize: 15, padding: "12px 24px", fontWeight: 800 }}>
              + Add Food
            </Link>
          ) : (
            <button type="button" className="btn btn-amber" disabled style={{ opacity: 0.6, cursor: "not-allowed" }}>
              🔒 Add Food (Pending Admin Verification)
            </button>
          )}
        </div>
      )}

      {/* MY FOOD TABLE */}
      {listings.length > 0 && (
        <div className="card" style={{ padding: 0, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(245,158,11,0.25)", marginBottom: 32 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13.5, color: "#ffffff" }}>
              <thead>
                <tr style={{ background: "#2D3B37", borderBottom: "1px solid #66736F", color: "#FF9F68", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  <th style={{ padding: "14px 16px" }}>Food Item</th>
                  <th style={{ padding: "14px 16px" }}>Category</th>
                  <th style={{ padding: "14px 16px", textAlign: "right" }}>Original Price</th>
                  <th style={{ padding: "14px 16px", textAlign: "right" }}>Offer Price</th>
                  <th style={{ padding: "14px 16px", textAlign: "center" }}>Available Qty</th>
                  <th style={{ padding: "14px 16px" }}>Status</th>
                  <th style={{ padding: "14px 16px", textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((item) => {
                  const isSoldOut = item.status === "soldout" || item.quantityAvailable <= 0;
                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #2D3B37", background: isSoldOut ? "rgba(239, 68, 68, 0.05)" : "transparent" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 700 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.itemName} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: 8, background: "#66736F", display: "flex", alignItems: "center", justifyContent: "center" }}>🍲</div>
                          )}
                          <span>{item.itemName}</span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#cbd5e1" }}>{item.category || "Meals"}</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", color: "#8A9490", textDecoration: "line-through" }}>₹{item.originalPrice}</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", color: "#69C7A8", fontWeight: 800 }}>₹{item.discountPrice}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: 800 }}>{item.quantityAvailable} / {item.quantityTotal}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span className={`badge ${item.status === "active" ? "badge-rescue" : "badge-amber"}`} style={{ fontSize: 11, padding: "2px 8px" }}>
                          {item.status === "active" ? "Available" : item.status === "soldout" ? "Sold Out" : item.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ fontSize: 11, padding: "4px 8px" }}
                            onClick={() => handleToggleStatus(item)}
                          >
                            {item.status === "active" ? "Mark Sold Out" : "Mark Available"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ fontSize: 11, padding: "4px 8px" }}
                            onClick={() => handleStartEdit(item)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ fontSize: 11, padding: "4px 8px", borderColor: "#C94C4C", color: "#C94C4C" }}
                            onClick={() => handleDeleteListing(item.id)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT HOTEL PROFILE MODAL */}
      {editingProfile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(16, 42, 42, 0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 520, padding: 24, borderRadius: 20, background: "#FFFFFF", border: "1px solid #DCE6E3", color: "#102A2A", boxShadow: "0 20px 50px rgba(20, 92, 82, 0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "#145C52", fontWeight: 800 }}>⚙️ Edit Hotel / Restaurant Profile</h3>
              <button type="button" onClick={() => setEditingProfile(false)} style={{ background: "none", border: "none", color: "#687674", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 700, color: "#102A2A" }}>Hotel / Restaurant Name:</label>
                <input
                  type="text"
                  required
                  value={profileForm.hotelName}
                  onChange={(e) => setProfileForm({ ...profileForm, hotelName: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #DCE6E3", background: "#FFFFFF", color: "#102A2A" }}
                />
              </div>

              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 700, color: "#102A2A" }}>Cuisine / Category:</label>
                <input
                  type="text"
                  value={profileForm.cuisine}
                  onChange={(e) => setProfileForm({ ...profileForm, cuisine: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #DCE6E3", background: "#FFFFFF", color: "#102A2A" }}
                />
              </div>

              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 700, color: "#102A2A" }}>Address:</label>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #DCE6E3", background: "#FFFFFF", color: "#102A2A" }}
                />
              </div>

              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>Contact Mobile Number:</label>
                <input
                  type="text"
                  value={profileForm.mobile}
                  onChange={(e) => setProfileForm({ ...profileForm, mobile: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #66736F", background: "#2D3B37", color: "#fff" }}
                />
              </div>

              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>Logo Image URL:</label>
                <input
                  type="url"
                  value={profileForm.logo}
                  onChange={(e) => setProfileForm({ ...profileForm, logo: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #66736F", background: "#2D3B37", color: "#fff" }}
                />
              </div>

              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>Cover Image URL:</label>
                <input
                  type="url"
                  value={profileForm.coverImage}
                  onChange={(e) => setProfileForm({ ...profileForm, coverImage: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #66736F", background: "#2D3B37", color: "#fff" }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditingProfile(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-amber" style={{ flex: 1 }}>Save Profile Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {closed.length > 0 && (
        <>
          <div className="section-head">
            <h2>Closed</h2>
            <span className="count">{closed.length}</span>
          </div>
          <div className="grid-row cols-2">
            {closed.map((listing) => (
              <div key={listing.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <ListingCard listing={listing} isMerchant={true} />
                <div style={{ display: "flex", gap: 8, padding: "0 4px" }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={deletingId === listing.id}
                    style={{ flex: 1, fontSize: 12, padding: "6px 12px", borderColor: "#C94C4C", color: "#C94C4C" }}
                    onClick={() => handleDeleteListing(listing.id)}
                  >
                    🗑️ Delete Listing Record
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* EDIT LISTING MODAL DIALOG */}
      {editingListing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(16, 42, 42, 0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 500, padding: 24, borderRadius: 20, background: "#FFFFFF", border: "1px solid #DCE6E3", color: "#102A2A", boxShadow: "0 20px 50px rgba(20, 92, 82, 0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "#145C52", fontWeight: 800 }}>✏️ Edit Surplus Listing</h3>
              <button type="button" onClick={() => setEditingListing(null)} style={{ background: "none", border: "none", color: "#687674", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 700, color: "#102A2A" }}>Food Item Name:</label>
                <input
                  type="text"
                  required
                  value={editForm.itemName || ""}
                  onChange={(e) => setEditForm({ ...editForm, itemName: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #DCE6E3", background: "#FFFFFF", color: "#102A2A" }}
                />
              </div>

              <div className="grid-row cols-2" style={{ gap: 12 }}>
                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#102A2A" }}>Original Price (₹):</label>
                  <input
                    type="number"
                    min={1}
                    value={editForm.originalPrice || ""}
                    onChange={(e) => setEditForm({ ...editForm, originalPrice: e.target.value })}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #DCE6E3", background: "#FFFFFF", color: "#102A2A" }}
                  />
                </div>
                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#102A2A" }}>Discounted Price (₹):</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editForm.discountPrice || ""}
                    onChange={(e) => setEditForm({ ...editForm, discountPrice: e.target.value })}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #DCE6E3", background: "#FFFFFF", color: "#102A2A" }}
                  />
                </div>
              </div>

              <div className="grid-row cols-2" style={{ gap: 12 }}>
                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>Quantity Total:</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editForm.quantityTotal || ""}
                    onChange={(e) => setEditForm({ ...editForm, quantityTotal: e.target.value })}
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #66736F", background: "#2D3B37", color: "#fff" }}
                  />
                </div>
                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>Category:</label>
                  <select
                    value={editForm.category || "Meals"}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #66736F", background: "#2D3B37", color: "#fff" }}
                  >
                    {["Bakery", "Meals", "Snacks", "Desserts", "Beverages", "Fast Food", "Homemade", "Grocery"].map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>Pickup Address:</label>
                <input
                  type="text"
                  value={editForm.address || ""}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #66736F", background: "#2D3B37", color: "#fff" }}
                />
              </div>

              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>Image URL:</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={editForm.imageUrl || ""}
                  onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #66736F", background: "#2D3B37", color: "#fff" }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditingListing(null)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-amber" style={{ flex: 1 }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PICKUP TOKEN VERIFICATION MODAL */}
      <PickupVerificationModal
        isOpen={verifyModalOpen}
        onClose={() => {
          setVerifyModalOpen(false);
          setOrderForVerification(null);
        }}
        preselectedOrder={orderForVerification}
        merchantUserId={merchantIdentifier}
        onVerified={() => {
          loadMerchantClaims();
          loadTodaySales();
        }}
        onCompleted={() => {
          loadMerchantClaims();
          loadTodaySales();
          refresh();
        }}
      />
    </div>
  );
}
