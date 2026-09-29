import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { useCart } from "../lib/cart.jsx";
import { useTranslation } from "../lib/i18n.jsx";
import { socket } from "../lib/socket.js";
import { api } from "../lib/api.js";
import NotificationBell from "./NotificationBell.jsx";
import { Globe } from "lucide-react";

const CITIES = ["Kovilpatti", "Chennai", "Madurai", "Coimbatore", "Bangalore", "Trichy"];

function AdminNotificationBell({ navigate }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadNotifications();

    const onNewNotif = (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on("admin:notification", onNewNotif);
    return () => socket.off("admin:notification", onNewNotif);
  }, []);

  async function loadNotifications() {
    try {
      const res = await api.getAdminNotifications();
      if (res && res.notifications) {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (e) {
      console.error("Failed loading admin notifications", e);
    }
  }

  async function handleNotificationClick(notif) {
    try {
      await api.markAdminNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error("Failed marking read", e);
    }
    setOpen(false);
    navigate("/admin");
  }

  async function handleMarkAllRead(e) {
    e.stopPropagation();
    try {
      await api.markAllAdminNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="header-nav-link-item"
        style={{ position: "relative", padding: "6px 12px", background: unreadCount > 0 ? "rgba(245,158,11,0.15)" : "transparent", borderRadius: 10, border: "1px solid rgba(245,158,11,0.3)" }}
        onClick={() => setOpen((prev) => !prev)}
        title="Admin Notifications"
      >
        <span>🔔</span>
        <strong style={{ fontSize: 12, marginLeft: 4 }}>Admin Alerts</strong>
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              background: "#C94C4C",
              color: "#ffffff",
              fontSize: 10,
              fontWeight: 900,
              padding: "2px 6px",
              borderRadius: 10,
              boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 42,
            right: 0,
            width: 320,
            background: "#24332F",
            border: "1.5px solid #FF9F68",
            borderRadius: 14,
            boxShadow: "0 15px 40px rgba(0,0,0,0.5)",
            zIndex: 9999,
            padding: 14,
            color: "#ffffff",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, borderBottom: "1px solid #2D3B37", paddingBottom: 8 }}>
            <strong style={{ fontSize: 13, color: "#FF9F68" }}>🔔 Admin Notifications ({unreadCount} Unread)</strong>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} style={{ background: "none", border: "none", color: "#38bdf8", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Mark All Read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {notifications.length === 0 ? (
              <span style={{ fontSize: 12, color: "#8A9490", textAlign: "center", padding: "12px 0" }}>No notifications yet</span>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: n.isRead ? "rgba(30,41,59,0.4)" : "rgba(245,158,11,0.12)",
                    border: `1px solid ${n.isRead ? "#2D3B37" : "rgba(245,158,11,0.3)"}`,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  <strong style={{ color: n.isRead ? "#cbd5e1" : "#ffffff", display: "block", marginBottom: 2 }}>
                    🏨 {n.hotelName}
                  </strong>
                  <p style={{ margin: 0, color: "#8A9490", fontSize: 11.5, lineHeight: 1.4 }}>{n.message}</p>
                  <span style={{ fontSize: 10, color: "#64748b", marginTop: 4, display: "block" }}>
                    {new Date(n.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header({
  onOpenAuth,
  searchQuery = "",
  onSearchChange = () => {},
  city = "Kovilpatti",
  onCityChange = () => {},
}) {
  const { session } = useSession();
  const navigate = useNavigate();
  const { totalCount, setIsCartOpen } = useCart();
  const { language, setLanguage, t } = useTranslation();
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  return (
    <header className="marketplace-header">
      <div className="header-inner">
        {/* Left: App Branding */}
        <div className="header-left">
          <div
            className="brand"
            onClick={() => navigate("/")}
            aria-label="Food Saver Home"
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
          >
            <img
              src="/logo.png"
              alt="FoodSaver"
              style={{ width: 42, height: 42, objectFit: "contain", borderRadius: 10 }}
            />
            <div className="brand-copy">
              <strong style={{ fontSize: 18, color: "#145C52", fontWeight: 800, letterSpacing: "-0.2px" }}>FoodSaver</strong>
              <span style={{ fontSize: 11, color: "#687674", fontWeight: 600 }}>Good Food • Less Waste</span>
            </div>
          </div>
        </div>

        {/* Center: Location + Search Bar */}
        <div className="header-center-bar">
          {/* Location Selector */}
          <div
            className="header-location-selector"
            onClick={() => setShowCityDropdown((prev) => !prev)}
            title="Change Location"
          >
            <svg className="location-pin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16796B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span className="location-city-name">{city}</span>
            <svg className="dropdown-caret-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>

            {showCityDropdown && (
              <div className="header-city-dropdown-menu">
                <div className="city-dropdown-header">Select City</div>
                {CITIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`city-menu-item ${c === city ? "active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCityChange(c);
                      setShowCityDropdown(false);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="header-vertical-divider" />

          {/* Search Field */}
          <div className="header-search-container">
            <svg className="search-field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A9490" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="search"
              className="header-search-input"
              placeholder="Search food, cafés or nearby partners…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>

        {/* Right: Offers, My Orders, Nearby Map, Language, Auth & Cart Actions */}
        <div className="header-right">
          {/* Language Switcher */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="header-nav-link-item"
              onClick={() => setShowLangDropdown((prev) => !prev)}
              title="Change Language"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 10, background: "rgba(20, 92, 82, 0.08)" }}
            >
              <Globe className="w-3.5 h-3.5 text-[#145C52]" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#145C52" }}>{language === "ta" ? "தமிழ்" : "EN"}</span>
            </button>
            {showLangDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: 38,
                  right: 0,
                  background: "#FFFFFF",
                  border: "1px solid #DCE6E3",
                  borderRadius: 12,
                  padding: 4,
                  minWidth: 110,
                  boxShadow: "0 10px 25px rgba(20, 92, 82, 0.12)",
                  zIndex: 100,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setLanguage("en");
                    setShowLangDropdown(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 12px",
                    fontSize: 12,
                    color: language === "en" ? "#145C52" : "#102A2A",
                    fontWeight: language === "en" ? 800 : 500,
                    background: language === "en" ? "#E8F4F1" : "transparent",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  🇬🇧 English
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage("ta");
                    setShowLangDropdown(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 12px",
                    fontSize: 12,
                    color: language === "ta" ? "#145C52" : "#102A2A",
                    fontWeight: language === "ta" ? 800 : 500,
                    background: language === "ta" ? "#E8F4F1" : "transparent",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  🇮🇳 தமிழ்
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="header-nav-link-item"
            onClick={() => (session ? navigate("/customer") : onOpenAuth("login"))}
          >
            🏷️ Offers
          </button>

          {(!session || session?.role === "customer") && (
            <button
              type="button"
              className="header-nav-link-item"
              onClick={() => navigate("/customer/nearby-food")}
              title="View 2 km Nearby Food Marketplace Map"
              style={{
                color: "#145C52",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "#E8F4F1",
                padding: "6px 12px",
                borderRadius: "10px",
                border: "1px solid #DCE6E3",
              }}
            >
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#16796B", boxShadow: "0 0 8px #16796B" }} className="animate-pulse" />
              <span>📍 {t("nav.nearbyFood")}</span>
            </button>
          )}

          {session?.role === "customer" && (
            <button
              type="button"
              className="header-nav-link-item"
              onClick={() => navigate("/customer/pickups")}
              title="View my claimed food tokens and order tracker"
            >
              🛍️ {t("nav.myPickups")}
            </button>
          )}

          {session?.role === "merchant" && (
            <>
              <button
                type="button"
                className="header-nav-link-item"
                onClick={() => navigate("/merchant/counter")}
                title="View All Received Customer Orders & Counter Pickups"
                style={{ color: "#145C52", fontWeight: 700 }}
              >
                🧾 {t("merchant.manageOrders")}
              </button>
              <button
                type="button"
                className="header-nav-link-item"
                onClick={() => navigate("/merchant/donations")}
                title="Post Unsold Surplus Food for NGO Pickups"
                style={{ color: "#16796B", fontWeight: 700 }}
              >
                🎁 {t("merchant.transferNgo")}
              </button>
            </>
          )}

          {session?.role === "ngo" && (
            <button
              type="button"
              className="header-nav-link-item"
              onClick={() => navigate("/ngo/donations")}
              title="Claim Unsold Food Surplus from Merchants within 5 km"
              style={{ color: "#145C52", fontWeight: 700 }}
            >
              🎁 {t("ngo.claimDonation")}
            </button>
          )}

          <button
            type="button"
            className="header-nav-link-item"
            onClick={() => alert("Food Saver Support: Help center active at support@foodsaver.com")}
          >
            ❓ Help
          </button>

          {session && <NotificationBell />}

          {session?.role === "admin" && (
            <AdminNotificationBell navigate={navigate} />
          )}

          {session ? (
            <button
              className="header-profile-btn"
              type="button"
              title="View Profile & Account Details"
              onClick={() => navigate("/profile")}
            >
              <div className="header-avatar-circle">
                {(session.hotelName || session.name)?.slice(0, 1).toUpperCase() || "U"}
              </div>
              <span className="header-profile-name">
                {session.hotelName || session.name}
              </span>
            </button>
          ) : (
            <div className="auth-actions">
              <button
                className="btn btn-primary nav-auth-btn"
                type="button"
                onClick={() => onOpenAuth("login")}
              >
                {t("auth.login")}
              </button>
              <button
                className="btn btn-primary nav-auth-btn"
                type="button"
                onClick={() => onOpenAuth("signup")}
              >
                {t("auth.register")}
              </button>
            </div>
          )}

          <button
            type="button"
            className="header-cart-btn"
            data-cart-icon="true"
            id="cart-icon-target"
            onClick={() => setIsCartOpen(true)}
            title="Open Food Cart"
            style={{ position: "relative" }}
          >
            🛒 Cart
            <span
              className="cart-badge-count"
              style={{
                marginLeft: 6,
                background: "var(--amber, #FF9F68)",
                color: "#000",
                fontWeight: 800,
                fontSize: 11,
                padding: "2px 7px",
                borderRadius: 10,
              }}
            >
              {totalCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
