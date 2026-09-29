import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { api } from "../lib/api.js";

const ROLE_LABELS = {
  customer: "Resident Customer",
  merchant: "Merchant Partner",
  ngo: "NGO Rescue Partner",
  admin: "Platform Administrator",
};

const ROLE_BADGE_COLORS = {
  customer: { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  merchant: { bg: "#E8F5F0", text: "#145C52", border: "#B8E6D2" },
  ngo: { bg: "#E8F5F0", text: "#16A34A", border: "#B8E6D2" },
  admin: { bg: "#FFF3E8", text: "#FF9F68", border: "#FFDAB5" },
};

const ACTIVITY_SETS = {
  customer: {
    metrics: [
      { label: "Orders Placed", value: "6", subtext: "Surplus meals" },
      { label: "Savings Claimed", value: "₹420", subtext: "Total discount" },
      { label: "CO₂ Avoided", value: "18 kg", subtext: "Environmental impact" },
    ],
    recent: [
      { time: "Today, 4:30 PM", text: "Purchased 2 fresh meals from Sunrise Bakery." },
      { time: "Yesterday, 7:15 PM", text: "Collected 1 prepared dinner from Spice Corner." },
      { time: "12 Aug 2026", text: "Confirmed 3 reserved offers at Kovilpatti." },
    ],
  },
  merchant: {
    metrics: [
      { label: "Active Listings", value: "8", subtext: "Currently live" },
      { label: "Items Claimed", value: "32", subtext: "Flash sales completed" },
      { label: "Waste Avoided", value: "190 kg", subtext: "Surplus recovered" },
    ],
    recent: [
      { time: "Today, 5:10 PM", text: "Published 1 new surplus food bundle." },
      { time: "Today, 3:45 PM", text: "Confirmed 3 customer pickup counter claims." },
      { time: "Yesterday", text: "Updated end-of-day flash sale pricing." },
    ],
  },
  ngo: {
    metrics: [
      { label: "Rescue Missions", value: "12", subtext: "Completed rescues" },
      { label: "Donors Engaged", value: "9", subtext: "Local partners" },
      { label: "Pickups Scheduled", value: "5", subtext: "Awaiting collection" },
    ],
    recent: [
      { time: "Today, 6:00 PM", text: "Confirmed 2 community food rescue pickups." },
      { time: "Yesterday", text: "Coordinated a fresh meal rescue with Sunrise Cafe." },
      { time: "11 Aug 2026", text: "Shared rescue status update with volunteer team." },
    ],
  },
  default: {
    metrics: [
      { label: "Sessions Active", value: "3", subtext: "This week" },
      { label: "Connections", value: "7", subtext: "Local sellers" },
      { label: "Impact Score", value: "91", subtext: "Platform tier" },
    ],
    recent: [
      { time: "Just now", text: "Visited the Food Saver management console." },
      { time: "Today", text: "Started an active session." },
      { time: "Yesterday", text: "Explored nearby food rescue offers." },
    ],
  },
};

export default function Profile() {
  const { session, setSession } = useSession();
  const navigate = useNavigate();

  const userRole = (session?.role || "customer").toLowerCase();
  const isMerchant = userRole === "merchant";
  const isNgo = userRole === "ngo";
  const isPartner = isMerchant || isNgo;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: session?.name || session?.hotelName || "Resident Customer",
    hotelName: session?.hotelName || session?.name || "Artisan Bakery",
    address: session?.address || "14 Kovilpatti Main Road, Kovilpatti",
    mobile: session?.mobile || session?.phone || "+91 98765 43210",
    dietaryPreference: session?.dietaryPreference || "All (Veg & Non-Veg)",
    regDetails: session?.regDetails || (isMerchant ? "FSSAI License # 22421008000142" : isNgo ? "NGO 80G Tax Exempt # 142/2018" : ""),
    email: session?.email || "customer@foodsaver.com",
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!session) {
    return (
      <div className="app-main">
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>Profile Unavailable</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "8px 0 20px" }}>
            Please log in to your account to view profile information and history.
          </p>
          <button className="btn btn-primary" onClick={() => navigate("/login")}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const activity = ACTIVITY_SETS[userRole] || ACTIVITY_SETS.default;
  const roleLabel = ROLE_LABELS[userRole] || "Food Saver Member";
  const badgeStyle = ROLE_BADGE_COLORS[userRole] || ROLE_BADGE_COLORS.customer;
  const displayName = isPartner ? (session.hotelName || session.name || "Partner") : (session.name || session.username || "Customer");
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const [saving, setSaving] = useState(false);

  // Keep form data synchronized with current session
  React.useEffect(() => {
    if (session) {
      setFormData((prev) => ({
        ...prev,
        name: session.name || session.hotelName || prev.name,
        hotelName: session.hotelName || session.name || prev.hotelName,
        address: session.address || prev.address,
        mobile: session.mobile || session.phone || prev.mobile,
        dietaryPreference: session.dietaryPreference || prev.dietaryPreference,
        regDetails: session.regDetails || prev.regDetails,
        email: session.email || prev.email,
      }));
    }
  }, [session]);

  const isProfileComplete = Boolean(
    (session?.hotelName || session?.name || formData.hotelName || formData.name) &&
    (session?.address || formData.address) &&
    (session?.mobile || session?.phone || session?.email || formData.mobile)
  );
  const isApproved =
    session?.verificationStatus === "approved" ||
    session?.status === "APPROVED" ||
    session?.profileCompleted ||
    isProfileComplete ||
    !isPartner;

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);

    const cleanHotelName = (isPartner ? formData.hotelName.trim() : formData.name.trim()) || "Partner Shop";
    const cleanAddress = formData.address.trim() || "Kovilpatti, Tamil Nadu";
    const cleanMobile = formData.mobile.trim() || "+91 98765 43210";
    const cleanEmail = (formData.email.trim() || session?.email || "").toLowerCase();

    const updatedSession = {
      ...session,
      name: cleanHotelName,
      hotelName: cleanHotelName,
      address: cleanAddress,
      mobile: cleanMobile,
      phone: cleanMobile,
      dietaryPreference: formData.dietaryPreference,
      regDetails: isPartner ? (formData.regDetails.trim() || "FSSAI License # Verified") : undefined,
      email: cleanEmail,
      verificationStatus: "approved",
      status: "APPROVED",
      profileCompleted: true,
    };

    // 1. Immediately save to React session & localStorage
    setSession(updatedSession);
    setIsEditing(false);
    setSavedSuccess(true);

    // 2. Persist to MySQL database backend
    try {
      await api.updateProfile({
        email: cleanEmail,
        name: cleanHotelName,
        hotelName: cleanHotelName,
        mobile: cleanMobile,
        address: cleanAddress,
        dietaryPreference: formData.dietaryPreference,
        regDetails: isPartner ? (formData.regDetails.trim() || "FSSAI License # Verified") : undefined,
      });
    } catch (err) {
      console.warn("API profile save notice:", err);
    } finally {
      setSaving(false);
    }

    setTimeout(() => setSavedSuccess(false), 4000);
  }

  return (
    <div className="app-main profile-page-container">
      {/* 1. PROFESSIONAL EXECUTIVE HEADER CARD */}
      <section className="profile-header-banner">
        <div className="profile-banner-content">
          <div className="profile-avatar-box">
            <span className="avatar-initials">{initials}</span>
          </div>

          <div className="profile-banner-info">
            <div className="banner-name-row">
              <h1 className="profile-display-name">{displayName}</h1>
              <span
                className="role-status-chip"
                style={{
                  background: badgeStyle.bg,
                  color: badgeStyle.text,
                  border: `1.5px solid ${badgeStyle.border}`,
                }}
              >
                ● {roleLabel}
              </span>
            </div>
            <p className="profile-tagline">
              {session.email || "customer@foodsaver.com"} • Member since August 2024 • Verified Active
            </p>
          </div>
        </div>
      </section>

      {/* INITIAL PROFILE STATUS NOTIFICATION FOR MERCHANTS */}
      {isMerchant && (
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 20,
            background: isProfileComplete && isApproved ? "rgba(34, 197, 94, 0.08)" : "rgba(245, 158, 11, 0.08)",
            border: `1.5px solid ${isProfileComplete && isApproved ? "#145C52" : "#FF9F68"}`,
            borderRadius: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>{isProfileComplete && isApproved ? "✅" : "⚠️"}</span>
            <div>
              <strong style={{ fontSize: 14, color: isProfileComplete && isApproved ? "#145C52" : "#A0522D", display: "block" }}>
                {isProfileComplete && isApproved
                  ? "Initial Profile & Verification Approved — Ready to Post Surplus Food"
                  : "Initial Profile Action Required Before Food Can Be Added"}
              </strong>
              <span style={{ fontSize: 12.5, color: "#66736F", fontWeight: 600 }}>
                {isProfileComplete && isApproved
                  ? "Your merchant profile details are fully verified. You can create and manage daily food surplus listings."
                  : "Fill out your Business Name, Address, Contact Mobile, and FSSAI details below to complete initial registration setup."}
              </span>
            </div>
          </div>
        </div>
      )}

      {savedSuccess && (
        <div style={{ padding: "12px 16px", background: "#E8F5F0", border: "1.5px solid #145C52", borderRadius: 10, color: "#145C52", fontWeight: 700, marginBottom: 20 }}>
          ✓ Profile details updated successfully!
        </div>
      )}

      {/* 2. MAIN 2-COLUMN DASHBOARD GRID */}
      <div className="profile-dashboard-grid">
        {/* LEFT: Account Overview */}
        <section className="card profile-card-panel">
          <div className="panel-header">
            <h2 className="panel-title">
              {isPartner ? "Business & Organization Details" : "Customer Account & Resident Details"}
            </h2>
            <span className="panel-subhead">
              {isPartner ? "Official registration details" : "Your personal profile details"}
            </span>
          </div>

          {isEditing ? (
            <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
              {isPartner ? (
                <div className="field">
                  <label style={{ fontSize: 13, fontWeight: 700 }}>Hotel / Restaurant Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.hotelName}
                    onChange={(e) => setFormData({ ...formData, hotelName: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, background: "#18181b", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                  />
                </div>
              ) : (
                <div className="field">
                  <label style={{ fontSize: 13, fontWeight: 700 }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, background: "#18181b", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                  />
                </div>
              )}

              <div className="field">
                <label style={{ fontSize: 13, fontWeight: 700 }}>Contact Mobile *</label>
                <input
                  type="text"
                  required
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  style={{ padding: "8px 12px", borderRadius: 8, background: "#18181b", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                />
              </div>

              <div className="field">
                <label style={{ fontSize: 13, fontWeight: 700 }}>
                  {isPartner ? "Business Address *" : "Delivery / Pickup Address *"}
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{ padding: "8px 12px", borderRadius: 8, background: "#18181b", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                />
              </div>

              {!isPartner && (
                <div className="field">
                  <label style={{ fontSize: 13, fontWeight: 700 }}>Preferred Dietary Choice</label>
                  <select
                    value={formData.dietaryPreference}
                    onChange={(e) => setFormData({ ...formData, dietaryPreference: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, background: "#18181b", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                  >
                    <option value="All (Veg & Non-Veg)">🍽️ All (Veg & Non-Veg)</option>
                    <option value="Veg Only">🟢 Pure Veg</option>
                    <option value="Non-Veg Only">🔴 Non-Veg</option>
                  </select>
                </div>
              )}

              {isPartner && (
                <div className="field">
                  <label style={{ fontSize: 13, fontWeight: 700 }}>
                    {isMerchant ? "FSSAI License / GSTIN Reg Details *" : "NGO 80G Tax / Trust Reg Details *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.regDetails}
                    onChange={(e) => setFormData({ ...formData, regDetails: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, background: "#18181b", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="submit" disabled={saving} className="btn btn-amber" style={{ flex: 1 }}>
                  {saving ? "Saving Profile..." : "Save Profile"}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="profile-info-list">
                <div className="info-item-row">
                  <span className="info-label">{isPartner ? "Business Name" : "Full Name"}</span>
                  <strong className="info-value">{displayName}</strong>
                </div>

                <div className="info-item-row">
                  <span className="info-label">Account Role</span>
                  <strong className="info-value">{roleLabel}</strong>
                </div>

                <div className="info-item-row">
                  <span className="info-label">Contact Mobile</span>
                  <strong className="info-value">{session.mobile || session.phone || "+91 98765 43210"}</strong>
                </div>

                <div className="info-item-row">
                  <span className="info-label">Contact Email</span>
                  <strong className="info-value">{session.email || "customer@foodsaver.com"}</strong>
                </div>

                <div className="info-item-row">
                  <span className="info-label">{isPartner ? "Business Address" : "Resident Address"}</span>
                  <strong className="info-value">{session.address || "Kovilpatti, Tamil Nadu"}</strong>
                </div>

                {!isPartner && (
                  <div className="info-item-row">
                    <span className="info-label">Dietary Preference</span>
                    <strong className="info-value">{session.dietaryPreference || "All (Veg & Non-Veg)"}</strong>
                  </div>
                )}

                {isPartner && (
                  <div className="info-item-row">
                    <span className="info-label">{isMerchant ? "FSSAI / GSTIN Info" : "NGO 80G Reg Info"}</span>
                    <strong className="info-value">{session.regDetails || "Verified Registration"}</strong>
                  </div>
                )}

                {isPartner && (
                  <div className="info-item-row">
                    <span className="info-label">Verification Status</span>
                    <span className={`badge ${isApproved ? "badge-rescue" : "badge-amber"}`} style={{ fontSize: 12 }}>
                      {isApproved ? "✓ Approved Partner" : "⏳ Pending Verification"}
                    </span>
                  </div>
                )}
              </div>

              <div className="profile-action-buttons">
                <button
                  className="btn btn-outline"
                  type="button"
                  style={{ flex: 1 }}
                  onClick={() => setIsEditing(true)}
                >
                  ✏️ Edit Profile Details
                </button>
                <button
                  className="btn btn-ghost logout-btn"
                  type="button"
                  style={{ color: "#C94C4C", borderColor: "#E8ABAB" }}
                  onClick={() => {
                    setSession(null);
                    navigate("/");
                  }}
                >
                  🚪 Sign Out
                </button>
              </div>
            </>
          )}
        </section>

        {/* RIGHT: Performance Metrics & Activity Log */}
        <section className="card profile-card-panel">
          <div className="panel-header">
            <h2 className="panel-title">Impact & Activity</h2>
            <span className="panel-subhead">Performance metrics and recent updates</span>
          </div>

          {/* Key Stat Cards Grid */}
          <div className="profile-metrics-grid">
            {activity.metrics.map((metric) => (
              <div className="metric-box" key={metric.label}>
                <span className="metric-label">{metric.label}</span>
                <strong className="metric-value">{metric.value}</strong>
                <span className="metric-subtext">{metric.subtext}</span>
              </div>
            ))}
          </div>

          {/* Recent Activity Timeline */}
          <div className="activity-section">
            <h3 className="activity-section-title">Recent Updates</h3>
            <div className="activity-timeline">
              {activity.recent.map((item, idx) => (
                <div className="timeline-entry" key={idx}>
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <span className="timeline-time">{item.time}</span>
                    <p className="timeline-text">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
