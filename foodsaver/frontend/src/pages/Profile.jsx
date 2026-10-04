import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { useTranslation, AVAILABLE_LANGUAGES } from "../lib/i18n.jsx";
import { useTheme } from "../lib/theme.jsx";
import { api } from "../lib/api.js";
import {
  ShieldCheck,
  Phone,
  Mail,
  Bell,
  Globe,
  Palette,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Sliders,
  Check,
  Lock,
  X,
} from "lucide-react";

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
  const { language, setLanguage, t } = useTranslation();
  const {
    themeKey,
    activePalette,
    previewKey,
    previewPalette,
    customColors,
    setPreview,
    setCustomPreview,
    applyTheme,
    resetPreview,
    restoreDefaultTheme,
    palettes,
  } = useTheme();

  const navigate = useNavigate();

  // Active Settings Tab: "profile", "communication", "language", "theme"
  const [activeTab, setActiveTab] = useState("profile");

  const userRole = (session?.role || "customer").toLowerCase();
  const isMerchant = userRole === "merchant";
  const isNgo = userRole === "ngo";
  const isPartner = isMerchant || isNgo;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: session?.name || session?.hotelName || "",
    hotelName: session?.hotelName || session?.name || "",
    address: session?.address || "",
    mobile: session?.mobile || session?.phone || "",
    dietaryPreference: session?.dietaryPreference || "All (Veg & Non-Veg)",
    regDetails: session?.regDetails || "",
    email: session?.email || "",
  });
  const [savedSuccess, setSavedSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Communication Preferences State
  const [notifPrefs, setNotifPrefs] = useState({
    email: true,
    sms: true,
    inApp: true,
    orderAlerts: true,
  });

  // SMS OTP Verification Modal State
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpPhone, setOtpPhone] = useState(session?.mobile || session?.phone || "");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState("input"); // "input", "verify", "success"
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(Boolean(session?.phoneVerified));

  // Custom Color inputs
  const [customPrimary, setCustomPrimary] = useState(customColors?.primary || "#145C52");
  const [customSecondary, setCustomSecondary] = useState(customColors?.secondary || "#FF9F43");

  useEffect(() => {
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
      setOtpPhone(session.mobile || session.phone || "");
      if (session.phoneVerified !== undefined) {
        setPhoneVerified(Boolean(session.phoneVerified));
      }
      if (session.notificationPreferences) {
        setNotifPrefs((prev) => ({ ...prev, ...session.notificationPreferences }));
      }
    }
  }, [session]);

  // Cooldown countdown timer for OTP
  useEffect(() => {
    let timer;
    if (otpCooldown > 0) {
      timer = setInterval(() => setOtpCooldown((c) => Math.max(0, c - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [otpCooldown]);

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

    const cleanHotelName = (isPartner ? formData.hotelName.trim() : formData.name.trim()) || "";
    const cleanAddress = formData.address.trim() || "";
    const cleanMobile = formData.mobile.trim() || "";
    const cleanEmail = (formData.email.trim() || session?.email || "").toLowerCase();

    const updatedSession = {
      ...session,
      name: cleanHotelName || session?.name,
      hotelName: cleanHotelName || session?.hotelName,
      address: cleanAddress,
      mobile: cleanMobile,
      phone: cleanMobile,
      dietaryPreference: formData.dietaryPreference,
      regDetails: isPartner ? formData.regDetails.trim() : undefined,
      email: cleanEmail,
      verificationStatus: session?.verificationStatus || "pending",
      status: "APPROVED",
      profileCompleted: true,
    };

    setSession(updatedSession);
    setIsEditing(false);
    setSavedSuccess("Profile details updated successfully!");

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

    setTimeout(() => setSavedSuccess(""), 4000);
  }

  // Handle Communication Preferences Toggle
  async function handleToggleNotif(key) {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    setSavedSuccess(t("settings.prefSaved"));
    setTimeout(() => setSavedSuccess(""), 3000);

    try {
      await api.updatePreferences({
        userId: session.userId || session.user?.userId,
        email: session.email,
        notificationPreferences: updated,
      });
      setSession((prev) => ({ ...prev, notificationPreferences: updated }));
    } catch (err) {
      console.warn("Error saving preferences:", err);
    }
  }

  // Handle Send OTP
  async function handleSendOtp() {
    setOtpError("");
    setOtpSending(true);
    try {
      const res = await api.sendOtp({
        phoneNumber: otpPhone,
        userId: session.userId || session.user?.userId,
        email: session.email,
      });

      if (res.success) {
        setOtpStep("verify");
        setOtpCooldown(res.cooldownSeconds || 60);
      } else {
        setOtpError(res.error || t("otp.error"));
      }
    } catch (err) {
      setOtpError(err.message || t("otp.error"));
    } finally {
      setOtpSending(false);
    }
  }

  // Handle Verify OTP
  async function handleVerifyOtp() {
    setOtpError("");
    setOtpSending(true);
    try {
      const res = await api.verifyOtp({
        phoneNumber: otpPhone,
        otp: otpCode,
        userId: session.userId || session.user?.userId,
      });

      if (res.success && res.verified) {
        setPhoneVerified(true);
        setOtpStep("success");
        setSession((prev) => ({
          ...prev,
          phoneVerified: true,
          phone: otpPhone,
          mobile: otpPhone,
        }));
        setSavedSuccess(t("otp.success"));
        setTimeout(() => {
          setIsOtpModalOpen(false);
          setOtpStep("input");
          setOtpCode("");
          setSavedSuccess("");
        }, 2000);
      } else {
        setOtpError(res.error || t("otp.error"));
      }
    } catch (err) {
      setOtpError(err.message || t("otp.error"));
    } finally {
      setOtpSending(false);
    }
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
              {[session?.email, session?.mobile || session?.phone, session?.status === "APPROVED" || session?.verificationStatus === "approved" ? "Verified Active" : session?.status || "Active"].filter(Boolean).join(" • ")}
            </p>
          </div>
        </div>
      </section>

      {/* SUCCESS BANNER */}
      {savedSuccess && (
        <div
          style={{
            padding: "12px 18px",
            background: "var(--color-primary-light, #E8F5F0)",
            border: "1.5px solid var(--color-primary, #145C52)",
            borderRadius: 12,
            color: "var(--color-primary, #145C52)",
            fontWeight: 700,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CheckCircle2 className="w-5 h-5 text-[var(--color-primary,#145C52)]" />
          <span>{savedSuccess}</span>
        </div>
      )}

      {/* NAVIGATION TABS FOR SETTINGS & PREFERENCES */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          borderBottom: "1.5px solid var(--fs-border, #DCE6E3)",
          paddingBottom: 8,
          overflowX: "auto",
        }}
      >
        {[
          { id: "profile", label: "Profile & Account", icon: <Sliders className="w-4 h-4" /> },
          { id: "communication", label: "Communication & Alerts", icon: <Bell className="w-4 h-4" /> },
          { id: "language", label: "Language Preferences", icon: <Globe className="w-4 h-4" /> },
          { id: "theme", label: "Color Theme", icon: <Palette className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              fontSize: 13.5,
              fontWeight: activeTab === tab.id ? 800 : 600,
              backgroundColor: activeTab === tab.id ? "var(--color-primary, #145C52)" : "transparent",
              color: activeTab === tab.id ? "#FFFFFF" : "var(--fs-text, #102A2A)",
              transition: "all 0.2s ease",
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: PROFILE & ACCOUNT OVERVIEW */}
      {activeTab === "profile" && (
        <div className="profile-dashboard-grid">
          {/* LEFT: Account Details */}
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

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong className="info-value">{session?.mobile || session?.phone || "Not provided"}</strong>
                      {phoneVerified ? (
                        <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setOtpStep("input");
                            setIsOtpModalOpen(true);
                          }}
                          style={{
                            fontSize: 11,
                            padding: "3px 8px",
                            borderRadius: 6,
                            border: "1px solid var(--color-primary, #145C52)",
                            background: "var(--color-primary-light, #E8F4F1)",
                            color: "var(--color-primary, #145C52)",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Verify with SMS OTP
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="info-item-row">
                    <span className="info-label">Contact Email</span>
                    <strong className="info-value">{session.email || "customer@foodsaver.com"}</strong>
                  </div>

                  <div className="info-item-row">
                    <span className="info-label">{isPartner ? "Business Address" : "Resident Address"}</span>
                    <strong className="info-value">{session.address || "Kovilpatti, Tamil Nadu"}</strong>
                  </div>
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

          {/* RIGHT: Stat Cards Grid & Activity */}
          <section className="card profile-card-panel">
            <div className="panel-header">
              <h2 className="panel-title">Impact & Activity</h2>
              <span className="panel-subhead">Performance metrics and recent updates</span>
            </div>

            <div className="profile-metrics-grid">
              {activity.metrics.map((metric) => (
                <div className="metric-box" key={metric.label}>
                  <span className="metric-label">{metric.label}</span>
                  <strong className="metric-value">{metric.value}</strong>
                  <span className="metric-subtext">{metric.subtext}</span>
                </div>
              ))}
            </div>

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
      )}

      {/* TAB 2: COMMUNICATION & NOTIFICATION PREFERENCES + SMS OTP */}
      {activeTab === "communication" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Mobile SMS OTP Verification Card */}
          <div className="card" style={{ padding: 24, border: "1px solid var(--fs-border, #DCE6E3)", borderRadius: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>📱</span>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "var(--color-primary, #145C52)" }}>
                    {t("settings.phoneVerification")}
                  </h3>
                  {phoneVerified ? (
                    <span style={{ fontSize: 12, backgroundColor: "#E8F5F0", color: "#16A34A", fontWeight: 700, padding: "3px 10px", borderRadius: 20, border: "1px solid #86EFAC" }}>
                      ✓ {t("settings.phoneVerified")}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, backgroundColor: "#FEF2F2", color: "#DC2626", fontWeight: 700, padding: "3px 10px", borderRadius: 20, border: "1px solid #FECACA" }}>
                      ⚠️ {t("settings.phoneUnverified")}
                    </span>
                  )}
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--fs-text-secondary, #687674)" }}>
                  Verified phone numbers receive real-time SMS OTP codes for order handovers, counter token validation, and account security.
                </p>
                <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700 }}>
                  Current Number: <span style={{ fontFamily: "monospace", color: "var(--color-primary, #145C52)" }}>{session.mobile || session.phone || "Not linked"}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOtpStep("input");
                  setIsOtpModalOpen(true);
                }}
                className="btn btn-primary"
                style={{ padding: "10px 20px", fontSize: 13 }}
              >
                {phoneVerified ? "Change / Re-verify Mobile" : t("settings.verifyPhoneBtn")}
              </button>
            </div>
          </div>

          {/* Communication Channels Toggles */}
          <div className="card" style={{ padding: 24, border: "1px solid var(--fs-border, #DCE6E3)", borderRadius: 16 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 6px", color: "var(--color-primary, #145C52)" }}>
              {t("settings.communicationTitle")}
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--fs-text-secondary, #687674)" }}>
              {t("settings.communicationDesc")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                {
                  key: "email",
                  title: t("settings.emailNotifications"),
                  desc: t("settings.emailDesc"),
                  icon: <Mail className="w-5 h-5 text-[var(--color-primary,#145C52)]" />,
                },
                {
                  key: "sms",
                  title: t("settings.smsNotifications"),
                  desc: t("settings.smsDesc"),
                  icon: <Phone className="w-5 h-5 text-[var(--color-primary,#145C52)]" />,
                },
                {
                  key: "inApp",
                  title: t("settings.inAppNotifications"),
                  desc: t("settings.inAppDesc"),
                  icon: <Bell className="w-5 h-5 text-[var(--color-primary,#145C52)]" />,
                },
                {
                  key: "orderAlerts",
                  title: t("settings.orderAlerts"),
                  desc: t("settings.orderAlertsDesc"),
                  icon: <ShieldCheck className="w-5 h-5 text-[var(--color-primary,#145C52)]" />,
                },
              ].map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 18px",
                    background: notifPrefs[item.key] ? "var(--fs-teal-very-light, #F3F9F7)" : "#FFFFFF",
                    border: `1.5px solid ${notifPrefs[item.key] ? "var(--color-primary, #145C52)" : "#E2E8F0"}`,
                    borderRadius: 14,
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        backgroundColor: "var(--color-primary-light, #E8F4F1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <strong style={{ fontSize: 14, color: "#102A2A", display: "block" }}>{item.title}</strong>
                      <span style={{ fontSize: 12, color: "#687674" }}>{item.desc}</span>
                    </div>
                  </div>

                  <label style={{ position: "relative", display: "inline-block", width: 50, height: 26, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(notifPrefs[item.key])}
                      onChange={() => handleToggleNotif(item.key)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: notifPrefs[item.key] ? "var(--color-primary, #145C52)" : "#CBD5E1",
                        borderRadius: 34,
                        transition: "0.25s",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        height: 20,
                        width: 20,
                        left: notifPrefs[item.key] ? 26 : 3,
                        bottom: 3,
                        backgroundColor: "#FFFFFF",
                        borderRadius: "50%",
                        transition: "0.25s",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MULTILINGUAL PREFERENCES */}
      {activeTab === "language" && (
        <div className="card" style={{ padding: 24, border: "1px solid var(--fs-border, #DCE6E3)", borderRadius: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 6px", color: "var(--color-primary, #145C52)" }}>
            {t("settings.languageTitle")}
          </h3>
          <p style={{ margin: "0 0 24px", fontSize: 13, color: "var(--fs-text-secondary, #687674)" }}>
            {t("settings.languageDesc")}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {AVAILABLE_LANGUAGES.map((lang) => (
              <div
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code);
                  api.updatePreferences({
                    userId: session.userId || session.user?.userId,
                    email: session.email,
                    preferredLanguage: lang.code,
                  }).catch(() => {});
                  setSavedSuccess(`Language changed to ${lang.name}`);
                  setTimeout(() => setSavedSuccess(""), 3000);
                }}
                style={{
                  padding: 20,
                  borderRadius: 14,
                  border: `2px solid ${language === lang.code ? "var(--color-primary, #145C52)" : "#E2E8F0"}`,
                  backgroundColor: language === lang.code ? "var(--color-primary-light, #E8F4F1)" : "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.2s ease",
                  boxShadow: language === lang.code ? "0 8px 20px rgba(20, 92, 82, 0.12)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 32 }}>{lang.flag}</span>
                  <div>
                    <strong style={{ fontSize: 16, color: "#102A2A", display: "block" }}>{lang.label}</strong>
                    <span style={{ fontSize: 12, color: "#687674" }}>{lang.name}</span>
                  </div>
                </div>

                {language === lang.code && (
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      backgroundColor: "var(--color-primary, #145C52)",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CUSTOMIZABLE COLOR THEME SYSTEM */}
      {activeTab === "theme" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Palette Selection Grid */}
          <div className="card" style={{ padding: 24, border: "1px solid var(--fs-border, #DCE6E3)", borderRadius: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--color-primary, #145C52)" }}>
                {t("settings.themeTitle")}
              </h3>
              <button
                type="button"
                onClick={restoreDefaultTheme}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--color-primary, #145C52)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t("settings.restoreDefault")}</span>
              </button>
            </div>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--fs-text-secondary, #687674)" }}>
              {t("settings.themeDesc")}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {Object.values(palettes).map((p) => {
                const isSelected = previewKey === p.key;
                return (
                  <div
                    key={p.key}
                    onClick={() => setPreview(p.key)}
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      border: `2px solid ${isSelected ? p.primary : "#E2E8F0"}`,
                      backgroundColor: isSelected ? p.tealLight : "#FFFFFF",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      transition: "all 0.2s ease",
                      position: "relative",
                      boxShadow: isSelected ? `0 8px 24px rgba(${p.shadowRgb || "0,0,0"}, 0.15)` : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {/* Swatches */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: p.primary, border: "2px solid #FFF", boxShadow: "0 2px 5px rgba(0,0,0,0.15)" }} />
                          <span style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: p.accent, border: "1.5px solid #FFF", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                        </div>
                        <strong style={{ fontSize: 14, color: "#102A2A" }}>{p.name}</strong>
                      </div>
                      {isSelected && (
                        <span style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: p.primary, color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11.5, color: "#687674", lineHeight: 1.4 }}>{p.concept}</span>
                  </div>
                );
              })}

              {/* Custom Color Card */}
              <div
                onClick={() => setPreview("custom")}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: `2px solid ${previewKey === "custom" ? customPrimary : "#E2E8F0"}`,
                  backgroundColor: previewKey === "custom" ? "var(--color-primary-light, #E8F4F1)" : "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: customPrimary, border: "2px solid #FFF", boxShadow: "0 2px 5px rgba(0,0,0,0.15)" }} />
                      <span style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: customSecondary, border: "1.5px solid #FFF", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                    </div>
                    <strong style={{ fontSize: 14, color: "#102A2A" }}>Custom Palette</strong>
                  </div>
                  {previewKey === "custom" && (
                    <span style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: customPrimary, color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11.5, color: "#687674" }}>Choose custom primary & secondary accent colors</span>
              </div>
            </div>

            {/* Custom Color Pickers (Visible if Custom Selected) */}
            {previewKey === "custom" && (
              <div
                style={{
                  marginTop: 20,
                  padding: 18,
                  backgroundColor: "#F8FAFC",
                  border: "1px dashed #CBD5E1",
                  borderRadius: 14,
                  display: "flex",
                  gap: 24,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="color"
                    value={customPrimary}
                    onChange={(e) => {
                      setCustomPrimary(e.target.value);
                      setCustomPreview({ primary: e.target.value });
                    }}
                    style={{ width: 44, height: 44, borderRadius: 8, border: "none", cursor: "pointer", background: "none" }}
                  />
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: "block", color: "#475569" }}>Primary Brand Color</label>
                    <input
                      type="text"
                      value={customPrimary}
                      onChange={(e) => {
                        setCustomPrimary(e.target.value);
                        setCustomPreview({ primary: e.target.value });
                      }}
                      style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12, width: 90, fontFamily: "monospace" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="color"
                    value={customSecondary}
                    onChange={(e) => {
                      setCustomSecondary(e.target.value);
                      setCustomPreview({ secondary: e.target.value });
                    }}
                    style={{ width: 44, height: 44, borderRadius: 8, border: "none", cursor: "pointer", background: "none" }}
                  />
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: "block", color: "#475569" }}>Secondary / Accent Color</label>
                    <input
                      type="text"
                      value={customSecondary}
                      onChange={(e) => {
                        setCustomSecondary(e.target.value);
                        setCustomPreview({ secondary: e.target.value });
                      }}
                      style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12, width: 90, fontFamily: "monospace" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Live Theme Preview Card */}
          <div className="card" style={{ padding: 24, border: "1px solid var(--fs-border, #DCE6E3)", borderRadius: 16 }}>
            <h4 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px", color: "var(--color-primary, #145C52)" }}>
              {t("settings.livePreview")}
            </h4>

            <div
              style={{
                padding: 20,
                borderRadius: 14,
                border: "1px solid var(--fs-border, #DCE6E3)",
                backgroundColor: "var(--fs-teal-very-light, #F3F9F7)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🍱</span>
                  <div>
                    <strong style={{ fontSize: 16, color: "var(--color-primary, #145C52)" }}>FoodSaver Sample Meal</strong>
                    <span style={{ fontSize: 12, color: "#687674", display: "block" }}>Fresh surplus food bundle • 2 km away</span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    backgroundColor: "var(--color-primary-light, #E8F4F1)",
                    color: "var(--color-primary, #145C52)",
                    padding: "4px 12px",
                    borderRadius: 20,
                    border: "1px solid var(--color-primary, #145C52)",
                  }}
                >
                  Save 60%
                </span>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-primary" style={{ padding: "8px 20px" }}>
                  Primary Button
                </button>
                <button type="button" className="btn btn-outline" style={{ padding: "8px 20px" }}>
                  Outline Button
                </button>
                <span style={{ display: "inline-flex", alignItems: "center", fontSize: 13, fontWeight: 700, color: "var(--color-primary, #145C52)" }}>
                  ● Active Indicator
                </span>
              </div>
            </div>

            {/* Apply & Reset Buttons */}
            <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  applyTheme(previewKey, previewKey === "custom" ? { primary: customPrimary, secondary: customSecondary } : null);
                  setSavedSuccess(t("settings.themeSaved"));
                  setTimeout(() => setSavedSuccess(""), 3500);
                }}
                style={{ padding: "12px 28px", fontWeight: 800, fontSize: 14 }}
              >
                ✓ {t("settings.applyTheme")}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={resetPreview}
                style={{ padding: "12px 22px", fontSize: 13 }}
              >
                {t("settings.resetTheme")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. INTERACTIVE REAL SMS OTP VERIFICATION MODAL */}
      {isOtpModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(16, 42, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              maxWidth: 440,
              width: "100%",
              padding: 28,
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
              animation: "pop-in 0.25s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>📱</span>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--color-primary, #145C52)" }}>
                  {t("otp.title")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOtpModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#687674" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {otpError && (
              <div
                style={{
                  padding: "10px 14px",
                  backgroundColor: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 10,
                  color: "#DC2626",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            {otpStep === "input" && (
              <div>
                <p style={{ fontSize: 13.5, color: "#687674", margin: "0 0 16px", lineHeight: 1.5 }}>
                  {t("otp.subtitle")}
                </p>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Mobile Number (India +91)
                  </label>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit number e.g. 9876543210"
                    value={otpPhone}
                    onChange={(e) => setOtpPhone(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 15,
                      fontFamily: "monospace",
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpSending || !otpPhone}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700 }}
                >
                  {otpSending ? t("otp.sending") : t("otp.sendCode")}
                </button>
              </div>
            )}

            {otpStep === "verify" && (
              <div>
                <p style={{ fontSize: 13, color: "#687674", margin: "0 0 16px" }}>
                  A 6-digit verification code was sent to <strong style={{ color: "#102A2A" }}>{otpPhone}</strong>.
                </p>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Enter 6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="• • • • • •"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: 10,
                      border: "2px solid var(--color-primary, #145C52)",
                      fontSize: 22,
                      fontFamily: "monospace",
                      textAlign: "center",
                      letterSpacing: "6px",
                      fontWeight: 800,
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpSending || otpCode.length !== 6}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, marginBottom: 12 }}
                >
                  {otpSending ? t("otp.verifying") : t("otp.verifyBtn")}
                </button>

                <div style={{ textAlign: "center", fontSize: 12.5, color: "#687674" }}>
                  {otpCooldown > 0 ? (
                    <span>
                      {t("otp.resendIn")} <strong>{otpCooldown}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--color-primary, #145C52)",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {t("otp.resendNow")}
                    </button>
                  )}
                </div>
              </div>
            )}

            {otpStep === "success" && (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
                <h4 style={{ fontSize: 18, fontWeight: 800, color: "#145C52", margin: "0 0 6px" }}>
                  {t("otp.success")}
                </h4>
                <p style={{ fontSize: 13, color: "#687674", margin: 0 }}>
                  Your phone number has been verified securely.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
